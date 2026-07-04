// Helper de transacciones para escrituras multi-tabla.
// Usa BEGIN IMMEDIATE: toma el lock de escritura al instante, así el correlativo
// (SELECT max + INSERT) es atómico y dos terminales no pueden duplicar número.
// Es re-entrante: si ya hay una transacción abierta, la operación se une a ella
// (evita el error "cannot start a transaction within a transaction").
import { getDb } from './connection.js';

let profundidad = 0;

export function enTransaccion(fn) {
  const db = getDb();
  if (profundidad > 0) {
    // Ya estamos dentro de una transacción: ejecutar sin abrir otra.
    return fn(db);
  }
  db.exec('BEGIN IMMEDIATE');
  profundidad = 1;
  try {
    const resultado = fn(db);
    db.exec('COMMIT');
    return resultado;
  } catch (e) {
    try { db.exec('ROLLBACK'); } catch { /* ya sin transacción */ }
    throw e;
  } finally {
    profundidad = 0;
  }
}
