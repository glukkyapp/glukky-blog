import { Cherry, Check, Droplets, Edit3, Scale, UtensilsCrossed } from "lucide-react";
import { Label } from "@/components/ui/label";

export interface MealDetailOption { id: string; label: string; }
export interface EditableMealDetailCardProps {
  name: string; portion: string; sauces: string; extras: string;
  portionOptions: string[]; portionIdMap?: Record<string, string>;
  sauceOptions?: MealDetailOption[]; toppingOptions?: MealDetailOption[];
  sauceIds: string[]; toppingIds: string[]; sauceManual: boolean; toppingManual: boolean;
  labels: { name: string; portion: string; sauces: string; extras: string; namePlaceholder: string; saucesPlaceholder: string; extrasPlaceholder: string; somethingElse: string; edit: string; };
  onNameChange: (value: string) => void; onPortionChange: (label: string, id: string | null) => void;
  onSaucesChange: (value: string) => void; onExtrasChange: (value: string) => void;
  onToggleSauce: (option: MealDetailOption) => void; onToggleTopping: (option: MealDetailOption) => void;
  onSauceManual: () => void; onToppingManual: () => void;
}

export function EditableMealDetailCard(props: EditableMealDetailCardProps) {
  const { labels } = props;
  const renderOptions = (kind: "sauce" | "topping") => {
    const options = kind === "sauce" ? props.sauceOptions : props.toppingOptions;
    const ids = kind === "sauce" ? props.sauceIds : props.toppingIds;
    const manual = kind === "sauce" ? props.sauceManual : props.toppingManual;
    const value = kind === "sauce" ? props.sauces : props.extras;
    const placeholder = kind === "sauce" ? labels.saucesPlaceholder : labels.extrasPlaceholder;
    const inputId = kind === "sauce" ? "snap-sauces" : "snap-extras";
    const testId = kind === "sauce" ? "input-snap-sauces" : "input-snap-extras";
    if (options?.length && !manual) return <div className="snap-option-list" data-testid={kind === "sauce" ? "dropdown-snap-sauces" : "dropdown-snap-extras"}>
      {options.map((option) => <button type="button" key={option.id} onClick={() => kind === "sauce" ? props.onToggleSauce(option) : props.onToggleTopping(option)} className={`snap-option-chip ${ids.includes(option.id) ? "is-selected" : ""}`} data-testid={`${kind === "sauce" ? "chip-sauce" : "chip-topping"}-${option.id}`}>{option.label}</button>)}
      <button type="button" onClick={kind === "sauce" ? props.onSauceManual : props.onToppingManual} className="snap-option-chip is-manual" data-testid={kind === "sauce" ? "chip-sauce-other" : "chip-topping-other"}>{labels.somethingElse}</button>
    </div>;
    return <textarea id={inputId} value={value} onChange={(e) => kind === "sauce" ? props.onSaucesChange(e.target.value) : props.onExtrasChange(e.target.value)} placeholder={placeholder} className="snap-text-entry" data-testid={testId} />;
  };
  return <div className="snap-review-stack">
    <section className="snap-review-card">
      <div className="snap-field-heading"><span className="snap-field-icon"><UtensilsCrossed size={19} /></span><Label htmlFor="snap-name">{labels.name}</Label><span className="snap-edit-note"><Edit3 size={13} className="inline mr-1" />{labels.edit}</span></div>
      <textarea id="snap-name" value={props.name} onChange={(e) => props.onNameChange(e.target.value)} placeholder={labels.namePlaceholder} className="snap-text-entry" data-testid="input-snap-name" />
    </section>
    <section className="snap-review-card">
      <div className="snap-field-heading"><span className="snap-field-icon"><Scale size={19} /></span><span>{labels.portion}</span></div>
      <div className="snap-portion-grid" data-testid="input-snap-portion">{props.portionOptions.map((option, index) => { const id = props.portionIdMap?.[option] ?? ["small", "medium", "large"][index] ?? option; const active = props.portion.toLowerCase() === id.toLowerCase() || props.portion === option; return <button type="button" key={`${id}-${option}`} onClick={() => props.onPortionChange(option, id)} className={`snap-portion-button ${active ? "is-selected" : ""}`} data-testid={`chip-portion-${id}`}>{option}</button>; })}</div>
    </section>
    <div className="snap-paired-fields">
      <section className="snap-review-card"><div className="snap-field-heading"><span className="snap-field-icon"><Droplets size={17} /></span><span>{labels.sauces}</span></div>{renderOptions("sauce")}</section>
      <section className="snap-review-card"><div className="snap-field-heading"><span className="snap-field-icon"><Cherry size={17} /></span><span>{labels.extras}</span></div>{renderOptions("topping")}</section>
    </div>
  </div>;
}