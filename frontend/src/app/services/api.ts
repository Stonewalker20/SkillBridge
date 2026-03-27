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

function resolveAssetUrl(url: unknown): string | null {
  const raw = String(url ?? "").trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw) || raw.startsWith("blob:") || raw.startsWith("data:")) {
    return raw;
  }
  if (!raw.startsWith("/")) return raw;
  if (/^https?:\/\//i.test(API_BASE)) {
    try {
      return new URL(raw, API_BASE).toString();
    } catch {
      return raw;
    }
  }
  return raw;
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

export type AuthUser = {
  id: string;
  email: string;
  username: string;
  role: string;
  avatar_url?: string | null;
  avatar_preset?: string | null;
  subscription_status: string;
  subscription_plan?: string | null;
  subscription_started_at?: string | null;
  subscription_renewal_at?: string | null;
  billing_provider?: string | null;
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
  stripe_checkout_session_id?: string | null;
};
export type AuthOut = { token: string; user: AuthUser };
export type UserPatch = { email?: string; username?: string; avatar_preset?: string | null };
export type BillingStatus = {
  provider: string;
  mode: string;
  configured: boolean;
  checkout_available: boolean;
  portal_available: boolean;
  dev_fallback_available: boolean;
  message: string;
  subscription_status: string;
  billing_provider?: string | null;
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
  stripe_checkout_session_id?: string | null;
};
export type BillingCheckoutSession = {
  provider: string;
  mode: string;
  status: string;
  checkout_url?: string | null;
  session_id?: string | null;
  customer_id?: string | null;
  subscription_id?: string | null;
  dev_fallback_available: boolean;
  subscription_status: string;
  plan?: string | null;
  renewal_at?: string | null;
  message?: string | null;
};
export type BillingPortalSession = {
  provider: string;
  mode: string;
  status: string;
  portal_url?: string | null;
  customer_id?: string | null;
  message?: string | null;
};
export type RewardCounters = {
  evidence_saved: number;
  profile_skills_confirmed: number;
  resume_snapshots_uploaded: number;
  job_matches_run: number;
  tailored_resumes_generated: number;
};
export type RewardAchievement = {
  key: string;
  title: string;
  description: string;
  reward: string;
  counter_key: keyof RewardCounters;
  current_value: number;
  target_value: number;
  progress_pct: number;
  unlocked: boolean;
  unlocked_at?: string | null;
};
export type RewardBadge = RewardAchievement;
export type RewardsSummary = {
  counters: RewardCounters;
  unlockedCount: number;
  totalCount: number;
  achievements: RewardAchievement[];
  badges?: RewardBadge[];
  badgeCount?: number;
  unlockedBadgeCount?: number;
  nextAchievement: RewardAchievement | null;
  recentUnlocks: RewardAchievement[];
};

const REWARD_MILESTONES: Array<{
  key: string;
  title: string;
  description: string;
  reward: string;
  counterKey: keyof RewardCounters;
  targetValue: number;
}> = [
  {
    key: "first_evidence_saved",
    counterKey: "evidence_saved",
    targetValue: 1,
    title: "First Proof Added",
    description: "Save your first evidence item to start building a verifiable portfolio.",
    reward: "Unlocked: Evidence Starter badge",
  },
  {
    key: "evidence_starter",
    counterKey: "evidence_saved",
    targetValue: 3,
    title: "Proof Stack",
    description: "Save three evidence items so your profile starts showing repeatable proof of work.",
    reward: "Unlocked: Proof Stack badge",
  },
  {
    key: "first_skill_confirmed",
    counterKey: "profile_skills_confirmed",
    targetValue: 1,
    title: "First Skill Locked In",
    description: "Confirm your first profile skill to turn extracted signals into trusted profile data.",
    reward: "Unlocked: Skill Claim badge",
  },
  {
    key: "skill_stack",
    counterKey: "profile_skills_confirmed",
    targetValue: 5,
    title: "Skill Stack",
    description: "Build a profile with five confirmed skills to strengthen job-match reasoning.",
    reward: "Unlocked: Skill Stack badge",
  },
  {
    key: "first_resume_uploaded",
    counterKey: "resume_snapshots_uploaded",
    targetValue: 1,
    title: "Template Ready",
    description: "Upload or paste a resume so tailoring starts from your actual baseline materials.",
    reward: "Unlocked: Resume Template badge",
  },
  {
    key: "first_job_match",
    counterKey: "job_matches_run",
    targetValue: 1,
    title: "First Match Run",
    description: "Run your first grounded job analysis to unlock targeted fit feedback.",
    reward: "Unlocked: Match Runner badge",
  },
  {
    key: "match_momentum",
    counterKey: "job_matches_run",
    targetValue: 3,
    title: "Match Momentum",
    description: "Run three job matches to build a stronger signal about what roles align with your profile.",
    reward: "Unlocked: Momentum badge",
  },
  {
    key: "first_tailored_resume",
    counterKey: "tailored_resumes_generated",
    targetValue: 1,
    title: "Resume Tailored",
    description: "Generate your first tailored resume to turn analysis into a submission-ready artifact.",
    reward: "Unlocked: Tailor Ready badge",
  },
];

