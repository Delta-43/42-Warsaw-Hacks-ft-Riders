from datetime import datetime, timezone
import sqlite3
from typing import Any

from fastapi import APIRouter, HTTPException, Query, Request


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def parse_iso_datetime(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value)
    except ValueError:
        return None


def source_mode_label(ran: bool, force_refresh: bool) -> str:
    if force_refresh or ran:
        return "refreshed"
    return "fresh_cache"


def get_db_connection(db_path: str) -> sqlite3.Connection:
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    return conn


def get_latest_snapshot(db_path: str) -> tuple[list[dict[str, Any]], datetime | None]:
    conn = get_db_connection(db_path)
    latest_row = conn.execute("SELECT MAX(collected_at) AS latest FROM campus_metrics_snapshot").fetchone()

    latest = latest_row["latest"] if latest_row else None
    if latest is None:
        conn.close()
        return [], None

    rows = conn.execute(
        """
        SELECT
            ref.campus_id AS id,
            ref.campus_name AS name,
            ref.city AS city,
            ref.country AS country,
            snap.users_count AS users_count,
            snap.collected_at AS collected_at,
            snap.source_status AS source_status
        FROM campus_metrics_snapshot snap
        JOIN campus_reference ref ON ref.campus_id = snap.campus_id
        WHERE snap.collected_at = ?
        ORDER BY snap.users_count DESC
        """,
        (latest,),
    ).fetchall()
    conn.close()
    return [dict(row) for row in rows], parse_iso_datetime(latest)


def get_snapshot_by_timestamp(db_path: str, collected_at: str) -> list[dict[str, Any]]:
    conn = get_db_connection(db_path)
    rows = conn.execute(
        """
        SELECT
            ref.campus_id AS id,
            ref.campus_name AS name,
            ref.city AS city,
            ref.country AS country,
            snap.users_count AS users_count,
            snap.collected_at AS collected_at,
            snap.source_status AS source_status
        FROM campus_metrics_snapshot snap
        JOIN campus_reference ref ON ref.campus_id = snap.campus_id
        WHERE snap.collected_at = ?
        ORDER BY snap.users_count DESC
        """,
        (collected_at,),
    ).fetchall()
    conn.close()
    return [dict(row) for row in rows]


def get_recent_snapshot_timestamps(db_path: str, limit: int = 2) -> list[str]:
    conn = get_db_connection(db_path)
    rows = conn.execute(
        """
        SELECT DISTINCT collected_at
        FROM campus_metrics_snapshot
        ORDER BY collected_at DESC
        LIMIT ?
        """,
        (limit,),
    ).fetchall()
    conn.close()
    return [row[0] for row in rows]


def ensure_long_term_data(request: Request, force_refresh: bool = False) -> tuple[list[dict[str, Any]], datetime | None, str]:
    cached_items, cached_timestamp = get_latest_snapshot(str(request.app.state.db_path))

    if cached_items and not force_refresh:
        return cached_items, cached_timestamp, "fresh_cache"

    try:
        sync_result = request.app.state.run_long_term_sync(force=force_refresh)
        items, collected_at = get_latest_snapshot(str(request.app.state.db_path))
        if not items:
            raise HTTPException(status_code=503, detail="No long-term data available in cache")
        return items, collected_at, source_mode_label(sync_result.get("ran", False), force_refresh)
    except Exception:
        if cached_items:
            return cached_items, cached_timestamp, "stale_fallback"
        raise HTTPException(status_code=503, detail="No cached campus data available and upstream API is unreachable")


def ensure_short_term_data(request: Request, force_refresh: bool = False) -> str:
    if not force_refresh:
        return "fresh_cache"
    try:
        sync_result = request.app.state.run_short_term_sync(force=force_refresh)
        return source_mode_label(sync_result.get("ran", False), force_refresh)
    except Exception:
        return "stale_fallback"


