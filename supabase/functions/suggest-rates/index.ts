import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface RateRequestItem {
  rowId: string;
  description: string;
  uom: string;
  category: string;
  qty: number | null;
}

interface RateSuggestion {
  rowId: string;
  suggestedRate: number | null;
  source: string;
  sourceType: "historical" | "market";
  confidence: "high" | "medium" | "low";
  reasoning: string;
}

function unwrapKey(raw: unknown): string | null {
  let val = raw;
  for (let i = 0; i < 5; i++) {
    if (typeof val !== "string") return null;
    const trimmed = val.trim();
    if (!trimmed) return null;
    if (trimmed.startsWith("sk-")) return trimmed;
    try {
      val = JSON.parse(trimmed);
    } catch {
      return trimmed.startsWith("sk-") ? trimmed : null;
    }
  }
  return typeof val === "string" && val.startsWith("sk-") ? val : null;
}

async function getOpenAIKey(supabaseUrl: string, supabaseServiceKey: string): Promise<string | null> {
  const envKey = Deno.env.get("OPENAI_API_KEY");
  if (envKey) return envKey;

  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/admin_settings?key=eq.openai_api_key&select=value`, {
      headers: {
        "Authorization": `Bearer ${supabaseServiceKey}`,
        "apikey": supabaseServiceKey,
        "Content-Type": "application/json",
      },
    });
    if (!res.ok) return null;
    const rows = await res.json();
    if (!rows || rows.length === 0) return null;
    return unwrapKey(rows[0].value);
  } catch {
    return null;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const openaiApiKey = await getOpenAIKey(supabaseUrl, supabaseServiceKey);
    if (!openaiApiKey) {
      return new Response(
        JSON.stringify({ error: "AI service not configured. Please set your OpenAI API key in Settings > AI Settings." }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { items, estimateContext, userPrompt } = body as {
      items: RateRequestItem[];
      estimateContext?: {
        title?: string;
        category?: string;
        location?: string;
        currency?: string;
      };
      userPrompt?: string;
    };

    if (!items || !Array.isArray(items) || items.length === 0) {
      return new Response(
        JSON.stringify({ error: "items array is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: historicalRecords } = await supabase
      .from("historical_databank")
      .select("id, file_name, file_path, mime_type, project_type, year_range_start, year_range_end, notes, text_content")
      .eq("is_active", true)
      .limit(10);

    const imageContents: unknown[] = [];
    const textExcerpts: string[] = [];

    if (historicalRecords && historicalRecords.length > 0) {
      for (const record of historicalRecords) {
        if (record.text_content && record.text_content.trim().length > 0) {
          const excerpt = record.text_content.substring(0, 4000);
          textExcerpts.push(
            `--- Extracted Text from: ${record.file_name} (${record.project_type}, ${record.year_range_start || "?"}–${record.year_range_end || "?"}) ---\n${excerpt}`
          );
        }

        const isImage = record.mime_type?.startsWith("image/");
        if (!isImage) continue;

        const { data: signedUrlData } = await supabase.storage
          .from("historical-databank")
          .createSignedUrl(record.file_path, 300);

        if (!signedUrlData?.signedUrl) continue;

        imageContents.push({
          type: "text",
          text: `--- Historical File: ${record.file_name} (${record.project_type}, ${record.year_range_start || "?"}–${record.year_range_end || "?"}) ---\n${record.notes ? "Notes: " + record.notes : ""}`,
        });
        imageContents.push({
          type: "image_url",
          image_url: { url: signedUrlData.signedUrl, detail: "high" },
        });
      }
    }

    const contextParts: string[] = [];
    if (estimateContext?.title) contextParts.push(`Project: ${estimateContext.title}`);
    if (estimateContext?.category) contextParts.push(`Category: ${estimateContext.category}`);
    if (estimateContext?.location) contextParts.push(`Location: ${estimateContext.location}`);
    if (estimateContext?.currency) contextParts.push(`Currency: ${estimateContext.currency}`);

    const itemsText = items
      .map((item, i) => `${i + 1}. rowId="${item.rowId}" | Description: "${item.description}" | UOM: ${item.uom} | Category: ${item.category}${item.qty !== null ? ` | Qty: ${item.qty}` : ""}`)
      .join("\n");

    const hasHistoricalData = imageContents.length > 0 || textExcerpts.length > 0;
    const hasTextData = textExcerpts.length > 0;

    const systemPrompt = `You are an expert quantity surveyor and cost estimator specializing in construction and procurement pricing.

Your task is to suggest unit rates for Bill of Quantities line items.

${hasHistoricalData ? "You have been provided with historical project data (extracted text and/or images). Search the extracted text carefully for matching items and their rates. Extract actual rates from this data where the items match. For items not found in historical data, use your knowledge of current market rates." : "Use your knowledge of current market rates for the project location and category."}

RULES:
- Provide a rate for EVERY item in the list
- Rate must be a positive number (numeric value only, no currency symbols)
- source: name of the historical file if found there, or "Market estimate" if using general knowledge
- sourceType: "historical" if from a file, "market" if from general knowledge
- confidence: "high" if directly found in historical data, "medium" if similar item found or reliable market knowledge, "low" if estimate is rough
- reasoning: brief explanation of how the rate was derived (max 100 chars)
- Rates should be appropriate for the currency and location context

Respond with ONLY a valid JSON object:
{
  "suggestions": [
    {
      "rowId": "<exact rowId from input>",
      "suggestedRate": <number>,
      "source": "<file name or Market estimate>",
      "sourceType": "historical" | "market",
      "confidence": "high" | "medium" | "low",
      "reasoning": "<brief reasoning>"
    }
  ]
}`;

    const textDataBlock = hasTextData
      ? "\n\n--- EXTRACTED HISTORICAL TEXT DATA ---\n" + textExcerpts.join("\n\n") + "\n--- END OF EXTRACTED TEXT DATA ---"
      : "";

    const userContent: unknown[] = [
      {
        type: "text",
        text: `${contextParts.length > 0 ? contextParts.join(", ") + "\n\n" : ""}Suggest unit rates for the following ${items.length} line item(s):\n\n${itemsText}${textDataBlock}${imageContents.length > 0 ? "\n\nHistorical image data follows:" : ""}`,
      },
      ...imageContents,
    ];

    if (hasHistoricalData) {
      userContent.push({
        type: "text",
        text: "Based on the historical data above (both extracted text and images) and your market knowledge, provide rate suggestions for each item listed. Prioritize rates found in the extracted text data.",
      });
    }

    if (userPrompt && userPrompt.trim().length > 0) {
      userContent.push({
        type: "text",
        text: `Additional user instruction: ${userPrompt.trim()}`,
      });
    }

    const userMessage = hasHistoricalData ? userContent : (userContent[0] as { type: string; text: string }).text;

    const requestBody: Record<string, unknown> = {
      model: "gpt-4o",
      max_tokens: 4096,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
    };

    if (!hasHistoricalData) {
      requestBody.response_format = { type: "json_object" };
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return new Response(
        JSON.stringify({ error: `AI service returned ${response.status}`, details: errorText }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content;

    if (!content) {
      return new Response(
        JSON.stringify({ error: "Empty response from AI service" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return new Response(
        JSON.stringify({ error: "Failed to parse AI response" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const parsed = JSON.parse(jsonMatch[0]);

    const suggestions: RateSuggestion[] = (parsed.suggestions || []).map((s: Record<string, unknown>) => ({
      rowId: String(s.rowId || ""),
      suggestedRate: typeof s.suggestedRate === "number" && s.suggestedRate > 0 ? s.suggestedRate : null,
      source: String(s.source || "Market estimate"),
      sourceType: s.sourceType === "historical" ? "historical" : "market",
      confidence: ["high", "medium", "low"].includes(s.confidence as string) ? s.confidence : "medium",
      reasoning: String(s.reasoning || ""),
    }));

    return new Response(
      JSON.stringify({ suggestions, model: aiResponse.model || "gpt-4.1", usage: aiResponse.usage || {} }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Internal server error", message: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
