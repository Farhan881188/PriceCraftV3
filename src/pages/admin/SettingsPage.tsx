import { useEffect, useState, FormEvent } from 'react';
import { Settings, Key, Save } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../lib/database';
import { useToast } from '../../components/shared/Toast';

export default function AdminSettingsPage() {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [openaiKey, setOpenaiKey] = useState('');
  const [roundingDecimals, setRoundingDecimals] = useState('2');
  const [defaultCurrency, setDefaultCurrency] = useState('MYR');
  const [defaultLocation, setDefaultLocation] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    try {
      const all = await db.adminSettings.getAll();
      for (const s of all) {
        if (s.key === 'openai_api_key') setOpenaiKey(typeof s.value === 'string' ? s.value : '');
        if (s.key === 'rounding_decimals') setRoundingDecimals(String(s.value ?? 2));
        if (s.key === 'default_currency') setDefaultCurrency(typeof s.value === 'string' ? s.value : 'MYR');
        if (s.key === 'default_location') setDefaultLocation(typeof s.value === 'string' ? s.value : '');
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    try {
      await Promise.all([
        db.adminSettings.set('openai_api_key', openaiKey, user.id),
        db.adminSettings.set('rounding_decimals', parseInt(roundingDecimals), user.id),
        db.adminSettings.set('default_currency', defaultCurrency, user.id),
        db.adminSettings.set('default_location', defaultLocation, user.id),
      ]);
      showToast('success', 'Settings saved');
    } catch {
      showToast('error', 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="p-6 text-sm text-gray-400">Loading settings...</div>;
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-500 mt-1 text-sm">Configure system-wide settings.</p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <Key className="h-4 w-4 text-gray-500" />
            <h2 className="text-sm font-semibold text-gray-900">AI Settings</h2>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">OpenAI API Key</label>
            <input
              type="password"
              value={openaiKey}
              onChange={(e) => setOpenaiKey(e.target.value)}
              className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              placeholder="sk-..."
            />
            <p className="mt-1.5 text-xs text-gray-400">Used for AI rate suggestions and BoQ generation.</p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <Settings className="h-4 w-4 text-gray-500" />
            <h2 className="text-sm font-semibold text-gray-900">Estimate Defaults</h2>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Rounding Decimals</label>
              <select
                value={roundingDecimals}
                onChange={(e) => setRoundingDecimals(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="0">0 decimal places</option>
                <option value="2">2 decimal places</option>
                <option value="4">4 decimal places</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Default Currency</label>
              <input
                type="text"
                value={defaultCurrency}
                onChange={(e) => setDefaultCurrency(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="MYR"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Default Location</label>
              <input
                type="text"
                value={defaultLocation}
                onChange={(e) => setDefaultLocation(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g. Kuala Lumpur"
              />
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors"
        >
          <Save className="h-4 w-4" />
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </form>
    </div>
  );
}
