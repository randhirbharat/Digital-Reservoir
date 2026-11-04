/**
 * Digital Reservoir logo.
 * Concept: a gravity-dam cross-section retaining a reservoir (waves), crossed by a
 * monitoring signal whose final node sits on the structure — "data from infrastructure".
 * `tone="light"` is for light surfaces, `tone="dark"` for dark surfaces.
 */
type Tone = "light" | "dark";

export function LogoMark({ size = 40, tone = "light", title }: { size?: number; tone?: Tone; title?: string }) {
  const tile = tone === "light" ? "#10232D" : "#183C45";
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" role={title ? "img" : "presentation"} aria-label={title} aria-hidden={title ? undefined : true}>
      <rect width="48" height="48" rx="12" fill={tile} />
      <path d="M7 21h20v17H7z" fill="#72BEB1" opacity=".28" />
      <path d="M7 21c2.2-1.8 4.4-1.8 6.6 0s4.4 1.8 6.6 0 4.4-1.8 6.8 0" fill="none" stroke="#72BEB1" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M27 9.5h5.5L41 38H27z" fill="#DCE9E4" />
      <path d="M5 38h38" stroke="#DCE9E4" strokeWidth="1.6" strokeLinecap="round" opacity=".55" />
      <polyline points="7,31 13,31 16,26.5 19.5,34 23,29 30.5,29 34,23" fill="none" stroke="#9B8461" strokeWidth="1.9" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx="34" cy="23" r="2.6" fill="#9B8461" stroke={tile} strokeWidth="1.2" />
    </svg>
  );
}

export function Logo({
  tone = "light",
  size = 40,
  tagline = true,
  product,
}: {
  tone?: Tone;
  size?: number;
  tagline?: boolean;
  /** Optional product qualifier, e.g. "Engineering Lab" or "Digital Twin" */
  product?: string;
}) {
  const ink = tone === "light" ? "#10232D" : "#F5F4EF";
  const sub = tone === "light" ? "#6E5A3A" : "#C9B591";
  return (
    <span className="inline-flex items-center gap-3" aria-label={`Digital Reservoir${product ? " " + product : ""}`}>
      <LogoMark size={size} tone={tone} />
      <span className="flex flex-col leading-none">
        <span className="font-display font-extrabold tracking-[0.08em] text-[0.95rem] sm:text-[1.02rem]" style={{ color: ink }}>
          DIGITAL RESERVOIR
          {product ? <span className="font-semibold tracking-normal ml-2 opacity-80 normal-case">| {product}</span> : null}
        </span>
        {tagline ? (
          <span className="hidden sm:block mt-1 text-[0.62rem] font-semibold tracking-[0.22em]" style={{ color: sub }}>
            INTELLIGENCE FOR INFRASTRUCTURE
          </span>
        ) : null}
      </span>
    </span>
  );
}
