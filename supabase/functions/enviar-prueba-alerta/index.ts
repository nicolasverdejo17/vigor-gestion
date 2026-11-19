import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// «Probar alerta»: manda una notificación de prueba SOLO a los equipos de quien la pide (verificada por su sesión),
// con la misma vía y prioridad que un despacho real.

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

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const json = { headers: { ...CORS, "Content-Type": "application/json" } };
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return new Response(JSON.stringify({ error: "vapid" }), { ...json, status: 500 });

  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return new Response(JSON.stringify({ error: "sin_sesion" }), { ...json, status: 401 });

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: u } = await supabase.auth.getUser(token);
  if (!u?.user) return new Response(JSON.stringify({ error: "sin_sesion" }), { ...json, status: 401 });

  const { data: p } = await supabase.from("personal").select("id").eq("auth_user_id", u.user.id).maybeSingle();
  if (!p) return new Response(JSON.stringify({ error: "sin_persona" }), { ...json, status: 403 });

  const { data: subs } = await supabase.from("push_subscripciones").select("id, endpoint, p256dh, auth").eq("personal_id", (p as { id: string }).id);
  const contenido = {
    tipo: "prueba",
    titulo: "PRUEBA DE ALERTA — Vigor",
    cuerpo: "Si ves esto y suena o vibra, las alertas de despacho te van a llegar bien.",
    tag: `prueba-${Date.now()}`,
    url: "notificaciones_celular.html",
  };
  let enviados = 0;
  for (const sub of (subs || []) as Suscripcion[]) {
    try {
      const status = await enviarPush(sub, contenido);
      if (status === 404 || status === 410) await supabase.from("push_subscripciones").delete().eq("id", sub.id);
      else if (status >= 200 && status < 300) enviados++;
    } catch { /* se sigue con el resto */ }
  }
  return new Response(JSON.stringify({ enviados, equipos: (subs || []).length }), json);
});
