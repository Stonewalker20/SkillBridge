export type HttpMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

const TOKEN_KEY = "sb_token";
const API_BASE = (import.meta as any).env?.VITE_API_BASE ?? "/api";
const SKILL_EXTRACT_ROUTE = "/skills/extract/skills/{snapshot_id}";
const EVIDENCE_UPDATE_ROUTE = "/evidence/{evidence_id}";

const asArray = <T,>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);

function getToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY);
}

function setToken(token: string) {
  const normalized = String(token ?? "").trim();
  if (!normalized) return;
  sessionStorage.setItem(TOKEN_KEY, normalized);
  localStorage.removeItem(TOKEN_KEY);
}

function clearToken() {
  sessionStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(TOKEN_KEY);
}

type RequestOptions = {
  skipAuth?: boolean;
  allow401?: boolean;
  returnOn401?: any;
  body?: BodyInit;
  headers?: Record<string, string>;
};

function authHeaders() {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(
  path: string,
  method: HttpMethod = "GET",
  body?: unknown,
  extraHeaders: Record<string, string> = {},
  options: RequestOptions = {}
): Promise<T> {
  const headers: Record<string, string> = {
    ...(body !== undefined && !(options.body instanceof FormData) ? { "Content-Type": "application/json" } : {}),
    ...extraHeaders,
    ...(options.headers ?? {}),
    ...(options.skipAuth ? {} : authHeaders()),
  };

  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: options.body ?? (body !== undefined ? JSON.stringify(body) : undefined),
  });

  if (response.status === 401) {
    clearToken();
    if (options.allow401) return options.returnOn401 as T;
  }

  if (!response.ok) {
    const contentType = response.headers.get("content-type") || "";
    let message = `HTTP ${response.status}`;

    try {
      if (contentType.includes("application/json")) {
        const data = await response.json();
        const detail = (data as any)?.detail;
        if (typeof detail === "string") message = detail;
        else if (Array.isArray(detail)) message = detail.map((item) => item?.msg ?? JSON.stringify(item)).join("; ");
        else if (detail != null) message = JSON.stringify(detail);
        else message = JSON.stringify(data);
      } else {
        const text = await response.text();
        if (text) message = text;
      }
    } catch {
      // Keep the status-derived fallback.
    }

    throw new Error(`${message} (HTTP ${response.status})`);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

async function requestBlob(path: string): Promise<Blob> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: "GET",
    headers: authHeaders(),
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.blob();
}

function clampProficiency(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(5, Math.trunc(value)));
}

function sameSnapshotKey(a: string | null | undefined, b: string | null | undefined): boolean {
  const left = a == null ? null : String(a).trim();
  const right = b == null ? null : String(b).trim();
  return left === right;
}

async function getUserIdOrThrow(): Promise<string> {
  const me = await api.me();
  const id = String(me?.id ?? "").trim();
  if (!id) throw new Error("You must be logged in");
  return id;
}

function normalizeConfirmation(raw: any): ConfirmationOut {
  return {
    ...raw,
    id: raw?.id ?? undefined,
    user_id: raw?.user_id ?? undefined,
    resume_snapshot_id: raw?.resume_snapshot_id ?? null,
    confirmed: asArray(raw?.confirmed),
    rejected: asArray(raw?.rejected),
    edited: asArray(raw?.edited),
  };
}

function manualProficiencyOf(entry: any): number {
  return clampProficiency(entry?.manual_proficiency ?? entry?.manualProficiency ?? entry?.proficiency ?? 0);
}

function normalizeEvidence(raw: any): Evidence {
  return {
    id: String(raw?.id ?? raw?._id ?? "").trim(),
    user_id: raw?.user_id ? String(raw.user_id) : undefined,
    user_email: raw?.user_email ? String(raw.user_email) : undefined,
    type: String(raw?.type ?? "other"),
    title: String(raw?.title ?? ""),
    source: String(raw?.source ?? raw?.url ?? ""),
    text_excerpt: String(raw?.text_excerpt ?? raw?.description ?? ""),
    skill_ids: asArray<string>(raw?.skill_ids).map((value) => String(value)),
    project_id: raw?.project_id ? String(raw.project_id) : undefined,
    tags: asArray<string>(raw?.tags),
    created_at: raw?.created_at,
    updated_at: raw?.updated_at,
    description: String(raw?.description ?? raw?.text_excerpt ?? ""),
    url: String(raw?.url ?? raw?.source ?? ""),
    skills: asArray<string>(raw?.skills),
    origin: raw?.origin ?? "user",
  };
}