def build_summary(campus_items: list[dict[str, Any]]) -> dict[str, Any]:
    total_campuses = len(campus_items)
    total_users = sum(item["users_count"] for item in campus_items)
    top = campus_items[0] if campus_items else None
    return {
        "total_campuses": total_campuses,
        "total_users": total_users,
        "top_campus": {
            "id": top["id"],
            "name": top["name"],
            "users_count": top["users_count"],
        }
        if top
        else None,
    }


def build_highlights(db_path: str, campus_items: list[dict[str, Any]], top_n: int = 5) -> dict[str, Any]:
    top_n = max(1, min(top_n, 20))
    latest_top = campus_items[:top_n]

    timestamps = get_recent_snapshot_timestamps(db_path, limit=2)
    growth_map: dict[int, int] = {}
    previous_ts = timestamps[1] if len(timestamps) > 1 else None

    if previous_ts:
        previous_snapshot = get_snapshot_by_timestamp(db_path, previous_ts)
        previous_by_id = {item["id"]: item for item in previous_snapshot}
        for item in latest_top:
            previous = previous_by_id.get(item["id"])
            growth_map[item["id"]] = item["users_count"] - previous["users_count"] if previous else 0
    else:
        for item in latest_top:
            growth_map[item["id"]] = 0

    return {
        "top_count": top_n,
        "items": [
            {
                "id": item["id"],
                "name": item["name"],
                "city": item["city"],
                "country": item["country"],
                "users_count": item["users_count"],
                "users_delta_since_prev": growth_map[item["id"]],
            }
            for item in latest_top
        ],
    }


def get_campus_users(db_path: str, campus_id: int, limit: int) -> dict[str, Any]:
    conn = get_db_connection(db_path)
    rows = conn.execute(
        """
        SELECT
            user_id AS id,
            login,
            first_name,
            last_name,
            url,
            kind,
            image,
            pool_month,
            pool_year,
            active,
            alumni
        FROM campus_user
        WHERE campus_id = ?
        ORDER BY login ASC
        LIMIT ?
        """,
        (campus_id, limit),
    ).fetchall()
    total_row = conn.execute("SELECT COUNT(*) FROM campus_user WHERE campus_id = ?", (campus_id,)).fetchone()
    conn.close()

    items: list[dict[str, Any]] = []
    for row in rows:
        item = dict(row)
        image_payload = item.get("image")
        if isinstance(image_payload, str):
            try:
                import json

                item["image"] = json.loads(image_payload)
            except (json.JSONDecodeError, TypeError):
                item["image"] = None
        items.append(item)

    return {
        "campus_id": campus_id,
        "total": int(total_row[0]) if total_row else 0,
        "items": items,
    }


def get_campus_coalitions(db_path: str, campus_id: int) -> dict[str, Any]:
    conn = get_db_connection(db_path)
    latest_score_row = conn.execute(
        "SELECT MAX(collected_at) AS latest FROM coalition_score_snapshot WHERE campus_id = ?",
        (campus_id,),
    ).fetchone()
    latest_score_ts = latest_score_row["latest"] if latest_score_row else None

    rows = conn.execute(
        """
        SELECT
            ref.coalition_id,
            ref.campus_id,
            ref.cursus_id,
            ref.coalition_name,
            ref.slug,
            ref.image_url,
            ref.cover_url,
            ref.color,
            snap.score,
            snap.collected_at AS score_collected_at,
            ref.last_seen_at
        FROM coalition_reference ref
        LEFT JOIN coalition_score_snapshot snap
            ON snap.coalition_id = ref.coalition_id
           AND snap.campus_id = ref.campus_id
           AND snap.collected_at = ?
        WHERE ref.campus_id = ?
        ORDER BY COALESCE(snap.score, 0) DESC, ref.coalition_name ASC
        """,
        (latest_score_ts, campus_id),
    ).fetchall()
    conn.close()

    return {
        "campus_id": campus_id,
        "total": len(rows),
        "items": [dict(row) for row in rows],
    }


def get_campus_history(db_path: str, campus_id: int, points: int) -> list[dict[str, Any]]:
    conn = get_db_connection(db_path)
    rows = conn.execute(
        """
        SELECT users_count, collected_at, source_status
        FROM campus_metrics_snapshot
        WHERE campus_id = ?
        ORDER BY collected_at DESC
        LIMIT ?
        """,
        (campus_id, points),
    ).fetchall()
    conn.close()
    return list(reversed([dict(row) for row in rows]))


