export interface Agent {
  id: string;
  user_id: string;
  name: string;
  purpose: string;
  color: string;
  created_at: string;
  updated_at: string;
}

export interface Document {
  id: string;
  agent_id: string;
  file_name: string;
  file_size: number;
  storage_path: string;
  status: "processing" | "ready" | "error";
  created_at: string;
  chunk_count?: number;
}

export interface Conversation {
  id: string;
  user_id: string;
  agent_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: "user" | "assistant";
  content: string;
  routed_to: string | null;
  created_at: string;
}
