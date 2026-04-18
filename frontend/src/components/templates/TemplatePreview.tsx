interface TemplatePreviewProps {
  bodyText: string;
}

export default function TemplatePreview({ bodyText }: TemplatePreviewProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
        Body Preview
      </p>
      <pre className="text-sm text-slate-800 whitespace-pre-wrap font-sans leading-relaxed">
        {bodyText || "No body content"}
      </pre>
    </div>
  );
}
