// Web search via Tavily API

export interface SearchResult {
  title: string;
  url: string;
  content: string;
  score?: number;
}

interface TavilyOptions {
  search_depth?: "basic" | "advanced";
  topic?: "general" | "news";
  include_domains?: string[];
  max_results?: number;
}

const LOG = "[Web Search]";

/**
 * Run a single Tavily search query with advanced options.
 */
async function tavilySearch(
  query: string,
  options: TavilyOptions = {}
): Promise<SearchResult[]> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) throw new Error("TAVILY_API_KEY not configured");

  const payload = {
    api_key: apiKey,
    query,
    max_results: options.max_results || 5,
    search_depth: options.search_depth || "advanced",
    topic: options.topic || "news",
    include_answer: false,
    ...(options.include_domains?.length
      ? { include_domains: options.include_domains }
      : {}),
  };

  console.log(`${LOG} Tavily request:`, JSON.stringify({
    query: payload.query,
    search_depth: payload.search_depth,
    topic: payload.topic,
    max_results: payload.max_results,
    include_domains: payload.include_domains || "none",
  }));

  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    console.error(`${LOG} Tavily API error (${res.status}):`, errText);
    throw new Error(`Tavily search failed (${res.status})`);
  }

  const data = await res.json();
  const results = (data.results || []).map(
    (r: { title: string; url: string; content: string; score?: number }) => ({
      title: r.title,
      url: r.url,
      content: r.content,
      score: r.score,
    })
  );

  console.log(`${LOG} Tavily results for "${query}":`, results.map(
    (r: SearchResult) => `[${r.score?.toFixed(2) || "?"}] ${r.title} (${r.url})`
  ));

  return results;
}

/**
 * Generate multiple targeted search queries from a user message and agent context.
 */
