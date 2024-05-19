// eslint.config.mjs

import eslintRecommended from 'eslint/conf/eslint-recommended';
// import tsEslintRecommended from '@typescript-eslint/eslint-plugin';
// import stylistic from '@stylistic/eslint-plugin';
// import prettier from 'eslint-plugin-prettier';

export default [
  eslintRecommended,
  // tsEslintRecommended,
  // stylistic,
  // prettier,
  {
    ignores: ['dist/', 'node_modules/'],
    xxxplugins: {
      '@typescript-eslint': tsEslintRecommended,
      '@stylistic': stylistic,
      'prettier': prettier,
    },
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
    },
    parser: '@typescript-eslint/parser',
    parserOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
    },
    environments: {
      browser: true,
      es2021: true,
      node: true,
    },
    rules: {
      'prettier/prettier': ['error'],
      'indent': ['error', 2, { SwitchCase: 1 }],
      'max-len': ['warn', 180],
      'no-console': ['warn'],
      'quotes': ['error', 'single', { avoidEscape: true, allowTemplateLiterals: false }],
      'comma-spacing': ['error', { before: false, after: true }],
      'space-before-function-paren': ['error', { anonymous: 'always', named: 'never', asyncArrow: 'always' }],
      'keyword-spacing': ['error', { before: true, after: true }],
      'no-multi-spaces': 'error',
      'object-curly-spacing': ['error', 'always'],
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
];
