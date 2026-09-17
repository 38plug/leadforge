import enum

from sqlalchemy import Enum, Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class WebsiteStatus(str, enum.Enum):
    NO_WEBSITE = "NO_WEBSITE"
    ACTIVE = "ACTIVE"
    INACCESSIBLE = "INACCESSIBLE"
    REDIRECTED = "REDIRECTED"
    OUTDATED = "OUTDATED"
    UNKNOWN = "UNKNOWN"


class Company(Base):
    __tablename__ = "companies"

    workspace_id: Mapped[str] = mapped_column(ForeignKey("workspaces.id"), index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(255), index=True, nullable=False)
    niche: Mapped[str] = mapped_column(String(120), index=True, nullable=False)
    description: Mapped[str | None] = mapped_column(String(2000))

    country: Mapped[str] = mapped_column(String(120), index=True, nullable=False)
    city: Mapped[str] = mapped_column(String(120), index=True, nullable=False)
    address: Mapped[str | None] = mapped_column(String(500))
    postal_code: Mapped[str | None] = mapped_column(String(20))
    latitude: Mapped[float | None] = mapped_column(Float)
    longitude: Mapped[float | None] = mapped_column(Float)
    maps_url: Mapped[str | None] = mapped_column(String(500))

    rating: Mapped[float | None] = mapped_column(Float)
    reviews_count: Mapped[int | None] = mapped_column(Integer)
    hours: Mapped[str | None] = mapped_column(String(500))

    source: Mapped[str] = mapped_column(String(120), default="lead_finder")
    external_ref: Mapped[str | None] = mapped_column(String(255), index=True)

    contacts: Mapped[list["Contact"]] = relationship(back_populates="company", cascade="all, delete-orphan")
    social_profiles: Mapped[list["SocialProfile"]] = relationship(back_populates="company", cascade="all, delete-orphan")
    website: Mapped["Website | None"] = relationship(back_populates="company", uselist=False, cascade="all, delete-orphan")
    leads: Mapped[list["Lead"]] = relationship(back_populates="company")


class Contact(Base):
    __tablename__ = "contacts"

    company_id: Mapped[str] = mapped_column(ForeignKey("companies.id"), index=True, nullable=False)
    phone: Mapped[str | None] = mapped_column(String(50), index=True)
    email: Mapped[str | None] = mapped_column(String(255), index=True)
    contact_name: Mapped[str | None] = mapped_column(String(255))
    role: Mapped[str | None] = mapped_column(String(120))
    verified: Mapped[bool] = mapped_column(default=False)

    company: Mapped["Company"] = relationship(back_populates="contacts")


class SocialProfile(Base):
    __tablename__ = "social_profiles"

    company_id: Mapped[str] = mapped_column(ForeignKey("companies.id"), index=True, nullable=False)
    platform: Mapped[str] = mapped_column(String(50), nullable=False)
    handle: Mapped[str] = mapped_column(String(255), nullable=False)
    url: Mapped[str] = mapped_column(String(500), nullable=False)
    follower_count: Mapped[int | None] = mapped_column(Integer)

    company: Mapped["Company"] = relationship(back_populates="social_profiles")


class Website(Base):
    __tablename__ = "websites"

    company_id: Mapped[str] = mapped_column(ForeignKey("companies.id"), unique=True, index=True, nullable=False)
    website_url: Mapped[str | None] = mapped_column(String(500))
    domain: Mapped[str | None] = mapped_column(String(255), index=True)
    http_status: Mapped[int | None] = mapped_column(Integer)
    ssl_status: Mapped[bool | None] = mapped_column()
    redirect_url: Mapped[str | None] = mapped_column(String(500))
    title: Mapped[str | None] = mapped_column(String(500))
    description: Mapped[str | None] = mapped_column(String(1000))
    status: Mapped[WebsiteStatus] = mapped_column(Enum(WebsiteStatus), default=WebsiteStatus.UNKNOWN, nullable=False)
    mobile_friendly: Mapped[bool | None] = mapped_column()
    load_time_ms: Mapped[int | None] = mapped_column(Integer)
    last_checked_at: Mapped[str | None] = mapped_column(String(64))

    company: Mapped["Company"] = relationship(back_populates="website")
