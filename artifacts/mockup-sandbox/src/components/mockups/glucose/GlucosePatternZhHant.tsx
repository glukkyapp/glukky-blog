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

function CountPill({
  label,
  count,
  selected = false,
}: {
  label: string;
  count: number;
  selected?: boolean;
}) {
  return (
    <div
      className="flex min-w-0 flex-1 items-center justify-center gap-1 rounded-[14px] border px-1 py-2.5 text-center text-[18px] font-semibold leading-tight"
      style={{
        color: selected ? COLORS.high : COLORS.muted,
        borderColor: selected ? COLORS.highBorder : "#D8DED7",
        backgroundColor: selected ? "#FFE5E2" : "rgba(255,253,247,.72)",
      }}
    >
      <span
        className="h-2 w-2 shrink-0 rounded-full"
        style={{ backgroundColor: selected ? COLORS.high : "#7B8882" }}
      />
      <span className="whitespace-nowrap">{label} {count}</span>
    </div>
  );
}

export default function GlucosePatternZhHant() {
  return (
    <main
      className="relative h-[2350px] w-[780px] overflow-hidden"
      style={{
        backgroundColor: COLORS.background,
        color: COLORS.ink,
        fontFamily: '"Noto Sans TC", "PingFang TC", "Microsoft JhengHei", system-ui, sans-serif',
      }}
      aria-label="繁體中文血糖影響畫面"
    >
      <div className="px-10 pb-10 pt-[85px]">
        <header>
          <h1
            className="text-[60px] font-semibold leading-tight tracking-[-0.02em]"
            style={{ fontFamily: '"PingFang TC", "Noto Sans TC", "Microsoft JhengHei", sans-serif', color: "#000000" }}
          >
            血糖規律
          </h1>
          <p className="mt-2 text-[38px] font-normal" style={{ color: "#000000" }}>
            查看你已記錄的餐後血糖結果。
          </p>
        </header>

        <section className="mt-7 flex items-center">
          <img
            src={harGowMascot}
            alt=""
            aria-hidden="true"
            className="z-10 h-[150px] w-[150px] shrink-0 object-contain"
          />
          <div
            className="relative -ml-2 flex min-h-[112px] flex-1 items-center rounded-[32px] border px-4 py-5 text-[41px] font-bold leading-[1.2]"
            style={{
              backgroundColor: COLORS.card,
              borderColor: "#D8DED7",
              boxShadow: "0 10px 24px rgba(44,72,56,.08)",
            }}
          >
            <span
              className="absolute -left-3 h-6 w-6 rotate-45 border-b border-l bg-[#FFFDF7]"
              style={{ borderColor: "#D8DED7" }}
            />
            <span className="relative">「讓我看看你的食物配搭！」</span>
          </div>
        </section>

        <div
          className="mt-7 flex items-center justify-center gap-3 rounded-[30px] py-6 text-[41px] font-bold text-white"
          style={{ backgroundColor: COLORS.teal, boxShadow: "0 7px 18px rgba(22,143,149,.18)" }}
        >
          <Activity className="h-8 w-8" strokeWidth={2.5} />
          已記錄血糖的食物
        </div>

        <div className="mt-5 flex gap-4">
          <CountPill label="較低影響" count={1} />
          <CountPill label="沒有明顯差異" count={0} />
          <CountPill label="較高影響" count={1} selected />
        </div>

        <div className="mt-7 flex items-end justify-between">
          <h2 className="text-[48px] font-bold">你的實際記錄</h2>
          <p className="text-[35px] font-medium" style={{ color: COLORS.muted }}>1 款食物</p>
        </div>

        <article
          className="relative mt-4 overflow-hidden rounded-[42px] border p-8"
          style={{
            backgroundColor: COLORS.highSoft,
            borderColor: COLORS.highBorder,
            boxShadow: "0 10px 28px rgba(86,62,44,.08)",
          }}
        >
          <div className="absolute inset-y-0 left-0 w-1.5" style={{ backgroundColor: "#F36C62" }} />

          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-[63px] font-extrabold leading-none">白飯</h3>
              <p className="mt-4 flex items-center gap-2 text-[36px] font-bold" style={{ color: COLORS.teal }}>
                <Activity className="h-7 w-7" strokeWidth={2.5} />
                實測餐後血糖規律
              </p>
            </div>
            <span
                className="whitespace-nowrap rounded-full border px-6 py-3 text-[33px] font-bold"
              style={{ color: COLORS.high, borderColor: COLORS.highBorder, backgroundColor: "#FFE0DE" }}
            >
              較高影響
            </span>
          </div>

          <p className="mt-6 text-[38px] font-medium leading-8" style={{ color: COLORS.muted }}>
            這款食物的餐後血糖與平常比較高
          </p>
          <p className="mt-2 text-[38px] font-semibold">25 餐中有 19 次偏高</p>

          <section
            className="mt-6 rounded-[30px] p-6"
            style={{ backgroundColor: COLORS.inset }}
          >
            <p className="flex items-center gap-3 text-[36px] font-bold" style={{ color: COLORS.teal }}>
              <ClipboardCheck className="h-7 w-7" strokeWidth={2.4} />
              食物配搭規律
            </p>
            <p className="mt-4 text-[36px] leading-[1.75]" style={{ color: COLORS.ink }}>
              吃白飯時，配
              <strong className="mx-2 text-[51px] font-extrabold leading-none">燒肉</strong>
              的平均餐後血糖讀數較高；配
              <strong className="mx-2 text-[51px] font-extrabold leading-none">雞肉</strong>
              的較低。
            </p>
            <div className="my-5 h-px bg-[#D8E0DA]" />
            <p className="text-[29px] leading-[1.55]" style={{ color: COLORS.muted }}>
              這只是你記錄中的模式，不能證明是其中一種食物造成差異。份量、其他食物、活動和測量時間也會影響讀數。
            </p>
          </section>
        </article>
      </div>
    </main>
  );
}