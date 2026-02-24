import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { db } from '../lib/database';
import { useToast } from '../components/shared/Toast';

const CURRENCIES = ['MYR', 'USD', 'EUR', 'GBP', 'SGD', 'AUD'];
const ESTIMATE_CLASSES = ['Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5'];
const DURATION_UNITS = ['days', 'weeks', 'months', 'years'];

export default function NewEstimatePage() {
  const { user } = useAuth();
  const { settings, categoryNames } = useSettings();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [categoryOther, setCategoryOther] = useState('');
  const [location, setLocation] = useState(settings.defaultLocation);
  const [currency, setCurrency] = useState(settings.defaultCurrency);
  const [estimateClass, setEstimateClass] = useState('');
  const [timelineStart, setTimelineStart] = useState('');
  const [timelineEnd, setTimelineEnd] = useState('');
  const [durationValue, setDurationValue] = useState('');
  const [durationUnit, setDurationUnit] = useState('months');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    try {
      const est = await db.estimates.create({
        title,
        category: category === 'Other' ? '' : category,
        category_other: category === 'Other' ? categoryOther : null,
        location,
        currency,
        estimate_class: estimateClass,
        timeline_start: timelineStart || null,
        timeline_end: timelineEnd || null,
        duration_value: durationValue ? parseInt(durationValue) : null,
        duration_unit: durationValue ? durationUnit : null,
        owner_user_id: user.id,
        status: 'Draft',
        submitted_for_review_at: null,
        approved_by_user_id: null,
        approved_at: null,
      });

      await db.addonConfigs.upsert({
        estimate_id: est.id,
        prelims_pct: 10,
        contingency_pct: 5,
        profit_pct: 10,
        tax_pct: 6,
        rounding_rule: settings.roundingDecimals,
      });

      showToast('success', 'Estimate created successfully');
      navigate(`/estimates/${est.id}`);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to create estimate');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <button
        onClick={() => navigate('/estimates')}
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-5 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Estimates
      </button>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">New Estimate</h1>
        <p className="text-gray-500 mt-1 text-sm">Fill in the details to create a new estimate.</p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Title <span className="text-red-500">*</span></label>
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="e.g. Hospital Block C Renovation"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Select category...</option>
              {categoryNames.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
              <option value="Other">Other</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Location</label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="e.g. Kuala Lumpur"
            />
          </div>
        </div>

        {category === 'Other' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Specify Category</label>
            <input
              type="text"
              value={categoryOther}
              onChange={(e) => setCategoryOther(e.target.value)}
              className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Describe the category"
            />
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Currency</label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Estimate Class</label>
            <select
              value={estimateClass}
              onChange={(e) => setEstimateClass(e.target.value)}
              className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Select class...</option>
              {ESTIMATE_CLASSES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Duration</label>
            <div className="flex gap-2">
              <input
                type="number"
                min="1"
                value={durationValue}
                onChange={(e) => setDurationValue(e.target.value)}
                className="flex-1 px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g. 12"
              />
              <select
                value={durationUnit}
                onChange={(e) => setDurationUnit(e.target.value)}
                className="w-28 px-2.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {DURATION_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Timeline Start</label>
            <input
              type="date"
              value={timelineStart}
              onChange={(e) => setTimelineStart(e.target.value)}
              className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Timeline End</label>
            <input
              type="date"
              value={timelineEnd}
              onChange={(e) => setTimelineEnd(e.target.value)}
              className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        <div className="pt-2 flex items-center gap-3">
          <button
            type="submit"
            disabled={loading || !title.trim()}
            className="px-6 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Creating...' : 'Create Estimate'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/estimates')}
            className="px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
