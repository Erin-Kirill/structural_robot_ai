import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
import joblib

# загрузка датасета
df = pd.read_csv("robot_dataset.csv")

# признаки
X = df[[
    "temperature",
    "humidity",
    "distance_mm",
    "thickness_mm",
    "cracks"
]]

# целевая переменная
y = df["status"]

# обучение
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2
)

model = RandomForestClassifier()
model.fit(X_train, y_train)

# сохранение
joblib.dump(model, "model.pkl")

print("Модель обучена и сохранена")