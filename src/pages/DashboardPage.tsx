import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileText, TrendingUp, Clock, CheckCircle, Plus, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { db } from '../lib/database';
import { Estimate } from '../types';
import { canCreateEstimate } from '../lib/permissions';

export default function DashboardPage() {
  const { user } = useAuth();
  const [estimates, setEstimates] = useState<Estimate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    db.estimates.getAll().then((data) => {
      setEstimates(data);
      setLoading(false);
    });
  }, []);

  const stats = {
    total: estimates.length,
    draft: estimates.filter((e) => e.status === 'Draft').length,
    inReview: estimates.filter((e) => e.status === 'InReview').length,
    approved: estimates.filter((e) => e.status === 'Approved' || e.status === 'Final').length,
  };

  const recent = estimates.slice(0, 5);
  const canCreate = user ? canCreateEstimate(user.role) : false;

  const statusColors: Record<string, string> = {
    Draft: 'bg-gray-100 text-gray-700',
    InReview: 'bg-amber-100 text-amber-700',
    Approved: 'bg-emerald-100 text-emerald-700',
    Final: 'bg-blue-100 text-blue-700',
    Archived: 'bg-slate-100 text-slate-600',
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome back{user?.name ? `, ${user.name.split(' ')[0]}` : ''}
        </h1>
        <p className="text-gray-500 mt-1 text-sm">Here's an overview of your estimation work.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total Estimates', value: stats.total, icon: FileText, color: 'text-blue-600 bg-blue-50' },
          { label: 'In Draft', value: stats.draft, icon: Clock, color: 'text-gray-600 bg-gray-100' },
          { label: 'In Review', value: stats.inReview, icon: TrendingUp, color: 'text-amber-600 bg-amber-50' },
          { label: 'Approved', value: stats.approved, icon: CheckCircle, color: 'text-emerald-600 bg-emerald-50' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-gray-500">{label}</span>
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${color}`}>
                <Icon className="h-4.5 w-4.5" style={{ width: 18, height: 18 }} />
              </div>
            </div>
            <p className="text-3xl font-bold text-gray-900">{loading ? '—' : value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Recent Estimates</h2>
          <div className="flex items-center gap-3">
            {canCreate && (
              <Link
                to="/estimates/new"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                New Estimate
              </Link>
            )}
            <Link
              to="/estimates"
              className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              View all
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-400 text-sm">Loading...</div>
        ) : recent.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No estimates yet</p>
            {canCreate && (
              <Link
                to="/estimates/new"
                className="mt-3 inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                <Plus className="h-3.5 w-3.5" />
                Create your first estimate
              </Link>
            )}
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {recent.map((est) => (
              <Link
                key={est.id}
                to={`/estimates/${est.id}`}
                className="flex items-center gap-4 px-6 py-4 hover:bg-gray-50/50 transition-colors group"
              >
                <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                  <FileText className="h-4.5 w-4.5 text-blue-600" style={{ width: 18, height: 18 }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate group-hover:text-blue-600 transition-colors text-sm">
                    {est.title}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {est.category || 'No category'} &bull; {est.location || 'No location'}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${statusColors[est.status] || 'bg-gray-100 text-gray-700'}`}>
                    {est.status}
                  </span>
                  <span className="text-xs text-gray-400">
                    {new Date(est.updated_at).toLocaleDateString()}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
