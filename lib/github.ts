import { createServiceSupabase } from "./supabase-server";
import { decrypt } from "./encryption";

const GITHUB_API = "https://api.github.com";

/** Get decrypted GitHub token for a workspace */
export async function getGithubToken(workspaceId: string): Promise<string | null> {
  const service = createServiceSupabase();
  const { data } = await service
    .from("integrations")
    .select("access_token_encrypted")
    .eq("workspace_id", workspaceId)
    .eq("provider", "github")
    .single();

  if (!data) return null;
  return decrypt(data.access_token_encrypted);
}

/** Make an authenticated request to the GitHub API */
export async function githubFetch(
  workspaceId: string,
  path: string,
  options: RequestInit = {}
): Promise<{ ok: boolean; status: number; data?: unknown; error?: string }> {
  const token = await getGithubToken(workspaceId);
  if (!token) {
    return { ok: false, status: 401, error: "GitHub not connected" };
  }

  const url = path.startsWith("http") ? path : `${GITHUB_API}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  // Check rate limits
  const remaining = res.headers.get("X-RateLimit-Remaining");
  if (remaining && parseInt(remaining) === 0) {
    const resetAt = res.headers.get("X-RateLimit-Reset");
    const resetDate = resetAt ? new Date(parseInt(resetAt) * 1000).toLocaleTimeString() : "soon";
    return { ok: false, status: 429, error: `GitHub rate limit reached. Resets at ${resetDate}.` };
  }

  if (res.status === 401) {
    return { ok: false, status: 401, error: "GitHub authorization expired. Please reconnect in Settings." };
  }

  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    const errMsg = body?.message || `GitHub API error (${res.status})`;
    return { ok: false, status: res.status, error: errMsg };
  }

  return { ok: true, status: res.status, data: body };
}

// ─── GitHub Operations ───

export interface GithubIssue {
  number: number;
  title: string;
  state: string;
  body: string | null;
  labels: Array<{ name: string }>;
  assignees: Array<{ login: string }>;
  user: { login: string };
  created_at: string;
  updated_at: string;
  html_url: string;
  pull_request?: unknown;
}

export interface GithubComment {
  id: number;
  body: string;
  user: { login: string };
  created_at: string;
}

export async function listIssues(
  workspaceId: string,
  owner: string,
  repo: string,
  opts?: { state?: string; labels?: string; per_page?: number }
): Promise<{ ok: boolean; issues?: GithubIssue[]; error?: string }> {
  const params = new URLSearchParams();
  params.set("state", opts?.state || "open");
  params.set("per_page", String(opts?.per_page || 30));
  if (opts?.labels) params.set("labels", opts.labels);

  const result = await githubFetch(workspaceId, `/repos/${owner}/${repo}/issues?${params}`);
  if (!result.ok) return { ok: false, error: result.error };
  // Filter out pull requests (GitHub API returns PRs mixed with issues)
  const issues = (result.data as GithubIssue[]).filter((i) => !i.pull_request);
  return { ok: true, issues };
}

export async function getIssue(
  workspaceId: string,
  owner: string,
  repo: string,
  issueNumber: number
): Promise<{ ok: boolean; issue?: GithubIssue; comments?: GithubComment[]; error?: string }> {
  const [issueResult, commentsResult] = await Promise.all([
    githubFetch(workspaceId, `/repos/${owner}/${repo}/issues/${issueNumber}`),
    githubFetch(workspaceId, `/repos/${owner}/${repo}/issues/${issueNumber}/comments?per_page=50`),
  ]);

  if (!issueResult.ok) return { ok: false, error: issueResult.error };

  return {
    ok: true,
    issue: issueResult.data as GithubIssue,
    comments: commentsResult.ok ? (commentsResult.data as GithubComment[]) : [],
  };
}

export async function createIssue(
  workspaceId: string,
  owner: string,
  repo: string,
  data: { title: string; body?: string; labels?: string[]; assignees?: string[] }
): Promise<{ ok: boolean; issue?: GithubIssue; error?: string }> {
  const result = await githubFetch(workspaceId, `/repos/${owner}/${repo}/issues`, {
    method: "POST",
    body: JSON.stringify(data),
  });
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, issue: result.data as GithubIssue };
}

export async function updateIssue(
  workspaceId: string,
  owner: string,
  repo: string,
  issueNumber: number,
  data: { title?: string; body?: string; state?: string; labels?: string[]; assignees?: string[] }
): Promise<{ ok: boolean; issue?: GithubIssue; error?: string }> {
  const result = await githubFetch(workspaceId, `/repos/${owner}/${repo}/issues/${issueNumber}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, issue: result.data as GithubIssue };
}

export async function addIssueComment(
  workspaceId: string,
  owner: string,
  repo: string,
  issueNumber: number,
  body: string
): Promise<{ ok: boolean; comment?: GithubComment; error?: string }> {
  const result = await githubFetch(workspaceId, `/repos/${owner}/${repo}/issues/${issueNumber}/comments`, {
    method: "POST",
    body: JSON.stringify({ body }),
  });
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, comment: result.data as GithubComment };
}

export async function listLabels(
  workspaceId: string,
  owner: string,
  repo: string
): Promise<{ ok: boolean; labels?: Array<{ name: string; color: string; description: string | null }>; error?: string }> {
  const result = await githubFetch(workspaceId, `/repos/${owner}/${repo}/labels?per_page=100`);
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, labels: result.data as Array<{ name: string; color: string; description: string | null }> };
}

/** Fetch user's repos for the repo picker */
export async function listUserRepos(
  workspaceId: string
): Promise<{ ok: boolean; repos?: Array<{ full_name: string; name: string; owner: { login: string }; private: boolean; description: string | null }>; error?: string }> {
  const result = await githubFetch(workspaceId, "/user/repos?per_page=100&sort=updated");
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, repos: result.data as Array<{ full_name: string; name: string; owner: { login: string }; private: boolean; description: string | null }> };
}
