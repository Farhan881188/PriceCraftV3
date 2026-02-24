import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SettingsProvider } from './context/SettingsContext';
import { ToastProvider } from './components/shared/Toast';
import Sidebar from './components/layout/Sidebar';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import EstimatesListPage from './pages/EstimatesListPage';
import NewEstimatePage from './pages/NewEstimatePage';
import EstimateDetailPage from './pages/EstimateDetailPage';
import NotificationsPage from './pages/NotificationsPage';
import UsersPage from './pages/admin/UsersPage';
import AdminSettingsPage from './pages/admin/SettingsPage';
import DatabankPage from './pages/admin/DatabankPage';
import InactiveAccountPage from './pages/InactiveAccountPage';
import { db } from './lib/database';
import { canAccessAdmin } from './lib/permissions';

function AppShell() {
  const { user, session, loading } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    db.notifications.getForUser(user.id).then((ns) => {
      setUnreadCount(ns.filter((n) => !n.is_read).length);
    });
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (!session || !user) {
    return (
      <Routes>
        <Route path="*" element={<LoginPage />} />
      </Routes>
    );
  }

  if (!user.is_active) {
    return <InactiveAccountPage />;
  }

  const isAdmin = canAccessAdmin(user.role);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar unreadCount={unreadCount} />
      <main className="flex-1 overflow-auto">
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/estimates" element={<EstimatesListPage />} />
          <Route path="/estimates/new" element={<NewEstimatePage />} />
          <Route path="/estimates/:id" element={<EstimateDetailPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          {isAdmin && (
            <>
              <Route path="/admin/users" element={<UsersPage />} />
              <Route path="/admin/settings" element={<AdminSettingsPage />} />
              <Route path="/admin/databank" element={<DatabankPage />} />
            </>
          )}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <SettingsProvider>
          <ToastProvider>
            <AppShell />
          </ToastProvider>
        </SettingsProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
