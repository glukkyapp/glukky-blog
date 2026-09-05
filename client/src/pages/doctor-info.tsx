import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, Building2, CalendarDays, MapPin, NotebookPen, Phone, Stethoscope } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { hapticNotify } from "@/lib/haptics";

interface DoctorInfo {
  doctorName: string | null;
  clinicName: string | null;
  officePhone: string | null;
  address: string | null;
  nextVisitDate: string | null;
  notes: string | null;
}

type DoctorInfoForm = {
  doctorName: string;
  clinicName: string;
  officePhone: string;
  address: string;
  nextVisitDate: string;
  notes: string;
};

const EMPTY_FORM: DoctorInfoForm = {
  doctorName: "",
  clinicName: "",
  officePhone: "",
  address: "",
  nextVisitDate: "",
  notes: "",
};

function formFromDoctorInfo(info: DoctorInfo | null | undefined): DoctorInfoForm {
  return {
    doctorName: info?.doctorName ?? "",
    clinicName: info?.clinicName ?? "",
    officePhone: info?.officePhone ?? "",
    address: info?.address ?? "",
    nextVisitDate: info?.nextVisitDate ?? "",
    notes: info?.notes ?? "",
  };
}

export default function DoctorInfoPage() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [form, setForm] = useState<DoctorInfoForm>(EMPTY_FORM);

  const { data: doctorInfo, isLoading } = useQuery<DoctorInfo | null>({
    queryKey: ["/api/profile/doctor-info"],
  });

  useEffect(() => {
    if (!isLoading) setForm(formFromDoctorInfo(doctorInfo));
  }, [doctorInfo, isLoading]);

  const saveMutation = useMutation({
    mutationFn: async (data: DoctorInfoForm) => {
      const res = await apiRequest("PATCH", "/api/profile/doctor-info", {
        doctorName: data.doctorName.trim() || null,
        clinicName: data.clinicName.trim() || null,
        officePhone: data.officePhone.trim() || null,
        address: data.address.trim() || null,
        nextVisitDate: data.nextVisitDate || null,
        notes: data.notes.trim() || null,
      });
      return res.json();
    },
    onSuccess: () => {
      hapticNotify("SUCCESS");
      queryClient.invalidateQueries({ queryKey: ["/api/profile/doctor-info"] });
      toast({ title: t("profile.doctor_saved") });
      setLocation("/profile");
    },
    onError: () => {
      hapticNotify("ERROR");
      toast({ title: t("profile.doctor_save_error"), variant: "destructive" });
    },
  });

  const updateField = (field: keyof DoctorInfoForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  return (
    <div className="app-page-v2 min-h-screen bg-background" data-testid="doctor-info-page">
      <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-border bg-background/95 px-4 backdrop-blur">
        <button
          type="button"
          onClick={() => setLocation("/profile")}
          className="flex h-9 w-9 items-center justify-center rounded-full text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={t("profile.profile_back")}
          data-testid="button-doctor-back"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
        </button>
        <h1 className="text-base font-semibold text-foreground" data-testid="text-doctor-title">
          {t("profile.doctor_title")}
        </h1>
        <Button
          type="submit"
          form="doctor-info-form"
          variant="ghost"
          className="px-2 text-primary"
          disabled={isLoading || saveMutation.isPending}
          data-testid="button-save-doctor-info"
        >
          {saveMutation.isPending ? t("profile.doctor_saving") : t("profile.profile_save")}
        </Button>
      </header>

      <main className="mx-auto max-w-sm px-4 pb-24">
        <form
          id="doctor-info-form"
          onSubmit={(event) => {
            event.preventDefault();
            saveMutation.mutate(form);
          }}
          className="space-y-4 pt-5"
        >
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="mb-4 flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Stethoscope className="h-6 w-6" aria-hidden="true" />
              </div>
              <p className="pt-1 text-sm leading-relaxed text-muted-foreground" data-testid="text-doctor-instruction">
                {t("profile.doctor_instruction")}
              </p>
            </div>

            <div className="space-y-3">
              <Field
                id="doctor-name"
                label={t("profile.doctor_name")}
                value={form.doctorName}
                onChange={(value) => updateField("doctorName", value)}
                icon={<Stethoscope className="h-4 w-4" aria-hidden="true" />}
                testId="input-doctor-name"
                autoComplete="name"
              />
              <Field
                id="clinic-name"
                label={t("profile.clinic_name")}
                value={form.clinicName}
                onChange={(value) => updateField("clinicName", value)}
                icon={<Building2 className="h-4 w-4" aria-hidden="true" />}
                testId="input-clinic-name"
                autoComplete="organization"
              />
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-4">
            <Field
              id="office-phone"
              label={t("profile.office_phone")}
              value={form.officePhone}
              onChange={(value) => updateField("officePhone", value)}
              icon={<Phone className="h-4 w-4" aria-hidden="true" />}
              testId="input-office-phone"
              type="tel"
              autoComplete="tel"
            />
            <p className="mt-2 pl-7 text-sm text-muted-foreground" data-testid="text-doctor-emergency-disclaimer">
              {t("profile.doctor_emergency_disclaimer")}
            </p>
          </div>

          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="space-y-3">
              <Field
                id="doctor-address"
                label={t("profile.address")}
                value={form.address}
                onChange={(value) => updateField("address", value)}
                icon={<MapPin className="h-4 w-4" aria-hidden="true" />}
                testId="textarea-doctor-address"
                multiline
                rows={3}
                autoComplete="street-address"
              />
              <Field
                id="next-visit-date"
                label={t("profile.next_visit")}
                value={form.nextVisitDate}
                onChange={(value) => updateField("nextVisitDate", value)}
                icon={<CalendarDays className="h-4 w-4" aria-hidden="true" />}
                testId="input-next-visit-date"
                type="date"
              />
              <Field
                id="doctor-notes"
                label={t("profile.notes")}
                value={form.notes}
                onChange={(value) => updateField("notes", value)}
                icon={<NotebookPen className="h-4 w-4" aria-hidden="true" />}
                testId="textarea-doctor-notes"
                multiline
                rows={4}
              />
            </div>
          </div>
        </form>
      </main>
    </div>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  icon,
  testId,
  type = "text",
  multiline = false,
  rows,
  autoComplete,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  icon?: React.ReactNode;
  testId: string;
  type?: string;
  multiline?: boolean;
  rows?: number;
  autoComplete?: string;
}) {
  return (
    <div className="relative">
      {icon && (
        <span className="pointer-events-none absolute left-0 top-3 text-primary/80">
          {icon}
        </span>
      )}
      <label htmlFor={id} className={`mb-1 block text-xs font-medium text-muted-foreground ${icon ? "pl-7" : ""}`}>
        {label}
      </label>
      {multiline ? (
        <Textarea
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          rows={rows}
          className={icon ? "pl-7" : ""}
          data-testid={testId}
          autoComplete={autoComplete}
        />
      ) : (
        <Input
          id={id}
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={icon ? "pl-7" : ""}
          data-testid={testId}
          autoComplete={autoComplete}
        />
      )}
    </div>
  );
}