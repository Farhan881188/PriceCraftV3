import { NavLink } from 'react-router-dom';
import {
  Calculator,
  LayoutDashboard,
  FileText,
  Settings,
  Users,
  Database,
  LogOut,
  Bell,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { canAccessAdmin } from '../../lib/permissions';

interface SidebarProps {
  unreadCount: number;
}

export default function Sidebar({ unreadCount }: SidebarProps) {
  const { user, signOut } = useAuth();
  const isAdmin = user ? canAccessAdmin(user.role) : false;

  const navItems = [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/estimates', icon: FileText, label: 'Estimates' },
    { to: '/notifications', icon: Bell, label: 'Notifications', badge: unreadCount },
  ];

  const adminItems = [
    { to: '/admin/users', icon: Users, label: 'Users' },
    { to: '/admin/settings', icon: Settings, label: 'Settings' },
    { to: '/admin/databank', icon: Database, label: 'Databank' },
  ];

  return (
    <aside className="w-60 bg-slate-900 flex flex-col min-h-screen shrink-0">
      <div className="px-5 py-5 border-b border-slate-700/50">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shrink-0">
            <Calculator className="h-4 w-4 text-white" />
          </div>
          <span className="text-white font-semibold text-base tracking-tight">PriceCraft</span>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto scrollbar-thin">
        {navItems.map(({ to, icon: Icon, label, badge }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group ${
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`
            }
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="flex-1">{label}</span>
            {badge !== undefined && badge > 0 && (
              <span className="flex items-center justify-center w-5 h-5 text-[10px] font-bold text-white bg-red-500 rounded-full">
                {badge > 99 ? '99+' : badge}
              </span>
            )}
          </NavLink>
        ))}

        {isAdmin && (
          <>
            <div className="px-3 pt-5 pb-1.5">
              <p className="text-[10px] uppercase tracking-widest font-semibold text-slate-600">
                Admin
              </p>
            </div>
            {adminItems.map(({ to, icon: Icon, label }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`
                }
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="flex-1">{label}</span>
                <ChevronRight className="h-3 w-3 opacity-0 group-hover:opacity-50 transition-opacity" />
              </NavLink>
            ))}
          </>
        )}
      </nav>

      <div className="px-3 py-4 border-t border-slate-700/50">
        <div className="flex items-center gap-3 px-3 py-2 mb-1">
          <div className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center text-xs font-medium text-slate-300 uppercase shrink-0">
            {user?.name?.charAt(0) ?? '?'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{user?.name ?? 'User'}</p>
            <p className="text-xs text-slate-500 capitalize">{user?.role?.replace('_', ' ')}</p>
          </div>
        </div>
        <button
          onClick={signOut}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
