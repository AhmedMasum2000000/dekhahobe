import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'scripts'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: { ecmaVersion: 2020, globals: globals.browser },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      '@typescript-eslint/no-explicit-any': 'off',
      // `useEffect(() => fn())` returns fn's result, and React calls a returned value as the
      // cleanup. Hosts that wrap scrollTo/focus to return a value crashed every page change.
      'no-restricted-syntax': [
        'error',
        {
          selector: 'CallExpression[callee.name=/^use(Layout|Insertion)?Effect$/] > ArrowFunctionExpression[expression=true]',
          message: 'Effect callbacks must use a block body so they never return a value.',
        },
      ],
    },
  },
);
