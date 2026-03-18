interface Props {
  coins: number;
  className?: string;
}

function getState(coins: number): 0 | 1 | 2 | 3 | 4 {
  if (coins >= 55) return 4;
  if (coins >= 40) return 3;
  if (coins >= 25) return 2;
  if (coins >= 10) return 1;
  return 0;
}

function getFillY(state: 0 | 1 | 2 | 3 | 4): number {
  switch (state) {
    case 4: return 96;
    case 3: return 112;
    case 2: return 128;
    case 1: return 150;
    default: return 210;
  }
}

const PINK      = "#F28BA8";
const PINK_DARK = "#E06A88";
const OUTLINE   = "#3A3347";
const GOLD      = "#FFC738";
const GOLD_DARK = "#E5A820";
const WHITE     = "#FFFFFF";
const DARK      = "#121331";
const SW        = 4.5;

export function PiggyBankSVG({ coins, className }: Props) {
  const state = getState(coins);
  const fillY = getFillY(state);

  return (
    <svg
      viewBox="0 0 200 215"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ overflow: "visible" }}
    >
      <defs>
        <clipPath id="pbk-body-clip">
          <ellipse cx="97" cy="148" rx="65" ry="52" />
        </clipPath>
      </defs>

      {/* ── Tail ── */}
      <path
        d="M 158 122 C 186 108 186 142 168 138 C 160 136 162 124 172 126"
        fill="none"
        stroke={OUTLINE}
        strokeWidth={SW}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* ── Ears (behind head) ── */}
      <ellipse cx="64"  cy="54" rx="17" ry="22" fill={PINK}      stroke={OUTLINE} strokeWidth={SW} />
      <ellipse cx="64"  cy="57" rx="9"  ry="13" fill={PINK_DARK} />
      <ellipse cx="136" cy="54" rx="17" ry="22" fill={PINK}      stroke={OUTLINE} strokeWidth={SW} />
      <ellipse cx="136" cy="57" rx="9"  ry="13" fill={PINK_DARK} />

      {/* ── Body ── */}
      <ellipse cx="97" cy="148" rx="65" ry="52" fill={PINK} stroke={OUTLINE} strokeWidth={SW} />

      {/* ── Coin fill inside body ── */}
      {state > 0 && (
        <>
          <rect
            x="32" y={fillY}
            width="130" height="210"
            fill={GOLD}
            clipPath="url(#pbk-body-clip)"
            opacity="0.92"
          />
          {[0, 1, 2, 3, 4, 5].map((i) => {
            const lineY = fillY + 14 + i * 13;
            if (lineY > 196) return null;
            return (
              <rect
                key={i}
                x="32" y={lineY}
                width="130" height="3"
                fill={GOLD_DARK}
                clipPath="url(#pbk-body-clip)"
                opacity="0.4"
              />
            );
          })}
        </>
      )}

      {/* ── Legs ── */}
      <rect x="43"  y="183" width="22" height="26" rx="11" fill={PINK} stroke={OUTLINE} strokeWidth={SW} />
      <rect x="70"  y="186" width="22" height="24" rx="11" fill={PINK} stroke={OUTLINE} strokeWidth={SW} />
      <rect x="102" y="186" width="22" height="24" rx="11" fill={PINK} stroke={OUTLINE} strokeWidth={SW} />
      <rect x="129" y="183" width="22" height="26" rx="11" fill={PINK} stroke={OUTLINE} strokeWidth={SW} />

      {/* ── Head ── */}
      <circle cx="100" cy="90" r="52" fill={PINK} stroke={OUTLINE} strokeWidth={SW} />

      {/* ── Coin slot on top of head ── */}
      <rect x="83" y="34" width="34" height="9" rx="4.5" fill={OUTLINE} />
      <rect x="88" y="37"  width="24" height="4" rx="2"   fill={DARK}    />

      {/* ── Eyes ── */}
      <circle cx="84"  cy="82" r="9"   fill={WHITE}  />
      <circle cx="116" cy="82" r="9"   fill={WHITE}  />
      <circle cx="86"  cy="84" r="5.2" fill={DARK}   />
      <circle cx="118" cy="84" r="5.2" fill={DARK}   />
      <circle cx="84"  cy="81" r="2"   fill={WHITE}  />
      <circle cx="116" cy="81" r="2"   fill={WHITE}  />

      {/* ── Snout ── */}
      <ellipse cx="100" cy="112" rx="25" ry="19" fill={PINK_DARK} stroke={OUTLINE} strokeWidth={SW} />
      <ellipse cx="91"  cy="114" rx="5.5" ry="4.5" fill={OUTLINE} opacity="0.55" />
      <ellipse cx="109" cy="114" rx="5.5" ry="4.5" fill={OUTLINE} opacity="0.55" />

      {/* ── State 4: sparkles ── */}
      {state === 4 && (
        <>
          {[
            [24, 40, 0.85],
            [176, 40, 0.85],
            [100, 4, 1.0],
          ].map(([tx, ty, sc], i) => (
            <g key={i} transform={`translate(${tx},${ty}) scale(${sc})`}>
              <line x1="0" y1="-10" x2="0" y2="10"  stroke={GOLD} strokeWidth="3"   strokeLinecap="round" />
              <line x1="-10" y1="0" x2="10" y2="0"  stroke={GOLD} strokeWidth="3"   strokeLinecap="round" />
              <line x1="-7" y1="-7" x2="7" y2="7"   stroke={GOLD} strokeWidth="2"   strokeLinecap="round" />
              <line x1="7" y1="-7" x2="-7" y2="7"   stroke={GOLD} strokeWidth="2"   strokeLinecap="round" />
            </g>
          ))}
        </>
      )}
    </svg>
  );
}
