// EN — CGM in Hong Kong
export default {
  slug: "cgm-in-hong-kong",
  locale: "en",
  title: "CGM in Hong Kong: who it's actually for",
  description:
    "For people already living with type 2 diabetes on insulin, switching from finger‑prick testing to continuous glucose monitoring (CGM) is linked to roughly a 1% drop in HbA1c, and early prediabetes studies suggest that even short‑term CGM use can nudge people toward smaller portions, healthier swaps, and more activity — but for now, most of the strongest data is in insulin‑treated type 2 rather than pure prediabetes.",
  publishedAt: "2026-05-10",
  pillar: "Tools & monitoring",
  heroImage: "",
  heroAlt: "",
  relatedSlugs: [
    "blood-sugar-targets-after-meals",
    "fruit-and-blood-sugar",
    "glycaemic-index-explained",
    "prediabetes-diet-where-to-start",
  ],
  body: `
<p>Continuous glucose monitors (CGMs) are everywhere on social media right now — Hong Kong included, where the marketing makes them sound like something everyone needs.</p>

<h2 id="what-cgm-is">What a CGM actually is</h2>

<p>A CGM is a small sensor you wear on the back of your upper arm (or sometimes your abdomen) for 10–14 days at a time. A tiny filament under the skin measures glucose in the fluid between your cells, and your phone shows you a continuous line — what your blood sugar is doing right now, what it did overnight, and how a particular meal affected you.</p>

<p>The difference from a finger-prick meter isn't really about accuracy at a single moment. It's about <em>seeing the curve</em>. A meter tells you the height; a CGM shows you the shape.</p>

<figure>
  <img src="/images/photo-cgm-sensor.jpg" alt="A FreeStyle Libre continuous glucose monitor sensor worn on the back of an upper arm, with a handheld reader nearby." loading="lazy" width="1024" height="683" />
  <figcaption>A continuous glucose monitor worn on the upper arm. Photo: Thirunavukkarasye-Raveendran, <a href="https://commons.wikimedia.org/wiki/File:FreeStyle_libre_am_Oberarm_und_Auslesegerät-4.JPG" rel="noopener">Wikimedia Commons</a>, CC BY 4.0.</figcaption>
</figure>

<h2 id="who-benefits-most">Where the strongest evidence sits</h2>

<p>For adults with type 2 diabetes who are already on insulin, switching from finger-prick testing to a CGM is linked to roughly a 1 percentage point drop in HbA1c.<sup><a href="#src-1">1</a></sup> A 1% HbA1c drop is a meaningful change — it's roughly the kind of effect you'd hope for from adding a new diabetes medication, and it's part of why CGM has moved from "specialist tool" to "standard of care" for insulin-treated type 2 in many places.</p>

<p>For prediabetes — i.e. people whose blood sugar is elevated but not yet in the diabetes range — the evidence is earlier and smaller. The interesting signal so far is behavioural rather than purely biochemical: short-term CGM use seems to nudge people toward smaller portions, gentler swaps, and a bit more daily movement, simply by making the cause-and-effect of meals visible.<sup><a href="#src-2">2</a></sup> It's promising. It's not yet "everyone with prediabetes should wear one".</p>

<h2 id="why-people-choose">Why people choose, or hesitate, about CGM</h2>

<p>When researchers ask people with diabetes what they actually want from a glucose monitor, two clusters of reasons keep showing up.<sup><a href="#src-3">3</a></sup></p>

<p><strong>Reasons to choose a CGM:</strong></p>
<ul>
  <li>Less pain and less hassle than finger-pricks.</li>
  <li>Better-perceived accuracy and confidence in the numbers, especially after a few weeks of wear.</li>
</ul>

<p><strong>Reasons to hesitate:</strong></p>
<ul>
  <li>Cost — the ongoing price of a continuous supply of sensors is the most common reason people hold off.</li>
  <li>Not wanting a visible sensor on the arm.</li>
  <li>Worrying about being overwhelmed by data, or not knowing what to <em>do</em> with the line on the screen.<sup><a href="#src-3">3</a></sup></li>
</ul>

<h2 id="without-one">What to do if you don't have a CGM</h2>

<p>You can still get most of the same insight without one:</p>

<ul>
  <li><strong>The food snap habit.</strong> A photo of every meal for two weeks, looked back at, often surfaces the pattern as clearly as a sensor would.</li>
  <li><strong>A targeted finger-prick.</strong> If your doctor agrees, picking one meal you eat often and checking 1–2 hours after it (a few times across different days) tells you most of what you need to know about that meal.</li>
  <li><strong>The post-meal walk.</strong> Walking for 10–15 minutes after the meal that usually pushes your blood sugar up the most is one of the most consistently useful single levers — see <a href="/blog/post-meal-walk-blood-sugar">how a post-meal walk helps blood sugar</a>.</li>
</ul>

<p>If you'd like all of that in one place rather than three separate habits to juggle, <a href="/app">Glukky</a> is the small companion app we're building around it — a quick food snap, a gentle after-dinner walk nudge, and a simple weekly view that lets the pattern speak for itself.</p>

<aside class="disclaimer" role="note">This article is educational and not medical advice. Whether CGM is right for you depends on your specific situation — type of diabetes, medications, other conditions and goals. Discuss it with your doctor or a diabetes specialist.</aside>

<p>If you're new to the surrounding numbers, our piece on <a href="/blog/blood-sugar-targets-after-meals">blood sugar targets after meals</a> is the natural place to start before reading any CGM line.</p>
`,
  faq: [
    {
      q: "Will a CGM tell me what to eat?",
      a: "<p>Not exactly. A CGM tells you what each meal did to your blood sugar. Translating that into \"so what should I do next time?\" still takes a bit of judgement — usually some combination of smaller portions of the spikiest items, more vegetables and protein, and a post-meal walk for the meal that spikes you most.</p>",
    },
    {
      q: "How long should I wear one to get useful information?",
      a: "<p>For pure curiosity / behaviour-change purposes (not insulin dosing), most people get a lot of the insight in the first 2–4 weeks. After that the marginal value drops off unless your routine, medications or weight are changing.</p>",
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
