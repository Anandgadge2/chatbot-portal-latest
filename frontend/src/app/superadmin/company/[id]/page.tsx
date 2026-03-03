'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { companyAPI, Company } from '@/lib/api/company';
import { departmentAPI, Department } from '@/lib/api/department';
import { userAPI, User } from '@/lib/api/user';
import { apiClient } from '@/lib/api/client';
import { grievanceAPI, Grievance } from '@/lib/api/grievance';
import { appointmentAPI, Appointment } from '@/lib/api/appointment';
import GrievanceDetailDialog from '@/components/grievance/GrievanceDetailDialog';
import AppointmentDetailDialog from '@/components/appointment/AppointmentDetailDialog';
import UserDetailsDialog from '@/components/user/UserDetailsDialog';
import StatusUpdateModal from '@/components/grievance/StatusUpdateModal';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import toast from 'react-hot-toast';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Building, Users, FileText, Calendar, ArrowLeft, BarChart2, Search, Filter, ArrowUpDown, Download, RefreshCw, CheckCircle, Clock, TrendingUp, Trash2, MessageSquare, Mail, Settings, Workflow, UserPlus, Upload, FileSpreadsheet, Plus, Table, AlertCircle, Info, ChevronRight, Menu, X } from 'lucide-react';
import { Module } from '@/lib/permissions';
import * as XLSX from 'xlsx';

// Separate Modal Component for Import
interface BulkImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  companyId: string;
  onSuccess: () => void;
}

