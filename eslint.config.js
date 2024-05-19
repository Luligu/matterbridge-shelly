// @ts-check
/*

eslint.config.js

How to install:
  npm install --save-dev eslint @eslint/js typescript typescript-eslint eslint-plugin-jest
  eslint --max-warnings=0 --debug --ignore-pattern dist/ --ignore-pattern build/ .

  or to use the latest version of eslint:

  npm install --save-dev --force eslint @eslint/js typescript typescript-eslint eslint-plugin-jest
  eslint --max-warnings=0 --debug
  
Add package.json scripts:
  "lint": "eslint --max-warnings=0",
  "lint:fix": "eslint --fix",

Add to .vscode/settings.json:
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit"
  },
  "eslint.experimental.useFlatConfig": true

Prettier:

How to install:
  npm install --save-dev prettier eslint-config-prettier eslint-plugin-prettier


*/
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import jesteslint from 'eslint-plugin-jest';
import eslintConfigPrettier from 'eslint-config-prettier';
import eslintPluginPrettier from 'eslint-plugin-prettier/recommended';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.strict,
  ...tseslint.configs.stylistic,
  eslintConfigPrettier,
  eslintPluginPrettier,
  {
    name: 'global ignores',
    ignores: ['dist/', 'build/', 'node_modules/'],
  },
  {
    name: 'javascript',
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
    },
    rules: {
      'no-console': 'warn',
      'no-undef': 'off',
      'max-len': ['warn', 180],
      'quotes': ['error', 'single', { avoidEscape: true, allowTemplateLiterals: false }],
      'spaced-comment': ['error', 'always', { block: { balanced: true } }],
      'comma-spacing': ['error', { before: false, after: true }],
      'space-before-function-paren': ['error', { anonymous: 'always', named: 'never', asyncArrow: 'always' }],
      'keyword-spacing': ['error', { before: true, after: true }],
      'no-multi-spaces': 'error',
      'object-curly-spacing': ['error', 'always'],
    },
  },
  {
    name: 'typescript',
    files: ['**/*.ts'],
    plugins: {
      '@typescript-eslint': tseslint.plugin,
    },
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parser: tseslint.parser,
      parserOptions: {
        project: true,
      },
    },
    rules: {
      '@typescript-eslint/type-annotation-spacing': [
        'error',
        {
          before: false,
          after: true,
          overrides: {
            arrow: {
              before: true,
              after: true,
            },
          },
        },
      ],
    },
  },
  {
    name: 'jest tests',
    files: ['**/__test__/*', '**/*.test.ts', '**/*.spec.ts'],
    plugins: {
      '@typescript-eslint': tseslint.plugin,
      jest: jesteslint,
    },
    ...jesteslint.configs['flat/recommended'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parser: tseslint.parser,
      parserOptions: {
        project: false,
      },
    },
  },
);
