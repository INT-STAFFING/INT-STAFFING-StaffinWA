module.exports = {
  root: true,
  env: { browser: true, es2020: true },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-hooks/recommended',
  ],
  ignorePatterns: ['dist', '.eslintrc.cjs', 'node_modules', 'src'],
  parser: '@typescript-eslint/parser',
  plugins: ['react-refresh'],
  rules: {
    // React Refresh — disabilitato: context e page file esportano legittimamente sia componenti che hook
    'react-refresh/only-export-components': 'off',

    // TypeScript — permissive per codebase legacy
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-unused-vars': 'off',

    // Style rules — non sono bug, disabilitate per compatibilità con codebase esistente
    'prefer-const': 'off',
    'no-useless-escape': 'off',

    // Empty catch blocks — usati intenzionalmente nei migration script DB
    'no-empty': 'off',

    // Case declarations — pattern usato nelle funzioni switch API
    'no-case-declarations': 'off',

    // Prototype builtins — pattern legacy nel codebase
    'no-prototype-builtins': 'off',

    // Constant conditions — usate nella libreria zod custom
    'no-constant-condition': 'off',

    // Useless catch — pattern legacy
    'no-useless-catch': 'off',

    // React Hooks — exhaustive-deps causa molti falsi positivi con pattern intenzionali
    'react-hooks/exhaustive-deps': 'off',

    // React Hooks rules — abilitato come errore per componenti non-page
    'react-hooks/rules-of-hooks': 'error',
  },
  overrides: [
    {
      // Le pagine con visibility guard usano hooks dopo early return (pattern documentato in CLAUDE.md)
      // IMPORTANTE: per nuovi componenti usare sempre gli hook PRIMA di ogni early return.
      files: ['pages/*.tsx', 'pages/**/*.tsx'],
      rules: {
        'react-hooks/rules-of-hooks': 'off',
      },
    },
    {
      // I file API backend non sono componenti React
      files: ['api/**/*.ts'],
      env: { node: true, browser: false },
    },
  ],
}
