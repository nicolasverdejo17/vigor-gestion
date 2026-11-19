import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Push de avisos que no son despacho: pizarra, actividades y cuota atrasada (cuando el tesorero avisa). Llega a la barra de
// notificaciones del celular con sonido y vibración cortos. Los destinatarios se calculan desde la fila real y respetan las preferencias.

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

// Tipos de aviso: pizarra (aviso nuevo en la pizarra), actividad (actividad nueva) y cuota (el tesorero avisó a un deudor).
// Aparecen en la barra de notificaciones del celular con sonido y vibración cortos (no como un despacho).
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const recorta = (t: unknown, n: number) => String(t ?? "").replace(/\s+/g, " ").trim().slice(0, n);
const fechaCorta = (f?: string | null) => {
  if (!f) return "";
  const [a, m, d] = String(f).slice(0, 10).split("-").map(Number);
  return a && m && d ? `${d} de ${MESES[m - 1]}` : "";
};

Deno.serve(async (req: Request) => {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return new Response("VAPID keys not configured", { status: 500 });

  let body: { tipo?: string; id?: string };
  try { body = await req.json(); } catch { return new Response("bad request", { status: 400 }); }
  const { tipo, id } = body;
  if (!tipo || !id) return new Response("missing fields", { status: 400 });

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const json = { headers: { "Content-Type": "application/json" } };
  const reciente = (f?: string | null) => !!f && Date.now() - new Date(f).getTime() <= 2 * 60 * 1000;

  // A quién y qué: se calcula desde la fila real (nunca desde lo que diga quien llama).
  let destinatarios: string[] = [];
  let preferencia: "pizarra" | "actividades" | "cuotas" = "pizarra";
  let contenido: Record<string, unknown> | null = null;

  const personasDe = async (filtro: { compania_id?: string | null; cuerpo_id?: string | null }, excluir?: string | null) => {
    let q = supabase.from("personal").select("id, notificaciones_preferencias(pizarra, actividades, cuotas)").neq("estado", "dado_de_baja");
    if (filtro.compania_id) q = q.eq("compania_id", filtro.compania_id);
    else if (filtro.cuerpo_id) q = q.eq("cuerpo_id", filtro.cuerpo_id).not("compania_id", "is", null);
    const { data } = await q;
    return ((data || []) as { id: string; notificaciones_preferencias?: unknown }[]).filter((p) => p.id !== excluir);
  };

  type FilaPref = { id: string; notificaciones_preferencias?: unknown };
  const quienesQuieren = (lista: FilaPref[], clave: "pizarra" | "actividades" | "cuotas") =>
    lista.filter((p) => {
      const raw = p.notificaciones_preferencias;
      const pref = (Array.isArray(raw) ? raw[0] : raw) as Record<string, boolean | null> | null | undefined;
      return !(pref && pref[clave] === false);
    }).map((p) => p.id);

  if (tipo === "pizarra") {
    const { data: o } = await supabase.from("pizarra_observaciones")
      .select("id, compania_id, cuerpo_id, es_general, tipo, titulo, contenido, autor_id, creado_en, expira_en").eq("id", id).maybeSingle();
    if (!o || !reciente(o.creado_en)) return new Response(JSON.stringify({ enviados: 0, motivo: "no_valido_o_expirado" }), json);
    preferencia = "pizarra";
    const general = !o.compania_id || o.es_general;
    destinatarios = quienesQuieren(await personasDe(general ? { cuerpo_id: o.cuerpo_id } : { compania_id: o.compania_id }, o.autor_id), "pizarra");
    contenido = {
      tipo: "pizarra",
      titulo: general ? "AVISO GENERAL — Pizarra" : "PIZARRA — Aviso nuevo",
      cuerpo: recorta(o.titulo ? `${o.titulo}: ${o.contenido}` : o.contenido, 160) || "Hay un aviso nuevo en la pizarra.",
      tag: `pizarra-${id}`, url: "pizarra_celular.html",
    };
  } else if (tipo === "actividad") {
    const { data: a } = await supabase.from("actividades")
      .select("id, compania_id, cuerpo_id, nombre, fecha, hora, lugar, creado_por, creado_en").eq("id", id).maybeSingle();
    if (!a || !reciente(a.creado_en)) return new Response(JSON.stringify({ enviados: 0, motivo: "no_valido_o_expirado" }), json);
    preferencia = "actividades";
    destinatarios = quienesQuieren(await personasDe(a.compania_id ? { compania_id: a.compania_id } : { cuerpo_id: a.cuerpo_id }, a.creado_por), "actividades");
    const cuando = [fechaCorta(a.fecha), a.hora ? String(a.hora).slice(0, 5) : ""].filter(Boolean).join(" · ");
    contenido = {
      tipo: "actividad",
      titulo: "NUEVA ACTIVIDAD",
      cuerpo: recorta([a.nombre, cuando, a.lugar].filter(Boolean).join(" — "), 160) || "Hay una actividad nueva.",
      tag: `actividad-${id}`, url: "actividades_celular.html",
    };
  } else if (tipo === "cuota") {
    const { data: av } = await supabase.from("tesoreria_avisos").select("id, personal_id, creado_en, vence_en").eq("id", id).maybeSingle();
    if (!av || !reciente(av.creado_en)) return new Response(JSON.stringify({ enviados: 0, motivo: "no_valido_o_expirado" }), json);
    preferencia = "cuotas";
    const { data: filas } = await supabase.from("personal").select("id, notificaciones_preferencias(pizarra, actividades, cuotas)").eq("id", av.personal_id).neq("estado", "dado_de_baja");
    destinatarios = quienesQuieren((filas || []) as FilaPref[], "cuotas");
    const { data: deuda } = await supabase.rpc("tes_adeudados", { p_personal: av.personal_id });
    const meses = (deuda || []) as { t_periodo: string; t_monto: number }[];
    if (!meses.length) return new Response(JSON.stringify({ enviados: 0, motivo: "sin_deuda" }), json);
    const total = meses.reduce((s, m) => s + Number(m.t_monto), 0);
    contenido = {
      tipo: "cuota",
      titulo: meses.length === 1 ? "CUOTA PENDIENTE" : "CUOTAS PENDIENTES",
      cuerpo: `Tienes ${meses.length} ${meses.length === 1 ? "cuota atrasada" : "cuotas atrasadas"} por un total de $${total.toLocaleString("es-CL")}.`,
      tag: `cuota-${id}`, url: "inicio_celular.html",
    };
  } else {
    return new Response("tipo desconocido", { status: 400 });
  }

  if (!contenido || destinatarios.length === 0) return new Response(JSON.stringify({ enviados: 0, preferencia }), json);

  const { data: subs } = await supabase.from("push_subscripciones").select("id, endpoint, p256dh, auth").in("personal_id", destinatarios);
  let enviados = 0;
  for (const sub of (subs || []) as Suscripcion[]) {
    try {
      const status = await enviarPush(sub, contenido, "normal");
      if (status === 404 || status === 410) await supabase.from("push_subscripciones").delete().eq("id", sub.id);
      else if (status >= 200 && status < 300) enviados++;
    } catch { /* una suscripción individual fallando no debe frenar el resto */ }
  }
  return new Response(JSON.stringify({ enviados, destinatarios: destinatarios.length }), json);
});
