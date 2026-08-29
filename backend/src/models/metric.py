"""
Metric Pydantic Models
T136: Data models for support performance analytics and dashboard aggregation
"""
from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel, Field


class OverviewMetrics(BaseModel):
    """Overall summary KPIs for management dashboard"""
    total_chats: int = Field(..., description="Total conversations in selected period")
    ai_resolution_rate: float = Field(..., description="Percentage of chats resolved by AI without human intervention")
    avg_response_time_seconds: float = Field(..., description="Average time to response in seconds")
    escalation_rate: float = Field(..., description="Percentage of chats escalated to human agents")
    cost_savings_usd: float = Field(..., description="Estimated cost saved using AI copilot vs human handling")
    active_conversations: int = Field(..., description="Currently active conversations")
    total_tickets_created: int = Field(..., description="Total tickets created automatically or manually")


class ResolutionRatePoint(BaseModel):
    """Daily or hourly breakdown of AI vs Human resolutions"""
    date: str = Field(..., description="Formatted date string (YYYY-MM-DD)")
    ai_resolved: int = Field(..., description="Chats resolved by AI")
    human_resolved: int = Field(..., description="Chats resolved by human agents")
    unresolved: int = Field(..., description="Chats currently open/unresolved")


class ResponseTimePoint(BaseModel):
    """Response time trend data point"""
    date: str = Field(..., description="Formatted date string (YYYY-MM-DD)")
    avg_seconds: float = Field(..., description="Average response latency in seconds")
    p95_seconds: float = Field(..., description="95th percentile response latency in seconds")


class TopicMetric(BaseModel):
    """Frequent customer query topic / category"""
    topic: str = Field(..., description="Category or topic name")
    count: int = Field(..., description="Number of occurrences")
    escalation_rate: float = Field(..., description="Percentage of this topic requiring escalation")
    sentiment: str = Field(default="neutral", description="Overall sentiment (positive, neutral, negative)")


class CostMetrics(BaseModel):
    """Cost breakdown comparison"""
    ai_cost_usd: float = Field(..., description="LLM API and infrastructure cost")
    human_equivalent_cost_usd: float = Field(..., description="Estimated cost if all chats were handled by human agents")
    net_savings_usd: float = Field(..., description="Net dollar savings")
    savings_percentage: float = Field(..., description="Percentage cost reduction")


class AgentPerformanceMetric(BaseModel):
    """Support agent performance line item"""
    agent_id: str
    agent_name: str
    avatar_url: Optional[str] = None
    chats_handled: int
    tickets_resolved: int
    avg_handle_time_minutes: float
    csat_score: float = Field(..., ge=0.0, le=5.0, description="Customer satisfaction rating out of 5")
