/**
 * Focused Profile health-marker contract coverage.
 *
 * Run with: npx tsx tests/profile-health-markers.test.mts
 */
import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";

const profile = readFileSync("client/src/pages/profile.tsx", "utf8");
const routes = readFileSync("server/routes.ts", "utf8");
const en = JSON.parse(readFileSync("client/src/locales/en.json", "utf8"));
const zhHant = JSON.parse(readFileSync("client/src/locales/zh-Hant.json", "utf8"));
const yue = JSON.parse(readFileSync("client/src/locales/yue.json", "utf8"));

function check(label: string, condition: boolean): void {
  assert.equal(condition, true, label);
  console.log(`  ✓ ${label}`);
}

console.log("Profile Health Markers");

check(
  "ProfileData no longer exposes HbA1c",
  !profile.includes("hba1cLevel") && !profile.includes("editingHba1c") && !profile.includes("hba1cValue"),
);
check(
  "Profile has no HbA1c entry controls or test hooks",
  !profile.includes("input-hba1c")
    && !profile.includes("button-edit-hba1c")
    && !profile.includes("hba1c_level"),
);
check(
  "Health-marker mutation only accepts the blood-test date",
  profile.includes('mutationFn: async (data: { bloodTestDate?: string | null })')
    && profile.includes('mutation.mutate({ bloodTestDate: value })'),
);
check(
  "Date editing and diabetes status remain present",
  profile.includes('data-testid="input-blood-test-date"')
    && profile.includes('data-testid="button-edit-blood-test-date"')
    && profile.includes('data-testid="text-diabetes-status"'),
);
check(
  "HbA1c profile copy is removed from all supported client locales",
  [en, zhHant, yue].every((locale) => !("hba1c_level" in locale.profile)),
);
check(
  "Remaining Health Markers copy is present in all supported client locales",
  [en, zhHant, yue].every((locale) =>
    locale.profile.health_markers
    && locale.profile.last_blood_test
    && locale.profile.diabetes_status
    && locale.profile.tap_to_add,
  ),
);
check(
  "Server retains HbA1c compatibility handling",
  routes.includes("const { hba1cLevel, bloodTestDate } = req.body;")
    && routes.includes("updateData.hba1cLevel = null")
    && routes.includes("updateData.hba1cLevel = parsed"),
);
check(
  "Server accepts date-only health-marker updates with existing validation",
  routes.includes('app.patch("/api/profile/health-markers"')
    && routes.includes("updateData.bloodTestDate = null")
    && routes.includes("updateData.bloodTestDate = bloodTestDate")
    && routes.includes("Invalid date format. Use YYYY-MM-DD."),
);

console.log("\n8 passed");