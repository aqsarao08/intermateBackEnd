import re
from collections import defaultdict
from functools import lru_cache
from typing import Dict, List, Set

import spacy

from app.core.config import get_settings

SKILL_TAXONOMY: Dict[str, List[str]] = {
    "languages": ["python", "java", "javascript", "typescript", "c++", "go", "rust", "sql", "html", "css"],
    "frameworks": [
        "react", "react.js", "next.js", "node.js", "express", "fastapi", "django", "spring boot", "graphql",
        "redux", "redux toolkit", "context api", "tailwind css", "bootstrap", "material ui", "vite",
        "storybook", "webpack", "formik", "tanstack query", "react router",
    ],
    "databases": ["mongodb", "postgresql", "mysql", "redis", "elasticsearch", "firebase"],
    "cloud_devops": [
        "aws", "azure", "gcp", "docker", "kubernetes", "ci/cd", "github actions", "terraform", "nginx",
        "vercel", "netlify", "linux",
    ],
    "testing": [
        "jest", "mocha", "pytest", "cypress", "unit testing", "integration testing", "automation testing",
        "react testing library", "playwright", "storybook testing",
    ],
    "soft_skills": ["communication", "teamwork", "leadership", "problem solving", "agile", "scrum", "collaboration"],
    "domain_skills": [
        "rest api", "microservices", "authentication", "authorization", "scalable apis", "system design",
        "responsive design", "state management", "component architecture", "api integration",
        "performance optimization", "web accessibility", "seo", "cross-browser compatibility",
        "hooks", "custom hooks", "ui engineering", "design systems", "data fetching",
        "lazy loading", "code splitting", "form validation", "client-side routing",
    ],
}

FLAT_SKILLS: Set[str] = {skill for skills in SKILL_TAXONOMY.values() for skill in skills}

# Skills that are also common English words — only extract when they appear
# capitalized in the ORIGINAL text (e.g. "Go" not "go", "R" not "r").
CASE_SENSITIVE_SKILLS: Set[str] = {"go", "r", "c", "a"}

# Pre-compile word-boundary patterns for every skill to avoid substring false positives.
# "go" in "good" or "going" won't match \bgo\b.
_SKILL_PATTERNS: Dict[str, re.Pattern] = {
    skill: re.compile(r"\b" + re.escape(skill) + r"\b", re.IGNORECASE)
    for skill in FLAT_SKILLS
}


@lru_cache(maxsize=1)
def get_nlp():
    settings = get_settings()
    return spacy.load(settings.spacy_model)


def canonicalize(skill: str) -> str:
    skill = skill.lower().strip()
    skill = skill.replace("nodejs", "node.js").replace("nextjs", "next.js")
    skill = skill.replace("reactjs", "react").replace("react.js", "react")
    skill = skill.replace("tailwind", "tailwind css")
    skill = skill.replace("react hooks", "hooks").replace("hooks api", "hooks")
    skill = skill.replace("context", "context api") if skill == "context" else skill
    skill = skill.replace("react router dom", "react router")
    skill = skill.replace("react-query", "tanstack query").replace("react query", "tanstack query")
    skill = skill.replace("rtl", "react testing library")
    skill = skill.replace("a11y", "web accessibility")
    skill = skill.replace("restful api", "rest api").replace("restful apis", "rest api")
    skill = skill.replace("restful services", "rest api").replace("rest apis", "rest api")
    skill = skill.replace("responsive ui", "responsive design").replace("responsive interfaces", "responsive design")
    skill = skill.replace("api consumption", "api integration").replace("fetching data", "data fetching")
    skill = re.sub(r"\s+", " ", skill)
    return skill


def categorize_skill(skill: str) -> str:
    skill = canonicalize(skill)
    for category, skills in SKILL_TAXONOMY.items():
        if skill in skills:
            return category
    return "other"


def extract_skills(text: str) -> List[str]:
    lowered = canonicalize(text)
    found: Set[str] = set()
    for skill, pattern in _SKILL_PATTERNS.items():
        if skill in CASE_SENSITIVE_SKILLS:
            # Require the original (pre-lower) text to have it capitalised
            cap_pattern = re.compile(r"\b" + re.escape(skill.capitalize()) + r"\b")
            if not cap_pattern.search(text):
                continue
        if pattern.search(lowered):
            found.add(skill)

    phrase_patterns = [
        r"\bfront[\s-]?end\b",
        r"\bback[\s-]?end\b",
        r"\bfull[\s-]?stack\b",
        r"\bstate management\b",
        r"\bcomponent architecture\b",
        r"\bperformance optimization\b",
        r"\bapi integration\b",
        r"\bresponsive design\b",
        r"\bresponsive ui\b",
        r"\bweb accessibility\b",
        r"\bcross-browser compatibility\b",
        r"\bhooks\b",
        r"\bcustom hooks\b",
        r"\bcontext api\b",
        r"\bdesign systems?\b",
        r"\bdata fetching\b",
        r"\blazy loading\b",
        r"\bcode splitting\b",
        r"\bform validation\b",
        r"\bclient-side routing\b",
    ]
    for pattern in phrase_patterns:
        for match in re.findall(pattern, lowered, flags=re.I):
            found.add(canonicalize(match))

    doc = get_nlp()(text)
    for chunk in doc.noun_chunks:
        candidate = canonicalize(chunk.text)
        if candidate in FLAT_SKILLS:
            found.add(candidate)

    for ent in doc.ents:
        candidate = canonicalize(ent.text)
        if candidate in FLAT_SKILLS:
            found.add(candidate)

    return sorted(found)


def group_skills(skills: List[str]) -> Dict[str, List[str]]:
    groups = defaultdict(list)
    for skill in sorted({canonicalize(skill) for skill in skills}):
        groups[categorize_skill(skill)].append(skill)
    return dict(groups)
