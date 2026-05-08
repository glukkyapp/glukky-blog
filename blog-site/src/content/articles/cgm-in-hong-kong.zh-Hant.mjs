// ZH-Hant — CGM 適合你嗎
export default {
  slug: "cgm-in-hong-kong",
  locale: "zh-Hant",
  title: "CGM 適合你嗎",
  description: "",
  publishedAt: "2026-05-10",
  pillar: "工具與監測",
  heroImage: "",
  heroAlt: "",
  relatedSlugs: [
    "blood-sugar-targets-after-meals",
    "fruit-and-blood-sugar",
    "glycaemic-index-explained",
    "prediabetes-diet-where-to-start",
  ],
  body: `
<p>連續血糖監測器（CGM）目前在社交媒體上隨處可見 —— 香港亦不例外，市場宣傳令它聽起來非常吸引。</p>

<h2 id="what-cgm-is">CGM 究竟是什麼</h2>

<p>CGM 是一個小感應器，貼在上臂後方（有時亦會貼在腹部），每次可佩戴 10 至 14 日。皮膚下一條極幼細的探針會量度細胞之間組織液的葡萄糖水平，手機則會顯示一條連續的曲線 —— 你目前血糖是多少、夜間又如何、某一餐又如何影響它。它與指尖血糖機的分別，是它能告訴你你的血糖趨勢。</p>

<figure>
  <img src="/images/photo-cgm-sensor.jpg" alt="一個 FreeStyle Libre 連續血糖監測器感應器貼在上臂後方，旁邊有一台手持讀取器。" loading="lazy" width="1024" height="683" />
  <figcaption>一個連續血糖監測器感應器貼在上臂。相片：Thirunavukkarasye-Raveendran，<a href="https://commons.wikimedia.org/wiki/File:FreeStyle_libre_am_Oberarm_und_Auslesegerät-4.JPG" rel="noopener">Wikimedia Commons</a>，CC BY 4.0。</figcaption>
</figure>

<h2 id="who-benefits-most">誰適用？</h2>

<p>對於使用胰島素的二型糖尿病人，從由指尖採血（俗稱「督手指」）轉至改用連續血糖監測（CGM）後，平均糖化血紅素（HbA1c）下降約 1 個百分點<sup><a href="#src-1">1</a></sup>；早期針對糖尿前期的研究亦顯示，即使短期使用 CGM，也可促使人選擇較小份量及較健康的食物。不過目前最有力的數據仍集中在使用胰島素的二型糖尿病患者，而非糖尿前期。</p>

<p>至於糖尿前期 —— 即血糖偏高但仍未到糖尿病範圍 —— 短期使用 CGM 似乎能促使人選擇較小份量、較溫和的替代食物。<sup><a href="#src-2">2</a></sup>暫時並沒有指引建議「每位糖尿前期人士都應該佩戴 CGM」。</p>

<h2 id="why-people-choose">人們為何選擇或抗拒 CGM</h2>

<p><strong>選擇 CGM 的原因：</strong></p>
<ul>
  <li>減少痛楚與麻煩</li>
  <li>感覺上準確度較佳</li>
</ul>

<p><strong>抗拒 CGM 的原因<sup><a href="#src-3">3</a></sup>：</strong></p>
<ul>
  <li>價錢</li>
  <li>不想手臂上有一個明顯的感應器</li>
  <li>害怕太多數據令人無所適從</li>
</ul>

<p>當與醫護人員討論 CGM 時，記得提出你的疑惑。</p>

<h2 id="without-one">沒有 CGM 的話可以怎麼辦</h2>

<p>沒有 CGM，你仍然可以做這幾件事：</p>

<ul>
  <li><strong>食物紀錄：</strong>連續兩星期將每一餐都拍下來，你會發現自己對某些食物的偏愛可能影響了血糖。</li>
  <li><strong>針對性指尖採血（俗稱督手指）：</strong>如果醫生同意，選擇你經常吃的食物，在飯後 1–2 小時量度血糖，會令你大致知道這頓飯的影響。</li>
  <li><strong>飯後散步：</strong>飯後散步 10 至 15 分鐘，是改善血糖其中一項最有效的生活習慣。詳見<a href="/zh/blog/post-meal-walk-blood-sugar">飯後散步如何幫助血糖穩定</a>。</li>
</ul>

<p>如果你感到無所適從，或不知道如何開始，可試用 <a href="/zh/app">Glukky</a>：控糖小幫手，自動為你處理以上的問題。</p>

<aside class="disclaimer" role="note">本文只屬資訊參考，並非醫療建議。以上建議是否適合你，視乎你的具體情況 —— 糖尿病類型、所服藥物、其他疾病與目標。請與醫生或糖尿病專科團隊商討。</aside>

<p>如果你對血糖相關數字仍感陌生，在這篇文章前，建議先看另一篇：<a href="/zh/blog/blood-sugar-targets-after-meals">飯後血糖目標</a>。</p>
`,
  faq: [
    {
      q: "CGM 會告訴我該吃什麼嗎？",
      a: "<p>不會，CGM 會告訴你每一餐飯對血糖造成了什麼影響。由此你可參考自己的飲食有什麼地方可以改善。</p>",
    },
    {
      q: "要佩戴多久才有用？",
      a: "<p>多數人在頭 2 至 4 星期已能發現血糖規律。如果生活習慣、藥物或體重有變化、需計算胰島素劑量，你可能需配戴更長時間。</p>",
    },
  ],
  sources: [
    {
      label: "Continuous Glucose Monitoring vs Fingerstick Monitoring in Veterans With Type 2 Diabetes (n=150). 2024.",
      publisher: "PMC / Veterans Affairs research",
      url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC11745360/",
    },
    {
      label: "Continuous Glucose Monitoring (CGM) in Prediabetes. ClinicalTrials.gov NCT07371546.",
      publisher: "ClinicalTrials.gov",
      url: "https://clinicaltrials.gov/study/NCT07371546",
    },
    {
      label: "Polonsky WH et al. Diabetes patient preferences for glucose-monitoring technologies: a systematic review. Patient Preference and Adherence 2023.",
      publisher: "Patient Preference and Adherence",
      url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC9853131/",
    },
  ],
};
