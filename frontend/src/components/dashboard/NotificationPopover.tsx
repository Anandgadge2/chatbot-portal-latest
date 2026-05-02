"use client";

import { Bell, Check, Clock, ExternalLink, Info, MessageSquare, AlertTriangle, ArrowRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

type Notification = {
  _id: string;
  title: string;
  message: string;
  eventType: string;
  isRead: boolean;
  createdAt: string;
  grievanceId?: string;
  grievanceObjectId?: string;
};

type NotificationPopoverProps = {
  notifications: Notification[];
  unreadCount: number;
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  onNotificationClick: (notification: Notification) => void;
};

export function NotificationPopover({
  notifications,
  unreadCount,
  onMarkAsRead,
  onMarkAllAsRead,
  onNotificationClick,
}: NotificationPopoverProps) {
  const getIcon = (type: string) => {
    switch (type) {
      case "GRIEVANCE_RECEIVED":
        return <Info className="w-4 h-4 text-blue-500" />;
      case "GRIEVANCE_ASSIGNED":
      case "GRIEVANCE_REASSIGNED":
        return <ArrowRight className="w-4 h-4 text-indigo-500" />;
      case "GRIEVANCE_REVERTED":
        return <AlertTriangle className="w-4 h-4 text-amber-500" />;
      case "GRIEVANCE_STATUS_UPGRADED":
        return <Check className="w-4 h-4 text-emerald-500" />;
      case "GRIEVANCE_REMINDER":
        return <Clock className="w-4 h-4 text-rose-500" />;
      default:
        return <Bell className="w-4 h-4 text-slate-500" />;
    }
  };

  const getBgColor = (type: string) => {
    switch (type) {
      case "GRIEVANCE_RECEIVED":
        return "bg-blue-500/10";
      case "GRIEVANCE_ASSIGNED":
      case "GRIEVANCE_REASSIGNED":
        return "bg-indigo-500/10";
      case "GRIEVANCE_REVERTED":
        return "bg-amber-500/10";
      case "GRIEVANCE_STATUS_UPGRADED":
        return "bg-emerald-500/10";
      case "GRIEVANCE_REMINDER":
        return "bg-rose-500/10";
      default:
        return "bg-slate-500/10";
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          className="relative h-9 w-9 sm:h-10 sm:w-10 p-0 text-white/70 hover:text-white hover:bg-white/10 rounded-xl transition-all duration-300 border border-white/10 flex items-center justify-center shadow-lg"
          title="Notifications"
          aria-label={`Open notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ""}`}
        >
          <Bell className="w-4.5 h-4.5 sm:w-5 sm:h-5" />
          {unreadCount > 0 && (
            <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[14px] font-bold text-white ring-2 ring-slate-900 animate-in zoom-in duration-300">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] sm:w-[420px] p-0 bg-white border-slate-200 shadow-2xl rounded-2xl overflow-hidden z-[100] animate-in fade-in zoom-in duration-200" align="end" sideOffset={8}>
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80 backdrop-blur-md">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shadow-md shadow-blue-200">
              <Bell className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="text-[15px] font-black text-slate-900 uppercase tracking-wider leading-none">Notifications</h3>
              <p className="text-[14px] text-slate-500 font-bold mt-1 uppercase tracking-tight">Activity Center</p>
            </div>
          </div>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onMarkAllAsRead();
              }}
              className="text-[14px] font-bold text-blue-600 hover:text-blue-700 hover:bg-blue-50 uppercase tracking-tight h-7 px-2 rounded-lg transition-colors"
            >
              Mark all read
            </Button>
          )}
        </div>
        
        <ScrollArea className="max-h-[450px] overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-8 text-center bg-white">
              <div className="w-16 h-16 rounded-3xl bg-slate-50 flex items-center justify-center mb-4 border border-slate-100 shadow-inner">
                <Bell className="w-8 h-8 text-slate-300" />
              </div>
              <h4 className="text-slate-900 font-black text-sm uppercase tracking-wide">All Caught Up</h4>
              <p className="text-slate-500 text-[15px] mt-1 font-medium">No new activity reported at the moment.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 bg-white">
              {notifications.map((notification) => (
                <div
                  key={notification._id}
                  onClick={() => onNotificationClick(notification)}
                  className={cn(
                    "group p-4 flex gap-4 hover:bg-slate-50/80 transition-all cursor-pointer relative",
                    !notification.isRead && "bg-blue-50/30"
                  )}
                >
                  {!notification.isRead && (
                    <div className="absolute left-0 top-3 bottom-3 w-1 bg-blue-600 rounded-r-full shadow-[2px_0_8px_rgba(37,99,235,0.4)]" />
                  )}
                  <div className={cn(
                    "flex-shrink-0 w-11 h-11 rounded-2xl flex items-center justify-center shadow-sm border border-white/50",
                    getBgColor(notification.eventType).replace("/10", "/20")
                  )}>
                    {getIcon(notification.eventType)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={cn(
                        "text-[12.5px] font-black leading-tight",
                        notification.isRead ? "text-slate-600" : "text-slate-900"
                      )}>
                        {notification.title}
                      </p>
                      <span className="text-[14px] font-bold text-slate-400 whitespace-nowrap bg-slate-50 px-1.5 py-0.5 rounded-md border border-slate-100">
                        {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                      </span>
                    </div>
                    <p className={cn(
                      "text-[11.5px] mt-1.5 leading-relaxed line-clamp-2",
                      notification.isRead ? "text-slate-500" : "text-slate-700 font-medium"
                    )}>
                      {notification.message}
                    </p>
                    {notification.grievanceId && (
                      <div className="mt-2.5 flex items-center gap-2">
                        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-slate-100 border border-slate-200">
                          <span className="text-[15px] font-black text-slate-500 uppercase tracking-tighter">ID:</span>
                          <span className="text-[14px] font-black text-slate-900 tracking-tight">#{notification.grievanceId}</span>
                        </div>
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 text-[14px] font-black text-blue-600 uppercase tracking-widest">
                          View Details <ArrowRight className="w-3 h-3" />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
        
        
      </PopoverContent>
    </Popover>
  );
}
