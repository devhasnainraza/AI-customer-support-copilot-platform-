"""Manager API Routes - Team Metrics, Escalation Reviews, Reports"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
import logging

from src.api.middleware.auth import require_role
from src.services.manager_service import manager_service

logger = logging.getLogger(__name__)
router = APIRouter(
    prefix="/v1/manager",
    tags=["manager"],
    dependencies=[Depends(require_role(["manager", "admin"]))]
)

class EscalationAction(BaseModel):
    notes: str = ""

class ReportRequest(BaseModel):
    report_type: str
    date_from: str
    date_to: str

# Team Metrics
@router.get("/metrics")
async def get_team_metrics():
    return await manager_service.get_team_metrics()

@router.get("/leaderboard")
async def get_leaderboard():
    return {"leaderboard": await manager_service.get_team_leaderboard()}

@router.get("/agents/{agent_id}/performance")
async def get_agent_performance(agent_id: str):
    return await manager_service.get_agent_performance(agent_id)

# Escalation Reviews
@router.get("/escalations")
async def list_escalations(status: Optional[str] = None):
    reviews = await manager_service.get_escalation_reviews(status=status)
    return {"escalations": reviews, "total": len(reviews)}

@router.post("/escalations/{escalation_id}/approve")
async def approve_escalation(escalation_id: str, payload: EscalationAction):
    review = await manager_service.approve_escalation(
        escalation_id, reviewer_id="current_manager", notes=payload.notes
    )
    if not review:
        raise HTTPException(status_code=404, detail="Escalation not found")
    return review

@router.post("/escalations/{escalation_id}/reject")
async def reject_escalation(escalation_id: str, payload: EscalationAction):
    review = await manager_service.reject_escalation(
        escalation_id, reviewer_id="current_manager", notes=payload.notes
    )
    if not review:
        raise HTTPException(status_code=404, detail="Escalation not found")
    return review

@router.post("/escalations/{escalation_id}/reassign")
async def reassign_escalation(escalation_id: str, new_agent_id: str):
    review = await manager_service.reassign_escalation(
        escalation_id, new_agent_id, reviewer_id="current_manager"
    )
    if not review:
        raise HTTPException(status_code=404, detail="Escalation not found")
    return review

# Reports
@router.post("/reports/generate")
async def generate_report(payload: ReportRequest):
    return await manager_service.generate_report(
        payload.report_type, payload.date_from, payload.date_to
    )

@router.get("/reports")
async def list_reports():
    return {"reports": await manager_service.get_reports()}
