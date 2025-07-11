from fastapi import APIRouter, Depends, HTTPException, status, Response, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timedelta
import jwt
import secrets
from passlib.context import CryptContext

# Simple in-memory user store for MVP (replace with database later)
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Mock users for MVP - in production, this would be in the database
MOCK_USERS = {
    "admin": {
        "user_id": "admin-user-id",
        "username": "admin",
        "email": "admin@arc4ne.local",
        "password_hash": pwd_context.hash("admin123"),  # Default password: admin123
        "roles": ["admin", "operator", "viewer"],
        "is_active": True
    }
}

# In-memory refresh token store (replace with database later)
REFRESH_TOKENS = {}

# JWT settings (in production, use environment variables)
SECRET_KEY = "your-secret-key-change-this-in-production"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30
REFRESH_TOKEN_EXPIRE_DAYS = 7

security = HTTPBearer()

router = APIRouter(
    prefix="/api/v1/auth",
    tags=["Authentication"],
)

# Pydantic models
class UserLogin(BaseModel):
    username: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"

class UserInfo(BaseModel):
    id: str
    username: str
    email: str
    roles: list[str]
    is_active: bool

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def create_refresh_token() -> str:
    return secrets.token_urlsafe(32)

def authenticate_user(username: str, password: str):
    user = MOCK_USERS.get(username)
    if not user:
        return False
    if not verify_password(password, user["password_hash"]):
        return False
    return user

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except jwt.PyJWTError:
        raise credentials_exception
    
    user = MOCK_USERS.get(username)
    if user is None:
        raise credentials_exception
    return user

@router.post("/login", response_model=Token)
async def login(user_credentials: UserLogin, response: Response):
    user = authenticate_user(user_credentials.username, user_credentials.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user["username"], "roles": user["roles"]}, 
        expires_delta=access_token_expires
    )
    
    # Create refresh token
    refresh_token = create_refresh_token()
    REFRESH_TOKENS[refresh_token] = {
        "username": user["username"],
        "expires": datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    }
    
    # Set refresh token as HttpOnly cookie
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        max_age=REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,  # 7 days in seconds
        httponly=True,
        secure=False,  # Set to True in production with HTTPS
        samesite="lax"
    )
    
    return {"access_token": access_token, "token_type": "bearer"}

@router.post("/refresh", response_model=Token)
async def refresh_token(request: Request):
    refresh_token = request.cookies.get("refresh_token")
    if not refresh_token or refresh_token not in REFRESH_TOKENS:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token"
        )
    
    token_data = REFRESH_TOKENS[refresh_token]
    if datetime.utcnow() > token_data["expires"]:
        del REFRESH_TOKENS[refresh_token]
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token expired"
        )
    
    user = MOCK_USERS.get(token_data["username"])
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found"
        )
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user["username"], "roles": user["roles"]}, 
        expires_delta=access_token_expires
    )
    
    return {"access_token": access_token, "token_type": "bearer"}

@router.post("/logout")
async def logout(request: Request, response: Response):
    refresh_token = request.cookies.get("refresh_token")
    if refresh_token and refresh_token in REFRESH_TOKENS:
        del REFRESH_TOKENS[refresh_token]
    
    response.delete_cookie("refresh_token")
    return {"message": "Successfully logged out"}

@router.get("/me", response_model=UserInfo)
async def get_current_user_info(current_user: dict = Depends(get_current_user)):
    return UserInfo(
        id=current_user["user_id"],
        username=current_user["username"],
        email=current_user["email"],
        roles=current_user["roles"],
        is_active=current_user["is_active"]
    )