def get_short_term_metrics(db_path: str, campus_id: int, limit: int) -> dict[str, Any]:
    conn = get_db_connection(db_path)
    rows = conn.execute(
        """
        SELECT metric_name, metric_value, payload_json, collected_at, source_status
        FROM short_term_metric_snapshot
        WHERE campus_id = ?
        ORDER BY collected_at DESC
        LIMIT ?
        """,
        (campus_id, limit),
    ).fetchall()
    conn.close()
    return {
        "campus_id": campus_id,
        "total": len(rows),
        "items": [dict(row) for row in rows],
    }


def get_analytics_pills(db_path: str, campus_id: int) -> dict[str, Any]:
    conn = get_db_connection(db_path)

    totals_row = conn.execute(
        """
        SELECT
            COUNT(*) AS total_users,
            COALESCE(SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END), 0) AS active_users,
            COALESCE(SUM(achievements_count), 0) AS total_achievements_earned,
            COALESCE(AVG(CAST(achievements_count AS REAL)), 0.0) AS avg_achievements_per_user,
            COALESCE(SUM(CASE WHEN achievements_count > 0 THEN 1 ELSE 0 END), 0) AS users_with_achievements
        FROM campus_user
        WHERE campus_id = ?
        """,
        (campus_id,),
    ).fetchone()

    latest_achievement_ts_row = conn.execute(
        "SELECT MAX(collected_at) AS latest FROM achievement_metric_snapshot WHERE campus_id = ?",
        (campus_id,),
    ).fetchone()
    latest_achievement_ts = latest_achievement_ts_row["latest"] if latest_achievement_ts_row else None

    achievements_row = conn.execute(
        """
        SELECT
            COUNT(*) AS achievements_total,
            COALESCE(SUM(users_count), 0) AS total_achievement_unlocks,
            COALESCE(AVG(CAST(users_count AS REAL)), 0.0) AS avg_users_per_achievement
        FROM achievement_metric_snapshot
        WHERE campus_id = ? AND collected_at = ?
        """,
        (campus_id, latest_achievement_ts),
    ).fetchone()

    latest_coalition_user_ts_row = conn.execute(
        "SELECT MAX(collected_at) AS latest FROM coalition_user_score_snapshot WHERE campus_id = ?",
        (campus_id,),
    ).fetchone()
    latest_coalition_user_ts = latest_coalition_user_ts_row["latest"] if latest_coalition_user_ts_row else None

    coalition_user_row = conn.execute(
        """
        SELECT
            COALESCE(AVG(CAST(score AS REAL)), 0.0) AS avg_user_score,
            COALESCE(MAX(score), 0) AS top_user_score,
            COUNT(*) AS ranked_users
        FROM coalition_user_score_snapshot
        WHERE campus_id = ? AND collected_at = ?
        """,
        (campus_id, latest_coalition_user_ts),
    ).fetchone()

    conn.close()

    return {
        "campus_id": campus_id,
        "users": {
            "total": int(totals_row["total_users"]) if totals_row else 0,
            "active": int(totals_row["active_users"]) if totals_row else 0,
            "active_ratio": (
                round(float(totals_row["active_users"]) / float(totals_row["total_users"]), 4)
                if totals_row and totals_row["total_users"]
                else 0.0
            ),
        },
        "achievements": {
            "catalog_total": int(achievements_row["achievements_total"]) if achievements_row else 0,
            "total_unlocks": int(achievements_row["total_achievement_unlocks"]) if achievements_row else 0,
            "avg_users_per_achievement": round(float(achievements_row["avg_users_per_achievement"]), 2)
            if achievements_row
            else 0.0,
            "avg_achievements_per_user": round(float(totals_row["avg_achievements_per_user"]), 2)
            if totals_row
            else 0.0,
            "users_with_achievements": int(totals_row["users_with_achievements"]) if totals_row else 0,
            "total_achievements_earned": int(totals_row["total_achievements_earned"]) if totals_row else 0,
        },
        "coalition_scores": {
            "avg_user_score": round(float(coalition_user_row["avg_user_score"]), 2) if coalition_user_row else 0.0,
            "top_user_score": int(coalition_user_row["top_user_score"]) if coalition_user_row else 0,
            "ranked_users": int(coalition_user_row["ranked_users"]) if coalition_user_row else 0,
        },
    }


