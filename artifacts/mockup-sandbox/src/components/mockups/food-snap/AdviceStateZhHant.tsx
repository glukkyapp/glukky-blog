import { AlertTriangle, Star } from "lucide-react";
import "../glucose/_zh-hant.css";
import "./_mascot.css";
import harGowMascot from "../../../../../../attached_assets/hargawmascot_1789835862050.png";

const COLORS = {
  bg: "#FCFBF4",
  ink: "#173F35",
  muted: "#71817A",
  teal: "#158F91",
  mint: "#E4F3EE",
  orange: "#FF6B00",
  border: "#D9E5DE",
};

function ScannerCorner({ position }: { position: "tl" | "tr" | "bl" | "br" }) {
  const style: React.CSSProperties = {
    position: "absolute",
    width: 22,
    height: 22,
    ...(position === "tl" && { top: 14, left: 14, borderTop: "3px solid #F3A12B", borderLeft: "3px solid #F3A12B", borderTopLeftRadius: 4 }),
    ...(position === "tr" && { top: 14, right: 14, borderTop: "3px solid #F3A12B", borderRight: "3px solid #F3A12B", borderTopRightRadius: 4 }),
    ...(position === "bl" && { bottom: 14, left: 14, borderBottom: "3px solid #F3A12B", borderLeft: "3px solid #F3A12B", borderBottomLeftRadius: 4 }),
    ...(position === "br" && { bottom: 14, right: 14, borderBottom: "3px solid #F3A12B", borderRight: "3px solid #F3A12B", borderBottomRightRadius: 4 }),
  };

  return <span aria-hidden="true" style={style} />;
}

function ScanFrame() {
  return (
    <>
      <ScannerCorner position="tl" />
      <ScannerCorner position="tr" />
      <ScannerCorner position="bl" />
      <ScannerCorner position="br" />
      <span
        aria-hidden="true"
        className="absolute left-4 right-4 top-1/2 h-[3px] -translate-y-1/2 rounded-full"
        style={{ backgroundColor: "rgba(48, 175, 130, .78)" }}
      />
    </>
  );
}

export default function AdviceStateZhHant() {
  return (
    <div
      className="relative h-[844px] w-[390px] overflow-hidden"
      style={{
        backgroundColor: COLORS.bg,
        color: COLORS.ink,
        fontFamily: '"PingFang TC", "Noto Sans TC", "Microsoft JhengHei", system-ui, sans-serif',
        fontWeight: 400,
      }}
    >
      <div className="h-full overflow-hidden px-6 pb-5 pt-[40px]">
        <header className="flex items-center justify-between border-b pb-4" style={{ borderColor: "#E9E8DD" }}>
          <h1 className="text-[24px] font-semibold tracking-wide" style={{ color: "#000000" }}>食物快拍</h1>
          <span className="rounded-full px-4 py-2 text-[14px] font-normal" style={{ backgroundColor: "#DDF2E9", color: COLORS.teal }}>
            • 簡易指引
          </span>
        </header>

        <section className="mascot-speech-bubble mt-4">
          <img
            className="mascot-speech-bubble__mascot"
            src={harGowMascot}
            alt=""
            aria-hidden="true"
          />
          <p className="mascot-speech-bubble__message">睇落好惹味！幫你睇下健康嗎？</p>
        </section>

        <div className="relative mt-4 h-[276px] overflow-hidden rounded-[24px]">
          <img
            src={`${import.meta.env.BASE_URL}images/wonton-noodle-soup.png`}
            alt="雲吞麵"
            className="h-full w-full object-cover"
          />
          <ScanFrame />
          <span className="absolute bottom-4 left-4 rounded-xl px-4 py-2 text-[16px] font-normal" style={{ backgroundColor: "rgba(23,63,53,.9)", color: "#fff" }}>
            • 雲吞麵
          </span>
        </div>

        <section className="mt-4 flex items-center gap-3 rounded-[22px] border bg-white px-5 py-4" style={{ borderColor: COLORS.border }}>
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl" style={{ backgroundColor: "#FFF1C7", color: COLORS.orange }}>
            <AlertTriangle className="h-6 w-6" strokeWidth={2.4} />
          </span>
          <div>
            <p className="text-[14px] font-normal" style={{ color: COLORS.muted }}>餐點分析結果</p>
            <p className="text-[24px] font-normal leading-tight" style={{ color: COLORS.ink }}>
              升糖指數：<span style={{ color: COLORS.orange }}>偏高</span>
            </p>
          </div>
        </section>

        <section className="mt-4 rounded-[22px] border px-5 py-4" style={{ backgroundColor: COLORS.mint, borderColor: "#B8DED1" }}>
          <div className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-[14px] font-normal" style={{ backgroundColor: "#D4EEE3", color: COLORS.teal }}>
            <Star className="h-4 w-4 fill-current" strokeWidth={1.5} />
            簡單替代
          </div>
          <p className="mt-3 text-[22px] font-normal leading-[1.35]" style={{ color: COLORS.ink }}>
            現在：先吃<strong className="font-bold">菜</strong>，後吃麵。
          </p>
          <p className="mt-1 text-[22px] font-normal leading-[1.35]" style={{ color: COLORS.ink }}>
            下次：試試將鹼水麵換成<strong className="font-bold">冬粉</strong>！
          </p>
        </section>

        <button type="button" className="mt-4 h-14 w-full rounded-[18px] text-[22px] font-normal text-white" style={{ backgroundColor: COLORS.orange }}>
          即看簡易飲食貼士
        </button>
      </div>
    </div>
  );
}