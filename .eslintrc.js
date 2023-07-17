/* eslint-env node */
module.exports = {
  root: true,
  plugins: [
    'node',
    'promise',
    'import',
  ],
  extends: [
    'airbnb-base',
    'airbnb-typescript/base',
  ],
  parserOptions: {
    tsconfigRootDir: __dirname,
    project: ['./tsconfig.json'],
  },
  rules: {
    'max-len': [
      'error',
      {
        code: 140,
      },
    ],
    indent: [
      'error',
      2,
    ],
    semi: [
      'error',
      'never',
    ],
    '@typescript-eslint/semi': [
      'error',
      'never',
    ],
    quotes: [
      'error',
      'single',
    ],
    'comma-dangle': [
      'error',
      'always-multiline',
    ],
    'object-curly-spacing': [
      'error',
      'always',
    ],
    'arrow-parens': [
      'error',
      'always',
    ],
    'linebreak-style': [
      'error',
      'unix',
    ],
    'operator-linebreak': [
      'error',
      'before',
    ],
    'no-underscore-dangle': [
      'error',
      {
        allow: [
          '_id',
          '_',
        ],
      },
    ],
    radix: [
      'error',
      'as-needed',
    ],
    'no-debugger': 'error',
    'no-console': 'error',
    'no-new': 'off',
    'no-continue': 'off',
    'no-await-in-loop': 'off',
    'no-unused-vars': 'warn',
    'prefer-destructuring': 'off',
    'no-restricted-syntax': 'warn',
    'class-methods-use-this': 'off',
    'ts-nocheck': 'off',
    'no-param-reassign': 'off',
    'import/no-extraneous-dependencies': 'off',
    'import/no-dynamic-require': 'off',
    'import/no-cycle': 'error',
    'import/prefer-default-export': 'off',
    'max-classes-per-file': 'off',
    '@typescript-eslint/lines-between-class-members': 'off',
  },
}
