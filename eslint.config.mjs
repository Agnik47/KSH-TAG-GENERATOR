import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // Keep the framework-free core free of UI/browser imports (Phase 2 runs it on the server).
    files: ['src/core/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: ['@/features/*', '@/components/*', '@/lib/*', 'react', 'react-dom', 'next', 'next/*'] },
      ],
    },
  },
  globalIgnores(['.next/**', 'out/**', 'node_modules/**', 'reference/**', 'next-env.d.ts']),
]);
