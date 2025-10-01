const DN_ZERO_WIDTH_RE = /[\u200B\u200C\u200D\u2060\uFEFF]/g;
export const DN_VALID_RE = /^[A-Z]{2}[A-Z0-9]{3}\d{9,13}$/;

export function normalizeDnSoft(raw) {
  return (raw || '').replace(DN_ZERO_WIDTH_RE, '').toUpperCase();
}

export function isValidDn(raw) {
  if (raw === undefined || raw === null) return false;
  return DN_VALID_RE.test(normalizeDnSoft(raw));
}

export { DN_ZERO_WIDTH_RE };
