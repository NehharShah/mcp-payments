from typing import Dict, Any, List
from pydantic import BaseModel
from enum import Enum

class PaymentType(str, Enum):
    CONTRIBUTION = "contribution"
    TIME_BASED = "time_based"
    MILESTONE = "milestone"
    REPUTATION = "reputation"

class PaymentContext(BaseModel):
    payment_type: PaymentType
    amount: float
    currency: str
    recipients: List[str]
    metadata: Dict[str, Any]

class MCPPaymentModel:
    def __init__(self):
        self._context: Dict[str, Any] = {}
    
    def set_context(self, context: PaymentContext):
        """Set the payment context"""
        self._context = context.dict()
    
    def get_context(self) -> Dict[str, Any]:
        """Get the current payment context"""
        return self._context
    
    def calculate_distribution(self) -> Dict[str, float]:
        """Calculate payment distribution based on context"""
        payment_type = self._context.get("payment_type")
        amount = self._context.get("amount", 0)
        recipients = self._context.get("recipients", [])
        metadata = self._context.get("metadata", {})
        
        if payment_type == PaymentType.CONTRIBUTION:
            return self._contribution_based_distribution(amount, recipients, metadata)
        elif payment_type == PaymentType.TIME_BASED:
            return self._time_based_distribution(amount, recipients, metadata)
        elif payment_type == PaymentType.MILESTONE:
            return self._milestone_based_distribution(amount, recipients, metadata)
        elif payment_type == PaymentType.REPUTATION:
            return self._reputation_based_distribution(amount, recipients, metadata)
        
        return {recipient: amount / len(recipients) for recipient in recipients}
    
    def _contribution_based_distribution(self, amount: float, recipients: List[str], metadata: Dict[str, Any]) -> Dict[str, float]:
        """Distribute based on contribution metrics (commits, PRs, etc.)"""
        contributions = metadata.get("contributions", {})
        total_contributions = sum(contributions.values())
        
        if total_contributions == 0:
            return {recipient: amount / len(recipients) for recipient in recipients}
        
        return {
            recipient: amount * (contributions.get(recipient, 0) / total_contributions)
            for recipient in recipients
        }
    
    def _time_based_distribution(self, amount: float, recipients: List[str], metadata: Dict[str, Any]) -> Dict[str, float]:
        """Distribute based on time spent"""
        time_spent = metadata.get("time_spent", {})
        total_time = sum(time_spent.values())
        
        if total_time == 0:
            return {recipient: amount / len(recipients) for recipient in recipients}
        
        return {
            recipient: amount * (time_spent.get(recipient, 0) / total_time)
            for recipient in recipients
        }
    
    def _milestone_based_distribution(self, amount: float, recipients: List[str], metadata: Dict[str, Any]) -> Dict[str, float]:
        """Distribute based on milestone completion"""
        milestones_completed = metadata.get("milestones_completed", {})
        total_milestones = sum(milestones_completed.values())
        
        if total_milestones == 0:
            return {recipient: amount / len(recipients) for recipient in recipients}
        
        return {
            recipient: amount * (milestones_completed.get(recipient, 0) / total_milestones)
            for recipient in recipients
        }
    
    def _reputation_based_distribution(self, amount: float, recipients: List[str], metadata: Dict[str, Any]) -> Dict[str, float]:
        """Distribute based on reputation scores"""
        reputation_scores = metadata.get("reputation_scores", {})
        total_reputation = sum(reputation_scores.values())
        
        if total_reputation == 0:
            return {recipient: amount / len(recipients) for recipient in recipients}
        
        return {
            recipient: amount * (reputation_scores.get(recipient, 0) / total_reputation)
            for recipient in recipients
        }
