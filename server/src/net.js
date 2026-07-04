// Utilidades de red: detección de IPs de la LAN para armar las URLs de acceso
// de las terminales (http://IP-LAN:puerto). Lo usan el server y el shell Electron.
import { networkInterfaces } from 'node:os';

// Devuelve todas las IPv4 no internas (una por cada interfaz activa).
export function ipsLan() {
  const nets = networkInterfaces();
  const ips = [];
  for (const nombre of Object.keys(nets)) {
    for (const net of nets[nombre] || []) {
      // family puede ser 'IPv4' (string) o 4 (número) según versión de Node.
      const esV4 = net.family === 'IPv4' || net.family === 4;
      if (esV4 && !net.internal) {
        ips.push({ interfaz: nombre, ip: net.address });
      }
    }
  }
  return ips;
}

// URL principal de acceso para terminales (primera IP LAN, o localhost si no hay).
export function urlAcceso(puerto) {
  const ips = ipsLan();
  const ip = ips.length ? ips[0].ip : 'localhost';
  return `http://${ip}:${puerto}`;
}
