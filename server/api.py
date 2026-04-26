from __future__ import annotations

from datetime import datetime
from pathlib import Path
from typing import Any

import shutil
from fastapi import FastAPI, File, Form, UploadFile
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
import joblib
import os

# 🔥 безопасная загрузка модели
model = None
if os.path.exists("model.pkl"):
    model = joblib.load("model.pkl")

BASE_DIR = Path(__file__).resolve().parents[1]
INDEX_PATH = BASE_DIR / "index.html"
STATIC_DIR = BASE_DIR / "static"
MODELS_DIR = STATIC_DIR / "models"
DATASETS_DIR = STATIC_DIR / "datasets"

MODELS_DIR.mkdir(parents=True, exist_ok=True)
DATASETS_DIR.mkdir(parents=True, exist_ok=True)

app = FastAPI(title="Structural Robot AI")

app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

robot_data: list[dict[str, Any]] = []
datasets: list[dict[str, Any]] = []
last_robot_update: datetime | None = None
model_filename: str | None = None


# 📡 модель данных
class RobotPayload(BaseModel):
    temperature: float
    humidity: float
    distance: float
    thickness: float
    cracks: int = 0
    pressure: float | None = None
    path: float | None = None
    angle: float | None = None
    time: str | None = None


# 🌐 главная
@app.get("/")
async def root():
    if not INDEX_PATH.exists():
        return {"error": f"index.html not found at {INDEX_PATH}"}
    return FileResponse(INDEX_PATH)


# 🖥 статус сервера
@app.get("/server/status")
async def server_status():
    return {
        "status": "online",
        "robots": 1 if last_robot_update else 0,
        "last_update": last_robot_update.isoformat() if last_robot_update else None,
    }


# 🤖 статус робота
@app.get("/robot/status")
async def robot_status():
    if last_robot_update is None:
        return {"connected": False, "robots": 0}

    connected = (datetime.now() - last_robot_update).total_seconds() < 6
    return {"connected": connected, "robots": 1 if connected else 0}


# 📥 прием данных
@app.post("/robot/data")
async def receive_robot_data(payload: RobotPayload):
    global last_robot_update

    data = payload.model_dump()

    if not data.get("time"):
        data["time"] = datetime.now().strftime("%H:%M:%S")

    last_robot_update = datetime.now()
    robot_data.insert(0, data)
    del robot_data[200:]

    return {"status": "ok"}


# 📤 все данные
@app.get("/robot/data")
async def get_robot_data():
    return robot_data


# 📤 последнее значение (лучше использовать на фронте)
@app.get("/robot/latest")
async def get_robot_latest():
    return robot_data[0] if robot_data else {}


# 📦 загрузка STL
@app.post("/upload/stl")
async def upload_stl(file: UploadFile = File(...)):
    global model_filename

    safe_name = Path(file.filename).name
    target = MODELS_DIR / safe_name

    with target.open("wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    model_filename = safe_name
    return {"status": "ok", "file": safe_name}


# 📦 получение модели
@app.get("/robot/model")
async def get_model():
    if not model_filename:
        return {"model": None}
    return {"model": f"/static/models/{model_filename}"}


# 📂 загрузка датасета
@app.post("/dataset/upload")
async def upload_dataset(file: UploadFile = File(...), title: str = Form("dataset")):
    safe_name = Path(file.filename).name
    target = DATASETS_DIR / safe_name

    with target.open("wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    item = {
        "title": title,
        "file": safe_name,
        "url": f"/static/datasets/{safe_name}",
        "uploaded_at": datetime.now().isoformat(timespec="seconds"),
    }

    datasets.insert(0, item)
    return item


@app.get("/datasets")
async def list_datasets():
    return datasets


# 🔄 сброс
@app.post("/reset")
async def reset():
    robot_data.clear()
    datasets.clear()
    return {"status": "reset"}


# 🤖 AI ПРЕДСКАЗАНИЕ (УЛУЧШЕННОЕ)
@app.post("/predict")
async def predict(data: dict):

    if not model:
        return {"prediction": "NO_MODEL"}

    try:
        X = [[
            float(data.get("temperature", 0)),
            float(data.get("humidity", 0)),
            float(data.get("distance", 0)),
            float(data.get("thickness", 0)),
            float(data.get("cracks", 0))
        ]]

        pred = model.predict(X)[0]

        # вероятность (если есть)
        proba = None
        if hasattr(model, "predict_proba"):
            proba = max(model.predict_proba(X)[0])

        return {
            "prediction": str(pred),
            "confidence": round(proba, 3) if proba else None
        }

    except Exception as e:
        return {"prediction": "ERROR", "details": str(e)}