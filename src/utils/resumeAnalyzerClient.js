import FormData from "form-data";

const ANALYZER_URL = process.env.RESUME_ANALYZER_URL || "http://localhost:8001";

function normalizeAnalysis(payload = {}) {
  const scoreBreakdown = payload.score_breakdown ?? payload.scoreBreakdown ?? {};
  const rawExtractions = payload.raw_extractions ?? payload.rawExtractions ?? {};
  return {
    atsScore: payload.ats_score ?? payload.atsScore ?? payload.match_score ?? payload.matchScore ?? 0,
    matchLevel: payload.match_level ?? payload.matchLevel ?? "weak",
    scoreBreakdown: {
      keywordMatch: scoreBreakdown.keyword_match ?? scoreBreakdown.keywordMatch ?? 0,
      hardRequirementCoverage: scoreBreakdown.hard_requirement_coverage ?? scoreBreakdown.hardRequirementCoverage ?? 0,
      semanticSimilarity: scoreBreakdown.semantic_similarity ?? scoreBreakdown.semanticSimilarity ?? 0,
      experienceAlignment: scoreBreakdown.experience_alignment ?? scoreBreakdown.experienceAlignment ?? 0,
      projectRelevance: scoreBreakdown.project_relevance ?? scoreBreakdown.projectRelevance ?? 0,
      formattingSectionQuality: scoreBreakdown.formatting_section_quality ?? scoreBreakdown.formattingSectionQuality ?? 0,
    },
    matchedKeywords: payload.matched_keywords ?? payload.matchedKeywords ?? [],
    missingKeywords: payload.missing_keywords ?? payload.missingKeywords ?? [],
    jdKeywords: payload.jd_keywords ?? payload.jdKeywords ?? rawExtractions.jd_all_skills ?? [],
    jdRequiredSkills: payload.jd_required_skills ?? payload.jdRequiredSkills ?? rawExtractions.jd_required_skills ?? [],
    jdNiceToHave: payload.jd_nice_to_have ?? payload.jdNiceToHave ?? rawExtractions.jd_preferred_skills ?? [],
    jdSeniority: payload.jd_seniority ?? payload.jdSeniority ?? "Not specified",
    hardRequirementsMatched: payload.hard_requirements_matched ?? payload.hardRequirementsMatched ?? [],
    hardRequirementsMissing: payload.hard_requirements_missing ?? payload.hardRequirementsMissing ?? [],
    preferredRequirementsMissing: payload.preferred_requirements_missing ?? payload.preferredRequirementsMissing ?? [],
    strengths: payload.strengths ?? payload.resume_strengths ?? payload.resumeStrengths ?? [],
    weaknesses: payload.weaknesses ?? payload.resume_weaknesses ?? payload.resumeWeaknesses ?? [],
    atsSuggestions: payload.ats_suggestions ?? payload.atsSuggestions ?? [],
    improvementSuggestions: payload.improvement_suggestions ?? payload.improvementSuggestions ?? [],
    missingSkillGroups: payload.missing_skill_groups ?? payload.missingSkillGroups ?? {},
    skillRecommendations: payload.skill_recommendations ?? payload.skillRecommendations ?? [],
    learningPriority: payload.learning_priority ?? payload.learningPriority ?? {},
    resumeActionPlan: payload.resume_action_plan ?? payload.resumeActionPlan ?? [],
    projectSuggestions: payload.project_suggestions ?? payload.projectSuggestions ?? [],
    bulletRewrites: payload.bullet_rewrites ?? payload.bulletRewrites ?? [],
    optimizedSummary: payload.optimized_summary ?? payload.optimizedSummary ?? "",
    structureSuggestions: payload.structure_suggestions ?? payload.structureSuggestions ?? [],
    sectionScores: payload.section_scores ?? payload.sectionScores ?? [],
    analysisMeta: payload.analysis_meta ?? payload.analysisMeta ?? {},
    resumeText: payload.resume_text ?? payload.resumeText ?? "",
    jdText: payload.jd_text ?? payload.jdText ?? payload.jobDescriptionText ?? "",
  };
}

export async function analyzeDocuments({ resumeFile, jdFile, jdText }) {
  const form = new FormData();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 180000);

  form.append("resume_file", resumeFile.buffer, {
    filename: resumeFile.originalname,
    contentType: resumeFile.mimetype,
  });

  if (jdFile) {
    form.append("jd_file", jdFile.buffer, {
      filename: jdFile.originalname,
      contentType: jdFile.mimetype,
    });
  }

  if (jdText?.trim()) {
    form.append("jd_text", jdText.trim());
  }

  const body = form.getBuffer();
  const headers = {
    ...form.getHeaders(),
    "Content-Length": String(body.length),
  };

  let response;
  try {
    response = await fetch(`${ANALYZER_URL}/analyze`, {
      method: "POST",
      headers,
      body,
      signal: controller.signal,
    });
  } catch (error) {
    clearTimeout(timeout);
    if (error?.name === "AbortError") {
      throw new Error("Resume analyzer timed out while reprocessing this file. Please try again.");
    }
    throw error;
  }

  clearTimeout(timeout);

  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error(`Resume analyzer error ${response.status}: ${await response.text().catch(() => "no details")}`);
  }

  if (!response.ok) {
    throw new Error(data.detail || data.message || `Resume analyzer service failed (${response.status})`);
  }

  return normalizeAnalysis(data);
}

export async function analyzeStoredTexts({ resumeText, jdText }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 180000);

  let response;
  try {
    response = await fetch(`${ANALYZER_URL}/analyze/text`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        resume_text: resumeText,
        jd_text: jdText,
      }),
      signal: controller.signal,
    });
  } catch (error) {
    clearTimeout(timeout);
    if (error?.name === "AbortError") {
      throw new Error("Resume analyzer timed out while analyzing stored text. Please try again.");
    }
    throw error;
  }

  clearTimeout(timeout);

  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error(`Resume analyzer error ${response.status}: ${await response.text().catch(() => "no details")}`);
  }

  if (!response.ok) {
    throw new Error(data.detail || data.message || `Resume analyzer text analysis failed (${response.status})`);
  }

  return normalizeAnalysis(data);
}

export async function extractJobDescription(jobDescriptionFile) {
  const form = new FormData();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);

  form.append("job_description_file", jobDescriptionFile.buffer, {
    filename: jobDescriptionFile.originalname,
    contentType: jobDescriptionFile.mimetype,
  });

  const body = form.getBuffer();
  const headers = {
    ...form.getHeaders(),
    "Content-Length": String(body.length),
  };

  let response;
  try {
    response = await fetch(`${ANALYZER_URL}/extract-job-description`, {
      method: "POST",
      headers,
      body,
      signal: controller.signal,
    });
  } catch (error) {
    clearTimeout(timeout);
    if (error?.name === "AbortError") {
      throw new Error("Job description extraction timed out. Please try again.");
    }
    throw error;
  }

  clearTimeout(timeout);

  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error(`Extraction service error ${response.status}: ${await response.text().catch(() => "no details")}`);
  }

  if (!response.ok) {
    throw new Error(data.detail || data.message || `Job description extraction failed (${response.status})`);
  }

  return data.text || "";
}
