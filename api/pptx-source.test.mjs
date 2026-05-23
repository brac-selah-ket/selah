import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('scripture body slides target the largest textbox, not the first textbox', async () => {
  const source = await readFile(new URL('./pptx.py', import.meta.url), 'utf8');

  assert.match(source, /def get_largest_textbox\(slide\):/);
  assert.match(
    source,
    /def process_scripture_section[\s\S]+textbox = get_largest_textbox\(new_slide\)/,
  );
});

test('scripture body slides disable inherited automatic numbering', async () => {
  const source = await readFile(new URL('./pptx.py', import.meta.url), 'utf8');

  assert.match(source, /def strip_textbox_numbering\(shape\):/);
  assert.match(source, /buAutoNum/);
  assert.match(
    source,
    /def process_scripture_section[\s\S]+strip_textbox_numbering\(textbox\)/,
  );
});
