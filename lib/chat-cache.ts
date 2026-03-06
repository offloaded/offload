export interface ChatMessage {
  id?: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

interface CachedChat {
  conversationId: string | null;
  messages: ChatMessage[];
  hasMore: boolean;
}

const cache = new Map<string, CachedChat>();

export function getCached(chatId: string): CachedChat | undefined {
  return cache.get(chatId);
}

export function setCache(chatId: string, data: CachedChat) {
  cache.set(chatId, data);
}

export function updateMessages(
  chatId: string,
  updater: (prev: ChatMessage[]) => ChatMessage[]
) {
  const entry = cache.get(chatId);
  if (entry) {
    entry.messages = updater(entry.messages);
  }
}

export function setConversationId(chatId: string, convId: string) {
  const entry = cache.get(chatId);
  if (entry) {
    entry.conversationId = convId;
  }
}

export function prependMessages(
  chatId: string,
  older: ChatMessage[],
  hasMore: boolean
) {
  const entry = cache.get(chatId);
  if (entry) {
    entry.messages = [...older, ...entry.messages];
    entry.hasMore = hasMore;
  }
}

export function clearCache(chatId: string) {
  cache.delete(chatId);
}

export function clearAllCaches() {
  cache.clear();
}

// Preload a single chat by agent_id (use "group" for group chat)
async function preloadChat(agentId: string): Promise<void> {
  const chatId = agentId === "group" ? "group" : `agent:${agentId}`;
  if (cache.has(chatId)) return;
  try {
    const res = await fetch(
      `/api/conversations?agent_id=${encodeURIComponent(agentId)}&limit=20`
    );
    if (!res.ok) return;
    const data = await res.json();
    const msgs: ChatMessage[] = (data.messages || []).map(
      (m: { id: string; role: string; content: string; created_at: string }) => ({
        id: m.id,
        role: m.role as "user" | "assistant",
        content: m.content,
        created_at: m.created_at,
      })
    );
    setCache(chatId, {
      conversationId: data.conversation_id || null,
      messages: msgs,
      hasMore: data.has_more ?? false,
    });
  } catch {
    // silent — chat will fetch on open as fallback
  }
}

// Preload all chats in parallel: group + every agent
export function preloadAllChats(agentIds: string[]): void {
  const ids = ["group", ...agentIds];
  ids.forEach((id) => preloadChat(id));
}
