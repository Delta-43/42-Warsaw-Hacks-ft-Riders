from datetime import datetime, timedelta, timezone
import json
from pathlib import Path
import sqlite3
from typing import Any

from api42lib import IntraAPIClient
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

ft_api = IntraAPIClient(config_path="config.yml");
output_dir = Path(__file__).resolve().parent / "trial_data"
output_dir.mkdir(exist_ok=True)

# params = {"filter[city]": "Warsaw"}
# campus_info = ft_api.get("campus", params=params)
# campus_data = campus_info.json()
# output_path = output_dir / "campus_data.json"
# with output_path.open("w", encoding="utf-8") as fh:
#     json.dump(campus_data, fh, indent=2, ensure_ascii=False)
# print(f"Saved campus data to {output_path}")

# campus_id = campus_data[0]["id"]
# print(f"Campus ID for Warsaw: {campus_id}")

campus_id = 67

# users_info = ft_api.get(f"/campus/{campus_id}/users")
# users_data = users_info.json()
# output_path = output_dir / "users_data.json"
# with output_path.open("w", encoding="utf-8") as fh:
#     json.dump(users_data, fh, indent=2, ensure_ascii=False)
# print(f"Saved users data to {output_path}")

coalition_info = ft_api.get(f"/blocs", params={"filter[campus_id]": campus_id})
coalition_data = coalition_info.json()
output_path = output_dir / "coalition_data.json"
with output_path.open("w", encoding="utf-8") as fh:
    json.dump(coalition_data, fh, indent=2, ensure_ascii=False)
print(f"Saved coalition data to {output_path}")

for coalition in coalition_data[0]["coalitions"]:
    coalition_id = coalition["id"]
    coalition_scores = ft_api.get(f"/coalitions/{coalition_id}/coalitions_users")
    coalition_scores_data = coalition_scores.json()
    output_path = output_dir / f"coalition_{coalition_id}_scores.json"
    with output_path.open("w", encoding="utf-8") as fh:
        json.dump(coalition_scores_data, fh, indent=2, ensure_ascii=False)
    print(f"Saved coalition scores to {output_path}")

log_hours_info = ft_api.get(f"/campus/{campus_id}/locations")
log_hours_data = log_hours_info.json()
output_path = output_dir / "log_hours_data.json"
with output_path.open("w", encoding="utf-8") as fh:
    json.dump(log_hours_data, fh, indent=2, ensure_ascii=False)
print(f"Saved log hours data to {output_path}")