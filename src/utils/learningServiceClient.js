const LEARNING_SERVICE_URL =
  process.env.LEARNING_SERVICE_URL ||
  process.env.RESUME_ANALYZER_URL ||
  "http://localhost:8001";

function normalizeSignal(signal = {}) {
  return {
    sourceType: signal.source_type ?? signal.sourceType ?? "",
    sourceId: signal.source_id ?? signal.sourceId ?? "",
    category: signal.category ?? "general",
    skill: signal.skill ?? "",
    signalType: signal.signal_type ?? signal.signalType ?? "",
    weight: signal.weight ?? 0,
    confidence: signal.confidence ?? 0,
    roleRelevance: signal.role_relevance ?? signal.roleRelevance ?? 0,
    evidence: signal.evidence ?? "",
    metadata: signal.metadata ?? {},
  };
}

function normalizeWeakness(item = {}) {
  return {
    key: item.key ?? "",
    category: item.category ?? "general",
    label: item.label ?? "",
    severity: item.severity ?? "medium",
    urgency: item.urgency ?? "medium",
    confidence: item.confidence ?? 0,
    roleRelevance: item.role_relevance ?? item.roleRelevance ?? 0,
    score: item.score ?? 0,
    sourceSignals: (item.source_signals ?? item.sourceSignals ?? []).map(normalizeSignal),
    missingSkills: item.missing_skills ?? item.missingSkills ?? [],
    explanation: item.explanation ?? "",
  };
}

function normalizePlan(payload = {}) {
  return {
    projectId: payload.project_id ?? payload.projectId ?? "",
    targetRole: payload.target_role ?? payload.targetRole ?? "",
    roleFocus: payload.role_focus ?? payload.roleFocus ?? "general",
    weaknesses: (payload.weaknesses ?? []).map(normalizeWeakness),
    objectives: (payload.objectives ?? []).map((item) => ({
      id: item.id ?? "",
      title: item.title ?? "",
      category: item.category ?? "general",
      priority: item.priority ?? "medium",
      linkedWeaknessKeys: item.linked_weakness_keys ?? item.linkedWeaknessKeys ?? [],
      successCriteria: item.success_criteria ?? item.successCriteria ?? [],
    })),
    modules: (payload.modules ?? []).map((item) => ({
      id: item.id ?? "",
      title: item.title ?? "",
      objective: item.objective ?? "",
      whyItMatters: item.why_it_matters ?? item.whyItMatters ?? "",
      category: item.category ?? "general",
      priority: item.priority ?? "medium",
      estimatedMinutes: item.estimated_minutes ?? item.estimatedMinutes ?? 0,
      prerequisites: item.prerequisites ?? [],
      outcomes: item.outcomes ?? [],
      status: item.status ?? "not_started",
      orderIndex: item.order_index ?? item.orderIndex ?? 0,
      resources: item.resources ?? [],
    })),
    progress: {
      completedModules:
        payload.progress?.completed_modules ??
        payload.progress?.completedModules ??
        0,
      totalModules:
        payload.progress?.total_modules ?? payload.progress?.totalModules ?? 0,
      readinessScore:
        payload.progress?.readiness_score ??
        payload.progress?.readinessScore ??
        0,
      nextBestActions:
        payload.progress?.next_best_actions ??
        payload.progress?.nextBestActions ??
        [],
    },
    normalizedSignals: (payload.normalized_signals ?? payload.normalizedSignals ?? []).map(normalizeSignal),
  };
}

export async function generateQuiz({ moduleId, skill, category, targetRole, severity }) {
  const response = await fetch(`${LEARNING_SERVICE_URL}/learning/generate-quiz`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      module_id: moduleId, skill, category,
      target_role: targetRole, severity,
    }),
  });

  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error(`Learning service error ${response.status}`);
  }

  if (!response.ok) {
    throw new Error(data.detail || data.message || "Quiz generation failed");
  }

  return (data.questions ?? []).map((q) => ({
    id: q.id ?? "",
    question: q.question ?? "",
    options: q.options ?? [],
    correctIndex: q.correct_index ?? q.correctIndex ?? 0,
    explanation: q.explanation ?? "",
    difficulty: q.difficulty ?? "medium",
  }));
}

export async function generateLearningPlan(input) {
  const response = await fetch(`${LEARNING_SERVICE_URL}/learning/diagnose`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.detail || data.message || "Learning service failed");
  }

  return normalizePlan(data);
}

export async function diagnoseQuizConcepts({ skill, category, role, questions, answers }) {
  const response = await fetch(`${LEARNING_SERVICE_URL}/learning/diagnose-concepts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ skill, category, role, questions, answers }),
  });

  let data;
  try { data = await response.json(); }
  catch { throw new Error(`Learning service error ${response.status}`); }
  if (!response.ok) throw new Error(data.detail || data.message || "Concept diagnosis failed");

  return {
    skillLevel:        data.skill_level         ?? data.skillLevel        ?? "beginner",
    scorePct:          data.score_pct           ?? data.scorePct          ?? 0,
    conceptsKnown:     data.concepts_known       ?? data.conceptsKnown    ?? [],
    conceptsWeak:      data.concepts_weak        ?? data.conceptsWeak     ?? [],
    targetedResources: (data.targeted_resources  ?? data.targetedResources ?? []).map(r => ({
      concept:      r.concept        ?? "",
      label:        r.label          ?? "",
      url:          r.url            ?? "",
      platform:     r.platform       ?? "",
      type:         r.type           ?? "article",
      whyThisHelps: r.why_this_helps ?? r.whyThisHelps ?? "",
    })),
    summary:     data.summary     ?? "",
    diagnosedAt: new Date().toISOString(),
  };
}

export async function recommendProjects({ role, weakSkills, jdText }) {
  const response = await fetch(`${LEARNING_SERVICE_URL}/learning/recommend-projects`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role, weak_skills: weakSkills, jd_text: jdText || "" }),
  });

  let data;
  try { data = await response.json(); }
  catch { throw new Error(`Learning service error ${response.status}`); }
  if (!response.ok) throw new Error(data.detail || data.message || "Project recommendation failed");

  return {
    projects: (data.projects ?? []).map(p => ({
      title:              p.title                ?? "",
      description:        p.description          ?? "",
      difficulty:         p.difficulty           ?? "intermediate",
      estimatedHours:     p.estimated_hours      ?? p.estimatedHours      ?? 20,
      primarySkill:       p.primary_skill        ?? p.primarySkill        ?? "",
      relatedSkills:      p.related_skills       ?? p.relatedSkills       ?? [],
      whyThisProject:     p.why_this_project     ?? p.whyThisProject      ?? "",
      steps:              p.steps                ?? [],
      weakAreasAddressed: p.weak_areas_addressed ?? p.weakAreasAddressed  ?? [],
    })),
  };
}
