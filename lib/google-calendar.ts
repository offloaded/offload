import { createServiceSupabase } from "./supabase-server";
import { encrypt, decrypt } from "./encryption";

const GCAL_API = "https://www.googleapis.com/calendar/v3";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

// Mutex to prevent concurrent token refreshes for the same workspace
const refreshLocks = new Map<string, Promise<GoogleTokens | null>>();

interface GoogleTokens {
  access_token: string;
  refresh_token: string;
  expires_at: Date;
}

/** Fetch and decrypt Google tokens for a workspace, refreshing if expired */
export async function getGoogleTokens(workspaceId: string): Promise<GoogleTokens | null> {
  const service = createServiceSupabase();
  const { data } = await service
    .from("integrations")
    .select("access_token_encrypted, refresh_token_encrypted, token_expires_at")
    .eq("workspace_id", workspaceId)
    .eq("provider", "google_calendar")
    .single();

  if (!data) return null;

  const expiresAt = new Date(data.token_expires_at);
  const accessToken = decrypt(data.access_token_encrypted);
  const refreshToken = decrypt(data.refresh_token_encrypted);

  // If token expires within 5 minutes, refresh it (with mutex to prevent concurrent refreshes)
  if (expiresAt.getTime() - Date.now() < 5 * 60 * 1000) {
    const existing = refreshLocks.get(workspaceId);
    if (existing) return existing;

    const refreshPromise = refreshGoogleToken(workspaceId, refreshToken).finally(() => {
      refreshLocks.delete(workspaceId);
    });
    refreshLocks.set(workspaceId, refreshPromise);
    return refreshPromise;
  }

  return { access_token: accessToken, refresh_token: refreshToken, expires_at: expiresAt };
}

/** Refresh an expired Google token */
async function refreshGoogleToken(workspaceId: string, refreshToken: string): Promise<GoogleTokens | null> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: refreshToken,
    }),
  });

  if (!res.ok) {
    console.error("[Google Calendar] Token refresh failed:", res.status);
    return null;
  }

  const data = await res.json();
  const expiresAt = new Date(Date.now() + data.expires_in * 1000);

  // Update stored tokens (Google doesn't always return a new refresh_token)
  const service = createServiceSupabase();
  await service
    .from("integrations")
    .update({
      access_token_encrypted: encrypt(data.access_token),
      ...(data.refresh_token ? { refresh_token_encrypted: encrypt(data.refresh_token) } : {}),
      token_expires_at: expiresAt.toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("workspace_id", workspaceId)
    .eq("provider", "google_calendar");

  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token || refreshToken,
    expires_at: expiresAt,
  };
}

/** Make an authenticated request to the Google Calendar API with retry on transient errors */
export async function gcalFetch(
  workspaceId: string,
  path: string,
  options: RequestInit = {}
): Promise<{ ok: boolean; status: number; data?: unknown; error?: string }> {
  const tokens = await getGoogleTokens(workspaceId);
  if (!tokens) {
    return { ok: false, status: 401, error: "Google Calendar not connected" };
  }

  const url = path.startsWith("http") ? path : `${GCAL_API}${path}`;
  const MAX_RETRIES = 2;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url, {
        ...options,
        headers: {
          Authorization: `Bearer ${tokens.access_token}`,
          "Content-Type": "application/json",
          ...options.headers,
        },
      });

      if (res.status === 429) {
        if (attempt < MAX_RETRIES) {
          const retryAfter = res.headers.get("Retry-After");
          const delay = retryAfter ? parseInt(retryAfter) * 1000 : 1000 * (attempt + 1);
          console.warn(`[Google Calendar] Rate limited, retrying in ${delay}ms (attempt ${attempt + 1}/${MAX_RETRIES})`);
          await new Promise((r) => setTimeout(r, delay));
          continue;
        }
        return { ok: false, status: 429, error: "Google Calendar rate limit reached. Try again in a moment." };
      }

      if (res.status === 401) {
        return { ok: false, status: 401, error: "Google Calendar authorization expired. Please reconnect in Settings." };
      }

      // Retry on server errors
      if (res.status >= 500 && attempt < MAX_RETRIES) {
        console.warn(`[Google Calendar] Server error ${res.status}, retrying (attempt ${attempt + 1}/${MAX_RETRIES})`);
        await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
        continue;
      }

      const body = await res.json().catch(() => ({}));

      if (!res.ok) {
        const errMsg = body?.error?.message || `Google Calendar API error (${res.status})`;
        return { ok: false, status: res.status, error: errMsg };
      }

      return { ok: true, status: res.status, data: body };
    } catch (err) {
      if (attempt < MAX_RETRIES) {
        console.warn(`[Google Calendar] Network error, retrying (attempt ${attempt + 1}/${MAX_RETRIES}):`, err);
        await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
        continue;
      }
      return { ok: false, status: 0, error: `Google Calendar request failed: ${err instanceof Error ? err.message : "network error"}` };
    }
  }

  return { ok: false, status: 0, error: "Google Calendar request failed after retries" };
}