def get_coalition_rankings(db_path: str, campus_id: int, limit_per_coalition: int) -> dict[str, Any]:
    conn = get_db_connection(db_path)

    latest_ts_row = conn.execute(
        "SELECT MAX(collected_at) AS latest FROM coalition_user_score_snapshot WHERE campus_id = ?",
        (campus_id,),
    ).fetchone()
    latest_ts = latest_ts_row["latest"] if latest_ts_row else None
    if latest_ts is None:
        conn.close()
        return {"campus_id": campus_id, "total": 0, "items": []}

    rows = conn.execute(
        """
        SELECT
            ranked.coalition_id,
            ranked.user_id,
            ranked.score,
            ranked.rank,
            ranked.collected_at,
            ref.coalition_name,
            ref.slug,
            ref.color,
            usr.login,
            usr.first_name,
            usr.last_name
        FROM (
            SELECT
                s.coalition_id,
                s.user_id,
                s.score,
                s.rank,
                s.collected_at,
                ROW_NUMBER() OVER (
                    PARTITION BY s.coalition_id
                    ORDER BY COALESCE(s.rank, 1000000) ASC, s.score DESC, s.user_id ASC
                ) AS row_num
            FROM coalition_user_score_snapshot s
            WHERE s.campus_id = ? AND s.collected_at = ?
        ) ranked
        JOIN coalition_reference ref ON ref.coalition_id = ranked.coalition_id
        LEFT JOIN campus_user usr ON usr.user_id = ranked.user_id AND usr.campus_id = ?
        WHERE ranked.row_num <= ?
        ORDER BY ref.coalition_name ASC, ranked.row_num ASC
        """,
        (campus_id, latest_ts, campus_id, limit_per_coalition),
    ).fetchall()

    conn.close()
    return {
        "campus_id": campus_id,
        "total": len(rows),
        "items": [dict(row) for row in rows],
    }


def get_achievement_coverage(db_path: str, campus_id: int, limit: int) -> dict[str, Any]:
    conn = get_db_connection(db_path)

    latest_ts_row = conn.execute(
        "SELECT MAX(collected_at) AS latest FROM achievement_metric_snapshot WHERE campus_id = ?",
        (campus_id,),
    ).fetchone()
    latest_ts = latest_ts_row["latest"] if latest_ts_row else None
    if latest_ts is None:
        conn.close()
        return {"campus_id": campus_id, "total": 0, "items": []}

    rows = conn.execute(
        """
        SELECT
            m.achievement_id,
            ref.name,
            ref.kind,
            ref.tier,
            ref.visible,
            m.users_count,
            m.collected_at
        FROM achievement_metric_snapshot m
        JOIN achievement_reference ref ON ref.achievement_id = m.achievement_id
        WHERE m.campus_id = ?
          AND m.collected_at = ?
        ORDER BY m.users_count DESC, ref.name ASC
        LIMIT ?
        """,
        (campus_id, latest_ts, limit),
    ).fetchall()

    total_row = conn.execute(
        """
        SELECT COUNT(*) AS total
        FROM achievement_metric_snapshot
        WHERE campus_id = ?
          AND collected_at = ?
        """,
        (campus_id, latest_ts),
    ).fetchone()
    conn.close()

    return {
        "campus_id": campus_id,
        "total": int(total_row["total"]) if total_row else 0,
        "items": [dict(row) for row in rows],
    }


