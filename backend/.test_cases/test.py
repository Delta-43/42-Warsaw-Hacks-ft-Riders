import json
from datetime import date, timedelta
from pathlib import Path

from api42lib import IntraAPIClient


def fetch_paginated_records(client: IntraAPIClient, endpoint: str, page_size: int = 100) -> list[dict]:
    page_number = 1
    records: list[dict] = []
    while True:
        response = client.get(endpoint, params={"page[number]": page_number, "page[size]": page_size})
        print(f"Fetching page {page_number} for endpoint {endpoint}, status code: {response.status_code}")
        if response.status_code != 200:
            raise RuntimeError(
                f"Request failed for {endpoint} at page {page_number}: {response.status_code}"
            )
        payload = response.json()
        if not isinstance(payload, list):
            raise RuntimeError(f"Unexpected payload shape for {endpoint} at page {page_number}")
        records.extend(payload)
        if len(payload) < page_size:
            break
        page_number += 1
    return records


ft_api = IntraAPIClient(config_path="config.yml")
output_dir = Path(__file__).resolve().parent / "trial_data"
output_dir.mkdir(exist_ok=True)

params = {"filter[city]": "Warsaw"}
campus_info = ft_api.get("campus", params=params)
campus_data = campus_info.json()
output_path = output_dir / "campus_data.json"
with output_path.open("w", encoding="utf-8") as fh:
    json.dump(campus_data, fh, indent=2, ensure_ascii=False)
print(f"Saved campus data to {output_path}")

campus_id = campus_data[0]["id"]
print(f"Campus ID for Warsaw: {campus_id}")

# if (output_dir / "users_data.json").exists():
#     print("Users data already exists. Skipping fetch.")
#     users_data = json.loads((output_dir / "users_data.json").read_text(encoding="utf-8"))
# else:
#     users_data = fetch_paginated_records(ft_api, f"/campus/{campus_id}/users")
#     output_path = output_dir / "users_data.json"
#     with output_path.open("w", encoding="utf-8") as fh:
#         json.dump(users_data, fh, indent=2, ensure_ascii=False)
#     print(f"Saved users data to {output_path}")

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

# if (output_dir / "achievements_data.json").exists():
#     print("Achievements data already exists. Skipping fetch.")
#     achievements_data = json.loads((output_dir / "achievements_data.json").read_text(encoding="utf-8"))
# else:
#     achievements_info = ft_api.get(f"/campus/{campus_id}/achievements")
#     achievements_data = achievements_info.json()
#     output_path = output_dir / "achievements_data.json"
#     with output_path.open("w", encoding="utf-8") as fh:
#         json.dump(achievements_data, fh, indent=2, ensure_ascii=False)
#     print(f"Saved achievements data to {output_path}")

# achievement_counts: list[dict] = []
# for achievement in achievements_data:
#     achievement_id = achievement["id"]
#     achievement_users_data = fetch_paginated_records(ft_api, f"/achievements/{achievement_id}/achievements_users")
#     output_path = output_dir / f"achievement_{achievement_id}_users.json"
#     with output_path.open("w", encoding="utf-8") as fh:
#         json.dump(achievement_users_data, fh, indent=2, ensure_ascii=False)
#     print(f"Saved achievement users to {output_path}")
#     achievement_counts.append(
#         {
#             "achievement_id": achievement_id,
#             "name": achievement.get("name"),
#             "users_total": len(achievement_users_data),
#         }
#     )

# output_path = output_dir / "achievement_counts.json"
# with output_path.open("w", encoding="utf-8") as fh:
#     json.dump(achievement_counts, fh, indent=2, ensure_ascii=False)
# print(f"Saved achievement counts to {output_path}")

# end_date = date.today()
# start_date = end_date - timedelta(days=7)
# params = {
#     "filter[campus]": campus_id,
#     "range[created_at]": f"{start_date.isoformat()},{end_date.isoformat()}",
# }
# project_info = ft_api.get(f"/projects_users", params=params)
# project_data = project_info.json()
# print(len(project_data))
# output_path = output_dir / "project_data.json"
# with output_path.open("w", encoding="utf-8") as fh:
#     json.dump(project_data, fh, indent=2, ensure_ascii=False)
# print(f"Saved project data to {output_path}")

# cursus_info = ft_api.get(f"/cursus_users", params={"filter[campus_id]": campus_id, "filter[active]": "true"})
# cursus_data = cursus_info.json()
# print(len(cursus_data))
# output_path = output_dir / "cursus_data.json"
# with output_path.open("w", encoding="utf-8") as fh:
#     json.dump(cursus_data, fh, indent=2, ensure_ascii=False)
# print(f"Saved cursus data to {output_path}")

# params = {"range[begin_at]": f"{start_date.isoformat()},{end_date.isoformat()}"}
# locations_info = ft_api.get(f"/campus/{campus_id}/locations", params=params)
# locations_data = locations_info.json()
# print(len(locations_data))
# output_path = output_dir / "locations_data.json"
# with output_path.open("w", encoding="utf-8") as fh:
#     json.dump(locations_data, fh, indent=2, ensure_ascii=False)
# print(f"Saved locations data to {output_path}")

# end_date = date.today()
# start_date = end_date - timedelta(days=1)
# params = {"filter[campus]": campus_id,
#           "range[marked_at]": f"{start_date.isoformat()},{end_date.isoformat()}"}

# projects_passed_info = ft_api.get(f"/projects_users", params=params)
# projects_passed_data = projects_passed_info.json()
# print(len(projects_passed_data))
# output_path = output_dir / "projects_passed_data.json"
# with output_path.open("w", encoding="utf-8") as fh:
#     json.dump(projects_passed_data, fh, indent=2, ensure_ascii=False)
# print(f"Saved projects passed data to {output_path}")


# end_date = date.today()
# start_date = end_date - timedelta(days=7)
# params = {
#     "range[user_id]": f"{user_data[0]['id']},{user_data[-1]['id']}",
#     "range[created_at]": f"{start_date.isoformat()},{end_date.isoformat()}",
# }
# achievements_rewarded = ft_api.get(f"/achievements_users", params=params)
# achievements_rewarded_data = achievements_rewarded.json()
# print(len(achievements_rewarded_data))
# output_path = output_dir / "achievements_rewarded_data.json"
# with output_path.open("w", encoding="utf-8") as fh:
#     json.dump(achievements_rewarded_data, fh, indent=2, ensure_ascii=False)
# print(f"Saved achievements rewarded data to {output_path}")