interface TemplatePreviewProps {
  header?: { type: string | null; content: string };
  bodyText: string;
  footer?: string;
}

export default function TemplatePreview({ header, bodyText, footer }: TemplatePreviewProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="bg-slate-50 border-b border-slate-100 px-4 py-2">
        <p className="text-[14px] font-bold uppercase tracking-wider text-slate-400">
          Message Preview
        </p>
      </div>
      <div className="p-4 space-y-2">
        {header?.content && (
          <div className="text-sm font-bold text-slate-900 border-b border-slate-50 pb-2 mb-2">
            {header.type === 'IMAGE' && <div className="aspect-video bg-slate-100 rounded-lg flex items-center justify-center text-xs text-slate-400 mb-2 italic">Image Header Placeholder</div>}
            {header.content}
          </div>
        )}
        
        <pre className="text-[15px] text-slate-700 whitespace-pre-wrap font-sans leading-relaxed">
          {bodyText || "No body content"}
        </pre>

        {footer && (
          <div className="text-[15px] text-slate-400 mt-2 pt-2 border-t border-slate-50">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
