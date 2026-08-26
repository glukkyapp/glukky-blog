// Staged image preloading. Only Stage 1 runs at app launch; later stages
// fire when their consumers mount, so we don't burn the user's
// bandwidth on images they may never see.
//
// Stage 1 — launch + landing slides, fires from the cube cold-launch
//           overlay's mount effect (App.tsx) so the cube paints first.
// Stage 2 — 18 onboarding question illustrations, fires from the
//           landing/launch surface so it overlaps with the user
//           reading + signing in.
// Stage 3 — main-app chrome + paywall, fires from onboarding/intro
//           on mount so it's warm by the time they reach home tabs.
// Stage 4 — 11 diet-tip thumbnails on the Health Info page, fires
//           when the paywall modal opens (so it warms in the
//           background while the user reads + pays) and again as a
//           fallback when /health-info mounts (covers comp/premium
//           users who never see the paywall).

// Stage 1 — launch + landing
import glukkyLogo from "@assets/high-resolution-color-logo_1776593969022.png";
import slide1Img from "@assets/generated_images/slide1_walk.png";
import slide2Img from "@assets/generated_images/slide2_meal.png";
import slide3Img from "@assets/cyucyu_A_subtly_smiling_Asian_person_holding_a_smartphone_loo__1773936364915.png";
import cubeGif from "@assets/gif_new_v2_1777639983811.gif";

// Stage 2 — onboarding question illustrations
import nightShiftImg from "@assets/generated-image_(3)_1776591773408.png";
import irregularImg from "@assets/generated-image_(4)_1776591773408.png";
import bedImg from "@assets/generated-image_(5)_1776592900103.png";
import sleepBgImg from "@assets/generated-image_(6)_1776594011160.png";
import eatingOutImg from "@assets/generated-image_(7)_1776594785348.png";
import welcomeImg from "@assets/generated-image_(13)_1776599161992.png";
import prediabetesImg from "@assets/generated-image_(14)_1776598029735.png";
import diabetesImg from "@assets/generated-image_(15)_1776598029736.png";
import noButHealthImg from "@assets/generated-image_(16)_1776598029736.png";
import whyImg from "@assets/generated-image_(18)_1776601559534.png";
import couchImg from "@assets/generated-image_(19)_1776605605132.png";
import walkImg from "@assets/generated-image_(20)_1776605612073.png";
import mealTimeImg from "@assets/Untitled_design_(3)_1776590588282.png";

// Stage 3 — main-app chrome + paywall
import mountainBg from "@assets/cyucyu_a_stylized_mountain_peak_with_a_path_or_steps_leading___1775312483622.png";
import phoneBg from "@assets/cyucyu_a_smartphone_next_to_a_plate_of_food_as_if_it_is_takin__1775312483622.png";
import calendarBg from "@assets/cyucyu_a_clean_calendar_page_with_an_upward_progress_arrow_in__1775311745838.png";
import cameraHeadingIcon from "@assets/4af4faa5-cdea-44a0-b7b9-b2ce91b8d499_removalai_preview_1776612731555.png";
import roadmapHeadingIcon from "@assets/10ddeb7f-376b-4b2f-9a96-fbab94feff1a_removalai_preview_1776612805643.png";
import lightbulbHeadingIcon from "@assets/8bfac294-0484-4fd9-a8c1-6746d370b307_removalai_preview_1776612765809.png";
import calendarHeadingIcon from "@assets/938a212f-9f09-4432-b49a-cf6f61738040_removalai_preview_1776612699943.png";
import homeGiftImg from "@assets/35789ab2-a5d2-4ca4-b0e5-6ac1d9fc5241_removalai_preview_1776612834467.png";
import laurelImg from "@assets/generated_images/laurel-wreath-gold.png";
import paywallHeroImg from "@assets/2dd316a7-1d08-4d1c-9af7-810af53516b8_1776833621839.png";
import pigImg0 from "@assets/IMG_2062_1773846070998.PNG";
import pigImg1 from "@assets/IMG_0610_1773846070999.PNG";
import pigImg2 from "@assets/IMG_0611_1773846070999.PNG";
import pigImg3 from "@assets/IMG_0612_1773846070999.PNG";
import pigImg4 from "@assets/IMG_0613_1773846070999.PNG";
import pigImg5 from "@assets/IMG_0614_1773846070999.PNG";

