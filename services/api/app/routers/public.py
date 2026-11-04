from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session

from ..audit import client_ip
from ..db import get_db
from ..models import ContactMessage
from ..security import limiter

router = APIRouter(prefix="/public", tags=["public"])


class ContactIn(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    email: EmailStr
    organisation: str = Field(default="", max_length=200)
    topic: str = Field(default="", max_length=100)
    message: str = Field(min_length=20, max_length=5000)
    website: str = Field(default="", max_length=200)  # honeypot: must stay empty


@router.post("/contact", status_code=202)
def contact(body: ContactIn, request: Request, db: Session = Depends(get_db)):
    if not limiter.hit(f"contact:{client_ip(request)}", 5, 3600):
        raise HTTPException(429, "Too many messages.")
    if body.website:
        return {"message": "Received."}  # silently drop bot submissions
    db.add(ContactMessage(name=body.name, email=body.email, organisation=body.organisation, topic=body.topic, message=body.message, ip=client_ip(request)))
    db.commit()
    return {"message": "Received."}


@router.get("/health")
def health():
    return {"status": "ok"}