// ─── Google Calendar Operations ───

export interface GoogleCalendarEvent {
  id: string;
  summary: string;
  description?: string;
  location?: string;
  start: { dateTime?: string; date?: string; timeZone?: string };
  end: { dateTime?: string; date?: string; timeZone?: string };
  status: string;
  attendees?: Array<{ email: string; displayName?: string; responseStatus?: string }>;
  organizer?: { email: string; displayName?: string; self?: boolean };
  htmlLink?: string;
  conferenceData?: { entryPoints?: Array<{ entryPointType: string; uri: string }> };
  recurringEventId?: string;
}

export interface GoogleCalendar {
  id: string;
  summary: string;
  description?: string;
  primary?: boolean;
  backgroundColor?: string;
  accessRole: string;
}

/** List all calendars the user has access to */
export async function listCalendars(
  workspaceId: string
): Promise<{ ok: boolean; calendars?: GoogleCalendar[]; error?: string }> {
  const result = await gcalFetch(workspaceId, "/users/me/calendarList?maxResults=100");
  if (!result.ok) return { ok: false, error: result.error };
  const items = (result.data as { items?: GoogleCalendar[] })?.items || [];
  return { ok: true, calendars: items };
}

/** List events from a calendar within a time range */
export async function listEvents(
  workspaceId: string,
  calendarId: string,
  opts?: { timeMin?: string; timeMax?: string; maxResults?: number; query?: string }
): Promise<{ ok: boolean; events?: GoogleCalendarEvent[]; error?: string }> {
  const params = new URLSearchParams({
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: String(opts?.maxResults || 50),
  });
  if (opts?.timeMin) params.set("timeMin", opts.timeMin);
  if (opts?.timeMax) params.set("timeMax", opts.timeMax);
  if (opts?.query) params.set("q", opts.query);

  const result = await gcalFetch(workspaceId, `/calendars/${encodeURIComponent(calendarId)}/events?${params}`);
  if (!result.ok) return { ok: false, error: result.error };
  const items = (result.data as { items?: GoogleCalendarEvent[] })?.items || [];
  return { ok: true, events: items };
}

/** Get a single event by ID */
export async function getEvent(
  workspaceId: string,
  calendarId: string,
  eventId: string
): Promise<{ ok: boolean; event?: GoogleCalendarEvent; error?: string }> {
  const result = await gcalFetch(workspaceId, `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`);
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, event: result.data as GoogleCalendarEvent };
}

/** Create a new event */
export async function createEvent(
  workspaceId: string,
  calendarId: string,
  data: {
    summary: string;
    description?: string;
    location?: string;
    start: { dateTime?: string; date?: string; timeZone?: string };
    end: { dateTime?: string; date?: string; timeZone?: string };
    attendees?: Array<{ email: string }>;
  }
): Promise<{ ok: boolean; event?: GoogleCalendarEvent; error?: string }> {
  const result = await gcalFetch(workspaceId, `/calendars/${encodeURIComponent(calendarId)}/events`, {
    method: "POST",
    body: JSON.stringify(data),
  });
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, event: result.data as GoogleCalendarEvent };
}

/** Update an existing event */
export async function updateEvent(
  workspaceId: string,
  calendarId: string,
  eventId: string,
  data: {
    summary?: string;
    description?: string;
    location?: string;
    start?: { dateTime?: string; date?: string; timeZone?: string };
    end?: { dateTime?: string; date?: string; timeZone?: string };
    attendees?: Array<{ email: string }>;
  }
): Promise<{ ok: boolean; event?: GoogleCalendarEvent; error?: string }> {
  const result = await gcalFetch(workspaceId, `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, event: result.data as GoogleCalendarEvent };
}

/** Fetch calendars for the calendar picker UI */
export async function fetchCalendarsForPicker(
  workspaceId: string
): Promise<{ ok: boolean; calendars?: Array<{ id: string; name: string; primary: boolean }>; error?: string }> {
  const result = await listCalendars(workspaceId);
  if (!result.ok) return { ok: false, error: result.error };
  const calendars = (result.calendars || [])
    .filter((c) => c.accessRole === "owner" || c.accessRole === "writer" || c.accessRole === "reader")
    .map((c) => ({
      id: c.id,
      name: c.summary,
      primary: c.primary || false,
    }));
  return { ok: true, calendars };
}
