'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { CheckCircle2, Clock, MessageSquare, RefreshCw, Ban, Upload, Trash2, FileText, Image as ImageIcon, FileSpreadsheet, File } from 'lucide-react';
import { apiClient } from '@/lib/api/client';
import toast from 'react-hot-toast';

interface StatusUpdateFormProps {
  itemId: string;
  itemType: 'grievance' | 'appointment';
  currentStatus: string;
  onSuccess: () => void;
  onCancel?: () => void;
  /** For grievance only: 'operator' = 2 buttons (Resolved, Rejected); 'department-admin' = 4 buttons (Pending, Assigned, Resolved, Rejected) */
  grievanceVariant?: 'operator' | 'department-admin';
  initialDate?: string;
  initialTime?: string;
  showCancelButton?: boolean;
}

const grievanceStatusesAll = [
  { value: 'PENDING', label: 'Pending', iconBg: 'bg-amber-100', iconColor: 'text-amber-600', badge: 'bg-amber-50 border-amber-200 text-amber-700', activeBadge: 'bg-amber-500 text-white border-amber-500', Icon: Clock },
  { value: 'IN_PROGRESS', label: 'In Progress', iconBg: 'bg-indigo-100', iconColor: 'text-indigo-600', badge: 'bg-indigo-50 border-indigo-200 text-indigo-700', activeBadge: 'bg-indigo-600 text-white border-indigo-600', Icon: RefreshCw },
  { value: 'RESOLVED', label: 'Resolved', iconBg: 'bg-emerald-100', iconColor: 'text-emerald-600', badge: 'bg-emerald-50 border-emerald-200 text-emerald-700', activeBadge: 'bg-emerald-600 text-white border-emerald-600', Icon: CheckCircle2 },
  { value: 'REJECTED', label: 'Rejected', iconBg: 'bg-rose-100', iconColor: 'text-rose-600', badge: 'bg-rose-50 border-rose-200 text-rose-700', activeBadge: 'bg-rose-600 text-white border-rose-600', Icon: Ban },
];

const grievanceStatusesOperator = [
  { value: 'IN_PROGRESS', label: 'In Progress', iconBg: 'bg-indigo-100', iconColor: 'text-indigo-600', badge: 'bg-indigo-50 border-indigo-200 text-indigo-700', activeBadge: 'bg-indigo-600 text-white border-indigo-600', Icon: RefreshCw },
  { value: 'RESOLVED', label: 'Resolved', iconBg: 'bg-emerald-100', iconColor: 'text-emerald-600', badge: 'bg-emerald-50 border-emerald-200 text-emerald-700', activeBadge: 'bg-emerald-600 text-white border-emerald-600', Icon: CheckCircle2 },
  { value: 'REJECTED', label: 'Rejected', iconBg: 'bg-rose-100', iconColor: 'text-rose-600', badge: 'bg-rose-50 border-rose-200 text-rose-700', activeBadge: 'bg-rose-600 text-white border-rose-600', Icon: Ban },
];

const appointmentStatuses = [
  { value: 'REQUESTED', label: 'Requested', iconBg: 'bg-blue-100', iconColor: 'text-blue-600', badge: 'bg-blue-50 border-blue-200 text-blue-700', activeBadge: 'bg-blue-600 text-white border-blue-600', Icon: Clock },
  { value: 'CONFIRMED', label: 'Confirmed', iconBg: 'bg-indigo-100', iconColor: 'text-indigo-600', badge: 'bg-indigo-50 border-indigo-200 text-indigo-700', activeBadge: 'bg-indigo-600 text-white border-indigo-600', Icon: CheckCircle2 },
  { value: 'COMPLETED', label: 'Completed', iconBg: 'bg-emerald-100', iconColor: 'text-emerald-600', badge: 'bg-emerald-50 border-emerald-200 text-emerald-700', activeBadge: 'bg-emerald-600 text-white border-emerald-600', Icon: CheckCircle2 },
  { value: 'CANCELLED', label: 'Cancelled', iconBg: 'bg-rose-100', iconColor: 'text-rose-600', badge: 'bg-rose-50 border-rose-200 text-rose-700', activeBadge: 'bg-rose-600 text-white border-rose-600', Icon: Ban },
];

