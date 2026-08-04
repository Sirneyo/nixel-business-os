"""Website research providers.

Given a discovered business, review its website to produce a short research
summary and find contact details. The live researcher fetches real pages with
httpx; the demo researcher fabricates consistent, clearly-plausible results.
"""

import random
import re
from dataclasses import dataclass, field

import httpx

EMAIL_RE = re.compile(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}")
GENERIC_PREFIXES = ("info", "hello", "contact", "office", "enquiries", "admin", "support", "sales")


@dataclass
class ResearchResult:
    summary: str = ""
    pages_reviewed: list[str] = field(default_factory=list)
    emails_found: list[str] = field(default_factory=list)
    contact_name: str = ""
    contact_role: str = ""
    reachable: bool = True
    notes: str = ""


class WebsiteResearcher:
    name = "research"

    def research(self, *, company_name: str, website: str, industry: str) -> ResearchResult:
        raise NotImplementedError


# ── Live researcher ─────────────────────────────────────────────────────────

CONTACT_PATHS = ["", "/contact", "/contact-us", "/about", "/about-us", "/team"]


class LiveWebsiteResearcher(WebsiteResearcher):
    name = "Live Website Research"

    def research(self, *, company_name: str, website: str, industry: str) -> ResearchResult:
        result = ResearchResult()
        if not website:
            result.reachable = False
            result.notes = "No website listed for this business."
            return result

        base = website.rstrip("/")
        emails: list[str] = []
        text_sample = ""
        with httpx.Client(
            timeout=12, follow_redirects=True, headers={"User-Agent": "NixelStarter/1.0 (business research)"}
        ) as client:
            for path in CONTACT_PATHS:
                url = f"{base}{path}"
                try:
                    response = client.get(url)
                except httpx.HTTPError:
                    continue
                if response.status_code >= 400:
                    continue
                result.pages_reviewed.append(url)
                html = response.text[:200_000]
                for email in EMAIL_RE.findall(html):
                    email = email.lower().strip(".")
                    if email not in emails and not email.endswith((".png", ".jpg", ".svg", ".gif", ".webp")):
                        emails.append(email)
                if not text_sample and path in ("", "/about", "/about-us"):
                    text_sample = re.sub(r"<[^>]+>", " ", html)
                    text_sample = re.sub(r"\s+", " ", text_sample)[:600]

        if not result.pages_reviewed:
            result.reachable = False
            result.notes = "Website could not be reached."
            return result

        result.emails_found = emails[:5]
        if text_sample:
            result.summary = f"Reviewed {len(result.pages_reviewed)} page(s). Site excerpt: {text_sample[:400]}"
        else:
            result.summary = f"Reviewed {len(result.pages_reviewed)} page(s); no readable description found."
        return result


# ── Demo researcher ─────────────────────────────────────────────────────────

_FIRST = ["Sarah", "James", "Priya", "Daniel", "Amelia", "Marcus", "Elena", "Tom", "Grace", "Victor", "Nadia", "Owen"]
_LAST = ["Whitfield", "Okafor", "Bennett", "Kaur", "Marsh", "Delgado", "Hughes", "Lindberg", "Carter", "Adeyemi"]
_ROLES = ["Owner", "Managing Director", "Founder", "Operations Manager", "General Manager", "Director"]

_SUMMARIES = [
    "Reviewed homepage, about and contact pages. The site presents a small {industry} team with clear service pages and recent updates, suggesting an active business.",
    "Reviewed 3 pages. The website is dated but functional; services match the search brief and a named owner appears on the about page.",
    "Reviewed homepage and team page. Well-maintained {industry} site with case studies and a published contact address.",
    "Reviewed 4 pages. Site emphasises local {industry} work; no pricing published, contact form plus a direct email listed.",
]


class DemoWebsiteResearcher(WebsiteResearcher):
    name = "Demo Website Research"

    def research(self, *, company_name: str, website: str, industry: str) -> ResearchResult:
        rng = random.Random(company_name)
        result = ResearchResult()

        # A small share of demo sites are unreachable, so users see failures too.
        if rng.random() < 0.12:
            result.reachable = False
            result.notes = "Website did not respond after 3 attempts."
            return result

        domain = re.sub(r"^https?://(www\.)?", "", website).rstrip("/") or "example.com"
        result.pages_reviewed = [f"https://{domain}", f"https://{domain}/about", f"https://{domain}/contact"]
        result.summary = rng.choice(_SUMMARIES).format(industry=industry or "local")

        first, last = rng.choice(_FIRST), rng.choice(_LAST)
        if rng.random() < 0.7:
            result.contact_name = f"{first} {last}"
            result.contact_role = rng.choice(_ROLES)
            result.emails_found.append(f"{first.lower()}@{domain}")
        if rng.random() < 0.8:
            result.emails_found.append(f"{rng.choice(GENERIC_PREFIXES)}@{domain}")
        return result
