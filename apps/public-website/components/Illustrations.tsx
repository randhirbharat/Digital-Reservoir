/* Illustrative graphics. They are labelled as illustrations and never presented as an existing dam or a solver result. */
export function DamHeroIllustration() {
  return (
    <svg viewBox="0 0 640 400" width="100%" height="100%" preserveAspectRatio="xMidYMid slice" role="img"
      aria-label="Illustration of a concrete gravity dam holding a reservoir, with monitoring sensors and data links">
      <rect width="640" height="400" fill="#10232D" />
      <path d="M0 150 L120 96 L230 132 L330 84 L460 128 L640 70 L640 400 L0 400Z" fill="#163040" />
      <path d="M0 196 L140 150 L260 176 L380 142 L520 170 L640 130 L640 400 L0 400Z" fill="#183C45" />
      <rect x="0" y="214" width="372" height="186" fill="#72BEB1" opacity=".22" />
      <path d="M0 214 q18 -6 36 0 t36 0 t36 0 t36 0 t36 0 t36 0 t36 0 t36 0 t36 0 t36 0 t12 0" fill="none" stroke="#72BEB1" strokeWidth="2" />
      <path d="M0 236 q18 -5 36 0 t36 0 t36 0 t36 0 t36 0 t36 0 t36 0 t36 0 t36 0 t36 0" fill="none" stroke="#72BEB1" strokeWidth="1" opacity=".5" />
      <path d="M372 150 L410 150 L520 372 L372 372Z" fill="#DCE9E4" stroke="#F5F4EF" strokeWidth="1.5" />
      <rect x="388" y="300" width="18" height="12" rx="3" fill="#10232D" opacity=".75" />
      <rect x="388" y="230" width="18" height="12" rx="3" fill="#10232D" opacity=".75" />
      <path d="M330 372 L640 372 L640 400 L330 400Z" fill="#0A161D" />
      <g fill="none" stroke="#9B8461" strokeWidth="1.4" strokeDasharray="3 4" opacity=".85"><path d="M391 158 L470 70" /><path d="M397 306 L560 236" /><path d="M455 260 L560 190" /></g>
      <circle cx="391" cy="158" r="6" fill="#9B8461" /><circle cx="391" cy="158" r="12" fill="none" stroke="#9B8461" opacity=".45" />
      <circle cx="397" cy="306" r="6" fill="#72BEB1" /><circle cx="455" cy="260" r="6" fill="#72BEB1" /><circle cx="430" cy="372" r="5" fill="#F5F4EF" />
      <rect x="470" y="46" width="146" height="48" rx="9" fill="#0A161D" stroke="#26434D" />
      <text x="482" y="66" fill="#9DB3AE" fontFamily="IBM Plex Mono, monospace" fontSize="11">PL-01 crest</text>
      <text x="482" y="84" fill="#F5F4EF" fontFamily="IBM Plex Mono, monospace" fontSize="13">δ 3.81 mm</text>
      <polyline points="560,84 570,80 578,82 586,74 596,78 606,70" fill="none" stroke="#9B8461" strokeWidth="1.6" />
      <rect x="560" y="176" width="70" height="48" rx="9" fill="#0A161D" stroke="#26434D" />
      <text x="570" y="196" fill="#9DB3AE" fontFamily="IBM Plex Mono, monospace" fontSize="11">PZ-03</text>
      <text x="570" y="214" fill="#F5F4EF" fontFamily="IBM Plex Mono, monospace" fontSize="13">41.3 m</text>
      <text x="24" y="384" fill="#DCE9E4" fontFamily="Inter, sans-serif" fontSize="12" opacity=".85">Reservoir</text>
    </svg>
  );
}

export function StressIllustration() {
  return (
    <svg viewBox="0 0 480 360" width="100%" role="img" aria-label="Illustrative stress contour on a gravity dam cross-section" className="rounded-2xl bg-navy">
      <defs>
        <linearGradient id="dr-st" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#72BEB1" /><stop offset=".45" stopColor="#DCE9E4" /><stop offset=".75" stopColor="#C9B591" /><stop offset="1" stopColor="#9B8461" />
        </linearGradient>
      </defs>
      <path d="M150 40 L200 40 L340 310 L150 310Z" fill="url(#dr-st)" />
      <g stroke="#10232D" strokeWidth=".6" opacity=".35">
        <path d="M150 80 L222 80M150 120 L243 120M150 160 L264 160M150 200 L284 200M150 240 L305 240M150 280 L325 280" />
        <path d="M175 40 L175 310M200 40 L200 310M225 90 L225 310M250 140 L250 310M275 190 L275 310M300 230 L300 310" />
      </g>
      <path d="M120 310 L380 310 L380 330 L120 330Z" fill="#163040" />
      <rect x="390" y="60" width="14" height="200" rx="3" fill="url(#dr-st)" />
      <text x="410" y="70" fill="#DCE9E4" fontFamily="IBM Plex Mono, monospace" fontSize="10">σ₁ high</text>
      <text x="410" y="262" fill="#DCE9E4" fontFamily="IBM Plex Mono, monospace" fontSize="10">low</text>
      <text x="24" y="346" fill="#D8C49E" fontFamily="Inter, sans-serif" fontSize="11" fontWeight="700" letterSpacing="1">ILLUSTRATIVE GRAPHIC · NO SOLVER RESULT</text>
    </svg>
  );
}
