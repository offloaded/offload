export interface Agent {
  id: string;
  user_id: string;
  workspace_id: string | null;
  name: string;
  role: string | null;
  purpose: string;
  color: string;
  web_search_enabled: boolean;
  asana_enabled: boolean;
  asana_projects: Array<{ gid: string; name: string; workspace: string }> | null;
  github_enabled: boolean;
  github_repositories: Array<{ full_name: string; name: string }> | null;
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
  assigned_templates: string[] | null;
  last_message_at: string | null;
  deleted_at: string | null;
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
  workspace_id: string | null;
  name: string;
  description: string;
  visibility: "public" | "private";
  is_system: boolean;
  created_by: string | null;
  last_message_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Workspace {
  id: string;
  name: string;
  owner_id: string;
  created_at: string;
  role?: "owner" | "admin" | "member";
}

export interface WorkspaceMember {
  workspace_id: string;
  user_id: string;
  role: "owner" | "admin" | "member";
  invited_by: string;
  joined_at: string;
  email?: string | null;
  display_name?: string | null;
}

export interface WorkspaceInvite {
  id: string;
  workspace_id: string;
  email: string;
  invited_by: string;
  status: "pending" | "accepted";
  created_at: string;
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
  sender_id: string | null;
  sender_name: string | null;
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

export interface ReportTemplate {
  id: string;
  workspace_id: string;
  user_id: string;
  name: string;
  description: string;
  structure: Array<{ heading: string; description: string }>;
  file_name: string | null;
  file_size: number | null;
  storage_path: string | null;
  created_at: string;
  updated_at: string;
}
