export type ReportView = "daily" | "two-month";

export function getReportView(search: string): ReportView {
  return new URLSearchParams(search).get("view") === "two-month" ? "two-month" : "daily";
}

export function getReportPath(view: ReportView): string {
  return view === "two-month" ? "/report?view=two-month" : "/report";
}

export function isReportLocation(location: string): boolean {
  if (location.startsWith("/report") || location.startsWith("/food-reports")) {
    return true;
  }
  if (!location.startsWith("/food-log")) return false;

  const query = location.includes("?") ? location.slice(location.indexOf("?") + 1) : "";
  return new URLSearchParams(query).get("from") === "report";
}