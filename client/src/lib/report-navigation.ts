export type ReportView = "daily" | "weekly";

export function getReportView(search: string): ReportView {
  return new URLSearchParams(search).get("view") === "weekly" ? "weekly" : "daily";
}

export function getReportPath(view: ReportView): string {
  return view === "weekly" ? "/report?view=weekly" : "/report";
}

export function isReportLocation(location: string): boolean {
  if (location.startsWith("/report") || location.startsWith("/food-reports")) {
    return true;
  }
  if (!location.startsWith("/food-log")) return false;

  const query = location.includes("?") ? location.slice(location.indexOf("?") + 1) : "";
  return new URLSearchParams(query).get("from") === "report";
}