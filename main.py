import os
from fastapi import FastAPI, Depends, Request, HTTPException, status
from fastapi.responses import HTMLResponse, RedirectResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import create_engine, Column, Integer, String, Float
from sqlalchemy.orm import declarative_base, sessionmaker, Session
from pydantic import BaseModel
from authlib.integrations.starlette_client import OAuth
from starlette.middleware.sessions import SessionMiddleware

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./local_test.db") 
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "")
SECRET_KEY = os.getenv("SECRET_KEY", "super-secret-session-key")

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class LogEntry(Base):
    __tablename__ = "dtr_logs_v3" 
    id = Column(Integer, primary_key=True, index=True)
    user_email = Column(String, index=True) 
    week_label = Column(String, index=True) # Added to support custom week names
    date = Column(String, index=True)
    time_in = Column(String)
    time_out = Column(String)
    hours = Column(Float)

Base.metadata.create_all(bind=engine)

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
    week_label: str
    date: str
    time_in: str
    time_out: str
    hours: float

def get_current_user(request: Request):
    user = request.session.get('user')
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized")
    return user

@app.get("/")
def read_root(request: Request):
    user = request.session.get('user')
    if not user:
        return FileResponse("static/landing.html")
    return FileResponse("static/dashboard.html")

@app.get('/login')
async def login(request: Request):
    redirect_uri = request.url_for('auth')
    return await oauth.google.authorize_redirect(request, redirect_uri)

@app.get('/auth/callback')
async def auth(request: Request):
    token = await oauth.google.authorize_access_token(request)
    request.session['user'] = token.get('userinfo')
    return RedirectResponse(url='/')

@app.get('/logout')
def logout(request: Request):
    request.session.pop('user', None)
    return RedirectResponse(url='/')

@app.get("/api/logs")
def get_logs(request: Request, db: Session = Depends(get_db)):
    user = get_current_user(request)
    return db.query(LogEntry).filter(LogEntry.user_email == user['email']).order_by(LogEntry.date).all()

@app.post("/api/logs")
def add_log(log: LogCreate, request: Request, db: Session = Depends(get_db)):
    user = get_current_user(request)
    new_log = LogEntry(
        user_email=user['email'], 
        week_label=log.week_label,
        date=log.date, 
        time_in=log.time_in, 
        time_out=log.time_out, 
        hours=log.hours
    )
    db.add(new_log)
    db.commit()
    db.refresh(new_log)
    return new_log

@app.delete("/api/logs/{log_id}")
def delete_log(log_id: int, request: Request, db: Session = Depends(get_db)):
    user = get_current_user(request)
    db.query(LogEntry).filter(LogEntry.id == log_id, LogEntry.user_email == user['email']).delete()
    db.commit()
    return {"message": "Log deleted"}

@app.get("/api/user")
def get_user(request: Request):
    return get_current_user(request)