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

export default function AdviceState() {
  return (
    <div className="relative w-[390px] h-[844px] overflow-hidden" style={{ backgroundColor: COLORS.bg, color: COLORS.ink, fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <div className="px-6 pt-7 pb-8 h-full overflow-y-auto flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <img src="/images/lightbulb-heading.png" alt="" className="w-12 h-12 shrink-0" />
          <h1 className="text-[22px] font-bold" style={{ color: COLORS.ink }}>Your diet advice</h1>
        </div>

        <div className="rounded-3xl overflow-hidden" style={{ backgroundColor: "#fff", boxShadow: "0 4px 14px rgba(44,72,56,0.06)" }}>
          <Section icon="🩸" label="Sugar Impact">
            Wonton noodle soup has a high glycaemic load.
          </Section>
          <Section icon="💡" label="Instant Advice" hairline>
            Order a side of blanched choi sum first and eat it before the noodles. Halve the soy sauce, skip the chili oil's sweet base, and leave a third of the noodles in the bowl. Sip slowly so you finish over 20 minutes — your spike will be much gentler.
          </Section>
          <Section icon="🔄" label="Next Time" hairline>
            Ask for a smaller noodle portion or swap thin egg noodles for bean thread vermicelli. Add extra greens (gai lan, choi sum) and request the wontons steamed instead of boiled in a starchy broth.
          </Section>
        </div>

        <button
          className="w-full h-12 rounded-2xl text-[14px] font-semibold text-white"
          style={{ backgroundColor: COLORS.primary }}
        >
          Done
        </button>

        <div className="self-center text-[11px] px-3 py-1 rounded-full" style={{ backgroundColor: "#EFEAD8", color: COLORS.muted }}>
          2 of 6 advice left today
        </div>

        <button className="w-full text-[13px] flex items-center justify-center gap-1" style={{ color: COLORS.muted }}>
          <RotateCw className="w-3.5 h-3.5" />
          Try a different photo
        </button>
      </div>
    </div>
  );
}
