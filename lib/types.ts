export interface Agent {
  id: string;
  user_id: string;
  name: string;
  purpose: string;
  color: string;
  web_search_enabled: boolean;
  // Personality traits (1–5, default 3)
  verbosity: number;
  initiative: number;
  reactivity: number;
  repetition_tolerance: number;
  warmth: number;
  // Tone of voice
  voice_samples: string[] | null;
  voice_profile: string | null;
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

export interface ScheduledTask {
  id: string;
  user_id: string;
  agent_id: string;
  instruction: string;
  cron: string;
  timezone: string;
  recurring: boolean;
  destination: "dm" | "group";
  enabled: boolean;
  last_run_at: string | null;
  next_run_at: string | null;
  created_at: string;
  updated_at: string;
}
