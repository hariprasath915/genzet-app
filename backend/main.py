from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, validator
from claude_client import generate_animation
import os
import time
import uuid
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(
    title="AniMind API",
    description="AI-powered educational animation generator using Claude",
    version="1.0.0"
)

# CORS middleware
CORS_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:3001",
    "*",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Ensure runtime directories exist
os.makedirs("saved_animations", exist_ok=True)
os.makedirs("saved_videos", exist_ok=True)
os.makedirs("uploads", exist_ok=True)
os.makedirs("genzet_library", exist_ok=True)


# ─── Request/Response Models ───────────────────────────────────────────────────

class AnimationRequest(BaseModel):
    prompt: str
    chat_id: str = None

    @validator("prompt")
    def prompt_must_not_be_empty(cls, v):
        v = v.strip()
        if not v:
            raise ValueError("Prompt cannot be empty")
        if len(v) > 1000:
            raise ValueError("Prompt must be under 1000 characters")
        return v


class AnimationResponse(BaseModel):
    id: str
    title: str
    explanation: str
    animation_code: str
    timestamp: float
    prompt: str


class HealthResponse(BaseModel):
    status: str
    timestamp: float


# ─── Routes ───────────────────────────────────────────────────────────────────

@app.get("/", tags=["Health"])
def root():
    return {"message": "AniMind API is running 🚀", "docs": "/docs"}


@app.get("/health", response_model=HealthResponse, tags=["Health"])
def health_check():
    return HealthResponse(
        status="healthy",
        timestamp=time.time()
    )


@app.post("/generate-animation", response_model=AnimationResponse, tags=["Animation"])
async def create_animation(request: AnimationRequest):
    """
    Generate an HTML/CSS/JS animation for the given concept using Claude.

    - **prompt**: The concept or question to animate (e.g., "gravity", "neural network")
    - **chat_id**: Optional chat session ID for grouping related animations
    """
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise HTTPException(
            status_code=500,
            detail="ANTHROPIC_API_KEY is not configured. Please set it in your .env file."
        )

    try:
        result = generate_animation(request.prompt)

        animation_id = str(uuid.uuid4())

        # Save the animation HTML to disk
        filepath = os.path.join("saved_animations", f"{animation_id}.html")
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(result["animation_code"])

        return AnimationResponse(
            id=animation_id,
            title=result.get("title", request.prompt),
            explanation=result.get("explanation", ""),
            animation_code=result["animation_code"],
            timestamp=time.time(),
            prompt=request.prompt
        )

    except Exception as e:
        error_message = str(e)

        if "authentication" in error_message.lower() or "api_key" in error_message.lower():
            raise HTTPException(
                status_code=401,
                detail="Invalid Anthropic API key. Please check your ANTHROPIC_API_KEY."
            )
        elif "rate_limit" in error_message.lower():
            raise HTTPException(
                status_code=429,
                detail="Rate limit exceeded. Please try again in a moment."
            )
        else:
            raise HTTPException(
                status_code=500,
                detail=f"Animation generation failed: {error_message}"
            )


@app.get("/example-prompts", tags=["Examples"])
def get_example_prompts():
    """Return a list of example animation prompts."""
    return {
        "prompts": [
            "gravity and planetary orbits",
            "neural network firing patterns",
            "DNA double helix structure",
            "Fourier transform visualization",
            "photosynthesis process",
            "sorting algorithms comparison",
            "wave interference patterns",
            "human heart blood circulation",
            "quantum superposition",
            "Newton's laws of motion",
            "electric circuit with electrons",
            "solar system model",
            "acid-base neutralization reaction",
            "electromagnetic field lines",
        ]
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
