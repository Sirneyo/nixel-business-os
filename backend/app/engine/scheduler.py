"""Background scheduler: one periodic tick drives campaigns and automations."""

import logging

from apscheduler.schedulers.background import BackgroundScheduler

from ..config import get_settings
from ..db import session_scope

logger = logging.getLogger("nixel.scheduler")

_scheduler: BackgroundScheduler | None = None


def tick() -> None:
    from .automations import process_enrollments
    from .campaigns import process_campaigns

    db = session_scope()
    try:
        sent = process_campaigns(db)
        advanced = process_enrollments(db)
        if sent or advanced:
            logger.info("Tick: %s campaign emails processed, %s automation steps advanced.", sent, advanced)
    except Exception:
        logger.exception("Scheduler tick failed")
    finally:
        db.close()


def start_scheduler() -> None:
    global _scheduler
    if _scheduler is not None:
        return
    interval = max(get_settings().scheduler_interval_seconds, 5)
    _scheduler = BackgroundScheduler(daemon=True)
    _scheduler.add_job(tick, "interval", seconds=interval, id="engine-tick", max_instances=1, coalesce=True)
    _scheduler.start()
    logger.info("Scheduler started (every %ss).", interval)


def stop_scheduler() -> None:
    global _scheduler
    if _scheduler is not None:
        _scheduler.shutdown(wait=False)
        _scheduler = None
