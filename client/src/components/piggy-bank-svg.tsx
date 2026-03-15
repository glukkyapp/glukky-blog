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
    case 4: return 85;
    case 3: return 103;
    case 2: return 118;
    case 1: return 143;
    default: return 200;
  }
}

export function PiggyBankSVG({ coins, className }: Props) {
  const state = getState(coins);
  const fillY = getFillY(state);

  return (
    <svg
      viewBox="0 0 200 210"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ overflow: "visible" }}
    >
      <defs>
        <clipPath id="pig-body-clip">
          <ellipse cx="100" cy="132" rx="62" ry="49" />
        </clipPath>
      </defs>

      {/* Tail */}
      <path
        d="M 158 115 Q 178 102 174 126 Q 178 139 162 132"
        fill="none"
        stroke="#0d7c66"
        strokeWidth="4.5"
        strokeLinecap="round"
      />

      {/* Body base */}
      <ellipse cx="100" cy="132" rx="62" ry="49" fill="#14A085" />

      {/* Coin fill inside body */}
      {state > 0 && (
        <>
          <rect
            x="38"
            y={fillY}
            width="124"
            height="200"
            fill="#f59e0b"
            clipPath="url(#pig-body-clip)"
            opacity="0.88"
          />
          {/* Coin stack lines for texture */}
          {[0, 1, 2, 3, 4].map((i) => {
            const lineY = fillY + 12 + i * 14;
            if (lineY > 178) return null;
            return (
              <rect
                key={i}
                x="38"
                y={lineY}
                width="124"
                height="2.5"
                fill="#d97706"
                clipPath="url(#pig-body-clip)"
                opacity="0.45"
              />
            );
          })}
        </>
      )}

      {/* Body outline */}
      <ellipse cx="100" cy="132" rx="62" ry="49" fill="none" stroke="#0d7c66" strokeWidth="2" />

      {/* Legs */}
      <rect x="46" y="168" width="22" height="23" rx="10" fill="#0d7c66" />
      <rect x="74" y="170" width="22" height="21" rx="10" fill="#0d7c66" />
      <rect x="104" y="170" width="22" height="21" rx="10" fill="#0d7c66" />
      <rect x="132" y="168" width="22" height="23" rx="10" fill="#0d7c66" />

      {/* Left ear */}
      <ellipse cx="67" cy="40" rx="14" ry="19" fill="#14A085" />
      <ellipse cx="67" cy="40" rx="9" ry="13" fill="#0d7c66" />

      {/* Right ear */}
      <ellipse cx="133" cy="40" rx="14" ry="19" fill="#14A085" />
      <ellipse cx="133" cy="40" rx="9" ry="13" fill="#0d7c66" />

      {/* Head */}
      <circle cx="100" cy="77" r="43" fill="#14A085" />

      {/* Coin slot on top of head */}
      <rect x="81" y="31" width="38" height="9" rx="4.5" fill="#0a6355" />
      <rect x="87" y="33.5" width="26" height="4" rx="2" fill="#083d33" />

      {/* Eyes */}
      <circle cx="84" cy="67" r="7" fill="white" />
      <circle cx="116" cy="67" r="7" fill="white" />
      <circle cx="86" cy="68" r="3.8" fill="#1a1a2e" />
      <circle cx="118" cy="68" r="3.8" fill="#1a1a2e" />
      <circle cx="87" cy="66.5" r="1.3" fill="white" />
      <circle cx="119" cy="66.5" r="1.3" fill="white" />

      {/* Snout */}
      <ellipse cx="100" cy="91" rx="22" ry="17" fill="#0d7c66" />
      <circle cx="92" cy="92" r="5" fill="#0a6355" />
      <circle cx="108" cy="92" r="5" fill="#0a6355" />

      {/* State 4: sparkle stars */}
      {state === 4 && (
        <>
          <g transform="translate(26,42) scale(0.9)">
            <line x1="0" y1="-9" x2="0" y2="9" stroke="#fbbf24" strokeWidth="2.5" strokeLinecap="round" />
            <line x1="-9" y1="0" x2="9" y2="0" stroke="#fbbf24" strokeWidth="2.5" strokeLinecap="round" />
            <line x1="-6" y1="-6" x2="6" y2="6" stroke="#fbbf24" strokeWidth="1.8" strokeLinecap="round" />
            <line x1="6" y1="-6" x2="-6" y2="6" stroke="#fbbf24" strokeWidth="1.8" strokeLinecap="round" />
          </g>
          <g transform="translate(174,42) scale(0.9)">
            <line x1="0" y1="-9" x2="0" y2="9" stroke="#fbbf24" strokeWidth="2.5" strokeLinecap="round" />
            <line x1="-9" y1="0" x2="9" y2="0" stroke="#fbbf24" strokeWidth="2.5" strokeLinecap="round" />
            <line x1="-6" y1="-6" x2="6" y2="6" stroke="#fbbf24" strokeWidth="1.8" strokeLinecap="round" />
            <line x1="6" y1="-6" x2="-6" y2="6" stroke="#fbbf24" strokeWidth="1.8" strokeLinecap="round" />
          </g>
          <g transform="translate(100,8) scale(1.1)">
            <line x1="0" y1="-10" x2="0" y2="10" stroke="#fbbf24" strokeWidth="2.5" strokeLinecap="round" />
            <line x1="-10" y1="0" x2="10" y2="0" stroke="#fbbf24" strokeWidth="2.5" strokeLinecap="round" />
            <line x1="-7" y1="-7" x2="7" y2="7" stroke="#fbbf24" strokeWidth="1.8" strokeLinecap="round" />
            <line x1="7" y1="-7" x2="-7" y2="7" stroke="#fbbf24" strokeWidth="1.8" strokeLinecap="round" />
          </g>
        </>
      )}
    </svg>
  );
}
