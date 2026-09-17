import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

const ROOTS = ['app', 'components', 'lib', 'public'];
const EXTENSIONS = ['.ts', '.tsx', '.html'];

// lib/tos.ts usa "saldo", "monedero" y "billeteras" A PROPÓSITO: la cláusula
// 13 del ToS define legalmente que el dinero de la app NO constituye "un
// saldo disponible, un monedero ni un crédito de uso general", y la sección
// de anti-fuga prohíbe compartir "billeteras digitales" externas en el chat.
// Nombrar esas palabras ahí es justo lo que le da fuerza legal a la cláusula
// (decir qué NO es requiere decir la palabra). Si este test falla en
// lib/tos.ts, la solución NO es editar el ToS — es dejar esta exclusión
// como está. Ver docs/2026-07-01-modelo-negocio-design.md y CLAUDE.md.
const EXCLUDED = new Set([join('lib', 'tos.ts')]);

// Vocabulario vetado: la app es custodia orquestada sobre Red Pontis, no una
// billetera/wallet de propósito general — eso es requisito de licenciamiento
// (ver CLAUDE.md § Decisiones cerradas). "saldo/billetera/monedero/wallet"
// sin distinguir mayúsculas, igual que ya se venía verificando puntualmente
// en tests/app/invitar.test.tsx.
const VOCABULARIO_VETADO = /saldo|billetera|monedero|wallet/i;

// Formato de precio viejo ("15 V" en vez de "S/ 15.00"). Número + espacio +
// "V" suelta (mayúscula, como se veía en el bug real: `{cita.valorV} V`).
// Sensible a mayúsculas a propósito: identificadores como `valorV` (sin
// espacio antes de la V) y palabras en español con "v" minúscula seguida de
// letras (p.ej. "20 vasos") no deben poder disparar un falso positivo.
const FORMATO_PRECIO_VIEJO = /\d+ V\b/;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return EXTENSIONS.some((ext) => full.endsWith(ext)) ? [full] : [];
  });
}

function matchVetado(text: string): string | null {
  return text.match(VOCABULARIO_VETADO)?.[0] ?? text.match(FORMATO_PRECIO_VIEJO)?.[0] ?? null;
}

/**
 * Regresión: el veto de vocabulario ("saldo/billetera/monedero/wallet" y el
 * formato de precio "N V") es un requisito de licenciamiento, no de estilo.
 * Dos tareas de la fase E.4 barrieron las últimas apariciones conocidas
 * (app/chats/[id].tsx, public/privacidad.html, lib/profile.ts) a mano; este
 * test existe para que no dependa de que alguien se acuerde la próxima vez.
 */
describe('vocabulario vetado', () => {
  it('no reaparece saldo/billetera/monedero/wallet ni el formato de precio "N V"', () => {
    const offenders = ROOTS.flatMap(sourceFiles)
      .filter((file) => !EXCLUDED.has(file))
      .flatMap((file) =>
        readFileSync(file, 'utf8')
          .split('\n')
          .map((text, i) => ({ file, line: i + 1, text: text.trim() }))
          .map(({ file, line, text }) => ({ file, line, text, match: matchVetado(text) }))
          .filter(({ match }) => match !== null),
      );

    expect(offenders.map((o) => `${o.file}:${o.line}  [${o.match}]  ${o.text}`)).toEqual([]);
  });
});
