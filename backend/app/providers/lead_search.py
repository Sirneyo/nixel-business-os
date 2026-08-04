"""Business discovery providers.

`DemoLeadSearch` fabricates plausible businesses from the search brief so the
engine can be explored with zero configuration. `GooglePlacesSearch` uses the
Google Places Text Search API when a key is configured.
"""

import random
from dataclasses import dataclass, field

import httpx


@dataclass
class BusinessResult:
    company_name: str
    website: str = ""
    location: str = ""
    description: str = ""
    extra: dict = field(default_factory=dict)


class LeadSearchProvider:
    name = "search"

    def search(self, *, industry: str, keywords: str, location: str, business_type: str, limit: int) -> list[BusinessResult]:
        raise NotImplementedError


# ── Demo provider ───────────────────────────────────────────────────────────

_PREFIXES = [
    "Summit", "Harbor", "Beacon", "Crestwood", "Northgate", "Silverline", "Oakfield",
    "Brightway", "Keystone", "Bluepeak", "Redwood", "Lakeside", "Ironbridge", "Fairview",
    "Stonepath", "Meridian", "Clearwater", "Highland", "Westbrook", "Goldcrest", "Arbor",
    "Pinnacle", "Cedar", "Vertex", "Horizon", "Anchor", "Trailhead", "Copperfield",
]

_SUFFIX_BY_TYPE = {
    "agency": ["Agency", "Partners", "Group", "Studio", "Collective"],
    "consultancy": ["Consulting", "Advisory", "Associates", "Partners"],
    "retail": ["Stores", "Retail", "Trading Co", "Supply"],
    "restaurant": ["Kitchen", "Bistro", "Eatery", "Table"],
    "default": ["Ltd", "Group", "Co", "Solutions", "Services", "Partners"],
}

_DESCRIPTION_TEMPLATES = [
    "{name} is a {industry} business serving clients in {location}. They focus on {kw} and have an established local presence.",
    "A growing {industry} company based in {location}. {name} works with small and mid-sized clients on {kw}.",
    "{name} provides {kw} services for the {industry} sector, operating primarily around {location}.",
    "Family-run {industry} firm in {location}. Recent activity suggests {name} is expanding its {kw} offering.",
    "{name} is an independent {industry} provider in {location} with a small in-house team and a focus on {kw}.",
]


class DemoLeadSearch(LeadSearchProvider):
    name = "Demo Search"

    def search(self, *, industry: str, keywords: str, location: str, business_type: str, limit: int) -> list[BusinessResult]:
        rng = random.Random(f"{industry}|{keywords}|{location}|{business_type}")
        suffixes = _SUFFIX_BY_TYPE.get((business_type or "").strip().lower(), _SUFFIX_BY_TYPE["default"])
        industry_label = (industry or "local").strip() or "local"
        kw = (keywords.split(",")[0].strip() if keywords else industry_label) or "their core services"
        loc = (location or "their region").strip() or "their region"

        prefixes = rng.sample(_PREFIXES, k=min(len(_PREFIXES), max(limit + 4, 8)))
        results: list[BusinessResult] = []
        for prefix in prefixes[: limit + 4]:
            suffix = rng.choice(suffixes)
            name = f"{prefix} {industry_label.title()} {suffix}".replace("  ", " ")
            slug = f"{prefix}{suffix}".lower().replace(" ", "")
            desc = rng.choice(_DESCRIPTION_TEMPLATES).format(name=name, industry=industry_label, location=loc, kw=kw)
            results.append(
                BusinessResult(
                    company_name=name,
                    website=f"https://www.{slug}.example.com",
                    location=loc,
                    description=desc,
                    extra={"demo": True},
                )
            )
        return results


# ── Google Places ───────────────────────────────────────────────────────────


class GooglePlacesSearch(LeadSearchProvider):
    name = "Google Places"

    def __init__(self, api_key: str):
        self.api_key = api_key

    def search(self, *, industry: str, keywords: str, location: str, business_type: str, limit: int) -> list[BusinessResult]:
        query = " ".join(p for p in [business_type or industry, keywords, "in", location] if p).strip()
        response = httpx.post(
            "https://places.googleapis.com/v1/places:searchText",
            json={"textQuery": query, "maxResultCount": min(max(limit + 5, 10), 20)},
            headers={
                "X-Goog-Api-Key": self.api_key,
                "X-Goog-FieldMask": "places.displayName,places.websiteUri,places.formattedAddress,places.primaryTypeDisplayName",
            },
            timeout=20,
        )
        response.raise_for_status()
        places = response.json().get("places", [])
        results: list[BusinessResult] = []
        for place in places:
            results.append(
                BusinessResult(
                    company_name=place.get("displayName", {}).get("text", "Unknown business"),
                    website=place.get("websiteUri", "") or "",
                    location=place.get("formattedAddress", "") or "",
                    description=place.get("primaryTypeDisplayName", {}).get("text", "") or "",
                )
            )
        return results
