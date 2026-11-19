import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Push de Llamado general / Maquinistas / Voluntarios y Batallón en emergencia (tabla alertas_especiales).
// companias_destino null = todas las Compañías del Cuerpo; personal_destino (Batallón) = solo esos bomberos.

// Cifrado del contenido de una notificación push (RFC 8291, aes128gcm) con la API estándar crypto.subtle.
// Lo reciben el navegador y el servicio de push (Google/Apple/Mozilla) sin poder leerlo.
function b64urlToBytes(s: string): Uint8Array {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  const bin = atob(s);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}
function concat(...partes: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(partes.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of partes) { out.set(p, o); o += p.length; }
  return out;
}
async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, largo: number): Promise<Uint8Array> {
  const clave = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info }, clave, largo * 8));
}

/** Devuelve el cuerpo listo para enviar con «Content-Encoding: aes128gcm». */
async function cifrarPush(p256dh: string, auth: string, mensaje: string): Promise<Uint8Array> {
  const enc = new TextEncoder();
  const uaPublica = b64urlToBytes(p256dh);            // 65 bytes (punto sin comprimir)
  const secretoAuth = b64urlToBytes(auth);            // 16 bytes
  const par = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const asPublica = new Uint8Array(await crypto.subtle.exportKey("raw", par.publicKey));
  const uaClave = await crypto.subtle.importKey("raw", uaPublica, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const compartido = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: uaClave }, par.privateKey, 256));

  const infoClave = concat(enc.encode("WebPush: info\0"), uaPublica, asPublica);
  const ikm = await hkdf(secretoAuth, compartido, infoClave, 32);
  const sal = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(sal, ikm, enc.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(sal, ikm, enc.encode("Content-Encoding: nonce\0"), 12);

  const claro = concat(enc.encode(mensaje), new Uint8Array([2]));   // 0x02 = último (y único) bloque
  const aes = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const cifrado = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, aes, claro));

  const cabecera = new Uint8Array(16 + 4 + 1 + asPublica.length);
  cabecera.set(sal, 0);
  new DataView(cabecera.buffer).setUint32(16, 4096);
  cabecera[20] = asPublica.length;
  cabecera.set(asPublica, 21);
  return concat(cabecera, cifrado);
}

const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY") || "";
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY") || "";
const VAPID_SUBJECT = "mailto:soporte@vigor-bomberos.app";

function bytesToB64url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

let cachedKey: CryptoKey | null = null;
async function getSigningKey(): Promise<CryptoKey> {
  if (cachedKey) return cachedKey;
  const pub = b64urlToBytes(VAPID_PUBLIC_KEY);
  const jwk = { kty: "EC", crv: "P-256", x: bytesToB64url(pub.slice(1, 33)), y: bytesToB64url(pub.slice(33, 65)), d: VAPID_PRIVATE_KEY, ext: true };
  cachedKey = await crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  return cachedKey;
}

async function buildVapidAuthHeader(endpoint: string): Promise<string> {
  const aud = new URL(endpoint).origin;
  const enc = (obj: unknown) => bytesToB64url(new TextEncoder().encode(JSON.stringify(obj)));
  const unsigned = `${enc({ typ: "JWT", alg: "ES256" })}.${enc({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: VAPID_SUBJECT })}`;
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, await getSigningKey(), new TextEncoder().encode(unsigned));
  return `vapid t=${unsigned}.${bytesToB64url(new Uint8Array(sig))}, k=${VAPID_PUBLIC_KEY}`;
}

type Suscripcion = { id: string; endpoint: string; p256dh: string | null; auth: string | null };
// Envía una notificación: con el contenido cifrado (título y texto reales) y prioridad ALTA, para que Android
// la entregue al tiro aunque el celular esté bloqueado o en ahorro de batería. Si el cifrado falla, sale vacía como antes.
async function enviarPush(sub: Suscripcion, contenido: Record<string, unknown>, urgencia: "high" | "normal" = "high"): Promise<number> {
  const cabeceras: Record<string, string> = {
    "Authorization": await buildVapidAuthHeader(sub.endpoint),
    "TTL": urgencia === "high" ? "180" : "3600",
    "Urgency": urgencia,
  };
  let cuerpo: Uint8Array | undefined;
  try {
    if (sub.p256dh && sub.auth) {
      cuerpo = await cifrarPush(sub.p256dh, sub.auth, JSON.stringify(contenido));
      cabeceras["Content-Encoding"] = "aes128gcm";
      cabeceras["Content-Type"] = "application/octet-stream";
    }
  } catch { cuerpo = undefined; }
  if (!cuerpo) cabeceras["Content-Length"] = "0";
  const res = await fetch(sub.endpoint, { method: "POST", headers: cabeceras, body: cuerpo });
  return res.status;
}

