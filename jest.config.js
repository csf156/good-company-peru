module.exports = {
  preset: 'jest-expo',
  // Sin `<rootDir>` aquí a propósito: cuando rootDir cae bajo un segmento con
  // punto (p.ej. un worktree en .claude/worktrees/...), la sustitución de
  // `<rootDir>` de Jest deja una barra invertida pegada al segmento con punto
  // y el glob (evaluado con micromatch, sensible a `\` como escape) no matchea
  // nada. Un patrón relativo sin el token evita la sustitución rota.
  testMatch: ['**/tests/**/*.test.ts?(x)'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  setupFiles: ['<rootDir>/tests/jest.setup.js'],
  testTimeout: 15000,
};
