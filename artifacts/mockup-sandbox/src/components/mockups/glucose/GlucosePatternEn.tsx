import { Activity, ClipboardCheck } from "lucide-react";
import harGowMascot from "../../../../../../attached_assets/hargawmascot_1789835862050.png";
import "./_zh-hant.css";

const COLORS = {
  background: "#FCFBF4",
  ink: "#163F35",
  muted: "#667C73",
  teal: "#168F95",
  high: "#B54343",
  highSoft: "#FFF4F3",
  highBorder: "#F1B8B4",
  card: "#FFFDF7",
  inset: "#F4F7F2",
};

function CountPill({ label, count, selected = false }: { label: string; count: number; selected?: boolean }) {
  return (
    <div
      className="flex min-w-0 flex-1 items-center justify-center gap-1 rounded-[14px] border px-1 py-2.5 text-center text-[12px] font-semibold leading-tight"
      style={{
        color: selected ? COLORS.high : COLORS.muted,
        borderColor: selected ? COLORS.highBorder : "#D8DED7",
        backgroundColor: selected ? "#FFE5E2" : "rgba(255,253,247,.72)",
      }}
    >
      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: selected ? COLORS.high : "#7B8882" }} />
      <span className="whitespace-nowrap">{label} {count}</span>
    </div>
  );
}

export default function GlucosePatternEn() {
  return (
    <main
      className="relative h-[2350px] w-[780px] overflow-hidden"
      style={{
        backgroundColor: COLORS.background,
        color: COLORS.ink,
        fontFamily: '"Noto Sans TC", "PingFang TC", "Microsoft JhengHei", system-ui, sans-serif',
      }}
      aria-label="English glucose impact screen"
    >
      <div className="px-10 pb-10 pt-[70px]">
        <header>
          <h1 className="text-[52px] font-extrabold leading-tight tracking-[-0.02em]">Glucose Patterns</h1>
          <p className="mt-2 text-[25px] font-medium" style={{ color: COLORS.muted }}>
            See your recorded post-meal glucose results.
          </p>
        </header>

        <section className="mt-7 flex items-center">
          <img src={harGowMascot} alt="" aria-hidden="true" className="z-10 h-[150px] w-[150px] shrink-0 object-contain" />
          <div
            className="relative -ml-2 flex min-h-[112px] flex-1 items-center rounded-[32px] border px-8 py-5 text-[27px] font-bold leading-8"
            style={{ backgroundColor: COLORS.card, borderColor: "#D8DED7", boxShadow: "0 10px 24px rgba(44,72,56,.08)" }}
          >
            <span className="absolute -left-3 h-6 w-6 rotate-45 border-b border-l bg-[#FFFDF7]" style={{ borderColor: "#D8DED7" }} />
            <span className="relative">“Let me take a look at your food pairings!”</span>
          </div>
        </section>

        <div
          className="mt-7 flex items-center justify-center gap-3 rounded-[30px] py-6 text-[27px] font-bold text-white"
          style={{ backgroundColor: COLORS.teal, boxShadow: "0 7px 18px rgba(22,143,149,.18)" }}
        >
          <Activity className="h-8 w-8" strokeWidth={2.5} />
          Foods with recorded glucose
        </div>

        <div className="mt-5 flex gap-4">
          <CountPill label="Lower impact" count={1} />
          <CountPill label="No clear difference" count={0} />
          <CountPill label="Higher impact" count={1} selected />
        </div>

        <div className="mt-7 flex items-end justify-between">
          <h2 className="text-[32px] font-bold">Your actual records</h2>
          <p className="text-[23px] font-medium" style={{ color: COLORS.muted }}>1 food</p>
        </div>

        <article
          className="relative mt-4 overflow-hidden rounded-[42px] border p-8"
          style={{ backgroundColor: COLORS.highSoft, borderColor: COLORS.highBorder, boxShadow: "0 10px 28px rgba(86,62,44,.08)" }}
        >
          <div className="absolute inset-y-0 left-0 w-1.5" style={{ backgroundColor: "#F36C62" }} />
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-[42px] font-extrabold leading-none">White rice</h3>
              <p className="mt-4 flex items-center gap-2 text-[24px] font-bold" style={{ color: COLORS.teal }}>
                <Activity className="h-7 w-7" strokeWidth={2.5} />
                Measured post-meal glucose pattern
              </p>
            </div>
            <span className="whitespace-nowrap rounded-full border px-6 py-3 text-[22px] font-bold" style={{ color: COLORS.high, borderColor: COLORS.highBorder, backgroundColor: "#FFE0DE" }}>
              Higher impact
            </span>
          </div>
          <p className="mt-6 text-[25px] font-medium leading-8" style={{ color: COLORS.muted }}>
            This food&apos;s post-meal glucose was higher than usual
          </p>
          <p className="mt-2 text-[25px] font-semibold">19 of 25 meals were high</p>
          <section className="mt-6 rounded-[30px] p-6" style={{ backgroundColor: COLORS.inset }}>
            <p className="flex items-center gap-3 text-[24px] font-bold" style={{ color: COLORS.teal }}>
              <ClipboardCheck className="h-7 w-7" strokeWidth={2.4} />
              Food pairing pattern
            </p>
            <p className="mt-4 text-[24px] leading-[1.75]" style={{ color: COLORS.ink }}>
              When eating white rice, average post-meal glucose readings were higher with
              <strong className="mx-2 text-[34px] font-extrabold leading-none">BBQ pork</strong>
              ; lower with
              <strong className="mx-2 text-[34px] font-extrabold leading-none">chicken</strong>
              .
            </p>
            <div className="my-5 h-px bg-[#D8E0DA]" />
            <p className="text-[19px] leading-[1.55]" style={{ color: COLORS.muted }}>
              This is a pattern in your records and cannot prove that one particular food caused the difference. Portion size, other foods, activity, and measurement timing also affect readings.
            </p>
          </section>
        </article>
      </div>
    </main>
  );
}