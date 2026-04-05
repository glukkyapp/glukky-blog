import "./_group.css";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RotateCcw } from "lucide-react";

export function ReviewState() {
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
          <img
            src="/__mockup/images/wonton-noodle-soup.png"
            alt="Food photo"
            className="w-full rounded-2xl object-cover"
            style={{ maxHeight: 208 }}
          />

          <div>
            <p style={{ fontSize: 14, fontWeight: 600 }}>What did you eat?</p>
            <p style={{ fontSize: 12, color: "hsl(168 10% 45%)", marginTop: 2 }}>
              Check my guess and correct anything before getting advice.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <FieldRow label="FOOD NAME" value="Wonton noodle soup" />
            <FieldRow label="PORTION" value="Medium bowl" />
            <FieldRow label="SAUCES / CONDIMENTS" value="Soy sauce, chili oil" />
            <FieldRow label="EXTRAS / TOPPINGS" value="Extra wontons" />
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
              2 of 3 photo analyses left today
            </span>
          </div>

          <div className="flex flex-col gap-2 pt-1">
            <Button
              className="w-full"
              style={{
                backgroundColor: "#127843",
                color: "white",
                fontSize: 14,
              }}
            >
              Get diet advice
            </Button>
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
    </div>
  );
}

function FieldRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label
        style={{
          fontSize: 11,
          fontWeight: 500,
          color: "hsl(168 10% 45%)",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
        }}
      >
        {label}
      </Label>
      <Input
        value={value}
        readOnly
        style={{
          fontSize: 14,
          backgroundColor: "white",
          borderColor: "hsl(160 15% 82%)",
        }}
      />
    </div>
  );
}
