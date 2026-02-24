export type UserRole = 'admin' | 'procurement_officer' | 'estimator' | 'viewer';

export type EstimateStatus = 'Draft' | 'InReview' | 'Approved' | 'Final' | 'Archived';

export type RowType = 'LineItem' | 'SectionHeader';

export type RowStatus = 'AIDraft' | 'Final';

export type AIRunStatus = 'Draft' | 'Accepted' | 'Rejected';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  is_active: boolean;
  avatar_url?: string | null;
  org_id?: string | null;
  created_at: string;
}

export interface Estimate {
  id: string;
  title: string;
  category: string;
  location: string;
  currency: string;
  estimate_class: string;
  timeline_start: string | null;
  timeline_end: string | null;
  owner_user_id: string;
  status: EstimateStatus;
  created_at: string;
  updated_at: string;
  duration_value: number | null;
  duration_unit: string | null;
  category_other: string | null;
  submitted_for_review_at: string | null;
  approved_by_user_id: string | null;
  approved_at: string | null;
}

export interface SowVersion {
  id: string;
  estimate_id: string;
  version_label: string;
  sow_text: string;
  created_by_user_id: string;
  is_current: boolean;
  created_at: string;
}

export interface BoQVersion {
  id: string;
  estimate_id: string;
  version_label: string;
  created_by_user_id: string;
  is_frozen: boolean;
  based_on_boq_version_id: string | null;
  created_at: string;
}

export interface BoQRow {
  id: string;
  boq_version_id: string;
  row_type: RowType;
  item_no: string;
  section: string;
  description: string;
  uom: string;
  qty: number | null;
  rate: number | null;
  amount: number | null;
  measurement: string;
  assumptions: string;
  category: string;
  row_status: RowStatus;
  sort_order: number;
  external_key: string | null;
  created_at: string;
  updated_at: string;
}

export interface AddonConfig {
  id: string;
  estimate_id: string;
  prelims_pct: number;
  contingency_pct: number;
  profit_pct: number;
  tax_pct: number;
  rounding_rule: number;
  created_at: string;
  updated_at: string;
}

export interface AuditLog {
  id: string;
  estimate_id: string;
  actor_user_id: string;
  action_type: string;
  entity_type: string;
  entity_id: string;
  before_snapshot: Record<string, unknown> | null;
  after_snapshot: Record<string, unknown> | null;
  created_at: string;
}

export interface RowComment {
  id: string;
  boq_row_id: string;
  comment_text: string;
  created_by_user_id: string;
  created_at: string;
}

export interface AdminSetting {
  id: string;
  key: string;
  value: unknown;
  updated_by: string | null;
  updated_at: string | null;
}

export interface AppSettings {
  roundingDecimals: number;
  defaultCurrency: string;
  defaultLocation: string;
}

export interface HistoricalDatabank {
  id: string;
  file_name: string;
  file_path: string;
  file_size: number;
  mime_type: string;
  storage_id: string;
  project_type: string;
  year_range_start: number | null;
  year_range_end: number | null;
  notes: string;
  is_active: boolean;
  uploaded_by: string | null;
  org_id: string;
  uploaded_at: string;
  created_at: string;
  text_content: string | null;
  text_extracted_at: string | null;
}

export interface Notification {
  id: string;
  recipient_user_id: string;
  type: string;
  title: string;
  body: string;
  estimate_id: string | null;
  is_read: boolean;
  created_at: string;
}
