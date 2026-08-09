from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from agent import run_agent


app = FastAPI(
    title="TripSync Agent API"
)


# 允许你的React网页调用Agent
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


class AgentRequest(BaseModel):
    message: str


@app.get("/")
def home():
    return {
        "message": "TripSync Agent is running"
    }


@app.post("/agent")
def agent_endpoint(request: AgentRequest):

    result = run_agent(request.message)

    return result
