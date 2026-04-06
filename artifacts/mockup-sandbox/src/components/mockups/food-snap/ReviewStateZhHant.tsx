import "./_group.css";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RotateCcw } from "lucide-react";

export function ReviewStateZhHant() {
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
          拍攝你的餐點照片，獲取個人化飲食建議。
        </p>

        <div className="flex flex-col gap-4">
          <img
            src="/__mockup/images/wonton-noodle-soup.png"
            alt="Food photo"
            className="w-full rounded-2xl object-cover"
            style={{ maxHeight: 208 }}
          />

          <div>
            <p style={{ fontSize: 14, fontWeight: 600 }}>你吃了什麼？</p>
            <p style={{ fontSize: 12, color: "hsl(168 10% 45%)", marginTop: 2 }}>
              可隨時更正我的猜測，以獲取更好的建議。
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <FieldRow label="食物名稱" value="雲吞麵" />
            <FieldRow label="份量" value="中碗" />
            <FieldRow label="醬料 / 調味品" value="醬油、辣油" />
            <FieldRow label="額外配料" value="加雲吞" />
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
              今天剩餘 2 / 3 次拍照分析
            </span>
          </div>

          <div className="flex flex-col gap-2 pt-1">
            <Button
              className="w-full h-14 text-base"
              style={{
                backgroundColor: "#f97316",
                color: "white",
              }}
            >
              立即獲取飲食建議
            </Button>
            <Button
              variant="ghost"
              className="w-full gap-1.5"
              style={{ color: "hsl(168 10% 45%)", fontSize: 14 }}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              換一張照片
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
