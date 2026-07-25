// Cuando rootDir cae bajo un segmento con punto (p.ej. un worktree en
// .claude/worktrees/...), la sustitución de `<rootDir>` de Jest deja una
// barra invertida pegada al segmento con punto y el glob (evaluado con
// micromatch, sensible a `\` como escape) no matchea nada. En vez de usar el
// token roto, se calcula aquí mismo (JS plano) la ruta absoluta normalizada a
// forward-slashes — así testMatch queda anclado a ESTE checkout exacto y no
// recoge tests de otro worktree anidado bajo el mismo árbol (que también
// tiene un segmento .claude/worktrees/... en su ruta, pero con un __dirname
// distinto).
const rootDirPosix = __dirname.split(require('path').sep).join('/');

module.exports = {
  preset: 'jest-expo',
  testMatch: [`${rootDirPosix}/tests/**/*.test.ts?(x)`],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  setupFiles: ['<rootDir>/tests/jest.setup.js'],
  testTimeout: 15000,
};
