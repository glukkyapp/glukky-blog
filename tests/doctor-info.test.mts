import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const schema = readFileSync("shared/schema.ts", "utf8");
const routes = readFileSync("server/routes.ts", "utf8");
const storage = readFileSync("server/storage.ts", "utf8");
const migrations = readFileSync("server/startup-migrations.ts", "utf8");
const profile = readFileSync("client/src/pages/profile.tsx", "utf8");
const page = readFileSync("client/src/pages/doctor-info.tsx", "utf8");
const app = readFileSync("client/src/App.tsx", "utf8");
const clientPosthog = readFileSync("client/src/lib/posthog.ts", "utf8");
const serverPosthog = readFileSync("server/posthog.ts", "utf8");
const replitMd = readFileSync("replit.md", "utf8");
const locales = [
  JSON.parse(readFileSync("client/src/locales/en.json", "utf8")),
  JSON.parse(readFileSync("client/src/locales/zh-Hant.json", "utf8")),
  JSON.parse(readFileSync("client/src/locales/yue.json", "utf8")),
];

assert.match(schema, /export const doctorInfo = pgTable\("doctor_info"/);
for (const field of [
  "doctorName",
  "clinicName",
  "specialty",
  "officePhone",
  "address",
  "lastVisitDate",
  "notes",
]) {
  assert.ok(schema.includes(field), `schema includes ${field}`);
}
for (const forbidden of ["doctorEmail", "mobilePhone", "emergencyNumber"]) {
  assert.ok(!schema.includes(forbidden), `schema excludes ${forbidden}`);
}
assert.ok(migrations.includes('name: "doctor_info.create"'), "startup migration creates doctor_info");

assert.ok(routes.includes('app.get("/api/profile/doctor-info"'), "dedicated GET route exists");
assert.ok(routes.includes('app.patch("/api/profile/doctor-info"'), "dedicated PATCH route exists");
assert.ok(routes.includes("storage.getDoctorInfo(userId)"), "GET is scoped to authenticated user");
assert.ok(routes.includes("storage.upsertDoctorInfo(userId"), "PATCH is scoped to authenticated user");
assert.ok(!routes.includes('"/api/profile/health-markers", doctorInfo'), "doctor info does not use health-marker route");

assert.ok(storage.includes("async getDoctorInfo(userId: string)"), "dedicated storage read exists");
assert.ok(storage.includes("async upsertDoctorInfo("), "dedicated storage upsert exists");
assert.ok(!storage.match(/PROFILE_HEALTH_FIELDS[\s\S]{0,150}doctor/i), "doctor fields are outside health audit list");
assert.ok(storage.includes("counts.doctor_info"), "account deletion removes doctor data");

const exportMethod = storage.slice(
  storage.indexOf("async exportUserData"),
  storage.indexOf("async createCorrectionRequest"),
);
assert.ok(!exportMethod.includes("doctorInfo"), "raw personal export excludes doctor_info");

const jsonExport = routes.slice(
  routes.indexOf('app.get("/api/user/data-export"'),
  routes.indexOf('app.get("/api/user/pdf-export"'),
);
const pdfExport = routes.slice(
  routes.indexOf('app.get("/api/user/pdf-export"'),
  routes.indexOf('app.post("/api/user/correction-request"'),
);
for (const exportSource of [jsonExport, pdfExport]) {
  assert.ok(!/doctorName|clinicName|officePhone|lastVisitDate|doctor_info/.test(exportSource), "export omits doctor info");
}

assert.ok(profile.includes('path: "/doctor-info"'), "Profile includes My Doctor shortcut");
assert.ok(profile.includes("grid grid-cols-4 gap-2"), "Profile shortcuts deliberately use four columns");
assert.ok(app.includes('const DoctorInfo = lazy(() => import("@/pages/doctor-info"))'), "doctor page is lazy loaded");
assert.ok(app.includes('<Route path="/doctor-info" component={DoctorInfo} />'), "doctor route is registered");

for (const testId of [
  "input-doctor-name",
  "input-clinic-name",
  "input-doctor-specialty",
  "input-office-phone",
  "textarea-doctor-address",
  "input-last-visit-date",
  "textarea-doctor-notes",
]) {
  assert.ok(page.includes(testId), `page renders ${testId}`);
}
for (const forbidden of ["input-doctor-email", "input-mobile-phone", "input-emergency-number"]) {
  assert.ok(!page.includes(forbidden), `page excludes ${forbidden}`);
}
assert.ok(page.includes('form="doctor-info-form"'), "page uses explicit Save action");
assert.ok(page.includes('data-testid="text-doctor-emergency-disclaimer"'), "standalone disclaimer is rendered");

for (const locale of locales) {
  assert.equal(typeof locale.profile.shortcut_doctor, "string");
  assert.equal(typeof locale.profile.doctor_title, "string");
  assert.equal(typeof locale.profile.doctor_instruction, "string");
  assert.equal(typeof locale.profile.doctor_emergency_disclaimer, "string");
  assert.ok(locale.profile.doctor_emergency_disclaimer.length > 0);
  assert.ok(!/\d/.test(locale.profile.doctor_emergency_disclaimer), "disclaimer contains no emergency number");
}
assert.equal(locales[0].profile.doctor_instruction, "Enter the information of your family doctor here.");
assert.equal(locales[0].profile.doctor_emergency_disclaimer, "Not for emergencies.");

for (const source of [clientPosthog, serverPosthog]) {
  for (const key of [
    "doctorname",
    "clinicname",
    "specialty",
    "officephone",
    "address",
    "lastvisitdate",
    "notes",
  ]) {
    assert.ok(source.includes(`"${key}"`), `PostHog blocks ${key}`);
  }
}

assert.ok(
  replitMd.includes("shared schema-level field-exclusion list"),
  "future research export exclusion is documented",
);

console.log("Doctor info contract checks passed");