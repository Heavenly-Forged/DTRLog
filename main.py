import os
from fastapi import FastAPI, Depends, Request, HTTPException, status
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import create_engine, Column, Integer, String, Float
from sqlalchemy.orm import declarative_base, sessionmaker, Session
from pydantic import BaseModel
from authlib.integrations.starlette_client import OAuth
from starlette.middleware.sessions import SessionMiddleware

# --- Configuration ---
# These will be set in Render's environment variables
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./local_test.db") 
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "")
SECRET_KEY = os.getenv("SECRET_KEY", "super-secret-session-key")
ALLOWED_EMAIL = "beringuelajirocordial@gmail.com" # Change this to your email

# --- Database Setup ---
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class LogEntry(Base):
    __tablename__ = "dtr_logs"
    id = Column(Integer, primary_key=True, index=True)
    date = Column(String, index=True)
    time_in = Column(String)
    time_out = Column(String)
    hours = Column(Float)

Base.metadata.create_all(bind=engine)

# --- FastAPI App & OAuth Setup ---
app = FastAPI()
app.add_middleware(SessionMiddleware, secret_key=SECRET_KEY)
app.mount("/static", StaticFiles(directory="static"), name="static")

oauth = OAuth()
oauth.register(
    name='google',
    client_id=GOOGLE_CLIENT_ID,
    client_secret=GOOGLE_CLIENT_SECRET,
    server_metadata_url='https://accounts.google.com/.well-known/openid-configuration',
    client_kwargs={'scope': 'openid email profile'},
)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

class LogCreate(BaseModel):
    date: str
    time_in: str
    time_out: str
    hours: float

# --- Authentication Dependency ---
def get_current_user(request: Request):
    user = request.session.get('user')
    if not user or user.get('email') != ALLOWED_EMAIL:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized")
    return user

# --- Routes ---
@app.get("/")
def read_root(request: Request):
    user = request.session.get('user')
    if not user:
        return HTMLResponse(
            """
            <div style="display:flex; justify-content:center; align-items:center; height:100vh; font-family:sans-serif; background:#f8fafc;">
                <div style="background:white; padding:40px; border-radius:8px; box-shadow:0 4px 6px rgba(0,0,0,0.1); text-align:center;">
                    <h2>Practicum DTR System</h2>
                    <a href="/login" style="background:#2563eb; color:white; padding:10px 20px; text-decoration:none; border-radius:5px; display:inline-block; margin-top:20px;">Sign in with Google</a>
                </div>
            </div>
            """
        )
    # If logged in, load the main app
    with open("static/index.html", "r") as f:
        return HTMLResponse(f.read())

@app.get('/login')
async def login(request: Request):
    redirect_uri = request.url_for('auth')
    return await oauth.google.authorize_redirect(request, redirect_uri)

@app.get('/auth/callback')
async def auth(request: Request):
    token = await oauth.google.authorize_access_token(request)
    user = token.get('userinfo')
    if user and user.get('email') == ALLOWED_EMAIL:
        request.session['user'] = user
        return RedirectResponse(url='/')
    return HTMLResponse("Unauthorized Email Address.", status_code=401)

@app.get('/logout')
def logout(request: Request):
    request.session.pop('user', None)
    return RedirectResponse(url='/')

# --- API Endpoints ---
@app.get("/api/logs")
def get_logs(request: Request, db: Session = Depends(get_db)):
    get_current_user(request) # Protect route
    return db.query(LogEntry).order_by(LogEntry.date).all()

@app.post("/api/logs")
def add_log(log: LogCreate, request: Request, db: Session = Depends(get_db)):
    get_current_user(request)
    new_log = LogEntry(date=log.date, time_in=log.time_in, time_out=log.time_out, hours=log.hours)
    db.add(new_log)
    db.commit()
    db.refresh(new_log)
    return new_log

@app.delete("/api/logs/{log_id}")
def delete_log(log_id: int, request: Request, db: Session = Depends(get_db)):
    get_current_user(request)
    db.query(LogEntry).filter(LogEntry.id == log_id).delete()
    db.commit()
    return {"message": "Log deleted"}