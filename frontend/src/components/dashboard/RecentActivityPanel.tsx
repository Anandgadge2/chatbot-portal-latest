'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api/client';
import { Activity, UserPlus, FileText, Calendar, CheckCircle, XCircle, Clock } from 'lucide-react';

interface AuditLog {
  _id: string;
  userId: any;
  action: string;
  resourceType: string;
  resourceId: string;
  changes: any;
  ipAddress: string;
  createdAt: string;
}

export default function RecentActivityPanel() {
  const [activities, setActivities] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRecentActivities();
  }, []);

  const fetchRecentActivities = async () => {
    try {
      const response = await apiClient.get('/audit-logs?limit=10');
      if (response.success) {
        setActivities(response.data.logs || []);
      }
    } catch (error) {
      console.error('Failed to fetch activities:', error);
    } finally {
      setLoading(false);
    }
  };

  const getActivityIcon = (action: string, resourceType: string) => {
    if (action === 'CREATE') {
      if (resourceType === 'User') return <UserPlus className="w-5 h-5 text-green-600" />;
      if (resourceType === 'Grievance') return <FileText className="w-5 h-5 text-blue-600" />;
      if (resourceType === 'Appointment') return <Calendar className="w-5 h-5 text-purple-600" />;
      return <Activity className="w-5 h-5 text-gray-600" />;
    }
    if (action === 'UPDATE') return <Clock className="w-5 h-5 text-yellow-600" />;
    if (action === 'DELETE') return <XCircle className="w-5 h-5 text-red-600" />;
    if (action === 'RESOLVE') return <CheckCircle className="w-5 h-5 text-green-600" />;
    return <Activity className="w-5 h-5 text-gray-600" />;
  };

  const getActivityColor = (action: string) => {
    switch (action) {
      case 'CREATE': return 'bg-green-100';
      case 'UPDATE': return 'bg-yellow-100';
      case 'DELETE': return 'bg-red-100';
      case 'RESOLVE': return 'bg-green-100';
      default: return 'bg-gray-100';
    }
  };

  const getActivityDescription = (log: AuditLog) => {
    const userName = typeof log.userId === 'object' && log.userId 
      ? `${log.userId.firstName} ${log.userId.lastName}`
      : 'System';
    
    const actions: Record<string, string> = {
      CREATE: 'created',
      UPDATE: 'updated',
      DELETE: 'deleted',
      RESOLVE: 'resolved',
      ASSIGN: 'assigned',
      LOGIN: 'logged in',
      LOGOUT: 'logged out'
    };

    const actionText = actions[log.action] || log.action.toLowerCase();
    return `${userName} ${actionText} ${log.resourceType}`;
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 rounded w-1/4"></div>
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 bg-gray-100 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md border border-gray-200">
      <div className="p-6 border-b bg-gradient-to-r from-gray-50 to-white">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center">
          <Activity className="w-5 h-5 mr-2 text-blue-600" />
          Recent Activity
        </h3>
        <p className="text-sm text-gray-500 mt-1">Latest system activities and changes</p>
      </div>
      
      <div className="p-6">
        {activities.length === 0 ? (
          <div className="text-center py-8">
            <Activity className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No recent activities</p>
          </div>
        ) : (
          <div className="space-y-3">
            {activities.map((log) => (
              <div
                key={log._id}
                className="flex items-start space-x-4 p-4 rounded-lg border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer"
              >
                <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${getActivityColor(log.action)}`}>
                  {getActivityIcon(log.action, log.resourceType)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">
                    {getActivityDescription(log)}
                  </p>
                  {log.changes?.description && (
                    <p className="text-sm text-gray-600 mt-1 truncate">
                      {log.changes.description}
                    </p>
                  )}
                  <p className="text-xs text-gray-400 mt-1">
                    {new Date(log.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
