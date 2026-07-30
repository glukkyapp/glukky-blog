import { useLocation } from "wouter";
import { ChevronLeft } from "lucide-react";
import i18n from "@/i18n";

const isChinese = () => {
  const lang = i18n.language ?? "";
  return lang.startsWith("zh") || lang.startsWith("yue");
};

function ContentEN() {
  return (
    <>
      <section>
        <h2 className="font-semibold text-sm mb-2 text-foreground">Who can see your data</h2>
        <ul className="list-disc pl-4 space-y-1">
          <li>Every health-data screen requires you to be logged in. No anonymous access to anyone else's records.</li>
          <li>Passwords are stored as secure hashes, never in plain text.</li>
          <li>Your login session is protected by a server-side secret key.</li>
          <li>All health information input is optional.</li>
        </ul>
      </section>

      <section>
        <h2 className="font-semibold text-sm mb-2 text-foreground">What goes to analytics</h2>
        <ul className="list-disc pl-4 space-y-1">
          <li>Before any analytics event leaves your device or the server, a hardcoded blocklist strips out your health data. These fields are simply deleted and never sent.</li>
          <li>Your internal account ID is scrambled before it reaches analytics. It cannot be reversed back to your identity.</li>
          <li>You can opt out of analytics tracking.</li>
        </ul>
      </section>

      <section>
        <h2 className="font-semibold text-sm mb-2 text-foreground">What goes to AI</h2>
        <ul className="list-disc pl-4 space-y-1">
          <li>Claude is only called when you use the food-snap feature, and only if you have specifically consented to AI processing.</li>
          <li>If consent is missing, the server returns an error and nothing is sent.</li>
        </ul>
      </section>

      <section>
        <h2 className="font-semibold text-sm mb-2 text-foreground">What goes to notifications</h2>
        <ul className="list-disc pl-4 space-y-1">
          <li>Push notifications are only sent to users who have consented.</li>
          <li>No health values appear in notification content. The messages contain no glucose numbers, diagnoses, or symptoms.</li>
        </ul>
      </section>

      <section>
        <h2 className="font-semibold text-sm mb-2 text-foreground">What your data cannot be used for</h2>
        <ul className="list-disc pl-4 space-y-1">
          <li>Model training or AI fine-tuning.</li>
          <li>Research studies or population-level analysis.</li>
        </ul>
      </section>

      <section>
        <h2 className="font-semibold text-sm mb-2 text-foreground">Your own data rights</h2>
        <ul className="list-disc pl-4 space-y-1">
          <li>Full data export (download everything).</li>
          <li>PDF export.</li>
          <li>Data correction request.</li>
          <li>Account deletion — immediate or scheduled.</li>
        </ul>
      </section>
    </>
  );
}

function ContentZH() {
  return (
    <>
      <section>
        <h2 className="font-semibold text-sm mb-2 text-foreground">誰能看到你的資料</h2>
        <ul className="list-disc pl-4 space-y-1">
          <li>每個健康資料頁面都需要登入才能存取，任何人都無法匿名查看他人的紀錄。</li>
          <li>密碼以安全雜湊方式儲存，不以明文儲存。</li>
          <li>你的登入工作階段受伺服器端密鑰保護。</li>
          <li>所有健康資訊可選填。</li>
        </ul>
      </section>

      <section>
        <h2 className="font-semibold text-sm mb-2 text-foreground">傳送給分析工具的內容</h2>
        <ul className="list-disc pl-4 space-y-1">
          <li>在任何分析事件離開你的裝置或伺服器之前，系統會透過內建的封鎖清單，自動移除個人或健康資訊，這些欄位會直接被刪除，絕不會被傳送。</li>
          <li>你的內部帳戶 ID 會先經過雜湊處理才傳送，且無法被還原回你的真實身分。</li>
          <li>你可關閉分析追蹤功能。</li>
        </ul>
      </section>

      <section>
        <h2 className="font-semibold text-sm mb-2 text-foreground">傳送給 AI 的內容</h2>
        <ul className="list-disc pl-4 space-y-1">
          <li>Claude 僅在你使用「拍照辨識食物」功能，且你已明確同意進行 AI 處理時才會被呼叫。</li>
          <li>若未取得同意，伺服器將回傳錯誤訊息，且不會傳送任何資料。</li>
        </ul>
      </section>

      <section>
        <h2 className="font-semibold text-sm mb-2 text-foreground">傳送給推播通知服務的內容</h2>
        <ul className="list-disc pl-4 space-y-1">
          <li>推播通知僅會發送給已同意接收的使用者。</li>
          <li>通知內容中不會出現任何健康數值。</li>
        </ul>
      </section>

      <section>
        <h2 className="font-semibold text-sm mb-2 text-foreground">你的資料不會被用於</h2>
        <ul className="list-disc pl-4 space-y-1">
          <li>模型訓練或 AI 微調。</li>
          <li>研究計畫或群體層級分析。</li>
        </ul>
      </section>

      <section>
        <h2 className="font-semibold text-sm mb-2 text-foreground">你對自身資料的權利</h2>
        <ul className="list-disc pl-4 space-y-1">
          <li>完整資料匯出（下載全部資料）。</li>
          <li>PDF 匯出。</li>
          <li>資料更正請求。</li>
          <li>帳戶刪除，可立即執行或排程執行。</li>
        </ul>
      </section>
    </>
  );
}

export default function Confidentiality() {
  const [, navigate] = useLocation();
  const chinese = isChinese();

  return (
    <div className="max-w-sm mx-auto px-4 pt-4 pb-12">
      <button
        type="button"
        onClick={() => navigate("/profile")}
        className="flex items-center gap-1 text-sm text-muted-foreground mb-4 hover:text-foreground transition-colors"
        data-testid="button-confidentiality-back"
      >
        <ChevronLeft className="w-4 h-4" />
        {chinese ? "返回" : "Back"}
      </button>

      <h1 className="text-base font-semibold mb-5" data-testid="heading-confidentiality">
        {chinese ? "私隱聲明" : "Confidentiality Statement"}
      </h1>

      <div className="space-y-5 text-xs text-muted-foreground leading-relaxed">
        {chinese ? <ContentZH /> : <ContentEN />}
      </div>
    </div>
  );
}
