import { defineConfig } from 'eslint/config';
import next from '@yaniv120892/dev-config/eslint/next';

export default defineConfig({ ignores: ['public/**', 'src/generated/**'] }, next);
