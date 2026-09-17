from datetime import datetime

from pydantic import BaseModel, ConfigDict


class NoteCreate(BaseModel):
    body: str


class NoteOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    lead_id: str
    author_id: str | None = None
    body: str
    created_at: datetime


class TaskCreate(BaseModel):
    title: str
    due_date: str | None = None
    assignee_id: str | None = None


class TaskUpdate(BaseModel):
    title: str | None = None
    due_date: str | None = None
    completed: bool | None = None


class TaskOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    lead_id: str
    title: str
    due_date: str | None = None
    completed: bool
    assignee_id: str | None = None


class ActivityOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    lead_id: str
    type: str
    message: str
