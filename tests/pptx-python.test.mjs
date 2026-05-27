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
