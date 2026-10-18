import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'target', 'src-tauri', 'coverage', 'playwright-report', 'test-results', '.scratch', 'node_modules'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: { ecmaVersion: 2023, globals: { ...globals.browser, ...globals.node } },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': 'error',
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@tauri-apps/*'],
              message: 'Import Tauri APIs only through src/services/platform (keeps the UI testable in a browser).',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/services/platform/**', 'src/main.tsx'],
    rules: { 'no-restricted-imports': 'off' },
  },
  {
    files: ['src/domain/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['react', 'react-dom', '@tauri-apps/*', '@/features/*', '@/design-system/*', '@/services/*'], message: 'Domain logic must stay framework-free.' },
          ],
        },
      ],
    },
  },
);
