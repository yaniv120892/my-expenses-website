import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'public/**',
      'next-env.d.ts',
      '.claude/**',
    ],
  },
  ...nextCoreWebVitals,
  ...tseslint.configs.recommended,
  prettier,
  {
    rules: {
      // React Compiler rules that eslint-config-next 16 turned on; the effects
      // they flag predate them and are rewritten separately.
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/refs': 'warn',
      curly: ['error', 'all'],
      '@typescript-eslint/array-type': ['error', { default: 'array' }],
      '@typescript-eslint/explicit-member-accessibility': [
        'error',
        { accessibility: 'explicit', overrides: { constructors: 'no-public' } },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
);
