import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

const ROOTS = ['app', 'components'];
const COLOR_LITERAL = /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(/;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return full.endsWith('.ts') || full.endsWith('.tsx') ? [full] : [];
  });
}

/**
 * El design system solo se sostiene si el CI lo verifica. Esta fase existió
 * porque la deriva se acumuló en silencio durante cuatro sub-proyectos: el doc
 * decía una cosa y las pantallas hacían otra, y nada lo detectaba.
 *
 * Si necesitas un color que no está en `lib/theme.ts`, el arreglo es agregar el
 * token, no la excepción.
 */
describe('guardia del design system', () => {
  it('ninguna pantalla ni componente hardcodea un color', () => {
    const offenders = ROOTS.flatMap(sourceFiles).flatMap((file) =>
      readFileSync(file, 'utf8')
        .split('\n')
        .map((line, i) => ({ file, line: i + 1, text: line.trim() }))
        .filter(({ text }) => COLOR_LITERAL.test(text)),
    );

    expect(offenders.map((o) => `${o.file}:${o.line}  ${o.text}`)).toEqual([]);
  });
});
