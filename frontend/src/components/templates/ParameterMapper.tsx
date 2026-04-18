import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";

const MAPPING_OPTIONS = [
  "grievanceId",
  "citizenName",
  "description",
  "adminName",
  "custom",
] as const;

interface ParameterMapperProps {
  templateName: string;
  bodyText: string;
  initialMapping: Record<string, string>;
  isSaving: boolean;
  onSave: (mappings: Record<string, string>) => Promise<void>;
}

function extractVariables(text: string): string[] {
  const matches = text.match(/\{\{\d+\}\}/g) || [];
  return Array.from(new Set(matches));
}

export default function ParameterMapper({
  templateName,
  bodyText,
  initialMapping,
  isSaving,
  onSave,
}: ParameterMapperProps) {
  const variables = useMemo(() => extractVariables(bodyText), [bodyText]);
  const [mappingState, setMappingState] = useState<Record<string, string>>(() => initialMapping || {});
  const [customValues, setCustomValues] = useState<Record<string, string>>({});

  useEffect(() => {
    setMappingState(initialMapping || {});
    setCustomValues({});
  }, [initialMapping, templateName]);

  const setVariableMapping = (variable: string, value: string) => {
    if (value === "custom") {
      const existing = mappingState[variable] || "";
      setCustomValues((prev) => ({ ...prev, [variable]: existing }));
      setMappingState((prev) => ({ ...prev, [variable]: "" }));
      return;
    }
    setMappingState((prev) => ({ ...prev, [variable]: value }));
  };

  const saveMappings = async () => {
    const cleaned = variables.reduce<Record<string, string>>((acc, variable) => {
      const mappedValue = mappingState[variable] || customValues[variable] || "";
      if (mappedValue.trim()) {
        const key = variable.replace(/[{}]/g, "");
        acc[key] = mappedValue.trim();
      }
      return acc;
    }, {});

    await onSave(cleaned);
  };

  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
          Parameter Mapping
        </p>
        <Button size="sm" onClick={saveMappings} disabled={isSaving}>
          {isSaving ? "Saving..." : "Save Mapping"}
        </Button>
      </div>

      {variables.length === 0 ? (
        <p className="text-sm text-slate-500">No dynamic parameters in this template.</p>
      ) : (
        <div className="space-y-3">
          {variables.map((variable) => {
            const value = mappingState[variable] || "";
            const isCustom = !MAPPING_OPTIONS.includes(value as any) && value.length > 0;

            return (
              <div key={`${templateName}-${variable}`} className="grid grid-cols-1 md:grid-cols-3 gap-2 items-center">
                <div className="text-sm font-semibold text-slate-700">{variable}</div>
                <select
                  className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                  value={isCustom ? "custom" : value}
                  onChange={(event) => setVariableMapping(variable, event.target.value)}
                >
                  <option value="">Select variable</option>
                  {MAPPING_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
                {(isCustom || customValues[variable]) && (
                  <input
                    className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                    placeholder="Custom input"
                    value={customValues[variable] ?? value}
                    onChange={(event) => setCustomValues((prev) => ({ ...prev, [variable]: event.target.value }))}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export { extractVariables };
