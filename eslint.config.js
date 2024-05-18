// eslint.config.js
/*

How to install:
  npm install eslint @stylistic/eslint-plugin

Add package.json scripts:
  "test": "node --experimental-vm-modules node_modules/jest/bin/jest.js",
  "test:verbose": "node --experimental-vm-modules node_modules/jest/bin/jest.js --verbose",
  "test:watch": "node --experimental-vm-modules node_modules/jest/bin/jest.js --watch",

Add to .vscode/settings.json:
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit"
  },
  "eslint.experimental.useFlatConfig": true

*/

import stylistic from '@stylistic/eslint-plugin';

export default [
  {
    name: 'global ignores',
    ignores: ['dist/', 'build/', 'node_modules/']
  },
  {
    ...stylistic.configs['recommended-flat'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
    },
    plugins: {
      '@stylistic': stylistic,
    },
    rules: {
      'no-console': ['warn'],
      '@stylistic/indent': ['error', 2, { 'SwitchCase': 1 }],
      '@stylistic/max-len': ['warn', 180],
      '@stylistic/quotes': ['error', 'single', { 'avoidEscape': true, 'allowTemplateLiterals': false }],
      '@stylistic/comma-spacing': ['error', { 'before': false, 'after': true }],
      '@stylistic/space-before-function-paren': ['error', { 'anonymous': 'always', 'named': 'never', 'asyncArrow': 'always' }],
      '@stylistic/keyword-spacing': ['error', { 'before': true, 'after': true }],
      '@stylistic/no-multi-spaces': 'error',
      '@stylistic/object-curly-spacing': ['error', 'always'],
      '@stylistic/no-trailing-spaces': ['error'],
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