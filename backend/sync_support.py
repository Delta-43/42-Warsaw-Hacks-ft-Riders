from __future__ import annotations

from collections import deque
from datetime import datetime, timezone
from pathlib import Path
import sqlite3
import threading
import time
from typing import Any

from api42lib import IntraAPIClient


API_PAGE_SIZE = 100
RETRYABLE_STATUS_CODES = {429, 500, 502, 503, 504}
MAX_REQUEST_ATTEMPTS = 5


class ApiBudgetExceeded(RuntimeError):
    pass


def iso_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def parse_iso_datetime(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value)
    except ValueError:
        return None


def parse_api_datetime(value: str | None) -> datetime | None:
    if not value:
        return None
    normalized = value.replace("Z", "+00:00")
    try:
        return datetime.fromisoformat(normalized)
    except ValueError:
        return None


class ApiRateLimiter:
    def __init__(
        self,
        max_per_second: int = 2,
        max_per_hour: int = 900,
        max_hour_wait_seconds: float = 2.0,
    ) -> None:
        self.max_per_second = max_per_second
        self.max_per_hour = max_per_hour
        self.max_hour_wait_seconds = max_hour_wait_seconds
        self._second_window: deque[float] = deque()
        self._hour_window: deque[float] = deque()
        self._lock = threading.Lock()

    def acquire(self) -> None:
        while True:
            wait_seconds = 0.0
            now_mono = time.monotonic()

            with self._lock:
                while self._second_window and now_mono - self._second_window[0] >= 1.0:
                    self._second_window.popleft()
                while self._hour_window and now_mono - self._hour_window[0] >= 3600.0:
                    self._hour_window.popleft()

                second_ok = len(self._second_window) < self.max_per_second
                hour_ok = len(self._hour_window) < self.max_per_hour

                if second_ok and hour_ok:
                    self._second_window.append(now_mono)
                    self._hour_window.append(now_mono)
                    return

                if not second_ok and self._second_window:
                    wait_seconds = max(wait_seconds, 1.0 - (now_mono - self._second_window[0]))
                if not hour_ok and self._hour_window:
                    until_budget_reset = 3600.0 - (now_mono - self._hour_window[0])
                    if until_budget_reset > self.max_hour_wait_seconds:
                        raise ApiBudgetExceeded(
                            f"Hourly API budget exhausted; next token in about {int(until_budget_reset)} seconds"
                        )
                    wait_seconds = max(wait_seconds, until_budget_reset)

            time.sleep(max(wait_seconds, 0.05))


def get_client(config_path: Path) -> IntraAPIClient:
    return IntraAPIClient(config_path=str(config_path))


def request_with_retries(
    client: IntraAPIClient,
    endpoint: str,
    params: dict[str, Any] | None = None,
    limiter: ApiRateLimiter | None = None,
) -> Any:
    last_status_code: int | None = None

    for attempt in range(1, MAX_REQUEST_ATTEMPTS + 1):
        if limiter is not None:
            limiter.acquire()

        response = client.get(endpoint, params=params)
        status_code = response.status_code
        if status_code == 200:
            return response

        last_status_code = status_code
        if status_code not in RETRYABLE_STATUS_CODES or attempt == MAX_REQUEST_ATTEMPTS:
            break

        time.sleep(0.5 * (2 ** (attempt - 1)))

    raise RuntimeError(f"Request failed for {endpoint}: {last_status_code}")


def fetch_paginated_records(
    config_path: Path,
    endpoint: str,
    params: dict[str, Any] | None = None,
    page_size: int = API_PAGE_SIZE,
    limiter: ApiRateLimiter | None = None,
    client: IntraAPIClient | None = None,
) -> list[dict[str, Any]]:
    api_client = client or get_client(config_path)
    page_number = 1
    records: list[dict[str, Any]] = []
    base_params = dict(params or {})

    while True:
        request_params = {
            **base_params,
            "page[number]": page_number,
            "page[size]": page_size,
        }
        response = request_with_retries(api_client, endpoint, params=request_params, limiter=limiter)
        payload = response.json()

        if not isinstance(payload, list):
            raise RuntimeError(f"Unexpected payload shape for {endpoint}")

        records.extend(payload)
        if len(payload) < page_size:
            break
        page_number += 1

    return records


def fetch_single_record(
    config_path: Path,
    endpoint: str,
    limiter: ApiRateLimiter | None = None,
    client: IntraAPIClient | None = None,
) -> dict[str, Any]:
    api_client = client or get_client(config_path)
    response = request_with_retries(api_client, endpoint, limiter=limiter)
    payload = response.json()

    if not isinstance(payload, dict):
        raise RuntimeError(f"Unexpected payload shape for {endpoint}")

    return payload


def get_sync_cursor(db_path: Path, job_name: str, cursor_key: str) -> str | None:
    conn = sqlite3.connect(db_path)
    row = conn.execute(
        """
        SELECT cursor_value
        FROM sync_cursor
        WHERE job_name = ? AND cursor_key = ?
        """,
        (job_name, cursor_key),
    ).fetchone()
    conn.close()
    return row[0] if row else None


def set_sync_cursor(db_path: Path, job_name: str, cursor_key: str, cursor_value: str | None) -> None:
    conn = sqlite3.connect(db_path)
    conn.execute(
        """
        INSERT INTO sync_cursor (job_name, cursor_key, cursor_value, updated_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(job_name, cursor_key) DO UPDATE SET
            cursor_value = excluded.cursor_value,
            updated_at = excluded.updated_at
        """,
        (job_name, cursor_key, cursor_value, iso_now()),
    )
    conn.commit()
    conn.close()