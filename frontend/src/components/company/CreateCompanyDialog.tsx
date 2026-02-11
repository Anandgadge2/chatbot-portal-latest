'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { companyAPI, CreateCompanyData, Company } from '@/lib/api/company';
import toast from 'react-hot-toast';
import { validatePhoneNumber, validatePassword, validateTelephone } from '@/lib/utils/phoneUtils';

// Available modules
const AVAILABLE_MODULES = [
  { id: 'GRIEVANCE', name: 'Grievance Management', description: 'Handle citizen complaints and grievances' },
  { id: 'APPOINTMENT', name: 'Appointment Booking', description: 'Schedule and manage appointments' },
  { id: 'STATUS_TRACKING', name: 'Status Tracking', description: 'Track application and request status' },
  { id: 'LEAD_CAPTURE', name: 'Lead Capture', description: 'Capture and manage leads' },
  { id: 'SURVEY', name: 'Survey & Feedback', description: 'Conduct surveys and collect feedback' },
  { id: 'FEEDBACK', name: 'Feedback System', description: 'Collect and manage feedback' },
  { id: 'DOCUMENT_UPLOAD', name: 'Document Upload', description: 'Allow document uploads' },
  { id: 'GEO_LOCATION', name: 'Geo Location', description: 'Location-based services' },
  { id: 'MULTI_LANGUAGE', name: 'Multi Language', description: 'Support multiple languages' }
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
      toast.error('Admin password must be at least 6 characters');
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
          nameHi: '',
          nameOr: '',
          nameMr: '',
          companyType: 'GOVERNMENT',
          contactEmail: '',
          contactPhone: '',
          address: '',
          enabledModules: [],
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
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white/95 backdrop-blur-lg rounded-2xl border border-slate-200/50 shadow-2xl">
        <CardHeader className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <div>
              <CardTitle className="text-xl text-white">{editingCompany ? 'Edit Company' : 'Create New Company'}</CardTitle>
              <CardDescription className="text-blue-100">{editingCompany ? 'Update company information' : 'Add a new company to the platform'}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
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
                  <option value="GOV_GRIEVANCE">Government Grievance</option>
                  <option value="SERVICE_BOOKING">Service Booking</option>
                  <option value="SURVEY_FEEDBACK">Survey & Feedback</option>
                  <option value="LEAD_COLLECTION">Lead Collection</option>
                  <option value="CUSTOM_ENTERPRISE">Custom Enterprise</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="nameHi">Company Name (Hindi) (optional)</Label>
                <Input
                  id="nameHi"
                  name="nameHi"
                  type="text"
                  value={formData.nameHi || ''}
                  onChange={handleChange}
                  placeholder="कंपनी का नाम"
                />
              </div>
              <div>
                <Label htmlFor="nameMr">Company Name (Marathi) (optional)</Label>
                <Input
                  id="nameMr"
                  name="nameMr"
                  type="text"
                  value={formData.nameMr || ''}
                  onChange={handleChange}
                  placeholder="कंपनीचे नाव"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="nameOr">Company Name (Odia) (optional)</Label>
                <Input
                  id="nameOr"
                  name="nameOr"
                  type="text"
                  value={formData.nameOr || ''}
                  onChange={handleChange}
                  placeholder="କମ୍ପାନି ନାମ"
                />
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

            {/* Admin Creation Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">Create Company Admin</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAdminForm(!showAdminForm)}
                >
                  {showAdminForm ? 'Remove Admin' : 'Add Admin'}
                </Button>
              </div>
              
              {showAdminForm && (
                <div className="space-y-4 p-4 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="adminFirstName">Admin First Name *</Label>
                      <Input
                        id="adminFirstName"
                        name="firstName"
                        type="text"
                        value={formData.admin?.firstName || ''}
                        onChange={handleAdminChange}
                        required
                        placeholder="Admin first name"
                      />
                    </div>
                    <div>
                      <Label htmlFor="adminLastName">Admin Last Name *</Label>
                      <Input
                        id="adminLastName"
                        name="lastName"
                        type="text"
                        value={formData.admin?.lastName || ''}
                        onChange={handleAdminChange}
                        required
                        placeholder="Admin last name"
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="adminEmail">Admin Email *</Label>
                      <Input
                        id="adminEmail"
                        name="email"
                        type="email"
                        value={formData.admin?.email || ''}
                        onChange={handleAdminChange}
                        required
                        placeholder="admin@company.com"
                      />
                    </div>
                    <div>
                      <Label htmlFor="adminPassword">Admin Password *</Label>
                      <Input
                        id="adminPassword"
                        name="password"
                        type="password"
                        value={formData.admin?.password || ''}
                        onChange={handleAdminChange}
                        minLength={6}
                        required
                        placeholder="Min 6 characters"
                      />
                      {formData.admin?.password && !validatePassword(formData.admin.password) && (
                        <p className="text-xs text-red-500 mt-1">Password must be at least 6 characters</p>
                      )}
                    </div>
                  </div>
                  
                  <div>
                    <Label htmlFor="adminPhone">Admin Phone</Label>
                    <Input
                      id="adminPhone"
                      name="phone"
                      type="tel"
                      value={formData.admin?.phone || ''}
                      onChange={(e) => {
                        // Only allow digits, max 10
                        const value = e.target.value.replace(/\D/g, '').slice(0, 10);
                        setFormData(prev => ({
                          ...prev,
                          admin: {
                            ...prev.admin!,
                            phone: value
                          }
                        }));
                      }}
                      maxLength={10}
                      placeholder="10 digit number (e.g., 9356150561)"
                    />
                    {formData.admin?.phone && !validatePhoneNumber(formData.admin.phone) && (
                      <p className="text-xs text-red-500 mt-1">Phone number must be exactly 10 digits</p>
                    )}
                  </div>
                </div>
              )}
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
