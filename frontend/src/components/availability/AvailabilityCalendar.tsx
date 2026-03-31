'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { availabilityAPI, AppointmentAvailability, DayAvailability, TimeSlot, SpecialDate, Holiday } from '@/lib/api/availability';
import toast from 'react-hot-toast';
import {
  Calendar,
  Clock,
  Sun,
  Sunset,
  Moon,
  ChevronLeft,
  ChevronRight,
  X,
  Save,
  RotateCcw,
  Info,
  CalendarDays,
  Settings,
  PartyPopper,
  CheckCircle,
  XCircle,
  Sparkles,
  AlertCircle,
  CalendarCheck,
  Target,
  TrendingUp,
  User as UserIcon,
  Plus,
  Building,
  Zap
} from 'lucide-react';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

interface AvailabilityCalendarProps {
  isOpen: boolean;
  onClose: () => void;
  departmentId?: string;
}

type DayName = 'sunday' | 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday';

const DAYS_OF_WEEK: { key: DayName; label: string; short: string }[] = [
  { key: 'sunday', label: 'Sunday', short: 'Sun' },
  { key: 'monday', label: 'Monday', short: 'Mon' },
  { key: 'tuesday', label: 'Tuesday', short: 'Tue' },
  { key: 'wednesday', label: 'Wednesday', short: 'Wed' },
  { key: 'thursday', label: 'Thursday', short: 'Thu' },
  { key: 'friday', label: 'Friday', short: 'Fri' },
  { key: 'saturday', label: 'Saturday', short: 'Sat' }
];

const HOUR_RING = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

const parseTimeForClock = (time: string) => {
  if (!time || time.includes('NaN')) {
    return { hour12: 12, minute: 0, period: 'AM' as const };
  }
  const [hourStr, minuteStr] = time.split(':');
  const hour24 = Number.parseInt(hourStr, 10);
  const minute = Number.parseInt(minuteStr, 10);
  
  if (isNaN(hour24) || isNaN(minute)) {
    return { hour12: 12, minute: 0, period: 'AM' as const };
  }

  const period: 'AM' | 'PM' = hour24 >= 12 ? 'PM' : 'AM';
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return { hour12, minute, period };
};

