import json
from pathlib import Path

from api42lib import IntraAPIClient


def fetch_paginated_records(client: IntraAPIClient, endpoint: str, page_size: int = 100) -> list[dict]:
    page_number = 1
    records: list[dict] = []
    while True:
        response = client.get(endpoint, params={"page[number]": page_number, "page[size]": page_size})
        if response.status_code != 200:
            break
        payload = response.json()
        if not isinstance(payload, list):
            break
        records.extend(payload)
        if len(payload) < page_size:
            break
        page_number += 1
    return records

ft_api = IntraAPIClient(config_path="config.yml")
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

users_info = ft_api.get(f"/campus/{campus_id}/users")
users_data = users_info.json()
output_path = output_dir / "users_data.json"
with output_path.open("w", encoding="utf-8") as fh:
    json.dump(users_data, fh, indent=2, ensure_ascii=False)
print(f"Saved users data to {output_path}")

# coalition_info = ft_api.get(f"/blocs", params={"filter[campus_id]": campus_id})
# coalition_data = coalition_info.json()
# output_path = output_dir / "coalition_data.json"
# with output_path.open("w", encoding="utf-8") as fh:
#     json.dump(coalition_data, fh, indent=2, ensure_ascii=False)
# print(f"Saved coalition data to {output_path}")

# for coalition in coalition_data[0]["coalitions"]:
#     coalition_id = coalition["id"]
#     coalition_scores = ft_api.get(f"/coalitions/{coalition_id}/coalitions_users")
#     coalition_scores_data = coalition_scores.json()
#     output_path = output_dir / f"coalition_{coalition_id}_scores.json"
#     with output_path.open("w", encoding="utf-8") as fh:
#         json.dump(coalition_scores_data, fh, indent=2, ensure_ascii=False)
#     print(f"Saved coalition scores to {output_path}")

achievements_info = ft_api.get(f"/campus/{campus_id}/achievements")
achievements_data = achievements_info.json()
output_path = output_dir / "achievements_data.json"
with output_path.open("w", encoding="utf-8") as fh:
    json.dump(achievements_data, fh, indent=2, ensure_ascii=False)
print(f"Saved achievements data to {output_path}")

achievement_counts: list[dict] = []
for achievement in achievements_data:
    achievement_id = achievement["id"]
    achievement_users_data = fetch_paginated_records(ft_api, f"/achievements/{achievement_id}/achievements_users")
    output_path = output_dir / f"achievement_{achievement_id}_users.json"
    with output_path.open("w", encoding="utf-8") as fh:
        json.dump(achievement_users_data, fh, indent=2, ensure_ascii=False)
    print(f"Saved achievement users to {output_path}")
    achievement_counts.append(
        {
            "achievement_id": achievement_id,
            "name": achievement.get("name"),
            "users_total": len(achievement_users_data),
        }
    )

output_path = output_dir / "achievement_counts.json"
with output_path.open("w", encoding="utf-8") as fh:
    json.dump(achievement_counts, fh, indent=2, ensure_ascii=False)
print(f"Saved achievement counts to {output_path}")