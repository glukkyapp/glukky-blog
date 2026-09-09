export function isDevelopmentGardenRouteAvailable(nodeEnv: string | undefined): boolean {
  return nodeEnv !== "production";
}