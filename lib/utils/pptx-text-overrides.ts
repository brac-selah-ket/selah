import type { PptxTextOverride, PptxTextSection, PptxTextStructure } from '@/lib/types';

export const DEFAULT_PPT_TEXT_SECTION_NAME = '기도 봉헌 광고';

export interface PptxTextChangeSummary {
  total: number;
  bySectionId: Record<string, number>;
  bySlideId: Record<number, number>;
  byShapeKey: Record<string, boolean>;
}

export function makePptxTextOverrideKey(slideId: number, shapeId: string): string {
  return `${slideId}:${shapeId}`;
}

export function getPptxTextSectionId(section: PptxTextSection, index: number): string {
  return section.section_id || `${section.name}:${index}`;
}

export function getDefaultPptxTextSectionId(structure: PptxTextStructure | null): string {
  if (!structure || structure.sections.length === 0) return '';
  const section =
    structure.sections.find((item) => item.name === DEFAULT_PPT_TEXT_SECTION_NAME) ??
    structure.sections[0];
  return getPptxTextSectionId(section, structure.sections.indexOf(section));
}

export function getDefaultPptxTextSectionName(structure: PptxTextStructure | null): string {
  if (!structure || structure.sections.length === 0) return '';
  return (
    structure.sections.find((section) => section.name === DEFAULT_PPT_TEXT_SECTION_NAME)?.name ??
    structure.sections[0].name
  );
}

export function buildInitialPptxTextDrafts(structure: PptxTextStructure | null): Record<string, string> {
  if (!structure) return {};

  const drafts: Record<string, string> = {};
  for (const section of structure.sections) {
    for (const slide of section.slides) {
      for (const shape of slide.shapes) {
        drafts[makePptxTextOverrideKey(slide.slide_id, shape.shape_id)] = shape.text;
      }
    }
  }
  return drafts;
}

export function buildPptxTextOverrides(
  structure: PptxTextStructure | null,
  drafts: Record<string, string>
): PptxTextOverride[] {
  if (!structure) return [];

  const overrides: PptxTextOverride[] = [];
  for (const section of structure.sections) {
    for (const slide of section.slides) {
      for (const shape of slide.shapes) {
        const key = makePptxTextOverrideKey(slide.slide_id, shape.shape_id);
        const draftText = drafts[key];
        if (draftText !== undefined && draftText !== shape.text) {
          overrides.push({
            slide_id: slide.slide_id,
            shape_id: shape.shape_id,
            text: draftText,
          });
        }
      }
    }
  }
  return overrides;
}

export function buildPptxTextChangeSummary(
  structure: PptxTextStructure | null,
  drafts: Record<string, string>
): PptxTextChangeSummary {
  const summary: PptxTextChangeSummary = {
    total: 0,
    bySectionId: {},
    bySlideId: {},
    byShapeKey: {},
  };

  if (!structure) return summary;

  structure.sections.forEach((section, sectionIndex) => {
    const sectionId = getPptxTextSectionId(section, sectionIndex);

    for (const slide of section.slides) {
      for (const shape of slide.shapes) {
        const key = makePptxTextOverrideKey(slide.slide_id, shape.shape_id);
        const draftText = drafts[key];
        if (draftText === undefined || draftText === shape.text) continue;

        summary.total += 1;
        summary.bySectionId[sectionId] = (summary.bySectionId[sectionId] ?? 0) + 1;
        summary.bySlideId[slide.slide_id] = (summary.bySlideId[slide.slide_id] ?? 0) + 1;
        summary.byShapeKey[key] = true;
      }
    }
  });

  return summary;
}
