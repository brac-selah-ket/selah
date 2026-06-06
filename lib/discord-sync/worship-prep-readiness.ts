export interface WorshipPrepReadinessRow {
  preacher: string | null;
  leader: string | null;
  worshipLeader: string | null;
  title: string | null;
  scripture: string | null;
  songs: string[];
}

export interface WorshipPrepReadyInput {
  row: WorshipPrepReadinessRow | null;
  hasLinkedConti: boolean;
}

function hasText(value: string | null): boolean {
  return Boolean(value?.trim());
}

export function isWorshipPrepReady(input: WorshipPrepReadyInput): boolean {
  const row = input.row;
  if (!row) {
    return false;
  }

  return (
    hasText(row.preacher) &&
    hasText(row.leader) &&
    hasText(row.worshipLeader) &&
    hasText(row.title) &&
    hasText(row.scripture) &&
    row.songs.length > 0 &&
    input.hasLinkedConti
  );
}

export function toIsoDateFromYYMMDD(sundayDate: string): string {
  if (!/^\d{6}$/.test(sundayDate)) {
    throw new Error(`Expected YYMMDD sundayDate, received: ${sundayDate}`);
  }
  const isoDate = `20${sundayDate.slice(0, 2)}-${sundayDate.slice(2, 4)}-${sundayDate.slice(4, 6)}`;
  assertValidIsoDate(isoDate);
  return isoDate;
}

export function toYYMMDDFromIsoDate(isoDate: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
    throw new Error(`Expected YYYY-MM-DD isoDate, received: ${isoDate}`);
  }
  assertValidIsoDate(isoDate);
  return `${isoDate.slice(2, 4)}${isoDate.slice(5, 7)}${isoDate.slice(8, 10)}`;
}

function assertValidIsoDate(isoDate: string): void {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Expected a valid calendar date, received: ${isoDate}`);
  }

  const roundTrip = date.toISOString().slice(0, 10);
  if (roundTrip !== isoDate) {
    throw new Error(`Expected a valid calendar date, received: ${isoDate}`);
  }
}

export function buildWorshipPrepUrl(baseUrl: string, isoDate: string): string {
  const url = new URL('/worship-prep', baseUrl);
  url.searchParams.set('date', isoDate);
  return url.toString();
}

export function buildWorshipPrepReadyMessage(worshipPrepUrl: string): string {
  return `광고 외에 PPT 작성 준비가 완료되었습니다. ${worshipPrepUrl} 에서 작업해주세요.`;
}
