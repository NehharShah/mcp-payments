from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Enum as SQLEnum
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from datetime import datetime
from app.core.mcp import PaymentType

Base = declarative_base()

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True)
    address = Column(String, unique=True, index=True)
    username = Column(String, unique=True)
    reputation_score = Column(Float, default=0.0)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    contributions = relationship("Contribution", back_populates="user")
    payments_received = relationship("Payment", back_populates="recipient")

class Project(Base):
    __tablename__ = "projects"
    
    id = Column(Integer, primary_key=True)
    name = Column(String, unique=True)
    github_url = Column(String)
    description = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    contributions = relationship("Contribution", back_populates="project")
    payments = relationship("Payment", back_populates="project")

class Contribution(Base):
    __tablename__ = "contributions"
    
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    project_id = Column(Integer, ForeignKey("projects.id"))
    type = Column(String)  # commit, PR, issue, etc.
    value = Column(Float)  # contribution weight
    data = Column(String)  # JSON metadata
    created_at = Column(DateTime, default=datetime.utcnow)
    
    user = relationship("User", back_populates="contributions")
    project = relationship("Project", back_populates="contributions")

class Payment(Base):
    __tablename__ = "payments"
    
    id = Column(Integer, primary_key=True)
    project_id = Column(Integer, ForeignKey("projects.id"))
    recipient_id = Column(Integer, ForeignKey("users.id"))
    amount = Column(Float)
    currency = Column(String)
    payment_type = Column(SQLEnum(PaymentType))
    tx_hash = Column(String)
    status = Column(String)  # pending, completed, failed
    created_at = Column(DateTime, default=datetime.utcnow)
    
    project = relationship("Project", back_populates="payments")
    recipient = relationship("User", back_populates="payments_received")

class Milestone(Base):
    __tablename__ = "milestones"
    
    id = Column(Integer, primary_key=True)
    project_id = Column(Integer, ForeignKey("projects.id"))
    title = Column(String)
    description = Column(String)
    reward_amount = Column(Float)
    status = Column(String)  # pending, completed
    completed_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
