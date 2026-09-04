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
  Cookie,
  Pizza,
  Salad,
  Drumstick,
} from "lucide-react";
import { SiFacebook, SiInstagram } from "react-icons/si";
import mealTimeImg from "@assets/Untitled_design_(3)_1776590588282.png";
import eatingOutImg from "@assets/generated-image_(7)_1776594785348.png";
import prediabetesImg from "@assets/generated-image_(14)_1776598029735.png";
import diabetesImg from "@assets/generated-image_(15)_1776598029736.png";
import noButHealthImg from "@assets/generated-image_(16)_1776598029736.png";
import couchImg from "@assets/generated-image_(19)_1776605605132.png";
import walkImg from "@assets/generated-image_(20)_1776605612073.png";

const GREEN = "#0D7E8F";
const LIME = "#D7EEF0";
const LEAF = "#7cc26b";
const SOFT = "#b8e489";

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
  const restSelected = choice === "sit_rest";
  const walkSelected = choice === "walk_10" || choice === "walk_longer";
  return (
    <div className="w-full grid grid-cols-2 gap-2" style={{ height: 170 }}>
      <div
        className="overflow-hidden"
        style={{
          background: "#c5e8e9",
          borderRadius: 16,
          border: restSelected ? `2px solid ${GREEN}` : "2px solid transparent",
        }}
      >
        <img
          src={couchImg}
          alt="Person resting on a couch after a meal"
          draggable={false}
          style={{
            display: "block",
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
        />
      </div>
      <div
        className="overflow-hidden"
        style={{
          background: "#c5e8e9",
          borderRadius: 16,
          border: walkSelected ? `2px solid ${GREEN}` : "2px solid transparent",
        }}
      >
        <img
          src={walkImg}
          alt="Person walking outdoors after a meal"
          draggable={false}
          style={{
            display: "block",
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
        />
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
      <div style={{ width: 1, height: 80, background: "rgba(13,126,143,0.2)" }} />
      <div className="flex flex-col items-center">
        <Moon size={56} style={{ color: "#5b7a8a" }} />
        <span className="text-[11px] mt-1 font-semibold" style={{ color: GREEN }}>After</span>
      </div>
    </div>
  );
}

export function DinnerTableIllustration() {
  return (
    <div className="w-full" data-testid="img-meal-time">
      <img
        src={mealTimeImg}
        alt=""
        className="block w-full h-auto select-none pointer-events-none"
        draggable={false}
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
  return (
    <img
      src={eatingOutImg}
      alt="Illustration of a small storefront with a green awning and paper takeaway bags"
      draggable={false}
      className="block w-full h-auto -mx-3 rounded-t-[22px]"
      style={{ maxWidth: "none", width: "calc(100% + 24px)" }}
    />
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

export const HealthIcons: Record<string, { image?: string }> = {
  diabetes: { image: diabetesImg },
  prediabetes: { image: prediabetesImg },
  no_but_health: { image: noButHealthImg },
  prefer_not_tell: {},
};

export const SleepIcons = {
  regular_10_6: <Moon size={20} style={{ color: LIME }} />,
  other_regular: <Sunrise size={20} style={{ color: LIME }} />,
  night_shifts: <Moon size={20} style={{ color: LIME }} />,
  irregular: <Sparkles size={20} style={{ color: LIME }} />,
};
