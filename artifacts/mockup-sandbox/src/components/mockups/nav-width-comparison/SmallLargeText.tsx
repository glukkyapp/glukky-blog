import { ComparisonPreview } from "./_shared/ComparisonPreview";
import "./_group.css";

export function SmallLargeText() {
  return <ComparisonPreview phoneWidth={320} phoneHeight={568} largeText name="Small phone · large-text mode" />;
}