const to24Hour = (hour12: number, minute: number, period: 'AM' | 'PM') => {
  let hour24 = hour12 % 12;
  if (period === 'PM') hour24 += 12;
  return `${String(hour24).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
};

function ClockHand({ angle, length, width, color }: { angle: number; length: number; width: number; color: string }) {
  const rad = ((angle - 90) * Math.PI) / 180;
  const cx = 50, cy = 50;
  const x = cx + length * Math.cos(rad);
  const y = cy + length * Math.sin(rad);
  return (
    <line
      x1={cx} y1={cy} x2={x} y2={y}
      stroke={color} strokeWidth={width}
      strokeLinecap="round"
    />
  );
}

function PremiumClockPicker({
  value,
  onChange,
  onClose
}: {
  value: string;
  onChange: (value: string) => void;
  onClose: () => void;
}) {
  const [hour12, setHour12] = useState(12);
  const [minute, setMinute] = useState(0);
  const [period, setPeriod] = useState<'AM' | 'PM'>('AM');
  const [mode, setMode] = useState<'hour' | 'minute'>('hour');
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (value && value.includes(':')) {
      const parts = value.split(':');
      const h24 = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      
      if (!isNaN(h24) && !isNaN(m)) {
        const p = h24 >= 12 ? 'PM' : 'AM';
        let h12 = h24 % 12;
        if (h12 === 0) h12 = 12;
        setHour12(h12);
        setMinute(m);
        setPeriod(p);
      }
    }
  }, [value]);

  const safeHour = isNaN(hour12) ? 12 : hour12;
  const safeMinute = isNaN(minute) ? 0 : minute;

  const hourAngle = ((safeHour % 12) / 12) * 360 + (safeMinute / 60) * 30;
  const minuteAngle = (safeMinute / 60) * 360;

  const getValueFromAngle = useCallback(
    (clientX: number, clientY: number) => {
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = clientX - cx;
      const dy = clientY - cy;
      let angle = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
      if (angle < 0) angle += 360;

      if (mode === "hour") {
        let h = Math.round(angle / 30) % 12;
        if (h === 0) h = 12;
        setHour12(h);
      } else {
        let m = Math.round(angle / 6) % 60;
        setMinute(m);
      }
    },
    [mode]
  );

  const handlePointer = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      const touch = 'touches' in e ? e.touches[0] : e;
      getValueFromAngle(touch.clientX, touch.clientY);
    },
    [getValueFromAngle]
  );

  const ticks = [];
  for (let i = 0; i < (mode === "hour" ? 12 : 60); i++) {
    const isMajor = mode === "minute" ? i % 5 === 0 : true;
    const rad = ((i * (mode === "hour" ? 30 : 6) - 90) * Math.PI) / 180;
    const r1 = isMajor ? 42 : 44;
    const r2 = 48;
    ticks.push(
      <line
        key={i}
        x1={50 + r1 * Math.cos(rad)}
        y1={50 + r1 * Math.sin(rad)}
        x2={50 + r2 * Math.cos(rad)}
        y2={50 + r2 * Math.sin(rad)}
        stroke={isMajor ? "#6366f1" : "rgba(99, 102, 241, 0.2)"}
        strokeWidth={isMajor ? 1.5 : 0.8}
        strokeLinecap="round"
      />
    );
  }

  const labels = [];
  for (let i = 1; i <= 12; i++) {
    const val = mode === "hour" ? i : i * 5;
    const rad = ((i * 30 - 90) * Math.PI) / 180;
    const r = 36;
    const isActive =
      mode === "hour" ? hour12 === i : Math.round(minute / 5) * 5 === val % 60;
    labels.push(
      <text
        key={i}
        x={50 + r * Math.cos(rad)}
        y={50 + r * Math.sin(rad)}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize="5"
        fontWeight={isActive ? "700" : "400"}
        fill={isActive ? "#4f46e5" : "#94a3b8"}
        className="transition-all duration-300"
        style={{ userSelect: "none" }}
      >
        {mode === "hour" ? i : String(val % 60).padStart(2, '0')}
      </text>
    );
  }

  const currentResult = to24Hour(safeHour, safeMinute, period);

  return (
    <div className="flex flex-col items-center gap-6 bg-white p-8 rounded-[3rem] shadow-2xl border border-indigo-100 max-w-md mx-auto">
      <div className="flex gap-2 p-1.5 bg-slate-100 rounded-2xl w-full">
        {(["hour", "minute"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all duration-300 ${mode === m ? 'bg-white text-indigo-600 shadow-md ring-1 ring-black/5' : 'text-slate-400 hover:text-slate-600'}`}
          >
            {m}
          </button>
        ))}
      </div>

      <div className="text-5xl font-black text-slate-800 flex items-center gap-3 font-mono tracking-tighter">
        <span className={mode === 'hour' ? 'text-indigo-600' : ''}>{String(safeHour).padStart(2, '0')}</span>
        <span className="text-slate-300 animate-pulse">:</span>
        <span className={mode === 'minute' ? 'text-indigo-600' : ''}>{String(safeMinute).padStart(2, '0')}</span>
        <div className="flex flex-col gap-1.5 ml-4">
          {(["AM", "PM"] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 rounded-xl text-[10px] font-black transition-all ${period === p ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'bg-slate-100 text-slate-400 hover:text-slate-600'}`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <div className="relative w-52 h-52 group">
        <svg
          ref={svgRef}
          viewBox="0 0 100 100"
          className="w-full h-full cursor-pointer"
          onMouseDown={handlePointer}
          onMouseMove={(e) => e.buttons === 1 && handlePointer(e)}
          onTouchStart={handlePointer}
          onTouchMove={handlePointer}
        >
          <circle cx="50" cy="50" r="48" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="0.5" />
          {ticks}
          {labels}
          <ClockHand angle={hourAngle} length={18} width={3.5} color="#4f46e5" />
          <ClockHand angle={minuteAngle} length={28} width={2} color="#818cf8" />
          <circle cx="50" cy="50" r="3" fill="#1e1b4b" />
          <circle cx="50" cy="50" r="1.2" fill="#ffffff" />
        </svg>
      </div>

      <button
        type="button"
        onClick={() => {
          onChange(currentResult);
          toast.success(`Time confirmed: ${currentResult}`, { id: 'clock-confirm', icon: '🕒' });
        }}
        className={`w-full py-5 rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl transition-all flex items-center justify-center gap-3 group ${
          value === currentResult
            ? 'bg-emerald-600 text-white shadow-emerald-200'
            : 'bg-slate-800 hover:bg-slate-900 text-white shadow-slate-900/40 ring-1 ring-blue-500/50'
        }`}
      >
        <span>{value === currentResult ? `Time Confirmed: ${currentResult}` : `Confirm Time: ${currentResult}`}</span>
        <CheckCircle2 className={`w-4 h-4 transition-transform ${value === currentResult ? 'scale-110' : 'group-hover:scale-110'}`} />
      </button>
    </div>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(file: File) {
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  if (file.type.startsWith('image/')) return <ImageIcon className="w-5 h-5 text-blue-500" />;
  if (ext === 'pdf') return <FileText className="w-5 h-5 text-red-500" />;
  if (['xls', 'xlsx'].includes(ext)) return <FileSpreadsheet className="w-5 h-5 text-emerald-600" />;
  if (['doc', 'docx'].includes(ext)) return <FileText className="w-5 h-5 text-indigo-500" />;
  return <File className="w-5 h-5 text-slate-400" />;
}

function DocumentUploadZone({
  documents,
  onChange,
}: {
  documents: File[];
  onChange: (files: File[]) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const dropped = Array.from(e.dataTransfer.files);
    const valid = dropped.filter(f =>
      f.type.startsWith('image/') ||
      ['pdf', 'doc', 'docx', 'xls', 'xlsx'].includes(f.name.split('.').pop()?.toLowerCase() || '')
    );
    onChange([...documents, ...valid].slice(0, 5));
  }, [documents, onChange]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const added = Array.from(e.target.files || []);
    onChange([...documents, ...added].slice(0, 5));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeFile = (index: number) => {
    onChange(documents.filter((_, i) => i !== index));
  };

  return (
    <div>
      <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">
        Upload Support Documents{' '}
        <span className="text-slate-400 font-normal normal-case">(optional – max 5 files, 10 MB each)</span>
      </label>

      {/* Drop Zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`
          relative flex flex-col items-center justify-center gap-2 px-4 py-5 rounded-xl border-2 border-dashed cursor-pointer transition-all duration-200
          ${dragging
            ? 'border-indigo-400 bg-indigo-50 scale-[1.01]'
            : 'border-slate-200 bg-slate-50 hover:border-indigo-300 hover:bg-indigo-50/40'}
        `}
      >
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${dragging ? 'bg-indigo-100' : 'bg-white shadow-sm border border-slate-200'}`}>
          <Upload className={`w-5 h-5 ${dragging ? 'text-indigo-600' : 'text-slate-400'}`} />
        </div>
        <div className="text-center">
          <p className="text-xs font-semibold text-slate-700">
            {dragging ? 'Drop files here' : 'Drag & drop or click to upload'}
          </p>
          <p className="text-[10px] text-slate-400 mt-0.5">
            Images, PDF, Word, Excel supported
          </p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
          onChange={handleFileChange}
          className="sr-only"
        />
      </div>

      {/* File List */}
      {documents.length > 0 && (
        <div className="mt-2 space-y-1.5">
          {documents.map((file, i) => (
            <div
              key={i}
              className="flex items-center gap-2.5 px-3 py-2 bg-white border border-slate-100 rounded-lg shadow-sm"
            >
              <span className="flex-shrink-0">{getFileIcon(file)}</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-slate-800 truncate">{file.name}</p>
                <p className="text-[10px] text-slate-400">{formatFileSize(file.size)}</p>
              </div>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); removeFile(i); }}
                className="w-6 h-6 rounded-md bg-rose-50 hover:bg-rose-100 flex items-center justify-center flex-shrink-0 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-500" />
              </button>
            </div>
          ))}
          <p className="text-[10px] text-emerald-600 font-medium flex items-center gap-1 px-1">
            <CheckCircle2 className="w-3 h-3" />
            {documents.length} file{documents.length > 1 ? 's' : ''} ready • Will be uploaded to Cloudinary & shared as download links
          </p>
        </div>
      )}
    </div>
  );
}

