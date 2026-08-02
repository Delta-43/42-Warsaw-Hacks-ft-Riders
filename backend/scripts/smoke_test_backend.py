from __future__ import annotations

import argparse
import json
from typing import Any

import httpx


def fetch_json(client: httpx.Client, path: str) -> tuple[int, dict[str, Any]]:
    response = client.get(path)
    payload = response.json()
    if not isinstance(payload, dict):
        raise RuntimeError(f"Unexpected JSON shape for {path}")
    return response.status_code, payload


def print_check(label: str, status_code: int, details: str) -> None:
    print(f"[{status_code}] {label}: {details}")


def main() -> int:
    parser = argparse.ArgumentParser(description="Smoke-test the running backend service without forcing refreshes.")
    parser.add_argument("--base-url", default="http://127.0.0.1:8000", help="Backend base URL")
    parser.add_argument("--campus-id", type=int, default=67, help="Campus id to query")
    parser.add_argument("--timeout", type=float, default=10.0, help="HTTP timeout in seconds")
    args = parser.parse_args()

    campus_id = args.campus_id
    checks: list[tuple[str, str]] = [
        ("health", "/health"),
        ("refresh status", "/api/v1/refresh/status"),
        ("coalition standings", f"/api/v1/campus/{campus_id}/coalitions/standings"),
        ("coalition top scorers", f"/api/v1/campus/{campus_id}/coalitions/top-scorers"),
        ("weekly logtime", f"/api/v1/campus/{campus_id}/users/logtime-top"),
        ("recent project passes", f"/api/v1/campus/{campus_id}/projects/passed-recent"),
        ("active cursus counts", f"/api/v1/campus/{campus_id}/cursus/active-counts"),
        ("weekly attendance", f"/api/v1/campus/{campus_id}/attendance/weekly"),
        ("weekly project activity", f"/api/v1/campus/{campus_id}/projects/activity-weekly"),
        ("weekly achievements earned", f"/api/v1/campus/{campus_id}/achievements/earned-weekly"),
        ("analytics pills", f"/api/v1/campus/{campus_id}/analytics/pills"),
    ]

    with httpx.Client(base_url=args.base_url, timeout=args.timeout) as client:
        for label, path in checks:
            status_code, payload = fetch_json(client, path)
            details = payload.get("source_mode") or payload.get("status") or "ok"
            print_check(label, status_code, str(details))

        _, achievements_payload = fetch_json(client, f"/api/v1/campus/{campus_id}/achievements/earned-weekly")
        _, analytics_payload = fetch_json(client, f"/api/v1/campus/{campus_id}/analytics/pills")

        summary = {
            "weekly_achievements_earned": achievements_payload.get("weekly_achievements_earned", {}).get("metric_value"),
            "analytics_earned_this_week": analytics_payload.get("analytics", {}).get("achievements", {}).get("earned_this_week"),
            "users_logtime_total": analytics_payload.get("analytics", {}).get("users", {}).get("total"),
        }
        print(json.dumps(summary, indent=2))

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