export type AuthUser = { id: string; email: string; username: string; role: string };
export type AuthOut = { token: string; user: AuthUser };
export type UserPatch = { email?: string; username?: string; password?: string };

export type Skill = {
  id: string;
  name: string;
  category?: string;
  categories?: string[];
  aliases?: string[];
  tags?: string[];
  proficiency?: number | null;
  last_used_at?: string | null;
  merged_ids?: string[];
  [k: string]: any;
};

export type ConfirmedSkillEntry = {
  skill_id: string;
  skill_name?: string;
  proficiency: number;
  manual_proficiency?: number;
  auto_proficiency?: number;
  evidence_count?: number;
};

export type RejectedSkill = {
  skill_id: string;
  skill_name?: string;
};

export type EditedSkill = {
  from_text: string;
  to_skill_id: string;
};

export type ConfirmationIn = {
  user_id?: string | null;
  resume_snapshot_id?: string | null;
  confirmed: Array<{ skill_id: string; proficiency: number; manual_proficiency?: number }>;
  rejected?: RejectedSkill[];
  edited?: EditedSkill[];
};

export type ConfirmationOut = {
  id?: string | null;
  user_id?: string | null;
  resume_snapshot_id: string | null;
  confirmed: ConfirmedSkillEntry[];
  rejected?: RejectedSkill[];
  edited?: EditedSkill[];
  created_at?: string;
  updated_at?: string;
  [k: string]: any;
};

export type Evidence = {
  id: string;
  user_id?: string;
  user_email?: string;
  type: string;
  title: string;
  source?: string;
  text_excerpt?: string;
  skill_ids?: string[];
  project_id?: string;
  tags?: string[];
  created_at?: string;
  updated_at?: string;
  description?: string;
  url?: string;
  skills?: string[];
  origin?: "user" | "system";
};

export type EvidenceAnalysis = {
  analysis_id: string;
  title: string;
  type: string;
  source: string;
  text_excerpt: string;
  filename?: string | null;
  extracted_skills: Array<{
    skill_id: string;
    skill_name: string;
    category?: string;
    matched_on?: string;
    is_new?: boolean;
  }>;
};

export type EvidenceAnalysisBatch = {
  items: EvidenceAnalysis[];
  user_id: string;
};

export type EvidencePatch = {
  type?: string;
  title?: string;
  source?: string;
  text_excerpt?: string;
  skill_ids?: string[];
  project_id?: string | null;
  tags?: string[];
};

export type DashboardSummary = {
  totalSkills: number;
  portfolioItems: number;
  averageMatchScore: number;
  tailoredResumes: number;
  recentActivity: Array<{
    id: number | string;
    type: string;
    action: string;
    name: string;
    date: string;
  }>;
  topSkillCategories: Array<{ category: string; count: number }>;
};

