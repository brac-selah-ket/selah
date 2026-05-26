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

test('applies canonical sermon title textbox layout', () => {
  const script = `
import importlib.util
from pathlib import Path

spec = importlib.util.spec_from_file_location("pptx_api", Path("api/pptx.py"))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class Shape:
    left = 1
    top = 2
    width = 3
    height = 4

shape = Shape()
module.apply_sermon_title_shape_layout(shape)
print(shape.left, shape.top, shape.width, shape.height)
`;
  const result = spawnSync(pythonExecutable, ['-c', script], {
    cwd: repoRoot,
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr);
  assert.equal(
    result.stdout.trim(),
    '875160 698500 23649681 6350000',
  );
});

test('injects sermon title with canonical textbox styling', () => {
  const script = `
import importlib.util
from pathlib import Path

from lxml import etree
from pptx import Presentation
from pptx.oxml.ns import qn
from pptx.util import Inches

spec = importlib.util.spec_from_file_location("pptx_api", Path("api/pptx.py"))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

prs = Presentation()
slide = prs.slides.add_slide(prs.slide_layouts[6])
shape = slide.shapes.add_textbox(Inches(1), Inches(1), Inches(3), Inches(1))

nv_pr = shape._element.find(qn("p:nvSpPr")).find(qn("p:nvPr"))
ph = etree.SubElement(nv_pr, qn("p:ph"))
ph.set("type", "body")
ph.set("sz", "quarter")
ph.set("idx", "21")

body_pr = shape.text_frame._txBody.find(qn("a:bodyPr"))
etree.SubElement(body_pr, qn("a:noAutofit"))

p = shape.text_frame.paragraphs[0]._p
p_pr = etree.SubElement(p, qn("a:pPr"))
p_pr.set("algn", "ctr")
etree.SubElement(etree.SubElement(p_pr, qn("a:defRPr")), qn("a:effectLst"))

module.inject_sermon_title_into_shape(shape, "모든 사람에게 미치는\\n하나님의 의")
xml = shape._element.xml

print("quarter" in xml)
print("noAutofit" in xml)
print('wrap="none"' in xml)
print('anchor="ctr"' in xml)
print('anchor="t"' in xml)
print('algn="ctr"' in xml)
print("outerShdw" in xml)
print('typeface="Noto Serif KR"' in xml)
print('spcPct val="120000"' in xml)
print(shape.text.strip().replace("\\n", " | "))
print([r._r.find(qn("a:rPr")).get("lang") for r in shape.text_frame.paragraphs[0].runs])
`;
  const result = spawnSync(pythonExecutable, ['-c', script], {
    cwd: repoRoot,
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(result.stdout.trim().split('\n'), [
    'False',
    'False',
    'False',
    'False',
    'True',
    'True',
    'True',
    'True',
    'True',
    '“모든 사람에게 미치는 하나님의 의”',
    "['en-US', 'ko-KR', 'en-US']",
  ]);
});
