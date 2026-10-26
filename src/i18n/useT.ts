import { useTranslations } from '@yaniv120892/my-ui';
import type { AppMessages } from './messages';
import type { T } from './useT.types';

export const useT = (): T => useTranslations<AppMessages>();
