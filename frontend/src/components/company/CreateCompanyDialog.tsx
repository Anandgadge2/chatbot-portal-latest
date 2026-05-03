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
import { Building, X, Plus } from 'lucide-react';
import { SearchableSelect } from '@/components/ui/SearchableSelect';

const LANGUAGE_OPTIONS = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'Hindi' },
  { code: 'or', label: 'Odia' },
  { code: 'mr', label: 'Marathi' },
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
    nameHi: '',
    nameOr: '',
    nameMr: '',
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
    admin: {
      firstName: '',
      lastName: '',
      email: '',
      password: '',
      phone: ''
    }
  });
  const [showAdminForm, setShowAdminForm] = useState(false);

  useEffect(() => {
    if (editingCompany) {
      setFormData({
        name: editingCompany.name,
        nameHi: editingCompany.nameHi || '',
        nameOr: editingCompany.nameOr || '',
        nameMr: editingCompany.nameMr || '',
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
        admin: {
          firstName: '',
          lastName: '',
          email: '',
          password: '',
          phone: ''
        }
      });
      setShowAdminForm(false);
    } else {
      // Reset form for creating new company
      setFormData({
        name: '',
        nameHi: '',
        nameOr: '',
        nameMr: '',
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
        admin: {
          firstName: '',
          lastName: '',
          email: '',
          password: '',
          phone: ''
        }
      });
      setShowAdminForm(false);
    }
  }, [editingCompany, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name) {
      toast.error('Please fill in company name');
      return;
    }

    if (showAdminForm && (!formData.admin?.firstName || !formData.admin?.lastName || !formData.admin?.email || !formData.admin?.password)) {
      toast.error('Please fill in all admin fields');
      return;
    }

    // Validate contact phone (telephone) if provided
    if (formData.contactPhone && !validateTelephone(formData.contactPhone)) {
      toast.error('Contact phone must be 6–15 digits (e.g. 0721-2662926 or 9356150561)');
      return;
    }

    // Validate admin phone if provided
    if (showAdminForm && formData.admin?.phone && !validatePhoneNumber(formData.admin.phone)) {
      toast.error('Admin phone number must be exactly 10 digits');
      return;
    }

    // Validate admin password if admin form is shown
    if (showAdminForm && formData.admin?.password && !validatePassword(formData.admin.password)) {
      toast.error('Admin password must be between 6 and 8 characters');
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
          window.dispatchEvent(new CustomEvent('REFRESH_PORTAL_DATA'));
        }
      } else {
        // Create new company
        response = await companyAPI.create(formData);
        if (response.success) {
          toast.success('Company created successfully!');
          window.dispatchEvent(new CustomEvent('REFRESH_PORTAL_DATA'));
        }
      }
      
      if (response.success) {
        setFormData({
          name: '',
          nameHi: '',
          nameOr: '',
          nameMr: '',
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
          admin: {
            firstName: '',
            lastName: '',
            email: '',
            password: '',
            phone: ''
          }
        });
        setShowAdminForm(false);
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

  const handleLanguageToggle = (languageCode: string) => {
    if (languageCode === 'en') return;

    setFormData((prev) => {
      const currentlySelected = prev.selectedLanguages || ['en'];
      const updated = currentlySelected.includes(languageCode)
        ? currentlySelected.filter((code) => code !== languageCode)
        : [...currentlySelected, languageCode];

      return {
        ...prev,
        selectedLanguages: Array.from(new Set(['en', ...updated])),
      };
    });
  };

  const handleAdminChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      admin: {
        ...prev.admin!,
        [name]: value
      }
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
                <p className="text-[14px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Global Infrastructure Registry</p>
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
                <SearchableSelect
                  options={[
                    { value: "GOVERNMENT", label: "Government" },
                    { value: "CUSTOM_ENTERPRISE", label: "Custom Enterprise" },
                  ]}
                  value={formData.companyType}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, companyType: value }))}
                  placeholder="Select Organization Type"
                  className="w-full bg-white"
                />
              </div>
            </div>

            {/* Language Selection - User wants this before foreign names */}
            <div>
              <Label className="text-sm font-bold text-slate-700">Supported Languages</Label>
              <div className="flex flex-wrap gap-4 mt-2 p-3 bg-slate-50 rounded-xl border border-slate-200">
                {LANGUAGE_OPTIONS.map((language) => {
                  const checked = formData.selectedLanguages?.includes(language.code) || false;
                  const isEnglish = language.code === 'en';

                  return (
                    <div key={language.code} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id={`lang-${language.code}`}
                        checked={checked}
                        onChange={() => handleLanguageToggle(language.code)}
                        disabled={isEnglish}
                        className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <Label htmlFor={`lang-${language.code}`} className="text-sm font-medium cursor-pointer">
                        {language.label}
                        {isEnglish && <span className="ml-1 text-[14px] text-slate-400">(Default)</span>}
                      </Label>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Conditional Name Fields */}
            <div className="space-y-4">
              {formData.selectedLanguages?.includes('hi') && (
                <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                  <Label htmlFor="nameHi">Company Name (Hindi)</Label>
                  <Input
                    id="nameHi"
                    name="nameHi"
                    type="text"
                    value={formData.nameHi || ''}
                    onChange={handleChange}
                    placeholder="कंपनी का नाम"
                  />
                </div>
              )}
              {formData.selectedLanguages?.includes('mr') && (
                <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                  <Label htmlFor="nameMr">Company Name (Marathi)</Label>
                  <Input
                    id="nameMr"
                    name="nameMr"
                    type="text"
                    value={formData.nameMr || ''}
                    onChange={handleChange}
                    placeholder="कंपनीचे नाव"
                  />
                </div>
              )}
              {formData.selectedLanguages?.includes('or') && (
                <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                  <Label htmlFor="nameOr">Company Name (Odia)</Label>
                  <Input
                    id="nameOr"
                    name="nameOr"
                    type="text"
                    value={formData.nameOr || ''}
                    onChange={handleChange}
                    placeholder="କମ୍ପାନି ନାମ"
                  />
                </div>
              )}
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
                    const value = e.target.value.replace(/[^\d\s\-+]/g, '');
                    setFormData(prev => ({ ...prev, contactPhone: value }));
                  }}
                  placeholder="e.g. 0721-2662926"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="address">Address</Label>
              <textarea
                id="address"
                name="address"
                value={formData.address}
                onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                rows={2}
                className="w-full p-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                placeholder="Full operational address..."
              />
            </div>

            {/* Admin Creation Section */}
            <div className="pt-2">
              <div className="flex items-center justify-between mb-2">
                <div className="flex flex-col">
                  <Label className="text-sm font-bold text-slate-700">Organization Administrator</Label>
                  <p className="text-[14px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                    Will be assigned as <span className="text-indigo-600">Company Admin</span> by default
                  </p>
                </div>
                {!showAdminForm && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAdminForm(true)}
                    className="h-8 text-[15px] font-bold uppercase tracking-wider border-blue-200 text-blue-600 hover:bg-blue-50"
                  >
                    <Plus className="w-3 h-3 mr-1.5" />
                    Add Admin
                  </Button>
                )}
              </div>
              
              {showAdminForm && (
                <div className="space-y-4 p-5 rounded-2xl bg-slate-50 border border-slate-200 shadow-inner relative animate-in zoom-in-95 duration-200">
                  <button 
                    type="button"
                    onClick={() => setShowAdminForm(false)}
                    className="absolute top-3 right-3 p-1 hover:bg-slate-200 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="adminFirstName" className="text-xs font-bold uppercase text-slate-500">First Name *</Label>
                      <Input
                        id="adminFirstName"
                        name="firstName"
                        type="text"
                        value={formData.admin?.firstName || ''}
                        onChange={handleAdminChange}
                        required={showAdminForm}
                        className="h-9 text-sm"
                        placeholder="e.g. Rajesh"
                      />
                    </div>
                    <div>
                      <Label htmlFor="adminLastName" className="text-xs font-bold uppercase text-slate-500">Last Name *</Label>
                      <Input
                        id="adminLastName"
                        name="lastName"
                        type="text"
                        value={formData.admin?.lastName || ''}
                        onChange={handleAdminChange}
                        required={showAdminForm}
                        className="h-9 text-sm"
                        placeholder="e.g. Kumar"
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="adminEmail" className="text-xs font-bold uppercase text-slate-500">Official Email *</Label>
                      <Input
                        id="adminEmail"
                        name="email"
                        type="email"
                        value={formData.admin?.email || ''}
                        onChange={handleAdminChange}
                        required={showAdminForm}
                        className="h-9 text-sm"
                        placeholder="admin@organization.gov.in"
                      />
                    </div>
                    <div>
                      <Label htmlFor="adminPassword" className="text-xs font-bold uppercase text-slate-500">Access Password *</Label>
                      <Input
                        id="adminPassword"
                        name="password"
                        type="password"
                        value={formData.admin?.password || ''}
                        onChange={handleAdminChange}
                        minLength={6}
                        maxLength={8}
                        required={showAdminForm}
                        className="h-9 text-sm"
                        placeholder="6-8 Characters"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <Label htmlFor="adminPhone" className="text-xs font-bold uppercase text-slate-500">WhatsApp / Contact Number</Label>
                    <Input
                      id="adminPhone"
                      name="phone"
                      type="tel"
                      value={formData.admin?.phone || ''}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, '').slice(0, 10);
                        setFormData(prev => ({
                          ...prev,
                          admin: { ...prev.admin!, phone: value }
                        }));
                      }}
                      maxLength={10}
                      className="h-9 text-sm"
                      placeholder="10 digit mobile number"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Modules Selection - Moved below as requested */}
            <div className="pt-2">
              <Label className="text-sm font-bold text-slate-700">Digital Modules Allocation</Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
                {AVAILABLE_MODULES.map((module) => (
                  <div 
                    key={module.id} 
                    className={`flex items-start space-x-3 p-3 border rounded-xl transition-all cursor-pointer ${
                      formData.enabledModules?.includes(module.id) 
                        ? 'bg-blue-50 border-blue-200 shadow-sm' 
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                    onClick={() => handleModuleToggle(module.id)}
                  >
                    <div className="pt-0.5">
                      <input
                        type="checkbox"
                        id={module.id}
                        checked={formData.enabledModules?.includes(module.id) || false}
                        onChange={(e) => { e.stopPropagation(); handleModuleToggle(module.id); }}
                        className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                    </div>
                    <div className="flex-1">
                      <Label htmlFor={module.id} className="text-xs font-bold text-slate-800 cursor-pointer">
                        {module.name}
                      </Label>
                      <p className="text-[14px] text-slate-500 leading-tight mt-0.5">{module.description}</p>
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
                className="px-6 bg-slate-800 hover:bg-slate-900 text-white shadow-lg shadow-slate-900/40 border-0 rounded-xl font-black uppercase text-[14px] tracking-widest transition-all ring-1 ring-blue-500/50 active:scale-95"
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
