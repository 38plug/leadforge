from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_workspace
from app.db.session import get_db
from app.models.search import SavedSearch, SearchHistory
from app.models.workspace import Workspace
from app.schemas.search import SavedSearchCreate, SavedSearchOut, SearchHistoryOut

router = APIRouter(prefix="/api", tags=["search"])


@router.get("/saved-searches", response_model=list[SavedSearchOut])
def list_saved_searches(db: Session = Depends(get_db), workspace: Workspace = Depends(get_current_workspace)):
    return (
        db.query(SavedSearch)
        .filter(SavedSearch.workspace_id == workspace.id)
        .order_by(SavedSearch.created_at.desc())
        .all()
    )


@router.post("/saved-searches", response_model=SavedSearchOut, status_code=status.HTTP_201_CREATED)
def create_saved_search(
    payload: SavedSearchCreate,
    db: Session = Depends(get_db),
    workspace: Workspace = Depends(get_current_workspace),
):
    saved = SavedSearch(workspace_id=workspace.id, name=payload.name, filters=payload.filters)
    db.add(saved)
    db.commit()
    db.refresh(saved)
    return saved


@router.delete("/saved-searches/{saved_search_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_saved_search(
    saved_search_id: str, db: Session = Depends(get_db), workspace: Workspace = Depends(get_current_workspace)
):
    saved = (
        db.query(SavedSearch)
        .filter(SavedSearch.id == saved_search_id, SavedSearch.workspace_id == workspace.id)
        .first()
    )
    if not saved:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Saved search not found")
    db.delete(saved)
    db.commit()


@router.get("/search-history", response_model=list[SearchHistoryOut])
def list_search_history(db: Session = Depends(get_db), workspace: Workspace = Depends(get_current_workspace)):
    return (
        db.query(SearchHistory)
        .filter(SearchHistory.workspace_id == workspace.id)
        .order_by(SearchHistory.created_at.desc())
        .limit(50)
        .all()
    )
