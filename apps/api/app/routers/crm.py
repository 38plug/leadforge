from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_current_workspace
from app.db.session import get_db
from app.models.lead import Lead, LeadActivity, Note, Task
from app.models.workspace import User, Workspace
from app.schemas.crm import ActivityOut, NoteCreate, NoteOut, TaskCreate, TaskOut, TaskUpdate

router = APIRouter(prefix="/api/leads", tags=["crm"])


def _get_owned_lead(db: Session, workspace_id: str, lead_id: str) -> Lead:
    lead = db.query(Lead).filter(Lead.id == lead_id, Lead.workspace_id == workspace_id).first()
    if not lead:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Lead not found")
    return lead


@router.get("/{lead_id}/notes", response_model=list[NoteOut])
def list_notes(lead_id: str, db: Session = Depends(get_db), workspace: Workspace = Depends(get_current_workspace)):
    _get_owned_lead(db, workspace.id, lead_id)
    return db.query(Note).filter(Note.lead_id == lead_id).order_by(Note.created_at.desc()).all()


@router.post("/{lead_id}/notes", response_model=NoteOut, status_code=status.HTTP_201_CREATED)
def create_note(
    lead_id: str,
    payload: NoteCreate,
    db: Session = Depends(get_db),
    workspace: Workspace = Depends(get_current_workspace),
    user: User = Depends(get_current_user),
):
    _get_owned_lead(db, workspace.id, lead_id)
    note = Note(lead_id=lead_id, author_id=user.id, body=payload.body)
    db.add(note)
    db.add(LeadActivity(lead_id=lead_id, type="note", message="Note added", actor_id=user.id))
    db.commit()
    db.refresh(note)
    return note


@router.delete("/{lead_id}/notes/{note_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_note(
    lead_id: str, note_id: str, db: Session = Depends(get_db), workspace: Workspace = Depends(get_current_workspace)
):
    _get_owned_lead(db, workspace.id, lead_id)
    note = db.query(Note).filter(Note.id == note_id, Note.lead_id == lead_id).first()
    if not note:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Note not found")
    db.delete(note)
    db.commit()


@router.get("/{lead_id}/tasks", response_model=list[TaskOut])
def list_tasks(lead_id: str, db: Session = Depends(get_db), workspace: Workspace = Depends(get_current_workspace)):
    _get_owned_lead(db, workspace.id, lead_id)
    return db.query(Task).filter(Task.lead_id == lead_id).order_by(Task.created_at.desc()).all()


@router.post("/{lead_id}/tasks", response_model=TaskOut, status_code=status.HTTP_201_CREATED)
def create_task(
    lead_id: str,
    payload: TaskCreate,
    db: Session = Depends(get_db),
    workspace: Workspace = Depends(get_current_workspace),
):
    _get_owned_lead(db, workspace.id, lead_id)
    task = Task(lead_id=lead_id, title=payload.title, due_date=payload.due_date, assignee_id=payload.assignee_id)
    db.add(task)
    db.add(LeadActivity(lead_id=lead_id, type="system", message=f"Task created: {payload.title}"))
    db.commit()
    db.refresh(task)
    return task


@router.patch("/{lead_id}/tasks/{task_id}", response_model=TaskOut)
def update_task(
    lead_id: str,
    task_id: str,
    payload: TaskUpdate,
    db: Session = Depends(get_db),
    workspace: Workspace = Depends(get_current_workspace),
):
    _get_owned_lead(db, workspace.id, lead_id)
    task = db.query(Task).filter(Task.id == task_id, Task.lead_id == lead_id).first()
    if not task:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Task not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(task, field, value)
    db.commit()
    db.refresh(task)
    return task


@router.delete("/{lead_id}/tasks/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task(
    lead_id: str, task_id: str, db: Session = Depends(get_db), workspace: Workspace = Depends(get_current_workspace)
):
    _get_owned_lead(db, workspace.id, lead_id)
    task = db.query(Task).filter(Task.id == task_id, Task.lead_id == lead_id).first()
    if not task:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Task not found")
    db.delete(task)
    db.commit()


@router.get("/{lead_id}/activity", response_model=list[ActivityOut])
def list_activity(lead_id: str, db: Session = Depends(get_db), workspace: Workspace = Depends(get_current_workspace)):
    _get_owned_lead(db, workspace.id, lead_id)
    return (
        db.query(LeadActivity)
        .filter(LeadActivity.lead_id == lead_id)
        .order_by(LeadActivity.created_at.desc())
        .all()
    )
