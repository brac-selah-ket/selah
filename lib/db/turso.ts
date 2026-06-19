import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';

import * as schema from '@/lib/db/turso-schema';

export function createTursoClient() {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (!url || !authToken) {
    throw new Error('TURSO_DATABASE_URL and TURSO_AUTH_TOKEN are required');
  }

  return createClient({ url, authToken });
}

export function createTursoDb() {
  return drizzle(createTursoClient(), { schema });
}

let cachedTursoDb: ReturnType<typeof createTursoDb> | undefined;

export function getTursoDb() {
  cachedTursoDb ??= createTursoDb();

  return cachedTursoDb;
}
