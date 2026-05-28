import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const pythonExecutable = process.env.PYTHON || 'python3';

test('formats sermon title without embedded line breaks', () => {
  const script = `
import importlib.util
from pathlib import Path

spec = importlib.util.spec_from_file_location("pptx_api", Path("api/pptx.py"))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

print(module.format_sermon_title_text("모든 사람에게 미치는\\n하나님의 의\\r\\n"))
`;
  const result = spawnSync(pythonExecutable, ['-c', script], {
    cwd: repoRoot,
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), '“모든 사람에게 미치는 하나님의 의”');
});

test('injects sermon title while preserving template textbox styling', () => {
  const script = `
import importlib.util
from pathlib import Path

from lxml import etree
from pptx import Presentation
from pptx.oxml.ns import qn

spec = importlib.util.spec_from_file_location("pptx_api", Path("api/pptx.py"))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

prs = Presentation()
slide = prs.slides.add_slide(prs.slide_layouts[6])
shape = slide.shapes.add_textbox(1111, 2222, 3333, 4444)

nv_pr = shape._element.find(qn("p:nvSpPr")).find(qn("p:nvPr"))
ph = etree.SubElement(nv_pr, qn("p:ph"))
ph.set("type", "body")
ph.set("sz", "quarter")
ph.set("idx", "21")

body_pr = shape.text_frame._txBody.find(qn("a:bodyPr"))
body_pr.set("anchor", "ctr")
body_pr.set("wrap", "none")
etree.SubElement(body_pr, qn("a:spAutoFit"))

lst_style = etree.Element(qn("a:lstStyle"))
lvl1 = etree.SubElement(lst_style, qn("a:lvl1pPr"))
lvl1.set("algn", "l")
body_pr.addnext(lst_style)

p = shape.text_frame.paragraphs[0]._p
p_pr = etree.SubElement(p, qn("a:pPr"))
p_pr.set("algn", "r")
run = shape.text_frame.paragraphs[0].add_run()
run.text = "“이전 제목”"
r_pr = run._r.find(qn("a:rPr"))
if r_pr is None:
    r_pr = etree.SubElement(run._r, qn("a:rPr"))
r_pr.set("lang", "ko-KR")
r_pr.set("dirty", "0")

module.inject_sermon_title_into_shape(shape, "모든 사람에게 미치는\\n하나님의 의")
xml = shape._element.xml

print(shape.left, shape.top, shape.width, shape.height)
print('type="body"' in xml)
print('sz="quarter"' in xml)
print('idx="21"' in xml)
print('wrap="none"' in xml)
print('anchor="ctr"' in xml)
print('spAutoFit' in xml)
print('algn="l"' in xml)
print('algn="r"' in xml)
print('lang="ko-KR"' in xml)
print(shape.text.strip().replace("\\n", " | "))
`;
  const result = spawnSync(pythonExecutable, ['-c', script], {
    cwd: repoRoot,
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(result.stdout.trim().split('\n'), [
    '1111 2222 3333 4444',
    'True',
    'True',
    'True',
    'True',
    'True',
    'True',
    'True',
    'True',
    'True',
    '“모든 사람에게 미치는 하나님의 의”',
  ]);
});

test('inspect text template skips volatile generated section slides', () => {
  const script = `
import importlib.util
import json
import tempfile
from pathlib import Path

from lxml import etree
from pptx import Presentation

spec = importlib.util.spec_from_file_location("pptx_api", Path("api/pptx.py"))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

prs = Presentation()
blank = prs.slide_layouts[6]

def add_text_slide(text):
    slide = prs.slides.add_slide(blank)
    shape = slide.shapes.add_textbox(1000, 1000, 4000, 1000)
    shape.text = text
    return slide

for section_name in ["봉독 말씀", "찬양 1", "기도 봉헌 광고"]:
    add_text_slide(f"{section_name} title")
    add_text_slide(f"{section_name} body")

slide_id_map = module.get_slide_id_map(prs)
slide_ids = list(slide_id_map.keys())
section_lst = etree.SubElement(prs._element, module._pn("sectionLst"))

for index, section_name in enumerate(["봉독 말씀", "찬양 1", "기도 봉헌 광고"]):
    section = etree.SubElement(section_lst, module._pn("section"))
    section.set("name", section_name)
    section.set("id", f"section-{index + 1}")
    sld_id_lst = etree.SubElement(section, module._pn("sldIdLst"))
    for slide_id in slide_ids[index * 2:index * 2 + 2]:
        sld_id = etree.SubElement(sld_id_lst, module._pn("sldId"))
        sld_id.set("id", str(slide_id))

with tempfile.NamedTemporaryFile(suffix=".pptx") as tmp:
    prs.save(tmp.name)
    data = module.inspect_text_template(tmp.name, "file-1")

counts = {section["name"]: len(section["slides"]) for section in data["sections"]}
print(json.dumps({
    "file_id": data["file_id"],
    "counts": counts,
}, ensure_ascii=False))
`;
  const result = spawnSync(pythonExecutable, ['-c', script], {
    cwd: repoRoot,
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout.trim()), {
    file_id: 'file-1',
    counts: {
      '봉독 말씀': 1,
      '찬양 1': 1,
      '기도 봉헌 광고': 2,
    },
  });
});

test('text overrides skip malformed slide ids and apply valid edits', () => {
  const script = `
import importlib.util
import json
from pathlib import Path

from pptx import Presentation

spec = importlib.util.spec_from_file_location("pptx_api", Path("api/pptx.py"))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

prs = Presentation()
slide = prs.slides.add_slide(prs.slide_layouts[6])
shape = slide.shapes.add_textbox(1000, 1000, 4000, 1000)
shape.text = "before"

slide_id = next(iter(module.get_slide_id_map(prs).keys()))
shape_id = module.get_shape_stable_id(shape, 0)
stats = module.apply_text_overrides(prs, [
    {"slide_id": "abc", "shape_id": shape_id, "text": "bad"},
    {"slide_id": slide_id, "shape_id": shape_id, "text": "after"},
])

print(json.dumps({
    "stats": stats,
    "text": shape.text,
}, ensure_ascii=False))
`;
  const result = spawnSync(pythonExecutable, ['-c', script], {
    cwd: repoRoot,
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout.trim()), {
    stats: {
      text_overrides_applied: 1,
      text_overrides_skipped: 1,
    },
    text: 'after',
  });
});
