const SHORT_MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

export function getTodayDateStringInTimezone(
  timeZone,
  fallbackOffsetMinutes = 0,
  format = 'iso'
) {
  const formatKey =
    typeof format === 'string'
      ? format
      : format && typeof format === 'object'
      ? format.format || format.style
      : '';
  const useDayMonthShort =
    formatKey === 'dd MMM yy' ||
    formatKey === 'short' ||
    formatKey === 'day-month-short';
  const now = new Date();

  const formatParts = (day, monthIndex, year) => {
    const safeDay = String(day).padStart(2, '0');
    const safeYear = useDayMonthShort
      ? String(year).slice(-2)
      : String(year).padStart(4, '0');
    const numericMonthIndex = Number(monthIndex);
    if (useDayMonthShort) {
      const boundedIndex = Number.isFinite(numericMonthIndex)
        ? Math.min(Math.max(Math.floor(numericMonthIndex), 0), SHORT_MONTH_NAMES.length - 1)
        : 0;
      const monthName = SHORT_MONTH_NAMES[boundedIndex] || '';
      const safeMonth = monthName || String(boundedIndex + 1).padStart(2, '0');
      return `${safeDay} ${safeMonth} ${safeYear}`;
    }
    const normalizedMonth = Number.isFinite(numericMonthIndex) ? numericMonthIndex : 0;
    const monthNumber = String(normalizedMonth + 1).padStart(2, '0');
    return `${safeYear}-${monthNumber}-${safeDay}`;
  };

  if (typeof Intl !== 'undefined' && typeof Intl.DateTimeFormat === 'function' && timeZone) {
    try {
      const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });

      if (typeof formatter.formatToParts === 'function') {
        const parts = formatter.formatToParts(now);
        if (Array.isArray(parts) && parts.length) {
          const dayPart = parts.find((part) => part.type === 'day')?.value;
          const monthPart = parts.find((part) => part.type === 'month')?.value;
          const yearPart = parts.find((part) => part.type === 'year')?.value;
          if (dayPart && monthPart && yearPart) {
            const dayNum = Number(dayPart);
            const monthIdx = Number(monthPart) - 1;
            const yearNum = Number(yearPart.length === 2 ? `20${yearPart}` : yearPart);
            if (!Number.isNaN(dayNum) && !Number.isNaN(monthIdx) && !Number.isNaN(yearNum)) {
              return formatParts(dayNum, monthIdx, yearNum);
            }
          }
        }
      }

      const formatted = formatter.format(now);
      if (formatted) {
        const matches = formatted.match(/\d+/g);
        if (matches && matches.length >= 3) {
          const [yearStr, monthStr, dayStr] = matches;
          const yearNum = Number(yearStr);
          const monthIdx = Number(monthStr) - 1;
          const dayNum = Number(dayStr);
          if (!Number.isNaN(yearNum) && !Number.isNaN(monthIdx) && !Number.isNaN(dayNum)) {
            return formatParts(dayNum, monthIdx, yearNum);
          }
        }
      }
    } catch (err) {
      console.error(err);
    }
  }

  const offsetMinutes = Number(fallbackOffsetMinutes) || 0;
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
  const target = new Date(utcMs + offsetMinutes * 60000);
  const yearNum = target.getUTCFullYear();
  const monthIdx = target.getUTCMonth();
  const dayNum = target.getUTCDate();
  return formatParts(dayNum, monthIdx, yearNum);
}
