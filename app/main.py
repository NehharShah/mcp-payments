from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any
from app.core.mcp import MCPPaymentModel, PaymentContext, PaymentType
from app.core.payment_processor import PaymentProcessor

app = FastAPI(title="MCP Payment Distribution System")
payment_model = MCPPaymentModel()
payment_processor = PaymentProcessor()

class PaymentRequest(BaseModel):
    payment_type: PaymentType
    amount: float
    currency: str
    recipients: List[str]
    metadata: Dict[str, Any]

@app.post("/calculate-distribution")
async def calculate_distribution(request: PaymentRequest):
    """Calculate payment distribution based on the provided context"""
    context = PaymentContext(**request.dict())
    payment_model.set_context(context)
    distribution = payment_model.calculate_distribution()
    return {"distribution": distribution}

@app.post("/process-payment")
async def process_payment(request: PaymentRequest):
    """Calculate and process payments"""
    context = PaymentContext(**request.dict())
    payment_model.set_context(context)
    distribution = payment_model.calculate_distribution()
    
    try:
        transactions = await payment_processor.process_payments(distribution)
        return {
            "status": "success",
            "distribution": distribution,
            "transactions": transactions
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/payment-types")
async def get_payment_types():
    """Get available payment types"""
    return {"payment_types": [pt.value for pt in PaymentType]}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
