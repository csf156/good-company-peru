const expoConfig = require('eslint-config-expo/flat');
const prettierConfig = require('eslint-config-prettier');

module.exports = [
  ...expoConfig,
  prettierConfig,
  {
    // Setup de Jest (setupFiles): usa el global `jest` fuera de un archivo .test.
    files: ['tests/jest.setup.js'],
    languageOptions: {
      globals: { jest: 'readonly', require: 'readonly', module: 'writable' },
    },
  },
  {
    // jest.config.js calcula su propio testMatch en JS plano (ver comentario
    // del archivo) para evitar la sustitución rota de <rootDir> de Jest.
    files: ['jest.config.js'],
    languageOptions: {
      globals: { __dirname: 'readonly', require: 'readonly', module: 'writable' },
    },
  },
  {
    // scripts/*.mjs corren en Node plano (siembra de demo), no en el runtime
    // RN — mismo trato que tests/db/*.mjs, que ya vive fuera del bundle de la
    // app; solo hace falta declarar `Buffer` (expo-config no lo trae).
    files: ['scripts/*.mjs'],
    languageOptions: {
      globals: { Buffer: 'readonly' },
    },
  },
  {
    ignores: [
      'dist/*',
      'node_modules/*',
      // Worktrees anidados de Claude Code: contienen copias de todo el repo
      // (incluidas las Edge Functions Deno), y `eslint .` las recorre. El glob
      // de abajo solo cubre supabase/functions en la raíz, no bajo el worktree.
      '.claude/*',
      '.expo/*',
      '.ds-sync/*',
      'ds-bundle/*',
      // Deno runtime (Supabase Edge Functions) — different globals/imports
      // (Deno.*, esm.sh URL specifiers) than the RN app. _shared/kyc.ts is
      // deliberately isomorphic and IS linted/typechecked normally.
      'supabase/functions/kyc-start/*',
      'supabase/functions/kyc-webhook/*',
      'supabase/functions/comprar-bebida/*',
      'supabase/functions/crear-invitacion/*',
      'supabase/functions/responder-invitacion/*',
      'supabase/functions/pago-webhook/*',
      'supabase/functions/confirmar-cita/*',
    ],
  },
];
