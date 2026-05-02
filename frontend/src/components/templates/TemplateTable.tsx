import { Button } from "@/components/ui/button";
import { WhatsAppTemplate } from "@/types/whatsappTemplate";
import { extractVariables } from "./ParameterMapper";
import { getValidationState } from "./TemplateDrawer";

const statusStyles: Record<string, string> = {
  APPROVED: "bg-emerald-100 text-emerald-700",
  PENDING: "bg-amber-100 text-amber-700",
  REJECTED: "bg-red-100 text-red-700",
};

interface TemplateTableProps {
  templates: WhatsAppTemplate[];
  onView: (template: WhatsAppTemplate) => void;
  onUse: (template: WhatsAppTemplate) => void;
}

const renderValidationLabel = (state: ReturnType<typeof getValidationState>) => {
  if (state === "READY") return "✅ Ready";
  if (state === "MISSING_MAPPING") return "⚠ Missing Mapping";
  return "❌ Not Approved";
};

export default function TemplateTable({ templates, onView, onUse }: TemplateTableProps) {
  if (!templates.length) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 p-10 text-center text-slate-500">
        No templates found for selected filters.
      </div>
    );
  }

  return (
    <>
      <div className="md:hidden space-y-3">
        {templates.map((template) => {
          const params = extractVariables(template.body.text).length;
          const validation = getValidationState(template);
          return (
            <div key={template._id} className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <h4 className="text-sm font-bold text-slate-800 break-all">{template.name}</h4>
                <span className={`px-2 py-1 rounded-full text-[14px] font-bold ${statusStyles[template.status]}`}>
                  {template.status}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
                <div><span className="font-semibold">Language:</span> {template.language}</div>
                <div><span className="font-semibold">Category:</span> {template.category}</div>
                <div><span className="font-semibold">Params:</span> {params}</div>
                <div><span className="font-semibold">Validation:</span> {renderValidationLabel(validation)}</div>
              </div>
              <div className="text-xs text-slate-500">
                Last synced: {template.lastSyncedAt ? new Date(template.lastSyncedAt).toLocaleString() : "-"}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button size="sm" variant="outline" onClick={() => onView(template)}>
                  View
                </Button>
                <Button size="sm" onClick={() => onUse(template)}>
                  Use
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="hidden md:block overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left">
            <tr>
              <th className="px-4 py-3 font-semibold text-slate-600">Template Name</th>
              <th className="px-4 py-3 font-semibold text-slate-600">Status</th>
              <th className="px-4 py-3 font-semibold text-slate-600">Language</th>
              <th className="px-4 py-3 font-semibold text-slate-600">Category</th>
              <th className="px-4 py-3 font-semibold text-slate-600">Params</th>
              <th className="px-4 py-3 font-semibold text-slate-600">Validation</th>
              <th className="px-4 py-3 font-semibold text-slate-600">Last Synced</th>
              <th className="px-4 py-3 font-semibold text-slate-600">Actions</th>
            </tr>
          </thead>
          <tbody>
            {templates.map((template) => {
              const params = extractVariables(template.body.text).length;
              const validation = getValidationState(template);
              return (
                <tr key={template._id} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-medium text-slate-800 max-w-[260px] break-all">{template.name}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${statusStyles[template.status]}`}>
                      {template.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{template.language}</td>
                  <td className="px-4 py-3 text-slate-600">{template.category}</td>
                  <td className="px-4 py-3 text-slate-600">{params}</td>
                  <td className="px-4 py-3 text-xs font-semibold">
                    {renderValidationLabel(validation)}
                  </td>
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                    {template.lastSyncedAt ? new Date(template.lastSyncedAt).toLocaleString() : "-"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => onView(template)}>
                        View
                      </Button>
                      <Button size="sm" onClick={() => onUse(template)}>
                        Use
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
