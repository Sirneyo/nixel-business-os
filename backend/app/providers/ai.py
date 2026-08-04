"""Lead qualification / relevance scoring.

`HeuristicScorer` produces a transparent rule-based score with a written
explanation, so the app is useful with no AI key. `AnthropicScorer` asks a
Claude model for a structured judgement when ANTHROPIC_API_KEY is set.
"""

import json
from dataclasses import dataclass

import httpx


@dataclass
class ScoreResult:
    score: float  # 0–100
    qualified: bool
    note: str  # Always explain WHY a lead was qualified or rejected.


class LeadScorer:
    name = "scorer"

    def score(
        self,
        *,
        company_name: str,
        description: str,
        research_summary: str,
        email_status: str,
        target_customer: str,
        criteria: str,
        website_reachable: bool,
    ) -> ScoreResult:
        raise NotImplementedError


class HeuristicScorer(LeadScorer):
    name = "Built-in Scorer"

    def score(self, *, company_name, description, research_summary, email_status, target_customer, criteria, website_reachable) -> ScoreResult:
        score = 50.0
        reasons: list[str] = []

        if not website_reachable:
            return ScoreResult(15.0, False, "Rejected: the website could not be reached, so the business cannot be researched or contacted reliably.")

        if email_status == "valid":
            score += 25
            reasons.append("a verified email address")
        elif email_status == "risky":
            score += 8
            reasons.append("a risky (role/catch-all) email")
        elif email_status in ("invalid", "not_found"):
            score -= 30
            reasons.append("no usable email address")

        if research_summary:
            score += 10
            reasons.append("website research completed")
        if description:
            score += 5

        # Naive keyword overlap between the brief and what we learned.
        brief_terms = {w.lower().strip(",.") for w in f"{target_customer} {criteria}".split() if len(w) > 4}
        found_text = f"{description} {research_summary}".lower()
        overlap = sum(1 for term in brief_terms if term in found_text)
        if overlap >= 3:
            score += 10
            reasons.append("a strong match with your target-customer brief")
        elif overlap >= 1:
            score += 5
            reasons.append("a partial match with your target-customer brief")

        score = max(0.0, min(100.0, score))
        qualified = score >= 60
        verdict = "Qualified" if qualified else "Rejected"
        detail = ", ".join(reasons) if reasons else "limited information found"
        return ScoreResult(score, qualified, f"{verdict} at {score:.0f}/100 based on {detail}.")


class AnthropicScorer(LeadScorer):
    name = "Claude Scorer"

    def __init__(self, api_key: str, model: str):
        self.api_key = api_key
        self.model = model
        self._fallback = HeuristicScorer()

    def score(self, *, company_name, description, research_summary, email_status, target_customer, criteria, website_reachable) -> ScoreResult:
        prompt = (
            "You are a lead-qualification analyst. Score how well this business matches the "
            "user's target customer, 0-100, and decide qualified (score >= 60).\n\n"
            f"Target customer: {target_customer or 'not specified'}\n"
            f"Extra criteria: {criteria or 'none'}\n\n"
            f"Business: {company_name}\n"
            f"Description: {description or 'unknown'}\n"
            f"Website research: {research_summary or 'none'}\n"
            f"Email verification: {email_status}\n"
            f"Website reachable: {website_reachable}\n\n"
            'Reply with ONLY JSON: {"score": <number>, "qualified": <bool>, "note": "<one sentence explaining why>"}'
        )
        try:
            response = httpx.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "x-api-key": self.api_key,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json",
                },
                json={
                    "model": self.model,
                    "max_tokens": 300,
                    "messages": [{"role": "user", "content": prompt}],
                },
                timeout=30,
            )
            response.raise_for_status()
            text = response.json()["content"][0]["text"].strip()
            if text.startswith("```"):
                text = text.strip("`").removeprefix("json").strip()
            data = json.loads(text)
            return ScoreResult(
                score=float(data.get("score", 0)),
                qualified=bool(data.get("qualified", False)),
                note=str(data.get("note", ""))[:1000] or "No explanation returned by the model.",
            )
        except Exception:
            # Never let a provider outage break the pipeline — fall back.
            return self._fallback.score(
                company_name=company_name,
                description=description,
                research_summary=research_summary,
                email_status=email_status,
                target_customer=target_customer,
                criteria=criteria,
                website_reachable=website_reachable,
            )
