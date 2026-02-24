import { supabase } from './supabase';

export interface HistoricalRateLookupResult {
  found: boolean;
  rate: number | null;
  source: string;
  excerpt: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface HistoricalRateLookupResponse {
  success: boolean;
  result?: HistoricalRateLookupResult;
  error?: string;
}

export async function lookupHistoricalRate(
  description: string,
  uom: string,
  category: string
): Promise<HistoricalRateLookupResponse> {
  try {
    const { data: records, error } = await supabase
      .from('historical_databank')
      .select('id, file_name, text_content, project_type, year_range_start, year_range_end')
      .eq('is_active', true)
      .not('text_content', 'is', null)
      .limit(5);

    if (error) throw error;

    if (!records || records.length === 0) {
      return {
        success: true,
        result: {
          found: false,
          rate: null,
          source: '',
          excerpt: '',
          confidence: 'low',
        },
      };
    }

    const searchTerms = description.toLowerCase().split(' ').filter((w: string) => w.length > 3);

    for (const record of records) {
      if (!record.text_content) continue;

      const lines = record.text_content.split('\n');
      for (const line of lines) {
        const lower = line.toLowerCase();
        const matchCount = searchTerms.filter((t: string) => lower.includes(t)).length;

        if (matchCount >= Math.ceil(searchTerms.length * 0.5)) {
          const rateMatch = line.match(/[\d,]+(?:\.\d{1,2})?/g);
          if (rateMatch) {
            const rates = rateMatch
              .map((r: string) => parseFloat(r.replace(/,/g, '')))
              .filter((r: number) => r > 0 && r < 10000000);

            if (rates.length > 0) {
              const rate = rates[rates.length - 1];
              return {
                success: true,
                result: {
                  found: true,
                  rate,
                  source: record.file_name,
                  excerpt: line.trim().substring(0, 120),
                  confidence: matchCount >= searchTerms.length ? 'high' : 'medium',
                },
              };
            }
          }
        }
      }
    }

    return {
      success: true,
      result: {
        found: false,
        rate: null,
        source: '',
        excerpt: '',
        confidence: 'low',
      },
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Lookup failed',
    };
  }
}
