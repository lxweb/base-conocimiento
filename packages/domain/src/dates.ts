const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseDate(isoDate: string): Date {
  const match = isoDate.match(DATE);
  if (!match) throw new Error(`Fecha inválida: ${isoDate}`);
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
}

export function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(isoDate: string, days: number): string {
  const date = parseDate(isoDate);
  date.setUTCDate(date.getUTCDate() + days);
  return formatDate(date);
}

export function daysOverdue(dueOn: string | null, today: string): number {
  if (dueOn === null) return Number.POSITIVE_INFINITY;
  const ms = parseDate(today).getTime() - parseDate(dueOn).getTime();
  return Math.round(ms / 86_400_000);
}
