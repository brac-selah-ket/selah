import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import * as schema from './schema';

export function createNeonClient() {
  const url = process.env.POSTGRES_URL;

  if (!url) {
    throw new Error('POSTGRES_URL is required when DATABASE_PROVIDER=neon');
  }

  return neon(url);
}

export function createNeonDb() {
  return drizzle(createNeonClient(), { schema });
}

let cachedDb: ReturnType<typeof createNeonDb> | undefined;

export function getNeonDb() {
  cachedDb ??= createNeonDb();

  return cachedDb;
}

export const db = new Proxy({} as ReturnType<typeof createNeonDb>, {
  get(_target, property) {
    const database = getNeonDb();
    const value = Reflect.get(database, property);

    return typeof value === 'function' ? value.bind(database) : value;
  },
});