export type JobMatchHistoryEntry = {
  id: string;
  job_id: string;
  title?: string | null;
  company?: string | null;
  location?: string | null;
  match_score: number;
  semantic_alignment_score?: number;
  matched_skills?: string[];
  missing_skills?: string[];
  strength_areas?: string[];
  related_skills?: string[];
  tailored_resume_id?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type JobMatchComparison = {
  left: JobMatchHistoryEntry;
  right: JobMatchHistoryEntry;
  match_score_delta: number;
  semantic_alignment_delta: number;
  newly_matched_skills: string[];
  newly_missing_skills: string[];
  shared_strength_areas: string[];
};

export type JobMatchHistoryDetail = JobMatchHistoryEntry & {
  text_preview?: string | null;
  job_text?: string | null;
  analysis: Record<string, any>;
};

export type TailoredResumeListEntry = {
  id: string;
  user_id: string;
  job_id?: string | null;
  job_title?: string | null;
  company?: string | null;
  location?: string | null;
  template: string;
  selected_skill_count: number;
  selected_item_count: number;
  created_at?: string;
};

export type TailoredResumeDetail = TailoredResumeListEntry & {
  selected_skill_ids: string[];
  selected_item_ids: string[];
  sections: Array<{ title: string; lines: string[] }>;
  plain_text: string;
};

export type AISettingsStatus = {
  provider_mode: string;
  embeddings_provider: string;
  rewrite_provider: string;
  embedding_model: string;
  rewrite_model: string;
};

export type AIPreferences = {
  inference_mode: string;
  embedding_model: string;
  zero_shot_model: string;
  available_inference_modes: string[];
  available_embedding_models: string[];
  available_zero_shot_models: string[];
};

export type AISettingsDetail = AISettingsStatus & {
  preferences: AIPreferences;
};

export type AdminSummary = {
  total_users: number;
  team_members: number;
  projects: number;
  evidence: number;
  jobs: number;
  pending_jobs: number;
  skills: number;
  tailored_resumes: number;
  provider_mode: string;
  collections: Record<string, number>;
};

export type AdminUserRecord = {
  id: string;
  email: string;
  username: string;
  role: string;
  created_at?: string;
};

export type AdminJob = {
  id: string;
  title: string;
  company: string;
  location: string;
  source: string;
  description_excerpt: string;
  moderation_status: string;
  moderation_reason?: string | null;
  role_ids: string[];
  required_skills: string[];
  created_at?: string;
  updated_at?: string;
};

export const api = {
  getToken,
  setToken,
  clearToken,

  health: () => request<{ status: string }>("/health/", "GET", undefined, {}, { skipAuth: true }),
  healthDbCounts: () => request<Record<string, number>>("/health/db_counts", "GET", undefined, {}, { skipAuth: true }),

  register: async (payload: { username: string; email: string; password: string }) => {
    const out = await request<AuthOut>("/auth/register", "POST", payload, {}, { skipAuth: true });
    setToken(out.token);
    return out;
  },

  login: async (payload: { email: string; password: string }) => {
    const out = await request<AuthOut>("/auth/login", "POST", payload, {}, { skipAuth: true });
    setToken(out.token);
    return out;
  },

  me: () => request<AuthUser | null>("/auth/me", "GET", undefined, {}, { allow401: true, returnOn401: null }),
  patchMe: (payload: UserPatch) => request<AuthUser>("/auth/me", "PATCH", payload),
  deleteAccount: () => request<{ ok: boolean }>("/auth/me", "DELETE"),
  logout: async () => {
    try {
      return await request<{ ok: boolean }>("/auth/logout", "POST");
    } finally {
      clearToken();
    }
  },

  submitResumeText: (payload: { user_id?: string; text: string }) =>
    request<{ snapshot_id: string; preview: string }>("/ingest/resume/text", "POST", payload),

  submitResumePdf: async (payload: { user_id: string; file: File }) => {
    const form = new FormData();
    form.append("user_id", payload.user_id);
    form.append("file", payload.file);
    return request<{ snapshot_id: string; preview: string }>(
      "/ingest/resume/pdf",
      "POST",
      undefined,
      {},
      { body: form }
    );
  },

  promoteResumeSnapshot: async (snapshotId: string, userId?: string) => {
    const form = new FormData();
    form.append("user_id", userId ?? (await getUserIdOrThrow()));
    return request<any>(`/ingest/resume/${snapshotId}/promote`, "POST", undefined, {}, { body: form });
  },

  listSkills: async (params?: { q?: string; category?: string; limit?: number; skip?: number }) => {
    const search = new URLSearchParams();
    if (params?.q) search.set("q", params.q);
    if (params?.category) search.set("category", params.category);
    if (params?.limit != null) search.set("limit", String(params.limit));
    if (params?.skip != null) search.set("skip", String(params.skip));
    const suffix = search.size ? `?${search.toString()}` : "";
    const raw = asArray<any>(await request<unknown>("/skills/" + suffix, "GET"));
    return raw
      .map((skill) => ({
        ...skill,
        id: String(skill?.id ?? skill?._id ?? "").trim(),
        categories: asArray<string>(skill?.categories),
        aliases: asArray<string>(skill?.aliases),
        tags: asArray<string>(skill?.tags),
        merged_ids: asArray<string>(skill?.merged_ids).map((value) => String(value || "").trim()).filter(Boolean),
      }))
      .filter((skill) => skill.id);
  },

  createSkill: (payload: { name: string; category: string; aliases?: string[]; tags?: string[] }) =>
    request<Skill>("/skills/", "POST", payload),

  updateSkill: (skillId: string, payload: Partial<Skill>) => request<Skill>(`/skills/${skillId}`, "PATCH", payload),
  deleteSkill: (skillId: string) => request<{ ok: boolean }>(`/skills/${skillId}`, "DELETE"),
  extractSkills: (snapshotId: string) => request<any>(SKILL_EXTRACT_ROUTE.replace("{snapshot_id}", snapshotId), "POST"),
  getSkillGaps: (threshold?: number) => {
    const suffix = threshold != null ? `?threshold=${threshold}` : "";
    return request<any[]>("/skills/gaps" + suffix, "GET");
  },
  getConfirmedSkillGaps: () => request<any[]>("/skills/gaps/confirmed", "GET"),

  upsertConfirmation: async (payload: ConfirmationIn) =>
    normalizeConfirmation(await request<ConfirmationOut>("/skills/confirmations/", "POST", payload)),

  listConfirmations: async () =>
    asArray<ConfirmationOut>(await request<unknown>("/skills/confirmations/", "GET")).map(normalizeConfirmation),

  getConfirmation: async (resumeSnapshotId: string | null): Promise<ConfirmationOut | null> => {
    const all = await api.listConfirmations();
    return all.find((entry) => sameSnapshotKey(entry.resume_snapshot_id, resumeSnapshotId)) ?? null;
  },

  getProfileConfirmation: async (): Promise<ConfirmationOut | null> => {
    try {
      const raw = await request<ConfirmationOut>("/skills/confirmations/profile", "GET");
      return normalizeConfirmation(raw);
    } catch {
      return api.getConfirmation(null);
    }
  },

  getConfirmedSkillCount: async () => {
    const confirmation = await api.getProfileConfirmation();
    return confirmation?.confirmed?.length ?? 0;
  },

  confirmSkill: async (resumeSnapshotId: string | null, skillId: string) => {
    const current = resumeSnapshotId == null ? await api.getProfileConfirmation() : await api.getConfirmation(resumeSnapshotId);
    const confirmed = new Map<string, { skill_id: string; proficiency: number; manual_proficiency: number }>();
    for (const entry of current?.confirmed ?? []) {
      const key = String(entry?.skill_id ?? "").trim();
      if (!key) continue;
      const manual = manualProficiencyOf(entry);
      confirmed.set(key, { skill_id: key, proficiency: manual, manual_proficiency: manual });
    }
    const existing = confirmed.get(skillId);
    confirmed.set(skillId, {
      skill_id: skillId,
      proficiency: existing?.manual_proficiency ?? existing?.proficiency ?? 0,
      manual_proficiency: existing?.manual_proficiency ?? existing?.proficiency ?? 0,
    });
    return api.upsertConfirmation({
      resume_snapshot_id: resumeSnapshotId,
      confirmed: Array.from(confirmed.values()),
      rejected: asArray(current?.rejected),
      edited: asArray(current?.edited),
    });
  },

  unconfirmSkill: async (resumeSnapshotId: string | null, skillId: string) => {
    const current = resumeSnapshotId == null ? await api.getProfileConfirmation() : await api.getConfirmation(resumeSnapshotId);
    const confirmed = asArray(current?.confirmed)
      .filter((entry: any) => String(entry?.skill_id ?? "").trim() !== skillId)
      .map((entry: any) => ({
        skill_id: String(entry.skill_id),
        proficiency: manualProficiencyOf(entry),
        manual_proficiency: manualProficiencyOf(entry),
      }));
    return api.upsertConfirmation({
      resume_snapshot_id: resumeSnapshotId,
      confirmed,
      rejected: asArray(current?.rejected),
      edited: asArray(current?.edited),
    });
  },

  toggleConfirmSkill: async (resumeSnapshotId: string | null, skillId: string) => {
    const current = resumeSnapshotId == null ? await api.getProfileConfirmation() : await api.getConfirmation(resumeSnapshotId);
    const exists = asArray(current?.confirmed).some((entry: any) => String(entry?.skill_id ?? "").trim() === skillId);
    return exists ? api.unconfirmSkill(resumeSnapshotId, skillId) : api.confirmSkill(resumeSnapshotId, skillId);
  },

  setSkillProficiency: async (resumeSnapshotId: string | null, skillId: string, proficiency: number) => {
    const current = resumeSnapshotId == null ? await api.getProfileConfirmation() : await api.getConfirmation(resumeSnapshotId);
    const confirmed = new Map<string, { skill_id: string; proficiency: number; manual_proficiency: number }>();
    for (const entry of current?.confirmed ?? []) {
      const key = String(entry?.skill_id ?? "").trim();
      if (!key) continue;
      const manual = manualProficiencyOf(entry);
      confirmed.set(key, { skill_id: key, proficiency: manual, manual_proficiency: manual });
    }
    const nextManual = clampProficiency(proficiency);
    confirmed.set(skillId, { skill_id: skillId, proficiency: nextManual, manual_proficiency: nextManual });
    return api.upsertConfirmation({
      resume_snapshot_id: resumeSnapshotId,
      confirmed: Array.from(confirmed.values()),
      rejected: asArray(current?.rejected),
      edited: asArray(current?.edited),
    });
  },

  listJobs: (params?: { status?: string; role_id?: string }) => {
    const search = new URLSearchParams();
    if (params?.status) search.set("status", params.status);
    if (params?.role_id) search.set("role_id", params.role_id);
    const suffix = search.size ? `?${search.toString()}` : "";
    return request<any[]>("/jobs/" + suffix, "GET");
  },

  createJob: (payload: any) => request<any>("/jobs/", "POST", payload),
  submitJob: (payload: any) => request<any>("/jobs/submit", "POST", payload),
  moderateJob: (jobId: string, payload: { moderation_status: string; moderation_reason?: string }) =>
    request<any>(`/jobs/${jobId}/moderate`, "PATCH", payload),
  addJobRole: (jobId: string, roleId: string) => request<any>(`/jobs/${jobId}/roles`, "POST", { role_id: roleId }),

  listEvidence: async (params?: { user_email?: string; user_id?: string; skill_id?: string; project_id?: string; origin?: string }) => {
    const search = new URLSearchParams();
    if (params?.user_email) search.set("user_email", params.user_email);
    if (params?.user_id) search.set("user_id", params.user_id);
    if (params?.skill_id) search.set("skill_id", params.skill_id);
    if (params?.project_id) search.set("project_id", params.project_id);
    if (params?.origin) search.set("origin", params.origin);
    const suffix = search.size ? `?${search.toString()}` : "";
    const raw = asArray(await request<any>("/evidence/" + suffix, "GET"));
    return raw.map(normalizeEvidence);
  },

  analyzeEvidence: async (payload: { title?: string; type?: string; text?: string; url?: string; files?: File[] }) => {
    const form = new FormData();
    if (payload.title) form.append("title", payload.title);
    if (payload.type) form.append("type", payload.type);
    if (payload.text) form.append("text", payload.text);
    if (payload.url) form.append("url", payload.url);
    for (const file of payload.files ?? []) {
      form.append("files", file);
    }
    return request<EvidenceAnalysisBatch>("/evidence/analyze", "POST", undefined, {}, { body: form });
  },

  createEvidence: async (payload: Partial<Evidence>) => {
    const userId = payload.user_id ?? (await getUserIdOrThrow());
    const body = {
      user_id: userId,
      user_email: payload.user_email,
      type: payload.type ?? "other",
      title: payload.title ?? "",
      source: payload.source ?? payload.url ?? "manual",
      text_excerpt: payload.text_excerpt ?? payload.description ?? "",
      skill_ids: asArray<string>(payload.skill_ids),
      project_id: payload.project_id,
      tags: asArray<string>(payload.tags),
      origin: payload.origin ?? "user",
    };
    return normalizeEvidence(await request<any>("/evidence/", "POST", body));
  },

  updateEvidence: async (evidenceId: string, payload: EvidencePatch) => {
    return normalizeEvidence(await request<any>(EVIDENCE_UPDATE_ROUTE.replace("{evidence_id}", evidenceId), "PATCH", payload));
  },
  deleteEvidence: (evidenceId: string) =>
    request<{ ok: boolean; id: string; title?: string; removed_skill_ids?: string[] }>(
      EVIDENCE_UPDATE_ROUTE.replace("{evidence_id}", evidenceId),
      "DELETE"
    ),

  confirmProfileSkills: async (skillIds: string[]) => {
    const uniqueIds = Array.from(new Set(skillIds.map((value) => String(value || "").trim()).filter(Boolean)));
    if (!uniqueIds.length) return api.getProfileConfirmation();

    const current = await api.getProfileConfirmation();
    const confirmed = new Map<string, { skill_id: string; proficiency: number; manual_proficiency: number }>();
    for (const entry of current?.confirmed ?? []) {
      const key = String(entry?.skill_id ?? "").trim();
      if (!key) continue;
      const manual = manualProficiencyOf(entry);
      confirmed.set(key, { skill_id: key, proficiency: manual, manual_proficiency: manual });
    }
    for (const skillId of uniqueIds) {
      const existing = confirmed.get(skillId);
      confirmed.set(skillId, {
        skill_id: skillId,
        proficiency: existing?.manual_proficiency ?? existing?.proficiency ?? 0,
        manual_proficiency: existing?.manual_proficiency ?? existing?.proficiency ?? 0,
      });
    }

    return api.upsertConfirmation({
      resume_snapshot_id: null,
      confirmed: Array.from(confirmed.values()),
      rejected: asArray(current?.rejected),
      edited: asArray(current?.edited),
    });
  },

  listProjects: (userId?: string) => {
    const suffix = userId ? `?user_id=${encodeURIComponent(userId)}` : "";
    return request<any[]>("/projects/" + suffix, "GET");
  },
  createProject: (payload: any) => request<any>("/projects/", "POST", payload),
  getProject: (projectId: string) => request<any>(`/projects/${projectId}`, "GET"),
  linkProjectSkill: (projectId: string, skillId: string) => request<any>(`/projects/${projectId}/skills`, "POST", { skill_id: skillId }),
  listProjectSkills: (projectId: string) => request<any[]>(`/projects/${projectId}/skills`, "GET"),

  getDashboardSummary: async (): Promise<DashboardSummary> => {
    const raw = await request<any>("/dashboard/summary", "GET");
    return {
      totalSkills: Number(raw?.totals?.confirmed_skills ?? 0) || 0,
      portfolioItems: Number(raw?.totals?.evidence ?? 0) || 0,
      averageMatchScore: Number(raw?.average_match_score ?? 0) || 0,
      tailoredResumes: Number(raw?.tailored_resumes ?? 0) || 0,
      recentActivity: Array.isArray(raw?.recent_activity)
        ? raw.recent_activity
        : asArray(raw?.recent_projects).map((project: any) => ({
            id: project?.id,
            type: "project",
            action: "created",
            name: project?.title ?? "",
            date: project?.created_at ?? "",
          })),
      topSkillCategories: asArray(raw?.top_skills_by_evidence)
        .map((skill: any) => ({
          category: skill?.category || "Uncategorized",
          count: Number(skill?.evidence_count ?? 0) || 0,
        }))
        .filter((skill) => skill.count > 0),
    };
  },

  listRoles: () => request<any[]>("/roles/", "GET"),
  createRole: (payload: any) => request<any>("/roles/", "POST", payload),
  computeRoleWeights: (roleId: string) => request<any>(`/roles/${roleId}/compute_weights`, "POST"),
  getRoleWeights: (roleId: string) => request<any>(`/roles/${roleId}/weights`, "GET"),

  setSkillAliases: (skillId: string, aliases: string[]) => request<any>(`/taxonomy/aliases/${skillId}`, "PUT", { aliases }),
  createSkillRelation: (payload: { from_skill_id: string; to_skill_id: string; relation_type: string }) =>
    request<any>("/taxonomy/relations", "POST", payload),
  listSkillRelations: (skillId?: string) => {
    const suffix = skillId ? `?skill_id=${encodeURIComponent(skillId)}` : "";
    return request<any[]>("/taxonomy/relations" + suffix, "GET");
  },

  ingestJob: async (payload: { user_id?: string; title?: string; company?: string; location?: string; text: string }) => {
    const body = { ...payload, user_id: payload.user_id ?? (await getUserIdOrThrow()) };
    return request<any>("/tailor/job/ingest", "POST", body);
  },

  matchJob: async (payload: { user_id?: string; job_id: string; history_id?: string; ignored_skill_names?: string[]; persist_history?: boolean }) => {
    const body = { ...payload, user_id: payload.user_id ?? (await getUserIdOrThrow()) };
    return request<any>("/tailor/match", "POST", body);
  },

  listJobMatchHistory: async (limit?: number) => {
    const userId = await getUserIdOrThrow();
    const suffix = limit != null ? `?user_id=${encodeURIComponent(userId)}&limit=${encodeURIComponent(String(limit))}` : `?user_id=${encodeURIComponent(userId)}`;
    return request<JobMatchHistoryEntry[]>("/tailor/history" + suffix, "GET");
  },

  listTailoredResumes: async (limit?: number) => {
    const userId = await getUserIdOrThrow();
    const suffix = limit != null ? `?user_id=${encodeURIComponent(userId)}&limit=${encodeURIComponent(String(limit))}` : `?user_id=${encodeURIComponent(userId)}`;
    return request<TailoredResumeListEntry[]>("/tailor/resumes" + suffix, "GET");
  },
  getTailoredResumeDetail: async (tailoredId: string) => {
    const userId = await getUserIdOrThrow();
    return request<TailoredResumeDetail>(`/tailor/resumes/${tailoredId}?user_id=${encodeURIComponent(userId)}`, "GET");
  },
  deleteTailoredResume: async (tailoredId: string) => {
    const userId = await getUserIdOrThrow();
    return request<{ ok: boolean; id: string }>(`/tailor/resumes/${tailoredId}?user_id=${encodeURIComponent(userId)}`, "DELETE");
  },

  compareJobMatchHistory: async (leftId: string, rightId: string) => {
    const userId = await getUserIdOrThrow();
    const params = new URLSearchParams({
      user_id: userId,
      left_id: leftId,
      right_id: rightId,
    });
    return request<JobMatchComparison>("/tailor/history/compare?" + params.toString(), "GET");
  },

  getJobMatchHistoryDetail: async (historyId: string) => {
    const userId = await getUserIdOrThrow();
    return request<JobMatchHistoryDetail>(`/tailor/history/${historyId}?user_id=${encodeURIComponent(userId)}`, "GET");
  },

  deleteJobMatchHistory: async (historyId: string) => {
    const userId = await getUserIdOrThrow();
    return request<{ ok: boolean; id: string; title?: string }>(
      `/tailor/history/${historyId}?user_id=${encodeURIComponent(userId)}`,
      "DELETE"
    );
  },

  getAISettingsStatus: () => request<AISettingsStatus>("/tailor/settings/status", "GET"),
  getAIPreferences: () => request<AISettingsDetail>("/tailor/settings/preferences", "GET"),
  updateAIPreferences: (payload: Partial<Pick<AIPreferences, "inference_mode" | "embedding_model" | "zero_shot_model">>) =>
    request<AISettingsDetail>("/tailor/settings/preferences", "PATCH", payload),

  getAdminSummary: () => request<AdminSummary>("/admin/summary", "GET"),
  listAdminUsers: () => request<AdminUserRecord[]>("/admin/users", "GET"),
  updateAdminUserRole: (userId: string, role: string) =>
    request<AdminUserRecord>(`/admin/users/${userId}`, "PATCH", { role }),
  listAdminJobs: (status?: string) => {
    const suffix = status ? `?status=${encodeURIComponent(status)}` : "";
    return request<AdminJob[]>("/admin/jobs" + suffix, "GET");
  },
  moderateAdminJob: (jobId: string, payload: { moderation_status: string; moderation_reason?: string | null }) =>
    request<AdminJob>(`/admin/jobs/${jobId}/moderation`, "PATCH", payload),

  previewTailoredResume: async (payload: { user_id?: string; job_id?: string; job_text?: string; ignored_skill_names?: string[]; template?: string; max_items?: number; max_bullets_per_item?: number }) => {
    const body = { ...payload, user_id: payload.user_id ?? (await getUserIdOrThrow()) };
    return request<any>("/tailor/preview", "POST", body);
  },

  rewriteTailoredResume: (tailoredId: string, payload?: { focus?: string }) =>
    request<any>(`/tailor/${tailoredId}/rewrite`, "POST", payload ?? { focus: "balanced" }),

  downloadTailoredDocx: (tailoredId: string) => requestBlob(`/tailor/${tailoredId}/export/docx`),
  downloadTailoredPdf: (tailoredId: string) => requestBlob(`/tailor/${tailoredId}/export/pdf`),

  createPortfolioItem: (payload: any) => request<any>("/portfolio/items", "POST", payload),
  listPortfolioItems: (userId: string, params?: { type?: string; visibility?: string }) => {
    const search = new URLSearchParams({ user_id: userId });
    if (params?.type) search.set("type", params.type);
    if (params?.visibility) search.set("visibility", params.visibility);
    return request<any[]>(`/portfolio/items?${search.toString()}`, "GET");
  },
  patchPortfolioItem: (itemId: string, payload: any) => request<any>(`/portfolio/items/${itemId}`, "PATCH", payload),
  deletePortfolioItem: (itemId: string) => request<any>(`/portfolio/items/${itemId}`, "DELETE"),
};
