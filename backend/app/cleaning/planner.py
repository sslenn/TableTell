"""
Cleaning Plan generator and approval state tracker.
"""

import uuid
from datetime import datetime, timezone
from app.schemas.quality import DatasetAuditReport
from app.schemas.cleaning import CleaningPlan
from app.quality.recommendations import generate_recommendations
from app.storage.metadata_repo import metadata_repo


class CleaningPlanner:
    def create_plan(self, audit: DatasetAuditReport) -> CleaningPlan:
        """
        Creates an explainable cleaning plan based on quality audit findings.
        Persists the proposed plan into metadata storage.
        """
        recs = generate_recommendations(audit)
        plan_id = f"plan_{uuid.uuid4().hex[:10]}"
        now = datetime.now(timezone.utc).isoformat()

        plan = CleaningPlan(
            plan_id=plan_id,
            dataset_id=audit.dataset_id,
            source_version=audit.version,
            created_at=now,
            recommendations=recs
        )

        metadata_repo.save_cleaning_plan(
            plan_id=plan_id,
            dataset_id=audit.dataset_id,
            source_version=audit.version,
            recommendations=[r.model_dump() for r in recs],
            status="proposed"
        )

        return plan


cleaning_planner = CleaningPlanner()
