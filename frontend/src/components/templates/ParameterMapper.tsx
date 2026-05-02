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
  sampleValues?: string[];
  isSaving: boolean;
  onSave: (mappings: Record<string, string>) => Promise<void>;
}

function extractVariables(text: string): string[] {
  const matches = text.match(/\{\{\d+\}\}/g) || [];
  return Array.from(new Set(matches));
}

const AUTO_FIELD_RULES: Array<{ test: RegExp; value: string }> = [
  { test: /reference|id\b|token|ticket/i, value: "grievanceId" },
  { test: /name|citizen|applicant|person/i, value: "citizenName" },
  { test: /officer|admin|assignee|assigned by/i, value: "adminName" },
  { test: /detail|description|issue|remarks|message/i, value: "description" },
];

function inferMappingFromBody(bodyText: string, variable: string): string {
  const variablePattern = variable.replace(/[{}]/g, "\\$&");
  const lineMatch = bodyText.match(new RegExp(`[^\\n]*${variablePattern}[^\\n]*`, "i"));
  const context = lineMatch?.[0] || "";
  const detectedRule = AUTO_FIELD_RULES.find((rule) => rule.test.test(context));
  if (detectedRule) return detectedRule.value;
  return "";
}

export default function ParameterMapper({
  templateName,
  bodyText,
  initialMapping,
  sampleValues = [],
  isSaving,
  onSave,
}: ParameterMapperProps) {
  const variables = useMemo(() => extractVariables(bodyText), [bodyText]);
  const [mappingState, setMappingState] = useState<Record<string, string>>(() => initialMapping || {});
  const [customValues, setCustomValues] = useState<Record<string, string>>({});
  const [customMode, setCustomMode] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setMappingState(initialMapping || {});
    const sampleByVariable = variables.reduce<Record<string, string>>((acc, variable) => {
      const index = Number(variable.replace(/[{}]/g, "")) - 1;
      if (index >= 0 && sampleValues[index]) {
        acc[variable] = sampleValues[index];
      }
      return acc;
    }, {});
    setCustomValues(sampleByVariable);
    setCustomMode({});
  }, [initialMapping, templateName, sampleValues, variables]);

  const setVariableMapping = (variable: string, value: string) => {
    if (value === "custom") {
      const existing = mappingState[variable] || customValues[variable] || "";
      setCustomValues((prev) => ({ ...prev, [variable]: existing || prev[variable] || "" }));
      setCustomMode((prev) => ({ ...prev, [variable]: true }));
      setMappingState((prev) => ({ ...prev, [variable]: "" })); // keep canonical custom value in customValues
      return;
    }
    setCustomMode((prev) => ({ ...prev, [variable]: false }));
    setMappingState((prev) => ({ ...prev, [variable]: value }));
  };

  const autoSyncMappings = () => {
    setMappingState((prev) =>
      variables.reduce<Record<string, string>>((acc, variable) => {
        const alreadyMapped = prev[variable] || customValues[variable];
        if (alreadyMapped?.trim()) {
          acc[variable] = prev[variable] || "";
          return acc;
        }
        const inferred = inferMappingFromBody(bodyText, variable);
        acc[variable] = inferred;
        return acc;
      }, { ...prev }),
    );
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
    <div className="rounded-xl border border-slate-200 p-3 sm:p-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
          Parameter Mapping
        </p>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={autoSyncMappings} disabled={isSaving}>
            Auto Sync
          </Button>
          <Button size="sm" onClick={saveMappings} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save Mapping"}
          </Button>
        </div>
      </div>

      {sampleValues.length > 0 && (
        <p className="text-[15px] text-slate-500 mb-3">
          Meta sample values detected and prefilled for quick testing.
        </p>
      )}

      {variables.length === 0 ? (
        <p className="text-sm text-slate-500">No dynamic parameters in this template.</p>
      ) : (
        <div className="space-y-3">
          {variables.map((variable) => {
            const value = mappingState[variable] || "";
            const isCustom = customMode[variable] || (!MAPPING_OPTIONS.includes(value as any) && value.length > 0);

            return (
              <div key={`${templateName}-${variable}`} className="grid grid-cols-1 md:grid-cols-3 gap-2 items-start md:items-center">
                <div className="text-sm font-semibold text-slate-700">{variable}</div>
                <select
                  className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
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
                    className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
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
