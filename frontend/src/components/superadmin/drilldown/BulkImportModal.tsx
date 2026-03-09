"use client";

import React, { useState } from "react";
import {
  Upload,
  AlertCircle,
  FileSpreadsheet,
  Info,
  Download,
} from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { importAPI } from "@/lib/api/import";
import LoadingSpinner from "@/components/ui/LoadingSpinner";

interface BulkImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  companyId: string;
  onSuccess: () => void;
}

export default function BulkImportModal({
  isOpen,
  onClose,
  companyId,
  onSuccess,
}: BulkImportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [totalRows, setTotalRows] = useState(0);
  const [currentRow, setCurrentRow] = useState(0);

  if (!isOpen) return null;

  const downloadTemplate = () => {
    importAPI
      .downloadTemplate("drilldown-hierarchy")
      .catch(() => toast.error("Failed to download sample template"));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleImport = async () => {
    if (!file) {
      toast.error("Please select a file first");
      return;
    }

    setImporting(true);
    setProgress(30);
    setCurrentRow(0);
    setTotalRows(0);

    try {
      const response = await importAPI.importDrilldownHierarchy(file, companyId);
      setProgress(100);
      setTotalRows(response.data.total);
      setCurrentRow(response.data.total);

      toast.success(
        `Import complete! ${response.data.success} successful, ${response.data.failed} failed.`,
      );

      if (response.data.failed > 0) {
        console.warn("Import row errors:", response.data.errors);
      }

      setImporting(false);
      onSuccess();
      onClose();
    } catch (error) {
      toast.error("Import failed. Please check the template and try again.");
      setImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200">
        <div className="bg-slate-900 px-6 py-5 border-b border-slate-800 relative">
          <div
            className="absolute inset-0 opacity-[0.05]"
            style={{
              backgroundImage: "radial-gradient(#ffffff 1px, transparent 1px)",
              backgroundSize: "24px 24px",
            }}
          ></div>
          <div className="relative flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-500/20 rounded-xl flex items-center justify-center border border-indigo-500/30">
              <Upload className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white uppercase tracking-tight">
                Bulk Import Departments
              </h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                Onboarding System
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="absolute right-6 top-6 text-slate-400 hover:text-white"
          >
            <AlertCircle className="w-5 h-5 rotate-45" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {!importing ? (
            <>
              <div className="bg-slate-50 border border-dashed border-slate-300 rounded-xl p-8 flex flex-col items-center justify-center text-center group hover:border-indigo-400 transition-colors">
                <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm mb-4 group-hover:scale-110 transition-transform">
                  <FileSpreadsheet className="w-6 h-6 text-slate-400 group-hover:text-indigo-500" />
                </div>
                <p className="text-sm font-bold text-slate-700 mb-1">
                  {file ? file.name : "Select Excel File"}
                </p>
                <p className="text-xs text-slate-400 mb-4">
                  Supported formats: .xlsx, .xls
                </p>
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileChange}
                  className="hidden"
                  id="excel-upload"
                />
                <label
                  htmlFor="excel-upload"
                  className="px-6 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold uppercase cursor-pointer hover:bg-slate-50 shadow-sm"
                >
                  Choose File
                </label>
              </div>

              <div className="flex items-start gap-3 p-4 bg-indigo-50 rounded-xl border border-indigo-100">
                <Info className="w-5 h-5 text-indigo-500 flex-shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-xs font-bold text-indigo-900 uppercase">
                    Pro Tip
                  </p>
                  <p className="text-xs text-indigo-700 leading-relaxed">
                    Download the sample sheet to import main/sub departments,
                    their admins and users with email, phone, designation,
                    serial number and description in one upload.
                  </p>
                  <button
                    onClick={downloadTemplate}
                    className="text-xs font-black text-indigo-600 hover:underline flex items-center gap-1 mt-2 uppercase tracking-tighter"
                  >
                    <Download className="w-3 h-3" />
                    Download Sample Template
                  </button>
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  variant="ghost"
                  className="flex-1 uppercase text-xs font-bold"
                  onClick={onClose}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1 bg-slate-900 hover:bg-slate-800 text-white uppercase text-xs font-bold"
                  onClick={handleImport}
                  disabled={!file}
                >
                  Start Import
                </Button>
              </div>
            </>
          ) : (
            <div className="space-y-6 py-4">
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-50 rounded-full mb-4">
                  <LoadingSpinner />
                </div>
                <h4 className="text-base font-bold text-slate-900">
                  Importing Data...
                </h4>
                <p className="text-xs text-slate-500 mt-1">
                  Processing row {currentRow} of {totalRows}
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-[10px] font-black uppercase text-slate-400">
                  <span>Progress</span>
                  <span>{progress}%</span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-indigo-500 transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
