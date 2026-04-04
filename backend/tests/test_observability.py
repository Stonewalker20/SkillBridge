"""Tests covering request logging and request ID propagation."""

from __future__ import annotations

import json
import logging


def test_request_logging_emits_structured_event_and_request_id(test_context, caplog):
    client = test_context["client"]

    with caplog.at_level(logging.INFO, logger="skillbridge.observability"):
        response = client.get("/health/")

    assert response.status_code == 200
    request_id = response.headers.get("X-Request-ID")
    assert request_id

    records = [
        json.loads(record.message)
        for record in caplog.records
        if record.name == "skillbridge.observability" and record.message.startswith("{")
    ]
    http_events = [record for record in records if record.get("event") == "http_request"]
    assert http_events

    event = http_events[-1]
    assert event["request_id"] == request_id
    assert event["method"] == "GET"
    assert event["path"] == "/health/"
    assert event["status_code"] == 200
    assert event["duration_ms"] >= 0