function normalizeAuthUser(raw: any): AuthUser {
  return {
    id: String(raw?.id ?? raw?._id ?? "").trim(),
    email: String(raw?.email ?? "").trim(),
    username: String(raw?.username ?? "").trim(),
    role: String(raw?.role ?? "user").trim() || "user",
    avatar_url: resolveAssetUrl(raw?.avatar_url),
    avatar_preset: raw?.avatar_preset ? String(raw.avatar_preset).trim() : null,
    subscription_status: String(raw?.subscription_status ?? "inactive").trim() || "inactive",
    subscription_plan: raw?.subscription_plan ? String(raw.subscription_plan).trim() : null,
    subscription_started_at: raw?.subscription_started_at ? String(raw.subscription_started_at) : null,
    subscription_renewal_at: raw?.subscription_renewal_at ? String(raw.subscription_renewal_at) : null,
    billing_provider: raw?.billing_provider ? String(raw.billing_provider).trim() : null,
    stripe_customer_id: raw?.stripe_customer_id ? String(raw.stripe_customer_id).trim() : null,
    stripe_subscription_id: raw?.stripe_subscription_id ? String(raw.stripe_subscription_id).trim() : null,
    stripe_checkout_session_id: raw?.stripe_checkout_session_id ? String(raw.stripe_checkout_session_id).trim() : null,
  };
}

function normalizeRewardAchievement(raw: any): RewardAchievement {
  return {
    key: String(raw?.key ?? "").trim(),
    title: String(raw?.title ?? "").trim(),
    description: String(raw?.description ?? "").trim(),
    reward: String(raw?.reward ?? "").trim(),
    counter_key: String(raw?.counter_key ?? "evidence_saved").trim() as keyof RewardCounters,
    current_value: Number(raw?.current_value ?? 0) || 0,
    target_value: Number(raw?.target_value ?? 0) || 0,
    progress_pct: Number(raw?.progress_pct ?? 0) || 0,
    unlocked: Boolean(raw?.unlocked),
    unlocked_at: raw?.unlocked_at ? String(raw.unlocked_at) : null,
  };
}

function buildRewardAchievementsFromCounters(counters: RewardCounters, unlockedLookup: Record<string, string | null> = {}): RewardAchievement[] {
  return REWARD_MILESTONES.map((milestone) => {
    const currentValue = Number(counters[milestone.counterKey] ?? 0) || 0;
    const unlocked = currentValue >= milestone.targetValue;
    return {
      key: milestone.key,
      title: milestone.title,
      description: milestone.description,
      reward: milestone.reward,
      counter_key: milestone.counterKey,
      current_value: currentValue,
      target_value: milestone.targetValue,
      progress_pct: milestone.targetValue > 0 ? Math.min(100, Number(((currentValue / milestone.targetValue) * 100).toFixed(2))) : 100,
      unlocked,
      unlocked_at: unlocked ? unlockedLookup[milestone.key] ?? null : null,
    };
  });
}

