import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Plus,
  Trash2,
  Copy,
  ChevronUp,
  ChevronDown,
  MessageSquare,
  LayoutList,
  Check,
  X,
  CheckCheck,
  Sparkles,
  Wand2,
  BookOpen,
  RotateCcw,
  Send,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../context/SettingsContext';
import { useToast } from '../shared/Toast';
import { db, calculateAmount, calculateSubtotals } from '../../lib/database';
import { canEditBoQRow, canAcceptAIRun } from '../../lib/permissions';
import { BoQRow, Estimate } from '../../types';
import ConfirmDialog from '../shared/ConfirmDialog';
import { suggestRates, RateSuggestion } from '../../lib/ai-service';
import { lookupHistoricalRate, HistoricalRateLookupResult } from '../../lib/historicalData';

interface BoQEditorProps {
  estimate: Estimate;
  versionId: string;
  isFrozen: boolean;
  onRowCountChange?: (count: number) => void;
  onOpenComments?: (rowId: string) => void;
  commentCounts?: Record<string, number>;
}

interface EditingCell {
  rowId: string;
  field: string;
}

export default function BoQEditor({
  estimate,
  versionId,
  isFrozen,
  onRowCountChange,
  onOpenComments,
  commentCounts = {},
}: BoQEditorProps) {
  const { user } = useAuth();
  const { settings, categoryNames, uomCodes } = useSettings();
  const { showToast } = useToast();

  const [rows, setRows] = useState<BoQRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const [editValue, setEditValue] = useState('');
  const [deletingRowId, setDeletingRowId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(null);
  const [pendingSuggestions, setPendingSuggestions] = useState<Record<string, RateSuggestion>>({});
  const [suggestingRowId, setSuggestingRowId] = useState<string | null>(null);
  const [acceptedAiRates, setAcceptedAiRates] = useState<Set<string>>(new Set());
  const [lookingUpRowId, setLookingUpRowId] = useState<string | null>(null);
  const [pendingLookups, setPendingLookups] = useState<Record<string, HistoricalRateLookupResult>>({});
  const [repromptRowId, setRepromptRowId] = useState<string | null>(null);
  const [repromptText, setRepromptText] = useState<Record<string, string>>({});

  const isOwner = user?.id === estimate.owner_user_id;
  const canEdit = user && canEditBoQRow(user.role, isOwner) && !isFrozen;
  const canAcceptReject = user && canAcceptAIRun(user.role, isOwner) && !isFrozen;

  const subtotals = calculateSubtotals(rows, settings.roundingDecimals);
  const draftRows = rows.filter((r) => r.row_status === 'AIDraft' && r.row_type === 'LineItem');
  const hasDrafts = draftRows.length > 0;
  const draftSections = [...new Set(draftRows.map((r) => r.section).filter(Boolean))];

  useEffect(() => {
    loadRows();
  }, [versionId]);

  useEffect(() => {
    if (editingCell && inputRef.current) {
      inputRef.current.focus();
      if (inputRef.current instanceof HTMLInputElement) {
        inputRef.current.select();
      }
    }
  }, [editingCell]);

  const loadRows = async () => {
    setLoading(true);
    try {
      const data = await db.boqRows.getByVersionId(versionId);
      setRows(data);
      onRowCountChange?.(data.length);
    } catch {
      showToast('error', 'Failed to load BoQ rows');
    } finally {
      setLoading(false);
    }
  };

  const handleAddRow = async (type: 'LineItem' | 'SectionHeader') => {
    if (!canEdit) return;
    try {
      const maxSort = rows.length > 0 ? Math.max(...rows.map((r) => r.sort_order)) + 1 : 0;
      const newRow = await db.boqRows.create({
        boq_version_id: versionId,
        row_type: type,
        item_no: '',
        section: type === 'SectionHeader' ? `Section ${Object.keys(subtotals.bySection).length + 1}` : '',
        description: type === 'SectionHeader' ? 'New Section' : '',
        uom: type === 'LineItem' ? (uomCodes[0] || 'LS') : '',
        qty: type === 'LineItem' ? 1 : null,
        rate: type === 'LineItem' ? 0 : null,
        amount: null,
        measurement: '',
        assumptions: '',
        category: type === 'LineItem' ? (categoryNames[1] || categoryNames[0] || 'Labour') : '',
        row_status: 'Final',
        sort_order: maxSort,
        external_key: null,
      });
      const updated = [...rows, newRow];
      setRows(updated);
      onRowCountChange?.(updated.length);
    } catch {
      showToast('error', 'Failed to add row');
    }
  };

  const handleDuplicateRow = async (row: BoQRow) => {
    if (!canEdit) return;
    try {
      const idx = rows.findIndex((r) => r.id === row.id);
      const newSort = row.sort_order + 0.5;
      const { id, created_at, updated_at, ...rowData } = row;
      const newRow = await db.boqRows.create({
        ...rowData,
        sort_order: newSort,
        description: `${row.description} (copy)`,
      });
      const updated = [...rows];
      updated.splice(idx + 1, 0, newRow);
      setRows(updated);
      onRowCountChange?.(updated.length);
      reorderRows(updated.map((r) => r.id));
    } catch {
      showToast('error', 'Failed to duplicate row');
    }
  };

  const handleDeleteRow = async () => {
    if (!deletingRowId) return;
    try {
      await db.boqRows.delete(deletingRowId);
      const updated = rows.filter((r) => r.id !== deletingRowId);
      setRows(updated);
      onRowCountChange?.(updated.length);
      setDeletingRowId(null);
    } catch {
      showToast('error', 'Failed to delete row');
    }
  };

  const handleMoveRow = async (rowId: string, direction: 'up' | 'down') => {
    const idx = rows.findIndex((r) => r.id === rowId);
    if (direction === 'up' && idx === 0) return;
    if (direction === 'down' && idx === rows.length - 1) return;

    const updated = [...rows];
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    [updated[idx], updated[swapIdx]] = [updated[swapIdx], updated[idx]];
    setRows(updated);
    reorderRows(updated.map((r) => r.id));
  };

  const reorderRows = useCallback(
    async (rowIds: string[]) => {
      try {
        await db.boqRows.reorder(versionId, rowIds);
      } catch {
        showToast('error', 'Failed to reorder rows');
      }
    },
    [versionId, showToast]
  );

  const handleAcceptRow = async (rowId: string) => {
    if (!user) return;
    try {
      const updated = await db.boqRows.update(rowId, { row_status: 'Final' });
      setRows((prev) => prev.map((r) => (r.id === rowId ? updated : r)));
      await db.auditLogs.create({
        estimate_id: estimate.id,
        actor_user_id: user.id,
        action_type: 'ai_accept_row',
        entity_type: 'boq_row',
        entity_id: rowId,
        before_snapshot: { row_status: 'AIDraft' },
        after_snapshot: { row_status: 'Final' },
      });
    } catch {
      showToast('error', 'Failed to accept row');
    }
  };

  const handleRejectRow = async (rowId: string) => {
    if (!user) return;
    try {
      await db.boqRows.delete(rowId);
      const updated = rows.filter((r) => r.id !== rowId);
      setRows(updated);
      onRowCountChange?.(updated.length);
      await db.auditLogs.create({
        estimate_id: estimate.id,
        actor_user_id: user.id,
        action_type: 'ai_reject_row',
        entity_type: 'boq_row',
        entity_id: rowId,
        before_snapshot: { row_status: 'AIDraft' },
        after_snapshot: null,
      });
    } catch {
      showToast('error', 'Failed to reject row');
    }
  };

  const handleBulkAccept = async (targetSection?: string) => {
    if (!user) return;
    const targets = rows.filter(
      (r) => r.row_status === 'AIDraft' && (!targetSection || r.section === targetSection)
    );
    if (targets.length === 0) return;

    try {
      const ids = targets.map((r) => r.id);
      await db.boqRows.bulkUpdateStatus(ids, 'Final');
      setRows((prev) =>
        prev.map((r) =>
          ids.includes(r.id) ? { ...r, row_status: 'Final' as const } : r
        )
      );
      await db.auditLogs.create({
        estimate_id: estimate.id,
        actor_user_id: user.id,
        action_type: 'ai_accept_bulk',
        entity_type: 'boq_version',
        entity_id: versionId,
        before_snapshot: { count: ids.length, section: targetSection || 'all' },
        after_snapshot: { row_status: 'Final' },
      });
      showToast('success', `Accepted ${ids.length} draft rows`);
    } catch {
      showToast('error', 'Failed to accept rows');
    }
  };

  const handleBulkReject = async () => {
    if (!user) return;
    const targets = rows.filter((r) => r.row_status === 'AIDraft');
    if (targets.length === 0) return;

    try {
      const ids = targets.map((r) => r.id);
      await db.boqRows.bulkDelete(ids);
      const updated = rows.filter((r) => !ids.includes(r.id));
      setRows(updated);
      onRowCountChange?.(updated.length);
      await db.auditLogs.create({
        estimate_id: estimate.id,
        actor_user_id: user.id,
        action_type: 'ai_reject_bulk',
        entity_type: 'boq_version',
        entity_id: versionId,
        before_snapshot: { count: ids.length },
        after_snapshot: null,
      });
      showToast('success', `Rejected ${ids.length} draft rows`);
    } catch {
      showToast('error', 'Failed to reject rows');
    }
  };

  const handleSuggestRate = async (row: BoQRow, userPrompt?: string) => {
    setSuggestingRowId(row.id);
    setRepromptRowId(null);
    try {
      const result = await suggestRates(
        [{ rowId: row.id, description: row.description, uom: row.uom, category: row.category, qty: row.qty }],
        { title: estimate.title, category: estimate.category, location: estimate.location, currency: estimate.currency },
        userPrompt
      );
      if (result.suggestions.length > 0) {
        const suggestion = result.suggestions[0];
        if (suggestion.suggestedRate !== null) {
          setPendingSuggestions((prev) => ({ ...prev, [row.id]: suggestion }));
        } else {
          showToast('error', 'AI could not suggest a rate for this item');
        }
      }
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to get rate suggestion');
    } finally {
      setSuggestingRowId(null);
    }
  };

  const handleAcceptSuggestion = async (rowId: string) => {
    const suggestion = pendingSuggestions[rowId];
    if (!suggestion || suggestion.suggestedRate === null) return;
    const row = rows.find((r) => r.id === rowId);
    if (!row) return;
    const newAmount = calculateAmount(row.qty, suggestion.suggestedRate, settings.roundingDecimals);
    try {
      const updated = await db.boqRows.update(rowId, { rate: suggestion.suggestedRate, amount: newAmount });
      setRows((prev) => prev.map((r) => (r.id === rowId ? updated : r)));
      setPendingSuggestions((prev) => { const next = { ...prev }; delete next[rowId]; return next; });
      setAcceptedAiRates((prev) => new Set(prev).add(rowId));
    } catch {
      showToast('error', 'Failed to apply rate');
    }
  };

  const handleDismissSuggestion = (rowId: string) => {
    setPendingSuggestions((prev) => { const next = { ...prev }; delete next[rowId]; return next; });
    setRepromptRowId(null);
    setRepromptText((prev) => { const next = { ...prev }; delete next[rowId]; return next; });
  };

  const handleLookupHistoricalRate = async (row: BoQRow) => {
    setLookingUpRowId(row.id);
    try {
      const result = await lookupHistoricalRate(row.description, row.uom, row.category);
      if (result.success && result.result) {
        setPendingLookups((prev) => ({ ...prev, [row.id]: result.result! }));
      } else {
        showToast('error', result.error || 'Lookup failed');
      }
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to lookup rate');
    } finally {
      setLookingUpRowId(null);
    }
  };

  const handleAcceptLookup = async (rowId: string) => {
    const lookup = pendingLookups[rowId];
    if (!lookup || lookup.rate === null) return;
    const row = rows.find((r) => r.id === rowId);
    if (!row) return;
    const newAmount = calculateAmount(row.qty, lookup.rate, settings.roundingDecimals);
    try {
      const updated = await db.boqRows.update(rowId, { rate: lookup.rate, amount: newAmount });
      setRows((prev) => prev.map((r) => (r.id === rowId ? updated : r)));
      setPendingLookups((prev) => { const next = { ...prev }; delete next[rowId]; return next; });
      setAcceptedAiRates((prev) => new Set(prev).add(rowId));
    } catch {
      showToast('error', 'Failed to apply rate');
    }
  };

  const handleDismissLookup = (rowId: string) => {
    setPendingLookups((prev) => { const next = { ...prev }; delete next[rowId]; return next; });
  };

  const startEdit = (rowId: string, field: string, currentValue: string | number | null) => {
    if (!canEdit) return;
    setEditingCell({ rowId, field });
    setEditValue(currentValue?.toString() ?? '');
  };

  const commitEdit = async () => {
    if (!editingCell) return;
    const { rowId, field } = editingCell;
    const row = rows.find((r) => r.id === rowId);
    if (!row) return;

    let updatePayload: Partial<BoQRow> = {};
    const numericFields = ['qty', 'rate'];

    if (numericFields.includes(field)) {
      const num = editValue === '' ? null : parseFloat(editValue);
      updatePayload[field as 'qty' | 'rate'] = num as number | null;

      const newQty = field === 'qty' ? num : row.qty;
      const newRate = field === 'rate' ? num : row.rate;
      updatePayload.amount = calculateAmount(newQty, newRate, settings.roundingDecimals);
    } else {
      (updatePayload as Record<string, string>) [field] = editValue;
    }

    try {
      const updated = await db.boqRows.update(rowId, updatePayload);
      setRows((prev) => prev.map((r) => (r.id === rowId ? updated : r)));
    } catch {
      showToast('error', 'Failed to update cell');
    }

    setEditingCell(null);
    setEditValue('');
  };

  const cancelEdit = () => {
    setEditingCell(null);
    setEditValue('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitEdit();
    } else if (e.key === 'Escape') {
      cancelEdit();
    } else if (e.key === 'Tab') {
      e.preventDefault();
      commitEdit();
    }
  };

  const generateItemNo = (index: number, row: BoQRow) => {
    if (row.row_type === 'SectionHeader') return '';
    let sectionCount = 0;
    let itemInSection = 0;
    for (let i = 0; i <= index; i++) {
      if (rows[i].row_type === 'SectionHeader') {
        sectionCount++;
        itemInSection = 0;
      } else {
        itemInSection++;
      }
    }
    return sectionCount > 0 ? `${sectionCount}.${itemInSection}` : `${itemInSection}`;
  };

  const formatCurrency = (amount: number | null) => {
    if (amount === null) return '-';
    return amount.toLocaleString('en-US', {
      minimumFractionDigits: settings.roundingDecimals,
      maximumFractionDigits: settings.roundingDecimals,
    });
  };

  const renderCell = (row: BoQRow, field: string, value: string | number | null, isDropdown = false, options: string[] = []) => {
    const isEditing = editingCell?.rowId === row.id && editingCell?.field === field;

    if (isEditing && isDropdown) {
      return (
        <select
          ref={inputRef as React.RefObject<HTMLSelectElement>}
          value={editValue}
          onChange={(e) => {
            setEditValue(e.target.value);
            setTimeout(() => commitEdit(), 0);
          }}
          onBlur={commitEdit}
          onKeyDown={handleKeyDown}
          className="w-full px-1.5 py-0.5 text-sm border border-blue-400 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
        >
          {options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      );
    }

    if (isEditing) {
      return (
        <input
          ref={inputRef as React.RefObject<HTMLInputElement>}
          type={typeof value === 'number' ? 'number' : 'text'}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={handleKeyDown}
          step={typeof value === 'number' ? 'any' : undefined}
          className="w-full px-1.5 py-0.5 text-sm border border-blue-400 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      );
    }

    const displayValue = value === null || value === '' ? '-' : value.toString();
    return (
      <span
        onClick={() => canEdit && startEdit(row.id, field, value)}
        className={`block truncate px-1.5 py-0.5 rounded text-sm ${
          canEdit ? 'cursor-pointer hover:bg-blue-50 transition-colors' : ''
        }`}
        title={displayValue}
      >
        {displayValue}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="text-gray-500">Loading rows...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {isFrozen && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-md">
          <span className="text-sm font-medium text-amber-800">
            This version is frozen. No edits are allowed.
          </span>
        </div>
      )}

      {hasDrafts && canAcceptReject && (
        <div className="flex items-center justify-between gap-3 px-4 py-3 bg-teal-50 border border-teal-200 rounded-lg">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-teal-600" />
            <span className="text-sm font-medium text-teal-900">
              {draftRows.length} AI Draft {draftRows.length === 1 ? 'row' : 'rows'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {draftSections.length > 1 && (
              <select
                onChange={(e) => {
                  if (e.target.value) handleBulkAccept(e.target.value);
                  e.target.value = '';
                }}
                defaultValue=""
                className="text-xs px-2 py-1.5 border border-teal-300 rounded-md bg-white text-teal-800 focus:outline-none focus:ring-1 focus:ring-teal-500"
              >
                <option value="" disabled>Accept Section...</option>
                {draftSections.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            )}
            <button
              onClick={() => handleBulkAccept()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-emerald-600 rounded-md hover:bg-emerald-700 transition-colors"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              Accept All
            </button>
            <button
              onClick={handleBulkReject}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-700 bg-white border border-red-300 rounded-md hover:bg-red-50 transition-colors"
            >
              <X className="h-3.5 w-3.5" />
              Reject All
            </button>
          </div>
        </div>
      )}

      {canEdit && (
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleAddRow('LineItem')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Line Item
          </button>
          <button
            onClick={() => handleAddRow('SectionHeader')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
          >
            <LayoutList className="h-3.5 w-3.5" />
            Add Section
          </button>
        </div>
      )}

      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-3 py-2.5 font-medium text-gray-600 w-16">#</th>
                <th className="text-left px-3 py-2.5 font-medium text-gray-600 w-48">Description</th>
                <th className="text-left px-3 py-2.5 font-medium text-gray-600 w-20">UOM</th>
                <th className="text-right px-3 py-2.5 font-medium text-gray-600 w-24">Qty</th>
                <th className="text-right px-3 py-2.5 font-medium text-gray-600 w-28">Rate</th>
                <th className="text-right px-3 py-2.5 font-medium text-gray-600 w-32">Amount</th>
                <th className="text-left px-3 py-2.5 font-medium text-gray-600 w-24">Category</th>
                <th className="text-left px-3 py-2.5 font-medium text-gray-600 w-32">Measurement</th>
                <th className="text-left px-3 py-2.5 font-medium text-gray-600 w-32">Assumptions</th>
                {(canEdit || canAcceptReject || Object.keys(commentCounts).length > 0) && (
                  <th className="text-center px-3 py-2.5 font-medium text-gray-600 w-36">Actions</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center py-12 text-gray-500">
                    No rows yet. Add a section header or line item to get started.
                  </td>
                </tr>
              ) : (
                rows.map((row, index) => {
                  if (row.row_type === 'SectionHeader') {
                    return (
                      <tr key={row.id} className="bg-slate-100">
                        <td className="px-3 py-2.5 font-semibold text-gray-900 text-xs uppercase tracking-wide" colSpan={canEdit || Object.keys(commentCounts).length > 0 ? 9 : 9}>
                          <div className="flex items-center gap-2">
                            {renderCell(row, 'description', row.description)}
                          </div>
                        </td>
                        {(canEdit || Object.keys(commentCounts).length > 0) && (
                          <td className="px-3 py-2.5 text-center">
                            <div className="flex items-center justify-center gap-1">
                              {canEdit && (
                                <>
                                  <button
                                    onClick={() => handleMoveRow(row.id, 'up')}
                                    disabled={index === 0}
                                    className="p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-30 transition-colors"
                                    title="Move up"
                                  >
                                    <ChevronUp className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleMoveRow(row.id, 'down')}
                                    disabled={index === rows.length - 1}
                                    className="p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-30 transition-colors"
                                    title="Move down"
                                  >
                                    <ChevronDown className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    onClick={() => setDeletingRowId(row.id)}
                                    className="p-0.5 text-gray-400 hover:text-red-600 transition-colors"
                                    title="Delete"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  }

                  const sectionKey = row.section;
                  const isLastInSection =
                    index === rows.length - 1 ||
                    rows[index + 1]?.row_type === 'SectionHeader';

                  return (
                    <>
                      <tr
                        key={row.id}
                        className={`hover:bg-gray-50/50 transition-colors ${
                          row.row_status === 'AIDraft' ? 'bg-teal-50/30' : ''
                        }`}
                      >
                        <td className="px-3 py-2 text-gray-500 font-mono text-xs">
                          <div className="flex items-center gap-1">
                            <span>{generateItemNo(index, row)}</span>
                            {row.row_status === 'AIDraft' && (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-semibold bg-teal-100 text-teal-700 rounded border border-teal-200">
                                <Sparkles className="h-2.5 w-2.5" />
                                Draft
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2 max-w-[200px]">
                          {renderCell(row, 'description', row.description)}
                        </td>
                        <td className="px-3 py-2">
                          {renderCell(row, 'uom', row.uom, true, uomCodes)}
                        </td>
                        <td className="px-3 py-2 text-right font-mono">
                          {renderCell(row, 'qty', row.qty)}
                        </td>
                        <td className="px-3 py-2 text-right font-mono">
                          {(() => {
                            const suggestion = pendingSuggestions[row.id];
                            const lookup = pendingLookups[row.id];
                            const isSuggesting = suggestingRowId === row.id;
                            const isLookingUp = lookingUpRowId === row.id;
                            const isAiRate = acceptedAiRates.has(row.id);

                            if (lookup) {
                              return (
                                <div className="flex flex-col items-end gap-1 min-w-[130px]">
                                  {lookup.found && lookup.rate !== null ? (
                                    <>
                                      <div className="flex items-center gap-1">
                                        <span className="inline-flex items-center gap-0.5 px-1 py-0.5 text-[9px] font-semibold bg-blue-100 text-blue-700 rounded border border-blue-200">
                                          <BookOpen className="h-2 w-2" />
                                          Historical
                                        </span>
                                        <span className="text-sm font-mono text-blue-800 font-semibold">
                                          {lookup.rate.toLocaleString('en-US', { minimumFractionDigits: settings.roundingDecimals, maximumFractionDigits: settings.roundingDecimals })}
                                        </span>
                                      </div>
                                      <div className="text-[10px] text-gray-500 truncate max-w-[130px]" title={lookup.excerpt}>
                                        {lookup.source}
                                      </div>
                                      <div className="flex items-center gap-1">
                                        <button
                                          onClick={() => handleAcceptLookup(row.id)}
                                          className="px-1.5 py-0.5 text-[10px] font-medium text-white bg-blue-600 rounded hover:bg-blue-700 transition-colors"
                                          title={lookup.excerpt}
                                        >
                                          Accept
                                        </button>
                                        <button
                                          onClick={() => handleDismissLookup(row.id)}
                                          className="px-1.5 py-0.5 text-[10px] font-medium text-gray-600 bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors"
                                        >
                                          Dismiss
                                        </button>
                                      </div>
                                    </>
                                  ) : (
                                    <div className="flex flex-col items-end gap-1">
                                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-medium text-orange-700 bg-orange-50 rounded border border-orange-200">
                                        Not found in historical databank
                                      </span>
                                      <button
                                        onClick={() => handleDismissLookup(row.id)}
                                        className="px-1.5 py-0.5 text-[10px] font-medium text-gray-600 bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors"
                                      >
                                        Dismiss
                                      </button>
                                    </div>
                                  )}
                                </div>
                              );
                            }

                            if (suggestion) {
                              const isReprompting = repromptRowId === row.id;
                              const isRefining = suggestingRowId === row.id;
                              return (
                                <div className="flex flex-col items-end gap-1 min-w-[140px]">
                                  <div className="flex items-center gap-1">
                                    <span className="inline-flex items-center gap-0.5 px-1 py-0.5 text-[9px] font-semibold bg-amber-100 text-amber-700 rounded border border-amber-200">
                                      <Sparkles className="h-2 w-2" />
                                      AI
                                    </span>
                                    <span className="text-sm font-mono text-amber-800 font-semibold">
                                      {suggestion.suggestedRate?.toLocaleString('en-US', { minimumFractionDigits: settings.roundingDecimals, maximumFractionDigits: settings.roundingDecimals })}
                                    </span>
                                  </div>
                                  <div className="text-[10px] text-gray-500 truncate max-w-[140px]" title={suggestion.reasoning}>
                                    {suggestion.source}
                                  </div>
                                  {isReprompting && (
                                    <div className="w-full flex items-center gap-1 mt-0.5">
                                      <input
                                        type="text"
                                        autoFocus
                                        value={repromptText[row.id] ?? ''}
                                        onChange={(e) => setRepromptText((prev) => ({ ...prev, [row.id]: e.target.value }))}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') {
                                            const prompt = repromptText[row.id]?.trim();
                                            if (prompt) handleSuggestRate(row, prompt);
                                          }
                                          if (e.key === 'Escape') setRepromptRowId(null);
                                        }}
                                        placeholder="e.g. use 2024 rates"
                                        className="flex-1 min-w-0 px-1.5 py-0.5 text-[10px] border border-amber-300 rounded bg-amber-50 focus:outline-none focus:ring-1 focus:ring-amber-400 placeholder-gray-400"
                                        disabled={isRefining}
                                      />
                                      <button
                                        onClick={() => {
                                          const prompt = repromptText[row.id]?.trim();
                                          if (prompt) handleSuggestRate(row, prompt);
                                        }}
                                        disabled={isRefining || !repromptText[row.id]?.trim()}
                                        className="p-0.5 text-amber-600 hover:text-amber-700 disabled:opacity-40 transition-colors"
                                        title="Send prompt"
                                      >
                                        {isRefining
                                          ? <span className="inline-block h-3 w-3 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                                          : <Send className="h-3 w-3" />
                                        }
                                      </button>
                                    </div>
                                  )}
                                  <div className="flex items-center gap-1">
                                    <button
                                      onClick={() => handleAcceptSuggestion(row.id)}
                                      className="px-1.5 py-0.5 text-[10px] font-medium text-white bg-emerald-600 rounded hover:bg-emerald-700 transition-colors"
                                      title={suggestion.reasoning}
                                    >
                                      Accept
                                    </button>
                                    <button
                                      onClick={() => setRepromptRowId(isReprompting ? null : row.id)}
                                      className={`px-1.5 py-0.5 text-[10px] font-medium rounded transition-colors ${isReprompting ? 'text-amber-700 bg-amber-100 border border-amber-300' : 'text-amber-600 bg-white border border-amber-300 hover:bg-amber-50'}`}
                                      title="Refine with a prompt"
                                    >
                                      <RotateCcw className="h-2.5 w-2.5" />
                                    </button>
                                    <button
                                      onClick={() => handleDismissSuggestion(row.id)}
                                      className="px-1.5 py-0.5 text-[10px] font-medium text-gray-600 bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors"
                                    >
                                      Dismiss
                                    </button>
                                  </div>
                                </div>
                              );
                            }

                            return (
                              <div className="flex items-center justify-end gap-1">
                                {row.rate !== null && isAiRate && (
                                  <span className="inline-flex items-center gap-0.5 px-1 py-0.5 text-[9px] font-semibold bg-teal-100 text-teal-700 rounded border border-teal-200" title="Rate suggested by AI">
                                    <Sparkles className="h-2 w-2" />
                                    AI
                                  </span>
                                )}
                                <div className="flex-1">
                                  {renderCell(row, 'rate', row.rate)}
                                </div>
                                {canEdit && !isFrozen && (
                                  <>
                                    <button
                                      onClick={() => handleLookupHistoricalRate(row)}
                                      disabled={isLookingUp}
                                      className="p-0.5 text-gray-300 hover:text-blue-500 transition-colors disabled:opacity-50"
                                      title="Lookup rate from Historical Databank"
                                    >
                                      {isLookingUp
                                        ? <span className="inline-block h-3 w-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                                        : <BookOpen className="h-3 w-3" />
                                      }
                                    </button>
                                    <button
                                      onClick={() => handleSuggestRate(row)}
                                      disabled={isSuggesting}
                                      className="p-0.5 text-gray-300 hover:text-amber-500 transition-colors disabled:opacity-50"
                                      title="Suggest rate with AI"
                                    >
                                      {isSuggesting
                                        ? <span className="inline-block h-3 w-3 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                                        : <Wand2 className="h-3 w-3" />
                                      }
                                    </button>
                                  </>
                                )}
                              </div>
                            );
                          })()}
                        </td>
                        <td className="px-3 py-2 text-right font-mono font-medium text-gray-900">
                          {formatCurrency(row.amount)}
                        </td>
                        <td className="px-3 py-2">
                          {renderCell(row, 'category', row.category, true, categoryNames)}
                        </td>
                        <td className="px-3 py-2 max-w-[150px]">
                          {renderCell(row, 'measurement', row.measurement)}
                        </td>
                        <td className="px-3 py-2 max-w-[150px]">
                          {renderCell(row, 'assumptions', row.assumptions)}
                        </td>
                        {(canEdit || canAcceptReject || Object.keys(commentCounts).length > 0) && (
                          <td className="px-3 py-2 text-center">
                            <div className="flex items-center justify-center gap-1">
                              {row.row_status === 'AIDraft' && canAcceptReject && (
                                <>
                                  <button
                                    onClick={() => handleAcceptRow(row.id)}
                                    className="p-0.5 text-emerald-500 hover:text-emerald-700 transition-colors"
                                    title="Accept row"
                                  >
                                    <Check className="h-4 w-4" />
                                  </button>
                                  <button
                                    onClick={() => handleRejectRow(row.id)}
                                    className="p-0.5 text-red-400 hover:text-red-600 transition-colors"
                                    title="Reject row"
                                  >
                                    <X className="h-4 w-4" />
                                  </button>
                                  <span className="w-px h-4 bg-gray-200 mx-0.5" />
                                </>
                              )}
                              {onOpenComments && (
                                <button
                                  onClick={() => onOpenComments(row.id)}
                                  className="relative p-0.5 text-gray-400 hover:text-blue-600 transition-colors"
                                  title="Comments"
                                >
                                  <MessageSquare className="h-3.5 w-3.5" />
                                  {(commentCounts[row.id] || 0) > 0 && (
                                    <span className="absolute -top-1 -right-1 flex items-center justify-center w-3.5 h-3.5 text-[9px] font-bold text-white bg-blue-600 rounded-full">
                                      {commentCounts[row.id]}
                                    </span>
                                  )}
                                </button>
                              )}
                              {canEdit && (
                                <>
                                  <button
                                    onClick={() => handleMoveRow(row.id, 'up')}
                                    disabled={index === 0}
                                    className="p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-30 transition-colors"
                                    title="Move up"
                                  >
                                    <ChevronUp className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleMoveRow(row.id, 'down')}
                                    disabled={index === rows.length - 1}
                                    className="p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-30 transition-colors"
                                    title="Move down"
                                  >
                                    <ChevronDown className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleDuplicateRow(row)}
                                    className="p-0.5 text-gray-400 hover:text-gray-600 transition-colors"
                                    title="Duplicate"
                                  >
                                    <Copy className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    onClick={() => setDeletingRowId(row.id)}
                                    className="p-0.5 text-gray-400 hover:text-red-600 transition-colors"
                                    title="Delete"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                      {isLastInSection && sectionKey && subtotals.bySection[sectionKey] !== undefined && (
                        <tr key={`subtotal-${row.id}`} className="bg-gray-50/70 border-t border-gray-200">
                          <td colSpan={5} className="px-3 py-1.5 text-right text-xs font-medium text-gray-500 uppercase tracking-wide">
                            Section Subtotal ({sectionKey})
                          </td>
                          <td className="px-3 py-1.5 text-right font-mono text-sm font-semibold text-gray-700">
                            {formatCurrency(subtotals.bySection[sectionKey])}
                          </td>
                          <td colSpan={canEdit || Object.keys(commentCounts).length > 0 ? 4 : 3} />
                        </tr>
                      )}
                    </>
                  );
                })
              )}
            </tbody>
            {rows.length > 0 && (
              <tfoot>
                <tr className="bg-gray-100 border-t-2 border-gray-300">
                  <td colSpan={5} className="px-3 py-3 text-right font-semibold text-gray-900">
                    Grand Subtotal
                  </td>
                  <td className="px-3 py-3 text-right font-mono text-base font-bold text-gray-900">
                    {estimate.currency} {formatCurrency(subtotals.grandTotal)}
                  </td>
                  <td colSpan={canEdit || Object.keys(commentCounts).length > 0 ? 4 : 3} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {rows.length > 0 && Object.keys(subtotals.byCategory).length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Category Breakdown</h4>
          <div className="space-y-2">
            {Object.entries(subtotals.byCategory)
              .sort((a, b) => b[1] - a[1])
              .map(([category, amount]) => {
                const pct = subtotals.grandTotal > 0 ? (amount / subtotals.grandTotal) * 100 : 0;
                return (
                  <div key={category} className="flex items-center gap-3">
                    <span className="text-sm text-gray-600 w-24 shrink-0">{category}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-sm font-mono text-gray-700 w-32 text-right shrink-0">
                      {formatCurrency(amount)}
                    </span>
                    <span className="text-xs text-gray-500 w-12 text-right shrink-0">
                      {pct.toFixed(1)}%
                    </span>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={!!deletingRowId}
        onClose={() => setDeletingRowId(null)}
        onConfirm={handleDeleteRow}
        title="Delete Row"
        message="Are you sure you want to delete this row? This action cannot be undone."
        confirmText="Delete"
        variant="danger"
      />
    </div>
  );
}
