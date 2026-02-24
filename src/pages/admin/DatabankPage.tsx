import { useEffect, useState, useRef } from 'react';
import { Database, Upload, Trash2, FileText, Image } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { db } from '../../lib/database';
import { useToast } from '../../components/shared/Toast';
import { HistoricalDatabank } from '../../types';
import ConfirmDialog from '../../components/shared/ConfirmDialog';

const PROJECT_TYPES = ['Civil', 'Mechanical', 'Electrical', 'Structural', 'Fit-Out', 'Other'];

export default function DatabankPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [records, setRecords] = useState<HistoricalDatabank[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadRecords();
  }, []);

  async function loadRecords() {
    const data = await db.historicalDatabank.getAll();
    setRecords(data);
    setLoading(false);
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    try {
      const path = `${user.id}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('historical-databank')
        .upload(path, file);
      if (uploadError) throw uploadError;

      const { data: inserted, error: insertError } = await supabase
        .from('historical_databank')
        .insert({
          file_name: file.name,
          file_path: path,
          file_size: file.size,
          mime_type: file.type,
          project_type: 'Other',
          is_active: true,
          uploaded_by: user.id,
          org_id: 'default',
        })
        .select()
        .single();
      if (insertError) throw insertError;

      setRecords((prev) => [inserted, ...prev]);
      showToast('success', 'File uploaded to databank');
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function handleDelete() {
    if (!deletingId) return;
    const record = records.find((r) => r.id === deletingId);
    if (!record) return;
    try {
      await supabase.storage.from('historical-databank').remove([record.file_path]);
      await db.historicalDatabank.delete(deletingId);
      setRecords((prev) => prev.filter((r) => r.id !== deletingId));
      showToast('success', 'File deleted');
    } catch {
      showToast('error', 'Failed to delete file');
    } finally {
      setDeletingId(null);
    }
  }

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Historical Databank</h1>
          <p className="text-gray-500 mt-1 text-sm">Upload historical rate files for AI-assisted pricing.</p>
        </div>
        <label className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors cursor-pointer ${uploading ? 'opacity-60 cursor-not-allowed' : ''}`}>
          <Upload className="h-4 w-4" />
          {uploading ? 'Uploading...' : 'Upload File'}
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.xlsx,.xls,.csv,.png,.jpg,.jpeg"
            onChange={handleUpload}
            disabled={uploading}
            className="hidden"
          />
        </label>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400 text-sm">Loading databank...</div>
        ) : records.length === 0 ? (
          <div className="p-12 text-center">
            <Database className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No files in databank</p>
            <p className="text-gray-400 text-sm mt-1">Upload historical rate files to enable AI rate suggestions.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-5 py-3 font-medium text-gray-600">File</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Project Type</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Size</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Uploaded</th>
                <th className="text-right px-5 py-3 font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {records.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2.5">
                      {r.mime_type?.startsWith('image/') ? (
                        <Image className="h-4 w-4 text-blue-500 shrink-0" />
                      ) : (
                        <FileText className="h-4 w-4 text-gray-400 shrink-0" />
                      )}
                      <span className="font-medium text-gray-900 truncate max-w-[200px]">{r.file_name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <select
                      value={r.project_type}
                      onChange={async (e) => {
                        const updated = await db.historicalDatabank.update(r.id, { project_type: e.target.value });
                        setRecords((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
                      }}
                      className="text-xs border border-gray-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {PROJECT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-3.5 text-gray-500 text-xs font-mono">{formatSize(r.file_size)}</td>
                  <td className="px-4 py-3.5">
                    <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${r.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>
                      {r.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-gray-400 text-xs">
                    {new Date(r.uploaded_at).toLocaleDateString()}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <button
                      onClick={() => setDeletingId(r.id)}
                      className="p-1.5 text-gray-400 hover:text-red-600 transition-colors rounded-md hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <ConfirmDialog
        isOpen={!!deletingId}
        onClose={() => setDeletingId(null)}
        onConfirm={handleDelete}
        title="Delete File"
        message="Are you sure you want to delete this file from the databank? This cannot be undone."
        confirmText="Delete"
        variant="danger"
      />
    </div>
  );
}
