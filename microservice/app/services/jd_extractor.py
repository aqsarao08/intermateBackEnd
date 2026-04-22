from collections import Counter, defaultdict
from typing import Dict, List

from app.services.skill_extractor import canonicalize, extract_skills, group_skills

REQUIRED_MARKERS = ("must", "required", "need", "minimum", "responsibilities", "requirements")
PREFERRED_MARKERS = ("preferred", "plus", "bonus", "nice to have", "good to have")
SECTION_HEADERS = {
    "responsibilities": ("responsibilities", "what you'll do", "what you will do", "role responsibilities"),
    "requirements": ("requirements", "basic qualifications", "minimum qualifications", "required skills"),
    "preferred": ("preferred qualifications", "nice to have", "bonus", "preferred skills"),
}
ROLE_FOCUS_PRESETS = {
    "frontend": [
        "react", "next.js", "redux", "redux toolkit", "typescript", "javascript",
        "responsive design", "web accessibility", "api integration", "component architecture",
        "state management", "performance optimization", "jest", "react testing library",
        "css", "html", "tailwind css", "cross-browser compatibility", "hooks",
        "custom hooks", "context api", "data fetching", "client-side routing",
        "design systems", "lazy loading", "code splitting", "form validation",
    ],
    "backend": [
        "node.js", "express", "rest api", "authentication", "authorization",
        "mongodb", "postgresql", "docker", "aws", "ci/cd", "testing", "microservices",
    ],
    "fullstack": [
        "react", "next.js", "node.js", "express", "rest api", "mongodb",
        "postgresql", "authentication", "docker", "ci/cd", "testing",
    ],
    "marketing": [
        "digital marketing", "content marketing", "brand strategy", "market research",
        "social media marketing", "email marketing", "campaign management", "seo", "sem",
        "copywriting", "marketing analytics",
    ],
    "finance": [
        "financial analysis", "financial modeling", "accounting", "bookkeeping", "auditing",
        "budgeting", "forecasting", "variance analysis", "reporting", "excel", "power bi", "tableau",
    ],
    "hr": [
        "recruitment", "talent acquisition", "employee relations", "performance management",
        "onboarding", "training", "hr operations", "policy development", "stakeholder management",
    ],
    "operations": [
        "operations management", "process improvement", "project management", "vendor management",
        "supply chain", "inventory management", "procurement", "reporting", "documentation",
    ],
    "design": [
        "graphic design", "ui design", "ux design", "wireframing", "prototyping", "figma",
        "adobe photoshop", "adobe illustrator", "branding", "visual design", "user research",
    ],
}


def split_sentences(text: str) -> List[str]:
    return [line.strip(" -•\t") for line in text.splitlines() if line.strip()]


def split_jd_sections(text: str) -> Dict[str, List[str]]:
    sections = defaultdict(list)
    current = "general"

    for line in split_sentences(text):
        lowered = line.lower().rstrip(":")
        matched = False
        for section_name, headers in SECTION_HEADERS.items():
            if lowered in headers:
                current = section_name
                matched = True
                break
        if matched:
            continue
        sections[current].append(line)

    return dict(sections)


def infer_role_focus(jd_text: str) -> str:
    lowered = jd_text.lower()
    if "front end" in lowered or "frontend" in lowered or "react" in lowered or "ui" in lowered:
        return "frontend"
    if "back end" in lowered or "backend" in lowered or "api" in lowered or "microservice" in lowered:
        return "backend"
    if "full stack" in lowered or "fullstack" in lowered:
        return "fullstack"
    if any(term in lowered for term in ("marketing", "campaign", "seo", "social media", "brand")):
        return "marketing"
    if any(term in lowered for term in ("finance", "accounting", "financial", "budget", "forecast")):
        return "finance"
    if any(term in lowered for term in ("human resources", "recruitment", "talent acquisition", "employee relations", "hr ")):
        return "hr"
    if any(term in lowered for term in ("operations", "procurement", "supply chain", "vendor management", "inventory")):
        return "operations"
    if any(term in lowered for term in ("designer", "design", "figma", "wireframe", "prototype", "branding")):
        return "design"
    return "general"


