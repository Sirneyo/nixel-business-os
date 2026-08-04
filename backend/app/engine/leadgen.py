"""The Lead Generation Engine.

One run moves a search brief through seven visible stages:

    Searching → Discovering → Researching → Contacts → Verifying → Assessing → Saving

Runs execute on a background thread and stream progress into `run_events`
(with per-stage counters on the run row), so the UI can poll and show the
engine genuinely working. Runs are cancellable between leads.
"""

import threading
import time

from sqlalchemy.orm import Session

from ..config import get_settings
from ..db import session_scope
from ..models import ActivityLog, EngineRun, Lead, RunEvent
from ..providers import get_email_verifier, get_lead_scorer, get_lead_search, get_website_researcher

STAGES = [
    ("search", "Searching for businesses"),
    ("discovery", "Discovering websites"),
    ("research", "Reviewing website information"),
    ("contacts", "Finding contact details"),
    ("verification", "Verifying email addresses"),
    ("assessment", "Assessing relevance"),
    ("saving", "Saving qualified leads"),
]

_threads: dict[int, threading.Thread] = {}


def _emit(db: Session, run: EngineRun, stage: str, agent: str, message: str, level: str = "info", company: str = "") -> None:
    db.add(RunEvent(run_id=run.id, stage=stage, agent=agent, level=level, message=message, company_name=company))
    db.commit()


def _pace() -> None:
    """Small delay in demo mode so the live feed is watchable, not instant."""
    if get_settings().demo_mode:
        time.sleep(0.35)


def _cancelled(db: Session, run_id: int) -> bool:
    db.expire_all()
    run = db.get(EngineRun, run_id)
    return run is None or run.status == "cancelled"


def start_run(run_id: int) -> None:
    thread = threading.Thread(target=_execute_run, args=(run_id,), daemon=True)
    _threads[run_id] = thread
    thread.start()


def _execute_run(run_id: int) -> None:
    db = session_scope()
    try:
        run = db.get(EngineRun, run_id)
        if run is None:
            return
        run.status = "running"
        db.commit()
        try:
            _run_pipeline(db, run)
        except Exception as exc:
            run = db.get(EngineRun, run_id)
            run.status = "failed"
            run.error_message = f"{type(exc).__name__}: {exc}"
            db.commit()
            _emit(db, run, "system", "Engine", f"Run failed: {run.error_message}", "error")
    finally:
        _threads.pop(run_id, None)
        db.close()


