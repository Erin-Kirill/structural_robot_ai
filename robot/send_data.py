import requests
import random
import time

SERVER = "http://127.0.0.1:8000"

path = 0

while True:

    # плавное увеличение пути
    path += 1

    data = {
        "temperature": round(random.uniform(20, 28), 1),   # 20–28 °C
        "humidity": round(random.uniform(30, 60), 1),      # нормальная влажность
        "distance": round(random.uniform(5, 25), 1),       # 5–25 мм
        "thickness": round(random.uniform(1, 10), 1),      # 1–10 мм 🔥
        "cracks": random.randint(0, 3),
        "path": path
    }

    try:
        requests.post(SERVER + "/robot/data", json=data)
    except:
        print("Ошибка отправки")

    time.sleep(2)