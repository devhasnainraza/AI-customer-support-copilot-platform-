"""
Analytics API Endpoints
T138-T144: Analytics endpoints for real-time support monitoring and performance reporting.
"""
import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status

from src.models.metric import (
    OverviewMetrics,
    ResolutionRatePoint,
    ResponseTimePoint,
    TopicMetric,
    CostMetrics,
    AgentPerformanceMetric
)
from src.services.analytics_service import AnalyticsService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/v1/analytics", tags=["analytics"])


@router.get("/overview", response_model=OverviewMetrics)
async def get_overview(days: int = Query(30, ge=1, le=365)):
    """
    T138: Get overall key performance indicators (KPIs)
    """
    return await AnalyticsService.get_overview_metrics(days=days)


@router.get("/resolution-rate", response_model=List[ResolutionRatePoint])
async def get_resolution_rate(days: int = Query(7, ge=1, le=90)):
    """
    T139: Get AI vs Human resolution rate trends over time
    """
    return await AnalyticsService.get_resolution_rate_trend(days=days)


@router.get("/response-times", response_model=List[ResponseTimePoint])
async def get_response_times(days: int = Query(7, ge=1, le=90)):
    """
    T140: Get response time and latency trends over time
    """
    return await AnalyticsService.get_response_time_trend(days=days)


@router.get("/top-topics", response_model=List[TopicMetric])
async def get_top_topics():
    """
    T141: Get top customer inquiry topics and escalation frequencies
    """
    return await AnalyticsService.get_top_topics()


@router.get("/costs", response_model=CostMetrics)
async def get_costs(days: int = Query(30, ge=1, le=365)):
    """
    T142: Get cost comparison breakdown (AI Copilot vs Human Support)
    """
    return await AnalyticsService.get_cost_breakdown(days=days)


@router.get("/agent-performance", response_model=List[AgentPerformanceMetric])
async def get_agent_performance():
    """
    T143: Get human support agent performance breakdown
    """
    return await AnalyticsService.get_agent_performance()
