module.exports = {
  root: true,
  env: {
    browser: true,
    es2021: true
  },
  ignorePatterns: ['dist', 'node_modules'],
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-hooks/recommended'
  ],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true
    }
  },
  settings: {
    react: {
      version: '18.2'
    }
  },
  rules: {
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }]
  },
  overrides: [
    {
      files: ['*.cjs'],
      env: { node: true },
      parserOptions: { sourceType: 'script' }
    },
    {
      // Service worker живёт в своём глобальном окружении: там нет window, зато есть self,
      // clients и skipWaiting, которых браузерный env не знает.
      files: ['src/app/pwa/sw.ts'],
      env: { browser: false, serviceworker: true }
    }
  ]
};
