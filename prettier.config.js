// @ts-check
/*

prettier.config.js

Prettier:

How to install:
  npm install --save-dev prettier eslint-config-prettier eslint-plugin-prettier

  
Add package.json scripts:  
*/
// "format": "prettier --write \"src/**/*.{js,jsx,ts,tsx,json,css,md}\"",
// "format:check": "prettier --check \"src/**/*.{js,jsx,ts,tsx,json,css,md}\"",

/* 

Add .prettierignore  

# Ignore artifacts:
dist
node_modules
build
coverage

# Ignore all HTML files:
*/
// **/*.html

export default {
  printWidth: 180, // default 80
  tabWidth: 2, // default 2
  useTabs: false, // default false
  semi: true, // default true
  singleQuote: true, // default false
  quoteProps: 'preserve', // default 'as-needed'
  jsxSingleQuote: false, // default false
  trailingComma: 'all', // default 'all'
  bracketSpacing: true, // default true
  bracketSameLine: false, // default false
  arrowParens: 'always', // default 'always'
  requirePragma: false, // default false
  insertPragma: false, // default false
  proseWrap: 'preserve', // default 'preserve'
  endOfLine: 'lf', // default 'lf'
  embeddedLanguageFormatting: 'off', // default 'auto'
  singleAttributePerLine: false, // default false
};