def extract_ranked_phrases(jd_text: str, role_focus: str) -> List[str]:
    counts = Counter()
    sections = split_jd_sections(jd_text)
    all_lines = split_sentences(jd_text)

    section_weights = {
        "requirements": 5,
        "preferred": 3,
        "responsibilities": 2,
        "general": 1,
    }

    line_occurrences = Counter()
    for line in all_lines:
        for phrase in extract_skills(line):
            line_occurrences[phrase] += 1

    for section_name, lines in sections.items():
        weight = section_weights.get(section_name, 1)
        for line in lines:
            lowered = canonicalize(line)
            for phrase in extract_skills(line):
                score = weight
                if any(marker in lowered for marker in REQUIRED_MARKERS):
                    score += 3
                if any(marker in lowered for marker in PREFERRED_MARKERS):
                    score += 1
                if role_focus in ROLE_FOCUS_PRESETS and phrase in ROLE_FOCUS_PRESETS[role_focus]:
                    score += 2
                if phrase in lowered and ("," in line or " and " in lowered or "/" in line):
                    score += 1
                if line_occurrences[phrase] > 1:
                    score += min(3, line_occurrences[phrase] - 1)
                counts[phrase] += score

    for phrase in ROLE_FOCUS_PRESETS.get(role_focus, []):
        if phrase in canonicalize(jd_text):
            counts[phrase] += 2

    ranked = [phrase for phrase, _ in counts.most_common()]
    return ranked


def build_skill_context_map(jd_text: str, skills: List[str]) -> Dict[str, str]:
    context: Dict[str, str] = {}
    sentences = split_sentences(jd_text)
    for skill in skills:
        needle = canonicalize(skill)
        for sentence in sentences:
            if needle in canonicalize(sentence):
                context[skill] = sentence
                break
    return context


def extract_jd_requirements(jd_text: str) -> Dict[str, List[str] | Dict[str, List[str]]]:
    role_focus = infer_role_focus(jd_text)
    sections = split_jd_sections(jd_text)
    required = set()
    preferred = set()
    responsibilities = []
    qualifications = []

    for section_name, lines in sections.items():
        for sentence in lines:
            lowered = sentence.lower()
            skills = extract_skills(sentence)

            if section_name == "requirements" or any(marker in lowered for marker in REQUIRED_MARKERS):
                required.update(skills)
                qualifications.append(sentence)
            elif section_name == "preferred" or any(marker in lowered for marker in PREFERRED_MARKERS):
                preferred.update(skills)
            else:
                responsibilities.append(sentence)

    all_skills = extract_ranked_phrases(jd_text, role_focus)
    if not all_skills:
        fallback_skills = extract_skills(jd_text)
        preset_hits = [
            skill
            for skill in ROLE_FOCUS_PRESETS.get(role_focus, [])
            if canonicalize(skill) in canonicalize(jd_text)
        ]
        all_skills = list(dict.fromkeys([*fallback_skills, *preset_hits]))

    if not all_skills and role_focus in ROLE_FOCUS_PRESETS:
        all_skills = ROLE_FOCUS_PRESETS[role_focus][:8]

    if not required:
        required.update(all_skills[: min(8, len(all_skills))])
    else:
        required = set(sorted(required, key=lambda skill: all_skills.index(skill) if skill in all_skills else 999))

    domain_terms = [skill for skill in all_skills if canonicalize(skill) not in required | preferred]
    grouped = group_skills(all_skills)
    skill_context = build_skill_context_map(jd_text, all_skills)

    return {
        "required_skills": sorted(required),
        "preferred_skills": sorted(preferred - required),
        "all_skills": all_skills,
        "responsibilities": responsibilities[:10],
        "qualifications": qualifications[:10],
        "domain_terms": domain_terms[:10],
        "skill_groups": grouped,
        "skill_context": skill_context,
        "role_focus": role_focus,
        "sectioned_lines": sections,
    }
