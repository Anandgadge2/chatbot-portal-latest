'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { departmentAPI, Department } from '@/lib/api/department';
import { companyAPI, Company } from '@/lib/api/company';
import { useAuth } from '@/contexts/AuthContext';
import { Building, Shield, Languages } from 'lucide-react';
import toast from 'react-hot-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';

interface CreateDepartmentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onDepartmentCreated: () => void;
  editingDepartment?: Department | null;
}

const CreateDepartmentDialog: React.FC<CreateDepartmentDialogProps> = ({ isOpen, onClose, onDepartmentCreated, editingDepartment }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [allDepartments, setAllDepartments] = useState<Department[]>([]);
  const [formData, setFormData] = useState({
    name: '',
    nameHi: '',
    nameOr: '',
    nameMr: '',
    description: '',
    descriptionHi: '',
    descriptionOr: '',
    descriptionMr: '',
    companyId: '',
    parentDepartmentId: ''
  });

  useEffect(() => {
    if (isOpen) {
      fetchCompanies();
      if (editingDepartment) {
        setFormData({
          name: editingDepartment.name || '',
          nameHi: editingDepartment.nameHi || '',
          nameOr: editingDepartment.nameOr || '',
          nameMr: editingDepartment.nameMr || '',
          description: editingDepartment.description || '',
          descriptionHi: editingDepartment.descriptionHi || '',
          descriptionOr: editingDepartment.descriptionOr || '',
          descriptionMr: editingDepartment.descriptionMr || '',
          companyId: (editingDepartment.companyId && typeof editingDepartment.companyId === 'object') 
            ? (editingDepartment.companyId as any)._id 
            : (editingDepartment.companyId as string) || '',
          parentDepartmentId: (editingDepartment.parentDepartmentId && typeof editingDepartment.parentDepartmentId === 'object')
            ? (editingDepartment.parentDepartmentId as any)._id
            : (editingDepartment.parentDepartmentId as string) || ''
        });
      } else {
        const userCompanyId = user?.companyId 
          ? (typeof user.companyId === 'object' ? user.companyId._id : user.companyId)
          : '';
        
        setFormData({
          name: '',
          nameHi: '',
          nameOr: '',
          nameMr: '',
          description: '',
          descriptionHi: '',
          descriptionOr: '',
          descriptionMr: '',
          companyId: userCompanyId,
          parentDepartmentId: ''
        });
      }
    }
  }, [isOpen, editingDepartment, user]);

  const fetchDepartments = useCallback(async () => {
    try {
      const response = await departmentAPI.getAll({ 
        companyId: formData.companyId,
        limit: 100 
      });
      if (response.success) {
        setAllDepartments(response.data.departments);
      }
    } catch (error) {
      console.error('Failed to fetch departments:', error);
    }
  }, [formData.companyId]);

  const fetchCompanies = async () => {
    try {
      const response = await companyAPI.getAll();
      if (response.success) {
        setCompanies(response.data.companies);
      }
    } catch (error) {
      console.error('Failed to fetch companies:', error);
    }
  };

  useEffect(() => {
    if (isOpen && formData.companyId) {
      fetchDepartments();
    }
  }, [isOpen, formData.companyId, fetchDepartments]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name?.trim()) {
      toast.error('Please enter department name');
      return;
    }
    if (!formData.companyId) {
      toast.error('Please select a company');
      return;
    }

    setLoading(true);
    try {
      let response;
      const dataToSubmit = {
        ...formData,
        parentDepartmentId: formData.parentDepartmentId || undefined
      };

      if (editingDepartment) {
        response = await departmentAPI.update(editingDepartment._id, dataToSubmit);
        if (response.success) {
          toast.success('Department updated successfully!');
        } else {
          toast.error('Failed to update department');
        }
      } else {
        response = await departmentAPI.create(dataToSubmit);
        if (response.success) {
          toast.success('Department created successfully!');
        } else {
          toast.error('Failed to create department');
        }
      }
      
      if (response.success) {
        setFormData({
          name: '',
          nameHi: '',
          nameOr: '',
          nameMr: '',
          description: '',
          descriptionHi: '',
          descriptionOr: '',
          descriptionMr: '',
          companyId: '',
          parentDepartmentId: ''
        });
        onClose();
        onDepartmentCreated();
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.response?.data?.error || error.message || 
        (editingDepartment ? 'Failed to update department' : 'Failed to create department');
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-lg max-h-[90vh] flex flex-col bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden">
        <CardHeader className="bg-slate-900 px-6 py-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center backdrop-blur-md border border-white/20 shadow-inner">
               <Shield className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <CardTitle className="text-base font-bold text-white uppercase tracking-tight">{editingDepartment ? 'Modify Department Node' : 'Initialize New Department'}</CardTitle>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Global Infrastructure Registry</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="companyId">Company *</Label>
                {user?.role === 'COMPANY_ADMIN' && !editingDepartment ? (
                  <>
                    <Input
                      id="companyId"
                      type="text"
                      value={companies.find(c => c._id === formData.companyId)?.name || 'Loading...'}
                      disabled
                      className="bg-gray-50 text-xs font-bold"
                    />
                    <input type="hidden" name="companyId" value={formData.companyId} />
                  </>
                ) : (
                  <select
                    id="companyId"
                    name="companyId"
                    value={formData.companyId}
                    onChange={(e) => setFormData(prev => ({ ...prev, companyId: e.target.value, parentDepartmentId: '' }))}
                    className="w-full h-10 px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
                    required
                  >
                    <option value="">Select a company</option>
                    {companies.map((company) => (
                      <option key={company._id} value={company._id}>
                        {company.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {formData.companyId && (() => {
                const selectedCompany = companies.find(c => c._id === formData.companyId);
                const hierarchicalEnabled = selectedCompany?.enabledModules?.includes('HIERARCHICAL_DEPARTMENTS');
                
                return hierarchicalEnabled ? (
                  <div>
                    <Label htmlFor="parentDepartmentId">Parent Department</Label>
                    <select
                      id="parentDepartmentId"
                      name="parentDepartmentId"
                      value={formData.parentDepartmentId}
                      onChange={handleChange}
                      className="w-full h-10 px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
                    >
                      <option value="">Top-level Department</option>
                      {allDepartments
                        .filter(d => !editingDepartment || d._id !== editingDepartment._id)
                        .filter(d => !d.parentDepartmentId)
                        .map((dept) => (
                          <option key={dept._id} value={dept._id}>
                            {dept.name}
                          </option>
                        ))}
                    </select>
                    <p className="text-[9px] text-slate-500 mt-1 font-bold uppercase tracking-tighter">Hierarchy Level: Sub-Dept</p>
                  </div>
                ) : (
                  <div className="flex items-center h-full pt-6">
                    <p className="text-[10px] text-slate-400 font-bold uppercase italic">Standard flat structure enabled</p>
                  </div>
                );
              })()}
            </div>

            <div className="pt-4 space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <Languages className="w-4 h-4 text-indigo-500" />
                <span className="text-xs font-black text-slate-800 uppercase tracking-widest">Localized Metadata</span>
              </div>
              
              <Tabs defaultValue="en" className="w-full">
                <TabsList className="grid w-full grid-cols-4 h-10 bg-slate-100 p-1 rounded-xl">
                  {['en', 'hi', 'or', 'mr'].map((l) => (
                    <TabsTrigger 
                      key={l} 
                      value={l}
                      className="rounded-lg text-[10px] font-black uppercase tracking-wider data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-sm"
                    >
                      {l === 'en' ? 'English' : l === 'hi' ? 'Hindi' : l === 'or' ? 'Odia' : 'Marathi'}
                    </TabsTrigger>
                  ))}
                </TabsList>

                {/* English Content */}
                <TabsContent value="en" className="space-y-4 mt-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="space-y-2">
                    <Label htmlFor="name" className="text-[10px] font-black uppercase tracking-widest text-slate-500">Primary Name (Required)</Label>
                    <Input
                      id="name"
                      name="name"
                      type="text"
                      value={formData.name}
                      onChange={handleChange}
                      required
                      placeholder="e.g. Revenue Department"
                      className="border-slate-200 focus:border-indigo-500"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description" className="text-[10px] font-black uppercase tracking-widest text-slate-500">Service Description</Label>
                    <Textarea
                      id="description"
                      name="description"
                      value={formData.description}
                      onChange={handleChange}
                      rows={3}
                      placeholder="Explain the purpose of this department..."
                      className="border-slate-200 focus:border-indigo-500 min-h-[80px]"
                    />
                  </div>
                </TabsContent>

                {/* Hindi Content */}
                <TabsContent value="hi" className="space-y-4 mt-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="space-y-2">
                    <Label htmlFor="nameHi" className="text-[10px] font-black uppercase tracking-widest text-slate-500">हिंदी नाम (Hindi Name)</Label>
                    <Input
                      id="nameHi"
                      name="nameHi"
                      type="text"
                      value={formData.nameHi}
                      onChange={handleChange}
                      placeholder="e.g. राजस्व विभाग"
                      className="border-slate-200 focus:border-indigo-500"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="descriptionHi" className="text-[10px] font-black uppercase tracking-widest text-slate-500">हिंदी विवरण (Hindi Description)</Label>
                    <Textarea
                      id="descriptionHi"
                      name="descriptionHi"
                      value={formData.descriptionHi}
                      onChange={handleChange}
                      rows={3}
                      placeholder="विभाग का विवरण हिंदी में..."
                      className="border-slate-200 focus:border-indigo-500 min-h-[80px]"
                    />
                  </div>
                </TabsContent>

                {/* Odia Content */}
                <TabsContent value="or" className="space-y-4 mt-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="space-y-2">
                    <Label htmlFor="nameOr" className="text-[10px] font-black uppercase tracking-widest text-slate-500">ଓଡ଼ିଆ ନାମ (Odia Name)</Label>
                    <Input
                      id="nameOr"
                      name="nameOr"
                      type="text"
                      value={formData.nameOr}
                      onChange={handleChange}
                      placeholder="e.g. ଆଦାୟ ବିଭାଗ"
                      className="border-slate-200 focus:border-indigo-500"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="descriptionOr" className="text-[10px] font-black uppercase tracking-widest text-slate-500">ଓଡ଼ିଆ ବିବରଣୀ (Odia Description)</Label>
                    <Textarea
                      id="descriptionOr"
                      name="descriptionOr"
                      value={formData.descriptionOr}
                      onChange={handleChange}
                      rows={3}
                      placeholder="ବିଭାଗର ବିବରଣୀ ଓଡ଼ିଆରେ..."
                      className="border-slate-200 focus:border-indigo-500 min-h-[80px]"
                    />
                  </div>
                </TabsContent>

                {/* Marathi Content */}
                <TabsContent value="mr" className="space-y-4 mt-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="space-y-2">
                    <Label htmlFor="nameMr" className="text-[10px] font-black uppercase tracking-widest text-slate-500">मराठी नाव (Marathi Name)</Label>
                    <Input
                      id="nameMr"
                      name="nameMr"
                      type="text"
                      value={formData.nameMr}
                      onChange={handleChange}
                      placeholder="e.g. राजस्व विभाग"
                      className="border-slate-200 focus:border-indigo-500"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="descriptionMr" className="text-[10px] font-black uppercase tracking-widest text-slate-500">मराठी विवरण (Marathi Description)</Label>
                    <Textarea
                      id="descriptionMr"
                      name="descriptionMr"
                      value={formData.descriptionMr}
                      onChange={handleChange}
                      rows={3}
                      placeholder="विभागाचे वर्णन मराठीत..."
                      className="border-slate-200 focus:border-indigo-500 min-h-[80px]"
                    />
                  </div>
                </TabsContent>
              </Tabs>
            </div>



            <div className="flex justify-end space-x-3 pt-6 border-t border-slate-200">
              <Button 
                type="button" 
                variant="outline" 
                onClick={onClose}
                className="px-6 border-slate-300 hover:bg-slate-100"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={loading}
                className="px-6 bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-700 hover:to-fuchsia-700 text-white shadow-lg shadow-purple-500/25"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                    </svg>
                    {editingDepartment ? 'Updating...' : 'Creating...'}
                  </span>
                ) : (editingDepartment ? 'Update Department' : 'Create Department')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default CreateDepartmentDialog;
