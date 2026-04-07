import "./_group.css";
import { Button } from "@/components/ui/button";
import { RotateCcw } from "lucide-react";

export function AdviceStateZhHant() {
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
          <p style={{ fontSize: 14, fontWeight: 600 }}>你的飲食建議</p>

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
                🩸 血糖影響
              </p>
              <p style={{ fontSize: 14, lineHeight: 1.7 }}>
                雲吞麵的升糖指數頗高。
              </p>
            </div>

            <hr style={{ border: "none", borderTop: "1px solid hsl(160 15% 90%)" }} />

            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: "#b45309", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                💡 即時建議
              </p>
              <p style={{ fontSize: 14, lineHeight: 1.7 }}>
                加點灼菜心或蔬菜以增加纖維，有助減慢葡萄糖吸收。先吃蔬菜。只下一半醬油，減少鈉攝入——高鈉會升高血壓，加上血糖飆升更令人擔憂。
              </p>
            </div>

            <hr style={{ border: "none", borderTop: "1px solid hsl(160 15% 90%)" }} />

            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: "#0369a1", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                🔄 下次建議
              </p>
              <p style={{ fontSize: 14, lineHeight: 1.7 }}>
                下次試試減少麵條份量。如果不容易，把鹼水麵換成冬粉——升糖指數相對較低，血糖不會升得那麼急。
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
              完成
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
              今天剩餘 2 / 6 次建議
            </span>
          </div>

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
  );
}
