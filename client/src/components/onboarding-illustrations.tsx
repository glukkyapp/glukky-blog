import {
  Hand,
  Users,
  Coffee,
  Footprints,
  Moon,
  Sunset,
  Sunrise,
  HeartPulse,
  Mail,
  Sparkles,
  Target,
  Activity,
  Droplet,
  ShieldCheck,
  Cookie,
  Pizza,
  Salad,
  Drumstick,
  GlassWater,
  Flame,
  Wine,
} from "lucide-react";
import { SiFacebook, SiInstagram } from "react-icons/si";

const GREEN = "#214B36";
const LIME = "#d0f38f";
const LEAF = "#7cc26b";
const SOFT = "#b8e489";
const LIME_PALE = "#eef8d6";

export function HelloIllustration() {
  return (
    <div className="relative w-full flex items-center justify-center" style={{ height: 160 }}>
      <div
        className="flex items-center justify-center"
        style={{
          width: 130,
          height: 130,
          borderRadius: 999,
          background: LIME,
        }}
      >
        <svg viewBox="0 0 120 120" width="100" height="100">
          <circle cx="60" cy="48" r="22" fill="#f4d3b6" />
          <path d="M40 50 Q40 30 60 30 Q80 30 80 50 L78 42 Q70 36 60 36 Q50 36 42 42 Z" fill={GREEN} />
          <path d="M30 110 Q30 78 60 78 Q90 78 90 110 Z" fill={LEAF} />
          <circle cx="53" cy="50" r="2.2" fill={GREEN} />
          <circle cx="67" cy="50" r="2.2" fill={GREEN} />
          <path d="M52 60 Q60 66 68 60" stroke={GREEN} strokeWidth="2" fill="none" strokeLinecap="round" />
        </svg>
      </div>
      <Hand className="absolute" style={{ color: GREEN, right: 60, top: 18 }} size={28} />
    </div>
  );
}