export default function StatusUpdateForm({
  itemId,
  itemType,
  currentStatus,
  onSuccess,
  onCancel,
  grievanceVariant,
  initialDate,
  initialTime,
  showCancelButton = true
}: StatusUpdateFormProps) {
  const [selectedStatus, setSelectedStatus] = useState(currentStatus);
  const [remarks, setRemarks] = useState('');
  const [documents, setDocuments] = useState<File[]>([]);
  const [appointmentDate, setAppointmentDate] = useState('');
  const [appointmentTime, setAppointmentTime] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const grievanceStatuses =
    itemType === 'grievance' && grievanceVariant === 'operator'
      ? grievanceStatusesOperator
      : grievanceStatusesAll;
  const statuses = itemType === 'grievance' ? grievanceStatuses : appointmentStatuses;

  useEffect(() => {
    setSelectedStatus(currentStatus);
    setRemarks('');
    setDocuments([]);
    
    if (initialDate) {
      const datePart = initialDate.includes('T') ? initialDate.split('T')[0] : initialDate;
      setAppointmentDate(datePart);
    } else {
      setAppointmentDate('');
    }
    
    setAppointmentTime(initialTime || '');
    setDescription('');
  }, [currentStatus, initialDate, initialTime]);

  const handleUpdate = async () => {
    if (remarks.length > 100) {
      toast.error('Remarks exceed 100 character limit');
      return;
    }

    if (selectedStatus === currentStatus) {
      toast.error('Please select a different status');
      return;
    }

    if (itemType === 'appointment' && selectedStatus === 'CONFIRMED') {
      if (!appointmentDate) {
        toast.error('Please select confirmation date');
        return;
      }
      if (!appointmentTime) {
        toast.error('Please select confirmation time from the clock');
        return;
      }
    }

    if (!remarks.trim()) {
      toast.error('Remarks / notes are mandatory for updating status.');
      return;
    }

    try {
      setSubmitting(true);
      let response;
      if (itemType === 'grievance') {
        const formData = new FormData();
        formData.append('status', selectedStatus);
        if (remarks) formData.append('remarks', remarks);
        if (['RESOLVED', 'IN_PROGRESS', 'REJECTED'].includes(selectedStatus) && documents.length > 0) {
          documents.forEach((file) => formData.append('documents', file));
        }
        response = await apiClient.put(
          `/status/${itemType}/${itemId}`,
          formData,
          { headers: { 'Content-Type': 'multipart/form-data' } }
        );
      } else {
        response = await apiClient.put(
          `/status/${itemType}/${itemId}`,
          {
            status: selectedStatus,
            remarks,
            appointmentDate: selectedStatus === 'CONFIRMED' ? appointmentDate : undefined,
            appointmentTime: selectedStatus === 'CONFIRMED' ? appointmentTime : undefined,
            description: selectedStatus === 'CONFIRMED' ? description : undefined
          }
        );
      }

      if (response.success) {
        toast.success(
          `${itemType === 'grievance' ? 'Grievance' : 'Appointment'} status updated! Citizen notified via WhatsApp.`,
          { duration: 1000 }
        );
        onSuccess();
      }
    } catch (error: any) {
      const msg = error?.response?.data?.message || error?.message || 'Failed to update';
      if (msg.toLowerCase().includes('access denied')) {
        toast.error("Access Denied: This item may have been moved or your permissions changed. Refreshing list...", { duration: 4000 });
        onSuccess();
      } else {
        toast.error(msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const currentStatusInfo = statuses.find(s => 
    s.value === currentStatus || (s.value === 'PENDING' && currentStatus === 'ASSIGNED')
  ) || statuses[0];
  const typeLabel = itemType === 'grievance' ? 'Grievance' : 'Appointment';
  const isRemarksMissing = !remarks.trim();
  const isSubmitDisabled =
    selectedStatus === currentStatus ||
    submitting ||
    (itemType === 'appointment' &&
      selectedStatus === 'CONFIRMED' &&
      (!appointmentDate || !appointmentTime)) ||
    isRemarksMissing;

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 p-4 space-y-4 overflow-y-auto custom-scrollbar">
        {/* Current Status */}
        <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
          <p className="text-[11px] font-semibold text-slate-600 uppercase tracking-[0.08em] mb-2">Current Status</p>
          {currentStatusInfo && (
            <div className="flex items-center gap-2">
              <div className={`w-8 h-8 ${currentStatusInfo.iconBg} rounded-lg flex items-center justify-center`}>
                <currentStatusInfo.Icon className={`w-4 h-4 ${currentStatusInfo.iconColor}`} />
              </div>
              <span className={`px-3 py-1 rounded-lg border text-xs font-bold uppercase tracking-wider ${currentStatusInfo.badge}`}>
                {currentStatusInfo.label}
              </span>
            </div>
          )}
        </div>

        {/* Status Selection */}
        <div>
          <p className="text-[11px] font-semibold text-slate-600 uppercase tracking-[0.08em] mb-2">
            Select New Status <span className="text-rose-500">*</span>
          </p>
          <div className="grid grid-cols-2 gap-2">
            {statuses.map((status) => {
              const isSelected = selectedStatus === status.value;
              const isCurrent = status.value === currentStatus || (status.value === 'PENDING' && currentStatus === 'ASSIGNED');
              return (
                <button
                  key={status.value}
                  onClick={() => !isCurrent && setSelectedStatus(status.value)}
                  disabled={isCurrent}
                  className={`
                    flex items-center gap-2.5 px-4 py-2 rounded-xl border-2 font-bold text-xs uppercase tracking-wider transition-all duration-150
                    ${isSelected
                      ? `${status.activeBadge} shadow-md ring-2 ring-offset-2 ring-slate-200`
                      : isCurrent
                      ? `${status.badge} opacity-50 cursor-not-allowed`
                      : `${status.badge} hover:shadow-sm cursor-pointer`
                    }
                  `}
                >
                  <status.Icon className="w-4 h-4 flex-shrink-0" />
                  {status.label}
                  {isSelected && <CheckCircle2 className="w-3.5 h-3.5 ml-auto flex-shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>

        {itemType === 'appointment' && selectedStatus === 'CONFIRMED' && (
          <div className="space-y-4 bg-indigo-50/40 border border-indigo-100 rounded-xl p-4">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-[0.08em] mb-2">Confirmation Date *</label>
              <input
                type="date"
                value={appointmentDate}
                onChange={(e) => setAppointmentDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-[0.08em] mb-2">Select Time (Clock) *</label>
              <PremiumClockPicker
                value={appointmentTime}
                onChange={(val) => setAppointmentTime(val)}
                onClose={() => {}}
              />
            </div>
          </div>
        )}

        {/* Remarks */}
        <div>
          <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-[0.08em] mb-1.5 flex justify-between items-center">
            <span>Remarks / Note <span className="text-rose-500 font-normal normal-case">(Mandatory)</span></span>
            <span className={`text-[10px] font-bold ${remarks.length > 100 ? 'text-rose-500' : 'text-slate-400'}`}>
              {remarks.length}/100
            </span>
          </label>
          <textarea
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            rows={3}
            className={`w-full px-4 py-3 border ${remarks.length > 100 ? 'border-rose-500 ring-1 ring-rose-500/20' : 'border-slate-200'} rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-none transition-all bg-white text-sm placeholder:text-slate-400`}
            placeholder="Add notes, comments, or instructions about this status change. These will be sent to the citizen via WhatsApp..."
          />
          {remarks.length > 100 && (
            <p className="mt-1 text-[10px] font-bold text-rose-500 uppercase tracking-tight px-1">
              Character limit exceeded by {remarks.length - 100} characters
            </p>
          )}
        </div>

        {itemType === 'grievance' && ['RESOLVED', 'IN_PROGRESS', 'REJECTED'].includes(selectedStatus) && (
          <DocumentUploadZone
            documents={documents}
            onChange={setDocuments}
          />
        )}

        {/* WhatsApp Notice */}
        {/* <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 flex items-start gap-3">
          <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
            <MessageSquare className="w-4 h-4 text-amber-600" />
          </div>
          <div>
            <p className="text-xs font-bold text-amber-800">Citizen Will Be Notified via WhatsApp</p>
            <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">
              The citizen will automatically receive a WhatsApp message with the new status and your remarks.
            </p>
          </div>
        </div> */}
      </div>

      {/* Footer */}
      <div className="bg-slate-50 px-5 py-4 flex justify-end gap-3 border-t border-slate-200 flex-shrink-0">
        {showCancelButton && (
          <button
            onClick={onCancel}
            disabled={submitting}
            className="px-5 py-2 border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 rounded-lg text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-50"
          >
            Cancel
          </button>
        )}
        <button
          onClick={handleUpdate}
          disabled={isSubmitDisabled}
          title={remarks.length > 100 ? `Remarks exceed 100 characters (currently ${remarks.length})` : ''}
          className={`px-5 py-2.5 bg-[#029fe7] hover:bg-[#028fcf] text-white rounded-lg text-xs font-bold uppercase tracking-[0.08em] shadow-lg shadow-cyan-700/30 ring-1 ring-cyan-300/60 transition-all flex items-center gap-2 ${isSubmitDisabled || remarks.length > 100 ? 'opacity-50 cursor-not-allowed' : 'active:scale-95'}`}
        >
          {submitting ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
              <span>Updating...</span>
            </>
          ) : (
            <>
              <CheckCircle2 className="w-4 h-4" />
              <span>Submit &amp; Notify</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
