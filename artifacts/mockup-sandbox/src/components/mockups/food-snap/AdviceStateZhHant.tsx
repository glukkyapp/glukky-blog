import { RotateCw } from "lucide-react";

const COLORS = {
  bg: "#fdfbee",
  ink: "#214B36",
  muted: "#6E8477",
  card: "#fbfbf3",
  primary: "#2F6B43",
  hairline: "#E6E1D4",
};

function Section({ icon, label, children, hairline }: { icon: string; label: string; children: React.ReactNode; hairline?: boolean }) {
  return (
    <div className="px-5 py-4" style={hairline ? { borderTop: `1px solid ${COLORS.hairline}` } : undefined}>
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-base">{icon}</span>
        <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: COLORS.muted }}>{label}</span>
      </div>
      <div className="text-[13px] leading-relaxed" style={{ color: COLORS.ink }}>{children}</div>
    </div>
  );
}

export default function AdviceStateZhHant() {
  return (
    <div className="relative w-[390px] h-[844px] overflow-hidden" style={{ backgroundColor: COLORS.bg, color: COLORS.ink, fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <div className="px-6 pt-7 pb-8 h-full overflow-y-auto flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <img src="/images/lightbulb-heading.png" alt="" className="w-12 h-12 shrink-0" />
          <h1 className="text-[22px] font-bold" style={{ color: COLORS.ink }}>你的飲食建議</h1>
        </div>

        <div className="rounded-3xl overflow-hidden" style={{ backgroundColor: "#fff", boxShadow: "0 4px 14px rgba(44,72,56,0.06)" }}>
          <Section icon="🩸" label="血糖影響">
            雲吞麵的升糖指數頗高。
          </Section>
          <Section icon="💡" label="即時建議" hairline>
            先點一碟灼菜心，並在吃麵前先吃完。醬油減半、跳過辣油的甜底醬，並在碗裡留下三分之一的麵條。慢慢喝湯，用 20 分鐘才吃完——血糖升幅會溫和得多。
          </Section>
          <Section icon="🔄" label="下次建議" hairline>
            下次點餐時要求小份麵，或將細蛋麵換成粉絲。加多綠葉菜（芥蘭、菜心），並要求雲吞蒸熟而非用澱粉湯滾煮。
          </Section>
        </div>

        <button
          className="w-full h-12 rounded-2xl text-[14px] font-semibold text-white"
          style={{ backgroundColor: COLORS.primary }}
        >
          完成
        </button>

        <div className="self-center text-[11px] px-3 py-1 rounded-full" style={{ backgroundColor: "#EFEAD8", color: COLORS.muted }}>
          今天剩餘 2 / 6 次建議
        </div>

        <button className="w-full text-[13px] flex items-center justify-center gap-1" style={{ color: COLORS.muted }}>
          <RotateCw className="w-3.5 h-3.5" />
          換一張照片
        </button>
      </div>
    </div>
  );
}
