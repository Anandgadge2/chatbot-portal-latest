"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import { Search, ChevronDown, Check, X, ArrowRight } from "lucide-react";

interface Option {
  value: string;
  label: string;
}

interface SearchableSelectProps {
  options: Option[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  emptyMessage?: string;
  className?: string;
  triggerClassName?: string;
  disabled?: boolean;
  action?: React.ReactNode;
  actionInHeader?: boolean;
}

export const SearchableSelect: React.FC<SearchableSelectProps> = ({
  options,
  value,
  onValueChange,
  placeholder = "Select an option...",
  emptyMessage = "No results found.",
  className = "",
  triggerClassName = "",
  disabled = false,
  action,
  actionInHeader = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  const filteredOptions = useMemo(() => {
    return options
      .filter((opt) =>
        opt.label.toLowerCase().includes(searchTerm.toLowerCase())
      )
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [options, searchTerm]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setSearchTerm("");
    }
  }, [isOpen]);

  const handleToggle = () => {
    if (!disabled) {
      setIsOpen(!isOpen);
    }
  };

  const handleSelect = (selectedValue: string) => {
    onValueChange(selectedValue);
    setIsOpen(false);
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={handleToggle}
        disabled={disabled}
        className={`w-full flex items-center gap-2 justify-between px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-[11px] font-bold uppercase tracking-wide shadow-sm transition-all ${
          disabled ? "bg-slate-50 text-slate-300 cursor-not-allowed" : "hover:border-indigo-300 hover:shadow-md focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-700"
        } ${triggerClassName}`}
      >
        <span className={`text-left truncate ${!selectedOption ? "text-slate-400" : ""}`}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform flex-shrink-0 ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="absolute z-[110] w-full mt-2 bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 origin-top">
          <div className="p-2.5 border-b border-slate-100 bg-slate-50/50">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input
                  type="text"
                  autoFocus
                  placeholder="Quick search..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-2 text-[11px] bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-bold uppercase tracking-tight placeholder:normal-case"
                  onClick={(e) => e.stopPropagation()}
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setSearchTerm(""); }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-100 rounded-full transition-colors"
                  >
                    <X className="w-3 h-3 text-slate-400 hover:text-slate-600" />
                  </button>
                )}
              </div>
              {action && actionInHeader && (
                <div 
                  className="flex-shrink-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  {action}
                </div>
              )}
            </div>
          </div>
          <div className="max-h-[300px] overflow-y-auto p-1.5 custom-scrollbar">
            {filteredOptions.length === 0 ? (
              <div className="py-8 text-center flex flex-col items-center justify-center gap-2">
                <div className="w-10 h-10 bg-slate-50 rounded-full flex items-center justify-center">
                  <Search className="w-5 h-5 text-slate-200" />
                </div>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">
                  {emptyMessage}
                </span>
              </div>
            ) : (
              filteredOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handleSelect(opt.value)}
                  className={`w-full flex items-center gap-3 justify-between px-3.5 py-3 text-[11px] font-bold uppercase tracking-wide rounded-xl transition-all text-left group ${
                    opt.value === value
                      ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200"
                      : "text-slate-600 hover:bg-slate-50 hover:text-indigo-600 hover:translate-x-1"
                  }`}
                >
                  <span className="break-words whitespace-normal leading-relaxed">{opt.label}</span>
                  {opt.value === value ? (
                    <Check className="w-3.5 h-3.5 flex-shrink-0" />
                  ) : (
                    <ArrowRight className="w-3.5 h-3.5 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all text-indigo-400" />
                  )}
                </button>
              ))
            )}
          </div>
          {action && !actionInHeader && (
            <div className="p-2 border-t border-slate-100 bg-slate-50/50">
              {action}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
