"""Email Builder endpoints: template CRUD, preview, merge fields, test send."""

import json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..db import get_db
from ..emailing import MERGE_FIELDS, SAMPLE_VALUES, blocks_text_content, find_tokens, render_blocks_html, substitute
from ..models import EmailTemplate
from ..providers import get_email_sender
from ..schemas import SendTestRequest, TemplateUpsert
from ..serializers import template_out

router = APIRouter(prefix="/api/templates", tags=["templates"])


@router.get("")
def list_templates(db: Session = Depends(get_db)):
    templates = db.query(EmailTemplate).order_by(EmailTemplate.id.desc()).all()
    return [template_out(t) for t in templates]


@router.get("/merge-fields")
def merge_fields():
    return [{"token": "{{" + key + "}}", "label": label, "sample": SAMPLE_VALUES.get(key, "")} for key, label in MERGE_FIELDS.items()]


@router.post("")
def create_template(payload: TemplateUpsert, db: Session = Depends(get_db)):
    template = EmailTemplate(name=payload.name, subject=payload.subject, blocks=json.dumps(payload.blocks))
    db.add(template)
    db.commit()
    return template_out(template)


@router.get("/{template_id}")
def get_template(template_id: int, db: Session = Depends(get_db)):
    template = db.get(EmailTemplate, template_id)
    if template is None:
        raise HTTPException(404, "Template not found")
    return template_out(template)


@router.put("/{template_id}")
def update_template(template_id: int, payload: TemplateUpsert, db: Session = Depends(get_db)):
    template = db.get(EmailTemplate, template_id)
    if template is None:
        raise HTTPException(404, "Template not found")
    template.name = payload.name
    template.subject = payload.subject
    template.blocks = json.dumps(payload.blocks)
    template.is_sample = False
    db.commit()
    return template_out(template)


@router.delete("/{template_id}")
def delete_template(template_id: int, db: Session = Depends(get_db)):
    template = db.get(EmailTemplate, template_id)
    if template is None:
        raise HTTPException(404, "Template not found")
    from ..models import CampaignStep

    used = db.query(CampaignStep).filter(CampaignStep.template_id == template_id).count()
    if used:
        raise HTTPException(409, f"This template is used by {used} campaign step(s). Remove it from campaigns first.")
    db.delete(template)
    db.commit()
    return {"deleted": template_id}


@router.post("/{template_id}/preview")
def preview_template(template_id: int, db: Session = Depends(get_db)):
    template = db.get(EmailTemplate, template_id)
    if template is None:
        raise HTTPException(404, "Template not found")
    blocks = json.loads(template.blocks or "[]")
    html = substitute(render_blocks_html(blocks), SAMPLE_VALUES)
    subject = substitute(template.subject, SAMPLE_VALUES)
    tokens = find_tokens(template.subject + " " + template.blocks)
    return {"subject": subject, "html": html, "tokens_used": tokens}


@router.post("/{template_id}/send-test")
def send_test(template_id: int, payload: SendTestRequest, db: Session = Depends(get_db)):
    template = db.get(EmailTemplate, template_id)
    if template is None:
        raise HTTPException(404, "Template not found")
    blocks = json.loads(template.blocks or "[]")
    subject = "[TEST] " + substitute(template.subject, SAMPLE_VALUES)
    html = substitute(render_blocks_html(blocks), SAMPLE_VALUES)
    text = substitute(blocks_text_content(blocks), SAMPLE_VALUES)
    sender = get_email_sender()
    result = sender.send(to_email=str(payload.to_email), subject=subject, html=html, text=text)
    return {"status": result.status, "detail": result.detail, "sender": sender.name}
