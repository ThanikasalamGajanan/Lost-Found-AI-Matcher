'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { notificationsApi, type Notification as ApiNotification } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import {
  Bell,
  BellOff,
  CheckCheck,
  Loader2,
  Sparkles,
  ShieldQuestion,
  ClipboardCheck,
  CheckCircle2,
  XCircle,
  PackageCheck,
  MessageSquare,
  type LucideIcon,
} from 'lucide-react';
import toast from 'react-hot-toast';
import type { NotificationType } from '@/types';

const iconMap: Record<NotificationType, LucideIcon> = {
  new_match: Sparkles,
  verification_question: ShieldQuestion,
  verification_result: ClipboardCheck,
  match_approved: CheckCircle2,
  match_rejected: XCircle,
  item_returned: PackageCheck,
  admin_message: MessageSquare,
};

const colourMap: Record<NotificationType, string> = {
  new_match: 'bg-blue-100 text-blue-600',
  verification_question: 'bg-purple-100 text-purple-600',
  verification_result: 'bg-yellow-100 text-yellow-600',
  match_approved: 'bg-green-100 text-green-600',
  match_rejected: 'bg-red-100 text-red-600',
  item_returned: 'bg-teal-100 text-teal-600',
  admin_message: 'bg-gray-100 text-gray-600',
};

export default function NotificationsPage() {
  const { user, isLoading: authLoading } = useAuthStore();
  const router = useRouter();
  const [notifications, setNotifications] = useState<ApiNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
      return;
    }
    if (user) fetchNotifications();
  }, [user, authLoading, router]);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const data = await notificationsApi.getAll();
      setNotifications(data.notifications || []);
      setUnreadCount(data.unread_count);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load notifications';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const getNotificationHref = (n: ApiNotification): string | undefined => {
    // Approved matches and message-related notifications go to the chat thread
    if ((n.type === 'match_approved' || n.type === 'admin_message') && n.match_id) {
      return `/messages/${n.match_id}`;
    }
    // Match-related notifications go to the report's match page
    if (n.item_id && n.item_type) {
      return `/matches/${n.item_id}?type=${n.item_type}`;
    }
    // Fallback for match-approved without item_id
    if (n.match_id) {
      return `/messages/${n.match_id}`;
    }
    return undefined;
  };

  const handleNotificationClick = async (n: ApiNotification) => {
    const href = getNotificationHref(n);
    try {
      await notificationsApi.markRead(n.id);
      setNotifications((prev) =>
        prev.map((item) => (item.id === n.id ? { ...item, is_read: true } : item))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
      if (href) {
        router.push(href);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to mark as read';
      toast.error(message);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationsApi.markAllRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
      toast.success('All notifications marked as read');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to mark all as read';
      toast.error(message);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Bell className="w-8 h-8 text-primary-600" />
          Notifications
          {unreadCount > 0 && (
            <span className="badge bg-red-100 text-red-700 text-sm">{unreadCount} new</span>
          )}
        </h1>
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            className="btn-secondary text-sm flex items-center justify-center gap-1"
          >
            <CheckCheck className="w-4 h-4" /> Mark all as read
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="text-center py-16 px-4">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 mb-4">
            <BellOff className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900">No notifications yet</h3>
          <p className="text-gray-500 mt-1">
            We’ll let you know when there are matches, updates, or messages.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map((n) => {
            const Icon = iconMap[n.type as NotificationType] || Bell;
            const iconColour = colourMap[n.type as NotificationType] || 'bg-gray-100 text-gray-600';

            return (
              <button
                key={n.id}
                onClick={() => handleNotificationClick(n)}
                className={`w-full text-left card flex items-start gap-4 transition-colors ${
                  !n.is_read
                    ? 'border-primary-200 bg-primary-50/30 hover:bg-primary-50/50'
                    : 'hover:bg-gray-50'
                }`}
              >
                <div className={`p-2 rounded-lg flex-shrink-0 ${iconColour}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-medium text-gray-900">{n.title}</p>
                    {!n.is_read && (
                      <span className="w-2 h-2 rounded-full bg-primary-500 flex-shrink-0 mt-1.5" />
                    )}
                  </div>
                  <p className="text-sm text-gray-600 mt-1">{n.message}</p>
                  <p className="text-xs text-gray-400 mt-2">
                    {formatTime(n.created_at)}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function formatTime(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.round(diffMs / 60000);
  const diffHours = Math.round(diffMs / 3600000);
  const diffDays = Math.round(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}