export function normalizeRewardsSummary(raw: any): RewardsSummary {
  const counters: RewardCounters = {
    evidence_saved: Number(raw?.counters?.evidence_saved ?? 0) || 0,
    profile_skills_confirmed: Number(raw?.counters?.profile_skills_confirmed ?? 0) || 0,
    resume_snapshots_uploaded: Number(raw?.counters?.resume_snapshots_uploaded ?? 0) || 0,
    job_matches_run: Number(raw?.counters?.job_matches_run ?? 0) || 0,
    tailored_resumes_generated: Number(raw?.counters?.tailored_resumes_generated ?? 0) || 0,
  };
  const unlockedLookup = Object.fromEntries(
    asArray(raw?.achievements)
      .map((achievement) => normalizeRewardAchievement(achievement))
      .filter((achievement) => achievement.unlocked)
      .map((achievement) => [achievement.key, achievement.unlocked_at ?? null])
  ) as Record<string, string | null>;
  const achievements = asArray(raw?.achievements).length
    ? asArray(raw?.achievements).map(normalizeRewardAchievement)
    : buildRewardAchievementsFromCounters(counters, unlockedLookup);
  const badges = asArray(raw?.badges).length ? asArray(raw?.badges).map(normalizeRewardAchievement) : achievements;
  const unlockedCount = achievements.filter((achievement) => achievement.unlocked).length;
  const nextAchievement = achievements.find((achievement) => !achievement.unlocked) ?? null;
  return {
    counters,
    unlockedCount: Number(raw?.unlocked_count ?? unlockedCount) || unlockedCount,
    totalCount: Number(raw?.total_count ?? achievements.length) || achievements.length,
    achievements,
    badges,
    badgeCount: Number(raw?.badge_count ?? raw?.badgeCount ?? badges.length) || badges.length,
    unlockedBadgeCount:
      Number(raw?.unlocked_badge_count ?? raw?.unlockedBadgeCount ?? badges.filter((badge) => badge.unlocked).length) ||
      badges.filter((badge) => badge.unlocked).length,
    nextAchievement: raw?.next_achievement ? normalizeRewardAchievement(raw.next_achievement) : nextAchievement,
    recentUnlocks: asArray(raw?.recent_unlocks).map(normalizeRewardAchievement),
  };
}

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

export type PortfolioToJobAnalytics = {
  job_skill_coverage_pct: number;
  matched_skill_rate_pct: number;
  evidence_backed_match_pct: number;
  portfolio_backed_match_pct: number;
  portfolio_skill_count: number;
  job_skill_count: number;
};

export type SkillTrajectoryCluster = {
  category: string;
  skill_count: number;
  evidence_backed_count: number;
  average_proficiency: number;
  skill_names: string[];
};

export type SkillTrajectoryPath = {
  role_id: string;
  role_name: string;
  score: number;
  confidence_label: string;
  cluster_category: string;
  personal_vector_alignment_score: number;
  progress_bonus_score: number;
  matched_skills: string[];
  missing_skills: string[];
  top_role_skills: string[];
  reasoning: string;
  next_steps: string[];
};

export type LearningPathRecommendation = {
  phase: string;
  title: string;
  target_skills: string[];
  rationale: string;
  evidence_action: string;
};

export type LearningPathProgress = {
  skill_name: string;
  status: "not_started" | "in_progress" | "completed";
  updated_at?: string;
};

export type LearningPathSkillDetail = {
  skill_name: string;
  skill_id?: string | null;
  confirmed: boolean;
  evidence_support_count: number;
  graph_neighbors: string[];
  related_career_paths: string[];
  recommended_projects: string[];
  recommended_resources: Array<{ title: string; provider: string; url: string }>;
  progress_status: "not_started" | "in_progress" | "completed";
};

export type CareerPathDetail = {
  role_id: string;
  role_name: string;
  score: number;
  confidence_label: string;
  cluster_category: string;
  personal_vector_alignment_score: number;
  progress_bonus_score: number;
  matched_skills: string[];
  missing_skills: string[];
  top_role_skills: string[];
  graph_neighbor_skills: string[];
  recommended_skills_to_add: string[];
  recommended_project_ideas: string[];
  recommended_resources: Array<{ title: string; provider: string; url: string }>;
  reasoning: string;
};