const ETIQUETA: Record<string, string> = {
  acuartelamiento: "Llamado general",
  "12_10": "Llamado a Maquinistas",
  "6_6": "Llamado a Voluntarios",
  batallon: "Tu Batallón está en emergencia",
};

Deno.serve(async (req: Request) => {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return new Response("VAPID keys not configured", { status: 500 });

  let body: { alerta_id?: string; cuerpo_id?: string; companias_destino?: string[] | null };
  try { body = await req.json(); } catch { return new Response("bad request", { status: 400 }); }
  const { alerta_id, cuerpo_id } = body;
  const companiasDestino = body.companias_destino ?? null;
  if (!alerta_id || !cuerpo_id) return new Response("missing fields", { status: 400 });

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const json = { headers: { "Content-Type": "application/json" } };

  const { data: alerta } = await supabase
    .from("alertas_especiales")
    .select("id, cuerpo_id, fecha_hora, personal_destino, tipo, detalle")
    .eq("id", alerta_id).eq("cuerpo_id", cuerpo_id).maybeSingle();

  if (!alerta || Date.now() - new Date(alerta.fecha_hora).getTime() > 2 * 60 * 1000) {
    return new Response(JSON.stringify({ enviados: 0, motivo: "no_valido_o_expirado" }), json);
  }

  const personalDestino: string[] = Array.isArray(alerta.personal_destino) ? (alerta.personal_destino as string[]) : [];

  let personalQuery = supabase
    .from("personal")
    .select("id, compania_id, estado, personal_estado_historial!personal_estado_historial_personal_id_fkey(estado, hora_fin), notificaciones_preferencias(alertas_despacho)")
    .eq("cuerpo_id", cuerpo_id).not("compania_id", "is", null).neq("estado", "dado_de_baja");

  if (personalDestino.length > 0) personalQuery = personalQuery.in("id", personalDestino);
  else if (companiasDestino && companiasDestino.length > 0) personalQuery = personalQuery.in("compania_id", companiasDestino);

  const { data: personal } = await personalQuery;

  type PersonalRow = {
    id: string;
    personal_estado_historial?: { estado: string; hora_fin: string | null }[];
    notificaciones_preferencias?: { alertas_despacho: boolean | null } | { alertas_despacho: boolean | null }[] | null;
  };

  const elegibles = ((personal || []) as PersonalRow[])
    .filter((p) => {
      const vigente = (p.personal_estado_historial || []).find((h) => h.hora_fin === null);
      if ((vigente ? vigente.estado : "fuera") === "fuera") return false;
      const prefsRaw = p.notificaciones_preferencias;
      const prefs = Array.isArray(prefsRaw) ? prefsRaw[0] : prefsRaw;
      if (prefs && prefs.alertas_despacho === false) return false;
      return true;
    })
    .map((p) => p.id);

  if (elegibles.length === 0) return new Response(JSON.stringify({ enviados: 0 }), json);

  const { data: subs } = await supabase.from("push_subscripciones").select("id, endpoint, p256dh, auth").in("personal_id", elegibles);

  const etiqueta = ETIQUETA[String(alerta.tipo)] || "Alerta de Central";
  const detalle = typeof alerta.detalle === "string" && alerta.detalle.trim() ? alerta.detalle.trim().slice(0, 160) : "";
  const contenido = {
    tipo: "especial",
    titulo: etiqueta.toUpperCase(),
    cuerpo: detalle || "Central emitió una alerta — abre la app para ver los detalles.",
    tag: `especial-${alerta_id}`,
    url: "inicio_celular.html",
  };
  let enviados = 0;
  for (const sub of (subs || []) as Suscripcion[]) {
    try {
      const status = await enviarPush(sub, contenido);
      if (status === 404 || status === 410) await supabase.from("push_subscripciones").delete().eq("id", sub.id);
      else if (status >= 200 && status < 300) enviados++;
    } catch { /* una suscripción individual fallando no debe frenar el resto */ }
  }
  return new Response(JSON.stringify({ enviados }), json);
});
