import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/*.html',
      'temp_script.js',
      'temp_script_1.js',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // Node globals for scripts and any plain-JS tooling.
    files: ['scripts/**/*.{js,mjs}', '*.{js,mjs}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        process: 'readonly',
        console: 'readonly',
        URL: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        Buffer: 'readonly',
        fetch: 'readonly',
      },
    },
  },
  {
    /**
     * PAS-0101: "Application code must not independently create arbitrary
     * database connections."
     *
     * Stated in a README this is a convention people violate by accident under
     * deadline. As a lint rule it is mechanical: the only way to reach the
     * database is through `@pas/database`, which owns pooling, the per-connection
     * statement timeout, transaction nesting and error mapping. A hand-rolled
     * `new Client()` has none of those and leaks a pool slot on the first early
     * return.
     */
    files: ['**/*.{ts,tsx}'],
    ignores: ['packages/database/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'pg',
              message:
                'Import from @pas/database instead. PAS-0101 centralises pooling, ' +
                'transactions, instrumentation and health; a direct pg client bypasses all four.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: 'module',
    },
    rules: {
      // Both rules below are set to 'warn', not 'off'. Every finding is printed
      // on every lint run. Neither is silenced.
      //
      // no-unused-vars: the preserved frontend's own tsconfig.base.json sets
      //   "noUnusedLocals": false and "noUnusedParameters": false — a deliberate
      //   project policy present at baseline f23d11a. A linter that ERRORS on
      //   exactly what the compiler config permits is inconsistent with the
      //   project, not with the code. 19 findings across 10 files, all dead
      //   imports and unused destructured values. They are removed by the
      //   tickets that rewrite those files (Builds 17, 23, 24, 26, 27), not by
      //   PAS-0001, which is structural only.
      //
      // no-explicit-any: `any` appears in AuthorityObject.metadata and in mock
      //   service returns. Removed when those services are replaced (Build 17).
      '@typescript-eslint/no-unused-vars': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn',
      //
      // `no-undef` is off for TypeScript on typescript-eslint's own
      // recommendation: the compiler resolves identifiers against real type
      // information, while ESLint only guesses from a globals list. Leaving it
      // on means maintaining a duplicate, less accurate copy of the Node and
      // DOM lib definitions, and it reports false positives on every type-only
      // global. `npm run typecheck` is the check that actually catches this.
      'no-undef': 'off',
    },
  },
);
