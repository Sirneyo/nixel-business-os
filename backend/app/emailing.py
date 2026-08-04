"""Email rendering and personalisation.

Templates are stored as a JSON list of simple blocks and rendered to
email-safe, table-based, inline-styled HTML. Merge tokens use the
`{{token}}` style and resolve from the lead plus the user's business profile.
"""

import html as html_lib
import json
import re

from sqlalchemy.orm import Session

from .models import EmailTemplate, Lead, Setting

# ── Merge fields ────────────────────────────────────────────────────────────

TOKEN_RE = re.compile(r"\{\{\s*([a-zA-Z0-9_]+)\s*\}\}")

MERGE_FIELDS: dict[str, str] = {
    "first_name": "Lead contact's first name",
    "contact_name": "Lead contact's full name",
    "company_name": "Lead's company name",
    "industry": "Lead's industry",
    "location": "Lead's town or city",
    "sender_name": "Your sender name (from the campaign)",
    "business_name": "Your business name (from onboarding)",
    "primary_offer": "Your primary offer (from onboarding)",
}

SAMPLE_VALUES = {
    "first_name": "Sarah",
    "contact_name": "Sarah Whitfield",
    "company_name": "Summit Interiors Ltd",
    "industry": "interior design",
    "location": "Manchester",
    "sender_name": "Alex",
    "business_name": "Your Business",
    "primary_offer": "your primary offer",
}


def _profile_value(db: Session, key: str, fallback: str) -> str:
    row = db.query(Setting).filter(Setting.key == key).first()
    return row.value if row and row.value else fallback


def merge_values(db: Session, lead: Lead | None, sender_name: str = "") -> dict[str, str]:
    contact = (lead.contact_name if lead else "") or ""
    first = contact.split(" ")[0] if contact else "there"
    return {
        "first_name": first,
        "contact_name": contact or "there",
        "company_name": (lead.company_name if lead else "") or "your company",
        "industry": (lead.industry if lead else "") or "your industry",
        "location": (lead.location if lead else "") or "your area",
        "sender_name": sender_name or _profile_value(db, "profile.business_name", "The team"),
        "business_name": _profile_value(db, "profile.business_name", "Your Business"),
        "primary_offer": _profile_value(db, "profile.primary_offer", "our services"),
    }


def substitute(text: str, values: dict[str, str]) -> str:
    def repl(match: re.Match) -> str:
        return values.get(match.group(1), match.group(0))

    return TOKEN_RE.sub(repl, text)


def find_tokens(text: str) -> list[str]:
    return sorted({m.group(1) for m in TOKEN_RE.finditer(text)})


# ── Rendering ───────────────────────────────────────────────────────────────

DEFAULTS = {
    "background_color": "#f4f5f7",
    "card_color": "#ffffff",
    "primary_color": "#16a34a",
    "text_color": "#1f2937",
    "heading_color": "#0f172a",
    "font_family": "Arial, Helvetica, sans-serif",
}

ALLOWED_INLINE = re.compile(r"</?(b|strong|i|em|u|br|a)(\s+href=\"[^\"]*\")?\s*/?>", re.IGNORECASE)


def _clean_inline(html: str) -> str:
    """Escape everything except a small allow-list of inline formatting tags."""
    placeholder_map: dict[str, str] = {}

    def stash(match: re.Match) -> str:
        key = f"\x00{len(placeholder_map)}\x00"
        placeholder_map[key] = match.group(0)
        return key

    stashed = ALLOWED_INLINE.sub(stash, html)
    escaped = html_lib.escape(stashed, quote=False)
    for key, original in placeholder_map.items():
        escaped = escaped.replace(key, original)
    return escaped


def render_blocks_html(blocks: list[dict], settings: dict | None = None) -> str:
    s = {**DEFAULTS, **(settings or {})}
    rows: list[str] = []
    base = f"font-family:{s['font_family']}; color:{s['text_color']}; font-size:15px; line-height:1.6;"

    for block in blocks:
        kind = block.get("type", "text")
        if kind == "heading":
            level = int(block.get("level", 2))
            size = {1: 28, 2: 22, 3: 18}.get(level, 22)
            rows.append(
                f'<tr><td style="padding:8px 32px; {base} font-size:{size}px; font-weight:bold; '
                f"color:{s['heading_color']};\">{_clean_inline(block.get('text', ''))}</td></tr>"
            )
        elif kind == "text":
            rows.append(f'<tr><td style="padding:8px 32px; {base}">{_clean_inline(block.get("html", ""))}</td></tr>')
        elif kind == "button":
            url = html_lib.escape(block.get("url", "#"), quote=True)
            rows.append(
                '<tr><td style="padding:16px 32px;" align="center">'
                f'<a href="{url}" style="display:inline-block; background:{s["primary_color"]}; color:#ffffff; '
                f"{base} font-weight:bold; text-decoration:none; padding:12px 28px; border-radius:6px;\">"
                f"{_clean_inline(block.get('text', 'Learn more'))}</a></td></tr>"
            )
        elif kind == "divider":
            rows.append('<tr><td style="padding:12px 32px;"><hr style="border:none; border-top:1px solid #e5e7eb;"/></td></tr>')
        elif kind == "spacer":
            rows.append(f'<tr><td style="height:{int(block.get("height", 24))}px; font-size:0;">&nbsp;</td></tr>')
        elif kind == "footer":
            rows.append(
                f'<tr><td style="padding:20px 32px 8px; {base} font-size:12px; color:#6b7280;">'
                f"{_clean_inline(block.get('text', ''))}</td></tr>"
            )

    return (
        f'<!DOCTYPE html><html><body style="margin:0; padding:0; background:{s["background_color"]};">'
        f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:{s["background_color"]};">'
        '<tr><td align="center" style="padding:32px 12px;">'
        f'<table role="presentation" width="600" cellpadding="0" cellspacing="0" '
        f'style="max-width:600px; width:100%; background:{s["card_color"]}; border-radius:10px; overflow:hidden;">'
        f"{''.join(rows)}"
        "</table></td></tr></table></body></html>"
    )


def blocks_text_content(blocks: list[dict]) -> str:
    parts: list[str] = []
    for block in blocks:
        kind = block.get("type")
        if kind == "heading":
            parts.append(block.get("text", ""))
        elif kind == "text":
            text = re.sub(r"<br\s*/?>", "\n", block.get("html", ""))
            parts.append(re.sub(r"<[^>]+>", "", text))
        elif kind == "button":
            parts.append(f"{block.get('text', '')}: {block.get('url', '')}")
        elif kind == "footer":
            parts.append(re.sub(r"<[^>]+>", "", block.get("text", "")))
    return "\n\n".join(p.strip() for p in parts if p.strip())


def render_template(db: Session, template: EmailTemplate, lead: Lead | None, sender_name: str = "") -> tuple[str, str, str]:
    """Return (subject, html, text) with merge fields resolved."""
    blocks = json.loads(template.blocks or "[]")
    values = merge_values(db, lead, sender_name)
    subject = substitute(template.subject, values)
    html = substitute(render_blocks_html(blocks), values)
    text = substitute(blocks_text_content(blocks), values)
    return subject, html, text
