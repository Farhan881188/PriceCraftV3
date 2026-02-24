import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Plus,
  Lock,
  Unlock,
  ClipboardList,
  Clock,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { db } from '../lib/database';
import { useToast } from '../components/shared/Toast';
import { Estimate, BoQVersion, SowVersion } from '../types';
import BoQEditor from '../components/estimates/BoQEditor';
import { canManageEstimate, canCreateEstimate } from '../lib/permissions';

const statusColors: Record<string, string> = {
  Draft: 'bg-gray-100 text-gray-700',
  InReview: 'bg-amber-100 text-amber-700',
  Approved: 'bg-emerald-100 text-emerald-700',
  Final: 'bg-blue-100 text-blue-700',
  Archived: 'bg-slate-100 text-slate-600',
};

type Tab = 'boq' | 'sow' | 'audit';

export default function EstimateDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();

  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const [boqVersions, setBoqVersions] = useState<BoQVersion[]>([]);
  const [sowVersions, setSowVersions] = useState<SowVersion[]>([]);
  const [activeBoqVersion, setActiveBoqVersion] = useState<BoQVersion | null>(null);
  const [activeSowVersion, setActiveSowVersion] = useState<SowVersion | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('boq');
  const [rowCount, setRowCount] = useState(0);
  const [sowText, setSowText] = useState('');
  const [savingSow, setSavingSow] = useState(false);

  const isOwner = user?.id === estimate?.owner_user_id;
  const canManage = user ? canManageEstimate(user.role, isOwner) : false;
  const canCreate = user ? canCreateEstimate(user.role) : false;

  useEffect(() => {
    if (!id) return;
    loadData();
  }, [id]);

  async function loadData() {
    if (!id || !user) return;
    setLoading(true);
    try {
      const [est, boqVers, sowVers] = await Promise.all([
        db.estimates.getById(id),
        db.boqVersions.getByEstimateId(id),
        db.sowVersions.getByEstimateId(id),
      ]);

      if (!est) { navigate('/estimates'); return; }

      setEstimate(est);
      setBoqVersions(boqVers);
      setSowVersions(sowVers);

      if (boqVers.length > 0) setActiveBoqVersion(boqVers[0]);
      else {
        const newVer = await db.boqVersions.create({
          estimate_id: id,
          version_label: 'v1.0',
          created_by_user_id: user.id,
          is_frozen: false,
          based_on_boq_version_id: null,
        });
        setBoqVersions([newVer]);
        setActiveBoqVersion(newVer);
      }

      const currentSow = sowVers.find((s) => s.is_current) ?? sowVers[0];
      if (currentSow) {
        setActiveSowVersion(currentSow);
        setSowText(currentSow.sow_text);
      }
    } catch {
      showToast('error', 'Failed to load estimate');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateBoQVersion() {
    if (!estimate || !user) return;
    try {
      const label = `v${boqVersions.length + 1}.0`;
      const newVer = await db.boqVersions.create({
        estimate_id: estimate.id,
        version_label: label,
        created_by_user_id: user.id,
        is_frozen: false,
        based_on_boq_version_id: activeBoqVersion?.id ?? null,
      });
      setBoqVersions((prev) => [newVer, ...prev]);
      setActiveBoqVersion(newVer);
      showToast('success', `Created ${label}`);
    } catch {
      showToast('error', 'Failed to create new version');
    }
  }

  async function handleFreezeVersion() {
    if (!activeBoqVersion) return;
    try {
      const frozen = await db.boqVersions.freeze(activeBoqVersion.id);
      setBoqVersions((prev) => prev.map((v) => (v.id === frozen.id ? frozen : v)));
      setActiveBoqVersion(frozen);
      showToast('success', 'Version frozen');
    } catch {
      showToast('error', 'Failed to freeze version');
    }
  }

  async function handleSaveSow() {
    if (!estimate || !user) return;
    setSavingSow(true);
    try {
      if (activeSowVersion) {
        const updated = await db.sowVersions.update(activeSowVersion.id, { sow_text: sowText });
        setSowVersions((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
        setActiveSowVersion(updated);
      } else {
        const created = await db.sowVersions.create({
          estimate_id: estimate.id,
          version_label: 'v1.0',
          sow_text: sowText,
          created_by_user_id: user.id,
          is_current: true,
        });
        setSowVersions([created]);
        setActiveSowVersion(created);
      }
      showToast('success', 'Scope of work saved');
    } catch {
      showToast('error', 'Failed to save scope of work');
    } finally {
      setSavingSow(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400 text-sm">Loading estimate...</div>
      </div>
    );
  }

  if (!estimate) return null;

  const isFrozen = activeBoqVersion?.is_frozen ?? false;

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-4 bg-white border-b border-gray-200 shrink-0">
        <div className="flex items-center gap-4 mb-1">
          <button
            onClick={() => navigate('/estimates')}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl font-bold text-gray-900 truncate">{estimate.title}</h1>
              <span className={`px-2.5 py-1 text-xs font-medium rounded-full shrink-0 ${statusColors[estimate.status] || 'bg-gray-100 text-gray-700'}`}>
                {estimate.status}
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              {estimate.category || 'No category'} &bull; {estimate.location || 'No location'} &bull; {estimate.currency}
            </p>
          </div>
        </div>
      </div>

      <div className="px-6 pt-4 bg-gray-50 border-b border-gray-200 shrink-0">
        <div className="flex items-end gap-6">
          {(['boq', 'sow', 'audit'] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors capitalize ${
                activeTab === tab
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab === 'boq' ? 'Bill of Quantities' : tab === 'sow' ? 'Scope of Work' : 'Audit Log'}
              {tab === 'boq' && rowCount > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 text-[10px] bg-gray-200 text-gray-600 rounded font-medium">
                  {rowCount}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {activeTab === 'boq' && (
          <div>
            <div className="flex items-center gap-3 mb-4 flex-wrap">
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-gray-500">Version:</label>
                <select
                  value={activeBoqVersion?.id ?? ''}
                  onChange={(e) => {
                    const v = boqVersions.find((bv) => bv.id === e.target.value);
                    if (v) setActiveBoqVersion(v);
                  }}
                  className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {boqVersions.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.version_label}{v.is_frozen ? ' (Frozen)' : ''}
                    </option>
                  ))}
                </select>
              </div>
              {canCreate && !isFrozen && (
                <button
                  onClick={handleCreateBoQVersion}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  New Version
                </button>
              )}
              {canManage && !isFrozen && (
                <button
                  onClick={handleFreezeVersion}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors"
                >
                  <Lock className="h-3.5 w-3.5" />
                  Freeze Version
                </button>
              )}
              {isFrozen && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg">
                  <Lock className="h-3.5 w-3.5" />
                  Frozen
                </span>
              )}
            </div>

            {activeBoqVersion && (
              <BoQEditor
                estimate={estimate}
                versionId={activeBoqVersion.id}
                isFrozen={isFrozen}
                onRowCountChange={setRowCount}
              />
            )}
          </div>
        )}

        {activeTab === 'sow' && (
          <div className="max-w-3xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-gray-900">Scope of Work</h3>
              <button
                onClick={handleSaveSow}
                disabled={savingSow}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors"
              >
                {savingSow ? 'Saving...' : 'Save'}
              </button>
            </div>
            <textarea
              value={sowText}
              onChange={(e) => setSowText(e.target.value)}
              rows={20}
              placeholder="Enter the scope of work here..."
              className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y font-mono leading-relaxed"
            />
          </div>
        )}

        {activeTab === 'audit' && (
          <AuditLogTab estimateId={estimate.id} />
        )}
      </div>
    </div>
  );
}

function AuditLogTab({ estimateId }: { estimateId: string }) {
  const [logs, setLogs] = useState<{ id: string; action_type: string; entity_type: string; actor_user_id: string; created_at: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    db.auditLogs.getByEstimateId(estimateId).then((data) => {
      setLogs(data);
      setLoading(false);
    });
  }, [estimateId]);

  if (loading) return <div className="text-sm text-gray-400">Loading audit log...</div>;

  if (logs.length === 0) {
    return (
      <div className="text-center py-10">
        <ClipboardList className="h-8 w-8 text-gray-300 mx-auto mb-2" />
        <p className="text-gray-400 text-sm">No audit events yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-1 max-w-2xl">
      {logs.map((log) => (
        <div key={log.id} className="flex items-center gap-3 py-2.5 px-4 bg-white rounded-lg border border-gray-100 text-sm">
          <Clock className="h-3.5 w-3.5 text-gray-400 shrink-0" />
          <span className="flex-1 text-gray-700 font-mono text-xs">{log.action_type}</span>
          <span className="text-gray-400 text-xs">{new Date(log.created_at).toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
}
