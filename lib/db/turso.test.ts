import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { after, describe, it } from 'node:test';

const tempDirs: string[] = [];

async function importTursoModuleForNode() {
  const tempDir = await mkdtemp(join(tmpdir(), 'storyboard-turso-test-'));
  tempDirs.push(tempDir);

  const source = await readFile(new URL('./turso.ts', import.meta.url), 'utf8');
  const schemaUrl = pathToFileURL(new URL('./turso-schema.ts', import.meta.url).pathname).href;
  const libsqlClientUrl = import.meta.resolve('@libsql/client');
  const drizzleLibsqlUrl = import.meta.resolve('drizzle-orm/libsql');
  const testModulePath = join(tempDir, `turso-${Date.now()}.ts`);

  await writeFile(
    testModulePath,
    source
      .replace('@libsql/client', libsqlClientUrl)
      .replace('drizzle-orm/libsql', drizzleLibsqlUrl)
      .replace("@/lib/db/turso-schema", schemaUrl),
  );

  return import(pathToFileURL(testModulePath).href);
}

after(async () => {
  await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('Turso database module', () => {
  it('does not require Turso environment variables when imported', async () => {
    const previousUrl = process.env.TURSO_DATABASE_URL;
    const previousAuthToken = process.env.TURSO_AUTH_TOKEN;

    delete process.env.TURSO_DATABASE_URL;
    delete process.env.TURSO_AUTH_TOKEN;

    try {
      const tursoModule = await importTursoModuleForNode();

      assert.equal(typeof tursoModule.createTursoClient, 'function');
      assert.equal(typeof tursoModule.createTursoDb, 'function');
      assert.equal(typeof tursoModule.getTursoDb, 'function');
    } finally {
      if (previousUrl === undefined) {
        delete process.env.TURSO_DATABASE_URL;
      } else {
        process.env.TURSO_DATABASE_URL = previousUrl;
      }

      if (previousAuthToken === undefined) {
        delete process.env.TURSO_AUTH_TOKEN;
      } else {
        process.env.TURSO_AUTH_TOKEN = previousAuthToken;
      }
    }
  });

  it('requires Turso environment variables when creating a client', async () => {
    const previousUrl = process.env.TURSO_DATABASE_URL;
    const previousAuthToken = process.env.TURSO_AUTH_TOKEN;

    delete process.env.TURSO_DATABASE_URL;
    delete process.env.TURSO_AUTH_TOKEN;

    try {
      const tursoModule = await importTursoModuleForNode();

      assert.throws(
        () => tursoModule.createTursoClient(),
        /TURSO_DATABASE_URL and TURSO_AUTH_TOKEN are required/,
      );
    } finally {
      if (previousUrl === undefined) {
        delete process.env.TURSO_DATABASE_URL;
      } else {
        process.env.TURSO_DATABASE_URL = previousUrl;
      }

      if (previousAuthToken === undefined) {
        delete process.env.TURSO_AUTH_TOKEN;
      } else {
        process.env.TURSO_AUTH_TOKEN = previousAuthToken;
      }
    }
  });
});
