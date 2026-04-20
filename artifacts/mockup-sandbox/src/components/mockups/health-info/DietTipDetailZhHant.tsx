import { Home, TrendingUp, Camera, CalendarDays, Lightbulb, User, type LucideIcon } from "lucide-react";

const COLORS = {
  bg: "#fdfbee",
  ink: "#214B36",
  muted: "#6E8477",
  primary: "#2F6B43",
};

function NavBar() {
  const items: { Icon: LucideIcon; label: string; active?: boolean }[] = [
    { Icon: Home, label: "主頁" },
    { Icon: TrendingUp, label: "進度" },
    { Icon: Camera, label: "快拍" },
    { Icon: CalendarDays, label: "計劃" },
    { Icon: Lightbulb, label: "健康資訊", active: true },
    { Icon: User, label: "個人" },
  ];
  return (
    <nav
      className="absolute left-1/2 -translate-x-1/2 flex items-center px-2"
      style={{
        bottom: 16,
        width: "calc(100% - 32px)",
        maxWidth: 360,
        height: 58,
        backgroundColor: "rgba(187,222,214,0.85)",
        borderRadius: 160,
        boxShadow: "0px 4px 10px rgba(0,0,0,0.25)",
      }}
    >
      {items.map(({ Icon, label, active }) => (
        <div key={label} className="flex-1 flex flex-col items-center justify-center" style={{ color: "#0D5E4F" }}>
          <Icon size={22} strokeWidth={active ? 2.5 : 2} />
          {active && <span className="text-[10px] font-medium leading-tight mt-0.5">{label}</span>}
        </div>
      ))}
    </nav>
  );
}

function Tip({ src, label, selected }: { src: string; label: string; selected?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-2 shrink-0" style={{ width: 100 }}>
      <div
        className={`w-[100px] h-[100px] rounded-full overflow-hidden transition-all ${selected ? "scale-105" : ""}`}
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

export default function DietTipDetailZhHant() {
  return (
    <div className="relative w-[390px] h-[844px] overflow-hidden" style={{ backgroundColor: COLORS.bg, color: COLORS.ink, fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <div className="pt-6 pb-32 h-full overflow-y-auto">
        <div className="flex items-center gap-3 px-5">
          <img src={`${import.meta.env.BASE_URL}images/lightbulb-heading.png`} alt="" className="w-14 h-14 shrink-0" />
          <h1 className="text-[24px] font-bold uppercase tracking-wide" style={{ color: COLORS.ink }}>健康資訊</h1>
        </div>

        <p className="text-[13px] text-center mt-3 mb-6 px-5" style={{ color: COLORS.muted }}>
          不記得飲食建議也不用擔心——你隨時可以回來重溫。
        </p>

        <div className="px-5">
          <h2 className="text-[18px] font-bold uppercase tracking-wide mb-4" style={{ color: COLORS.ink }}>飲食建議</h2>
          <div className="flex gap-[18px] py-2 pl-1">
            <Tip src={`${import.meta.env.BASE_URL}images/tip-juice.png`} label="果汁加1:1清水稀釋" />
            <Tip src={`${import.meta.env.BASE_URL}images/tip-yogurt.png`} label="以原味乳酪加莓果取代甜品" />
            <Tip src={`${import.meta.env.BASE_URL}images/tip-steam.png`} label="先蒸後略煎" selected />
          </div>

          <div className="mt-4 px-1">
            <p className="font-bold text-[15px] mb-2" style={{ color: COLORS.ink }}>先蒸後略煎</p>
            <p className="text-[13px] leading-relaxed" style={{ color: COLORS.muted }}>
              油炸會讓食物吸滿油，升糖指數也會大幅上升。先用蒸的方式處理魚、雞肉甚至根莖類蔬菜，可以鎖住水份，讓碳水化合物對血糖更溫和。最後在乾鍋或焗爐下用 30 秒略煎或略燒，就能享受脆口的外層，但又不需要那層厚厚的油。
            </p>
          </div>
        </div>
      </div>
      <NavBar />
    </div>
  );
}
