'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { companyAPI, CreateCompanyData, Company } from '@/lib/api/company';
import toast from 'react-hot-toast';
import { validatePhoneNumber, validatePassword, validateTelephone } from '@/lib/utils/phoneUtils';
import { Module } from '@/lib/permissions';
import { AVAILABLE_MODULES } from '@/config/modules';
import { Building, X } from 'lucide-react';

const LANGUAGE_OPTIONS = [
  { code: 'en', label: 'English' },
];

interface CreateCompanyDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onCompanyCreated: () => void;
  editingCompany?: Company | null;
}

const CreateCompanyDialog: React.FC<CreateCompanyDialogProps> = ({ isOpen, onClose, onCompanyCreated, editingCompany }) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<CreateCompanyData>({
    name: '',
    companyType: 'GOVERNMENT',
    contactEmail: '',
    contactPhone: '',
    address: '',
    enabledModules: [],
    selectedLanguages: ['en'],
    theme: {
      primaryColor: '#0f4c81',
      secondaryColor: '#1a73e8'
    },
    admin: undefined
  });


  useEffect(() => {
    if (editingCompany) {
      setFormData({
        name: editingCompany.name,
        companyType: editingCompany.companyType,
        contactEmail: editingCompany.contactEmail,
        contactPhone: editingCompany.contactPhone,
        address: editingCompany.address || '',
        enabledModules: editingCompany.enabledModules || [],
        selectedLanguages: editingCompany.selectedLanguages?.length
          ? Array.from(new Set(['en', ...editingCompany.selectedLanguages]))
          : ['en'],
        theme: editingCompany.theme || {
          primaryColor: '#0f4c81',
          secondaryColor: '#1a73e8'
        },
        admin: undefined
      });
    } else {
      // Reset form for creating new company
      setFormData({
        name: '',
        companyType: 'GOVERNMENT',
        contactEmail: '',
        contactPhone: '',
        address: '',
        enabledModules: [],
        selectedLanguages: ['en'],
        theme: {
          primaryColor: '#0f4c81',
          secondaryColor: '#1a73e8'
        },
        admin: undefined
      });
    }
  }, [editingCompany, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name) {
      toast.error('Please fill in company name');
      return;
    }



    // Validate contact phone (telephone) if provided
    if (formData.contactPhone && !validateTelephone(formData.contactPhone)) {
      toast.error('Contact phone must be 6–15 digits (e.g. 0721-2662926 or 9356150561)');
      return;
    }



    setLoading(true);
    try {
      // Send phone numbers as-is (10 digits) - backend will normalize them
      let response;
      if (editingCompany) {
        // Update existing company
        response = await companyAPI.update(editingCompany._id, formData);
        if (response.success) {
          toast.success('Company updated successfully!');
        }
      } else {
        // Create new company
        response = await companyAPI.create(formData);
        if (response.success) {
          toast.success('Company created successfully!');
        }
      }
      
      if (response.success) {
        setFormData({
          name: '',
          companyType: 'GOVERNMENT',
          contactEmail: '',
          contactPhone: '',
          address: '',
          enabledModules: [],
          selectedLanguages: ['en'],
          theme: {
            primaryColor: '#0f4c81',
            secondaryColor: '#1a73e8'
          },
          admin: undefined
        });
        onClose();
        onCompanyCreated();
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.response?.data?.error || error.message || 'Failed to save company';
      console.error('Company save error:', error.response?.data);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleModuleToggle = (moduleId: string) => {
    setFormData(prev => ({
      ...prev,
      enabledModules: prev.enabledModules?.includes(moduleId)
        ? prev.enabledModules.filter(id => id !== moduleId)
        : [...(prev.enabledModules || []), moduleId]
    }));
  };





  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] flex flex-col bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden">
        <CardHeader className="bg-slate-900 px-6 py-4 border-b border-slate-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center backdrop-blur-md border border-white/20 shadow-inner">
                 <Building className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <CardTitle className="text-base font-bold text-white uppercase tracking-tight">{editingCompany ? 'Modify Organization Node' : 'Initialize New Organization'}</CardTitle>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Global Infrastructure Registry</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center transition-all duration-300 border border-white/10 group cursor-pointer"
            >
              <X className="w-5 h-5 text-slate-400 group-hover:text-white transition-colors" />
            </button>
          </div>
        </CardHeader>
        <CardContent className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">Company Name (English) *</Label>
                <Input
                  id="name"
                  name="name"
                  type="text"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  placeholder="Enter company name"
                />
              </div>
              <div>
                <Label htmlFor="companyType">Company Type *</Label>
                <select
                  id="companyType"
                  name="companyType"
                  value={formData.companyType}
                  onChange={(e) => setFormData(prev => ({ ...prev, companyType: e.target.value }))}
                  className="w-full p-2 border rounded-md"
                  required
                >
                  <option value="GOVERNMENT">Government</option>
                  <option value="CUSTOM_ENTERPRISE">Custom Enterprise</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="contactEmail">Contact Email (optional)</Label>
                <Input
                  id="contactEmail"
                  name="contactEmail"
                  type="email"
                  value={formData.contactEmail}
                  onChange={handleChange}
                  placeholder="contact@company.com"
                />
              </div>
              <div>
                <Label htmlFor="contactPhone">Contact Phone (optional)</Label>
                <Input
                  id="contactPhone"
                  name="contactPhone"
                  type="tel"
                  value={formData.contactPhone}
                  onChange={(e) => {
                    // Allow digits, spaces, hyphens, plus for telephone (landline/mobile)
                    const value = e.target.value.replace(/[^\d\s\-+]/g, '');
                    setFormData(prev => ({ ...prev, contactPhone: value }));
                  }}
                  placeholder="e.g. 0721-2662926 or 9356150561"
                />
                {formData.contactPhone && !validateTelephone(formData.contactPhone) && (
                  <p className="text-xs text-red-500 mt-1">Contact phone must be 6–15 digits</p>
                )}
              </div>
            </div>

            <div>
              <Label htmlFor="address">Address</Label>
              <textarea
                id="address"
                name="address"
                value={formData.address}
                onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                rows={3}
                className="w-full p-2 border rounded-md"
                placeholder="Company address"
              />
            </div>

            {/* Modules Selection */}
            <div>
              <Label>Enabled Modules</Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
                {AVAILABLE_MODULES.map((module) => (
                  <div key={module.id} className="flex items-start space-x-2 p-2 border rounded-md">
                    <input
                      type="checkbox"
                      id={module.id}
                      checked={formData.enabledModules?.includes(module.id) || false}
                      onChange={() => handleModuleToggle(module.id)}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <Label htmlFor={module.id} className="text-sm font-medium cursor-pointer">
                        {module.name}
                      </Label>
                      <p className="text-xs text-gray-500">{module.description}</p>
                    </div>
                  </div>
                ))}
              </div>
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
                className="px-6 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg shadow-blue-500/25"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                    </svg>
                    {editingCompany ? 'Updating...' : 'Creating...'}
                  </span>
                ) : (editingCompany ? 'Update Company' : 'Create Company')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default CreateCompanyDialog;
