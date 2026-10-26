import { useTranslations, type Translate } from '@yaniv120892/my-ui';
import type { AppMessages } from './messages';

export type T = Translate<AppMessages>;

export const useT = (): T => useTranslations<AppMessages>();
