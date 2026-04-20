import { Home, TrendingUp, Camera, CalendarDays, Lightbulb, User, type LucideIcon } from "lucide-react";

const COLORS = {
  bg: "#fdfbee",
  ink: "#214B36",
  muted: "#6E8477",
  primary: "#2F6B43",
};

function NavBar() {
  const items: { Icon: LucideIcon; label: string; active?: boolean }[] = [
    { Icon: Home, label: "Home" },
    { Icon: TrendingUp, label: "Roadmap" },
    { Icon: Camera, label: "Snap" },
    { Icon: CalendarDays, label: "Plan" },
    { Icon: Lightbulb, label: "Health Info", active: true },
    { Icon: User, label: "Profile" },
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
      <div className="pt-6 pb-32 h-full overflow-y-auto">
        <div className="flex items-center gap-3 px-5">
          <img src="/images/lightbulb-heading.png" alt="" className="w-14 h-14 shrink-0" />
          <h1 className="text-[24px] font-bold uppercase tracking-wide" style={{ color: COLORS.ink }}>Health Info</h1>
        </div>

        <p className="text-[13px] text-center mt-3 mb-6 px-5" style={{ color: COLORS.muted }}>
          Don't worry if you forgot the diet tips — you can always come back here.
        </p>

        <div className="px-5">
          <h2 className="text-[18px] font-bold uppercase tracking-wide mb-4" style={{ color: COLORS.ink }}>Diet Advice</h2>
          <div className="flex gap-[18px] py-2 pl-1">
            <Tip src="/images/tip-juice.png" label="Dilute juice 1:1 with water" />
            <Tip src="/images/tip-yogurt.png" label="Swap dessert for yogurt + berries" />
            <Tip src="/images/tip-steam.png" label="Steam your food first, then sear briefly" selected />
          </div>

          <div className="mt-4 px-1">
            <p className="font-bold text-[15px] mb-2" style={{ color: COLORS.ink }}>Steam your food first, then sear briefly</p>
            <p className="text-[13px] leading-relaxed" style={{ color: COLORS.muted }}>
              Deep-frying coats your food in oil and pushes the glycaemic load higher. By steaming first — fish, chicken, even root vegetables — you lock in moisture and keep the carbs gentle on your blood sugar. Finish with a 30-second sear in a dry pan or under the grill for that crispy edge, without the oil.
            </p>
          </div>
        </div>
      </div>
      <NavBar />
    </div>
  );
}
