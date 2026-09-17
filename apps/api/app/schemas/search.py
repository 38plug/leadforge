from datetime import datetime

from pydantic import BaseModel, ConfigDict


class SavedSearchCreate(BaseModel):
    name: str
    filters: dict


class SavedSearchOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    name: str
    filters: dict
    created_at: datetime


class SearchHistoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    filters: dict
    result_count: int
    created_at: datetime
