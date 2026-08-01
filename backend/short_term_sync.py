from datetime import datetime, timezone
from pathlib import Path
import sqlite3
from typing import Any

from api42lib import IntraAPIClient


API_PAGE_SIZE = 100


def iso_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def get_client(config_path: Path) -> IntraAPIClient:
    return IntraAPIClient(config_path=str(config_path))


def fetch_paginated_records(
    config_path: Path,
    endpoint: str,
    params: dict[str, Any] | None = None,
    page_size: int = API_PAGE_SIZE,
) -> list[dict[str, Any]]:
    client = get_client(config_path)
    page_number = 1
    records: list[dict[str, Any]] = []
    base_params = dict(params or {})

    while True:
        request_params = {
            **base_params,
            "page[number]": page_number,
            "page[size]": page_size,
        }
        response = client.get(endpoint, params=request_params)
        if response.status_code != 200:
            raise RuntimeError(f"Request failed for {endpoint}: {response.status_code}")

        payload = response.json()
        if not isinstance(payload, list):
            raise RuntimeError(f"Unexpected payload shape for {endpoint}")

        records.extend(payload)
        if len(payload) < page_size:
            break
        page_number += 1

    return records


def normalize_coalition_scores(blocs_payload: list[dict[str, Any]], campus_id: int) -> list[dict[str, Any]]:
    scores: list[dict[str, Any]] = []
    for bloc in blocs_payload:
        bloc_campus_id = int(bloc.get("campus_id") or campus_id)
        for coalition in bloc.get("coalitions", []):
            coalition_id = coalition.get("id")
            score = coalition.get("score")
            if coalition_id is None or score is None:
                continue
            scores.append(
                {
                    "coalition_id": int(coalition_id),
                    "campus_id": bloc_campus_id,
                    "score": int(score),
                }
            )
    return scores


def normalize_coalition_user_scores(payload: list[dict[str, Any]], campus_id: int) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for item in payload:
        coalition_id = item.get("coalition_id")
        user_id = item.get("user_id")
        score = item.get("score")
        if coalition_id is None or user_id is None or score is None:
            continue
        rank_value = item.get("rank")
        rows.append(
            {
                "campus_id": campus_id,
                "coalition_id": int(coalition_id),
                "user_id": int(user_id),
                "score": int(score),
                "rank": int(rank_value) if rank_value is not None else None,
            }
        )
    return rows


def upsert_coalition_score_snapshot(db_path: Path, rows: list[dict[str, Any]], source_status: str) -> None:
    if not rows:
        return

    collected_at = iso_now()
    conn = sqlite3.connect(db_path)

    for row in rows:
        conn.execute(
            """
            INSERT INTO coalition_score_snapshot (
                coalition_id,
                campus_id,
                score,
                collected_at,
                source_status
            )
            VALUES (?, ?, ?, ?, ?)
            """,
            (row["coalition_id"], row["campus_id"], row["score"], collected_at, source_status),
        )

    conn.commit()
    conn.close()


def insert_coalition_user_scores(db_path: Path, rows: list[dict[str, Any]], source_status: str) -> None:
    if not rows:
        return

    collected_at = iso_now()
    conn = sqlite3.connect(db_path)

    for row in rows:
        conn.execute(
            """
            INSERT INTO coalition_user_score_snapshot (
                campus_id,
                coalition_id,
                user_id,
                score,
                rank,
                collected_at,
                source_status
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                row["campus_id"],
                row["coalition_id"],
                row["user_id"],
                row["score"],
                row["rank"],
                collected_at,
                source_status,
            ),
        )

    conn.commit()
    conn.close()


def sync_short_term_data(db_path: Path, config_path: Path, campus_id: int) -> dict[str, Any]:
    blocs_payload = fetch_paginated_records(config_path, "/blocs", params={"filter[campus_id]": campus_id})
    coalition_scores = normalize_coalition_scores(blocs_payload, campus_id=campus_id)
    coalition_user_scores: list[dict[str, Any]] = []

    coalition_ids = {
        int(coalition.get("id"))
        for bloc in blocs_payload
        for coalition in bloc.get("coalitions", [])
        if coalition.get("id") is not None
    }

    for coalition_id in coalition_ids:
        coalitions_users_payload = fetch_paginated_records(config_path, f"/coalitions/{coalition_id}/coalitions_users")
        coalition_user_scores.extend(normalize_coalition_user_scores(coalitions_users_payload, campus_id=campus_id))

    upsert_coalition_score_snapshot(db_path, coalition_scores, source_status="live_api")
    insert_coalition_user_scores(db_path, coalition_user_scores, source_status="live_api")

    return {
        "campus_id": campus_id,
        "coalition_scores_count": len(coalition_scores),
        "coalition_user_scores_count": len(coalition_user_scores),
        "pending_datasets": ["hours_logged"],
    }