import { Calendar03Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { Suspense } from 'react';

import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { PrepAutomationPanel } from '@/components/worship-prep/prep-automation-panel';
import { PrepElementCards } from '@/components/worship-prep/prep-element-cards';
import { WorshipDateSelector } from '@/components/worship-prep/worship-date-selector';
import { WorshipPptxExportButton } from '@/components/worship-prep/worship-pptx-export-button';
import { getWorshipPrepDetail } from '@/lib/queries/worship-prep';
import { getConti, getContiByDate, getContis } from '@/lib/queries/contis';
import { getDefaultWorshipPrepIsoDate } from '@/lib/worship-prep/default-date';

function normalizeDate(value: string | undefined, fallback: string): string {
  if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
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

export default async function WorshipPrepPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const params = await searchParams;
  const selectedDate = normalizeDate(params.date, getDefaultWorshipPrepIsoDate());
  const [item, conti, contis] = await Promise.all([
    getWorshipPrepDetail(selectedDate),
    getContiByDate(selectedDate),
    getContis(),
  ]);
  const defaultConti = conti ? await getConti(conti.id) : null;

  return (
    <div className='flex flex-col gap-5'>
      <PageHeader title='예배 준비' description='가장 가까운 일요일 1주차를 기본으로 조회합니다'>
        {item && (
          <WorshipPptxExportButton
            item={item}
            contis={contis}
            defaultConti={defaultConti}
          />
        )}
      </PageHeader>
      <div className='space-y-4'>
        <Suspense fallback={<WorshipDateSelectorFallback />}>
          <WorshipDateSelector />
        </Suspense>
        <PrepAutomationPanel />
      </div>
      {!item ? (
        <div className='flex flex-col items-center justify-center py-12 text-center'>
          <p className='text-base text-muted-foreground'>선택한 주차 데이터가 없습니다</p>
        </div>
      ) : (
        <PrepElementCards item={item} conti={conti} />
      )}
    </div>
  );
}
