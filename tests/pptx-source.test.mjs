import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('scripture body slides target the largest textbox, not the first textbox', async () => {
  const source = await readFile(new URL('../api/pptx.py', import.meta.url), 'utf8');

  assert.match(source, /def get_largest_textbox\(slide\):/);
  assert.match(
    source,
    /def process_scripture_section[\s\S]+textbox = get_largest_textbox\(new_slide\)/,
  );
});

test('scripture body slides disable inherited automatic numbering', async () => {
  const source = await readFile(new URL('../api/pptx.py', import.meta.url), 'utf8');

  assert.match(source, /def strip_textbox_numbering\(shape\):/);
  assert.match(source, /buAutoNum/);
  assert.match(
    source,
    /def process_scripture_section[\s\S]+strip_textbox_numbering\(textbox\)/,
  );
});

test('scripture body slides clear non-target textboxes after choosing body textbox', async () => {
  const source = await readFile(new URL('../api/pptx.py', import.meta.url), 'utf8');

  assert.match(source, /def clear_other_textboxes\(slide, keep_shape\):/);
  assert.match(
    source,
    /def process_scripture_section[\s\S]+textbox = get_largest_textbox\(new_slide\)[\s\S]+clear_other_textboxes\(new_slide, \[textbox, page_title_shape\]\)/,
  );
});

test('scripture body slides inject the full reference into a separate title textbox', async () => {
  const source = await readFile(new URL('../api/pptx.py', import.meta.url), 'utf8');

  assert.match(source, /def get_scripture_page_title_textbox\(slide, body_shape\):/);
  assert.match(
    source,
    /def process_scripture_section[\s\S]+scripture_page_title = normalize_reference_text\(scripture.get\('reference', ''\)\)[\s\S]+page_title_shape = get_scripture_page_title_textbox\(new_slide, textbox\)[\s\S]+inject_text_into_shape\(\s*page_title_shape,\s*scripture_page_title or page.get\('title', ''\)\s*\)/,
  );
  assert.match(
    source,
    /def process_scripture_section[\s\S]+clear_other_textboxes\(new_slide, \[textbox, page_title_shape\]\)/,
  );
});

test('scripture body slides keep morph transition only on the first generated page', async () => {
  const source = await readFile(new URL('../api/pptx.py', import.meta.url), 'utf8');

  assert.match(source, /def clear_slide_transitions\(slide\):/);
  assert.match(
    source,
    /def process_scripture_section[\s\S]+for page_idx, page in enumerate\(pages, 1\):[\s\S]+new_slide, new_sid, new_el = duplicate_slide\(prs, body_base_slide\)[\s\S]+clear_slide_transitions\(new_slide\)[\s\S]+if page_idx == 1:[\s\S]+set_morph_transition\(new_slide\)/,
  );
});
