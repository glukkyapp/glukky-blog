export const GLUCOSE_PATTERNS_SWIPE_TUTORIAL_TEST_EMAIL = "glucosetest@gmail.com";

export function canResetGlucosePatternsSwipeTutorial(
  email: string | null | undefined,
  nodeEnv: string | undefined,
): boolean {
  return nodeEnv === "development"
    && email?.trim().toLowerCase() === GLUCOSE_PATTERNS_SWIPE_TUTORIAL_TEST_EMAIL;
}