import { ReactNode } from "react";
import { Check } from "lucide-react";
import { hapticTap } from "@/lib/haptics";

const GREEN_DARK = "#214B36";
const GREEN_DEEP = "#1f4a35";
const GREEN_DEEP_2 = "#163a28";
const LIME = "#d0f38f";
const LIME_SOFT = "#eef9d7";
const CARD_LIGHT = "#fbfbf3";
const TILE_LIGHT = "#f1f8de";

type Variant = "light" | "dark";

export function OnboardingCard({
  visual,
  title,
  children,
  footer,
  variant = "light",
  testId,
  scrollable = false,
  background,
}: {
  visual?: ReactNode;
  title?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  variant?: Variant;
  testId?: string;
  scrollable?: boolean;
  background?: string;
}) {
  const isDark = variant === "dark";
  return (
    <div
      data-testid={testId}
      className="mx-auto w-full"
      style={{
        maxWidth: 380,
        borderRadius: 28,
        background: background ?? (isDark ? GREEN_DEEP : CARD_LIGHT),
        color: isDark ? "#fff" : GREEN_DARK,
        boxShadow: "0 8px 24px rgba(33,75,54,0.10)",
        padding: 22,
        display: "flex",
        flexDirection: "column",
        gap: 18,
        minHeight: "min(72vh, 620px)",
      }}
    >
      {visual && (
        <div
          className="w-full overflow-hidden flex items-center justify-center"
          style={{
            borderRadius: 22,
            background: isDark ? "rgba(255,255,255,0.04)" : LIME_SOFT,
            minHeight: 180,
            padding: 12,
          }}
        >
          {visual}
        </div>
      )}
      {title && (
        <h2
          className="text-center"
          style={{
            fontFamily: "'Playfair Display', serif",
            fontWeight: 700,
            fontSize: 26,
            letterSpacing: "-0.02em",
            lineHeight: 1.2,
            color: isDark ? "#fff" : GREEN_DARK,
          }}
        >
          {title}
        </h2>
      )}
      <div
        className={scrollable ? "overflow-y-auto scrollbar-hidden" : ""}
        style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12 }}
      >
        {children}
      </div>
      {footer && <div className="mt-2">{footer}</div>}
    </div>
  );
}

export function PillOption({
  label,
  selected,
  onClick,
  testId,
  fullWidth = true,
}: {
  label: ReactNode;
  selected: boolean;
  onClick: () => void;
  testId?: string;
  fullWidth?: boolean;
}) {
  return (
    <button
      type="button"
      data-testid={testId}
      onClick={() => { hapticTap("SOFT"); onClick(); }}
      className={`${fullWidth ? "w-full" : ""} text-center px-4 py-3 transition-all`}
      style={{
        borderRadius: 999,
        fontWeight: 600,
        fontSize: 15,
        background: selected ? LIME : "transparent",
        color: GREEN_DARK,
        border: `1.5px solid ${selected ? GREEN_DARK : "rgba(33,75,54,0.25)"}`,
      }}
    >
      {label}
    </button>
  );
}

export function RowOption({
  icon,
  image,
  imageAlt,
  label,
  selected,
  onClick,
  testId,
}: {
  icon?: ReactNode;
  image?: string;
  imageAlt?: string;
  label: ReactNode;
  selected: boolean;
  onClick: () => void;
  testId?: string;
}) {
  const ROW_RADIUS = 18;
  const THUMB_SIZE = 56;
  return (
    <button
      type="button"
      data-testid={testId}
      onClick={() => { hapticTap("SOFT"); onClick(); }}
      className={`w-full flex items-center gap-3 pr-3 transition-all overflow-hidden ${image ? "py-0 pl-0" : "py-2.5 pl-3"}`}
      style={{
        borderRadius: ROW_RADIUS,
        background: selected ? LIME : CARD_LIGHT,
        border: `1.5px solid ${selected ? GREEN_DARK : "rgba(33,75,54,0.15)"}`,
        color: GREEN_DARK,
        minHeight: image ? THUMB_SIZE : undefined,
      }}
    >
      {image ? (
        <img
          src={image}
          alt={imageAlt ?? ""}
          className="shrink-0 block object-cover"
          style={{
            width: THUMB_SIZE,
            height: THUMB_SIZE,
            borderTopLeftRadius: ROW_RADIUS - 1.5,
            borderBottomLeftRadius: ROW_RADIUS - 1.5,
          }}
        />
      ) : (
        <div
          className="shrink-0 flex items-center justify-center"
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: "#fff",
            border: "1px solid rgba(33,75,54,0.10)",
          }}
        >
          {icon}
        </div>
      )}
      <span className="flex-1 text-left text-sm font-medium">{label}</span>
      <span
        className="shrink-0 flex items-center justify-center"
        style={{
          width: 22,
          height: 22,
          borderRadius: 6,
          background: selected ? GREEN_DARK : "#fff",
          border: `1.5px solid ${selected ? GREEN_DARK : "rgba(33,75,54,0.25)"}`,
        }}
      >
        {selected && <Check className="w-3.5 h-3.5" style={{ color: LIME }} />}
      </span>
    </button>
  );
}

