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
    found = {skill for skill in FLAT_SKILLS if skill in lowered}

    phrase_patterns = [
        r"\bfront[\s-]?end\b",
        r"\