// Runner de tests pgTAP contra una base Postgres/Supabase, sin Docker ni psql.
//
// Uso:
//   DATABASE_URL="postgresql://postgres:<pwd>@<host>:5432/postgres" \
//     node tests/db/run-pgtap.mjs
//
// Cada archivo .sql de supabase/tests/ se ejecuta en su propia transacción
// (BEGIN … ROLLBACK) para no dejar datos de prueba en la base. El runner
// recolecta la salida TAP de las funciones pgTAP y falla si hay algún "not ok"
// o si el plan declarado (`select plan(N)`) no coincide con lo realmente
// ejecutado — pgTAP emite ese desajuste como comentario, no como "not ok",
// así que sin este chequeo un archivo puede perder aserciones y seguir en
// verde (hallazgo de la sesión BRAIN, 2026-09-10, sobre `15_invitaciones_rls.sql`).

import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TESTS_DIR = path.resolve(__dirname, '../../supabase/tests');

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('ERROR: falta la variable de entorno DATABASE_URL.');
  process.exit(2);
}

const TAP_LINE = /^(ok |not ok |\d+\.\.\d+)/;

function extractTapLines(results) {
  const arr = Array.isArray(results) ? results : [results];
  const lines = [];
  for (const res of arr) {
    for (const row of res?.rows ?? []) {
      const value = Object.values(row)[0];
      if (typeof value !== 'string') continue;
      for (const line of value.split('\n')) {
        if (TAP_LINE.test(line.trim())) lines.push(line.trim());
      }
    }
  }
  return lines;
}

async function main() {
  const client = new pg.Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  // pgTAP es dependencia de test, no del esquema de producción.
  await client.query('create extension if not exists pgtap');

  const files = (await readdir(TESTS_DIR)).filter((f) => f.endsWith('.sql')).sort();

  let failures = 0;
  let assertions = 0;

  for (const file of files) {
    const sql = await readFile(path.join(TESTS_DIR, file), 'utf8');
    let lines = [];
    try {
      await client.query('begin');
      const results = await client.query(sql);
      lines = extractTapLines(results);
      await client.query('rollback');
    } catch (err) {
      await client.query('rollback').catch(() => {});
      console.error(`\n✗ ${file} — error ejecutando el archivo:`);
      console.error(`  ${err.message}`);
      failures += 1;
      continue;
    }

    const fileFailures = lines.filter((l) => l.startsWith('not ok'));
    const fileOks = lines.filter((l) => l.startsWith('ok '));
    const ran = fileOks.length + fileFailures.length;
    assertions += ran;

    // Línea de plan `1..N` — pgTAP puede emitirla al principio o al final del
    // bloque TAP según cómo aborte/termine el archivo; no asumir posición.
    const planLine = lines.find((l) => /^\d+\.\.\d+$/.test(l));
    const planned = planLine ? Number(planLine.split('..')[1]) : null;
    const planMismatch = planned !== null && planned !== ran;

    if (fileFailures.length > 0 || planMismatch) {
      failures += fileFailures.length > 0 ? fileFailures.length : 1;
      if (fileFailures.length > 0) {
        console.error(`\n✗ ${file} — ${fileFailures.length} fallo(s):`);
      }
      if (planMismatch) {
        console.error(`\n✗ ${file} — el plan declaró ${planned} test(s) pero corrieron ${ran}:`);
      }
      for (const l of lines) console.error(`  ${l}`);
    } else {
      console.log(`✓ ${file} — ${fileOks.length} assertion(s) ok`);
    }
  }

  await client.end();

  console.log(`\n${assertions} assertions, ${failures} fallo(s).`);
  process.exit(failures > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
