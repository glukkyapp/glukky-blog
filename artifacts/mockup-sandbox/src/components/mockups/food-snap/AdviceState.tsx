import "./_group.css";
import { Button } from "@/components/ui/button";
import { RotateCcw } from "lucide-react";

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
            className="flex flex-col gap-4"
            style={{
              borderRadius: 16,
              border: "1px solid hsl(160 15% 85%)",
              backgroundColor: "white",
              padding: 20,
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: "#b91c1c", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                🩸 Sugar Impact
              </p>
              <p style={{ fontSize: 14, lineHeight: 1.7 }}>
                Wonton noodle soup has a high glycaemic load.
              </p>
            </div>

            <hr style={{ border: "none", borderTop: "1px solid hsl(160 15% 90%)" }} />

            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: "#b45309", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                💡 Instant Advice
              </p>
              <p style={{ fontSize: 14, lineHeight: 1.7 }}>
                Order a side of blanched choi sum or vegetables to add fibre,
                which slows glucose absorption. Finish the veggies first. Use only half the soy sauce packet
                to reduce sodium intake — high sodium can raise blood pressure, a
                concern that compounds with blood sugar spikes.
              </p>
            </div>

            <hr style={{ border: "none", borderTop: "1px solid hsl(160 15% 90%)" }} />

            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: "#0369a1", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                🔄 Next Time
              </p>
              <p style={{ fontSize: 14, lineHeight: 1.7 }}>
                Try reducing the portion of noodles next time. If that's
                tricky, swap the alkaline noodles for bean thread vermicelli — they
                have a lower glycaemic index and won't spike your blood sugar as
                sharply.
              </p>
            </div>

            <Button
              className="w-full mt-1"
              style={{
                backgroundColor: "#127843",
                color: "white",
                fontSize: 14,
              }}
            >
              Done
            </Button>
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
              2 of 6 advice uses left today
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
