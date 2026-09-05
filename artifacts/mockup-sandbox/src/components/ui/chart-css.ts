const THEMES = { light: "", dark: ".dark" } as const

type ChartColorConfig = {
  color?: unknown
  theme?: Partial<Record<keyof typeof THEMES, unknown>>
}

const SAFE_IDENTIFIER = /^[A-Za-z0-9_-]+$/
const HEX_COLOR = /^#(?:[0-9A-Fa-f]{3}|[0-9A-Fa-f]{4}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/
const RGB_COLOR =
  /^(rgb|rgba)\( *(\d{1,3}) *, *(\d{1,3}) *, *(\d{1,3})(?: *, *(?:(0(?:\.\d+)?|1(?:\.0+)?|\.\d+)))? *\)$/

export function isSafeChartIdentifier(value: unknown): value is string {
  return typeof value === "string" && SAFE_IDENTIFIER.test(value)
}

export function isSafeChartColor(value: unknown): value is string {
  if (typeof value !== "string") return false
  if (HEX_COLOR.test(value)) return true

  const match = RGB_COLOR.exec(value)
  if (!match) return false

  const [, functionName, ...parts] = match
  const channels = parts.slice(0, 3).map(Number)
  const alpha = parts[3]

  return (
    channels.every((channel) => channel <= 255) &&
    ((functionName === "rgb" && alpha === undefined) ||
      (functionName === "rgba" &&
        alpha !== undefined &&
        Number(alpha) >= 0 &&
        Number(alpha) <= 1))
  )
}

export function buildChartCss(id: unknown, config: unknown): string | null {
  if (!isSafeChartIdentifier(id) || !config || typeof config !== "object") {
    return null
  }

  let keys: string[]
  try {
    keys = Object.keys(config)
  } catch {
    return null
  }

  const entries = keys.flatMap((key) => {
    if (!isSafeChartIdentifier(key)) return []
    try {
      return [[key, (config as Record<string, unknown>)[key]] as const]
    } catch {
      return []
    }
  })

  const blocks = Object.entries(THEMES).flatMap(([theme, prefix]) => {
    const declarations = entries.flatMap(([key, value]) => {
      if (!value || typeof value !== "object") return []

      let color: unknown
      try {
        const item = value as ChartColorConfig
        const themedColor =
          item.theme && typeof item.theme === "object"
            ? item.theme[theme as keyof typeof THEMES]
            : undefined
        color = themedColor ?? item.color
      } catch {
        return []
      }

      return isSafeChartColor(color) ? [`  --color-${key}: ${color};`] : []
    })

    return declarations.length
      ? [
          `${prefix ? `${prefix} ` : ""}[data-chart="${id}"] {\n${declarations.join("\n")}\n}`,
        ]
      : []
  })

  return blocks.length ? `${blocks.join("\n\n")}\n` : null
}