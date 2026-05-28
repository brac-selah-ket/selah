import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

test('server actions do not import concrete database modules directly', () => {
  const actionsDir = new URL('.', import.meta.url).pathname;
  const actionFiles = readdirSync(actionsDir).filter((file) => file.endsWith('.ts') && !file.endsWith('.test.ts'));
  const violations: string[] = [];

  for (const file of actionFiles) {
    const contents = readFileSync(join(actionsDir, file), 'utf8');
    if (/from ['"]@\/lib\/db(?:\/|['"])/.test(contents)) {
      violations.push(file);
    }
  }

  assert.deepEqual(violations, []);
});

test('server actions do not import concrete storage provider modules directly', () => {
  const actionsDir = new URL('.', import.meta.url).pathname;
  const actionFiles = readdirSync(actionsDir).filter((file) => file.endsWith('.ts') && !file.endsWith('.test.ts'));
  const violations: string[] = [];

  for (const file of actionFiles) {
    const contents = readFileSync(join(actionsDir, file), 'utf8');
    if (/from ['"]@vercel\/blob['"]/.test(contents)) {
      violations.push(file);
    }
  }

  assert.deepEqual(violations, []);
});
