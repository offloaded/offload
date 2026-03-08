export interface Agent {
  id: string;
  user_id: string;
  name: string;
  role: string | null;
  purpose: string;
  color: string;
  web_search_enabled: boolean;
  // Working style tags
  working_style: string[] | null;
  // Communication style tags
  communication_style: string[] | null;
  // Tone of voice
  voice_samples: string[] | null;
  voice_profile: string | null;
  // Soft skills
  soft_skills: SoftSkill[] | null;
  // Team expectations
  team_expectations: TeamExpectation[] | null;
  created_at: string;
  updated_at: string;
}

export interface TeamExpectation {
  expectation: string;
  category?: string;
}

export interface Team {
  id: string;
  user_id: string;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
}

export interface TeamMember {
  id: string;
  team_id: string;
  agent_id: string;
  created_at: string;
}

export interface SoftSkill {
  skill: string;
  confidence: "low" | "medium" | "high";
  note?: string;
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
  team_id: string | null;
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