export function WelcomeIllustration() {
  return (
    <div className="w-full flex items-center justify-center" style={{ height: 180 }}>
      <div className="grid grid-cols-3 gap-2">
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className={`flex flex-col items-center justify-end ${i === 3 ? "col-start-1" : ""} ${i === 4 ? "col-start-3" : ""}`}
            style={{
              width: 56,
              height: 76,
              borderRadius: 12,
              background: i % 2 === 0 ? LIME : SOFT,
              padding: 6,
            }}
          >
            <div
              style={{
                width: 22,
                height: 22,
                borderRadius: 999,
                background: "#f4d3b6",
                marginBottom: 4,
              }}
            />
            <div
              style={{
                width: 36,
                height: 26,
                borderRadius: 6,
                background: GREEN,
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export function PostMealIllustration({ choice }: { choice?: string }) {
  return (
    <div className="w-full grid grid-cols-2 gap-2" style={{ height: 170 }}>
      <div
        className="flex flex-col items-center justify-end p-2"
        style={{
          background: choice === "sit_rest" ? LIME : "#e9f5d4",
          borderRadius: 16,
          border: choice === "sit_rest" ? `2px solid ${GREEN}` : "none",
        }}
      >
        <Coffee className="mb-1" style={{ color: GREEN }} size={36} />
        <div
          className="w-full"
          style={{ height: 28, background: GREEN, borderRadius: 8 }}
        />
        <span className="text-[11px] font-semibold mt-1" style={{ color: GREEN }}>Rest</span>
      </div>
      <div
        className="flex flex-col items-center justify-end p-2"
        style={{
          background: (choice === "walk_10" || choice === "walk_longer") ? LIME : "#e9f5d4",
          borderRadius: 16,
          border: (choice === "walk_10" || choice === "walk_longer") ? `2px solid ${GREEN}` : "none",
        }}
      >
        <Footprints className="mb-1" style={{ color: GREEN }} size={36} />
        <span className="text-[11px] font-semibold" style={{ color: GREEN }}>Walk</span>
      </div>
    </div>
  );
}

export function DinnerIllustration() {
  return (
    <div className="w-full flex items-center justify-center gap-4" style={{ height: 160 }}>
      <div className="flex flex-col items-center">
        <Sunset size={56} style={{ color: "#e0a458" }} />
        <span className="text-[11px] mt-1 font-semibold" style={{ color: GREEN }}>Before</span>
      </div>
      <div style={{ width: 1, height: 80, background: "rgba(33,75,54,0.2)" }} />
      <div className="flex flex-col items-center">
        <Moon size={56} style={{ color: "#5b7a8a" }} />
        <span className="text-[11px] mt-1 font-semibold" style={{ color: GREEN }}>After</span>
      </div>
    </div>
  );
}

export function DinnerTableIllustration() {
  return (
    <div className="w-full flex flex-col items-center" style={{ height: 110 }}>
      <div className="flex items-end gap-1.5 mb-1" style={{ marginBottom: -2 }}>
        <Flame size={14} style={{ color: "#d97757" }} />
        <Flame size={18} style={{ color: "#d97757" }} />
        <Flame size={14} style={{ color: "#d97757" }} />
      </div>
      <div className="w-full flex items-center justify-center gap-4 mt-1">
        <Wine size={30} style={{ color: GREEN }} />
        <div
          className="rounded-full flex items-center justify-center"
          style={{ width: 60, height: 60, background: "#fff", border: `2.5px solid ${GREEN}` }}
        >
          <div
            className="rounded-full"
            style={{ width: 36, height: 36, background: LIME_PALE }}
          />
        </div>
        <Wine size={30} style={{ color: GREEN }} />
      </div>
      <div
        className="w-full"
        style={{ height: 10, background: GREEN, marginTop: 4, borderRadius: 4 }}
      />
    </div>
  );
}

export function SleepIllustration() {
  return (
    <div className="flex items-center justify-center gap-2" style={{ height: 60 }}>
      <Moon size={36} style={{ color: LIME }} />
      <Sparkles size={20} style={{ color: LIME }} />
    </div>
  );
}

export function EatingOutIllustration() {
  const days = ["M", "T", "W", "T", "F", "S", "S"];
  const highlighted = new Set([1, 4]);
  return (
    <div className="w-full flex flex-col items-center justify-center gap-2" style={{ height: 170 }}>
      <div
        className="px-3 py-2"
        style={{
          background: "#fff",
          borderRadius: 14,
          border: `1.5px solid ${GREEN}`,
          minWidth: 220,
        }}
      >
        <div
          className="text-center text-[10px] font-bold uppercase mb-1"
          style={{ color: GREEN }}
        >
          This week
        </div>
        <div className="flex items-center justify-between gap-1">
          {days.map((d, i) => (
            <div
              key={i}
              className="flex flex-col items-center justify-center"
              style={{
                width: 24,
                height: 28,
                borderRadius: 6,
                background: highlighted.has(i) ? LIME : "transparent",
                color: GREEN,
                fontSize: 10,
                fontWeight: 700,
                border: highlighted.has(i) ? `1px solid ${GREEN}` : "1px solid rgba(33,75,54,0.15)",
              }}
            >
              {d}
            </div>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-1 text-[11px] font-semibold" style={{ color: GREEN }}>
        <Sparkles size={14} /> pick your usual frequency
      </div>
    </div>
  );
}

export function StrugglesIllustration() {
  return (
    <div className="w-full flex items-center justify-center gap-3" style={{ height: 90 }}>
      <Salad size={32} style={{ color: GREEN }} />
      <Pizza size={32} style={{ color: "#c97c4a" }} />
      <Cookie size={32} style={{ color: "#a06a3b" }} />
      <Drumstick size={32} style={{ color: "#b56a4a" }} />
    </div>
  );
}

export function HealthIllustration() {
  return (
    <div className="w-full flex items-center justify-center gap-2" style={{ height: 90 }}>
      <HeartPulse size={48} style={{ color: GREEN }} />
      <Activity size={40} style={{ color: LEAF }} />
    </div>
  );
}

export function ReferralIllustration() {
  return (
    <div className="w-full flex items-center justify-center gap-3" style={{ height: 100 }}>
      <div
        className="flex items-center justify-center"
        style={{ width: 56, height: 56, borderRadius: 14, background: "#fff", border: `2px solid ${GREEN}` }}
      >
        <SiFacebook size={28} color="#1877F2" />
      </div>
      <div
        className="flex items-center justify-center"
        style={{ width: 56, height: 56, borderRadius: 14, background: "#fff", border: `2px solid ${GREEN}` }}
      >
        <SiInstagram size={28} color="#E4405F" />
      </div>
      <div
        className="flex items-center justify-center"
        style={{ width: 56, height: 56, borderRadius: 14, background: "#fff", border: `2px solid ${GREEN}` }}
      >
        <Users size={28} style={{ color: GREEN }} />
      </div>
    </div>
  );
}

export function EmailIllustration() {
  return (
    <div className="w-full flex items-center justify-center" style={{ height: 130 }}>
      <div
        className="flex items-center justify-center"
        style={{ width: 110, height: 110, borderRadius: 999, background: LIME }}
      >
        <Mail size={56} style={{ color: GREEN }} />
      </div>
    </div>
  );
}

export function GoalIllustration() {
  return (
    <div className="w-full flex items-center justify-center" style={{ height: 130 }}>
      <div
        className="flex items-center justify-center"
        style={{ width: 110, height: 110, borderRadius: 999, background: LIME }}
      >
        <Target size={56} style={{ color: GREEN }} />
      </div>
    </div>
  );
}

export function TransitionIllustration() {
  return (
    <div className="w-full flex items-center justify-center" style={{ height: 130 }}>
      <div
        className="flex items-center justify-center"
        style={{ width: 110, height: 110, borderRadius: 999, background: LIME }}
      >
        <Sparkles size={56} style={{ color: GREEN }} />
      </div>
    </div>
  );
}

export const StruggleIcons = {
  sugary_food_drink: <GlassWater size={20} style={{ color: "#5b9b5b" }} />,
  oily_fried_food: <Drumstick size={20} style={{ color: "#c97c4a" }} />,
  eat_out: <Pizza size={20} style={{ color: "#c97c4a" }} />,
  portions: <Salad size={20} style={{ color: GREEN }} />,
  snacks: <Cookie size={20} style={{ color: "#a06a3b" }} />,
};

export const HealthIcons = {
  diabetes: <Droplet size={22} style={{ color: GREEN }} />,
  prediabetes: <Activity size={22} style={{ color: GREEN }} />,
  no_but_health: <HeartPulse size={22} style={{ color: GREEN }} />,
  prefer_not_tell: <ShieldCheck size={22} style={{ color: GREEN }} />,
};

export const SleepIcons = {
  regular_10_6: <Moon size={20} style={{ color: LIME }} />,
  other_regular: <Sunrise size={20} style={{ color: LIME }} />,
  night_shifts: <Moon size={20} style={{ color: LIME }} />,
  irregular: <Sparkles size={20} style={{ color: LIME }} />,
};
