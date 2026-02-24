import { useEffect, useState } from 'react';
import { Bell, Check, CheckCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { db } from '../lib/database';
import { Notification } from '../types';

export default function NotificationsPage() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    db.notifications.getForUser(user.id).then((data) => {
      setNotifications(data);
      setLoading(false);
    });
  }, [user]);

  async function handleMarkRead(id: string) {
    await db.notifications.markRead(id);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
  }

  async function handleMarkAllRead() {
    if (!user) return;
    await db.notifications.markAllRead(user.id);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  }

  const unread = notifications.filter((n) => !n.is_read);

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
          {unread.length > 0 && (
            <p className="text-sm text-gray-500 mt-1">{unread.length} unread</p>
          )}
        </div>
        {unread.length > 0 && (
          <button
            onClick={handleMarkAllRead}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <CheckCheck className="h-3.5 w-3.5" />
            Mark all read
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400 text-sm">Loading...</div>
        ) : notifications.length === 0 ? (
          <div className="p-12 text-center">
            <Bell className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No notifications yet</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {notifications.map((n) => (
              <div
                key={n.id}
                className={`flex items-start gap-4 px-5 py-4 ${!n.is_read ? 'bg-blue-50/30' : ''}`}
              >
                <div className={`w-2 h-2 rounded-full mt-2 shrink-0 ${!n.is_read ? 'bg-blue-500' : 'bg-gray-200'}`} />
                <div className="flex-1 min-w-0">
                  <p className={`text-sm ${!n.is_read ? 'font-semibold text-gray-900' : 'font-medium text-gray-700'}`}>
                    {n.title}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">{n.body}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {new Date(n.created_at).toLocaleString()}
                  </p>
                </div>
                {!n.is_read && (
                  <button
                    onClick={() => handleMarkRead(n.id)}
                    className="shrink-0 p-1 text-gray-400 hover:text-blue-600 transition-colors"
                    title="Mark as read"
                  >
                    <Check className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
