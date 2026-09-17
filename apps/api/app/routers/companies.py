from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.core.deps import get_current_workspace
from app.db.session import get_db
from app.models.company import Company
from app.models.workspace import Workspace
from app.schemas.lead import CompanyOut

router = APIRouter(prefix="/api/companies", tags=["companies"])


@router.get("/{company_id}", response_model=CompanyOut)
def get_company(company_id: str, db: Session = Depends(get_db), workspace: Workspace = Depends(get_current_workspace)):
    company = (
        db.query(Company)
        .options(joinedload(Company.contacts), joinedload(Company.social_profiles), joinedload(Company.website))
        .filter(Company.id == company_id, Company.workspace_id == workspace.id)
        .first()
    )
    if not company:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Company not found")
    return company
