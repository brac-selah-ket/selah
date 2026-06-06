"use client";

import Link from 'next/link';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import type { Conti } from '@/lib/types';
import type { WorshipPrepSummary } from '@/lib/queries/worship-prep';
import { cn } from '@/lib/utils';
import { ScripturePreviewDialog } from './scripture-preview-dialog';

interface PrepElementCardsProps {
  item: WorshipPrepSummary;
  conti: Conti | null;
}

interface PrepCardItem {
  key: string;
  category: string;
  title: string;
  value: string;
  hasValue: boolean;
  sourceLabel: '구글 시트' | '콘티';
  valueClassName?: string;
  onClick?: () => void;
  buttonLabel?: string;
}

function statusBadge(hasValue: boolean) {
  return (
    <Badge className='shrink-0' variant={hasValue ? 'default' : 'outline'}>
      {hasValue ? '완료' : '미입력'}
    </Badge>
  );
}

function valueOrDash(value: string | null | undefined): string {
  return value && value.trim() ? value : '-';
}

function PrepCard({
  item,
  className,
}: {
  item: PrepCardItem;
  className?: string;
}) {
  return (
    <Card size='sm' className={cn('h-full', className)}>
      <CardContent className='flex h-full flex-col gap-2'>
        <div className='flex items-start justify-between gap-2'>
          <p className='text-xs font-medium text-muted-foreground'>{item.category}</p>
          <Badge
            variant='secondary'
            className='h-5 px-1.5 text-xs font-medium text-muted-foreground'
          >
            {item.sourceLabel}
          </Badge>
        </div>
        <div className='min-w-0 space-y-1'>
          <h3 className='text-sm font-medium text-muted-foreground'>{item.title}</h3>
          <p
            className={cn(
              'break-words text-base font-semibold leading-snug text-foreground',
              item.valueClassName,
            )}
          >
            {item.value}
          </p>
        </div>
        <div className='flex items-center gap-2 pt-1'>{statusBadge(item.hasValue)}</div>
      </CardContent>
    </Card>
  );
}

export function PrepElementCards({ item, conti }: PrepElementCardsProps) {
  const [scripturePreviewOpen, setScripturePreviewOpen] = useState(false);
  const scriptureReference = item.scripture?.trim() ? item.scripture.trim() : null;
  const sheetCards: PrepCardItem[] = [
    {
      key: 'preacher',
      category: '역할',
      title: '설교자',
      value: valueOrDash(item.preacher),
      hasValue: Boolean(item.preacher),
      sourceLabel: '구글 시트',
    },
    {
      key: 'leader',
      category: '역할',
      title: '인도자',
      value: valueOrDash(item.leader),
      hasValue: Boolean(item.leader),
      sourceLabel: '구글 시트',
    },
    {
      key: 'worshipLeader',
      category: '역할',
      title: '찬양 인도자',
      value: valueOrDash(item.worshipLeader),
      hasValue: Boolean(item.worshipLeader),
      sourceLabel: '구글 시트',
    },
    {
      key: 'title',
      category: '설교',
      title: '설교 제목',
      value: valueOrDash(item.title),
      hasValue: Boolean(item.title),
      sourceLabel: '구글 시트',
    },
    {
      key: 'scripture',
      category: '설교',
      title: '말씀 본문',
      value: valueOrDash(item.scripture),
      hasValue: Boolean(scriptureReference),
      sourceLabel: '구글 시트',
      onClick: scriptureReference ? () => setScripturePreviewOpen(true) : undefined,
      buttonLabel: scriptureReference ? '말씀 본문 미리보기 열기' : undefined,
    },
    {
      key: 'songs',
      category: '찬양',
      title: '찬양 목록',
      value: item.songs.length > 0 ? item.songs.join(', ') : '-',
      hasValue: item.songs.length > 0,
      sourceLabel: '구글 시트',
      valueClassName: 'text-sm font-medium',
    },
  ];
  const contiCard: PrepCardItem = {
    key: 'conti',
    category: '연결',
    title: '콘티',
    value: conti ? conti.title || `${conti.date} 콘티` : '연결된 콘티 없음',
    hasValue: Boolean(conti),
    sourceLabel: '콘티',
  };

  return (
    <>
      <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3'>
        {sheetCards.map((card) => {
          if (card.onClick) {
            return (
              <button
                key={card.key}
                type='button'
                className='block h-full w-full cursor-pointer rounded-lg text-left focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50'
                onClick={card.onClick}
                aria-label={card.buttonLabel}
              >
                <PrepCard
                  item={card}
                  className='transition-colors hover:border-primary/40 hover:bg-muted/30'
                />
              </button>
            );
          }

          return <PrepCard key={card.key} item={card} />;
        })}
        {conti ? (
          <Link
            href={`/contis/${conti.id}`}
            className='block h-full rounded-lg focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50'
          >
            <PrepCard
              item={contiCard}
              className='transition-colors hover:border-primary/40 hover:bg-muted/30'
            />
          </Link>
        ) : (
          <PrepCard item={contiCard} />
        )}
      </div>
      <ScripturePreviewDialog
        open={scripturePreviewOpen}
        scriptureReference={scriptureReference}
        onOpenChange={setScripturePreviewOpen}
      />
    </>
  );
}
