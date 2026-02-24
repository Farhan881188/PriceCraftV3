import { supabase } from './supabase';
import {
  Estimate,
  SowVersion,
  BoQVersion,
  BoQRow,
  AddonConfig,
  AuditLog,
  RowComment,
  User,
  AdminSetting,
  HistoricalDatabank,
  Notification,
} from '../types';

export function calculateAmount(
  qty: number | null,
  rate: number | null,
  decimals: number
): number | null {
  if (qty === null || rate === null) return null;
  const raw = qty * rate;
  return parseFloat(raw.toFixed(decimals));
}

export function calculateSubtotals(
  rows: BoQRow[],
  decimals: number
): {
  grandTotal: number;
  bySection: Record<string, number>;
  byCategory: Record<string, number>;
} {
  const bySection: Record<string, number> = {};
  const byCategory: Record<string, number> = {};
  let grandTotal = 0;

  let currentSection = '';

  for (const row of rows) {
    if (row.row_type === 'SectionHeader') {
      currentSection = row.description;
      if (!(currentSection in bySection)) {
        bySection[currentSection] = 0;
      }
      continue;
    }

    const amount = row.amount ?? 0;
    grandTotal += amount;

    if (currentSection) {
      bySection[currentSection] = (bySection[currentSection] ?? 0) + amount;
    }

    if (row.category) {
      byCategory[row.category] = (byCategory[row.category] ?? 0) + amount;
    }
  }

  grandTotal = parseFloat(grandTotal.toFixed(decimals));

  return { grandTotal, bySection, byCategory };
}

