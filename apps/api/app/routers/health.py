from fastapi import APIRouter, HTTPException, status

from app.database import database

router = APIRouter()


@router.get("/health")
def health():
    try:
        with database.transaction() as connection:
            connection.execute("SELECT 1").fetchone()
    except Exception as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database unavailable",
        ) from error

    return {
        "status": "ok",
        "message": "Backend and database connected",
    }
