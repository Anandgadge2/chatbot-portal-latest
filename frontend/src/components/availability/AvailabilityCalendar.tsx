'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { availabilityAPI, AppointmentAvailability, DayAvailability, TimeSlot, SpecialDate, Holiday, WeeklySchedule } from '@/lib/api/availability';
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
  AlertCircle
} from 'lucide-react';

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

const TIME_OPTIONS = Array.from({ length: 24 * 4 }, (_, i) => {
  const hours = Math.floor(i / 4);
  const minutes = (i % 4) * 15;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
});

const DEFAULT_TIME_SLOT: TimeSlot = {
  enabled: true,
  startTime: '09:00',
  endTime: '12:00'
};

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
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-gradient-to-br from-slate-50 via-white to-blue-50 rounded-none sm:rounded-3xl shadow-2xl w-full max-w-full sm:max-w-5xl h-full sm:max-h-[90vh] overflow-hidden border-0 sm:border border-slate-200/50">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 px-6 py-5 text-white relative overflow-hidden">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48cGF0dGVybiBpZD0iYSIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSIgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBwYXR0ZXJuVHJhbnNmb3JtPSJyb3RhdGUoNDUpIj48cGF0aCBkPSJNLTEwIDMwaDYwdjJoLTYweiIgZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwwLjA1KSIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0idXJsKCNhKSIvPjwvc3ZnPg==')] opacity-30"></div>
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
                <CalendarDays className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-2xl font-bold tracking-tight">Appointment Availability</h2>
                <p className="text-white/80 text-sm mt-0.5">Configure when appointments can be scheduled</p>
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
        <div className="border-b border-slate-200 bg-white/80 backdrop-blur-sm overflow-x-auto">
          <div className="flex gap-1 px-2 sm:px-4 py-2 min-w-max">
            {[
              { id: 'weekly', label: 'Weekly Schedule', icon: Calendar, tooltip: 'Set your default weekly availability' },
              { id: 'calendar', label: 'Calendar View', icon: CalendarDays, tooltip: 'View and manage specific dates' },
              { id: 'holidays', label: 'Holidays', icon: PartyPopper, tooltip: 'Add national and custom holidays' },
              { id: 'settings', label: 'Settings', icon: Settings, tooltip: 'Configure booking rules and time slots' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                title={tab.tooltip}
                className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-all duration-200 whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-lg shadow-indigo-200'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <tab.icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden">{tab.label.split(' ')[0]}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-3 sm:p-6 overflow-y-auto max-h-[calc(100vh-180px)] sm:max-h-[calc(90vh-200px)] custom-scrollbar">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-200 border-t-indigo-600"></div>
            </div>
          ) : (
            <>
              {/* Weekly Schedule Tab */}
              {activeTab === 'weekly' && availability && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-sm text-slate-600 bg-blue-50 px-4 py-3 rounded-xl border border-blue-100">
                    <Info className="w-4 h-4 text-blue-500 flex-shrink-0" />
                    <span>Configure your weekly availability schedule. Toggle days on/off and set time slots for morning, afternoon, and evening.</span>
                  </div>

                  <div className="grid gap-3">
                    {DAYS_OF_WEEK.map((day) => {
                      const dayAvailability = availability.weeklySchedule[day.key];
                      const isWeekend = day.key === 'saturday' || day.key === 'sunday';

                      return (
                        <div
                          key={day.key}
                          className={`rounded-2xl border transition-all duration-300 overflow-hidden ${
                            dayAvailability.isAvailable
                              ? 'border-emerald-200 bg-gradient-to-r from-emerald-50/50 to-green-50/50 shadow-sm'
                              : 'border-slate-200 bg-slate-50/50'
                          }`}
                        >
                          {/* Day Header */}
                          <div className="flex items-center justify-between px-5 py-4">
                            <div className="flex items-center gap-4">
                              <button
                                onClick={() => updateDayAvailability(day.key, { isAvailable: !dayAvailability.isAvailable })}
                                title={dayAvailability.isAvailable ? 'Click to mark as unavailable' : 'Click to mark as available'}
                                className={`w-14 h-8 rounded-full transition-all duration-300 relative ${
                                  dayAvailability.isAvailable
                                    ? 'bg-gradient-to-r from-emerald-400 to-green-500'
                                    : 'bg-slate-300'
                                }`}
                              >
                                <div
                                  className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow-md transition-all duration-300 ${
                                    dayAvailability.isAvailable ? 'left-7' : 'left-1'
                                  }`}
                                />
                              </button>
                              <div>
                                <span className={`font-semibold text-lg ${
                                  dayAvailability.isAvailable ? 'text-slate-800' : 'text-slate-500'
                                }`}>
                                  {day.label}
                                </span>
                                {isWeekend && (
                                  <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                                    Weekend
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className={`text-sm font-medium ${
                              dayAvailability.isAvailable ? 'text-emerald-600' : 'text-slate-400'
                            }`}>
                              {dayAvailability.isAvailable ? 'Available' : 'Not Available'}
                            </div>
                          </div>

                          {/* Time Slots */}
                          {dayAvailability.isAvailable && (
                            <div className="px-5 pb-4 grid grid-cols-3 gap-4">
                              {(['morning', 'afternoon', 'evening'] as const).map((period) => {
                                const slot = dayAvailability[period];
                                const periodConfig = {
                                  morning: { icon: Sun, label: 'Morning', color: 'amber', gradient: 'from-amber-400 to-orange-400' },
                                  afternoon: { icon: Sunset, label: 'Afternoon', color: 'blue', gradient: 'from-blue-400 to-cyan-400' },
                                  evening: { icon: Moon, label: 'Evening', color: 'indigo', gradient: 'from-indigo-400 to-purple-400' }
                                }[period];
                                const PeriodIcon = periodConfig.icon;

                                return (
                                  <div
                                    key={period}
                                    className={`rounded-xl p-4 transition-all duration-200 ${
                                      slot.enabled
                                        ? `bg-gradient-to-br ${periodConfig.gradient} text-white shadow-lg`
                                        : 'bg-slate-100 text-slate-500'
                                    }`}
                                  >
                                    <div className="flex items-center justify-between mb-3">
                                      <div className="flex items-center gap-2">
                                        <PeriodIcon className={`w-4 h-4 ${slot.enabled ? '' : 'text-slate-400'}`} />
                                        <span className="font-medium text-sm">{periodConfig.label}</span>
                                      </div>
                                      <button
                                        onClick={() => updateTimeSlot(day.key, period, { enabled: !slot.enabled })}
                                        title={slot.enabled ? 'Disable this time slot' : 'Enable this time slot'}
                                        className={`w-8 h-5 rounded-full transition-all relative ${
                                          slot.enabled ? 'bg-white/30' : 'bg-slate-300'
                                        }`}
                                      >
                                        <div
                                          className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${
                                            slot.enabled ? 'left-3.5' : 'left-0.5'
                                          }`}
                                        />
                                      </button>
                                    </div>
                                    
                                    {slot.enabled && (
                                      <div className="flex items-center gap-2 text-xs">
                                        <select
                                          value={slot.startTime}
                                          onChange={(e) => updateTimeSlot(day.key, period, { startTime: e.target.value })}
                                          title="Select start time"
                                          className="bg-white/20 border border-white/30 rounded-lg px-2 py-1.5 text-white backdrop-blur-sm text-xs w-full focus:outline-none focus:ring-2 focus:ring-white/50"
                                        >
                                          {TIME_OPTIONS.map((time) => (
                                            <option key={time} value={time} className="text-slate-800">{time}</option>
                                          ))}
                                        </select>
                                        <span className="text-white/80">to</span>
                                        <select
                                          value={slot.endTime}
                                          onChange={(e) => updateTimeSlot(day.key, period, { endTime: e.target.value })}
                                          title="Select end time"
                                          className="bg-white/20 border border-white/30 rounded-lg px-2 py-1.5 text-white backdrop-blur-sm text-xs w-full focus:outline-none focus:ring-2 focus:ring-white/50"
                                        >
                                          {TIME_OPTIONS.map((time) => (
                                            <option key={time} value={time} className="text-slate-800">{time}</option>
                                          ))}
                                        </select>
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
                <div className="space-y-6">
                  <div className="flex items-center gap-2 text-sm text-slate-600 bg-purple-50 px-4 py-3 rounded-xl border border-purple-100">
                    <Info className="w-4 h-4 text-purple-500 flex-shrink-0" />
                    <span>Click on any date to view or modify its availability. Holidays and custom dates are highlighted.</span>
                  </div>

                  {/* Month Navigation */}
                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
                      title="Previous month"
                      className="p-2 rounded-xl hover:bg-slate-100 transition-colors"
                    >
                      <ChevronLeft className="w-5 h-5 text-slate-600" />
                    </button>
                    <h3 className="text-xl font-bold text-slate-800">
                      {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                    </h3>
                    <button
                      onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
                      title="Next month"
                      className="p-2 rounded-xl hover:bg-slate-100 transition-colors"
                    >
                      <ChevronRight className="w-5 h-5 text-slate-600" />
                    </button>
                  </div>

                  {/* Calendar Grid */}
                  <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm max-w-3xl mx-auto">
                    {/* Week Headers */}
                    <div className="grid grid-cols-7 bg-gradient-to-r from-indigo-50 to-purple-50 border-b border-slate-200">
                      {DAYS_OF_WEEK.map((day) => (
                        <div
                          key={day.key}
                          className={`py-2.5 text-center text-xs font-bold uppercase tracking-wider ${
                            day.key === 'sunday' || day.key === 'saturday'
                              ? 'text-rose-500'
                              : 'text-slate-600'
                          }`}
                        >
                          {day.short}
                        </div>
                      ))}
                    </div>

                    {/* Calendar Days */}
                    <div className="grid grid-cols-7">
                      {getCalendarDays().map((date, index) => {
                        if (!date) {
                          return <div key={`empty-${index}`} className="p-1.5 h-16 bg-slate-50/30 border-r border-b border-slate-100" />;
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
                            title={specialDate?.name || (isAvailable ? 'Available for appointments' : 'Not available')}
                            className={`p-1.5 h-16 border-r border-b border-slate-100 transition-all duration-200 text-left relative group flex flex-col ${
                              isPast
                                ? 'bg-slate-100/50 text-slate-400 cursor-not-allowed'
                                : isSelected
                                ? 'bg-indigo-100 ring-2 ring-indigo-500 ring-inset'
                                : specialDate?.type === 'holiday'
                                ? 'bg-rose-50 hover:bg-rose-100'
                                : isAvailable
                                ? 'bg-emerald-50/50 hover:bg-emerald-100/50'
                                : 'bg-white hover:bg-slate-50'
                            }`}
                          >
                            <span
                              className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-semibold ${
                                isToday
                                  ? 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-md'
                                  : isWeekend
                                  ? 'text-rose-500'
                                  : 'text-slate-700'
                              }`}
                            >
                              {date.getDate()}
                            </span>
                            
                            {specialDate && (
                              <span className={`mt-0.5 text-[8px] px-1 py-0.5 rounded truncate max-w-full ${
                                specialDate.type === 'holiday'
                                  ? 'bg-rose-200 text-rose-700'
                                  : 'bg-blue-200 text-blue-700'
                              }`}>
                                {specialDate.name?.split(' ')[0] || 'Custom'}
                              </span>
                            )}

                            {!isPast && !specialDate && (
                              <div className="absolute bottom-1 right-1">
                                {isAvailable ? (
                                  <CheckCircle className="w-3 h-3 text-emerald-500" />
                                ) : (
                                  <XCircle className="w-3 h-3 text-slate-300" />
                                )}
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Legend */}
                  <div className="flex flex-wrap gap-4 justify-center text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded bg-emerald-100 border border-emerald-300" />
                      <span className="text-slate-600">Available</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded bg-white border border-slate-200" />
                      <span className="text-slate-600">Not Available</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded bg-rose-100 border border-rose-300" />
                      <span className="text-slate-600">Holiday</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded-full bg-indigo-600" />
                      <span className="text-slate-600">Today</span>
                    </div>
                  </div>

                  {/* Selected Date Details */}
                  {selectedDate && (
                    <Card className="border-indigo-200 bg-indigo-50/50">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-lg flex items-center gap-2">
                          <CalendarDays className="w-5 h-5 text-indigo-600" />
                          {selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {(() => {
                          const specialDate = getSpecialDateInfo(selectedDate);
                          const dayName = DAYS_OF_WEEK[selectedDate.getDay()].key;
                          const daySchedule = availability.weeklySchedule[dayName];

                          if (specialDate) {
                            return (
                              <div className="space-y-3">
                                <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${
                                  specialDate.type === 'holiday'
                                    ? 'bg-rose-100 text-rose-700'
                                    : 'bg-blue-100 text-blue-700'
                                }`}>
                                  <PartyPopper className="w-4 h-4" />
                                  {specialDate.name || 'Custom Date'}
                                </div>
                                <p className="text-slate-600 text-sm">
                                  {specialDate.isAvailable ? 'This is a special working day.' : 'This day is marked as unavailable.'}
                                </p>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => removeSpecialDate(selectedDate.toISOString())}
                                  className="text-rose-600 border-rose-200 hover:bg-rose-50"
                                >
                                  <X className="w-4 h-4 mr-1" />
                                  Remove Special Date
                                </Button>
                              </div>
                            );
                          }

                          return (
                            <div className="space-y-3">
                              <p className="text-slate-600 text-sm">
                                Following the <span className="font-medium">{DAYS_OF_WEEK[selectedDate.getDay()].label}</span> schedule.
                              </p>
                              <div className="flex items-center gap-2">
                                <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${
                                  daySchedule.isAvailable ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                                }`}>
                                  {daySchedule.isAvailable ? (
                                    <>
                                      <CheckCircle className="w-4 h-4" />
                                      Available
                                    </>
                                  ) : (
                                    <>
                                      <XCircle className="w-4 h-4" />
                                      Not Available
                                    </>
                                  )}
                                </span>
                              </div>
                              {(() => {
                                const selectedDateStr = selectedDate.toISOString().split('T')[0];
                                const isMarking = markingHolidayForDate === selectedDateStr;
                                return (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={isMarking}
                                    onClick={() => addHoliday({ date: selectedDateStr, name: 'Custom Holiday', type: 'holiday' })}
                                    className={`text-indigo-600 border-indigo-200 hover:bg-indigo-50 ${isMarking ? 'opacity-80 cursor-wait' : ''}`}
                                  >
                                    {isMarking ? (
                                      <>
                                        <div className="w-4 h-4 border-2 border-indigo-300 border-t-indigo-600 rounded-full animate-spin mr-1" />
                                        Marking as holiday...
                                      </>
                                    ) : (
                                      <>
                                        <PartyPopper className="w-4 h-4 mr-1" />
                                        Mark as Holiday
                                      </>
                                    )}
                                  </Button>
                                );
                              })()}
                            </div>
                          );
                        })()}
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}

              {/* Holidays Tab */}
              {activeTab === 'holidays' && availability && (
                <div className="space-y-6">
                  <div className="flex items-center gap-2 text-sm text-slate-600 bg-rose-50 px-4 py-3 rounded-xl border border-rose-100">
                    <Info className="w-4 h-4 text-rose-500 flex-shrink-0" />
                    <span>Add Indian national holidays or custom holidays to block appointments on specific dates.</span>
                  </div>

                  {/* Add Indian Holidays */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-amber-500" />
                        Indian Holidays {currentMonth.getFullYear()}
                      </CardTitle>
                      <CardDescription>Click to add holidays to your unavailable dates</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {holidays.map((holiday) => {
                          const isAdded = availability.specialDates.some(
                            sd => sd.date.includes(holiday.date) && sd.type === 'holiday'
                          );

                          return (
                            <button
                              key={holiday.date}
                              onClick={() => !isAdded && addHoliday(holiday)}
                              disabled={isAdded}
                              title={isAdded ? 'Already added' : `Click to add ${holiday.name} as a holiday`}
                              className={`flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${
                                isAdded
                                  ? 'bg-emerald-50 border-emerald-200 cursor-default'
                                  : 'bg-white border-slate-200 hover:border-rose-300 hover:bg-rose-50 cursor-pointer'
                              }`}
                            >
                              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                                isAdded ? 'bg-emerald-100' : 'bg-rose-100'
                              }`}>
                                <PartyPopper className={`w-5 h-5 ${isAdded ? 'text-emerald-600' : 'text-rose-600'}`} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm text-slate-800 truncate">{holiday.name}</p>
                                <p className="text-xs text-slate-500">
                                  {new Date(holiday.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                </p>
                              </div>
                              {isAdded && <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0" />}
                            </button>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Added Special Dates */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Calendar className="w-5 h-5 text-indigo-500" />
                        Your Blocked Dates
                      </CardTitle>
                      <CardDescription>Dates when appointments cannot be scheduled</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {availability.specialDates.length === 0 ? (
                        <div className="text-center py-8 text-slate-500">
                          <CalendarDays className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                          <p>No special dates added yet</p>
                          <p className="text-sm">Add holidays or custom dates from the list above</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {availability.specialDates.map((sd, index) => (
                            <div
                              key={index}
                              className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200"
                            >
                              <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                                  sd.type === 'holiday' ? 'bg-rose-100' : 'bg-blue-100'
                                }`}>
                                  {sd.type === 'holiday' ? (
                                    <PartyPopper className="w-5 h-5 text-rose-600" />
                                  ) : (
                                    <Calendar className="w-5 h-5 text-blue-600" />
                                  )}
                                </div>
                                <div>
                                  <p className="font-medium text-slate-800">{sd.name || 'Custom Date'}</p>
                                  <p className="text-xs text-slate-500">
                                    {new Date(sd.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                                  </p>
                                </div>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removeSpecialDate(sd.date)}
                                title="Remove this date"
                                className="text-rose-500 hover:text-rose-700 hover:bg-rose-50 h-8 w-8 p-0"
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Settings Tab */}
              {activeTab === 'settings' && availability && (
                <div className="space-y-6">
                  <div className="flex items-center gap-2 text-sm text-slate-600 bg-amber-50 px-4 py-3 rounded-xl border border-amber-100">
                    <Info className="w-4 h-4 text-amber-500 flex-shrink-0" />
                    <span>Configure booking rules such as slot duration, advance booking limits, and default time ranges.</span>
                  </div>

                  <div className="grid md:grid-cols-2 gap-6">
                    {/* Booking Rules */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                          <Clock className="w-5 h-5 text-blue-500" />
                          Booking Rules
                        </CardTitle>
                        <CardDescription>Control how appointments can be scheduled</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-2" title="Duration of each appointment slot">
                            Slot Duration (minutes)
                          </label>
                          <select
                            value={availability.slotDurationMinutes}
                            onChange={(e) => updateSettings({ slotDurationMinutes: parseInt(e.target.value) })}
                            className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                          >
                            {[15, 30, 45, 60, 90, 120].map((mins) => (
                              <option key={mins} value={mins}>{mins} minutes</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-2" title="Buffer time between appointments">
                            Buffer Between Slots (minutes)
                          </label>
                          <select
                            value={availability.bufferMinutes}
                            onChange={(e) => updateSettings({ bufferMinutes: parseInt(e.target.value) })}
                            className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                          >
                            {[0, 5, 10, 15, 30].map((mins) => (
                              <option key={mins} value={mins}>{mins} minutes</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-2" title="How many days in advance can appointments be booked">
                            Max Advance Booking (days)
                          </label>
                          <input
                            type="number"
                            min={1}
                            max={365}
                            value={availability.maxAdvanceBookingDays}
                            onChange={(e) => updateSettings({ maxAdvanceBookingDays: parseInt(e.target.value) || 30 })}
                            className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-2" title="Minimum hours before an appointment can be booked">
                            Min Advance Booking (hours)
                          </label>
                          <input
                            type="number"
                            min={0}
                            max={168}
                            value={availability.minAdvanceBookingHours}
                            onChange={(e) => updateSettings({ minAdvanceBookingHours: parseInt(e.target.value) || 24 })}
                            className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                          />
                        </div>
                      </CardContent>
                    </Card>

                    {/* Default Time Ranges */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                          <Settings className="w-5 h-5 text-purple-500" />
                          Default Time Ranges
                        </CardTitle>
                        <CardDescription>Fallback times when specific times aren&apos;t set</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {[
                          { period: 'Morning', start: 'defaultMorningStart', end: 'defaultMorningEnd', icon: Sun, color: 'amber' },
                          { period: 'Afternoon', start: 'defaultAfternoonStart', end: 'defaultAfternoonEnd', icon: Sunset, color: 'blue' },
                          { period: 'Evening', start: 'defaultEveningStart', end: 'defaultEveningEnd', icon: Moon, color: 'indigo' }
                        ].map(({ period, start, end, icon: Icon, color }) => (
                          <div key={period} className={`p-4 rounded-xl bg-${color}-50 border border-${color}-100`}>
                            <div className="flex items-center gap-2 mb-3">
                              <Icon className={`w-4 h-4 text-${color}-600`} />
                              <span className="font-medium text-slate-700">{period}</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <select
                                value={(availability as any)[start]}
                                onChange={(e) => updateSettings({ [start]: e.target.value })}
                                title={`Default ${period.toLowerCase()} start time`}
                                className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                              >
                                {TIME_OPTIONS.map((time) => (
                                  <option key={time} value={time}>{time}</option>
                                ))}
                              </select>
                              <span className="text-slate-500">to</span>
                              <select
                                value={(availability as any)[end]}
                                onChange={(e) => updateSettings({ [end]: e.target.value })}
                                title={`Default ${period.toLowerCase()} end time`}
                                className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                              >
                                {TIME_OPTIONS.map((time) => (
                                  <option key={time} value={time}>{time}</option>
                                ))}
                              </select>
                            </div>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  </div>

                  {/* Active Status */}
                  <Card>
                    <CardContent className="py-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {availability.isActive ? (
                            <CheckCircle className="w-6 h-6 text-emerald-500" />
                          ) : (
                            <AlertCircle className="w-6 h-6 text-amber-500" />
                          )}
                          <div>
                            <p className="font-medium text-slate-800">Availability Status</p>
                            <p className="text-sm text-slate-500">
                              {availability.isActive
                                ? 'Your availability settings are active and will be used for appointments'
                                : 'Availability is paused - default times will be used'}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => updateSettings({ isActive: !availability.isActive })}
                          title={availability.isActive ? 'Pause availability settings' : 'Activate availability settings'}
                          className={`w-16 h-9 rounded-full transition-all relative ${
                            availability.isActive
                              ? 'bg-gradient-to-r from-emerald-400 to-green-500'
                              : 'bg-slate-300'
                          }`}
                        >
                          <div
                            className={`absolute top-1.5 w-6 h-6 bg-white rounded-full shadow-md transition-all ${
                              availability.isActive ? 'left-8' : 'left-1.5'
                            }`}
                          />
                        </button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 bg-white/80 backdrop-blur-sm px-6 py-4 flex items-center justify-between">
          <div className="text-sm text-slate-500">
            {hasChanges && (
              <span className="flex items-center gap-2 text-amber-600">
                <AlertCircle className="w-4 h-4" />
                You have unsaved changes
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={handleReset}
              disabled={!hasChanges || saving}
              title="Reset changes to last saved state"
              className="border-slate-300"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Reset
            </Button>
            <Button
              onClick={handleSave}
              disabled={!hasChanges || saving}
              title="Save your availability settings"
              className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-lg shadow-indigo-200"
            >
              {saving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
