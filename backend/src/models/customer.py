"""
Customer Pydantic Model
T036: Customer data model
"""
from pydantic import BaseModel, EmailStr, Field, ConfigDict
from typing import Optional
from datetime import datetime
from uuid import UUID


class CustomerBase(BaseModel):
    """Base customer fields"""
    email: EmailStr
    name: Optional[str] = None
    role: str = Field(default="customer", pattern="^(customer|support_agent|admin|manager)$")
    language_preference: Optional[str] = Field(None, pattern="^[a-z]{2}$")  # ISO 639-1


class CustomerCreate(CustomerBase):
    """Customer creation model"""
    tenant_id: UUID
    auth_id: str


class CustomerUpdate(BaseModel):
    """Customer update model"""
    name: Optional[str] = None
    language_preference: Optional[str] = Field(None, pattern="^[a-z]{2}$")


class Customer(CustomerBase):
    """Customer database model"""
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    tenant_id: UUID
    auth_id: str
    created_at: datetime
    updated_at: datetime


class CustomerPublic(BaseModel):
    """Public customer information (safe to expose)"""
    id: UUID
    name: Optional[str] = None
    role: str
