// eslint.config.js
/*

How to install:
  npm install eslint @stylistic/eslint-plugin @stylistic/eslint-plugin @typescript-eslint/eslint-plugin --save-dev --force

Add package.json scripts:
  "lint": "eslint --max-warnings=0 --debug",
  "lint:fix": "eslint --fix --debug",

Add to .vscode/settings.json:
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit"
  },
  "eslint.experimental.useFlatConfig": true

*/

import stylistic from '@stylistic/eslint-plugin';
import typescriptEslint from '@typescript-eslint/eslint-plugin'
import typescriptParser from '@typescript-eslint/parser';

// Import recommended configurations
const stylisticRecommended = stylistic.configs['recommended-flat'];
const typescriptEslintRecommended = typescriptEslint.configs['eslint-recommended'];
const typescriptRecommended = typescriptEslint.configs['recommended'];

export default [
  {
    name: 'global ignores',
    ignores: ['dist/', 'build/', 'node_modules/'],
  },
  {
    files: ['**/*.js', '**/*.jsx', '**/*.ts', '**/*.tsx'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parser: typescriptParser,
    },
    plugins: {
      '@stylistic': stylistic,
      '@typescript-eslint': typescriptEslint,
    },
    rules: {
      ...stylisticRecommended.rules,
      ...typescriptEslintRecommended.rules,
      ...typescriptRecommended.rules,
      'no-console': ['warn'],
      '@stylistic/semi': 'off',
      '@stylistic/indent': ['error', 2, { SwitchCase: 1 }],
      '@stylistic/indent-binary-ops': 'off',
      '@stylistic/max-len': ['warn', 180],
      '@stylistic/quotes': ['error', 'single', { avoidEscape: true, allowTemplateLiterals: false }],
      '@stylistic/comma-spacing': ['error', { before: false, after: true }],
      '@stylistic/space-before-function-paren': ['error', { anonymous: 'always', named: 'never', asyncArrow: 'always' }],
      '@stylistic/keyword-spacing': ['error', { before: true, after: true }],
      '@stylistic/no-multi-spaces': 'error',
      '@stylistic/object-curly-spacing': ['error', 'always'],
      '@stylistic/no-trailing-spaces': ['error'],
      '@stylistic/member-delimiter-style': ['error', { multiline: { delimiter: 'comma', requireLast: false }, singleline: { delimiter: 'comma', requireLast: false } }],
      '@stylistic/spaced-comment': ['error', 'always', {
        line: {
          markers: ['/'], // Allow comments starting with '///'
          exceptions: ['-', '+'], // Allow comments starting with '//-' or '//+'
        },
        block: {
          markers: ['!'], // Allow comments starting with '/*!'
          exceptions: ['*'], // Allow comments starting with '/* *'
          balanced: true,
        },
      }],
    },
  },
];