def _run_pipeline(db: Session, run: EngineRun) -> None:
    from ..models import utcnow

    searcher = get_lead_search()
    researcher = get_website_researcher()
    verifier = get_email_verifier()
    scorer = get_lead_scorer()

    # ── Stage 1: search ──────────────────────────────────────────────────
    run.current_stage = "search"
    db.commit()
    _emit(db, run, "search", "Lead Scout", f"Starting search: {run.business_type or run.industry or 'businesses'} in {run.location or 'any location'} (target: {run.leads_requested} leads).")
    _emit(db, run, "search", "Lead Scout", f"Using provider: {searcher.name}.")
    _pace()

    results = searcher.search(
        industry=run.industry,
        keywords=run.keywords,
        location=run.location,
        business_type=run.business_type,
        limit=run.leads_requested,
    )
    _emit(db, run, "search", "Lead Scout", f"Search returned {len(results)} candidate businesses.", "success")

    # Skip companies already in the workspace (match by website or name).
    existing_sites = {l.website.lower() for l in db.query(Lead.website).all() if l.website}
    existing_names = {l.company_name.lower() for l in db.query(Lead.company_name).all()}

    saved_total = 0
    for candidate in results:
        if saved_total >= run.leads_requested:
            break
        if _cancelled(db, run.id):
            _emit(db, run, "system", "Engine", "Run cancelled by user.", "warning")
            return
        run = db.get(EngineRun, run.id)

        # ── Stage 2: discovery ───────────────────────────────────────────
        run.current_stage = "discovery"
        db.commit()
        name = candidate.company_name
        if candidate.website.lower() in existing_sites or name.lower() in existing_names:
            _emit(db, run, "discovery", "Dedup Checker", f"{name} is already in your lead workspace — skipping.", "warning", name)
            continue
        run.discovered += 1
        db.commit()
        _emit(db, run, "discovery", "Lead Scout", f"Discovered {name} — {candidate.website or 'no website listed'}.", "success", name)
        _pace()

        # ── Stage 3: research ────────────────────────────────────────────
        run.current_stage = "research"
        db.commit()
        _emit(db, run, "research", "Website Researcher", f"Reviewing website for {name}…", "info", name)
        research = researcher.research(company_name=name, website=candidate.website, industry=run.industry)
        for page in research.pages_reviewed:
            _emit(db, run, "research", "Website Researcher", f"Reviewed page {page}", "info", name)
        if research.reachable:
            run.researched += 1
            db.commit()
            _emit(db, run, "research", "Website Researcher", f"Research complete for {name}.", "success", name)
        else:
            _emit(db, run, "research", "Website Researcher", f"{name}: {research.notes}", "warning", name)
        _pace()

        # ── Stage 4: contacts ────────────────────────────────────────────
        run.current_stage = "contacts"
        db.commit()
        email = research.emails_found[0] if research.emails_found else ""
        if research.contact_name:
            _emit(db, run, "contacts", "Contact Finder", f"Found contact {research.contact_name} ({research.contact_role or 'role unknown'}) at {name}.", "success", name)
        if email:
            run.contacts_found += 1
            db.commit()
            _emit(db, run, "contacts", "Contact Finder", f"Found email address {email} for {name}.", "success", name)
        else:
            _emit(db, run, "contacts", "Contact Finder", f"No email address found for {name}.", "warning", name)
        _pace()

        # ── Stage 5: verification ────────────────────────────────────────
        run.current_stage = "verification"
        db.commit()
        email_status, email_detail = "not_found", "No email address was found to verify."
        if email:
            _emit(db, run, "verification", "Email Validator", f"Verifying {email}…", "info", name)
            verdict = verifier.verify(email)
            email_status, email_detail = verdict.status, verdict.detail
            level = {"valid": "success", "risky": "warning"}.get(email_status, "error")
            run.emails_verified += 1
            db.commit()
            _emit(db, run, "verification", "Email Validator", f"{email}: {email_status} — {email_detail}", level, name)
        _pace()

        # ── Stage 6: assessment ──────────────────────────────────────────
        run.current_stage = "assessment"
        db.commit()
        _emit(db, run, "assessment", "Qualification Analyst", f"Assessing relevance of {name} against your brief…", "info", name)
        verdict = scorer.score(
            company_name=name,
            description=candidate.description,
            research_summary=research.summary,
            email_status=email_status,
            target_customer=run.target_customer,
            criteria=run.criteria,
            website_reachable=research.reachable,
        )
        level = "success" if verdict.qualified else "warning"
        _emit(db, run, "assessment", "Qualification Analyst", f"{name}: {verdict.note}", level, name)
        if verdict.qualified:
            run.qualified += 1
        else:
            run.rejected += 1
        db.commit()
        _pace()

        # ── Stage 7: saving ──────────────────────────────────────────────
        run.current_stage = "saving"
        db.commit()
        lead = Lead(
            company_name=name,
            website=candidate.website,
            industry=run.industry,
            location=candidate.location or run.location,
            description=candidate.description,
            contact_name=research.contact_name,
            contact_role=research.contact_role,
            email=email,
            email_status=email_status,
            email_check_detail=email_detail,
            research_summary=research.summary,
            qualification_status="qualified" if verdict.qualified else "rejected",
            relevance_score=verdict.score,
            qualification_note=verdict.note,
            source="engine",
            source_detail=searcher.name,
            engine_run_id=run.id,
        )
        db.add(lead)
        existing_sites.add(candidate.website.lower())
        existing_names.add(name.lower())
        if verdict.qualified:
            saved_total += 1
            run.saved = saved_total
        db.commit()
        _emit(db, run, "saving", "Engine", f"{name} saved to the lead workspace ({'qualified' if verdict.qualified else 'rejected — kept for review'}).", "success" if verdict.qualified else "info", name)

    run = db.get(EngineRun, run.id)
    run.status = "completed"
    run.current_stage = "done"
    run.finished_at = utcnow()
    db.commit()
    db.add(ActivityLog(entity_type="engine", entity_id=run.id, message=f"Lead generation run finished: {run.saved} qualified leads saved, {run.rejected} rejected."))
    db.commit()
    _emit(db, run, "system", "Engine", f"Run complete: {run.discovered} discovered, {run.qualified} qualified, {run.rejected} rejected, {run.saved} saved to your workspace.", "success")
