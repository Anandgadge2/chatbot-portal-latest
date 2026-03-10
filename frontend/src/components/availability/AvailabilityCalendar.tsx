'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
  const [hourStr, minuteStr] = (time || '09:00').split(':');
  const hour24 = Number.parseInt(hourStr || '9', 10);
  const minute = Number.parseInt(minuteStr || '0', 10);
  const period: 'AM' | 'PM' = hour24 >= 12 ? 'PM' : 'AM';
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return { hour12, minute, period };
};

const to24HourTime = (hour12: number, minute: number, period: 'AM' | 'PM') => {
  let hour24 = hour12 % 12;
  if (period === 'PM') hour24 += 12;
  return `${String(hour24).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
};

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
  const [minute, setMinute] = useState([0, 15, 30, 45].includes(parsed.minute) ? parsed.minute : 0);
  const [period, setPeriod] = useState<'AM' | 'PM'>(parsed.period);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-slate-700">Select Time</p>
        <button type="button" onClick={onClose} className="text-[11px] font-semibold text-slate-500 hover:text-slate-700">Close</button>
      </div>

      <div className="rounded-full border-2 border-indigo-100 w-44 h-44 mx-auto relative bg-indigo-50/40">
        {HOUR_RING.map((h, idx) => {
          const angle = (idx / HOUR_RING.length) * 2 * Math.PI - Math.PI / 2;
          const radius = 68;
          const x = 88 + radius * Math.cos(angle);
          const y = 88 + radius * Math.sin(angle);
          const active = hour12 === h;
          return (
            <button
              key={h}
              type="button"
              onClick={() => setHour12(h)}
              className={`absolute -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full text-[10px] font-bold border transition ${active ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-700 border-slate-200 hover:border-indigo-300'}`}
              style={{ left: `${x}px`, top: `${y}px` }}
            >
              {h}
            </button>
          );
        })}
        <div className="absolute inset-0 flex items-center justify-center">
          <Clock className="w-8 h-8 text-indigo-300" />
        </div>
      </div>

      <div className="flex items-center justify-center gap-2">
        {(['AM', 'PM'] as const).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setPeriod(p)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${period === p ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-700 border-slate-200'}`}
          >
            {p}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-4 gap-2">
        {[0, 15, 30, 45].map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMinute(m)}
            className={`py-1.5 rounded-lg text-xs font-bold border ${minute === m ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-700 border-slate-200'}`}
          >
            :{String(m).padStart(2, '0')}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={() => onChange(to24HourTime(hour12, minute, period))}
        className="w-full py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold"
      >
        Apply {to24HourTime(hour12, minute, period)}
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
  const [markingHolidayForDate, setMarkingHolidayForDate] = useState<string | null>(null);
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
  const addHoliday = async (holiday: Holiday) => {
    try {
      setMarkingHolidayForDate(holiday.date);
      const specialDate: SpecialDate = {
        date: holiday.date,
        type: 'holiday',
        name: holiday.name,
        isAvailable: false
      };
      
      const response = await availabilityAPI.addSpecialDate(specialDate, departmentId);
      if (response && response.availability) {
        setAvailability(response.availability);
        toast.success(`${holiday.name} added as holiday`);
      }
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to add holiday');
    } finally {
      setMarkingHolidayForDate(null);
    }
  };

  // Remove special date
  const removeSpecialDate = async (date: string) => {
    try {
      const response = await availabilityAPI.removeSpecialDate(date, departmentId);
      if (response && response.availability) {
        setAvailability(response.availability);
        toast.success('Date removed successfully');
      }
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to remove date');
    }
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
    return availability.specialDates.find(sd => {
      const sdDate = new Date(sd.date);
      return sdDate.getFullYear() === date.getFullYear() &&
             sdDate.getMonth() === date.getMonth() &&
             sdDate.getDate() === date.getDate();
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
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-none sm:rounded-3xl shadow-2xl w-full max-w-full sm:max-w-5xl h-full sm:max-h-[92vh] overflow-hidden border-0 sm:border border-slate-200 flex flex-col">
        {/* Header */}
        <div className="bg-slate-900 px-6 py-5 text-white relative overflow-hidden flex-shrink-0">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48cGF0dGVybiBpZD0iYSIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSIgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBwYXR0ZXJuVHJhbnNmb3JtPSJyb3RhdGUoNDUpIj48cGF0aCBkPSJNLTEwIDMwaDYwdjJoLTYweiIgZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwwLjA1KSIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0idXJsKCNhKSIvPjwvc3ZnPg==')] opacity-30"></div>
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
                <CalendarDays className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-2xl font-black italic tracking-tight">Appointment Availability</h2>
                <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mt-0.5">Configure when appointments can be scheduled</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-white hover:bg-white/20 rounded-xl h-8 w-8 sm:h-10 sm:w-10 p-0 flex-shrink-0"
              title="Close"
            >
              <X className="w-4 h-4 sm:w-5 sm:h-5" />
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-slate-200 bg-white/80 backdrop-blur-sm overflow-x-auto flex-shrink-0">
          <div className="flex gap-1 px-2 sm:px-4 py-2 min-w-max">
            {([
              { id: 'weekly', label: 'Weekly Schedule', icon: Calendar, tooltip: 'Set your default weekly availability' },
              { id: 'calendar', label: 'Calendar View', icon: CalendarDays, tooltip: 'View and manage specific dates' },
              { id: 'holidays', label: 'Holidays', icon: PartyPopper, tooltip: 'Add national and custom holidays' },
              { id: 'settings', label: 'Settings', icon: Settings, tooltip: 'Configure booking rules and time slots' }
            ] as const).map((tab) => {
              const active = activeTab === tab.id;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  title={tab.tooltip}
                  className={`flex items-center gap-2 px-6 py-4 text-[10px] font-black uppercase tracking-widest transition-all relative group ${
                    active ? 'text-slate-900 border-b-2 border-indigo-600' : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${active ? 'text-indigo-600' : 'text-slate-400 group-hover:text-slate-500'}`} />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-3 sm:p-6 bg-slate-50/30 sm:[zoom:0.9]">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <LoadingSpinner />
              <p className="text-slate-500 font-medium animate-pulse">Loading availability data...</p>
            </div>
          ) : (
            <div className="max-w-4xl mx-auto w-full">
              {/* Weekly Schedule Tab */}
              {activeTab === 'weekly' && availability && (
                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
                  <div className="flex items-center gap-3 text-sm text-indigo-700 bg-indigo-50/50 px-5 py-4 rounded-2xl border border-indigo-100/50 shadow-sm">
                    <div className="p-2 bg-indigo-100 rounded-lg">
                      <Info className="w-4 h-4 text-indigo-600 flex-shrink-0" />
                    </div>
                    <span>Configure your weekly availability schedule. Toggle days on/off and set time slots for morning, afternoon, and evening to fine-tune booking windows.</span>
                  </div>

                  <div className="grid gap-4">
                    {DAYS_OF_WEEK.map((day) => {
                      const dayAvailability = availability.weeklySchedule[day.key];
                      const isWeekend = day.key === 'saturday' || day.key === 'sunday';

                      return (
                        <div
                          key={day.key}
                          className={`rounded-3xl border transition-all duration-300 overflow-hidden ${
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
                                              <div className="absolute z-20 top-[110%] left-0 bg-white rounded-2xl border border-slate-200 shadow-2xl p-3 w-64">
                                                <ClockFacePicker
                                                  value={slot.startTime}
                                                  onChange={(val) => {
                                                    updateTimeSlot(day.key, period, { startTime: val });
                                                    setActiveClockPicker(null);
                                                  }}
                                                  onClose={() => setActiveClockPicker(null)}
                                                />
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
                                              <div className="absolute z-20 top-[110%] left-0 bg-white rounded-2xl border border-slate-200 shadow-2xl p-3 w-64">
                                                <ClockFacePicker
                                                  value={slot.endTime}
                                                  onChange={(val) => {
                                                    updateTimeSlot(day.key, period, { endTime: val });
                                                    setActiveClockPicker(null);
                                                  }}
                                                  onClose={() => setActiveClockPicker(null)}
                                                />
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
                  <div className="flex items-center gap-3 text-sm text-purple-700 bg-purple-50/50 px-5 py-4 rounded-2xl border border-purple-100/50 shadow-sm">
                    <div className="p-2 bg-purple-100 rounded-lg">
                      <CalendarDays className="w-4 h-4 text-purple-600 flex-shrink-0" />
                    </div>
                    <span>Visualise your monthly availability. Highlights show holidays, special dates, and default working periods. Click any day for detailed configuration.</span>
                  </div>

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
                  <div className="bg-white rounded-[2.5rem] border border-slate-200/60 overflow-hidden shadow-2xl mx-auto backdrop-blur-xl">
                    {/* Week Headers */}
                    <div className="grid grid-cols-7 bg-slate-50/50 border-b border-slate-100">
                      {DAYS_OF_WEEK.map((day) => (
                        <div
                          key={day.key}
                          className={`py-5 text-center text-[10px] font-black uppercase tracking-[0.15em] ${
                            day.key === 'sunday' || day.key === 'saturday'
                              ? 'text-rose-500/70'
                              : 'text-slate-400'
                          }`}
                        >
                          {day.short}
                        </div>
                      ))}
                    </div>

                    {/* Calendar Days */}
                    <div className="grid grid-cols-7 divide-x divide-y divide-slate-50">
                      {getCalendarDays().map((date, index) => {
                        if (!date) {
                          return <div key={`empty-${index}`} className="aspect-square sm:h-24 bg-slate-50/30" />;
                        }

                        const isToday = date.toDateString() === new Date().toDateString();
                        const isPast = date < new Date(new Date().setHours(0, 0, 0, 0));
                        const isAvailable = isDateAvailable(date);
                        const specialDate = getSpecialDateInfo(date);
                        const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                        const isSelected = selectedDate?.toDateString() === date.toDateString();

                        return (
                          <button
                            key={date.toISOString()}
                            onClick={() => setSelectedDate(isSelected ? null : date)}
                            disabled={isPast}
                            className={`aspect-square sm:h-24 p-2 transition-all duration-300 text-left relative group flex flex-col ${
                              isPast
                                ? 'bg-slate-50/50 text-slate-300 grayscale cursor-not-allowed'
                                : isSelected
                                ? 'bg-indigo-600 text-white shadow-2xl scale-[1.02] z-10 rounded-2xl mx-1 my-1'
                                : specialDate?.type === 'holiday'
                                ? 'bg-rose-50/80 hover:bg-rose-100'
                                : isAvailable
                                ? 'bg-white hover:bg-indigo-50/50'
                                : 'bg-slate-100/30 hover:bg-slate-100'
                            }`}
                          >
                            <span
                              className={`inline-flex items-center justify-center w-8 h-8 rounded-2xl text-sm font-black transition-all ${
                                isToday && !isSelected
                                  ? 'bg-indigo-100 text-indigo-700 shadow-sm'
                                  : isSelected
                                  ? 'text-white'
                                  : isWeekend
                                  ? 'text-rose-500'
                                  : 'text-slate-700'
                              }`}
                            >
                              {date.getDate()}
                            </span>
                            
                            {specialDate && (
                              <div className={`mt-auto text-[9px] px-2 py-1 rounded-lg font-bold truncate max-w-full flex items-center gap-1 shadow-sm ${
                                isSelected 
                                  ? 'bg-white/20 text-white' 
                                  : specialDate.type === 'holiday'
                                  ? 'bg-rose-200 text-rose-800'
                                  : 'bg-indigo-200 text-indigo-800'
                              }`}>
                                <PartyPopper className="w-3 h-3 flex-shrink-0" />
                                <span className="truncate">{specialDate.name || 'Special'}</span>
                              </div>
                            )}

                            {!isPast && !specialDate && !isSelected && (
                              <div className="absolute bottom-3 right-3">
                                <div className={`w-2.5 h-2.5 rounded-full shadow-sm border border-white ${
                                  isAvailable ? 'bg-emerald-500 animate-pulse' : 'bg-slate-200'
                                }`} />
                              </div>
                            )}
                            
                            {isToday && !isSelected && (
                              <div className="absolute top-2 right-2 flex items-center gap-1">
                                <span className="flex h-2 w-2 rounded-full bg-indigo-500 shadow-sm"></span>
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
                    <Card className="border-0 shadow-2xl bg-indigo-900 text-white rounded-[2rem] overflow-hidden animate-in slide-in-from-right-10 duration-500">
                      <CardHeader className="pb-4 bg-indigo-800/50 px-8 py-8">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-5">
                            <div className="w-14 h-14 bg-white/10 rounded-[1.5rem] flex items-center justify-center backdrop-blur-xl border border-white/20 shadow-inner">
                              <CalendarDays className="w-7 h-7 text-indigo-200" />
                            </div>
                            <div>
                              <CardTitle className="text-2xl font-black tracking-tight leading-none">
                                {selectedDate.toLocaleDateString('en-US', { weekday: 'long' })}
                              </CardTitle>
                              <CardDescription className="text-indigo-200/70 font-bold mt-2 uppercase tracking-widest text-[10px]">
                                {selectedDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                              </CardDescription>
                            </div>
                          </div>
                          <button onClick={() => setSelectedDate(null)} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
                            <X className="w-6 h-6" />
                          </button>
                        </div>
                      </CardHeader>
                      <CardContent className="px-8 py-8 space-y-6">
                        {(() => {
                          const specialDate = getSpecialDateInfo(selectedDate);
                          const dayName = DAYS_OF_WEEK[selectedDate.getDay()].key;
                          const daySchedule = availability.weeklySchedule[dayName];

                          if (specialDate) {
                            return (
                              <div className="space-y-6">
                                <div className={`inline-flex items-center gap-3 px-5 py-3 rounded-2xl text-sm font-black uppercase tracking-widest shadow-xl ${
                                  specialDate.type === 'holiday'
                                    ? 'bg-rose-500 text-white'
                                    : 'bg-blue-500 text-white'
                                }`}>
                                  <PartyPopper className="w-5 h-5" />
                                  {specialDate.name || 'Custom Special Date'}
                                </div>
                                <div className="bg-white/5 rounded-2xl p-5 border border-white/10 backdrop-blur-sm">
                                  <p className="text-indigo-100/80 leading-relaxed font-medium">
                                    {specialDate.isAvailable 
                                      ? '⚡ Special operational window is active for this date.' 
                                      : '⛔ This date is currently blocked for all public appointments.'}
                                  </p>
                                </div>
                                <div className="flex gap-3">
                                  <Button
                                    variant="outline"
                                    onClick={() => removeSpecialDate(selectedDate.toISOString().split('T')[0])}
                                    className="bg-red-500/20 hover:bg-red-500 border-red-500/50 text-white font-bold rounded-2xl px-6 h-12 flex-1"
                                  >
                                    <X className="w-5 h-5 mr-3" />
                                    Restore Regular Schedule
                                  </Button>
                                </div>
                              </div>
                            );
                          }

                          return (
                            <div className="space-y-6">
                              <div className="bg-white/5 rounded-2xl p-5 border border-white/10 flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                  <div className={`p-3 rounded-xl ${daySchedule.isAvailable ? 'bg-emerald-500/20' : 'bg-white/10'}`}>
                                    {daySchedule.isAvailable ? <CheckCircle className="text-emerald-400 w-6 h-6" /> : <XCircle className="text-slate-400 w-6 h-6" />}
                                  </div>
                                  <div>
                                    <p className="font-black text-xs uppercase tracking-widest text-indigo-300">Standard Rule</p>
                                    <p className="text-lg font-bold mt-0.5">{daySchedule.isAvailable ? 'Regular Operations' : 'Closed for Weekend/Regular'}</p>
                                  </div>
                                </div>
                              </div>
                              
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <button
                                  onClick={() => addHoliday({ date: selectedDate.toISOString().split('T')[0], name: 'Custom Holiday', type: 'holiday' })}
                                  className="group bg-rose-500 hover:bg-rose-600 text-white p-6 rounded-3xl transition-all duration-300 shadow-xl border border-rose-400/30 text-left"
                                  disabled={markingHolidayForDate === selectedDate.toISOString().split('T')[0]}
                                >
                                  <PartyPopper className="w-8 h-8 mb-4 group-hover:rotate-12 transition-transform" />
                                  <p className="font-black text-xs uppercase tracking-widest mb-1 opacity-80">Action Required</p>
                                  <h4 className="font-bold text-lg">Mark as Holiday</h4>
                                </button>
                                
                                <button
                                  onClick={() => toast.success('Time slots for this date are being loaded...')}
                                  className="group bg-indigo-500 hover:bg-indigo-600 text-white p-6 rounded-3xl transition-all duration-300 shadow-xl border border-indigo-400/30 text-left"
                                >
                                  <Settings className="w-8 h-8 mb-4 group-hover:rotate-45 transition-transform" />
                                  <p className="font-black text-xs uppercase tracking-widest mb-1 opacity-80">Custom Schedule</p>
                                  <h4 className="font-bold text-lg">Edit Specific Slots</h4>
                                </button>
                              </div>
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
                  <div className="flex items-center gap-3 text-sm text-rose-700 bg-rose-50/50 px-5 py-4 rounded-2xl border border-rose-100/50 shadow-sm">
                    <div className="p-2 bg-rose-100 rounded-lg">
                      <PartyPopper className="w-4 h-4 text-rose-600 flex-shrink-0" />
                    </div>
                    <span>Manage regional and custom holidays. Adding a holiday will automatically block all appointment slots for the entire day.</span>
                  </div>

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
                                  onClick={() => !isAdded && addHoliday(holiday)}
                                  className={`group flex items-center gap-4 p-4 rounded-2xl border transition-all duration-300 text-left ${
                                    isAdded
                                      ? 'bg-emerald-50 border-emerald-100 cursor-default opacity-80'
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
                                      onClick={() => removeSpecialDate(sd.date)}
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
                  <div className="flex items-center gap-3 text-sm text-slate-900 bg-slate-100 px-5 py-4 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="p-2 bg-white rounded-lg shadow-sm">
                      <Settings className="w-4 h-4 text-slate-900 flex-shrink-0" />
                    </div>
                    <span>Global settings for the appointment system. Configure buffer times, booking lead times, and daily capacity limits.</span>
                  </div>

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
        <div className="border-t border-slate-200 p-4 sm:p-6 bg-white flex flex-col sm:flex-row items-center justify-between gap-4 flex-shrink-0">
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
    </div>
  );
}

// Add these Lucide icons to imports if missing
function Plus(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    </svg>
  );
}

function CheckCircle2(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}
