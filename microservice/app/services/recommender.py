from typing import Dict, List

from app.services.skill_extractor import categorize_skill

PROJECTABLE_CATEGORIES = {"frameworks", "cloud_devops", "testing", "domain_skills", "databases"}
SKILL_PROJECT_BLUEPRINTS = {
    "react": {
        "title": "React analytics dashboard",
        "description": "Build a multi-page React dashboard with reusable components, protected routes, charts, filters, pagination, and real API-backed data states.",
        "skills": ["react", "component architecture", "api integration", "client-side routing"],
    },
    "redux": {
        "title": "State-heavy React workspace app",
        "description": "Build a React workspace app with global state for auth, filters, notifications, and optimistic UI updates so you can demonstrate structured state management.",
        "skills": ["redux", "state management", "react", "api integration"],
    },
    "redux toolkit": {
        "title": "Redux Toolkit e-commerce frontend",
        "description": "Build an e-commerce frontend using Redux Toolkit slices, async thunks, cart flows, and persisted state connected to REST APIs.",
        "skills": ["redux toolkit", "state management", "react", "rest api"],
    },
    "hooks": {
        "title": "Custom hooks component library app",
        "description": "Build a React app that uses custom hooks for forms, fetching, debouncing, pagination, and modal state to prove practical hooks design.",
        "skills": ["hooks", "custom hooks", "react", "data fetching"],
    },
    "api integration": {
        "title": "API-driven admin portal",
        "description": "Build an admin portal that consumes multiple APIs with loading, retry, empty-state, and error-state handling across several user flows.",
        "skills": ["api integration", "data fetching", "react", "rest api"],
    },
    "responsive design": {
        "title": "Responsive SaaS marketing and dashboard app",
        "description": "Build a responsive product app that works cleanly across mobile, tablet, and desktop, with adaptive navigation and layout shifts tested deliberately.",
        "skills": ["responsive design", "css", "tailwind css", "cross-browser compatibility"],
    },
    "web accessibility": {
        "title": "Accessible booking interface",
        "description": "Build an interface with semantic HTML, keyboard navigation, aria labels, focus management, and accessible form/error handling.",
        "skills": ["web accessibility", "html", "css", "form validation"],
    },
    "performance optimization": {
        "title": "Performance-tuned React storefront",
        "description": "Build a React storefront that uses code splitting, lazy loading, memoized expensive flows, and image optimization with before/after performance notes.",
        "skills": ["performance optimization", "lazy loading", "code splitting", "react"],
    },
    "react testing library": {
        "title": "Test-covered React app",
        "description": "Build a React app with strong component and user-flow coverage using React Testing Library for interactions, async rendering, and edge states.",
        "skills": ["react testing library", "jest", "react", "testing"],
    },
    "jest": {
        "title": "Frontend testing showcase",
        "description": "Build a frontend app with Jest coverage for utility logic, form validation, async helpers, and critical UI behavior.",
        "skills": ["jest", "testing", "react", "form validation"],
    },
    "docker": {
        "title": "Dockerized deployment project",
        "description": "Build and ship a project with Docker, environment configuration, production build steps, and a deployment-ready README.",
        "skills": ["docker", "deployment", "ci/cd"],
    },
    "aws": {
        "title": "AWS-hosted application",
        "description": "Deploy a real app to AWS with storage, hosting, environment management, and a clear architecture diagram in the README.",
        "skills": ["aws", "deployment", "cloud"],
    },
}


def determine_priority(skill: str, required_skills: List[str], preferred_skills: List[str]) -> str:
    if skill in required_skills:
        return "high"
    if skill in preferred_skills:
        return "medium"
    return "low"


def determine_action_label(skill: str, evidence: List[str], priority: str) -> str:
    if evidence:
        return "Add now"
    if categorize_skill(skill) in PROJECTABLE_CATEGORIES and priority in {"high", "medium"}:
        return "Build project first"
    return "Learn first"


def build_skill_recommendations(
    missing_skills: List[str],
    required_skills: List[str],
    preferred_skills: List[str],
    evidence_map: Dict[str, List[str]],
    skill_context: Dict[str, str] | None = None,
) -> List[Dict[str, object]]:
    skill_context = skill_context or {}
    recommendations = []
    for skill in missing_skills:
        priority = determine_priority(skill, required_skills, preferred_skills)
        evidence = evidence_map.get(skill, [])
        action_label = determine_action_label(skill, evidence, priority)
        where_to_appear = "projects" if action_label == "Build project first" else "skills"
        context = skill_context.get(skill, "")
        recommendations.append({
            "skill": skill,
            "category": categorize_skill(skill),
            "priority": priority,
            "reason": context or ("Explicitly required in the JD" if skill in required_skills else "Helpful supporting skill from the JD"),
            "action_label": action_label,
            "why_it_matters": context or f"{skill} appears in the target role and improves direct job fit.",
            "where_to_appear": where_to_appear,
            "evidence": evidence,
            "can_add_now": bool(evidence),
        })
    return recommendations


def build_resume_action_plan(skill_recommendations: List[Dict[str, object]]) -> List[Dict[str, str]]:
    plan = []
    for recommendation in skill_recommendations[:5]:
        plan.append({
            "priority": recommendation["priority"],
            "action": f"{recommendation['action_label']}: {recommendation['skill']} in the {recommendation['where_to_appear']} section",
            "rationale": str(recommendation["why_it_matters"]),
        })
    return plan


def build_project_suggestions(skill_recommendations: List[Dict[str, object]], role_focus: str = "general") -> List[Dict[str, object]]:
    role_templates = {
        "frontend": {
            "title_suffix": "frontend portfolio project",
            "description": "Build a React app with reusable components, routing, API integration, loading/error states, and responsive UI. Add authentication, filtering, dashboards, and performance optimizations so the project proves production-style frontend skills.",
            "role_fit": "Frontend / React",
        },
        "backend": {
            "title_suffix": "backend systems project",
            "description": "Build a service-oriented API project with authentication, validation, database persistence, testing, and deployment. Include documentation, error handling, and at least one scaling or background-processing concern.",
            "role_fit": "Backend / API",
        },
        "fullstack": {
            "title_suffix": "full-stack showcase app",
            "description": "Build an end-to-end app with a modern frontend, secure backend API, database layer, authentication, and deployment workflow. Show real user flows, dashboards, and measurable product outcomes.",
            "role_fit": "Full-stack",
        },
        "general": {
            "title_suffix": "showcase project",
            "description": "Build a production-style project that demonstrates the missing job requirements with a clean architecture, measurable features, and polished resume-ready outcomes.",
            "role_fit": "Software Engineering",
        },
    }
    template = role_templates.get(role_focus, role_templates["general"])
    suggestions = []
    for recommendation in skill_recommendations:
        if recommendation["action_label"] != "Build project first":
            continue
        skill = recommendation["skill"]
        blueprint = SKILL_PROJECT_BLUEPRINTS.get(skill, {})
        title = blueprint.get("title", f"{skill.title()} {template['title_suffix']}")
        description = blueprint.get("description", template["description"])
        covered_skills = blueprint.get("skills", [skill])
        suggestions.append({
            "title": title,
            "why_it_helps": f"Creates portfolio proof for {skill} and turns this JD gap into visible evidence.",
            "description": f"{description} Make {skill} a visible part of the implementation, bullet points, and README.",
            "skills_covered": covered_skills,
            "role_fit": template["role_fit"],
            "resume_value": f"Turns {skill} from a keyword gap into credible project evidence.",
            "difficulty": "intermediate",
        })
        if len(suggestions) == 3:
            break
    return suggestions
