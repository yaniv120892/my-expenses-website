import { initSentry } from '../sentry.config';

initSentry(process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV);