function BulkImportModal({ isOpen, onClose, companyId, onSuccess }: BulkImportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [totalRows, setTotalRows] = useState(0);
  const [currentRow, setCurrentRow] = useState(0);

  if (!isOpen) return null;

  const downloadTemplate = () => {
    const templateData = [
      {
        'Main Department': 'Finance',
        'Sub Department': 'Accounts Receivable',
        'Admin First Name': 'John',
        'Admin Last Name': 'Doe',
        'Admin Email': 'john.doe@example.com',
        'Admin WhatsApp': '911234567890'
      },
      {
        'Main Department': 'Operations',
        'Sub Department': '',
        'Admin First Name': 'Jane',
        'Admin Last Name': 'Smith',
        'Admin Email': 'jane.smith@example.com',
        'Admin WhatsApp': '910987654321'
      }
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Import Template');
    XLSX.writeFile(wb, 'department_import_template.xlsx');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleImport = async () => {
    if (!file) {
      toast.error('Please select a file first');
      return;
    }

    setImporting(true);
    setProgress(0);

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        if (jsonData.length === 0) {
          toast.error('Excel file is empty');
          setImporting(false);
          return;
        }

        setTotalRows(jsonData.length);
        let successCount = 0;
        let failCount = 0;

        for (let i = 0; i < jsonData.length; i++) {
          setCurrentRow(i + 1);
          const row: any = jsonData[i];
          const mainDeptName = row['Main Department'];
          const subDeptName = row['Sub Department'];
          const firstName = row['Admin First Name'];
          const lastName = row['Admin Last Name'];
          const email = row['Admin Email'];
          const phone = row['Admin WhatsApp'];
          const password = '111111';

          if (!mainDeptName || !firstName || !email) {
            failCount++;
            continue;
          }

          try {
            // 1. Create/Find Main Department
            // First check if it exists in locally fetched departments (would need sync)
            // For robustness, we search by name in this company
            const deptSearch = await departmentAPI.getAll({ companyId, search: mainDeptName });
            let mainDeptId = '';
            
            const existingMain = deptSearch.data.departments.find(d => 
              d.name.toLowerCase() === mainDeptName.toLowerCase() && !d.parentDepartmentId
            );

            if (existingMain) {
              mainDeptId = existingMain._id;
            } else {
              const newMain = await departmentAPI.create({
                name: mainDeptName,
                companyId: companyId
              });
              mainDeptId = newMain.data.department._id;
            }

            // 2. Handle Sub Department
            let finalDeptId = mainDeptId;
            if (subDeptName && subDeptName.trim()) {
              const subDeptSearch = await departmentAPI.getAll({ companyId, search: subDeptName });
              const existingSub = subDeptSearch.data.departments.find(d => 
                d.name.toLowerCase() === subDeptName.toLowerCase() && 
                ((typeof d.parentDepartmentId === 'string' ? d.parentDepartmentId : (d.parentDepartmentId as any)?._id) === mainDeptId)
              );

              if (existingSub) {
                finalDeptId = existingSub._id;
              } else {
                const newSub = await departmentAPI.create({
                  name: subDeptName,
                  companyId: companyId,
                  parentDepartmentId: mainDeptId
                });
                finalDeptId = newSub.data.department._id;
              }
            }

            // 3. Create Department Admin
            await userAPI.create({
              firstName,
              lastName,
              email,
              password,
              phone: phone?.toString(),
              role: 'DEPARTMENT_ADMIN',
              companyId,
              departmentId: finalDeptId
            });

            successCount++;
          } catch (err) {
            console.error(`Row ${i + 1} failed:`, err);
            failCount++;
          }

          setProgress(Math.round(((i + 1) / jsonData.length) * 100));
        }

        toast.success(`Import complete! ${successCount} successful, ${failCount} failed.`);
        setImporting(false);
        onSuccess();
        onClose();
      };
      reader.readAsArrayBuffer(file);
    } catch (error) {
      toast.error('Failed to parse Excel file');
      setImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200">
        <div className="bg-slate-900 px-6 py-5 border-b border-slate-800 relative">
          <div className="absolute inset-0 opacity-[0.05]" style={{ backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)', backgroundSize: '24px 24px' }}></div>
          <div className="relative flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-500/20 rounded-xl flex items-center justify-center border border-indigo-500/30">
              <Upload className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white uppercase tracking-tight">Bulk Import Departments</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Onboarding System</p>
            </div>
          </div>
          <button onClick={onClose} className="absolute right-6 top-6 text-slate-400 hover:text-white"><AlertCircle className="w-5 h-5 rotate-45" /></button>
        </div>

        <div className="p-6 space-y-6">
          {!importing ? (
            <>
              <div className="bg-slate-50 border border-dashed border-slate-300 rounded-xl p-8 flex flex-col items-center justify-center text-center group hover:border-indigo-400 transition-colors">
                <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm mb-4 group-hover:scale-110 transition-transform">
                  <FileSpreadsheet className="w-6 h-6 text-slate-400 group-hover:text-indigo-500" />
                </div>
                <p className="text-sm font-bold text-slate-700 mb-1">{file ? file.name : 'Select Excel File'}</p>
                <p className="text-xs text-slate-400 mb-4">Supported formats: .xlsx, .xls</p>
                <input type="file" accept=".xlsx,.xls" onChange={handleFileChange} className="hidden" id="excel-upload" />
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
                  <p className="text-xs font-bold text-indigo-900 uppercase">Pro Tip</p>
                  <p className="text-xs text-indigo-700 leading-relaxed">
                    Download our sample template to ensure your headers match. The system will automatically link admins to their departments.
                  </p>
                  <button onClick={downloadTemplate} className="text-xs font-black text-indigo-600 hover:underline flex items-center gap-1 mt-2 uppercase tracking-tighter">
                    <Download className="w-3 h-3" />
                    Download Sample Template
                  </button>
                </div>
              </div>

              <div className="flex gap-3">
                <Button variant="ghost" className="flex-1 uppercase text-xs font-bold" onClick={onClose}>Cancel</Button>
                <Button className="flex-1 bg-slate-900 hover:bg-slate-800 text-white uppercase text-xs font-bold" onClick={handleImport} disabled={!file}>
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
                <h4 className="text-base font-bold text-slate-900">Importing Data...</h4>
                <p className="text-xs text-slate-500 mt-1">Processing row {currentRow} of {totalRows}</p>
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

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

export default function CompanyDrillDown() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const companyId = params.id as string;

  const [company, setCompany] = useState<Company | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [grievances, setGrievances] = useState<Grievance[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalDepartments: 0,
    totalGrievances: 0,
    totalAppointments: 0,
    activeUsers: 0,
    pendingGrievances: 0,
    resolvedGrievances: 0
  });
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingLeads, setLoadingLeads] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedGrievance, setSelectedGrievance] = useState<Grievance | null>(null);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [showGrievanceDetail, setShowGrievanceDetail] = useState(false);
  const [showAppointmentDetail, setShowAppointmentDetail] = useState(false);
  const [selectedUserForDetails, setSelectedUserForDetails] = useState<User | null>(null);
  const [showUserDetailsDialog, setShowUserDetailsDialog] = useState(false);
  const [showGrievanceStatusModal, setShowGrievanceStatusModal] = useState(false);
  const [selectedGrievanceForStatus, setSelectedGrievanceForStatus] = useState<Grievance | null>(null);
  const [whatsappConfig, setWhatsappConfig] = useState<any>(null);
  
  // Selection state for bulk delete (Super Admin only)
  const [selectedGrievances, setSelectedGrievances] = useState<Set<string>>(new Set());
  const [selectedAppointments, setSelectedAppointments] = useState<Set<string>>(new Set());
  const [selectedDepartments, setSelectedDepartments] = useState<Set<string>>(new Set());
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  // Filter & Sort states
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' | null }>({ key: '', direction: null });

  useEffect(() => {
    if (user?.role !== 'SUPER_ADMIN') {
      router.push('/superadmin/dashboard');
      return;
    }
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, user]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch company
      const companyRes = await companyAPI.getById(companyId);
      if (companyRes.success) {
        setCompany(companyRes.data.company);
      }

      // Fetch departments for this company
      const deptRes = await departmentAPI.getAll({ companyId });
      if (deptRes.success) {
        setDepartments(deptRes.data.departments || []);
      }

      // Fetch users for this company
      const usersRes = await userAPI.getAll({ companyId });
      if (usersRes.success) {
        setUsers(usersRes.data.users || []);
      }

      // Fetch leads if module enabled
      if (companyRes.data.company.enabledModules?.includes(Module.LEAD_CAPTURE)) {
        await fetchLeads(companyId);
      }

      // Fetch grievances
      const grievancesRes = await grievanceAPI.getAll({ companyId, limit: 100 });
      if (grievancesRes.success) {
        setGrievances(grievancesRes.data.grievances || []);
      }

      // Fetch appointments
      const appointmentsRes = await appointmentAPI.getAll({ companyId, limit: 100 });
      if (appointmentsRes.success) {
        setAppointments(appointmentsRes.data.appointments || []);
      }

      // Fetch WhatsApp config
      try {
        const configRes = await apiClient.get(`/whatsapp-config/company/${companyId}`);
        if (configRes.success && configRes.data) {
          setWhatsappConfig(configRes.data);
        } else if (configRes.data) {
          setWhatsappConfig(configRes.data);
        }
      } catch (configError: any) {
        if (configError.response?.status !== 404) {
          console.error('Failed to load WhatsApp config:', configError);
        }
      }

      // Calculate stats
      setStats({
        totalUsers: usersRes.success ? (usersRes.data.users?.length || 0) : 0,
        totalDepartments: deptRes.success ? (deptRes.data.departments?.length || 0) : 0,
        totalGrievances: grievancesRes.success ? (grievancesRes.data.grievances?.length || 0) : 0,
        totalAppointments: appointmentsRes.success ? (appointmentsRes.data.appointments?.length || 0) : 0,
        activeUsers: usersRes.success ? (usersRes.data.users?.filter((u: User) => u.isActive).length || 0) : 0,
        pendingGrievances: grievancesRes.success ? (grievancesRes.data.grievances?.filter((g: Grievance) => g.status === 'PENDING').length || 0) : 0,
        resolvedGrievances: grievancesRes.success ? (grievancesRes.data.grievances?.filter((g: Grievance) => g.status === 'RESOLVED').length || 0) : 0
      });
    } catch (error: any) {
      toast.error('Failed to load company data');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchLeads = async (companyId: string) => {
    setLoadingLeads(true);
    try {
      const response = await apiClient.get(`/leads/company/${companyId}`);
      if (response.success) {
        setLeads(response.data || []);
      }
    } catch (error: any) {
      console.error('Failed to fetch leads:', error);
    } finally {
      setLoadingLeads(false);
    }
  };

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' | null = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    } else if (sortConfig.key === key && sortConfig.direction === 'desc') {
      direction = null;
    }
    setSortConfig({ key, direction });
  };

  const filteredUsers = useMemo(() => {
    let filtered = [...users];
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(u => 
        u.firstName?.toLowerCase().includes(search) ||
        u.lastName?.toLowerCase().includes(search) ||
        u.email?.toLowerCase().includes(search) ||
        u.userId?.toLowerCase().includes(search)
      );
    }
    if (roleFilter !== 'all') filtered = filtered.filter(u => u.role === roleFilter);
    if (statusFilter !== 'all') filtered = filtered.filter(u => statusFilter === 'active' ? u.isActive : !u.isActive);
    if (sortConfig.key && sortConfig.direction) {
      filtered.sort((a: any, b: any) => {
        const aVal = a[sortConfig.key] || '';
        const bVal = b[sortConfig.key] || '';
        if (typeof aVal === 'string') {
          return sortConfig.direction === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
        }
        return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
      });
    }
    return filtered;
  }, [users, searchTerm, roleFilter, statusFilter, sortConfig]);

  const filteredGrievances = useMemo(() => {
    let filtered = [...grievances];
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(g => 
        g.citizenName?.toLowerCase().includes(search) ||
        g.grievanceId?.toLowerCase().includes(search) ||
        g.citizenPhone?.includes(search)
      );
    }
    if (statusFilter !== 'all') filtered = filtered.filter(g => g.status === statusFilter);
    return filtered;
  }, [grievances, searchTerm, statusFilter]);

  const filteredAppointments = useMemo(() => {
    let filtered = [...appointments];
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(a => 
        a.citizenName?.toLowerCase().includes(search) ||
        a.appointmentId?.toLowerCase().includes(search) ||
        a.citizenPhone?.includes(search)
      );
    }
    if (statusFilter !== 'all') filtered = filtered.filter(a => a.status === statusFilter);
    return filtered;
  }, [appointments, searchTerm, statusFilter]);

  const handleBulkDeleteGrievances = async () => {
    if (selectedGrievances.size === 0) return;
    if (!confirm(`Are you sure you want to delete ${selectedGrievances.size} grievance(s)?`)) return;
    setIsDeleting(true);
    try {
      const response = await grievanceAPI.deleteBulk(Array.from(selectedGrievances));
      if (response.success) {
        toast.success(response.message);
        setSelectedGrievances(new Set());
        fetchData();
      }
    } catch (error: any) {
      toast.error('Failed to delete grievances');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleBulkDeleteAppointments = async () => {
    if (selectedAppointments.size === 0) return;
    if (!confirm(`Are you sure you want to delete ${selectedAppointments.size} appointment(s)?`)) return;
    setIsDeleting(true);
    try {
      const response = await appointmentAPI.deleteBulk(Array.from(selectedAppointments));
      if (response.success) {
        toast.success(response.message);
        setSelectedAppointments(new Set());
        fetchData();
      }
    } catch (error: any) {
      toast.error('Failed to delete appointments');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleBulkDeleteDepartments = async () => {
    if (selectedDepartments.size === 0) return;
    if (!confirm(`Are you sure you want to delete ${selectedDepartments.size} department(s)?`)) return;
    setIsDeleting(true);
    try {
      for (const deptId of selectedDepartments) {
        await departmentAPI.delete(deptId);
      }
      toast.success('Deleted successfully');
      setSelectedDepartments(new Set());
      fetchData();
    } catch (error: any) {
      toast.error('Failed to delete departments');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleBulkDeleteUsers = async () => {
    if (selectedUsers.size === 0) return;
    if (!confirm(`Are you sure you want to delete ${selectedUsers.size} user(s)?`)) return;
    setIsDeleting(true);
    try {
      for (const userId of selectedUsers) {
        await userAPI.delete(userId);
      }
      toast.success('Deleted successfully');
      setSelectedUsers(new Set());
      fetchData();
    } catch (error: any) {
      toast.error('Failed to delete users');
    } finally {
      setIsDeleting(false);
    }
  };

  const exportToCSV = (data: any[], filename: string) => {
    if (data.length === 0) return;
    const headers = Object.keys(data[0]).filter(k => !k.startsWith('_'));
    const csvContent = [
      headers.join(','),
      ...data.map(row => headers.map(h => JSON.stringify(row[h] || '')).join(','))
    ].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  if (loading) return <div className="flex min-h-screen items-center justify-center bg-slate-50"><LoadingSpinner text="Loading..." /></div>;
  if (!company) return <div className="flex min-h-screen items-center justify-center text-center"><h2 className="text-2xl font-bold mb-4">Company not found</h2><Button onClick={() => router.push('/superadmin/dashboard')}>Back</Button></div>;

  const grievanceStatusData = [
    { name: 'Pending', value: stats.pendingGrievances, color: '#FFBB28' },
    { name: 'Resolved', value: stats.resolvedGrievances, color: '#00C49F' },
    { name: 'Active', value: stats.totalGrievances - stats.pendingGrievances - stats.resolvedGrievances, color: '#0088FE' }
  ].filter(item => item.value > 0);

  const userRoleData = users.reduce((acc: any[], u) => {
    const existing = acc.find(item => item.name === u.role);
    if (existing) existing.value++; else acc.push({ name: u.role, value: 1 });
    return acc;
  }, []);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-50 shadow-xl transition-all h-20">
        <div className="absolute inset-0 opacity-[0.05]" style={{ backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)', backgroundSize: '24px 24px' }}></div>
        <div className="max-w-[1600px] mx-auto px-4 lg:px-8 h-full flex items-center justify-between relative">
          <div className="flex items-center gap-3 lg:gap-6">
            <Button 
               variant="ghost" 
               onClick={() => router.push('/superadmin/dashboard')} 
               className="hidden md:flex bg-white bg-opacity-10 hover:bg-opacity-20 text-white h-11 px-4 rounded-xl border border-white border-opacity-10 transition-all group"
            >
              <ArrowLeft className="w-5 h-5 mr-2 group-hover:-translate-x-1 transition-transform" />
              <span className="text-xs font-bold uppercase tracking-tight">Dashboard</span>
            </Button>
            <div className="w-10 h-10 lg:w-11 lg:h-11 bg-white bg-opacity-10 rounded-xl flex items-center justify-center backdrop-blur-sm border border-white border-opacity-10 shadow-lg">
              <Building className="w-5 h-5 lg:w-6 lg:h-6 text-white" />
            </div>
            <div className="max-w-[150px] sm:max-w-none">
              <h1 className="text-sm lg:text-xl font-black text-white tracking-tight uppercase leading-none truncate">{company.name}</h1>
              <div className="flex items-center gap-2 mt-1 lg:mt-2">
                <span className="bg-indigo-500 bg-opacity-20 text-indigo-300 px-1.5 py-0.5 rounded text-[8px] lg:text-[9px] border border-indigo-500 border-opacity-20 font-black uppercase tracking-widest">{company.companyId}</span>
                <span className="hidden sm:inline text-[9px] lg:text-[10px] text-slate-400 font-bold uppercase tracking-widest opacity-60">• Super Admin Portal</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 lg:gap-4">
            <div className="hidden md:flex bg-white/5 p-1 rounded-2xl border border-white/10 backdrop-blur-sm">
                <Button variant="ghost" className="h-9 px-4 hover:bg-white/10 text-white rounded-xl text-[10px] font-black uppercase tracking-wider" onClick={() => router.push(`/superadmin/company/${companyId}/whatsapp-config`)}>
                  <MessageSquare className="w-3.5 h-3.5 mr-2 text-indigo-400" />
                  WhatsApp
                </Button>
                <Button variant="ghost" className="h-9 px-4 hover:bg-white/10 text-white rounded-xl text-[10px] font-black uppercase tracking-wider" onClick={() => router.push(`/superadmin/company/${companyId}/email-config`)}>
                  <Mail className="w-3.5 h-3.5 mr-2 text-blue-400" />
                  Email
                </Button>
                <Button variant="ghost" className="h-9 px-5 bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/20 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all hover:scale-105" onClick={() => router.push(`/superadmin/company/${companyId}/chatbot-flows`)}>
                  <Workflow className="w-3.5 h-3.5 mr-2" />
                  Flows
                </Button>
            </div>
            <div className="hidden md:block h-11 w-px bg-slate-700/50 mx-2"></div>
            <Button variant="ghost" onClick={fetchData} className="hidden sm:flex h-11 w-11 p-0 text-slate-400 hover:text-white rounded-xl hover:bg-white/10 border border-transparent hover:border-white/10 items-center justify-center">
              <RefreshCw className="w-5 h-5" />
            </Button>
            <button 
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2 text-white bg-white/10 rounded-lg"
            >
              {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu Overlay for Company Portal */}
        {isMobileMenuOpen && (
          <div className="md:hidden absolute top-20 left-0 w-full bg-slate-900 border-b border-slate-800 z-50 animate-in slide-in-from-top-4 duration-300 shadow-2xl">
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <Button 
                  variant="ghost" 
                  className="w-full h-12 bg-white/5 hover:bg-white/10 text-white rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center justify-center" 
                  onClick={() => router.push(`/superadmin/company/${companyId}/whatsapp-config`)}
                >
                  <MessageSquare className="w-4 h-4 mr-2 text-indigo-400" />
                  WhatsApp
                </Button>
                <Button 
                  variant="ghost" 
                  className="w-full h-12 bg-white/5 hover:bg-white/10 text-white rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center justify-center" 
                  onClick={() => router.push(`/superadmin/company/${companyId}/email-config`)}
                >
                  <Mail className="w-4 h-4 mr-2 text-blue-400" />
                  Email
                </Button>
              </div>
              <Button 
                variant="ghost" 
                className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[11px] font-black uppercase tracking-wider flex items-center justify-center shadow-lg shadow-indigo-600/20" 
                onClick={() => router.push(`/superadmin/company/${companyId}/chatbot-flows`)}
              >
                <Workflow className="w-4 h-4 mr-2" />
                Flow Management
              </Button>
              <div className="pt-3 border-t border-slate-800 flex items-center gap-2">
                <Button 
                  variant="ghost" 
                  onClick={() => router.push('/superadmin/dashboard')} 
                  className="flex-1 bg-white/5 hover:bg-white/10 text-white h-12 rounded-xl border border-white/10 text-[10px] font-black uppercase tracking-widest"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Dashboard
                </Button>
                <Button 
                  variant="ghost" 
                  onClick={() => { fetchData(); setIsMobileMenuOpen(false); }} 
                  className="w-12 h-12 bg-white/5 text-slate-400 rounded-xl flex items-center justify-center"
                >
                  <RefreshCw className="w-5 h-5" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </header>
      <main className="max-w-[1600px] mx-auto w-full px-4 py-8 overflow-hidden">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-slate-100 p-1 lg:p-1.5 rounded-2xl h-auto gap-1 lg:gap-1.5 border border-slate-200/60 shadow-inner w-full flex overflow-x-auto no-scrollbar justify-start sm:justify-center">
            <TabsTrigger value="overview" className="px-6 py-2.5 data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-md rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-slate-700 transition-all">Overview</TabsTrigger>
            <TabsTrigger value="departments" className="px-6 py-2.5 data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-md rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-slate-700 transition-all">Departments</TabsTrigger>
            <TabsTrigger value="users" className="px-6 py-2.5 data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-md rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-slate-700 transition-all">Users</TabsTrigger>
            {(!company || company.enabledModules?.includes(Module.GRIEVANCE)) && (
              <TabsTrigger value="grievances" className="px-6 py-2.5 data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-md rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-slate-700 transition-all">Grievances</TabsTrigger>
            )}
            {(!company || company.enabledModules?.includes(Module.APPOINTMENT)) && (
              <TabsTrigger value="appointments" className="px-6 py-2.5 data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-md rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-slate-700 transition-all">Appointments</TabsTrigger>
            )}
            {(!company || company.enabledModules?.includes(Module.LEAD_CAPTURE)) && (
              <TabsTrigger value="leads" className="px-6 py-2.5 data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-md rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-slate-700 transition-all">Project Leads</TabsTrigger>
            )}
            <TabsTrigger value="analytics" className="px-6 py-2.5 data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-md rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-slate-700 transition-all">Analytics</TabsTrigger>
          </TabsList>
          
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card onClick={() => setActiveTab('users')} className="group cursor-pointer hover:shadow-2xl transition-all duration-300 border-slate-200 hover:border-blue-300 bg-white overflow-hidden relative">
                <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-bl-full group-hover:bg-blue-500/10 transition-colors"></div>
                <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0 relative">
                  <CardTitle className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Personnel</CardTitle>
                  <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform"><Users className="w-4 h-4 text-blue-600" /></div>
                </CardHeader>
                <CardContent className="relative">
                  <div className="text-3xl font-black text-slate-900 leading-none">{stats.totalUsers}</div>
                  <div className="flex items-center gap-2 mt-4">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    <p className="text-[10px] text-emerald-600 font-black uppercase tracking-widest">{stats.activeUsers} Active Now</p>
                  </div>
                </CardContent>
              </Card>

              <Card onClick={() => setActiveTab('departments')} className="group cursor-pointer hover:shadow-2xl transition-all duration-300 border-slate-200 hover:border-indigo-300 bg-white overflow-hidden relative">
                <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-bl-full group-hover:bg-indigo-500/10 transition-colors"></div>
                <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0 relative">
                  <CardTitle className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Units</CardTitle>
                  <div className="w-9 h-9 bg-indigo-50 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform"><Building className="w-4 h-4 text-indigo-600" /></div>
                </CardHeader>
                <CardContent className="relative">
                  <div className="text-3xl font-black text-slate-900 leading-none">{stats.totalDepartments}</div>
                  <p className="text-[10px] text-slate-400 font-bold mt-4 uppercase tracking-widest flex items-center gap-1.5">
                    <Workflow className="w-3 h-3" /> Organizational Units
                  </p>
                </CardContent>
              </Card>

              <Card onClick={() => setActiveTab('grievances')} className="group cursor-pointer hover:shadow-2xl transition-all duration-300 border-slate-200 hover:border-amber-300 bg-white overflow-hidden relative">
                <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-bl-full group-hover:bg-amber-500/10 transition-colors"></div>
                <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0 relative">
                  <CardTitle className="text-[10px] font-black uppercase tracking-widest text-slate-400">Public Issues</CardTitle>
                  <div className="w-9 h-9 bg-amber-50 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform"><FileText className="w-4 h-4 text-amber-600" /></div>
                </CardHeader>
                <CardContent className="relative">
                  <div className="text-3xl font-black text-slate-900 leading-none">{stats.totalGrievances}</div>
                  <div className="flex items-center gap-3 mt-4">
                     <div className="flex items-center gap-1 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-100">
                        <Clock className="w-3 h-3 text-amber-600" />
                        <span className="text-[9px] text-amber-600 font-black uppercase tracking-tighter">{stats.pendingGrievances} Pending</span>
                     </div>
                     <div className="flex items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
                        <CheckCircle className="w-3 h-3 text-emerald-600" />
                        <span className="text-[9px] text-emerald-600 font-black uppercase tracking-tighter">{stats.resolvedGrievances} Solved</span>
                     </div>
                  </div>
                </CardContent>
              </Card>

              <Card onClick={() => setActiveTab('appointments')} className="group cursor-pointer hover:shadow-2xl transition-all duration-300 border-slate-200 hover:border-emerald-300 bg-white overflow-hidden relative">
                <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-bl-full group-hover:bg-emerald-500/10 transition-colors"></div>
                <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0 relative">
                  <CardTitle className="text-[10px] font-black uppercase tracking-widest text-slate-400">Booked Slots</CardTitle>
                  <div className="w-9 h-9 bg-emerald-50 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform"><Calendar className="w-4 h-4 text-emerald-600" /></div>
                </CardHeader>
                <CardContent className="relative">
                  <div className="text-3xl font-black text-slate-900 leading-none">{stats.totalAppointments}</div>
                  <p className="text-[10px] text-slate-400 font-bold mt-4 uppercase tracking-widest flex items-center gap-1.5">
                    <TrendingUp className="w-3 h-3" /> Scheduled Engagement
                  </p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="departments" className="mt-0">
             <Card className="rounded-2xl border-slate-200 shadow-xl overflow-hidden bg-white">
               <CardHeader className="flex flex-row items-center justify-between border-b bg-slate-50/50 px-6 py-4">
                 <div>
                   <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-600 flex items-center gap-2">
                     <Building className="w-4 h-4 text-indigo-500" />
                     Organizational Chart
                   </CardTitle>
                 </div>
                 <div className="flex gap-2">
                   <Button 
                     variant="outline" 
                     size="sm" 
                     onClick={() => setIsImportModalOpen(true)}
                     className="bg-indigo-50 border-indigo-100 text-indigo-700 hover:bg-indigo-100 text-[10px] font-black uppercase tracking-wider"
                   >
                     <Plus className="w-3.5 h-3.5 mr-2" />
                     Import Departments
                   </Button>
                   <Button variant="outline" size="sm" onClick={() => exportToCSV(departments, 'departments')} className="text-[10px] font-black uppercase tracking-wider">
                     <Download className="w-3.5 h-3.5 mr-2" />
                     Export
                   </Button>
                 </div>
               </CardHeader>
               <CardContent className="p-0">
                 <div className="overflow-x-auto">
                   <table className="w-full text-left">
                     <thead>
                       <tr className="bg-slate-50 border-b border-slate-200 whitespace-nowrap">
                         <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Sr. No.</th>
                         <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Department Name</th>
                         <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Hierarchy</th>
                         <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Internal ID</th>
                         <th className="px-6 py-4 text-right text-[10px] font-black uppercase tracking-widest text-slate-500">Actions</th>
                       </tr>
                     </thead>
                     <tbody className="divide-y divide-slate-100">
                       {departments.map((d, idx) => (
                         <tr key={d._id} className="group hover:bg-slate-50 transition-colors">
                           <td className="px-6 py-4">
                             <span className="inline-flex items-center justify-center w-7 h-7 bg-slate-100 text-slate-600 font-black text-[10px] rounded-lg group-hover:bg-indigo-100 group-hover:text-indigo-700 transition-colors">
                               {idx + 1}
                             </span>
                           </td>
                           <td className="px-6 py-4">
                             <p className="font-black text-slate-900 group-hover:text-indigo-600 transition-colors">{d.name}</p>
                           </td>
                           <td className="px-6 py-4">
                             {d.parentDepartmentId ? (
                               <div className="flex items-center gap-1.5">
                                 <span className="px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded text-[9px] font-bold border border-slate-200 uppercase">Sub Unit</span>
                                 <ChevronRight className="w-3 h-3 text-slate-300" />
                                 <span className="text-[10px] font-bold text-slate-400 capitalize">
                                   {typeof d.parentDepartmentId === 'object' ? (d.parentDepartmentId as any).name : 'Main'}
                                 </span>
                               </div>
                             ) : (
                               <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded text-[9px] font-black border border-indigo-100 uppercase">Main Dept</span>
                             )}
                           </td>
                           <td className="px-6 py-4 font-mono text-[10px] text-slate-400 font-bold">
                             {d.departmentId}
                           </td>
                           <td className="px-6 py-4 text-right">
                             <Button 
                               variant="ghost" 
                               size="sm" 
                               onClick={() => router.push(`/superadmin/department/${d._id}`)}
                               className="text-[10px] font-black uppercase tracking-wider text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50"
                             >
                               Configuration
                               <ArrowLeft className="w-3.5 h-3.5 ml-2 rotate-180" />
                             </Button>
                           </td>
                         </tr>
                       ))}
                     </tbody>
                   </table>
                 </div>
               </CardContent>
             </Card>
          </TabsContent>

          <TabsContent value="users" className="mt-0">
             <Card className="rounded-2xl border-slate-200 shadow-xl overflow-hidden bg-white">
               <CardHeader className="flex flex-row items-center justify-between border-b bg-slate-50/50 px-6 py-4">
                 <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-600 flex items-center gap-2">
                   <Users className="w-4 h-4 text-blue-500" />
                   Team Directory
                 </CardTitle>
                 <Button variant="outline" size="sm" onClick={() => exportToCSV(users, 'users')} className="text-[10px] font-black uppercase tracking-wider">
                   <Download className="w-3.5 h-3.5 mr-2" />
                   Export
                 </Button>
               </CardHeader>
               <CardContent className="p-0">
                 <div className="overflow-x-auto">
                   <table className="w-full text-left">
                     <thead>
                       <tr className="bg-slate-50 border-b border-slate-200 whitespace-nowrap">
                         <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Sr. No.</th>
                         <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Identity</th>
                         <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Privileges</th>
                         <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Status</th>
                         <th className="px-6 py-4 text-right text-[10px] font-black uppercase tracking-widest text-slate-500">Actions</th>
                       </tr>
                     </thead>
                     <tbody className="divide-y divide-slate-100">
                       {filteredUsers.map((u, idx) => (
                         <tr key={u._id} className="group hover:bg-slate-50 transition-colors">
                           <td className="px-6 py-4">
                             <span className="inline-flex items-center justify-center w-7 h-7 bg-slate-100 text-slate-600 font-black text-[10px] rounded-lg group-hover:bg-blue-100 group-hover:text-blue-700 transition-colors">
                               {idx + 1}
                             </span>
                           </td>
                           <td className="px-6 py-4">
                             <div className="flex flex-col">
                               <p className="font-black text-slate-900 leading-none">{u.fullName || `${u.firstName} ${u.lastName}`}</p>
                               <p className="text-[10px] text-slate-400 font-bold mt-1 uppercase tracking-tighter">{u.email}</p>
                             </div>
                           </td>
                           <td className="px-6 py-4">
                             <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest border ${
                               u.role === 'SUPER_ADMIN' ? 'bg-red-50 text-red-700 border-red-100' :
                               u.role === 'COMPANY_ADMIN' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                               'bg-indigo-50 text-indigo-700 border-indigo-100'
                             }`}>
                               {u.role.replace('_', ' ')}
                             </span>
                           </td>
                           <td className="px-6 py-4">
                             <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-tighter ${
                               u.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                             }`}>
                               <span className={`w-1.5 h-1.5 rounded-full ${u.isActive ? 'bg-emerald-500 anim-pulse' : 'bg-slate-400'}`}></span>
                               {u.isActive ? 'Verified' : 'Inactive'}
                             </span>
                           </td>
                           <td className="px-6 py-4 text-right">
                             <Button variant="ghost" size="sm" onClick={() => { setSelectedUserForDetails(u); setShowUserDetailsDialog(true); }} className="text-[10px] font-black uppercase tracking-wider text-slate-400 hover:text-blue-600 hover:bg-blue-50">
                               Details
                             </Button>
                           </td>
                         </tr>
                       ))}
                     </tbody>
                   </table>
                 </div>
               </CardContent>
             </Card>
          </TabsContent>

          <TabsContent value="grievances" className="mt-0">
             <Card className="rounded-2xl border-slate-200 shadow-xl overflow-hidden bg-white">
               <CardHeader className="flex flex-row items-center justify-between border-b bg-slate-50/50 px-6 py-4">
                 <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-600 flex items-center gap-2">
                   <FileText className="w-4 h-4 text-amber-500" />
                   Grievance Registry
                 </CardTitle>
                 <Button variant="outline" size="sm" onClick={() => exportToCSV(grievances, 'grievances')} className="text-[10px] font-black uppercase tracking-wider">
                   <Download className="w-3.5 h-3.5 mr-2" />
                   Export
                 </Button>
               </CardHeader>
               <CardContent className="p-0">
                 <div className="overflow-x-auto">
                   <table className="w-full text-left">
                     <thead>
                       <tr className="bg-slate-50 border-b border-slate-200 whitespace-nowrap">
                         <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Sr. No.</th>
                         <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Incident ID</th>
                         <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Complainant</th>
                         <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Current Status</th>
                         <th className="px-6 py-4 text-right text-[10px] font-black uppercase tracking-widest text-slate-500">Actions</th>
                       </tr>
                     </thead>
                     <tbody className="divide-y divide-slate-100">
                       {filteredGrievances.map((g, idx) => (
                         <tr key={g._id} className="group hover:bg-slate-50 transition-colors">
                           <td className="px-6 py-4">
                             <span className="inline-flex items-center justify-center w-7 h-7 bg-slate-100 text-slate-600 font-black text-[10px] rounded-lg group-hover:bg-amber-100 group-hover:text-amber-700 transition-colors">
                               {idx + 1}
                             </span>
                           </td>
                           <td className="px-6 py-4 font-black text-indigo-600 text-sm">{g.grievanceId}</td>
                           <td className="px-6 py-4">
                             <div className="flex flex-col">
                               <p className="font-bold text-slate-900 leading-none">{g.citizenName}</p>
                               <p className="text-[10px] text-slate-400 font-bold mt-1 uppercase tracking-tighter">{g.citizenPhone}</p>
                             </div>
                           </td>
                           <td className="px-6 py-4">
                             <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest border ${
                               g.status === 'RESOLVED' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-amber-50 text-amber-700 border-amber-100'
                             }`}>
                               {g.status}
                             </span>
                           </td>
                           <td className="px-6 py-4 text-right">
                             <Button variant="ghost" size="sm" onClick={() => { setSelectedGrievance(g); setShowGrievanceDetail(true); }} className="text-[10px] font-black uppercase tracking-wider text-slate-400 hover:text-amber-600 hover:bg-amber-50">
                               Review Case
                             </Button>
                           </td>
                         </tr>
                       ))}
                     </tbody>
                   </table>
                 </div>
               </CardContent>
             </Card>
          </TabsContent>

          <TabsContent value="appointments" className="mt-0">
             <Card className="rounded-2xl border-slate-200 shadow-xl overflow-hidden bg-white">
               <CardHeader className="flex flex-row items-center justify-between border-b bg-slate-50/50 px-6 py-4">
                 <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-600 flex items-center gap-2">
                   <Calendar className="w-4 h-4 text-emerald-500" />
                   Appointment Calendar
                 </CardTitle>
                 <Button variant="outline" size="sm" onClick={() => exportToCSV(appointments, 'appointments')} className="text-[10px] font-black uppercase tracking-wider">
                   <Download className="w-3.5 h-3.5 mr-2" />
                   Export
                 </Button>
               </CardHeader>
               <CardContent className="p-0 overflow-x-auto">
                 <table className="w-full text-left">
                   <thead>
                     <tr className="bg-slate-50 border-b border-slate-200 whitespace-nowrap">
                       <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Sr. No.</th>
                       <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Token ID</th>
                       <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Citizen</th>
                       <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Slot Date/Time</th>
                       <th className="px-6 py-4 text-right text-[10px] font-black uppercase tracking-widest text-slate-500">Actions</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-100">
                     {filteredAppointments.map((a, idx) => (
                       <tr key={a._id} className="group hover:bg-slate-50 transition-colors">
                         <td className="px-6 py-4">
                           <span className="inline-flex items-center justify-center w-7 h-7 bg-slate-100 text-slate-600 font-black text-[10px] rounded-lg group-hover:bg-emerald-100 group-hover:text-emerald-700 transition-colors">
                             {idx + 1}
                           </span>
                         </td>
                         <td className="px-6 py-4 font-black text-purple-600 text-sm">{a.appointmentId}</td>
                         <td className="px-6 py-4">
                           <div className="flex flex-col">
                             <p className="font-bold text-slate-900 leading-none">{a.citizenName}</p>
                             <p className="text-[10px] text-slate-400 font-bold mt-1 uppercase tracking-tighter">{a.citizenPhone}</p>
                           </div>
                         </td>
                         <td className="px-6 py-4">
                           <div className="flex items-center gap-2">
                             <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center text-[10px] font-black text-slate-600">
                               {new Date(a.appointmentDate).getDate()}
                             </div>
                             <div className="flex flex-col">
                               <p className="text-[10px] font-black text-slate-900 uppercase tracking-tighter">{a.appointmentTime}</p>
                               <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">{new Date(a.appointmentDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</p>
                             </div>
                           </div>
                         </td>
                         <td className="px-6 py-4 text-right">
                            <Button variant="ghost" size="sm" onClick={() => { setSelectedAppointment(a); setShowAppointmentDetail(true); }} className="text-[10px] font-black uppercase tracking-wider text-slate-400 hover:text-emerald-600 hover:bg-emerald-50">
                              View Schedule
                            </Button>
                         </td>
                       </tr>
                     ))}
                   </tbody>
                 </table>
               </CardContent>
             </Card>
          </TabsContent>

          <TabsContent value="leads" className="mt-0">
             <Card className="rounded-2xl border-slate-200 shadow-xl overflow-hidden bg-white">
               <CardHeader className="flex flex-row items-center justify-between border-b bg-slate-50/50 px-6 py-4">
                 <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-600 flex items-center gap-2">
                   <TrendingUp className="w-4 h-4 text-blue-500" />
                   Commercial Opportunities
                 </CardTitle>
                 <Button variant="outline" size="sm" onClick={() => exportToCSV(leads, 'leads')} className="text-[10px] font-black uppercase tracking-wider">
                   <Download className="w-3.5 h-3.5 mr-2" />
                   Export
                 </Button>
               </CardHeader>
               <CardContent className="p-0 overflow-x-auto">
                 <table className="w-full text-left">
                   <thead>
                     <tr className="bg-slate-50 border-b border-slate-200 whitespace-nowrap">
                       <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Sr. No.</th>
                       <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Lead Profile</th>
                       <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Project Type</th>
                       <th className="px-6 py-4 text-right text-[10px] font-black uppercase tracking-widest text-slate-500">Lead Status</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-100">
                     {leads.map((lead, idx) => (
                       <tr key={lead._id} className="group hover:bg-slate-50 transition-colors">
                         <td className="px-6 py-4">
                           <span className="inline-flex items-center justify-center w-7 h-7 bg-slate-100 text-slate-600 font-black text-[10px] rounded-lg group-hover:bg-blue-100 group-hover:text-blue-700 transition-colors">
                             {idx + 1}
                           </span>
                         </td>
                         <td className="px-6 py-4">
                           <div className="flex flex-col">
                             <p className="font-bold text-slate-900 leading-none">{lead.name}</p>
                             <p className="text-[10px] text-slate-400 font-bold mt-1 uppercase tracking-tighter">{lead.companyName || lead.contactInfo}</p>
                           </div>
                         </td>
                         <td className="px-6 py-4">
                            <span className="inline-flex items-center px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-[10px] font-black border border-blue-100 uppercase tracking-tighter">
                               {lead.projectType}
                            </span>
                         </td>
                         <td className="px-6 py-4 text-right">
                           <span className="px-2 py-0.5 bg-slate-900 text-white rounded-md text-[9px] font-black uppercase tracking-widest shadow-md">
                             {lead.status}
                           </span>
                         </td>
                       </tr>
                     ))}
                   </tbody>
                 </table>
               </CardContent>
             </Card>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
               <Card><CardHeader><CardTitle className="text-xs font-bold uppercase">Grievance Distribution</CardTitle></CardHeader>
               <CardContent><div className="h-[250px]"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={grievanceStatusData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} dataKey="value">{grievanceStatusData.map((e, i) => <Cell key={i} fill={e.color} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer></div></CardContent></Card>
               <Card><CardHeader><CardTitle className="text-xs font-bold uppercase">User Role Allocation</CardTitle></CardHeader>
               <CardContent><div className="h-[250px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={userRoleData}><XAxis dataKey="name" fontSize={10} /><YAxis fontSize={10} /><Tooltip /><Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div></CardContent></Card>
            </div>
          </TabsContent>
        </Tabs>
      </main>

      <GrievanceDetailDialog grievance={selectedGrievance} isOpen={showGrievanceDetail} onClose={() => { setShowGrievanceDetail(false); setSelectedGrievance(null); }} />
      <AppointmentDetailDialog appointment={selectedAppointment} isOpen={showAppointmentDetail} onClose={() => { setShowAppointmentDetail(false); setSelectedAppointment(null); }} />
      <UserDetailsDialog isOpen={showUserDetailsDialog} user={selectedUserForDetails} onClose={() => { setShowUserDetailsDialog(false); setSelectedUserForDetails(null); }} />
      <StatusUpdateModal isOpen={showGrievanceStatusModal} onClose={() => { setShowGrievanceStatusModal(false); setSelectedGrievanceForStatus(null); }} itemId={selectedGrievanceForStatus?._id || ''} itemType="grievance" currentStatus={selectedGrievanceForStatus?.status || ''} onSuccess={fetchData} grievanceVariant="department-admin" />
      
      <BulkImportModal 
        isOpen={isImportModalOpen} 
        onClose={() => setIsImportModalOpen(false)} 
        companyId={companyId} 
        onSuccess={fetchData} 
      />
    </div>
  );
}
