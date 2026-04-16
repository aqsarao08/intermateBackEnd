import re
from collections import defaultdict
from typing import Dict, List

from app.services.skill_extractor import canonicalize

SECTION_PATTERNS = {
    "summary": r"\b(summary|profile|objective)\b",
    "skills": r"\b(skills|technical skills|tech stack)\b",
    "experience": r"\b(experience|employment|work history)\b",
    "projects": r"\b(projects|personal projects)\b",
    "education": r"\b(education|academics)\b",
}


def split_resume_lines(text: str) -> List[str]:
    return [line.strip() for line in text.splitlines() if line.strip()]


def detect_sections(text: str) -> Dict[str, str]:
    sections = defaultdict(list)
    current = "general"

    for line in split_resume_lines(text):
        lowered = line.lower()
        matched_section = None
        for section, pattern in SECTION_PATTERNS.items():
            if re.fullmatch(pattern, lowered):
                matched_section = section
                break
        if matched_section:
            current = matched_section
            continue
        sections[current].append(line)

    return {name: "\n".join(lines).strip() for name, lines in sections.items()}


def extract_bullets(text: str) -> List[str]:
    bullets = []
    for line in split_resume_lines(text):
        if re.match(r"^[-•*]", line) or len(line.split()) >= 6:
            bullets.append(line.lstrip("-•* ").strip())
    return bullets[:20]


def build_skill_evidence_map(resume_text: str, skills: List[str]) -> Dict[str, List[str]]:
    lines = split_resume_lines(resume_text)
    evidence_map: Dict[str, List[str]] = {}
    for skill in skills:
        needle = canonicalize(skill)
        evidence = [line for line in lines if needle in canonicalize(line)]
        evidence_map[skill] = evidence[:3]
    return evidence_map
