const expoConfig = require('eslint-config-expo/flat');
const prettierConfig = require('eslint-config-prettier');

module.exports = [
  ...expoConfig,
  prettierConfig,
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
    ],
  },
];