def create_router() -> APIRouter:
    router = APIRouter()

    @router.get("/health")
    def health(request: Request) -> dict[str, Any]:
        return {"status": "ok", "service": request.app.state.app_name, "time": utcnow().isoformat()}

    @router.get("/api/v1/campus")
    def campus(request: Request, force_refresh: bool = Query(default=False)) -> dict[str, Any]:
        items, collected_at, source_mode = ensure_long_term_data(request, force_refresh=force_refresh)
        cache_age = int((utcnow() - collected_at).total_seconds()) if collected_at else None
        return {
            "source_mode": source_mode,
            "cache_age_seconds": cache_age,
            "data_timestamp": collected_at.isoformat() if collected_at else None,
            "items": items,
        }

    @router.get("/api/v1/campus/{campus_id}")
    def campus_by_id(
        request: Request,
        campus_id: int,
        force_refresh: bool = Query(default=False),
    ) -> dict[str, Any]:
        items, collected_at, source_mode = ensure_long_term_data(request, force_refresh=force_refresh)
        for item in items:
            if item["id"] == campus_id:
                cache_age = int((utcnow() - collected_at).total_seconds()) if collected_at else None
                return {
                    "source_mode": source_mode,
                    "cache_age_seconds": cache_age,
                    "data_timestamp": collected_at.isoformat() if collected_at else None,
                    "campus": item,
                }
        raise HTTPException(status_code=404, detail=f"Campus {campus_id} not found in cache")

    @router.get("/api/v1/campus/{campus_id}/history")
    def campus_history(
        request: Request,
        campus_id: int,
        points: int = Query(default=30, ge=1, le=1000),
        force_refresh: bool = Query(default=False),
    ) -> dict[str, Any]:
        items, collected_at, source_mode = ensure_long_term_data(request, force_refresh=force_refresh)
        campus_name = next((item["name"] for item in items if item["id"] == campus_id), None)
        history = get_campus_history(str(request.app.state.db_path), campus_id, points)
        if not history:
            raise HTTPException(status_code=404, detail=f"No history found for campus {campus_id}")
        cache_age = int((utcnow() - collected_at).total_seconds()) if collected_at else None
        return {
            "source_mode": source_mode,
            "cache_age_seconds": cache_age,
            "data_timestamp": collected_at.isoformat() if collected_at else None,
            "campus": {"id": campus_id, "name": campus_name or f"Campus {campus_id}"},
            "points": len(history),
            "history": history,
        }

    @router.get("/api/v1/campus/{campus_id}/users")
    def campus_users(
        request: Request,
        campus_id: int,
        limit: int = Query(default=100, ge=1, le=500),
        force_refresh: bool = Query(default=False),
    ) -> dict[str, Any]:
        ensure_long_term_data(request, force_refresh=force_refresh)
        payload = get_campus_users(str(request.app.state.db_path), campus_id, limit)
        refreshed_at = request.app.state.get_last_successful_refresh("long_term_sync")
        return {
            "source_mode": "db_cache",
            "data_timestamp": refreshed_at.isoformat() if refreshed_at else None,
            "users": payload,
        }

    @router.get("/api/v1/campus/{campus_id}/coalitions")
    def campus_coalitions(
        request: Request,
        campus_id: int,
        force_refresh: bool = Query(default=False),
    ) -> dict[str, Any]:
        ensure_long_term_data(request, force_refresh=False)
        source_mode = ensure_short_term_data(request, force_refresh=force_refresh)
        payload = get_campus_coalitions(str(request.app.state.db_path), campus_id)
        refreshed_at = request.app.state.get_last_successful_refresh("short_term_sync")
        return {
            "source_mode": source_mode,
            "data_timestamp": refreshed_at.isoformat() if refreshed_at else None,
            "coalitions": payload,
        }

    @router.get("/api/v1/campus/{campus_id}/short-term-metrics")
    def campus_short_term_metrics(
        request: Request,
        campus_id: int,
        limit: int = Query(default=50, ge=1, le=500),
    ) -> dict[str, Any]:
        payload = get_short_term_metrics(str(request.app.state.db_path), campus_id, limit)
        refreshed_at = request.app.state.get_last_successful_refresh("short_term_sync")
        return {
            "source_mode": "db_cache",
            "data_timestamp": refreshed_at.isoformat() if refreshed_at else None,
            "metrics": payload,
        }

    @router.get("/api/v1/campus/{campus_id}/analytics/pills")
    def campus_analytics_pills(
        request: Request,
        campus_id: int,
        force_refresh: bool = Query(default=False),
    ) -> dict[str, Any]:
        ensure_long_term_data(request, force_refresh=force_refresh)
        ensure_short_term_data(request, force_refresh=force_refresh)
        payload = get_analytics_pills(str(request.app.state.db_path), campus_id)
        refreshed_at = request.app.state.get_last_successful_refresh("short_term_sync")
        return {
            "source_mode": "db_cache",
            "data_timestamp": refreshed_at.isoformat() if refreshed_at else None,
            "analytics": payload,
        }

    @router.get("/api/v1/campus/{campus_id}/coalitions/rankings")
    def campus_coalition_rankings(
        request: Request,
        campus_id: int,
        limit_per_coalition: int = Query(default=10, ge=1, le=50),
        force_refresh: bool = Query(default=False),
    ) -> dict[str, Any]:
        ensure_long_term_data(request, force_refresh=False)
        source_mode = ensure_short_term_data(request, force_refresh=force_refresh)
        payload = get_coalition_rankings(str(request.app.state.db_path), campus_id, limit_per_coalition)
        refreshed_at = request.app.state.get_last_successful_refresh("short_term_sync")
        return {
            "source_mode": source_mode,
            "data_timestamp": refreshed_at.isoformat() if refreshed_at else None,
            "rankings": payload,
        }

    @router.get("/api/v1/campus/{campus_id}/achievements/coverage")
    def campus_achievement_coverage(
        request: Request,
        campus_id: int,
        limit: int = Query(default=100, ge=1, le=500),
        force_refresh: bool = Query(default=False),
    ) -> dict[str, Any]:
        ensure_long_term_data(request, force_refresh=force_refresh)
        payload = get_achievement_coverage(str(request.app.state.db_path), campus_id, limit)
        refreshed_at = request.app.state.get_last_successful_refresh("long_term_sync")
        return {
            "source_mode": "db_cache",
            "data_timestamp": refreshed_at.isoformat() if refreshed_at else None,
            "achievements": payload,
        }

    @router.get("/api/v1/summary")
    def summary(request: Request, force_refresh: bool = Query(default=False)) -> dict[str, Any]:
        items, collected_at, source_mode = ensure_long_term_data(request, force_refresh=force_refresh)
        cache_age = int((utcnow() - collected_at).total_seconds()) if collected_at else None
        return {
            "source_mode": source_mode,
            "cache_age_seconds": cache_age,
            "data_timestamp": collected_at.isoformat() if collected_at else None,
            "summary": build_summary(items),
        }

    @router.get("/api/v1/highlights")
    def highlights(
        request: Request,
        force_refresh: bool = Query(default=False),
        top_n: int = Query(default=5, ge=1, le=20),
    ) -> dict[str, Any]:
        items, collected_at, source_mode = ensure_long_term_data(request, force_refresh=force_refresh)
        cache_age = int((utcnow() - collected_at).total_seconds()) if collected_at else None
        return {
            "source_mode": source_mode,
            "cache_age_seconds": cache_age,
            "data_timestamp": collected_at.isoformat() if collected_at else None,
            "highlights": build_highlights(str(request.app.state.db_path), items, top_n=top_n),
        }

    @router.post("/api/v1/refresh")
    def refresh(
        request: Request,
        scope: str = Query(default="all"),
    ) -> dict[str, Any]:
        if scope == "all":
            return request.app.state.run_due_syncs(force_long_term=True, force_short_term=True)
        if scope == "long_term":
            return {"long_term": request.app.state.run_long_term_sync(force=True)}
        if scope == "short_term":
            return {"short_term": request.app.state.run_short_term_sync(force=True)}
        raise HTTPException(status_code=400, detail="scope must be one of: all, long_term, short_term")

    return router