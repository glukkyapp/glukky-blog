import { Lightbulb, type LucideIcon } from "lucide-react";

const COLORS = {
  bg: "#fdfbee",
  ink: "#214B36",
  muted: "#6E8477",
  primary: "#2F6B43",
};

function Tip({ src, label, selected }: { src: string; label: string; selected?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-2 shrink-0" style={{ width: 100 }}>
      <div
        className={`w-[100px] h-[100px] rounded-full overflow-hidden transition-all ${selected ? "ring-2 ring-offset-2 scale-105" : ""}`}
        style={selected ? { boxShadow: `0 0 0 2px ${COLORS.primary}, 0 0 0 4px ${COLORS.bg}` } : undefined}
      >
        <img src={src} alt={label} className="w-full h-full object-cover" />
      </div>
      <span
        className={`text-[11px] font-medium text-center leading-tight max-w-[100px] ${selected ? "" : "opacity-70"}`}
        style={{ color: selected ? COLORS.ink : COLORS.muted }}
      >
        {label}
      </span>
    </div>
  );
}

export default function DietTipDetail() {
  return (
    <div className="relative w-[390px] h-[844px] overflow-hidden" style={{ backgroundColor: COLORS.bg, color: COLORS.ink, fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <div className="pt-12 pb-24 h-full overflow-hidden">
        <div className="flex items-center gap-3 px-5">
          <img src={`${import.meta.env.BASE_URL}images/lightbulb-heading.png`} alt="" className="w-14 h-14 shrink-0" />
          <h1 className="text-[24px] font-bold uppercase tracking-wide" style={{ color: COLORS.ink }}>Health Info</h1>
        </div>

        <p className="text-[13px] text-center mt-3 mb-6 px-5" style={{ color: COLORS.muted }}>
          Don't worry if you forgot the diet tips — you can always come back here.
        </p>

        <div className="px-5">
          <h2 className="text-[18px] font-bold uppercase tracking-wide mb-4" style={{ color: COLORS.ink }}>Diet Advice</h2>
          <div className="flex gap-[18px] py-2 pl-1">
            <Tip src={`${import.meta.env.BASE_URL}images/tip-juice.png`} label="Choose sugar-free drink / Dilute juice 1:1 with water" />
            <Tip src={`${import.meta.env.BASE_URL}images/tip-yogurt.png`} label="Swap dessert for plain yogurt + berries" />
            <Tip src={`${import.meta.env.BASE_URL}images/tip-steam.png`} label="Steam your food first, then sear briefly" selected />
          </div>

          <div className="mt-4 px-1">
            <p className="font-bold text-[15px] mb-2" style={{ color: COLORS.ink }}>Steam your food first, then sear briefly</p>
            <p className="text-[13px] leading-relaxed" style={{ color: COLORS.muted }}>
              Deep-frying adds significant fat calories, which over time contributes to weight gain — a key driver of insulin resistance. <strong style={{ color: COLORS.greenDeep }}>Steaming</strong> first cooks the food through without excess oil, so only a brief <strong style={{ color: COLORS.greenDeep }}>sear</strong> is needed for texture.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
