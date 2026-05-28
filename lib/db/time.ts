export function dateToDbText(value: Date): string {
  return value.toISOString();
}

export function dbTextToDate(value: string): Date {
  return new Date(value);
}

export function nowDbText(): string {
  return dateToDbText(new Date());
}
