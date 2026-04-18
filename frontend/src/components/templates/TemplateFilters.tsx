import { Input } from "@/components/ui/input";

interface TemplateFiltersProps {
  search: string;
  status: string;
  language: string;
  category: string;
  languages: string[];
  categories: string[];
  onSearchChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  onLanguageChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
}

export default function TemplateFilters({
  search,
  status,
  language,
  category,
  languages,
  categories,
  onSearchChange,
  onStatusChange,
  onLanguageChange,
  onCategoryChange,
}: TemplateFiltersProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
      <Input
        placeholder="Search template name"
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
      />

      <select
        className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        value={status}
        onChange={(event) => onStatusChange(event.target.value)}
      >
        <option value="">All Statuses</option>
        <option value="APPROVED">Approved</option>
        <option value="PENDING">Pending</option>
        <option value="REJECTED">Rejected</option>
      </select>

      <select
        className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        value={language}
        onChange={(event) => onLanguageChange(event.target.value)}
      >
        <option value="">All Languages</option>
        {languages.map((lang) => (
          <option key={lang} value={lang}>
            {lang}
          </option>
        ))}
      </select>

      <select
        className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        value={category}
        onChange={(event) => onCategoryChange(event.target.value)}
      >
        <option value="">All Categories</option>
        {categories.map((cat) => (
          <option key={cat} value={cat}>
            {cat}
          </option>
        ))}
      </select>
    </div>
  );
}
