import { UtensilsCrossed, Scale, Droplets, Cherry, RotateCw, Camera, type LucideIcon } from "lucide-react";

const COLORS = {
  bg: "#fdfbee",
  ink: "#214B36",
  muted: "#6E8477",
  card: "#fbfbf3",
  beige: "#D4C9A8",
  primary: "#2F6B43",
  orange: "#F08A3E",
};

function Pointer({ pos }: { pos: "tl" | "tr" | "bl" | "br" }) {
  const style: React.CSSProperties = {
    position: "absolute", width: 18, height: 18,
    ...(pos === "tl" && { top: -6, left: -6, borderTop: `2px solid ${COLORS.beige}`, borderLeft: `2px solid ${COLORS.beige}`, borderTopLeftRadius: 6 }),
    ...(pos === "tr" && { top: -6, right: -6, borderTop: `2px solid ${COLORS.beige}`, borderRight: `2px solid ${COLORS.beige}`, borderTopRightRadius: 6 }),
    ...(pos === "bl" && { bottom: -6, left: -6, borderBottom: `2px solid ${COLORS.beige}`, borderLeft: `2px solid ${COLORS.beige}`, borderBottomLeftRadius: 6 }),
    ...(pos === "br" && { bottom: -6, right: -6, borderBottom: `2px solid ${COLORS.beige}`, borderRight: `2px solid ${COLORS.beige}`, borderBottomRightRadius: 6 }),
  };
  return <span style={style} />;
}

function Field({ icon: Icon, label, value, alignRight }: { icon: LucideIcon; label: string; value: string; alignRight?: boolean }) {
  return (
    <div className="flex flex-col gap-1">
      <div className={`flex items-center gap-1 text-[21px] font-bold tracking-wide ${alignRight ? "justify-end" : ""}`} style={{ color: COLORS.ink }}>
        {!alignRight && <Icon className="w-4 h-4" strokeWidth={2.5} />}
        <span>{label}</span>
        {alignRight && <Icon className="w-4 h-4" strokeWidth={2.5} />}
      </div>
      <div
        className={`rounded-xl border px-3 py-2 text-[23px] leading-snug h-[3.7rem] ${alignRight ? "text-right" : ""}`}
        style={{ backgroundColor: COLORS.card, borderColor: "#e6e1d4", color: COLORS.ink }}
      >
        {value}
      </div>
    </div>
  );
}

export default function ReviewStateZhHant() {
  return (
    <div className="relative w-[390px] h-[844px] overflow-hidden" style={{ backgroundColor: COLORS.bg, color: COLORS.ink, fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <div className="px-6 pt-14 pb-2 h-full overflow-hidden flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <Camera className="w-10 h-10 shrink-0" strokeWidth={1.5} style={{ color: COLORS.primary }} />
          <h1 className="text-[36px] font-bold uppercase tracking-wide" style={{ color: COLORS.ink }}>食物快拍</h1>
        </div>
        <p className="text-[18px] text-center" style={{ color: COLORS.muted }}>拍下你的餐點，獲得個人化飲食建議！</p>
        <div>
          <p className="text-[25px] font-semibold" style={{ color: COLORS.ink }}>確認你照片中的食物</p>
          <p className="text-[17px] mt-0.5" style={{ color: COLORS.muted }}>點選任何欄位即可編輯。</p>
        </div>

        <div className="relative px-1">
          <div className="grid grid-cols-2 gap-3 mb-3">
            <Field icon={UtensilsCrossed} label="食物名稱" value="雲吞麵" />
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-1 text-[21px] font-bold tracking-wide justify-end" style={{ color: COLORS.ink }}>
                <span>份量</span>
                <Scale className="w-4 h-4" strokeWidth={2.5} />
              </div>
              <div className="flex flex-wrap gap-1.5 justify-end h-[3.5rem] items-center">
                {[
                  { k: "small", l: "細" },
                  { k: "medium", l: "中碗" },
                  { k: "large", l: "大" },
                ].map(o => {
                  const active = o.k === "medium";
                  return (
                    <span
                      key={o.k}
                      className="px-3 py-1.5 rounded-full text-[18px] font-medium border"
                      style={{
                        backgroundColor: active ? COLORS.primary : "#fff",
                        color: active ? "#fff" : COLORS.muted,
                        borderColor: active ? COLORS.primary : "#e6e1d4",
                      }}
                    >
                      {o.l}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="relative mx-4 my-4" style={{ overflow: "visible", transform: "scale(1.2)", transformOrigin: "center" }}>
            <Pointer pos="tl" /><Pointer pos="tr" /><Pointer pos="bl" /><Pointer pos="br" />
            <img src={`${import.meta.env.BASE_URL}images/wonton-noodle-soup.png`} alt="" className="w-full rounded-2xl object-cover max-h-48" />
          </div>

          <div className="grid grid-cols-2 gap-3 mt-3">
            <Field icon={Droplets} label="醬料／調味料" value="醬油、辣油" />
            <Field icon={Cherry} label="額外／配料" value="菜心" alignRight />
          </div>
        </div>

        <div className="self-center text-[16px] px-3 py-1 rounded-full" style={{ backgroundColor: "#EFEAD8", color: COLORS.muted }}>
          今天剩餘 2 / 2 次拍照分析
        </div>

        <div className="flex flex-col gap-2 pt-1">
          <button
            className="w-full h-14 rounded-2xl text-[25px] font-semibold text-white"
            style={{ backgroundColor: COLORS.orange, boxShadow: "0 4px 14px rgba(240,138,62,0.35)" }}
          >
            立即獲取飲食建議
          </button>
          <button className="w-full text-[18px] flex items-center justify-center gap-1 py-2" style={{ color: COLORS.muted }}>
            <RotateCw className="w-4 h-4" />
            換一張照片
          </button>
        </div>
      </div>
    </div>
  );
}
