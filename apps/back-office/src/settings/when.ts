// The version facts date: `D Mon YYYY, HH:MM`, 24-hour, an English three-letter month, in the
// browser's time zone (DESIGN-018). The installation runs on one machine, so the browser's
// zone is the restaurant's. Month names are written out, not asked of `Intl`, so the line
// does not follow the browser's language.

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

const two = (n: number): string => String(n).padStart(2, '0');

/** `createdAt`, as the server sends it (ISO 8601 with an offset), as the facts line shows it. */
export function whenText(iso: string): string {
  const at = new Date(iso);
  return `${at.getDate()} ${MONTHS[at.getMonth()]} ${at.getFullYear()}, ${two(at.getHours())}:${two(at.getMinutes())}`;
}
