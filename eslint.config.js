// @ts-check
/*

eslint.config.js

How to install:
  npm install --save-dev eslint @eslint/js typescript typescript-eslint

  or to use the latest version of eslint:

  npm install --save-dev --force eslint @eslint/js typescript typescript-eslint

Add package.json scripts:
  "lint": "eslint --max-warnings=0",
  "lint:fix": "eslint --fix",

Add to .vscode/settings.json:
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit"
  },
  "eslint.experimental.useFlatConfig": true

*/
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.strict,
  ...tseslint.configs.stylistic,
  {
    name: 'global ignores',
    ignores: ['dist/', 'build/', 'node_modules/'],
  },
  {
    name: 'javascript',
    files: ['**/*.js', '**/*.cjs', '**/*.mjs'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
    },
    rules: {
      'no-console': 'warn',
      'no-undef': 'off',
    }
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
      "indent": ["error", 2, { "SwitchCase": 1 }],
      "max-len": ["warn", 180],
      "no-console": ["warn"],
      "quotes": ["error", "single", { "avoidEscape": true, "allowTemplateLiterals": false }],
      "comma-spacing": ["error", { "before": false, "after": true }],
      "space-before-function-paren": ["error", { "anonymous": "always", "named": "never", "asyncArrow": "always" }],
      "keyword-spacing": ["error", { "before": true, "after": true }],
      "no-multi-spaces": "error",
      "object-curly-spacing": ["error", "always"],
      "@typescript-eslint/type-annotation-spacing": ["error", {
        "before": false,
        "after": true,
        "overrides": {
          "arrow": {
            "before": true,
            "after": true
          }
        }
      }]
    },
  },
  {
    name: 'jest tests',
    files: ['**/*.test.ts', '**/*.spec.ts'],
    plugins: {
      '@typescript-eslint': tseslint.plugin,
    },
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parser: tseslint.parser,
      parserOptions: {
        project: false,
      },
    },
  }
);
