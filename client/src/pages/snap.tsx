import { Camera } from "lucide-react";
import { useTranslation } from "react-i18next";

export default function Snap() {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] gap-3 px-6 text-center">
      <Camera className="w-12 h-12 text-muted-foreground" strokeWidth={1.5} />
      <p className="text-base font-medium text-muted-foreground">{t("home.coming_soon")}</p>
    </div>
  );
}
