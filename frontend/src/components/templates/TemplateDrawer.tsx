import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { WhatsAppTemplate, TemplateValidationState } from "@/types/whatsappTemplate";
import TemplatePreview from "./TemplatePreview";
import ParameterMapper, { extractVariables } from "./ParameterMapper";

const badgeByStatus: Record<string, string> = {
  APPROVED: "bg-emerald-100 text-emerald-700",
  PENDING: "bg-amber-100 text-amber-700",
  REJECTED: "bg-red-100 text-red-700",
};

interface TemplateDrawerProps {
  open: boolean;
  template: WhatsAppTemplate | null;
  companyId: string;
  isSavingMapping: boolean;
  isSending: boolean;
  onClose: () => void;
  onSaveMapping: (templateName: string, mappings: Record<string, string>) => Promise<void>;
  onSend: (payload: { to: string; templateName: string; parameters: string[]; language: string }) => Promise<void>;
}

function getValidationState(template: WhatsAppTemplate): TemplateValidationState {
  if (template.status !== "APPROVED") return "NOT_APPROVED";
  const vars = extractVariables(template.body.text);
  const mapping = template.mapping || {};
  const allMapped = vars.every((param) => Boolean(mapping[param.replace(/[{}]/g, "")]));
  if (!allMapped || !template.language) return "MISSING_MAPPING";
  return "READY";
}

export default function TemplateDrawer({
  open,
  template,
  companyId,
  isSavingMapping,
  isSending,
  onClose,
  onSaveMapping,
  onSend,
}: TemplateDrawerProps) {
  const [to, setTo] = useState("");
  const [overrideValues, setOverrideValues] = useState<Record<string, string>>({});

  const validation = useMemo(() => (template ? getValidationState(template) : "NOT_APPROVED"), [template]);

  if (!template) return null;

  const variables = extractVariables(template.body.text);
  const mapping = template.mapping || {};

  const autoFillParameters = variables.map((variable) => {
    const key = variable.replace(/[{}]/g, "");
    return overrideValues[key] ?? mapping[key] ?? "";
  });

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) onClose(); }}>
      <DialogContent className="w-[95vw] sm:w-full max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{template.name}</DialogTitle>
          <DialogDescription>
            <span className="inline-flex items-center gap-2">
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${badgeByStatus[template.status]}`}>
                {template.status}
              </span>
              <span>{template.language}</span>
              <span>•</span>
              <span>{template.category}</span>
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <TemplatePreview bodyText={template.body.text} />

          <ParameterMapper
            templateName={template.name}
            bodyText={template.body.text}
            initialMapping={Object.entries(mapping).reduce<Record<string, string>>((acc, [key, value]) => {
              acc[`{{${key}}}`] = value;
              return acc;
            }, {})}
            isSaving={isSavingMapping}
            onSave={(updated) => onSaveMapping(template.name, updated)}
          />

          {template.buttons?.length > 0 && (
            <div className="rounded-xl border border-slate-200 p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Buttons</p>
              <div className="space-y-2">
                {template.buttons.map((button, index) => (
                  <div key={`${button.text}-${index}`} className="flex items-center justify-between rounded-lg bg-slate-50 p-2 text-sm">
                    <span>{button.text}</span>
                    <span className="text-xs text-slate-500">{button.type}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-xl border border-slate-200 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Use Template</p>
              <span className="text-xs font-semibold">
                {validation === "READY" && "✅ Ready"}
                {validation === "MISSING_MAPPING" && "⚠ Missing Mapping"}
                {validation === "NOT_APPROVED" && "❌ Not Approved"}
              </span>
            </div>

            <input
              className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
              placeholder="Recipient phone number"
              value={to}
              onChange={(event) => setTo(event.target.value)}
            />

            {variables.length > 0 && (
              <div className="space-y-2">
                {variables.map((param) => {
                  const key = param.replace(/[{}]/g, "");
                  return (
                    <input
                      key={key}
                      className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                      value={overrideValues[key] ?? mapping[key] ?? ""}
                      onChange={(event) =>
                        setOverrideValues((prev) => ({ ...prev, [key]: event.target.value }))
                      }
                      placeholder={`${param} value`}
                    />
                  );
                })}
              </div>
            )}

            <Button
              className="w-full"
              disabled={validation !== "READY" || !to || isSending || !companyId}
              onClick={() =>
                onSend({
                  to,
                  templateName: template.name,
                  parameters: autoFillParameters,
                  language: template.language,
                })
              }
            >
              {isSending ? "Sending..." : "Send Template"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export { getValidationState };
