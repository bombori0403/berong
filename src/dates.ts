// Intl 의존 없이 동작하는 한국어 날짜/시간 포맷 유틸
const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];

const pad = (n: number) => String(n).padStart(2, '0');

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const ampm = d.getHours() < 12 ? '오전' : '오후';
  let h = d.getHours() % 12;
  if (h === 0) h = 12;
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}(${DAY_NAMES[d.getDay()]}) ${ampm} ${h}:${pad(d.getMinutes())}`;
}

export function formatTime(ts: number): string {
  const d = new Date(ts);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Date → 기기 로컬 기준 ISO 문자열(타임존 오프셋 포함) */
export function toLocalISO(d: Date): string {
  const offsetMin = -d.getTimezoneOffset();
  const sign = offsetMin >= 0 ? '+' : '-';
  const abs = Math.abs(offsetMin);
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}:00` +
    `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`
  );
}

/** "2026-10-03 15:00" / "2026-10-03T15:00" 형태 입력을 Date로 (실패 시 null) */
export function parseDateTimeInput(input: string): Date | null {
  const m = input
    .trim()
    .match(/^(\d{4})-(\d{1,2})-(\d{1,2})[T\s]+(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const d = new Date(
    Number(m[1]),
    Number(m[2]) - 1,
    Number(m[3]),
    Number(m[4]),
    Number(m[5])
  );
  return isNaN(d.getTime()) ? null : d;
}

/** 현재 시각을 베롱이에게 알려줄 문자열로 */
export function nowDescription(): string {
  const d = new Date();
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 (${DAY_NAMES[d.getDay()]}요일) ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
