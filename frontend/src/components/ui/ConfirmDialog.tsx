'use client';

import React from 'react';
import { AlertTriangle, Info, X } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  variant?: 'danger' | 'warning' | 'info';
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  variant = 'danger'
}) => {
  if (!isOpen) return null;

  const variantConfig = {
    danger: {
      iconBg: 'bg-rose-100',
      iconColor: 'text-rose-600',
      headerAccent: 'border-rose-500',
      confirmBtn: 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-900/20',
      Icon: AlertTriangle,
    },
    warning: {
      iconBg: 'bg-amber-100',
      iconColor: 'text-amber-600',
      headerAccent: 'border-amber-500',
      confirmBtn: 'bg-amber-600 hover:bg-amber-700 text-white shadow-amber-900/20',
      Icon: AlertTriangle,
    },
    info: {
      iconBg: 'bg-blue-100',
      iconColor: 'text-blue-600',
      headerAccent: 'border-blue-500',
      confirmBtn: 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-900/20',
      Icon: Info,
    }
  };

  const { iconBg, iconColor, headerAccent, confirmBtn, Icon } = variantConfig[variant];

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Dark Header */}
        <div className={`bg-slate-900 p-5 flex items-start justify-between border-b-4 ${headerAccent}`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 ${iconBg} rounded-xl flex items-center justify-center flex-shrink-0`}>
              <Icon className={`w-5 h-5 ${iconColor}`} />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">{title}</h2>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Confirmation Required</p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all flex-shrink-0"
          >
            <X className="w-4 h-4 text-white" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5">
          <p className="text-sm text-slate-600 leading-relaxed">{message}</p>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-5 py-4 border-t border-slate-100 flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-5 py-2 border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 rounded-lg text-xs font-bold uppercase tracking-wider transition-all"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className={`px-5 py-2 rounded-lg text-xs font-bold uppercase tracking-wider shadow-md transition-all ${confirmBtn}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