export const db = {
  users: {
    async getById(id: string): Promise<User | null> {
      const { data } = await supabase.from('users').select('*').eq('id', id).maybeSingle();
      return data;
    },
    async getAll(): Promise<User[]> {
      const { data } = await supabase.from('users').select('*').order('name');
      return data ?? [];
    },
    async update(id: string, payload: Partial<User>): Promise<User> {
      const { data, error } = await supabase
        .from('users')
        .update(payload)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
  },

  estimates: {
    async getAll(): Promise<Estimate[]> {
      const { data, error } = await supabase
        .from('estimates')
        .select('*')
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    async getById(id: string): Promise<Estimate | null> {
      const { data } = await supabase.from('estimates').select('*').eq('id', id).maybeSingle();
      return data;
    },
    async create(payload: Omit<Estimate, 'id' | 'created_at' | 'updated_at'>): Promise<Estimate> {
      const { data, error } = await supabase
        .from('estimates')
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    async update(id: string, payload: Partial<Estimate>): Promise<Estimate> {
      const { data, error } = await supabase
        .from('estimates')
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    async delete(id: string): Promise<void> {
      const { error } = await supabase.from('estimates').delete().eq('id', id);
      if (error) throw error;
    },
  },

  sowVersions: {
    async getByEstimateId(estimateId: string): Promise<SowVersion[]> {
      const { data, error } = await supabase
        .from('sow_versions')
        .select('*')
        .eq('estimate_id', estimateId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    async create(payload: Omit<SowVersion, 'id' | 'created_at'>): Promise<SowVersion> {
      const { data, error } = await supabase
        .from('sow_versions')
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    async update(id: string, payload: Partial<SowVersion>): Promise<SowVersion> {
      const { data, error } = await supabase
        .from('sow_versions')
        .update(payload)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    async setCurrent(estimateId: string, versionId: string): Promise<void> {
      await supabase.from('sow_versions').update({ is_current: false }).eq('estimate_id', estimateId);
      await supabase.from('sow_versions').update({ is_current: true }).eq('id', versionId);
    },
  },

  boqVersions: {
    async getByEstimateId(estimateId: string): Promise<BoQVersion[]> {
      const { data, error } = await supabase
        .from('boq_versions')
        .select('*')
        .eq('estimate_id', estimateId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    async create(payload: Omit<BoQVersion, 'id' | 'created_at'>): Promise<BoQVersion> {
      const { data, error } = await supabase
        .from('boq_versions')
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    async freeze(id: string): Promise<BoQVersion> {
      const { data, error } = await supabase
        .from('boq_versions')
        .update({ is_frozen: true })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
  },

  boqRows: {
    async getByVersionId(versionId: string): Promise<BoQRow[]> {
      const { data, error } = await supabase
        .from('boq_rows')
        .select('*')
        .eq('boq_version_id', versionId)
        .order('sort_order');
      if (error) throw error;
      return data ?? [];
    },
    async create(payload: Omit<BoQRow, 'id' | 'created_at' | 'updated_at'>): Promise<BoQRow> {
      const { data, error } = await supabase.from('boq_rows').insert(payload).select().single();
      if (error) throw error;
      return data;
    },
    async update(id: string, payload: Partial<BoQRow>): Promise<BoQRow> {
      const { data, error } = await supabase
        .from('boq_rows')
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    async delete(id: string): Promise<void> {
      const { error } = await supabase.from('boq_rows').delete().eq('id', id);
      if (error) throw error;
    },
    async bulkUpdateStatus(ids: string[], status: 'AIDraft' | 'Final'): Promise<void> {
      const { error } = await supabase
        .from('boq_rows')
        .update({ row_status: status, updated_at: new Date().toISOString() })
        .in('id', ids);
      if (error) throw error;
    },
    async bulkDelete(ids: string[]): Promise<void> {
      const { error } = await supabase.from('boq_rows').delete().in('id', ids);
      if (error) throw error;
    },
    async reorder(versionId: string, orderedIds: string[]): Promise<void> {
      const updates = orderedIds.map((id, idx) =>
        supabase.from('boq_rows').update({ sort_order: idx }).eq('id', id)
      );
      await Promise.all(updates);
    },
  },

  addonConfigs: {
    async getByEstimateId(estimateId: string): Promise<AddonConfig | null> {
      const { data } = await supabase
        .from('addon_configs')
        .select('*')
        .eq('estimate_id', estimateId)
        .maybeSingle();
      return data;
    },
    async upsert(payload: Omit<AddonConfig, 'id' | 'created_at' | 'updated_at'>): Promise<AddonConfig> {
      const { data, error } = await supabase
        .from('addon_configs')
        .upsert(payload, { onConflict: 'estimate_id' })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
  },

  auditLogs: {
    async create(payload: Omit<AuditLog, 'id' | 'created_at'>): Promise<void> {
      await supabase.from('audit_logs').insert(payload);
    },
    async getByEstimateId(estimateId: string): Promise<AuditLog[]> {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('estimate_id', estimateId)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
  },

  rowComments: {
    async getByRowId(rowId: string): Promise<RowComment[]> {
      const { data, error } = await supabase
        .from('row_comments')
        .select('*')
        .eq('boq_row_id', rowId)
        .order('created_at');
      if (error) throw error;
      return data ?? [];
    },
    async create(payload: Omit<RowComment, 'id' | 'created_at'>): Promise<RowComment> {
      const { data, error } = await supabase.from('row_comments').insert(payload).select().single();
      if (error) throw error;
      return data;
    },
  },

  adminSettings: {
    async getAll(): Promise<AdminSetting[]> {
      const { data, error } = await supabase.from('admin_settings').select('*');
      if (error) throw error;
      return data ?? [];
    },
    async get(key: string): Promise<unknown> {
      const { data } = await supabase
        .from('admin_settings')
        .select('value')
        .eq('key', key)
        .maybeSingle();
      return data?.value ?? null;
    },
    async set(key: string, value: unknown, userId: string): Promise<void> {
      const { error } = await supabase.from('admin_settings').upsert(
        { key, value, updated_by: userId, updated_at: new Date().toISOString() },
        { onConflict: 'key' }
      );
      if (error) throw error;
    },
  },

  historicalDatabank: {
    async getAll(): Promise<HistoricalDatabank[]> {
      const { data, error } = await supabase
        .from('historical_databank')
        .select('*')
        .order('uploaded_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    async update(id: string, payload: Partial<HistoricalDatabank>): Promise<HistoricalDatabank> {
      const { data, error } = await supabase
        .from('historical_databank')
        .update(payload)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    async delete(id: string): Promise<void> {
      const { error } = await supabase.from('historical_databank').delete().eq('id', id);
      if (error) throw error;
    },
  },

  notifications: {
    async getForUser(userId: string): Promise<Notification[]> {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('recipient_user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
    async markRead(id: string): Promise<void> {
      await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    },
    async markAllRead(userId: string): Promise<void> {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('recipient_user_id', userId)
        .eq('is_read', false);
    },
  },
};
