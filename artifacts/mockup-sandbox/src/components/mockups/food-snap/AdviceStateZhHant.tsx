import { Camera } from "lucide-react";
import glucoseHighImg from "@assets/glucose_high.png";

const COLORS = {
  bg: "#fdfbee",
  ink: "#214B36",
  muted: "#6E8477",
  primary: "#2F6B43",
  hairline: "#E6E1D4",
};

function Section({ icon, label, children, hairline }: { icon: string; label: string; children: React.ReactNode; hairline?: boolean }) {
  return (
    <div className="px-5 py-4" style={hairline ? { borderTop: `1px solid ${COLORS.hairline}` } : undefined}>
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-base">{icon}</span>
        <span className="text-[22px] font-bold uppercase tracking-wider" style={{ color: COLORS.muted }}>{label}</span>
      </div>
      <div className="text-[26px] leading-relaxed" style={{ color: COLORS.ink }}>{children}</div>
    </div>
  );
}

export default function AdviceStateZhHant() {
  return (
    <div className="relative w-[390px] h-[844px] overflow-hidden" style={{ backgroundColor: COLORS.bg, color: COLORS.ink, fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <div className="px-6 pt-14 pb-2 h-full overflow-hidden flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <Camera className="w-10 h-10 shrink-0" strokeWidth={1.5} style={{ color: COLORS.primary }} />
          <h1 className="text-[26px] font-bold uppercase tracking-wide" style={{ color: COLORS.ink }}>食物快拍</h1>
        </div>
        <p className="text-[13px] text-center" style={{ color: COLORS.muted }}>拍下你的餐點，獲得個人化飲食建議！</p>
        <h2 className="text-[18px] font-bold mt-1" style={{ color: COLORS.ink }}>你的飲食建議</h2>

        <div className="rounded-3xl overflow-hidden" style={{ backgroundColor: "#fff", boxShadow: "0 4px 14px rgba(44,72,56,0.06)" }}>
          <div className="px-5 pt-4 pb-2">
            <img src={glucoseHighImg} alt="血糖走勢圖" className="w-full rounded-xl" style={{ maxHeight: 100, objectFit: "contain", objectPosition: "left" }} />
          </div>
          <Section icon="💡" label="即時建議" hairline>
            加點灼菜心或蔬菜以增加纖維，有助減慢葡萄糖吸收。先吃蔬菜。
          </Section>
          <Section icon="🔄" label="下次建議" hairline>
            下次試試減少麵條份量。如果不容易，把鹼水麵換成冬粉——升糖指數相對較低，血糖不會升得那麼急。
          </Section>
        </div>
      </div>
    </div>
  );
}
