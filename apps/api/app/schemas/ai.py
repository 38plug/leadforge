from pydantic import BaseModel, Field


class AILeadAnalysis(BaseModel):
    """
    Structured, validated output of the AI Provider's lead analysis.
    Never trust raw AI output blindly — this schema is the contract every
    provider implementation (mock or real) must satisfy before the result
    is persisted or shown to the user.
    """

    opportunity_score: int = Field(ge=0, le=100)
    summary: str
    strengths: list[str]
    weaknesses: list[str]
    website_opportunities: list[str]
    recommended_services: list[str]
    recommended_pitch: str
    recommended_contact_method: str
    estimated_project_range: str


class GenerateEmailRequest(BaseModel):
    lead_id: str
    tone: str = "professional"
    goal: str = "book_a_call"


class GenerateEmailResponse(BaseModel):
    subject: str
    body: str


class GenerateCallScriptRequest(BaseModel):
    lead_id: str


class GenerateCallScriptResponse(BaseModel):
    opener: str
    talking_points: list[str]
    objection_handling: list[str]


class AssistantChatRequest(BaseModel):
    lead_id: str | None = None
    message: str


class AssistantChatResponse(BaseModel):
    reply: str
