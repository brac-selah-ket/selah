import { test } from 'vitest';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('date picker renders the popover trigger as the design-system button', async () => {
  const source = await readFile(
    new URL('../components/ui/date-picker.tsx', import.meta.url),
    'utf8',
  );

  assert.match(source, /<PopoverTrigger\s+render=\{[\s\S]*<Button/);
  assert.doesNotMatch(source, /<PopoverTrigger>\s*<Button/);
});