const to24HourTime = (hour12: number, minute: number, period: 'AM' | 'PM') => {
  const h12 = isNaN(hour12) ? 12 : hour12;
  const m = isNaN(minute) ? 0 : minute;
  let hour24 = h12 % 12;
  if (period === 'PM') hour24 += 12;
  return `${String(hour24).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

const angleToPoint = (index: number, total: number, radius: number, center = 96) => {
  const angle = (index / total) * 2 * Math.PI - Math.PI / 2;
  return {
    x: center + radius * Math.cos(angle),
    y: center + radius * Math.sin(angle)
  };
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

function ClockFacePicker({
  value,
  onChange,
  onClose
}: {
  value: string;
  onChange: (value: string) => void;
  onClose: () => void;
}) {
  const parsed = parseTimeForClock(value);
  const [hour12, setHour12] = useState(parsed.hour12);
  const [minute, setMinute] = useState(parsed.minute);
  const [period, setPeriod] = useState<'AM' | 'PM'>(parsed.period);
  const [mode, setMode] = useState<'hour' | 'minute'>('hour');
  const svgRef = useRef<SVGSVGElement>(null);

  const hourAngle = ((hour12 % 12) / 12) * 360 + (minute / 60) * 30;
  const minuteAngle = (minute / 60) * 360;

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
        if (!isNaN(h)) setHour12(h);
      } else {
        let m = Math.round(angle / 6) % 60;
        if (!isNaN(m)) setMinute(m);
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
        stroke={isMajor ? "#818cf8" : "rgba(99, 102, 241, 0.2)"}
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
        fontSize="6"
        fontWeight={isActive ? "700" : "400"}
        fill={isActive ? "#ffffff" : "#64748b"}
        style={{ userSelect: "none", fontFamily: "'DM Sans', sans-serif" }}
      >
        {mode === "hour" ? i : String(val % 60).padStart(2, '0')}
      </text>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 bg-slate-900 p-6 rounded-[2.5rem] shadow-2xl border border-white/10 relative overflow-hidden">
      <div className="absolute top-0 right-0 p-3">
        <button type="button" onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
          <X className="w-4 h-4 text-white/50" />
        </button>
      </div>

      <div className="text-center mt-2">
        <p className="text-[9px] font-black uppercase tracking-[0.2em] text-indigo-400 mb-4 px-3 py-1 bg-white/5 rounded-full inline-block">Select Appointment Time</p>
      </div>

      <div className="flex gap-2 p-1 bg-white/5 rounded-2xl mb-2">
        {(["hour", "minute"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`px-8 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-300 ${mode === m ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30' : 'text-slate-400 hover:text-white'}`}
          >
            {m}
          </button>
        ))}
      </div>

      <div className="text-5xl font-black text-white flex items-center gap-3 mb-2 font-mono tracking-tighter">
        <span className={mode === 'hour' ? 'text-indigo-400' : 'text-white'}>
          {isNaN(hour12) ? '12' : String(hour12).padStart(2, '0')}
        </span>
        <span className="text-indigo-900 animate-pulse">:</span>
        <span className={mode === 'minute' ? 'text-indigo-400' : 'text-white'}>
          {isNaN(minute) ? '00' : String(minute).padStart(2, '0')}
        </span>
        <div className="flex flex-col gap-1 ml-4 py-1 px-2 bg-white/5 rounded-xl">
          {(["AM", "PM"] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-black transition-all ${period === p ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-slate-500 hover:text-white'}`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <div className="relative w-52 h-52 sm:w-64 sm:h-64 group">
        <svg
          ref={svgRef}
          viewBox="0 0 100 100"
          className="w-full h-full cursor-pointer rounded-full bg-slate-950/20"
          onMouseDown={handlePointer}
          onMouseMove={(e) => e.buttons === 1 && handlePointer(e)}
          onTouchStart={handlePointer}
          onTouchMove={handlePointer}
        >
          <circle cx="50" cy="50" r="49" fill="none" stroke="rgba(99, 102, 241, 0.1)" strokeWidth="0.5" />
          {ticks}
          {labels}
          <circle
            cx="50" cy="50" r="22"
            fill="none"
            stroke={mode === 'hour' ? "#6366f1" : "rgba(99,102,241, 0.4)"}
            strokeWidth="1.5"
            strokeDasharray={`${((mode === 'hour' ? hourAngle : minuteAngle) / 360) * 138.2} 138.2`}
            transform="rotate(-90 50 50)"
            strokeLinecap="round"
            className="opacity-20 transition-all duration-300"
          />
          <ClockHand angle={hourAngle} length={20} width={3} color="#818cf8" />
          <ClockHand angle={minuteAngle} length={28} width={1.2} color="#6366f1" />
          <circle cx="50" cy="50" r="3" fill="#ffffff" />
          <circle cx="50" cy="50" r="1.2" fill="#1e1b4b" />
          {(() => {
            const a = mode === "hour" ? hourAngle : minuteAngle;
            if (isNaN(a)) return null;
            const rad = ((a - 90) * Math.PI) / 180;
            return (
              <circle
                cx={50 + 44 * Math.cos(rad)}
                cy={50 + 44 * Math.sin(rad)}
                r="2.2"
                fill="#818cf8"
                className="shadow-xl"
                style={{ filter: "drop-shadow(0 0 5px #6366f1)" }}
              />
            );
          })()}
        </svg>
      </div>

      <button
        type="button"
        onClick={() => onChange(to24HourTime(hour12, minute, period))}
        className="w-full py-5 mt-2 rounded-[1.5rem] bg-indigo-600 hover:bg-white hover:text-indigo-900 text-white text-[11px] font-black uppercase tracking-[0.15em] shadow-xl shadow-indigo-900/40 transition-all active:scale-95 flex items-center justify-center gap-2 group"
      >
        <span>Apply: {to24HourTime(hour12, minute, period)}</span>
        <CheckCircle className="w-4 h-4 group-hover:scale-110 transition-transform" />
      </button>
    </div>
  );
}

export default function AvailabilityCalendar({ isOpen, onClose, departmentId }: AvailabilityCalendarProps) {
  const [availability, setAvailability] = useState<AppointmentAvailability | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'weekly' | 'calendar' | 'holidays' | 'settings'>('weekly');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [hasChanges, setHasChanges] = useState(false);
  const [activeClockPicker, setActiveClockPicker] = useState<string | null>(null);

  // Fetch availability settings
  const fetchAvailability = useCallback(async () => {
    try {
      setLoading(true);
      const response = await availabilityAPI.get(departmentId);
      if (response && response.availability) {
        setAvailability(response.availability);
      }
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to load availability settings');
    } finally {
      setLoading(false);
    }
  }, [departmentId]);

  // Fetch holidays
  const fetchHolidays = useCallback(async () => {
    try {
      const response = await availabilityAPI.getHolidays(currentMonth.getFullYear());
      if (response && response.holidays) {
        setHolidays(response.holidays);
      }
    } catch (error) {
      console.error('Failed to fetch holidays:', error);
    }
  }, [currentMonth]);

  useEffect(() => {
    if (isOpen) {
      fetchAvailability();
      fetchHolidays();
    }
  }, [isOpen, fetchAvailability, fetchHolidays]);

  // Save changes
  const handleSave = async () => {
    if (!availability) return;

    try {
      setSaving(true);
      const response = await availabilityAPI.update({
        ...availability,
        departmentId
      });
      
      if (response && response.availability) {
        toast.success('Availability settings saved successfully!');
        setHasChanges(false);
        onClose();
      }
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  // Reset to defaults
  const handleReset = () => {
    fetchAvailability();
    setHasChanges(false);
    toast.success('Settings reset to last saved state');
  };

  // Update day availability
  const updateDayAvailability = (day: DayName, updates: Partial<DayAvailability>) => {
    if (!availability) return;
    
    setAvailability({
      ...availability,
      weeklySchedule: {
        ...availability.weeklySchedule,
        [day]: {
          ...availability.weeklySchedule[day],
          ...updates
        }
      }
    });
    setHasChanges(true);
  };

  // Update time slot
  const updateTimeSlot = (day: DayName, period: 'morning' | 'afternoon' | 'evening', updates: Partial<TimeSlot>) => {
    if (!availability) return;
    
    setAvailability({
      ...availability,
      weeklySchedule: {
        ...availability.weeklySchedule,
        [day]: {
          ...availability.weeklySchedule[day],
          [period]: {
            ...availability.weeklySchedule[day][period],
            ...updates
          }
        }
      }
    });
    setHasChanges(true);
  };

  // Update settings
  const updateSettings = (updates: Partial<AppointmentAvailability>) => {
    if (!availability) return;
    setAvailability({ ...availability, ...updates });
    setHasChanges(true);
  };

  // Add holiday
  const addHoliday = (holiday: Holiday) => {
    if (!availability) return;

    const alreadyExists = availability.specialDates.some((sd) => sd.date === holiday.date && sd.type === 'holiday');
    if (alreadyExists) return;

    const specialDate: SpecialDate = {
      date: holiday.date,
      type: 'holiday',
      name: holiday.name,
      isAvailable: false
    };

    setAvailability({
      ...availability,
      specialDates: [...availability.specialDates, specialDate]
    });
    setHasChanges(true);
    toast.success(`${holiday.name} added (save changes to apply)`);
  };

  // Remove special date
  const removeSpecialDate = (date: string) => {
    if (!availability) return;

    // Standardize date comparison
    const targetDate = new Date(date).toISOString().split('T')[0];

    setAvailability({
      ...availability,
      specialDates: availability.specialDates.filter((sd) => {
        const sdDate = new Date(sd.date).toISOString().split('T')[0];
        return sdDate !== targetDate;
      })
    });
    setHasChanges(true);
    toast.success('Date reset to default rule (save changes to apply)');
  };

  const toggleHolidayForDate = (date: string) => {
    if (!availability) return;

    // Use robust comparison (splitting at T)
    const target = date.split('T')[0];
    const holidayExists = availability.specialDates.some((sd) => {
      const sdDate = typeof sd.date === 'string' ? sd.date : new Date(sd.date).toISOString().split('T')[0];
      return sdDate.split('T')[0] === target && sd.type === 'holiday';
    });

    if (holidayExists) {
      removeSpecialDate(target);
      return;
    }

    addHoliday({ date: target, name: 'Custom Holiday', type: 'holiday' });
  };

  // Get calendar days for the month
  const getCalendarDays = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startDayOfWeek = firstDay.getDay();

    const days: (Date | null)[] = [];
    
    // Add empty slots for days before the first of the month
    for (let i = 0; i < startDayOfWeek; i++) {
      days.push(null);
    }
    
    // Add all days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day));
    }

    return days;
  };

  // Check if a date is a holiday/special date
  const getSpecialDateInfo = (date: Date) => {
    if (!availability) return null;
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const target = `${y}-${m}-${d}`;

    return availability.specialDates.find(sd => {
      const sdDate = typeof sd.date === 'string' ? sd.date : new Date(sd.date).toISOString().split('T')[0];
      return sdDate.split('T')[0] === target;
    });
  };

  // Check if a date is available based on weekly schedule
  const isDateAvailable = (date: Date) => {
    if (!availability) return false;
    
    const specialDate = getSpecialDateInfo(date);
    if (specialDate) return specialDate.isAvailable;

    const dayName = DAYS_OF_WEEK[date.getDay()].key;
    return availability.weeklySchedule[dayName].isAvailable;
  };

  if (!isOpen) return null;
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent hideClose={true} className="max-w-[95vw] md:max-w-5xl h-[92vh] sm:h-[90vh] p-0 overflow-hidden bg-slate-50 border-0 rounded-[1.75rem] sm:rounded-[2.5rem] shadow-3xl flex flex-col gap-0">
        <div className="flex flex-col h-full bg-slate-50 relative">
          {/* Dashboard-style Header */}
          <div className="bg-slate-900 px-4 sm:px-8 py-3 sm:py-6 relative overflow-hidden shrink-0">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 via-transparent to-purple-500/10 hover:opacity-80 transition-opacity"></div>
            <div className="absolute -top-24 -right-24 w-80 h-80 bg-indigo-500/10 rounded-full blur-[100px]"></div>
            <div className="absolute top-1/2 -left-20 w-60 h-60 bg-purple-500/5 rounded-full blur-[80px]"></div>
            
            <div className="relative flex items-center justify-between">
              <div className="flex items-center gap-3 sm:gap-6">
                <div className="w-10 h-10 sm:w-16 sm:h-16 bg-white/10 rounded-xl sm:rounded-2xl flex items-center justify-center backdrop-blur-xl border border-white/20 shadow-inner">
                  <CalendarCheck className="w-5 h-5 sm:w-8 sm:h-8 text-indigo-400" />
                </div>
                <div>
                  <h1 className="text-xl sm:text-3xl font-black text-white tracking-tight leading-none mb-1 sm:mb-2">
                    Availability <span className="text-indigo-400">Settings</span>
                  </h1>
                  <p className="text-slate-400 text-[11px] sm:text-sm font-medium leading-snug">Manage your schedule, holidays, and appointment slots</p>
                </div>
              </div>
              
              <button
                onClick={onClose}
                className="w-9 h-9 sm:w-12 sm:h-12 bg-white/5 hover:bg-white/10 rounded-xl sm:rounded-2xl flex items-center justify-center backdrop-blur-md border border-white/10 transition-all duration-300 group shadow-lg"
              >
                <X className="w-4 h-4 sm:w-6 sm:h-6 text-white/40 group-hover:text-white transition-colors" />
              </button>
            </div>
          </div>

        {/* Tabs */}
        <div className="border-b border-slate-200 bg-white/80 backdrop-blur-sm overflow-x-auto shrink-0">
          <div className="flex gap-1 px-2 sm:px-4 py-2 min-w-max">
            {([
              { id: 'weekly', label: 'Weekly Schedule', icon: Calendar, tooltip: 'Set your default weekly availability' },
              { id: 'calendar', label: 'Calendar View', icon: CalendarDays, tooltip: 'View and manage specific dates' },
              // { id: 'holidays', label: 'Holidays', icon: PartyPopper, tooltip: 'Add national and custom holidays' },
              { id: 'settings', label: 'Settings', icon: Settings, tooltip: 'Configure booking rules and time slots' }
            ] as const).map((tab) => {
              const active = activeTab === tab.id;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  title={tab.tooltip}
                  className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-6 py-2.5 sm:py-4 text-[9px] sm:text-[10px] font-black uppercase tracking-widest transition-all relative group ${
                    active ? 'text-slate-900 border-b-2 border-indigo-600' : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  <Icon className={`w-3 h-3 sm:w-3.5 sm:h-3.5 ${active ? 'text-indigo-600' : 'text-slate-400 group-hover:text-slate-500'}`} />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-3 sm:p-8 bg-slate-50/20">
          {activeClockPicker && (
            <button
              type="button"
              aria-label="Close time picker overlay"
              onClick={() => setActiveClockPicker(null)}
              className="fixed inset-0 bg-black/35 z-30 sm:hidden"
            />
          )}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <LoadingSpinner />
              <p className="text-slate-500 font-medium animate-pulse">Loading availability data...</p>
            </div>
          ) : (
            <div className="max-w-5xl mx-auto w-full">
              {/* Weekly Schedule Tab */}
              {activeTab === 'weekly' && availability && (
                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
                  <div className="grid gap-4">
                    {DAYS_OF_WEEK.map((day) => {
                      const dayAvailability = availability.weeklySchedule[day.key];
                      const isWeekend = day.key === 'saturday' || day.key === 'sunday';

                      return (
                        <div
                          key={day.key}
                          className={`rounded-3xl border transition-all duration-300 ${
                            dayAvailability.isAvailable
                              ? 'border-emerald-200 bg-white shadow-md hover:shadow-lg'
                              : 'border-slate-200 bg-slate-100/50 opacity-80'
                          }`}
                        >
                          {/* Day Header */}
                          <div className="flex items-center justify-between px-6 py-5">
                            <div className="flex items-center gap-5">
                              <button
                                onClick={() => updateDayAvailability(day.key, { isAvailable: !dayAvailability.isAvailable })}
                                title={dayAvailability.isAvailable ? 'Click to mark as unavailable' : 'Click to mark as available'}
                                className={`w-14 h-8 rounded-full transition-all duration-300 relative ${
                                  dayAvailability.isAvailable
                                    ? 'bg-slate-900 shadow-inner'
                                    : 'bg-slate-200 shadow-inner'
                                }`}
                              >
                                <div
                                  className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow-lg transition-all duration-300 translate-x-0 ${
                                    dayAvailability.isAvailable ? 'translate-x-6' : 'translate-x-0'
                                  }`}
                                  style={{ left: '4px' }}
                                />
                              </button>
                              <div className="flex flex-col">
                                <span className={`font-bold text-xl tracking-tight ${
                                  dayAvailability.isAvailable ? 'text-slate-900' : 'text-slate-500'
                                }`}>
                                  {day.label}
                                </span>
                                {isWeekend && (
                                  <span className="text-[10px] font-black uppercase tracking-widest text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full w-fit mt-1 border border-amber-100">
                                    Weekend
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className={`px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest ${
                                dayAvailability.isAvailable 
                                  ? 'bg-slate-900 text-white shadow-sm ring-1 ring-slate-800' 
                                  : 'bg-slate-100 text-slate-400'
                              }`}>
                                {dayAvailability.isAvailable ? 'Available' : 'Closed'}
                              </div>
                            </div>
                          </div>

                          {/* Time Slots */}
                          {dayAvailability.isAvailable && (
                            <div className="px-6 pb-6 grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-slate-50 pt-6">
                              {(['morning', 'afternoon', 'evening'] as const).map((period) => {
                                const slot = dayAvailability[period];
                                const periodConfig = {
                                  morning: { icon: Sun, label: 'Morning', color: 'slate', gradient: 'from-slate-700 to-slate-900', shadow: 'shadow-slate-200' },
                                  afternoon: { icon: Sunset, label: 'Afternoon', color: 'slate', gradient: 'from-slate-700 to-slate-900', shadow: 'shadow-slate-200' },
                                  evening: { icon: Moon, label: 'Evening', color: 'slate', gradient: 'from-slate-700 to-slate-900', shadow: 'shadow-slate-200' }
                                }[period];
                                const PeriodIcon = periodConfig.icon;

                                return (
                                  <div
                                    key={period}
                                    className={`rounded-2xl p-4 transition-all duration-300 border ${
                                      slot.enabled
                                        ? `bg-slate-900 text-white shadow-lg border-transparent`
                                        : 'bg-slate-50 text-slate-400 border-slate-200 hover:border-slate-300'
                                    }`}
                                  >
                                    <div className="flex items-center justify-between mb-4">
                                      <div className="flex items-center gap-3">
                                        <div className={`p-1.5 rounded-lg ${slot.enabled ? 'bg-white/20' : 'bg-slate-200'}`}>
                                          <PeriodIcon className={`w-4 h-4 ${slot.enabled ? 'text-white' : 'text-slate-400'}`} />
                                        </div>
                                        <span className="font-bold text-sm tracking-tight">{periodConfig.label}</span>
                                      </div>
                                      <button
                                        onClick={() => updateTimeSlot(day.key, period, { enabled: !slot.enabled })}
                                        className={`w-10 h-6 rounded-full transition-all duration-300 relative ${
                                          slot.enabled ? 'bg-indigo-500 shadow-inner' : 'bg-slate-200 shadow-inner'
                                        }`}
                                      >
                                        <div
                                          className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-md transition-all duration-300 ${
                                            slot.enabled ? 'translate-x-5' : 'translate-x-0'
                                          }`}
                                          style={{ left: '4px' }}
                                        />
                                      </button>
                                    </div>
                                    
                                    {slot.enabled && (
                                      <div className="space-y-3">
                                        <div className="grid grid-cols-2 gap-2">
                                          <div className="flex flex-col gap-1 relative">
                                            <span className="text-[9px] font-black uppercase tracking-widest text-white/70">Start</span>
                                            <button
                                              type="button"
                                              onClick={() => setActiveClockPicker(`${day.key}-${period}-start`)}
                                              className="bg-white/20 border border-white/30 rounded-xl px-2 py-2 text-white backdrop-blur-md text-xs w-full focus:outline-none focus:ring-2 focus:ring-white/50 cursor-pointer hover:bg-white/30 transition-colors text-left"
                                            >
                                              {slot.startTime}
                                            </button>
                                            {activeClockPicker === `${day.key}-${period}-start` && (
                                              <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                                                <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setActiveClockPicker(null)} />
                                                <div className="relative animate-in zoom-in-95 duration-200">
                                                  <ClockFacePicker
                                                    value={slot.startTime}
                                                    onChange={(val) => {
                                                      updateTimeSlot(day.key, period, { startTime: val });
                                                      setActiveClockPicker(null);
                                                    }}
                                                    onClose={() => setActiveClockPicker(null)}
                                                  />
                                                </div>
                                              </div>
                                            )}
                                          </div>
                                          <div className="flex flex-col gap-1 relative">
                                            <span className="text-[9px] font-black uppercase tracking-widest text-white/70">End</span>
                                            <button
                                              type="button"
                                              onClick={() => setActiveClockPicker(`${day.key}-${period}-end`)}
                                              className="bg-white/20 border border-white/30 rounded-xl px-2 py-2 text-white backdrop-blur-md text-xs w-full focus:outline-none focus:ring-2 focus:ring-white/50 cursor-pointer hover:bg-white/30 transition-colors text-left"
                                            >
                                              {slot.endTime}
                                            </button>
                                            {activeClockPicker === `${day.key}-${period}-end` && (
                                              <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                                                <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setActiveClockPicker(null)} />
                                                <div className="relative animate-in zoom-in-95 duration-200">
                                                  <ClockFacePicker
                                                    value={slot.endTime}
                                                    onChange={(val) => {
                                                      updateTimeSlot(day.key, period, { endTime: val });
                                                      setActiveClockPicker(null);
                                                    }}
                                                    onClose={() => setActiveClockPicker(null)}
                                                  />
                                                </div>
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Calendar View Tab */}
              {activeTab === 'calendar' && availability && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                  {/* Month Navigation */}
                  <div className="flex items-center justify-between px-2">
                    <button
                      onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
                      className="p-3 rounded-2xl hover:bg-white hover:shadow-md border border-transparent hover:border-slate-200 transition-all text-slate-600"
                    >
                      <ChevronLeft className="w-6 h-6" />
                    </button>
                    <div className="text-center group cursor-pointer" onClick={() => setCurrentMonth(new Date())}>
                      <h3 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-3">
                        {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                        <Sparkles className="w-5 h-5 text-amber-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </h3>
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-500 mt-1">Calendar Overview</p>
                    </div>
                    <button
                      onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
                      className="p-3 rounded-2xl hover:bg-white hover:shadow-md border border-transparent hover:border-slate-200 transition-all text-slate-600"
                    >
                      <ChevronRight className="w-6 h-6" />
                    </button>
                  </div>

                    {/* Calendar Grid */}
                    <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-2xl overflow-hidden mx-auto backdrop-blur-xl max-w-4xl p-8">
                      {/* Week Headers */}
                      <div className="grid grid-cols-7 mb-4">
                        {DAYS_OF_WEEK.map((day) => (
                          <div
                            key={day.key}
                            className={`py-3 text-center text-[10px] font-black uppercase tracking-[0.2em] ${
                              day.key === 'sunday' || day.key === 'saturday'
                                ? 'text-rose-500'
                                : 'text-slate-400'
                            }`}
                          >
                            {day.short}
                          </div>
                        ))}
                      </div>

                      {/* Calendar Days */}
                      <div className="grid grid-cols-7 gap-3">
                        {getCalendarDays().map((date, index) => {
                        if (!date) {
                          return <div key={`empty-${index}`} className="aspect-square sm:h-16 bg-slate-50/30" />;
                        }

                          const isToday = date.toDateString() === new Date().toDateString();
                          const isSelected = selectedDate && date.toDateString() === selectedDate.toDateString();
                          const isPast = date.getTime() < new Date().setHours(0, 0, 0, 0);
                          const dayName = DAYS_OF_WEEK[date.getDay()].key;
                          const daySchedule = availability.weeklySchedule[dayName];
                          const specialDate = getSpecialDateInfo(date);
                          const isAvailable = specialDate ? specialDate.isAvailable : daySchedule.isAvailable;
                          const isHoliday = specialDate?.type === 'holiday';

                          return (
                            <button
                              key={date.toISOString()}
                              onClick={() => setSelectedDate(isSelected ? null : date)}
                              disabled={isPast}
                              className={`aspect-square h-auto p-4 transition-all duration-300 relative group flex flex-col items-center justify-center rounded-2xl border ${
                                isPast
                                  ? 'bg-slate-50 border-slate-100 text-slate-300 opacity-50 cursor-not-allowed'
                                  : isSelected
                                  ? 'bg-gradient-to-br from-indigo-600 to-violet-700 text-white shadow-xl shadow-indigo-200 border-transparent scale-[1.05] z-10'
                                  : isHoliday
                                  ? 'bg-rose-50 border-rose-100 text-rose-600 hover:bg-rose-100'
                                  : isAvailable
                                  ? 'bg-white border-slate-100 hover:border-indigo-300 hover:shadow-lg'
                                  : 'bg-slate-100 border-slate-200 text-slate-400 hover:bg-slate-200'
                              }`}
                            >
                              <span
                                className={`text-sm font-black transition-all ${
                                  isToday && !isSelected
                                    ? 'text-indigo-600 ring-2 ring-indigo-100 rounded-full w-8 h-8 flex items-center justify-center bg-indigo-50'
                                    : ''
                                }`}
                              >
                                {date.getDate()}
                              </span>
                              
                              {isHoliday && (
                                <div className="absolute top-2 right-2">
                                  <PartyPopper className={`w-3 h-3 ${isSelected ? 'text-white' : 'text-rose-500'}`} />
                                </div>
                              )}

                              {isAvailable && !isPast && !isHoliday && !isSelected && (
                                <div className="absolute bottom-2 inset-x-0 flex justify-center">
                                  <div className="h-1 w-1 rounded-full bg-emerald-500 shadow-sm" />
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                  {/* Enhanced Legend */}
                  <div className="flex flex-wrap gap-6 justify-center items-center py-4 px-6 bg-white/50 backdrop-blur-md rounded-[2rem] border border-slate-200/50 shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="w-4 h-4 rounded-lg bg-emerald-500 shadow-lg shadow-emerald-200/50" />
                      <span className="text-xs font-bold text-slate-600 uppercase tracking-widest">Available</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-4 h-4 rounded-lg bg-slate-200" />
                      <span className="text-xs font-bold text-slate-600 uppercase tracking-widest">Unavailable</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-4 h-4 rounded-lg bg-rose-400 shadow-lg shadow-rose-200/50" />
                      <span className="text-xs font-bold text-slate-600 uppercase tracking-widest">Holiday</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-4 h-4 rounded-lg bg-indigo-600 shadow-lg shadow-indigo-200/50" />
                      <span className="text-xs font-bold text-slate-600 uppercase tracking-widest">Today</span>
                    </div>
                  </div>

                  {/* Selected Date Modal/Section (Side Drawer-like feel) */}
                  {selectedDate && (
                    <Card className="border border-slate-200 shadow-lg bg-white text-slate-900 rounded-3xl overflow-hidden animate-in slide-in-from-right-10 duration-500">
                      <CardHeader className="pb-3 bg-slate-50 px-5 py-4 border-b border-slate-100">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-indigo-100 rounded-xl flex items-center justify-center border border-indigo-200">
                              <CalendarDays className="w-4 h-4 text-indigo-600" />
                            </div>
                            <div>
                              <CardTitle className="text-sm font-black tracking-tight leading-none">
                                {selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                              </CardTitle>
                            </div>
                          </div>
                          <button onClick={() => setSelectedDate(null)} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
                            <X className="w-4 h-4 text-slate-400" />
                          </button>
                        </div>
                      </CardHeader>
                      <CardContent className="px-5 py-4">
                        {(() => {
                          const specialDate = getSpecialDateInfo(selectedDate);
                          const isHoliday = specialDate?.type === 'holiday';

                          return (
                            <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                              <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-lg ${isHoliday ? 'bg-rose-100 text-rose-600' : 'bg-slate-100 text-slate-400'}`}>
                                  <PartyPopper className="w-5 h-5" />
                                </div>
                                <div>
                                  <p className="font-black text-[10px] uppercase tracking-widest text-slate-400">Action</p>
                                  <p className="font-bold text-sm text-slate-800">Mark as Holiday</p>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  const y = selectedDate.getFullYear();
                                  const m = String(selectedDate.getMonth() + 1).padStart(2, '0');
                                  const d = String(selectedDate.getDate()).padStart(2, '0');
                                  toggleHolidayForDate(`${y}-${m}-${d}`);
                                }}
                                className={`w-14 h-8 rounded-full transition-colors duration-300 relative border-2 border-slate-900 ${
                                  isHoliday 
                                    ? 'bg-emerald-500 shadow-md' 
                                    : 'bg-slate-200'
                                }`}
                              >
                                <div
                                  className={`absolute top-[2px] w-6 h-6 bg-white rounded-full border-2 border-slate-900 shadow-sm transition-transform duration-300 ease-in-out ${
                                    isHoliday ? 'translate-x-[28px]' : 'translate-x-[0px]'
                                  }`}
                                  style={{ left: '2px' }}
                                />
                              </button>
                            </div>
                          );
                        })()}
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}

              {/* Holidays Tab Content */}
              {activeTab === 'holidays' && availability && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Public Holidays List */}
                    <div className="lg:col-span-2 space-y-6">
                      <Card className="rounded-3xl border-0 shadow-xl overflow-hidden bg-white">
                        <CardHeader className="bg-slate-900 border-b border-white/10 py-6 px-7">
                          <CardTitle className="text-lg font-black text-white flex items-center justify-between">
                            <span className="flex items-center gap-3 italic">
                              <Sparkles className="w-5 h-5 text-amber-400" />
                              Official Holidays {currentMonth.getFullYear()}
                            </span>
                            <div className="flex items-center bg-white/10 rounded-lg px-3 py-1 text-[10px] font-black uppercase tracking-widest text-amber-400">
                              Regional India
                            </div>
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="p-6">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {holidays.map((holiday) => {
                              const isAdded = availability.specialDates.some(
                                sd => sd.date.includes(holiday.date) && sd.type === 'holiday'
                              );

                              return (
                                <button
                                  key={holiday.date}
                                  onClick={() => {
                                    if (isAdded) {
                                      removeSpecialDate(holiday.date.split('T')[0]);
                                    } else {
                                      addHoliday(holiday);
                                    }
                                  }}
                                  className={`group flex items-center gap-4 p-4 rounded-2xl border transition-all duration-300 text-left ${
                                    isAdded
                                      ? 'bg-emerald-50 border-emerald-100 cursor-pointer opacity-100'
                                      : 'bg-white border-slate-100 hover:border-indigo-200 hover:shadow-lg hover:shadow-indigo-50 cursor-pointer'
                                  }`}
                                >
                                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${
                                    isAdded ? 'bg-emerald-500 text-white' : 'bg-rose-50 text-rose-500 group-hover:bg-indigo-500 group-hover:text-white'
                                  }`}>
                                    <PartyPopper className={`w-6 h-6 ${isAdded ? 'scale-90' : 'group-hover:scale-110'}`} />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className={`font-bold text-sm tracking-tight ${isAdded ? 'text-slate-800' : 'text-slate-600'}`}>{holiday.name}</p>
                                    <p className="text-[10px] font-black uppercase tracking-[0.1em] text-slate-400 mt-0.5">
                                      {new Date(holiday.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
                                    </p>
                                  </div>
                                  {isAdded ? (
                                    <div className="bg-emerald-100 p-1 rounded-full">
                                      <CheckCircle className="w-5 h-5 text-emerald-600" />
                                    </div>
                                  ) : (
                                    <Plus className="w-5 h-5 text-slate-300 group-hover:text-indigo-500 group-hover:translate-x-1 transition-all" />
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Blocked Dates Management */}
                    <div className="space-y-6">
                      <Card className="rounded-3xl border-0 shadow-xl bg-slate-900 text-white overflow-hidden h-full">
                        <CardHeader className="py-6 px-7 border-b border-white/10">
                          <CardTitle className="text-lg font-black italic flex items-center gap-3">
                            <CalendarCheck className="w-5 h-5 text-indigo-400" />
                            Active Blocklist
                          </CardTitle>
                          <CardDescription className="text-white/40 text-xs font-medium">Currently configured unavailable dates</CardDescription>
                        </CardHeader>
                        <CardContent className="p-7">
                          {availability.specialDates.length === 0 ? (
                            <div className="text-center py-12 flex flex-col items-center">
                              <div className="bg-white/5 p-5 rounded-[2rem] mb-6">
                                <AlertCircle className="w-12 h-12 text-slate-700" />
                              </div>
                              <p className="font-bold text-lg">No Blocked Dates</p>
                              <p className="text-white/30 text-xs mt-2 leading-relaxed">Your application is fully available <br/>according to the weekly schedule.</p>
                            </div>
                          ) : (
                            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                              {[...availability.specialDates].sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime()).map((sd, index) => (
                                <div
                                  key={index}
                                  className="group flex flex-col p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all shadow-lg"
                                >
                                  <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-3">
                                      <div className={`p-2 rounded-lg ${sd.type === 'holiday' ? 'bg-rose-500/20' : 'bg-indigo-500/20'}`}>
                                        <PartyPopper className={`w-4 h-4 ${sd.type === 'holiday' ? 'text-rose-400' : 'text-indigo-400'}`} />
                                      </div>
                                      <span className="text-[10px] font-black uppercase tracking-widest text-indigo-300/60 line-clamp-1">{sd.name || 'Custom Date'}</span>
                                    </div>
                                    <button
                                      onClick={() => removeSpecialDate(sd.date.split('T')[0])}
                                      className="p-1.5 hover:bg-rose-500/20 hover:text-rose-400 rounded-lg text-white/20 transition-all opacity-0 group-hover:opacity-100"
                                    >
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                  <div className="flex flex-col">
                                    <span className="font-bold text-sm">{new Date(sd.date).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                                    <span className="text-[10px] text-white/40 font-medium mt-1">{new Date(sd.date).toLocaleDateString('en-US', { weekday: 'long' })}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                </div>
              )}

              {/* Settings Tab Content */}
              {activeTab === 'settings' && availability && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card className="rounded-3xl border-0 shadow-xl overflow-hidden bg-white hover:shadow-2xl transition-all border-l-4 border-l-indigo-600">
                      <CardHeader className="py-7 px-8 pb-4">
                        <CardTitle className="text-xl font-black italic text-slate-800 flex items-center gap-3">
                          <Clock className="w-6 h-6 text-indigo-600" />
                          Timing Rules
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="px-8 pb-8 space-y-8">
                        <div className="space-y-3">
                          <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 flex items-center justify-between">
                            Slot Duration (Minutes)
                            <span className="bg-indigo-50 text-indigo-600 px-2 rounded-lg font-black">{availability.slotDuration || 30}m</span>
                          </label>
                          <input
                            type="range"
                            min="15"
                            max="120"
                            step="15"
                            value={availability.slotDuration}
                            onChange={(e) => updateSettings({ slotDuration: parseInt(e.target.value) })}
                            className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                          />
                        </div>
                        <div className="space-y-3">
                          <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 flex items-center justify-between">
                            Advance Booking Lead (Days)
                            <span className="bg-indigo-50 text-indigo-600 px-2 rounded-lg font-black">{availability.maxAdvanceDays || 30}d</span>
                          </label>
                          <input
                            type="range"
                            min="1"
                            max="90"
                            value={availability.maxAdvanceDays}
                            onChange={(e) => updateSettings({ maxAdvanceDays: parseInt(e.target.value) })}
                            className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                          />
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="rounded-3xl border-0 shadow-xl overflow-hidden bg-white hover:shadow-2xl transition-all border-l-4 border-l-slate-900">
                      <CardHeader className="py-7 px-8 pb-4">
                        <CardTitle className="text-xl font-black italic text-slate-800 flex items-center gap-3">
                          <Target className="w-6 h-6 text-slate-900" />
                          Capacity Limits
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="px-8 pb-8 space-y-8">
                        <div className="space-y-3">
                          <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 flex items-center justify-between">
                            Simultaneous Bookings
                            <span className="bg-slate-100 text-slate-900 px-2 rounded-lg font-black">{availability.maxConcurrentAppointments || 1} staff</span>
                          </label>
                          <div className="flex items-center gap-4">
                             <button 
                              onClick={() => updateSettings({ maxConcurrentAppointments: Math.max(1, (availability.maxConcurrentAppointments || 1) - 1) })}
                              className="w-12 h-12 flex items-center justify-center bg-slate-50 rounded-2xl text-slate-400 hover:bg-slate-900 hover:text-white transition-all shadow-inner font-black text-xl"
                             >-</button>
                             <div className="flex-1 text-center font-black text-3xl text-slate-800 tracking-tighter">
                               {availability.maxConcurrentAppointments || 1}
                             </div>
                             <button 
                               onClick={() => updateSettings({ maxConcurrentAppointments: (availability.maxConcurrentAppointments || 1) + 1 })}
                               className="w-12 h-12 flex items-center justify-center bg-slate-50 rounded-2xl text-slate-400 hover:bg-slate-900 hover:text-white transition-all shadow-inner font-black text-xl"
                             >+</button>
                          </div>
                        </div>
                        <div className="flex items-center justify-between p-4 bg-slate-50 rounded-3xl border border-slate-100">
                           <div>
                              <p className="font-bold text-slate-800 tracking-tight">Public Visibility</p>
                              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mt-1">Status: {availability.isActive ? 'ONLINE' : 'OFFLINE'}</p>
                           </div>
                           <button
                             onClick={() => updateSettings({ isActive: !availability.isActive })}
                             className={`w-14 h-8 rounded-full transition-all duration-300 relative ${
                               availability.isActive ? 'bg-slate-900 shadow-inner' : 'bg-slate-200 shadow-inner'
                             }`}
                           >
                              <div className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow-md transition-all duration-300 ${
                                availability.isActive ? 'translate-x-6' : 'translate-x-0'
                              }`} style={{ left: '4px' }} />
                           </button>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="border-t border-slate-200 p-4 sm:p-6 bg-white flex flex-col sm:flex-row items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3">
            {hasChanges && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 text-amber-700 rounded-xl border border-amber-100 animate-pulse">
                <AlertCircle className="w-4 h-4" />
                <span className="text-[10px] font-black uppercase tracking-widest">Unsaved changes detected</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <Button
              variant="outline"
              onClick={handleReset}
              disabled={!hasChanges || loading || saving}
              className="flex-1 sm:flex-none h-12 px-6 rounded-2xl border-slate-200 hover:bg-slate-50 text-slate-600 font-bold text-sm flex items-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              Reset
            </Button>
            <Button
              onClick={handleSave}
              disabled={!hasChanges || loading || saving}
              className={`flex-1 sm:flex-none h-12 px-10 rounded-2xl font-black text-[11px] uppercase tracking-widest flex items-center gap-3 transition-all duration-300 shadow-xl ${
                hasChanges 
                  ? 'bg-indigo-600 text-white hover:bg-slate-900 hover:scale-[1.03] shadow-indigo-200'
                  : 'bg-slate-100 text-slate-400 cursor-not-allowed shadow-none'
              }`}
            >
              {saving ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  Apply Changes
                </>
              )}
            </Button>
          </div>
        </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
