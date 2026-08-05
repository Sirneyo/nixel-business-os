"""Website research providers.

Given a discovered business, review its website to produce a short research
summary and find contact details by fetching real pages with httpx.
"""

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
