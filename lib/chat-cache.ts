export interface ChatMessage {
  id?: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
  sender_id?: string | null;
  sender_name?: string | null;
  file_name?: string | null;
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

// Extract file name from [Attached: filename] pattern in message content
function parseFileName(content: string, role: string): string | null {
  if (role !== "user") return null;
  const match = content.match(/\[Attached: ([^\]]+)\]/);
  return match ? match[1] : null;
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (m: any) => ({
        id: m.id,
        role: m.role as "user" | "assistant",
        content: m.content,
        created_at: m.created_at,
        sender_id: m.sender_id || null,
        sender_name: m.sender_name || null,
        file_name: parseFileName(m.content, m.role),
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

// Poll for new messages after the last known timestamp.
// Returns the new messages (empty array if none).
export async function pollNewMessages(chatId: string): Promise<ChatMessage[]> {
  const entry = cache.get(chatId);
  if (!entry || !entry.conversationId) return [];

  // Find the latest message timestamp
  const msgs = entry.messages;
  if (msgs.length === 0) return [];
  const lastTs = msgs[msgs.length - 1].created_at;

  try {
    const res = await fetch(
      `/api/conversations?conversation_id=${entry.conversationId}&after=${encodeURIComponent(lastTs)}`
    );
    if (!res.ok) return [];
    const data = await res.json();
    const newMsgs: ChatMessage[] = (data.messages || []).map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (m: any) => ({
        id: m.id,
        role: m.role as "user" | "assistant",
        content: m.content,
        created_at: m.created_at,
        sender_id: m.sender_id || null,
        sender_name: m.sender_name || null,
        file_name: parseFileName(m.content, m.role),
      })
    );

    if (newMsgs.length > 0) {
      // Deduplicate by id — avoid appending messages we already have from streaming
      const existingIds = new Set(msgs.filter((m) => m.id).map((m) => m.id));
      const truly = newMsgs.filter((m) => m.id && !existingIds.has(m.id));
      if (truly.length > 0) {
        entry.messages = [...entry.messages, ...truly];
        return truly;
      }
    }
  } catch {
    // silent
  }
  return [];
}
