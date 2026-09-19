import { Camera, ClipboardList, Home, TrendingUp, User } from "lucide-react";
import type { CSSProperties } from "react";
import "../_group.css";

type PreviewProps = {
  phoneWidth: 320 | 430;
  phoneHeight: 568 | 932;
  largeText?: boolean;
  name: string;
};

const items = [
  { label: "Home", Icon: Home, active: true },
  { label: "Report", Icon: ClipboardList, active: false },
  { label: "Snap", Icon: Camera, active: false },
  { label: "Glucose", Icon: TrendingUp, active: false },
  { label: "Profile", Icon: User, active: false },
];

function Phone({ phoneWidth, phoneHeight, largeText, width, variant }: {
  phoneWidth: 320 | 430;
  phoneHeight: 568 | 932;
  largeText?: boolean;
  width: "compact" | "envelope";
  variant: string;
}) {
  const actualWidth = Math.min(width === "compact" ? 296 : 384, phoneWidth - 32);
  const itemWidth = (actualWidth - 16) / 5;
  return (
    <section className="phone-column" aria-label={`${variant} navigation preview`}>
      <p className="hypothesis-label">{variant}</p>
      <div
        className={`phone${largeText ? " large-text" : ""}`}
        style={{ "--phone-width": `${phoneWidth}px`, "--phone-height": `${phoneHeight}px`, "--nav-width": `${actualWidth}px`, "--label-size": "12px" } as CSSProperties}
      >
        <div className="phone-status">08:42&nbsp;&nbsp; GLUKKY</div>
        <div className="phone-content">
          <h2 className="phone-greeting">Good morning, Mei</h2>
          <p className="phone-date">Tuesday, 18 June · your day at a glance</p>
          <article className="fake-card">
            <p className="fake-card-label">Today’s glucose</p>
            <p className="fake-card-value">Steady morning</p>
            <p className="fake-card-note">A gentle start. Keep your usual rhythm.</p>
          </article>
          <article className="fake-card">
            <p className="fake-card-label">Next small step</p>
            <p className="fake-card-value">Have some water</p>
            <p className="fake-card-note">Your companion is here when you need it.</p>
          </article>
        </div>
        <nav className="nav-rail" aria-label="Glukky navigation">
          {items.map(({ label, Icon, active }) => (
            <button className={`nav-item${active ? " active" : ""}`} key={label} type="button" aria-current={active ? "page" : undefined}>
              <Icon strokeWidth={active ? 2.5 : 2} />
              <span>{label}</span>
            </button>
          ))}
        </nav>
      </div>
      <p className="nav-caption">
        Rendered nav: <strong>{actualWidth}px</strong> · each item: <strong>{itemWidth.toFixed(1)}px</strong>
        {phoneWidth === 320 && width === "envelope" ? " · 16px side margins constrain it" : ""}
      </p>
    </section>
  );
}

export function ComparisonPreview({ phoneWidth, phoneHeight, largeText, name }: PreviewProps) {
  return (
    <main className={`nav-comparison${largeText ? " large-text" : ""}`}>
      <header className="comparison-header">
        <p className="comparison-kicker">Glukky · navigation study</p>
        <h1 className="comparison-title">{name}</h1>
        <p className="comparison-subtitle">
          Same extracted five-item structure, icons, active stroke convention, permanent labels, and touch targets.
          The only hypothesis change is the floating bar’s width.
        </p>
      </header>
      <div className="phone-pair">
        <Phone phoneWidth={phoneWidth} phoneHeight={phoneHeight} largeText={largeText} width="compact" variant="A · Compact 296px" />
        <Phone phoneWidth={phoneWidth} phoneHeight={phoneHeight} largeText={largeText} width="envelope" variant="B · Current envelope" />
      </div>
    </main>
  );
}