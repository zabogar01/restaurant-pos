// The four icons Frost has (docs/DESIGN.md, Shapes). Paths are the ones the
// reviewed artifact draws, in docs/design/visual-directions/mockup.js.
// Size and stroke come from CSS so the registry stays the only source.

const paths = {
  arrow: 'M5 12h14m-6-6 6 6-6 6',
  back: 'M19 12H5m6-6-6 6 6 6',
  alert: 'M12 6v8m0 4h.01',
  close: 'm6 6 12 12M18 6 6 18',
} as const;

export function Icon({ name }: { name: keyof typeof paths }) {
  return (
    <svg
      className="icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={paths[name]} />
    </svg>
  );
}
