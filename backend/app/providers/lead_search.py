"""Business discovery providers.

`OpenStreetMapSearch` is the built-in, no-key search: it finds real businesses
through the free OpenStreetMap Nominatim API, so the Lead Engine works the
moment the app is installed. Coverage and contact data are community-maintained
and therefore thinner than Google's.

`GooglePlacesSearch` is the recommended upgrade — it finds richer results with
the Google Places Text Search API using the key from Settings → Connections
(or the environment).
"""

import time
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


# ── OpenStreetMap (built-in, no key required) ───────────────────────────────


# Words that carry no signal when matching OSM business names/categories.
_OSM_STOPWORDS = {
    "agency", "agencies", "company", "companies", "business", "businesses",
    "firm", "firms", "service", "services", "local", "small", "the", "and",
    "in", "of", "ltd", "limited", "shop", "store", "provider", "providers",
}


class OpenStreetMapSearch(LeadSearchProvider):
    name = "Built-in search (OpenStreetMap)"

    # OSM usage policies: identify the application and keep request rates low.
    # The engine makes at most three requests per run.
    USER_AGENT = "NixelBusinessOS-Starter/1.0 (https://nixelai.com/contact)"

    def search(self, *, industry: str, keywords: str, location: str, business_type: str, limit: int) -> list[BusinessResult]:
        cap = min(max(limit + 10, 20), 40)
        what = (business_type or industry or keywords or "business").strip()

        # Pass 1 — Nominatim free text. Works well for mapped categories
        # ("dentist in Leeds", "restaurant in Soho").
        results = self._nominatim(f"{what} in {location}".strip() if location else what, cap, location)
        if len(results) >= 3:
            return results

        # Pass 2 — Overpass area search. Catches businesses whose name or
        # category matches the brief even when Nominatim's free text fails
        # ("marketing agency", "accountant").
        try:
            deeper = self._overpass(what=f"{industry} {keywords} {business_type}", location=location, cap=cap)
        except httpx.HTTPError:
            deeper = []
        known = {r.company_name.lower() for r in results}
        results.extend(r for r in deeper if r.company_name.lower() not in known)
        return results

    # ── Nominatim ────────────────────────────────────────────────────────

    def _nominatim(self, query: str, cap: int, fallback_location: str) -> list[BusinessResult]:
        response = httpx.get(
            "https://nominatim.openstreetmap.org/search",
            params={
                "q": query,
                "format": "jsonv2",
                "limit": cap,
                "extratags": 1,
                "addressdetails": 1,
                "namedetails": 1,
            },
            headers={"User-Agent": self.USER_AGENT},
            timeout=25,
        )
        response.raise_for_status()

        results: list[BusinessResult] = []
        seen: set[str] = set()
        for item in response.json():
            names = item.get("namedetails") or {}
            name = (names.get("name") or item.get("name") or "").strip()
            if not name or name.lower() in seen:
                continue
            seen.add(name.lower())

            kind = (item.get("type") or "").replace("_", " ")
            category = (item.get("category") or "").replace("_", " ")
            label = kind if kind not in ("", "yes") else category
            results.append(self._result(name, item.get("extratags") or {}, item.get("address") or {}, label, fallback_location))
        return results

    # ── Overpass ─────────────────────────────────────────────────────────

    def _overpass(self, *, what: str, location: str, cap: int) -> list[BusinessResult]:
        area_id = self._area_id(location)
        if area_id is None:
            return []

        terms = [w for w in what.lower().split() if len(w) > 2 and w not in _OSM_STOPWORDS]
        term = terms[0] if terms else (what.split()[0] if what.split() else "business")

        # Businesses whose *name* or *category tag* mentions the term, within
        # the geocoded area. nwr = nodes + ways + relations.
        query = f"""
        [out:json][timeout:25];
        area({area_id})->.a;
        (
          nwr["name"~"{term}",i]["office"](area.a);
          nwr["name"~"{term}",i]["shop"](area.a);
          nwr["name"~"{term}",i]["amenity"](area.a);
          nwr["name"~"{term}",i]["craft"](area.a);
          nwr["office"~"{term}",i](area.a);
          nwr["shop"~"{term}",i](area.a);
          nwr["amenity"~"{term}",i](area.a);
          nwr["craft"~"{term}",i](area.a);
        );
        out tags {cap * 2};
        """
        # Public Overpass servers rate-limit aggressively; try each mirror in
        # turn and give the first one a moment to free a slot.
        response = None
        for attempt, url in enumerate([
            "https://overpass-api.de/api/interpreter",
            "https://overpass.kumi.systems/api/interpreter",
        ]):
            try:
                response = httpx.post(url, data={"data": query}, headers={"User-Agent": self.USER_AGENT}, timeout=30)
                response.raise_for_status()
                break
            except httpx.HTTPError:
                response = None
                if attempt == 0:
                    time.sleep(2)
        if response is None:
            return []

        results: list[BusinessResult] = []
        seen: set[str] = set()
        for element in response.json().get("elements", []):
            tags = element.get("tags") or {}
            name = (tags.get("name") or "").strip()
            if not name or name.lower() in seen:
                continue
            seen.add(name.lower())

            label = (tags.get("office") or tags.get("shop") or tags.get("amenity") or tags.get("craft") or "business").replace("_", " ")
            address = {"city": tags.get("addr:city", ""), "country": tags.get("addr:country", "")}
            results.append(self._result(name, tags, address, label, location))
            if len(results) >= cap:
                break
        return results

    def _area_id(self, location: str) -> int | None:
        """Geocode the location to an Overpass area id."""
        if not location.strip():
            return None
        response = httpx.get(
            "https://nominatim.openstreetmap.org/search",
            params={"q": location, "format": "jsonv2", "limit": 1},
            headers={"User-Agent": self.USER_AGENT},
            timeout=20,
        )
        response.raise_for_status()
        hits = response.json()
        if not hits:
            return None
        osm_type, osm_id = hits[0].get("osm_type"), hits[0].get("osm_id")
        if osm_type == "relation":
            return 3_600_000_000 + int(osm_id)
        if osm_type == "way":
            return 2_400_000_000 + int(osm_id)
        return None

    def _result(self, name: str, tags: dict, address: dict, label: str, fallback_location: str) -> BusinessResult:
        website = (tags.get("website") or tags.get("contact:website") or tags.get("url") or "").strip()
        town = address.get("city") or address.get("town") or address.get("village") or address.get("suburb") or ""
        country = address.get("country") or ""
        place = ", ".join(p for p in (town, country) if p) or (fallback_location or "")
        description = f"{name} is listed on OpenStreetMap as a {label}".rstrip() + (f" in {place}." if place else ".")
        return BusinessResult(
            company_name=name,
            website=website,
            location=place,
            description=description,
            extra={"engine": "openstreetmap"},
        )


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
