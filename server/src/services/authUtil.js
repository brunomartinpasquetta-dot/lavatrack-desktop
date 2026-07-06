// Utilidades de criptografía para la auth: hashing de contraseñas (scrypt) y
// tokens firmados tipo JWT (HMAC-SHA256, base64url) con secreto persistente.
// Sin librerías nuevas: sólo node:crypto. Los parámetros scrypt son CANÓNICOS
// y DEBEN coincidir con los que usa el seed (si no, nadie loguea).
import crypto from 'node:crypto';
import { leerConfig, escribirConfig } from '../config.js';

// --- Hashing de contraseñas (scrypt canónico) ---
// salt = 16 bytes hex (32 chars); hash = scryptSync(password, salt, 64) hex (128 chars).
export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return { hash, salt };
}

// Verifica una contraseña contra hash+salt guardados. Comparación en tiempo
// constante (timingSafeEqual); si los largos no coinciden devuelve false sin tirar.
export function verifyPassword(password, hash, salt) {
  if (typeof hash !== 'string' || typeof salt !== 'string') return false;
  let guardado;
  try {
    guardado = Buffer.from(hash, 'hex');
  } catch {
    return false;
  }
  const intento = crypto.scryptSync(String(password), salt, 64);
  if (intento.length !== guardado.length) return false;
  return crypto.timingSafeEqual(intento, guardado);
}

// --- Secreto para firmar tokens ---
// Se lee de la config persistente (fuera del repo). Si no existe, se genera uno
// fuerte y se persiste. NUNCA queda en el código ni en el repositorio.
export function getSecret() {
  const config = leerConfig();
  if (config && typeof config.jwt_secret === 'string' && config.jwt_secret.length >= 32) {
    return config.jwt_secret;
  }
  const jwt_secret = crypto.randomBytes(48).toString('hex');
  escribirConfig({ jwt_secret });
  return jwt_secret;
}

// --- Tokens firmados (formato compacto tipo JWT: header.payload.firma) ---
const b64url = (buf) => Buffer.from(buf).toString('base64url');
const b64urlJson = (obj) => b64url(JSON.stringify(obj));

// Duración del token: ~12 horas.
const DURACION_SEGUNDOS = 12 * 60 * 60;

function firmar(headerYPayload) {
  return crypto.createHmac('sha256', getSecret()).update(headerYPayload).digest('base64url');
}

// Firma un payload y devuelve 'header.payload.firma'. Agrega iat y exp.
export function signToken(payload) {
  const ahora = Math.floor(Date.now() / 1000);
  const cuerpo = { ...payload, iat: ahora, exp: ahora + DURACION_SEGUNDOS };
  const header = b64urlJson({ alg: 'HS256', typ: 'JWT' });
  const body = b64urlJson(cuerpo);
  const firma = firmar(`${header}.${body}`);
  return `${header}.${body}.${firma}`;
}

// Verifica firma y expiración. Devuelve el payload o null si el token es inválido.
export function verifyToken(token) {
  if (typeof token !== 'string') return null;
  const partes = token.split('.');
  if (partes.length !== 3) return null;
  const [header, body, firma] = partes;

  // Firma esperada vs recibida, comparación en tiempo constante.
  const esperada = firmar(`${header}.${body}`);
  const a = Buffer.from(firma);
  const b = Buffer.from(esperada);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  let payload;
  try {
    payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  const ahora = Math.floor(Date.now() / 1000);
  if (typeof payload.exp !== 'number' || payload.exp < ahora) return null;
  return payload;
}
