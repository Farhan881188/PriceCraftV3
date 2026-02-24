import { supabase } from './supabase';

export interface AIGeneratedRow {
  section: string;
  description: string;
  uom: string;
  qty: number | null;
  measurement: string;
  category: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface GenerateBoQParams {
  sowText: string;
  category?: string;
  duration?: string;
  location?: string;
  estimateClass?: string;
}

export interface GenerateBoQResult {
  rows: AIGeneratedRow[];
  model: string;
  usage: Record<string, unknown>;
}

export interface MissingItem {
  item: string;
  severity: 'high' | 'medium' | 'low';
  rationale: string;
}

export interface ClarificationQuestion {
  question: string;
  context: string;
}

export interface SuggestedAssumption {
  assumption: string;
  type: 'assumption' | 'exclusion';
}

export interface ScopeAnalysisResult {
  missingItems: MissingItem[];
  clarificationQuestions: ClarificationQuestion[];
  suggestedAssumptions: SuggestedAssumption[];
  model: string;
  usage: Record<string, unknown>;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

async function callEdgeFunction<T>(
  functionName: string,
  body: Record<string, unknown>,
  accessToken?: string
): Promise<T> {
  const url = `${SUPABASE_URL}/functions/v1/${functionName}`;
  const token = accessToken || SUPABASE_ANON_KEY;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'apikey': SUPABASE_ANON_KEY,
    },
    body: JSON.stringify(body),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || `Edge function returned ${response.status}`);
  }

  return data as T;
}

async function getAccessToken(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) return session.access_token;

  const { data: refreshData } = await supabase.auth.refreshSession();
  if (refreshData.session?.access_token) return refreshData.session.access_token;

  return SUPABASE_ANON_KEY;
}

export async function generateDraftBoQ(
  params: GenerateBoQParams
): Promise<GenerateBoQResult> {
  const accessToken = await getAccessToken();
  return callEdgeFunction<GenerateBoQResult>('generate-boq', {
    sowText: params.sowText,
    category: params.category,
    duration: params.duration,
    location: params.location,
    estimateClass: params.estimateClass,
  }, accessToken);
}

export async function analyzeScope(
  sowText: string,
  category: string | undefined
): Promise<ScopeAnalysisResult> {
  const accessToken = await getAccessToken();
  return callEdgeFunction<ScopeAnalysisResult>('analyze-scope', {
    sowText,
    category,
  }, accessToken);
}

export interface RateSuggestionItem {
  rowId: string;
  description: string;
  uom: string;
  category: string;
  qty: number | null;
}

export interface RateSuggestion {
  rowId: string;
  suggestedRate: number | null;
  source: string;
  sourceType: 'historical' | 'market';
  confidence: 'high' | 'medium' | 'low';
  reasoning: string;
}

export interface SuggestRatesResult {
  suggestions: RateSuggestion[];
  model: string;
  usage: Record<string, unknown>;
}

export async function suggestRates(
  items: RateSuggestionItem[],
  estimateContext?: {
    title?: string;
    category?: string;
    location?: string;
    currency?: string;
  },
  userPrompt?: string
): Promise<SuggestRatesResult> {
  const accessToken = await getAccessToken();
  return callEdgeFunction<SuggestRatesResult>('suggest-rates', {
    items,
    estimateContext,
    ...(userPrompt ? { userPrompt } : {}),
  }, accessToken);
}