// Stage 4 — 11 diet-tip thumbnails (Health Info page)
import dietTip1 from "@assets/cropped_circle_image_(1)_1775372471299.png";
import dietTip2 from "@assets/cropped_circle_image_(2)_1775372471300.png";
import dietTip3 from "@assets/cropped_circle_image_(3)_1775372471300.png";
import dietTip4 from "@assets/cropped_circle_image_(4)_1775372471300.png";
import dietTip5 from "@assets/cropped_circle_image_(5)_1775372471299.png";
import dietTip6 from "@assets/cropped_circle_image_(6)_1775372471300.png";
import dietTip7 from "@assets/cropped_circle_image_(7)_1775372471300.png";
import dietTip8 from "@assets/cropped_circle_image_(8)_1775372471301.png";
import dietTip9 from "@assets/cropped_circle_image_(9)_1775374577700.png";
import dietTip10 from "@assets/cropped_circle_image_(10)_1775374584626.png";
import dietTip11 from "@assets/cropped_circle_image_1775372471301.png";

const STAGE_1: string[] = [glukkyLogo, slide1Img, slide2Img, slide3Img, cubeGif];

const STAGE_2: string[] = [
  nightShiftImg, irregularImg, bedImg, sleepBgImg, eatingOutImg,
  welcomeImg, prediabetesImg, diabetesImg, noButHealthImg, whyImg,
  couchImg, walkImg, mealTimeImg,
];

const STAGE_3: string[] = [
  mountainBg, phoneBg, calendarBg,
  cameraHeadingIcon, roadmapHeadingIcon, lightbulbHeadingIcon, calendarHeadingIcon,
  homeGiftImg, laurelImg, paywallHeroImg,
  pigImg0, pigImg1, pigImg2, pigImg3, pigImg4, pigImg5,
];

const STAGE_4: string[] = [
  dietTip1, dietTip2, dietTip3, dietTip4, dietTip5, dietTip6,
  dietTip7, dietTip8, dietTip9, dietTip10, dietTip11,
];

function fireAll(srcs: string[]): void {
  if (typeof window === "undefined") return;
  for (const src of srcs) {
    const img = new Image();
    img.src = src;
  }
}

function loadAllTracked(srcs: string[]): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  const perImage = srcs.map(
    (src) =>
      new Promise<void>((resolve) => {
        const img = new Image();
        img.onload = () => resolve();
        img.onerror = () => resolve();
        img.src = src;
      }),
  );
  return Promise.all(perImage).then(() => {});
}

let stage1Promise: Promise<void> | null = null;
let stage2Promise: Promise<void> | null = null;
let didStage3 = false;
let stage4Promise: Promise<void> | null = null;

export function preloadStage1Launch(): Promise<void> {
  if (stage1Promise) return stage1Promise;
  stage1Promise = loadAllTracked(STAGE_1);
  return stage1Promise;
}

export function getStage1Promise(): Promise<void> {
  return stage1Promise ?? preloadStage1Launch();
}

export function preloadStage2Onboarding(): Promise<void> {
  if (stage2Promise) return stage2Promise;
  stage2Promise = loadAllTracked(STAGE_2);
  return stage2Promise;
}

export function getStage2Promise(): Promise<void> {
  return stage2Promise ?? preloadStage2Onboarding();
}

export function preloadStage3RestOfApp(): void {
  if (didStage3) return;
  didStage3 = true;
  fireAll(STAGE_3);
}

export function preloadStage4DietTipThumbnails(): Promise<void> {
  if (stage4Promise) return stage4Promise;
  stage4Promise = loadAllTracked(STAGE_4);
  return stage4Promise;
}

export function getStage4Promise(): Promise<void> {
  return stage4Promise ?? preloadStage4DietTipThumbnails();
}
