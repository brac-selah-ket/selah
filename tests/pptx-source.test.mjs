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

test('sermon title slide is updated in the existing sermon title section', async () => {
  const source = await readFile(new URL('../api/pptx.py', import.meta.url), 'utf8');

  assert.match(source, /def format_sermon_title_text\(title\):/);
  assert.match(source, /def inject_sermon_title_into_shape\(shape, title\):/);
  assert.match(
    source,
    /def inject_sermon_title_into_shape\(shape, title\):[\s\S]+formatted_title = format_sermon_title_text\(title\)[\s\S]+inject_text_into_shape\(shape, formatted_title\)/,
  );
  assert.doesNotMatch(source, /SERMON_TITLE_TEXTBOX_LAYOUT/);
  assert.doesNotMatch(source, /SERMON_TITLE_TEXTBOX_STYLE_XML/);
  assert.doesNotMatch(source, /apply_sermon_title_shape_layout/);
  assert.match(source, /return f'“\{stripped\}”'/);
  assert.match(source, /def process_sermon_title_section\(prs, scripture, sections, slide_id_map\):/);
  assert.match(source, /sermon_title_section_name/);
  assert.match(source, /find_section_by_name\(sections, section_name\)/);
  assert.match(source, /title_slide_id = section\['slide_ids'\]\[0\]/);
  assert.match(source, /inject_sermon_title_into_shape\(title_shape, sermon_title\)/);
  assert.match(
    source,
    /in_section_sermon_title_slide_id = find_sermon_title_slide_id\([\s\S]+process_scripture_section\(prs, scripture, section, slide_id_map\)[\s\S]+if in_section_sermon_title_slide_id is None:[\s\S]+process_sermon_title_section\(prs, scripture, sections, slide_id_map\)/,
  );
});

test('scripture section preserves an in-section sermon title slide after generated pages', async () => {
  const source = await readFile(new URL('../api/pptx.py', import.meta.url), 'utf8');

  assert.match(source, /def find_sermon_title_slide_id\(slide_ids, slide_id_map\):/);
  assert.match(source, /layout_name = getattr\(getattr\(slide, 'slide_layout', None\), 'name', ''\)/);
  assert.match(source, /if layout_name == '말씀 제목':[\s\S]+return slide_id/);
  assert.match(source, /preserved_sermon_title_slide_id = find_sermon_title_slide_id\(slide_ids\[2:\], slide_id_map\)/);
  assert.match(
    source,
    /for sid in slide_ids\[2:\]:[\s\S]+if sid == preserved_sermon_title_slide_id:[\s\S]+continue[\s\S]+delete_slide_by_id\(prs, sid\)/,
  );
  assert.match(
    source,
    /if preserved_sermon_title_slide_id:[\s\S]+inject_sermon_title_into_shape\([\s\S]+sermon_title_shape,[\s\S]+scripture.get\('sermon_title', ''\)[\s\S]+\)[\s\S]+move_slide_id_after\(prs, preserved_sermon_title_slide_id, last_slide_id\)[\s\S]+scripture_section_slide_ids.append\(preserved_sermon_title_slide_id\)/,
  );
});
