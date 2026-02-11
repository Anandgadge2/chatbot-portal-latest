import { apiClient } from './client';

export interface TimeSlot {
  enabled: boolean;
  startTime: string;
  endTime: string;
}

export interface DayAvailability {
  isAvailable: boolean;
  morning: TimeSlot;
  afternoon: TimeSlot;
  evening: TimeSlot;
}

export interface WeeklySchedule {
  sunday: DayAvailability;
  monday: DayAvailability;
  tuesday: DayAvailability;
  wednesday: DayAvailability;
  thursday: DayAvailability;
  friday: DayAvailability;
  saturday: DayAvailability;
}

export interface SpecialDate {
  date: string;
  type: 'holiday' | 'custom';
  name?: string;
  isAvailable: boolean;
  morning?: TimeSlot;
  afternoon?: TimeSlot;
  evening?: TimeSlot;
}

export interface AppointmentAvailability {
  _id: string;
  companyId: string;
  departmentId?: string;
  weeklySchedule: WeeklySchedule;
  specialDates: SpecialDate[];
  slotDurationMinutes: number;
  bufferMinutes: number;
  maxAdvanceBookingDays: number;
  minAdvanceBookingHours: number;
  defaultMorningStart: string;
  defaultMorningEnd: string;
  defaultAfternoonStart: string;
  defaultAfternoonEnd: string;
  defaultEveningStart: string;
  defaultEveningEnd: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Holiday {
  date: string;
  name: string;
  type: string;
}

export const availabilityAPI = {
  // Get availability settings
  get: async (departmentId?: string) => {
    const params = departmentId ? `?departmentId=${departmentId}` : '';
    return apiClient.get<{ availability: AppointmentAvailability }>(`/availability${params}`);
  },

  // Update availability settings
  update: async (data: Partial<AppointmentAvailability> & { departmentId?: string }) => {
    return apiClient.put<{ availability: AppointmentAvailability }>('/availability', data);
  },

  // Add special date (holiday or custom)
  addSpecialDate: async (specialDate: SpecialDate, departmentId?: string) => {
    return apiClient.post<{ availability: AppointmentAvailability }>('/availability/special-date', {
      specialDate,
      departmentId
    });
  },

  // Remove special date
  removeSpecialDate: async (date: string, departmentId?: string) => {
    return apiClient.delete<{ availability: AppointmentAvailability }>('/availability/special-date', {
      date,
      departmentId
    });
  },

  // Get holidays for a year
  getHolidays: async (year: number) => {
    return apiClient.get<{ holidays: Holiday[]; year: number }>(`/availability/holidays/${year}`);
  },

  // Get available dates for a month (public)
  getAvailableDates: async (companyId: string, month: number, year: number, departmentId?: string) => {
    const params = new URLSearchParams({
      month: month.toString(),
      year: year.toString(),
      ...(departmentId && { departmentId })
    });
    return apiClient.get<{ availableDates: { date: string; slots: string[] }[] }>(
      `/availability/available-dates/${companyId}?${params}`
    );
  }
};
