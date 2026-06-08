import { Suspense, cache } from 'react';
import { Calendar03Icon, FileExportIcon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';

import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { PrepAutomationPanel } from '@/components/worship-prep/prep-automation-panel';
import { PrepElementCards } from '@/components/worship-prep/prep-element-cards';
import { WorshipDateSelector } from '@/components/worship-prep/worship-date-selector';
import { WorshipPptxExportButton } from '@/components/worship-prep/worship-pptx-export-button';
import { getWorshipPrepDetail, type WorshipPrepSummary } from '@/lib/queries/worship-prep';
import { getConti, getContiByDate, getContis } from '@/lib/queries/contis';
import { getDefaultWorshipPrepIsoDate } from '@/lib/worship-prep/default-date';
import type { Conti, ContiWithSongs } from '@/lib/types';

type WorshipPrepSearchParams = Promise<{ date?: string | string[] }>;

interface WorshipPrepPageData {
  item: WorshipPrepSummary | null;
  conti: Conti | null;
  contis: Conti[];
  defaultConti: ContiWithSongs | null;
}

function normalizeDate(value: string | string[] | undefined, fallback: string): string {
  const dateValue = Array.isArray(value) ? value[0] : value;

  if (dateValue && /^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
    return dateValue;
  }

  return fallback;
}

function WorshipDateSelectorFallback() {
  return (
    <div className="w-full max-w-xs">
      <Button disabled variant="outline" className="h-9 w-full justify-start font-normal">
        <HugeiconsIcon icon={Calendar03Icon} strokeWidth={2} data-icon="inline-start" />
        날짜 선택
      </Button>
    </div>
  );
}

const getWorshipPrepPageData = cache(async (
  searchParams: WorshipPrepSearchParams,
): Promise<WorshipPrepPageData> => {
  const params = await searchParams;
  const selectedDate = normalizeDate(params.date, getDefaultWorshipPrepIsoDate());
  const [item, conti, contis] = await Promise.all([
    getWorshipPrepDetail(selectedDate),
    getContiByDate(selectedDate),
    getContis(),
  ]);
  const defaultConti = conti ? await getConti(conti.id) : null;

  return {
    item,
    conti,
    contis,
    defaultConti,
  };
});

function DisabledWorshipPptxExportButton() {
  return (
    <Button disabled>
      <HugeiconsIcon icon={FileExportIcon} strokeWidth={2} data-icon="inline-start" />
      예배 PPT 내보내기
    </Button>
  );
}

async function WorshipPrepHeaderAction({
  searchParams,
}: {
  searchParams: WorshipPrepSearchParams;
}) {
  const { item, contis, defaultConti } = await getWorshipPrepPageData(searchParams);

  if (!item) {
    return <DisabledWorshipPptxExportButton />;
  }

  return (
    <WorshipPptxExportButton
      item={item}
      contis={contis}
      defaultConti={defaultConti}
    />
  );
}

function WorshipPrepCardsSkeleton() {
  return (
    <div
      data-slot="worship-prep-cards-loading"
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
    >
      {Array.from({ length: 6 }).map((_, index) => (
        <Skeleton key={index} className="h-32 rounded-xl" />
      ))}
    </div>
  );
}

async function WorshipPrepDataPanel({
  searchParams,
}: {
  searchParams: WorshipPrepSearchParams;
}) {
  const { item, conti } = await getWorshipPrepPageData(searchParams);

  if (!item) {
    return (
      <div className='flex flex-col items-center justify-center py-12 text-center'>
        <p className='text-base text-muted-foreground'>선택한 주차 데이터가 없습니다</p>
      </div>
    );
  }

  return <PrepElementCards item={item} conti={conti} />;
}

export default function WorshipPrepPage({
  searchParams,
}: {
  searchParams: WorshipPrepSearchParams;
}) {
  return (
    <div className='flex flex-col gap-5'>
      <PageHeader title='예배 준비' description='가장 가까운 일요일 1주차를 기본으로 조회합니다'>
        <Suspense fallback={<DisabledWorshipPptxExportButton />}>
          <WorshipPrepHeaderAction searchParams={searchParams} />
        </Suspense>
      </PageHeader>
      <div className='space-y-4'>
        <Suspense fallback={<WorshipDateSelectorFallback />}>
          <WorshipDateSelector />
        </Suspense>
        <PrepAutomationPanel />
      </div>
      <Suspense fallback={<WorshipPrepCardsSkeleton />}>
        <WorshipPrepDataPanel searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
