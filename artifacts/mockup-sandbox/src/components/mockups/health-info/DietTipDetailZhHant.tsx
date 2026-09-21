import { Lightbulb, type LucideIcon } from "lucide-react";
import "../glucose/_zh-hant.css";

const COLORS = {
  bg: "#FCFBF4",
  ink: "#214B36",
  muted: "#6E8477",
  primary: "#2F6B43",
};

function Tip({ src, label, selected }: { src: string; label: string; selected?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-4 shrink-0" style={{ width: 200 }}>
      <div
        className={`w-[200px] h-[200px] rounded-full overflow-hidden transition-all ${selected ? "scale-105" : ""}`}
        style={selected ? { boxShadow: `0 0 0 2px ${COLORS.primary}, 0 0 0 4px ${COLORS.bg}` } : undefined}
      >
        <img src={src} alt={label} className="w-full h-full object-cover" />
      </div>
      <span
        className={`text-[44px] font-medium text-center leading-tight max-w-[200px] ${selected ? "" : "opacity-70"}`}
        style={{ color: selected ? COLORS.ink : COLORS.muted }}
      >
        {label}
      </span>
    </div>
  );
}

export default function DietTipDetailZhHant() {
  return (
    <div className="relative w-[780px] h-[2350px] overflow-hidden" style={{ backgroundColor: COLORS.bg, color: COLORS.ink, fontFamily: '"Noto Sans TC", "PingFang TC", "Microsoft JhengHei", system-ui, sans-serif' }}>
      <div className="pt-[80px] pb-24 h-full overflow-hidden">
        <div className="px-10">
          <h1
            className="text-[60px] font-semibold uppercase tracking-wide"
            style={{
              fontFamily: '"PingFang TC", "Noto Sans TC", "Microsoft JhengHei", sans-serif',
              color: "#000000",
            }}
          >
            健康資訊
          </h1>
        </div>

        <p className="text-[38px] font-normal text-left mt-3 mb-10 px-10" style={{ color: "#000000" }}>
          不記得飲食建議也不用擔心——你隨時可以回來重溫。
        </p>

        <div className="px-10">
          <h2 className="text-[59px] font-bold uppercase tracking-wide mb-2" style={{ color: COLORS.ink }}>飲食建議</h2>
          <div className="flex gap-5 py-0 pl-2">
            <Tip src={`${import.meta.env.BASE_URL}images/tip-juice.png`} label="選擇無糖飲品/果汁加1:1清水稀釋" />
            <Tip src={`${import.meta.env.BASE_URL}images/tip-yogurt.png`} label="以無糖乳酪加漿果代替甜品" />
            <Tip src={`${import.meta.env.BASE_URL}images/tip-steam.png`} label="先蒸後略煎" selected />
          </div>

          <div className="mt-6 px-2">
        <p className="font-bold text-[75px] mb-4" style={{ color: COLORS.ink }}>先蒸後略煎</p>
            <p className="text-[48px] leading-relaxed" style={{ color: COLORS.muted }}>
              油炸食物含大量脂肪熱量，長期下來會導致體重增加——這是胰島素失效的主要成因。先<strong style={{ color: COLORS.greenDeep }}>蒸</strong>熟食物，之後只需短暫<strong style={{ color: COLORS.greenDeep }}>煎</strong>香，無需大量用油。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
