import { readFile } from 'fs/promises';

// Never an argument: the token is a live credential and would land in shell
// history.
export async function resolveToken(): Promise<string> {
  const fromEnvironment = process.env.IMPORT_API_TOKEN;
  if (fromEnvironment) {
    return fromEnvironment;
  }

  const tokenFile = process.env.IMPORT_API_TOKEN_FILE;
  if (tokenFile) {
    const contents = await readFile(tokenFile, 'utf8');
    const token = contents.trim();
    if (!token) {
      throw new Error(`IMPORT_API_TOKEN_FILE is empty: ${tokenFile}`);
    }
    return token;
  }

  throw new Error(
    'Set IMPORT_API_TOKEN (dev:local prints one as "Bearer" on startup) or IMPORT_API_TOKEN_FILE',
  );
}
