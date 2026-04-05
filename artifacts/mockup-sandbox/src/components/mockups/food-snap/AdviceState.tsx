import "./_group.css";
import { Button } from "@/components/ui/button";
import { ChevronRight, RotateCcw } from "lucide-react";

const PANELS = [
  "🩸 Wonton noodle soup has a high glycaemic load — the alkaline noodles convert to glucose quickly.",
  "💡 Order a side of blanched choi sum or vegetables to add fibre, which slows glucose absorption. Use only half the soy sauce packet to reduce sodium intake — high sodium can raise blood pressure, a concern that compounds with blood sugar spikes.",
  "🔄 Try reducing the portion of noodles next time. If that's tricky, swap the alkaline noodles for thin rice vermicelli — they have a lower glycaemic index and won't spike your blood sugar as sharply.",
];

export function AdviceState() {
  return (
    <div
      style={{
        width: 390,
        minHeight: 844,
        backgroundColor: "hsl(23 36% 93%)",
        fontFamily: "'Karla', 'Inter', sans-serif",
        color: "hsl(168 30% 12%)",
        overflow: "hidden",
      }}
    >
      <div className="flex flex-col px-5 gap-5 w-full pb-28">
        <div
          className="relative w-full overflow-hidden mb-[-5px] -mx-5 rounded-b-3xl"
          style={{ width: "calc(100% + 2.5rem)" }}
        >
          <img
            src="/__mockup/images/phone-food-hero.png"
            alt=""
            className="w-full h-auto block"
          />
        </div>

        <p
          className="text-center"
          style={{ fontSize: 14, color: "hsl(168 10% 45%)" }}
        >
          Take a photo of your meal for personalised diet advice.
        </p>

        <div className="flex flex-col gap-4">
          <p style={{ fontSize: 14, fontWeight: 600 }}>Your diet advice</p>

          <div
            className="flex flex-col gap-5"
            style={{
              borderRadius: 16,
              border: "1px solid hsl(160 15% 85%)",
              backgroundColor: "white",
              padding: 20,
            }}
          >
            <p
              className="text-center"
              style={{
                fontSize: 14,
                lineHeight: 1.6,
                minHeight: 64,
              }}
            >
              {PANELS[0]}
            </p>

            <div className="flex items-center justify-center gap-2">
              {PANELS.map((_, i) => (
                <span
                  key={i}
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    backgroundColor:
                      i === 0 ? "#127843" : "hsl(168 10% 45% / 0.3)",
                    display: "inline-block",
                  }}
                />
              ))}
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  backgroundColor: "hsl(168 10% 45% / 0.3)",
                  display: "inline-block",
                }}
              />
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1 gap-1"
                style={{ fontSize: 14 }}
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </Button>
              <Button
                className="flex-1"
                style={{
                  backgroundColor: "#127843",
                  color: "white",
                  fontSize: 14,
                }}
              >
                Done
              </Button>
            </div>
          </div>

          <div className="flex justify-center">
            <span
              style={{
                fontSize: 11,
                color: "hsl(168 10% 45%)",
                backgroundColor: "hsl(150 15% 92%)",
                borderRadius: 999,
                padding: "4px 12px",
                fontWeight: 500,
              }}
            >
              4 of 6 advice uses left today
            </span>
          </div>

          <Button
            variant="ghost"
            className="w-full gap-1.5"
            style={{ color: "hsl(168 10% 45%)", fontSize: 14 }}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Try a different photo
          </Button>
        </div>
      </div>
    </div>
  );
}
