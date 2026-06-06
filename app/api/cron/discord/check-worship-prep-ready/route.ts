import { NextRequest, NextResponse } from 'next/server';
import { isCronAuthorized } from '@/lib/cron-auth';
import { formatToYYMMDD } from '@/lib/discord-sync/thread-template';
import { checkAndSendWorshipPrepReadyNotification } from '@/lib/discord-sync/worship-prep-notifications';

export const maxDuration = 60;

function getCurrentOrUpcomingSundayDate(baseDate = new Date()): Date {
  const date = new Date(baseDate);
  const day = date.getDay();
  const diff = day === 0 ? 0 : 7 - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const sundayDate = formatToYYMMDD(getCurrentOrUpcomingSundayDate());
    const result = await checkAndSendWorshipPrepReadyNotification({
      sundayDate,
      origin: new URL(request.url).origin,
    });

    return NextResponse.json(
      {
        success: result.success,
        message: result.status,
        data: {
          threadId: result.threadId ?? null,
          messageId: result.messageId ?? null,
          error: result.error ?? null,
        },
      },
      { status: result.success ? 200 : 500 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
