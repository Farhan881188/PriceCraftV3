import { useEffect, useState } from 'react';
import { Users, UserCheck, UserX, ShieldCheck } from 'lucide-react';
import { db } from '../../lib/database';
import { useToast } from '../../components/shared/Toast';
import { User, UserRole } from '../../types';

const ROLES: UserRole[] = ['admin', 'procurement_officer', 'estimator', 'viewer'];

const roleLabels: Record<UserRole, string> = {
  admin: 'Admin',
  procurement_officer: 'Procurement Officer',
  estimator: 'Estimator',
  viewer: 'Viewer',
};

export default function UsersPage() {
  const { showToast } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    db.users.getAll().then((data) => {
      setUsers(data);
      setLoading(false);
    });
  }, []);

  async function toggleActive(u: User) {
    try {
      const updated = await db.users.update(u.id, { is_active: !u.is_active });
      setUsers((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
      showToast('success', `User ${updated.is_active ? 'activated' : 'deactivated'}`);
    } catch {
      showToast('error', 'Failed to update user');
    }
  }

  async function changeRole(u: User, role: UserRole) {
    try {
      const updated = await db.users.update(u.id, { role });
      setUsers((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
      showToast('success', 'Role updated');
    } catch {
      showToast('error', 'Failed to update role');
    }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
        <p className="text-gray-500 mt-1 text-sm">Activate accounts and manage roles.</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400 text-sm">Loading users...</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-5 py-3 font-medium text-gray-600">Name</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Email</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Role</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="text-right px-5 py-3 font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center text-xs font-medium text-slate-600 uppercase">
                        {u.name?.charAt(0) ?? '?'}
                      </div>
                      <span className="font-medium text-gray-900">{u.name || '—'}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-gray-600">{u.email}</td>
                  <td className="px-4 py-3.5">
                    <select
                      value={u.role}
                      onChange={(e) => changeRole(u, e.target.value as UserRole)}
                      className="text-xs border border-gray-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>{roleLabels[r]}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${u.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                      {u.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <button
                      onClick={() => toggleActive(u)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                        u.is_active
                          ? 'text-red-700 bg-red-50 hover:bg-red-100'
                          : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
                      }`}
                    >
                      {u.is_active ? <UserX className="h-3.5 w-3.5" /> : <UserCheck className="h-3.5 w-3.5" />}
                      {u.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
