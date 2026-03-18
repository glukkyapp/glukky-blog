import pigImage from "@assets/midjourney-editor-1773825798623_1773825809837.png";

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

const FILL_OPACITY: Record<number, number> = {
  0: 0,
  1: 0.35,
  2: 0.5,
  3: 0.65,
  4: 0.8,
};

const GOLD = "255, 199, 56";

export function PiggyBankSVG({ coins, className }: Props) {
  const state = getState(coins);
  const opacity = FILL_OPACITY[state];

  return (
    <div className={`relative ${className ?? ""}`} style={{ display: "inline-block" }}>
      <img
        src={pigImage}
        alt="piggy bank"
        className="w-full h-full object-contain"
        draggable={false}
      />

      {/* Gold coin-fill overlay — covers belly area, stops before the face on the right */}
      {state > 0 && (
        <div
          aria-hidden
          style={{
            position: "absolute",
            left: "14%",
            top: "26%",
            width: "62%",
            height: "52%",
            borderRadius: "50%",
            backgroundColor: `rgba(${GOLD}, ${opacity})`,
            pointerEvents: "none",
          }}
        />
      )}

      {/* Sparkle stars for state 4 */}
      {state === 4 && (
        <svg
          aria-hidden
          viewBox="0 0 100 100"
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            pointerEvents: "none",
            overflow: "visible",
          }}
        >
          {[
            [12, 22],
            [88, 18],
            [50, 4],
          ].map(([x, y], i) => (
            <g key={i} transform={`translate(${x},${y})`}>
              <line x1="0" y1="-7" x2="0" y2="7"  stroke="#FFC738" strokeWidth="2.5" strokeLinecap="round" />
              <line x1="-7" y1="0" x2="7" y2="0"  stroke="#FFC738" strokeWidth="2.5" strokeLinecap="round" />
              <line x1="-5" y1="-5" x2="5" y2="5" stroke="#FFC738" strokeWidth="1.8" strokeLinecap="round" />
              <line x1="5" y1="-5" x2="-5" y2="5" stroke="#FFC738" strokeWidth="1.8" strokeLinecap="round" />
            </g>
          ))}
        </svg>
      )}
    </div>
  );
}
