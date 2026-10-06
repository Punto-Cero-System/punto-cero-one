// Config ESLint exclusiva de auditoría (Fase Omega · Etapa 3 · Punto 8).
// No forma parte del build: se usa solo con `npx eslint --config eslint.audit.config.mjs`.
import js from '@eslint/js';
import globals from 'globals';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import pluginImport from 'eslint-plugin-import';

export default [
  {
    ...js.configs.recommended,
    files: ['src/**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: {
        ...globals.browser,
        ...globals.jest,
        ...globals.node,
      },
    },
    plugins: { react, 'react-hooks': reactHooks, import: pluginImport },
    settings: { react: { version: 'detect' } },
    rules: {
      // js.configs.recommended se lista primero: antes el bloque `rules` propio
      // lo reemplazaba por completo y `no-undef` quedaba apagado (así se coló el
      // ReferenceError de workspaceRegistryService en la auditoría previa).
      ...js.configs.recommended.rules,
      'no-undef': 'error',
      'no-unused-vars': ['warn', { args: 'none', ignoreRestSiblings: true, varsIgnorePattern: '^_[A-Za-z]' }],
      'react/jsx-uses-vars': 'warn',
      'react/jsx-uses-react': 'warn',
      'react/no-unused-prop-types': 'off',
      'react/jsx-key': 'warn',
      'react/no-unknown-property': 'warn',
      'react/jsx-no-useless-fragment': 'warn',
      'react/jsx-no-duplicate-props': 'error',
      'react/jsx-no-undef': 'error',
      'react/no-children-prop': 'warn',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'no-console': 'off',
      'no-empty': 'off',
      'no-prototype-builtins': 'off',
      'no-useless-escape': 'warn',
      'no-constant-condition': ['warn', { checkLoops: false }],
      'no-dupe-keys': 'error',
      'no-dupe-args': 'error',
      'no-dupe-class-members': 'error',
      'no-unreachable': 'error',
      'no-self-assign': 'error',
      'no-cond-assign': ['error', 'except-parens'],
      'import/no-duplicates': 'warn',
    },
  },
];
