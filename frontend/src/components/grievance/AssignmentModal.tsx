'use client';

import { useState, useEffect } from 'react';
import { X, Users, Check } from 'lucide-react';
import { apiClient } from '@/lib/api/client';
import toast from 'react-hot-toast';

interface User {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  departmentId?: {
    name: string;
  };
}

interface AssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  itemId: string;
  itemType: 'grievance' | 'appointment';
  currentAssignee?: string;
  onSuccess: () => void;
}

export default function AssignmentModal({
  isOpen,
  onClose,
  itemId,
  itemType,
  currentAssignee,
  onSuccess
}: AssignmentModalProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchAvailableUsers();
    }
  }, [isOpen]);

  const fetchAvailableUsers = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/assignments/users/available');
      if (response.success) {
        setUsers(response.data);
      }
    } catch (error) {
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const handleAssign = async () => {
    if (!selectedUser) {
      toast.error('Please select a user to assign');
      return;
    }

    try {
      setSubmitting(true);
      const response = await apiClient.put(
        `/assignments/${itemType}/${itemId}/assign`,
        { assignedTo: selectedUser }
      );

      if (response.success) {
        toast.success(`${itemType === 'grievance' ? 'Grievance' : 'Appointment'} assigned successfully!`);
        onSuccess();
        onClose();
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to assign');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white p-6 flex items-center justify-between">
          <div className="flex items-center">
            <Users className="w-6 h-6 mr-3" />
            <div>
              <h2 className="text-2xl font-bold">Assign {itemType === 'grievance' ? 'Grievance' : 'Appointment'}</h2>
              <p className="text-indigo-100 text-sm mt-1">Select a user to handle this {itemType}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-2 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Loading available users...</p>
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600">No users available for assignment</p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-gray-600 mb-4">
                Select a user from your {users[0]?.departmentId ? 'department' : 'company'} to assign this {itemType}:
              </p>
              {users.map((user) => (
                <div
                  key={user._id}
                  onClick={() => setSelectedUser(user._id)}
                  className={`
                    flex items-center justify-between p-4 rounded-lg border-2 cursor-pointer transition-all
                    ${selectedUser === user._id
                      ? 'border-indigo-600 bg-indigo-50'
                      : 'border-gray-200 hover:border-indigo-300 hover:bg-gray-50'
                    }
                  `}
                >
                  <div className="flex items-center space-x-4">
                    <div className={`
                      w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg
                      ${selectedUser === user._id ? 'bg-indigo-600' : 'bg-gray-400'}
                    `}>
                      {user.firstName.charAt(0)}{user.lastName.charAt(0)}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">
                        {user.firstName} {user.lastName}
                      </p>
                      <p className="text-sm text-gray-600">{user.email}</p>
                      <div className="flex items-center space-x-2 mt-1">
                        <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-800">
                          {user.role.replace('_', ' ')}
                        </span>
                        {user.departmentId && (
                          <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-800">
                            {user.departmentId.name}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  {selectedUser === user._id && (
                    <div className="flex-shrink-0">
                      <div className="w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center">
                        <Check className="w-5 h-5 text-white" />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-4 flex justify-end space-x-3 border-t">
          <button
            onClick={onClose}
            className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            onClick={handleAssign}
            disabled={!selectedUser || submitting}
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
          >
            {submitting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Assigning...
              </>
            ) : (
              <>
                <Users className="w-4 h-4 mr-2" />
                Assign {itemType === 'grievance' ? 'Grievance' : 'Appointment'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
