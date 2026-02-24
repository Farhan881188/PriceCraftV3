import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Search, FileText, SlidersHorizontal } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { db } from '../lib/database';
import { Estimate, EstimateStatus } from '../types';
import { canCreateEstimate } from '../lib/permissions';

const STATUS_OPTIONS: EstimateStatus[] = ['Draft', 'InReview', 'Approved', 'Final', 'Archived'];

const statusColors: Record<string, string> = {
  Draft: 'bg-gray-100 text-gray-700',
  InReview: 'bg-amber-100 text-amber-700',
  Approved: 'bg-emerald-100 text-emerald-700',
  Final: 'bg-blue-100 text-blue-700',
  Archived: 'bg-slate-100 text-slate-600',
};

export default function EstimatesListPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [estimates, setEstimates] = useState<Estimate[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<EstimateStatus | ''>('');
  const canCreate = user ? canCreateEstimate(user.role) : false;

  useEffect(() => {
    db.estimates.getAll().then((data) => {
      setEstimates(data);
      setLoading(false);
    });
  }, []);

  const filtered = estimates.filter((e) => {
    const matchSearch =
      !search ||
      e.title.toLowerCase().includes(search.toLowerCase()) ||
      e.category.toLowerCase().includes(search.toLowerCase()) ||
      e.location.toLowerCase().includes(search.toLowerCase());
    const matchStatus = !statusFilter || e.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Estimates</h1>
          <p className="text-gray-500 mt-1 text-sm">{estimates.length} total</p>
        </div>
        {canCreate && (
          <Link
            to="/estimates/new"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
          >
            <Plus className="h-4 w-4" />
            New Estimate
          </Link>
        )}
      </div>

      <div className="flex items-center gap-3 mb-5">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search estimates..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-gray-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as EstimateStatus | '')}
            className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">All Statuses</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400 text-sm">Loading estimates...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">
              {search || statusFilter ? 'No estimates match your filters' : 'No estimates yet'}
            </p>
            {canCreate && !search && !statusFilter && (
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
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-5 py-3 font-medium text-gray-600">Title</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Category</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Location</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Currency</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="text-right px-5 py-3 font-medium text-gray-600">Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((est) => (
                <tr
                  key={est.id}
                  onClick={() => navigate(`/estimates/${est.id}`)}
                  className="hover:bg-gray-50/50 cursor-pointer transition-colors"
                >
                  <td className="px-5 py-3.5">
                    <span className="font-medium text-gray-900 hover:text-blue-600 transition-colors">
                      {est.title}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-gray-600">{est.category || '—'}</td>
                  <td className="px-4 py-3.5 text-gray-600">{est.location || '—'}</td>
                  <td className="px-4 py-3.5 text-gray-600 font-mono text-xs">{est.currency}</td>
                  <td className="px-4 py-3.5">
                    <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${statusColors[est.status] || 'bg-gray-100 text-gray-700'}`}>
                      {est.status}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right text-gray-400 text-xs">
                    {new Date(est.updated_at).toLocaleDateString()}
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
