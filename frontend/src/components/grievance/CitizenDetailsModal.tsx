'use client';

import { useState } from 'react';
import { Grievance } from '@/lib/api/grievance';
import { Appointment } from '@/lib/api/appointment';
import { X, MapPin, Phone, Calendar, Image as ImageIcon, FileText, User, MessageCircle, Tag, Clock, FileType } from 'lucide-react';
import Image from 'next/image';
import { format, formatDistanceToNow } from 'date-fns';

const isImageMedia = (media: { type?: string; url?: string }) =>
  media.type === 'image' || /\.(jpe?g|png|gif|webp|bmp)(\?|$)/i.test(media.url || '') || (media.url && media.url.includes('image'));

const getDocumentLabel = (url: string) => {
  if (!url) return 'Document';
  const lower = url.toLowerCase();
  if (lower.includes('.pdf') || lower.includes('pdf')) return 'PDF';
  if (lower.includes('.doc') || lower.includes('word')) return 'Word';
  return 'Document';
};

interface CitizenDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  grievance?: Grievance | null;
  appointment?: Appointment | null;
}

export default function CitizenDetailsModal({
  isOpen,
  onClose,
  grievance,
  appointment
}: CitizenDetailsModalProps) {
  const [fullScreenMedia, setFullScreenMedia] = useState<{ url: string; alt?: string } | null>(null);

  if (!isOpen || (!grievance && !appointment)) return null;

  const data = (grievance || appointment) as any;
  const type = grievance ? 'Grievance' : 'Appointment';
  const createdDate = new Date(data?.createdAt || '');
  const timeAgo = formatDistanceToNow(createdDate, { addSuffix: true });
  const id = grievance?.grievanceId || appointment?.appointmentId;

  // Get status config for header gradient
  const getStatusConfig = () => {
    const status = data?.status || 'PENDING';
    switch (status) {
      case 'RESOLVED':
      case 'COMPLETED':
        return { gradient: 'from-emerald-500 to-green-600', icon: <FileText className="w-6 h-6 text-white" /> };
      case 'CONFIRMED':
      case 'IN_PROGRESS':
        return { gradient: 'from-blue-500 to-indigo-600', icon: <FileText className="w-6 h-6 text-white" /> };
      case 'SCHEDULED':
        return { gradient: 'from-indigo-500 to-purple-600', icon: <FileText className="w-6 h-6 text-white" /> };
      case 'CANCELLED':
        return { gradient: 'from-red-500 to-rose-600', icon: <FileText className="w-6 h-6 text-white" /> };
      default:
        return { gradient: 'from-amber-500 to-orange-600', icon: <FileText className="w-6 h-6 text-white" /> };
    }
  };

  const statusConfig = getStatusConfig();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm overflow-y-auto p-4">
      <div className="w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-2xl shadow-2xl bg-white animate-in fade-in zoom-in duration-200 flex flex-col">
        {/* Gradient Header */}
        <div className={`bg-gradient-to-r ${statusConfig.gradient} p-5 relative overflow-hidden flex-shrink-0`}>
          {/* Background pattern */}
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48cGF0dGVybiBpZD0iYSIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSIgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBwYXR0ZXJuVHJhbnNmb3JtPSJyb3RhdGUoNDUpIj48cGF0aCBkPSJNLTEwIDMwaDYwdjJoLTYweiIgZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwwLjA4KSIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0idXJsKCNhKSIvPjwvc3ZnPg==')] opacity-50"></div>
          
          <div className="relative">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm flex-shrink-0">
                  {statusConfig.icon}
                </div>
                <div className="min-w-0">
                  <h2 className="text-lg font-bold text-white">Citizen Details</h2>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="px-2 py-0.5 bg-white/20 rounded-full text-[11px] font-bold text-white backdrop-blur-sm">
                      {type} ID: {id}
                    </span>
                    <span className="text-white/80 text-xs">•</span>
                    <span className="text-white/80 text-xs">{timeAgo}</span>
                  </div>
                </div>
              </div>
              <button 
                onClick={onClose}
                className="w-9 h-9 rounded-lg bg-white/20 hover:bg-white/30 flex items-center justify-center transition-all backdrop-blur-sm flex-shrink-0"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            </div>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto flex-1 p-5 space-y-5">
          {/* Quick Info Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-100">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <User className="w-4 h-4 text-blue-600" />
                </div>
                <span className="text-xs font-bold text-blue-600 uppercase">Citizen</span>
              </div>
              <p className="text-base font-bold text-gray-900 truncate" title={data?.citizenName}>{data?.citizenName}</p>
            </div>

            {grievance && (
              <div className="bg-gradient-to-br from-purple-50 to-fuchsia-50 rounded-xl p-4 border border-purple-100 group relative">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Tag className="w-4 h-4 text-purple-600" />
                  </div>
                  <span className="text-xs font-bold text-purple-600 uppercase">Category</span>
                </div>
                <p className="text-base font-bold text-gray-900 truncate" title={grievance.category || 'General'}>
                  {grievance.category || 'General'}
                </p>
              </div>
            )}

            {appointment && (
              <div className="bg-gradient-to-br from-purple-50 to-fuchsia-50 rounded-xl p-4 border border-purple-100 group relative">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Calendar className="w-4 h-4 text-purple-600" />
                  </div>
                  <span className="text-xs font-bold text-purple-600 uppercase">Date</span>
                </div>
                <p className="text-base font-bold text-gray-900">
                  {format(new Date(appointment.appointmentDate), 'dd MMM yyyy')}
                </p>
              </div>
            )}

            <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl p-4 border border-emerald-100">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Clock className="w-4 h-4 text-emerald-600" />
                </div>
                <span className="text-xs font-bold text-emerald-600 uppercase">Created</span>
              </div>
              <p className="text-base font-bold text-gray-900">{format(createdDate, 'dd MMM yyyy')}</p>
            </div>

            <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl p-4 border border-amber-100">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Clock className="w-4 h-4 text-amber-600" />
                </div>
                <span className="text-xs font-bold text-amber-600 uppercase">Time</span>
              </div>
              <p className="text-base font-bold text-gray-900">{format(createdDate, 'hh:mm a')}</p>
            </div>
          </div>

          {/* Citizen Information */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="bg-gradient-to-r from-slate-50 to-blue-50 px-6 py-5 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <User className="w-6 h-6 text-blue-600" />
                Citizen Information
              </h3>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl">
                  <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <User className="w-6 h-6 text-blue-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">Full Name</p>
                    <p className="text-base font-bold text-slate-800 truncate">{data?.citizenName}</p>
                  </div>
                </div>

                <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl">
                  <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Phone className="w-6 h-6 text-green-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">Phone Number</p>
                    <p className="text-base font-bold text-slate-800">{data?.citizenPhone}</p>
                  </div>
                </div>

                {data?.citizenWhatsApp && (
                  <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl">
                    <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center flex-shrink-0">
                      <MessageCircle className="w-6 h-6 text-emerald-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">WhatsApp</p>
                      <p className="text-base font-bold text-slate-800">{data?.citizenWhatsApp}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Grievance/Appointment Details */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="bg-gradient-to-r from-slate-50 to-purple-50 px-6 py-5 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <FileText className="w-6 h-6 text-purple-600" />
                {type} Details
              </h3>
            </div>
            <div className="p-6 space-y-5">
              {grievance && (
                <>
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">Category</p>
                    <span className="inline-block px-4 py-2 rounded-lg text-base font-medium bg-blue-100 text-blue-800 border border-blue-200">
                      {grievance.category || 'General'}
                    </span>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">Description</p>
                    <div className="bg-gradient-to-br from-slate-50 to-gray-50 rounded-xl p-5 border border-slate-100">
                      <p className="text-base text-slate-700 leading-relaxed whitespace-pre-wrap">
                        {grievance.description || 'No description provided'}
                      </p>
                    </div>
                  </div>
                </>
              )}
              
              {appointment && (
                <>
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">Purpose</p>
                    <div className="bg-gradient-to-br from-slate-50 to-gray-50 rounded-xl p-5 border border-slate-100">
                      <p className="text-base text-slate-700 leading-relaxed whitespace-pre-wrap">
                        {appointment.purpose || 'No purpose provided'}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-5">
                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">Date</p>
                      <p className="text-base font-bold text-slate-800 flex items-center gap-2">
                        <Calendar className="w-5 h-5 text-blue-600" />
                        {format(new Date(appointment.appointmentDate), 'dd MMM yyyy')}
                      </p>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">Time</p>
                      <p className="text-base font-bold text-slate-800">{appointment.appointmentTime}</p>
                    </div>
                  </div>
                </>
              )}

              <div className="grid grid-cols-2 gap-5 pt-2">
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">Created At</p>
                  <p className="text-base font-semibold text-slate-800">{format(createdDate, 'dd/MM/yyyy, hh:mm:ss a')}</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">Last Updated</p>
                  <p className="text-base font-semibold text-slate-800">
                    {format(new Date(data?.updatedAt || data?.createdAt || ''), 'dd/MM/yyyy, hh:mm:ss a')}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Location Information */}
          {/* {(grievance?.location || appointment?.location) && (
            <div className="bg-gradient-to-br from-green-50 to-white border border-green-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <MapPin className="w-5 h-5 mr-2 text-green-600" />
                Location Details
              </h3>
              <div className="space-y-3">
                {grievance?.location && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-gray-500">Latitude</label>
                        <p className="text-gray-900 font-mono">{grievance.location.coordinates?.[1] || 'N/A'}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">Longitude</label>
                        <p className="text-gray-900 font-mono">{grievance.location.coordinates?.[0] || 'N/A'}</p>
                      </div>
                    </div>
                    {grievance.location.coordinates && (
                      <div className="mt-4">
                        <a
                          href={`https://www.google.com/maps?q=${grievance.location.coordinates[1]},${grievance.location.coordinates[0]}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
                        >
                          <MapPin className="w-4 h-4 mr-2" />
                          View on Google Maps
                        </a>
                      </div>
                    )}
                  </>
                )}
                {grievance?.location?.address && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">Address</label>
                    <p className="text-gray-900 mt-1">{grievance.location.address}</p>
                  </div>
                )}
              </div>
            </div>
          )} */}

          {/* Media/Photos */}
          {grievance?.media && grievance.media.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
              <div className="bg-gradient-to-r from-slate-50 to-pink-50 px-5 py-4 border-b border-slate-100">
                <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                  <ImageIcon className="w-5 h-5 text-pink-600" />
                  Uploaded Media
                  <span className="ml-2 px-2 py-0.5 bg-pink-100 text-pink-600 rounded-full text-xs font-bold">
                    {grievance.media.length}
                  </span>
                </h3>
              </div>
              <div className="p-5">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {grievance.media.map((media: any, index: number) => {
                    const isImage = isImageMedia(media);
                    return (
                      <div key={index} className="relative group rounded-xl overflow-hidden border border-slate-200 aspect-video">
                        {isImage ? (
                          <button
                            type="button"
                            onClick={() => setFullScreenMedia({ url: media.url, alt: `Evidence ${index + 1}` })}
                            className="absolute inset-0 w-full h-full text-left focus:outline-none focus:ring-2 focus:ring-pink-500 focus:ring-inset rounded-xl"
                          >
                            <Image
                              src={media.url}
                              alt={`Evidence ${index + 1}`}
                              fill
                              className="object-cover group-hover:scale-105 transition-transform duration-300 cursor-pointer"
                              unoptimized={!media.url?.includes('cloudinary')}
                            />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                              <span className="opacity-0 group-hover:opacity-100 text-white text-sm font-medium bg-black/50 px-3 py-1.5 rounded-lg transition-opacity">
                                Click to view full screen
                              </span>
                            </div>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => media.url && window.open(media.url, '_blank', 'noopener,noreferrer')}
                            className="w-full h-full bg-gradient-to-br from-slate-100 to-slate-200 flex flex-col items-center justify-center hover:from-slate-200 hover:to-slate-300 transition-colors cursor-pointer border-0"
                          >
                            <FileType className="w-10 h-10 text-slate-500 mb-2" />
                            <span className="text-sm font-medium text-slate-600">{getDocumentLabel(media.url || '')}</span>
                            <span className="text-xs text-slate-400 mt-0.5">Click to open</span>
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Full-screen image overlay */}
          {fullScreenMedia && (
            <div
              className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4"
              onClick={() => setFullScreenMedia(null)}
              role="dialog"
              aria-modal="true"
              aria-label="Media full screen view"
            >
              <button
                type="button"
                onClick={() => setFullScreenMedia(null)}
                className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
                aria-label="Close full screen"
              >
                <X className="w-6 h-6" />
              </button>
              <div className="relative w-full h-full min-h-[50vh]" onClick={(e) => e.stopPropagation()}>
                <Image
                  src={fullScreenMedia.url}
                  alt={fullScreenMedia.alt || 'Full size'}
                  fill
                  className="object-contain"
                  unoptimized
                />
              </div>
            </div>
          )}

          {/* Status History */}
          {grievance?.statusHistory && grievance.statusHistory.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
              <div className="bg-gradient-to-r from-slate-50 to-indigo-50 px-5 py-4 border-b border-slate-100">
                <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-indigo-600" />
                  Status History
                </h3>
              </div>
              <div className="p-5">
                <div className="space-y-3">
                  {grievance.statusHistory.map((history: any, index: number) => (
                    <div key={index} className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${
                        history.status === 'RESOLVED' ? 'bg-green-500' :
                        history.status === 'IN_PROGRESS' ? 'bg-blue-500' :
                        'bg-yellow-500'
                      }`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-slate-800">{history.status}</p>
                        <p className="text-xs text-slate-600 mt-1">{history.remarks || 'Status updated'}</p>
                        <p className="text-[10px] text-slate-400 mt-1">
                          {format(new Date(history.changedAt), 'dd/MM/yyyy, hh:mm:ss a')}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Department & Assignment */}
          {(data?.departmentId || data?.assignedTo) && (
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
              <div className="bg-gradient-to-r from-slate-50 to-slate-50 px-5 py-4 border-b border-slate-100">
                <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                  <Tag className="w-5 h-5 text-slate-600" />
                  Assignment Information
                </h3>
              </div>
              <div className="p-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {data?.departmentId && (
                    <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Department</p>
                      <p className="text-sm font-bold text-slate-800">
                        {typeof data.departmentId === 'object' ? (data.departmentId as any).name : data.departmentId}
                      </p>
                    </div>
                  )}
                  {data?.assignedTo && (
                    <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Assigned To</p>
                      <p className="text-sm font-bold text-slate-800">
                        {typeof data.assignedTo === 'object' 
                          ? `${(data.assignedTo as any).firstName} ${(data.assignedTo as any).lastName}`
                          : data.assignedTo}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-gray-200 flex justify-end bg-white flex-shrink-0">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-slate-700 hover:bg-slate-800 text-white font-semibold rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
