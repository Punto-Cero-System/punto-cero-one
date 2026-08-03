"""Extended profile models — professional identity for community members.

The `users` collection is the single source of truth (already contains id,
email, name, picture, role, auth_providers). This file adds pydantic schemas
for the RICH profile fields that Wave 2 introduces. Storage stays in the same
`users` document; no new collection.
"""
from __future__ import annotations

from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


class ProfileExperience(BaseModel):
    company: str = Field(min_length=1, max_length=120)
    title: str = Field(min_length=1, max_length=120)
    start: Optional[str] = None     # YYYY-MM
    end: Optional[str] = None       # YYYY-MM or None = current
    description: Optional[str] = Field(default=None, max_length=1000)


class ProfileCertification(BaseModel):
    name: str = Field(min_length=1, max_length=180)
    issuer: Optional[str] = None
    year: Optional[int] = None
    url: Optional[str] = None


class ProfileSocialLinks(BaseModel):
    website: Optional[str] = None
    linkedin: Optional[str] = None
    twitter: Optional[str] = None
    github: Optional[str] = None
    instagram: Optional[str] = None
    youtube: Optional[str] = None


class UIPreferences(BaseModel):
    """Per-user visual customization applied globally on the frontend."""
    model_config = ConfigDict(extra="ignore")
    theme: Optional[str] = Field(default=None, pattern=r"^(light|dark|auto)$")
    primary_color: Optional[str] = Field(default=None, max_length=20)
    secondary_color: Optional[str] = Field(default=None, max_length=20)
    accent_color: Optional[str] = Field(default=None, max_length=20)
    button_color: Optional[str] = Field(default=None, max_length=20)
    gradient: Optional[str] = Field(default=None, max_length=200)
    background_url: Optional[str] = Field(default=None, max_length=400)


class ProfileUpdate(BaseModel):
    model_config = ConfigDict(extra="ignore")
    name: Optional[str] = Field(default=None, max_length=120)
    headline: Optional[str] = Field(default=None, max_length=200)
    bio: Optional[str] = Field(default=None, max_length=4000)
    country: Optional[str] = Field(default=None, max_length=60)
    city: Optional[str] = Field(default=None, max_length=80)
    language: Optional[str] = Field(default=None, max_length=60)
    languages: Optional[list[str]] = None
    interests: Optional[list[str]] = None
    skills: Optional[list[str]] = None
    specialties: Optional[list[str]] = None
    verticals: Optional[list[str]] = None        # active category keys
    current_company: Optional[str] = Field(default=None, max_length=120)
    current_title: Optional[str] = Field(default=None, max_length=120)
    experience: Optional[list[ProfileExperience]] = None
    certifications: Optional[list[ProfileCertification]] = None
    portfolio_url: Optional[str] = Field(default=None, max_length=300)
    social: Optional[ProfileSocialLinks] = None
    ui_preferences: Optional[UIPreferences] = None


class ProfilePublic(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    email: str
    name: str
    picture: Optional[str] = None
    cover_url: Optional[str] = None
    role: str
    headline: Optional[str] = None
    bio: Optional[str] = None
    country: Optional[str] = None
    city: Optional[str] = None
    language: Optional[str] = None
    languages: list[str] = []
    interests: list[str] = []
    skills: list[str] = []
    specialties: list[str] = []
    verticals: list[str] = []
    current_company: Optional[str] = None
    current_title: Optional[str] = None
    experience: list[ProfileExperience] = []
    certifications: list[ProfileCertification] = []
    portfolio_url: Optional[str] = None
    social: ProfileSocialLinks = ProfileSocialLinks()
    ui_preferences: UIPreferences = UIPreferences()
    providers: list[str] = []
    email_verified: bool = False
    email_verified_at: Optional[str] = None
    posts_count: int = 0
    followers_count: int = 0
    following_count: int = 0
    created_at: str