export type SkillTrajectoryOut = {
  generated_at?: string;
  clusters: SkillTrajectoryCluster[];
  career_paths: SkillTrajectoryPath[];
  learning_path: LearningPathRecommendation[];
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

export type ResumeSnapshotListEntry = {
  snapshot_id: string;
  source_type: string;
  filename?: string | null;
  preview: string;
  created_at?: string;
};

export type DashboardSummary = {
  totalSkills: number;
  evidenceCount: number;
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

export type RAGContextItem = {
  source_type: string;
  source_id: string;
  title: string;
  snippet: string;
  score: number;
  chunk_index?: number;
};

export type SkillGraphNode = {
  skill_id: string;
  name: string;
  category?: string;
  aliases?: string[];
  distance: number;
  node_type: "seed" | "neighbor";
};

export type SkillGraphEdge = {
  source_skill_id: string;
  target_skill_id: string;
  relation_type: string;
  edge_type: "explicit" | "semantic" | "evidence_cooccurrence" | "job_cooccurrence";
  weight: number;
};

export type SkillGraph = {
  root_skill_id: string;
  nodes: SkillGraphNode[];
  edges: SkillGraphEdge[];
};

export type JobMatchHistoryEntry = {
  id: string;
  job_id: string;
  title?: string | null;
  company?: string | null;
  location?: string | null;
  source_history_id?: string | null;
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
  resume_snapshot_id?: string | null;
  resume_evidence_id?: string | null;
  template_source?: string | null;
  selected_skill_ids: string[];
  selected_item_ids: string[];
  retrieved_context?: RAGContextItem[];
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

export type UserSkillVector = {
  user_id: string;
  embedding_dimensions: number;
  confirmed_skill_count: number;
  evidence_item_count: number;
  portfolio_item_count: number;
  source_preview: string;
  updated_at?: string;
};

export type UserSkillVectorHistoryPoint = {
  score: number;
  label: string;
  updated_at?: string;
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
  is_active: boolean;
  created_at?: string;
  deactivated_at?: string;
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

export type AdminMlflowRun = {
  run_id: string;
  run_name: string;
  status: string;
  experiment_id: string;
  artifact_uri: string;
  start_time?: string | null;
  end_time?: string | null;
  duration_seconds?: number | null;
  metrics: Record<string, number>;
  params: Record<string, string>;
  tags: Record<string, string>;
  primary_metric_key?: string | null;
  primary_metric_value?: number | null;
};

export type AdminMlflowExperiment = {
  id: string;
  name: string;
  lifecycle_stage: string;
  creation_time?: string | null;
  last_update_time?: string | null;
  run_count: number;
  latest_run_started_at?: string | null;
  latest_runs: AdminMlflowRun[];
};

export type AdminMlflowModelVersion = {
  name: string;
  version: string;
  current_stage: string;
  run_id: string;
  source: string;
  creation_timestamp?: string | null;
};

export type AdminMlflowRegisteredModel = {
  name: string;
  description?: string | null;
  latest_versions: AdminMlflowModelVersion[];
};

export type AdminMlflowOverview = {
  available: boolean;
  tracking_uri: string;
  experiment_count: number;
  registered_model_count: number;
  latest_run_started_at?: string | null;
  experiments: AdminMlflowExperiment[];
  registered_models: AdminMlflowRegisteredModel[];
  error?: string | null;
};

export type AdminMlflowArtifact = {
  path: string;
  is_dir: boolean;
  file_size?: number | null;
};

export type AdminMlflowRunDetail = AdminMlflowRun & {
  parent_run_id?: string | null;
  child_runs: AdminMlflowRun[];
  artifacts: AdminMlflowArtifact[];
};

export type AdminMlflowDataset = {
  id: string;
  label: string;
  kind: string;
  path: string;
  manifest_path?: string | null;
  extraction_dataset?: string | null;
  ranking_dataset?: string | null;
  rewrite_dataset?: string | null;
  created_at?: string | null;
  counts: Record<string, number>;
};

export type AdminMlflowJob = {
  id: string;
  kind: string;
  status: string;
  created_at: string;
  started_at?: string | null;
  finished_at?: string | null;
  command: string[];
  summary: Record<string, string>;
  log_lines: string[];
  return_code?: number | null;
  error?: string | null;
};

export type AdminMlflowPreset = {
  id: string;
  label: string;
  description: string;
  inference_modes: string[];
  embedding_models: string[];
  zero_shot_models: string[];
  rewrite_models: string[];
};

export type AdminMlflowLocalOptions = {
  available_inference_modes: string[];
  embedding_models: string[];
  zero_shot_models: string[];
  rewrite_models: string[];
  default_inference_mode: string;
  default_embedding_model: string;
  default_zero_shot_model: string;
  default_rewrite_model: string;
  presets: AdminMlflowPreset[];
};

export type AdminMlflowRunLaunchPayload = {
  experiment_name: string;
  run_name?: string;
  dataset_id?: string;
  inference_modes?: string[];
  embedding_models?: string[];
  zero_shot_models?: string[];
  rewrite_models?: string[];
  max_candidates?: number;
  top_k?: number[];
  skip_extraction?: boolean;
  skip_ranking?: boolean;
  skip_rewrite?: boolean;
  tags?: Record<string, string>;
};

export type AdminMlflowExportLaunchPayload = {
  max_users?: number;
  max_per_user?: number;
  negative_count?: number;
  mongo_db?: string;
};

export const api = {
  getToken,
  setToken,
  clearToken,

  health: () => request<{ status: string }>("/health/", "GET", undefined, {}, { skipAuth: true }),
  healthDbCounts: () => request<Record<string, number>>("/health/db_counts", "GET", undefined, {}, { skipAuth: true }),

  register: async (payload: { username: string; email: string; password: string }) => {
    const out = await request<AuthOut>("/auth/register", "POST", payload, {}, { skipAuth: true });
    out.user = normalizeAuthUser(out.user);
    setToken(out.token);
    return out;
  },

  login: async (payload: { email: string; password: string }) => {
    const out = await request<AuthOut>("/auth/login", "POST", payload, {}, { skipAuth: true });
    out.user = normalizeAuthUser(out.user);
    setToken(out.token);
    return out;
  },

  me: async () => {
    const out = await request<AuthUser | null>("/auth/me", "GET", undefined, {}, { allow401: true, returnOn401: null });
    return out ? normalizeAuthUser(out) : null;
  },
  patchMe: async (payload: UserPatch) => normalizeAuthUser(await request<AuthUser>("/auth/me", "PATCH", payload)),
  activateSubscription: async () => normalizeAuthUser(await request<AuthUser>("/auth/me/subscription", "POST")),
  getBillingStatus: async () => request<BillingStatus>("/billing/status", "GET"),
  createBillingCheckout: async () => request<BillingCheckoutSession>("/billing/checkout", "POST"),
  createBillingPortal: async () => request<BillingPortalSession>("/billing/portal", "POST"),
  changeMyPassword: async (payload: { current_password: string; new_password: string }) => {
    const out = await request<AuthOut>("/auth/me/password", "POST", payload);
    out.user = normalizeAuthUser(out.user);
    setToken(out.token);
    return out;
  },
  uploadMyAvatar: async (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return normalizeAuthUser(await request<AuthUser>("/auth/me/avatar", "POST", undefined, {}, { body: form }));
  },
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

  submitResumeDocx: async (payload: { user_id: string; file: File }) => {
    const form = new FormData();
    form.append("user_id", payload.user_id);
    form.append("file", payload.file);
    return request<{ snapshot_id: string; preview: string }>(
      "/ingest/resume/docx",
      "POST",
      undefined,
      {},
      { body: form }
    );
  },

  promoteResumeSnapshot: async (snapshotId: string, userId?: string) => {
    const form = new FormData();
    if (userId) form.append("user_id", userId);
    return request<any>(`/ingest/resume/${snapshotId}/promote`, "POST", undefined, {}, { body: form });
  },
  listResumeSnapshots: async () => request<ResumeSnapshotListEntry[]>("/ingest/resume", "GET"),

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
      evidenceCount: Number(raw?.totals?.evidence ?? 0) || 0,
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
      portfolioToJobAnalytics: {
        job_skill_coverage_pct: Number(raw?.portfolio_to_job_analytics?.job_skill_coverage_pct ?? 0) || 0,
        matched_skill_rate_pct: Number(raw?.portfolio_to_job_analytics?.matched_skill_rate_pct ?? 0) || 0,
        evidence_backed_match_pct: Number(raw?.portfolio_to_job_analytics?.evidence_backed_match_pct ?? 0) || 0,
        portfolio_backed_match_pct: Number(raw?.portfolio_to_job_analytics?.portfolio_backed_match_pct ?? 0) || 0,
        portfolio_skill_count: Number(raw?.portfolio_to_job_analytics?.portfolio_skill_count ?? 0) || 0,
        job_skill_count: Number(raw?.portfolio_to_job_analytics?.job_skill_count ?? 0) || 0,
      },
      portfolioTypeDistribution: asArray(raw?.portfolio_type_distribution).map((entry: any) => ({
        type: String(entry?.type ?? "Other"),
        count: Number(entry?.count ?? 0) || 0,
      })),
      recentMatchTrend: asArray(raw?.recent_match_trend).map((entry: any) => ({
        label: String(entry?.label ?? ""),
        score: Number(entry?.score ?? 0) || 0,
        created_at: entry?.created_at,
      })),
    };
  },
  getRewardsSummary: async (): Promise<RewardsSummary> => {
    const raw = await request<any>("/rewards/summary", "GET");
    return normalizeRewardsSummary(raw);
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
  getSkillGraph: (skillId: string, params?: { depth?: number; limit?: number; include_inferred?: boolean }) => {
    const search = new URLSearchParams();
    if (params?.depth != null) search.set("depth", String(params.depth));
    if (params?.limit != null) search.set("limit", String(params.limit));
    if (params?.include_inferred != null) search.set("include_inferred", String(params.include_inferred));
    const suffix = search.size ? `?${search.toString()}` : "";
    return request<SkillGraph>(`/taxonomy/graph/${skillId}${suffix}`, "GET");
  },
  searchTailorRag: (query: string, limit = 5) =>
    request<any[]>(`/tailor/rag/search?q=${encodeURIComponent(query)}&limit=${encodeURIComponent(String(limit))}`, "GET"),
  getSkillTrajectory: () => request<SkillTrajectoryOut>("/taxonomy/trajectory", "GET"),
  getCareerPathDetail: (roleId: string) => request<CareerPathDetail>(`/taxonomy/trajectory/path/${encodeURIComponent(roleId)}`, "GET"),
  getLearningPathSkillDetail: (skillName: string) =>
    request<LearningPathSkillDetail>(`/taxonomy/learning-path/skill/${encodeURIComponent(skillName)}`, "GET"),
  listLearningPathProgress: () => request<LearningPathProgress[]>("/taxonomy/learning-path/progress", "GET"),
  patchLearningPathProgress: (payload: { skill_name: string; status: "not_started" | "in_progress" | "completed" }) =>
    request<LearningPathProgress>("/taxonomy/learning-path/progress", "PATCH", payload),
  getUserSkillVector: () => request<UserSkillVector>("/tailor/user-vector", "GET"),
  getUserSkillVectorHistory: (limit = 12) => request<UserSkillVectorHistoryPoint[]>(`/tailor/user-vector/history?limit=${encodeURIComponent(String(limit))}`, "GET"),

  ingestJob: async (payload: { user_id?: string; title?: string; company?: string; location?: string; text: string }) => {
    return request<any>("/tailor/job/ingest", "POST", payload);
  },

  matchJob: async (payload: { user_id?: string; job_id: string; history_id?: string; resume_snapshot_id?: string | null; resume_evidence_id?: string | null; ignored_skill_names?: string[]; added_from_missing_skills?: Array<{ skill_id: string; skill_name: string }>; persist_history?: boolean }) => {
    return request<any>("/tailor/match", "POST", payload);
  },

  listJobMatchHistory: async (limit?: number) => {
    const suffix = limit != null ? `?limit=${encodeURIComponent(String(limit))}` : "";
    return request<JobMatchHistoryEntry[]>("/tailor/history" + suffix, "GET");
  },

  listTailoredResumes: async (limit?: number) => {
    const suffix = limit != null ? `?limit=${encodeURIComponent(String(limit))}` : "";
    return request<TailoredResumeListEntry[]>("/tailor/resumes" + suffix, "GET");
  },
  getTailoredResumeDetail: async (tailoredId: string) => request<TailoredResumeDetail>(`/tailor/resumes/${tailoredId}`, "GET"),
  deleteTailoredResume: async (tailoredId: string) => request<{ ok: boolean; id: string }>(`/tailor/resumes/${tailoredId}`, "DELETE"),

  compareJobMatchHistory: async (leftId: string, rightId: string) => {
    const params = new URLSearchParams({
      left_id: leftId,
      right_id: rightId,
    });
    return request<JobMatchComparison>("/tailor/history/compare?" + params.toString(), "GET");
  },

  getJobMatchHistoryDetail: async (historyId: string) => request<JobMatchHistoryDetail>(`/tailor/history/${historyId}`, "GET"),

  reanalyzeJobMatchHistory: async (historyId: string) =>
    request<any>(`/tailor/history/${encodeURIComponent(historyId)}/reanalyze`, "POST"),

  deleteJobMatchHistory: async (historyId: string) =>
    request<{ ok: boolean; id: string; title?: string }>(`/tailor/history/${historyId}`, "DELETE"),

  getAISettingsStatus: () => request<AISettingsStatus>("/tailor/settings/status", "GET"),
  getAIPreferences: () => request<AISettingsDetail>("/tailor/settings/preferences", "GET"),
  updateAIPreferences: (payload: Partial<Pick<AIPreferences, "inference_mode" | "embedding_model" | "zero_shot_model">>) =>
    request<AISettingsDetail>("/tailor/settings/preferences", "PATCH", payload),

  getAdminSummary: () => request<AdminSummary>("/admin/summary", "GET"),
  listAdminUsers: () => request<AdminUserRecord[]>("/admin/users", "GET"),
  updateAdminUserRole: (userId: string, role: string) =>
    request<AdminUserRecord>(`/admin/users/${userId}`, "PATCH", { role }),
  deactivateAdminUser: (userId: string) => request<{ ok: boolean }>(`/admin/users/${userId}`, "DELETE"),
  listAdminJobs: (status?: string) => {
    const suffix = status ? `?status=${encodeURIComponent(status)}` : "";
    return request<AdminJob[]>("/admin/jobs" + suffix, "GET");
  },
  moderateAdminJob: (jobId: string, payload: { moderation_status: string; moderation_reason?: string | null }) =>
    request<AdminJob>(`/admin/jobs/${jobId}/moderation`, "PATCH", payload),
  getAdminMlflowOverview: () => request<AdminMlflowOverview>("/admin/mlflow/overview", "GET"),
  listAdminMlflowExperimentRuns: (experimentId: string, limit = 25) =>
    request<AdminMlflowRun[]>(
      `/admin/mlflow/experiments/${encodeURIComponent(experimentId)}/runs?limit=${encodeURIComponent(String(limit))}`,
      "GET"
    ),
  getAdminMlflowRunDetail: (experimentId: string, runId: string) =>
    request<AdminMlflowRunDetail>(
      `/admin/mlflow/experiments/${encodeURIComponent(experimentId)}/runs/${encodeURIComponent(runId)}`,
      "GET"
    ),
  listAdminMlflowDatasets: () => request<AdminMlflowDataset[]>("/admin/mlflow/datasets", "GET"),
  getAdminMlflowLocalOptions: () => request<AdminMlflowLocalOptions>("/admin/mlflow/local-options", "GET"),
  listAdminMlflowJobs: (limit = 20) =>
    request<AdminMlflowJob[]>(`/admin/mlflow/jobs?limit=${encodeURIComponent(String(limit))}`, "GET"),
  getAdminMlflowJob: (jobId: string) => request<AdminMlflowJob>(`/admin/mlflow/jobs/${encodeURIComponent(jobId)}`, "GET"),
  launchAdminMlflowDatasetExport: (payload: AdminMlflowExportLaunchPayload) =>
    request<AdminMlflowJob>("/admin/mlflow/datasets/export", "POST", payload),
  launchAdminMlflowExperiment: (payload: AdminMlflowRunLaunchPayload) =>
    request<AdminMlflowJob>("/admin/mlflow/experiments/run", "POST", payload),

  previewTailoredResume: async (payload: { user_id?: string; job_id?: string; job_text?: string; resume_snapshot_id?: string | null; resume_evidence_id?: string | null; ignored_skill_names?: string[]; template?: string; max_items?: number; max_bullets_per_item?: number }) => {
    return request<any>("/tailor/preview", "POST", payload);
  },

  rewriteTailoredResume: (tailoredId: string, payload?: { focus?: string }) =>
    request<any>(`/tailor/${tailoredId}/rewrite`, "POST", payload ?? { focus: "balanced" }),

  downloadTailoredDocx: (tailoredId: string) => requestBlob(`/tailor/${tailoredId}/export/docx`),
  downloadTailoredPdf: (tailoredId: string) => requestBlob(`/tailor/${tailoredId}/export/pdf`),

  createPortfolioItem: async (payload: any) => {
    const links = asArray<string>(payload?.links).map((value) => String(value || "").trim()).filter(Boolean);
    const summary = String(payload?.summary ?? "").trim();
    const bullets = asArray<string>(payload?.bullets).map((value) => String(value || "").trim()).filter(Boolean);
    return normalizeEvidence(
      await request<any>("/evidence/", "POST", {
        user_id: payload?.user_id,
        user_email: payload?.user_email,
        type: ["project", "paper", "cert", "other"].includes(String(payload?.type ?? "")) ? payload.type : "other",
        title: payload?.title ?? "",
        source: links[0] ?? payload?.org ?? "structured-evidence",
        text_excerpt: [summary, ...bullets].filter(Boolean).join("\n") || payload?.title || "",
        skill_ids: asArray<string>(payload?.skill_ids),
        tags: asArray<string>(payload?.tags),
        origin: "user",
      })
    );
  },
  createPortfolioItemRaw: (payload: any) => request<any>("/portfolio/items", "POST", payload),
  listPortfolioItemsRaw: (params?: { user_id?: string; type?: string; visibility?: string }) => {
    const search = new URLSearchParams();
    if (params?.user_id) search.set("user_id", params.user_id);
    if (params?.type) search.set("type", params.type);
    if (params?.visibility) search.set("visibility", params.visibility);
    const suffix = search.size ? `?${search.toString()}` : "";
    return request<any[]>("/portfolio/items" + suffix, "GET");
  },
  listPortfolioItems: async (userId: string, params?: { type?: string; visibility?: string }) => {
    const evidence = await api.listEvidence({ user_id: userId, origin: "user" });
    return evidence.filter((item) => {
      if (params?.type && String(item.type || "") !== params.type) return false;
      return true;
    });
  },
  patchPortfolioItemRaw: (itemId: string, payload: any) => request<any>(`/portfolio/items/${itemId}`, "PATCH", payload),
  patchPortfolioItem: (itemId: string, payload: any) =>
    request<any>(EVIDENCE_UPDATE_ROUTE.replace("{evidence_id}", itemId), "PATCH", {
      type: ["project", "paper", "cert", "other"].includes(String(payload?.type ?? "")) ? payload?.type : payload?.type ? "other" : undefined,
      title: payload?.title,
      source: asArray<string>(payload?.links).map((value) => String(value || "").trim()).filter(Boolean)[0] ?? payload?.source,
      text_excerpt:
        payload?.summary != null || payload?.bullets != null
          ? [String(payload?.summary ?? "").trim(), ...asArray<string>(payload?.bullets).map((value) => String(value || "").trim()).filter(Boolean)]
              .filter(Boolean)
              .join("\n")
          : undefined,
      skill_ids: payload?.skill_ids,
      tags: payload?.tags,
    }),
  deletePortfolioItemRaw: (itemId: string) => request<any>(`/portfolio/items/${itemId}`, "DELETE"),
  deletePortfolioItem: (itemId: string) => request<any>(EVIDENCE_UPDATE_ROUTE.replace("{evidence_id}", itemId), "DELETE"),
};