export function IconTileOption({
  icon,
  label,
  selected,
  onClick,
  testId,
}: {
  icon: ReactNode;
  label: ReactNode;
  selected: boolean;
  onClick: () => void;
  testId?: string;
}) {
  return (
    <button
      type="button"
      data-testid={testId}
      onClick={() => { hapticTap("SOFT"); onClick(); }}
      className="flex flex-col items-center justify-center gap-2 p-3 transition-all"
      style={{
        borderRadius: 18,
        background: selected ? LIME : TILE_LIGHT,
        border: `1.5px solid ${selected ? GREEN_DARK : "transparent"}`,
        color: GREEN_DARK,
        minHeight: 110,
      }}
    >
      <div
        className="flex items-center justify-center"
        style={{
          width: 44,
          height: 44,
          borderRadius: 999,
          background: "#fff",
        }}
      >
        {icon}
      </div>
      <span className="text-xs font-semibold text-center leading-tight">{label}</span>
    </button>
  );
}

export function PairedTile({
  topLabel,
  bigLabel,
  bottomLabel,
  selected,
  onClick,
  testId,
}: {
  topLabel: string;
  bigLabel: string;
  bottomLabel: string;
  selected: boolean;
  onClick: () => void;
  testId?: string;
}) {
  return (
    <button
      type="button"
      data-testid={testId}
      onClick={() => { hapticTap("SOFT"); onClick(); }}
      className="flex-1 flex flex-col items-center gap-1 p-3 transition-all relative"
      style={{
        borderRadius: 18,
        background: selected ? LIME : "#fff",
        border: `1.5px solid ${selected ? GREEN_DARK : "rgba(33,75,54,0.12)"}`,
        color: GREEN_DARK,
        minHeight: 110,
      }}
    >
      {selected && (
        <div
          className="absolute top-2 right-2 flex items-center justify-center"
          style={{
            width: 22,
            height: 22,
            borderRadius: 999,
            background: GREEN_DARK,
          }}
        >
          <Check className="w-3.5 h-3.5" style={{ color: LIME }} />
        </div>
      )}
      <span className="text-[11px] uppercase tracking-wide opacity-70">{topLabel}</span>
      <span className="text-xl font-bold" style={{ fontFamily: "'Playfair Display', serif" }}>
        {bigLabel}
      </span>
      <span className="text-[11px] mt-auto opacity-80">{bottomLabel}</span>
    </button>
  );
}

export function DarkInsetTile({
  icon,
  image,
  label,
  value,
  selected,
  onClick,
  testId,
}: {
  icon: ReactNode;
  image?: string;
  label: string;
  value?: string;
  selected: boolean;
  onClick: () => void;
  testId?: string;
}) {
  const hasImage = Boolean(image);
  return (
    <button
      type="button"
      data-testid={testId}
      onClick={() => { hapticTap("SOFT"); onClick(); }}
      className="w-full flex items-center gap-3 px-3 py-3 transition-all"
      style={{
        borderRadius: 16,
        background: selected ? LIME : GREEN_DEEP_2,
        color: selected ? GREEN_DARK : "#e8f3df",
        border: `1.5px solid ${selected ? LIME : "rgba(255,255,255,0.06)"}`,
        position: hasImage ? "relative" : undefined,
        overflow: hasImage ? "hidden" : undefined,
        minHeight: hasImage ? 96 : undefined,
      }}
    >
      <span
        className="font-semibold text-sm flex-1 text-left"
        style={hasImage ? { position: "relative", zIndex: 1, paddingRight: 104 } : undefined}
      >
        {label}
      </span>
      {value && (
        <span
          className="px-3 py-1 text-sm font-bold flex items-center gap-1.5"
          style={{
            borderRadius: 10,
            background: selected ? "rgba(33,75,54,0.15)" : "rgba(0,0,0,0.25)",
            color: selected ? GREEN_DARK : "#fff",
          }}
        >
          {value}
          {selected && <Check className="w-3.5 h-3.5" />}
        </span>
      )}
      {hasImage ? (
        <img
          src={image}
          alt=""
          aria-hidden
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            bottom: 0,
            aspectRatio: "1 / 1",
            height: "100%",
            width: "auto",
            objectFit: "contain",
            pointerEvents: "none",
          }}
        />
      ) : (
        <span className="shrink-0">{icon}</span>
      )}
    </button>
  );
}

export const palette = {
  GREEN_DARK,
  GREEN_DEEP,
  LIME,
  LIME_SOFT,
  CARD_LIGHT,
  TILE_LIGHT,
};