function generateQueries(
  userMessage: string,
  agentPurpose?: string
): string[] {
  const now = new Date();
  const month = now.toLocaleString("en-US", { month: "long" });
  const year = now.getFullYear();
  const dateStr = `${month} ${year}`;

  const msg = userMessage.toLowerCase();
  const queries: string[] = [];

  // Detect geographic context
  const isAustralian = /australia|australian|wa\b|western australia|nsw|queensland|victoria|tasmania|canberra|federal|state government/i.test(
    `${userMessage} ${agentPurpose || ""}`
  );
  const regionHints: string[] = [];
  if (/western australia|wa\b|perth/i.test(`${userMessage} ${agentPurpose || ""}`)) {
    regionHints.push("Western Australia", "WA");
  }
  if (/nsw|new south wales|sydney/i.test(`${userMessage} ${agentPurpose || ""}`)) {
    regionHints.push("NSW", "New South Wales");
  }
  if (/queensland|brisbane/i.test(`${userMessage} ${agentPurpose || ""}`)) {
    regionHints.push("Queensland");
  }
  if (/victoria|melbourne/i.test(`${userMessage} ${agentPurpose || ""}`)) {
    regionHints.push("Victoria");
  }
  if (/council|local government|shire|municipality/i.test(`${userMessage} ${agentPurpose || ""}`)) {
    // Extract council/shire names from the message
    const councilMatch = userMessage.match(/(\w+(?:\s+\w+){0,3})\s+(?:council|shire)/i);
    if (councilMatch) regionHints.push(councilMatch[0]);
  }

  // Politics/government queries
  if (/politic|government|parliament|legislation|minister|premier|prime minister|policy|budget/i.test(msg)) {
    if (isAustralian) {
      queries.push(`Australian federal government news ${dateStr}`);
      if (regionHints.length > 0) {
        queries.push(`${regionHints[0]} state government politics news ${dateStr}`);
        queries.push(`${regionHints[0]} politics latest news`);
      } else {
        queries.push(`Australian state politics news latest ${dateStr}`);
      }
      queries.push(`Australia political developments latest ${year}`);
    } else {
      queries.push(`government politics news latest ${dateStr}`);
    }
  }

  // News queries
  if (/news|latest|developments|updates|what's happening|current/i.test(msg)) {
    const topic = msg
      .replace(/what(?:'s| is| are)\s+(?:the\s+)?latest\s*/i, "")
      .replace(/\?$/,"")
      .trim();
    if (topic.length > 5) {
      queries.push(`${topic} news ${dateStr}`);
      if (isAustralian && !topic.toLowerCase().includes("australia")) {
        queries.push(`${topic} Australia news ${dateStr}`);
      }
    }
  }

  // If we still have no queries, generate from the raw message
  if (queries.length === 0) {
    // Clean up the message into a better search query
    let cleaned = userMessage
      .replace(/^(can you |please |could you |what are |what is |tell me about )/i, "")
      .replace(/\?$/, "")
      .trim();

    if (cleaned.length < 10) cleaned = userMessage.trim();

    queries.push(`${cleaned} ${dateStr}`);

    // Add a more specific variant
    if (isAustralian && !cleaned.toLowerCase().includes("australia")) {
      queries.push(`${cleaned} Australia ${dateStr}`);
    }

    // Add the raw message as fallback
    if (cleaned !== userMessage.trim()) {
      queries.push(userMessage.trim());
    }
  }

  // Deduplicate and limit to 5
  const unique = [...new Set(queries)].slice(0, 5);
  console.log(`${LOG} Generated ${unique.length} queries from message: "${userMessage.slice(0, 80)}"`);
  unique.forEach((q, i) => console.log(`${LOG}   Query ${i + 1}: "${q}"`));
  return unique;
}

/**
 * Detect preferred domains based on agent purpose and query context.
 */
function getPreferredDomains(
  userMessage: string,
  agentPurpose?: string
): string[] | undefined {
  const combined = `${userMessage} ${agentPurpose || ""}`.toLowerCase();

  if (/australia|australian|wa\b|western australia|nsw|queensland|victoria|federal|canberra/i.test(combined)) {
    return [
      "abc.net.au",
      "thewest.com.au",
      "wa.gov.au",
      "sbs.com.au",
      "theguardian.com",
      "smh.com.au",
      "perthnow.com.au",
      "theaustralian.com.au",
      "9news.com.au",
      "brisbanetimes.com.au",
    ];
  }

  return undefined;
}

/**
 * Main web search function. Generates multiple targeted queries,
 * runs them in parallel, deduplicates results, and validates relevance.
 */
export async function webSearch(
  userMessage: string,
  maxResults = 10,
  agentPurpose?: string
): Promise<SearchResult[]> {
  const queries = generateQueries(userMessage, agentPurpose);
  const preferredDomains = getPreferredDomains(userMessage, agentPurpose);

  console.log(`${LOG} ─── Starting multi-query search ───`);
  console.log(`${LOG} User message: "${userMessage.slice(0, 120)}"`);
  console.log(`${LOG} Agent purpose: "${(agentPurpose || "none").slice(0, 80)}"`);
  console.log(`${LOG} Preferred domains:`, preferredDomains || "none");

  // Run all queries in parallel
  const allResults: SearchResult[] = [];
  const seenUrls = new Set<string>();

  const queryResults = await Promise.allSettled(
    queries.map((q) =>
      tavilySearch(q, {
        search_depth: "advanced",
        topic: "news",
        include_domains: preferredDomains,
        max_results: 5,
      })
    )
  );

  for (const result of queryResults) {
    if (result.status === "fulfilled") {
      for (const r of result.value) {
        if (!seenUrls.has(r.url)) {
          seenUrls.add(r.url);
          allResults.push(r);
        }
      }
    } else {
      console.error(`${LOG} Query failed:`, result.reason);
    }
  }

  console.log(`${LOG} Total unique results: ${allResults.length}`);

  // If we got results with preferred domains but they seem irrelevant, retry without domain filter
  if (allResults.length < 3 && preferredDomains) {
    console.log(`${LOG} Few results with domain filter — retrying without domain restriction`);
    const retryResults = await Promise.allSettled(
      queries.slice(0, 2).map((q) =>
        tavilySearch(q, {
          search_depth: "advanced",
          topic: "news",
          max_results: 5,
        })
      )
    );
    for (const result of retryResults) {
      if (result.status === "fulfilled") {
        for (const r of result.value) {
          if (!seenUrls.has(r.url)) {
            seenUrls.add(r.url);
            allResults.push(r);
          }
        }
      }
    }
    console.log(`${LOG} After retry: ${allResults.length} total results`);
  }

  // Sort by relevance score (if available), then take top results
  const sorted = allResults
    .sort((a, b) => (b.score || 0) - (a.score || 0))
    .slice(0, maxResults);

  console.log(`${LOG} ─── Final ${sorted.length} results ───`);
  sorted.forEach((r, i) => {
    console.log(`${LOG}   [${i + 1}] (${r.score?.toFixed(2) || "?"}) ${r.title}`);
    console.log(`${LOG}       ${r.url}`);
    console.log(`${LOG}       ${r.content.slice(0, 100)}...`);
  });

  return sorted;
}

export function formatSearchResults(results: SearchResult[]): string {
  if (results.length === 0) return "No search results found.";
  return results
    .map((r, i) => `[${i + 1}] ${r.title}\n${r.url}\n${r.content}`)
    .join("\n\n");
}
