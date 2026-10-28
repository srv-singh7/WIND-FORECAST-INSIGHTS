"""API for the January 2026 UK wind forecast decision-support demo."""

from __future__ import annotations

import gzip
import json
import os
from datetime import date, datetime, time, timedelta, timezone
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo

import pandas as pd
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

DATA_DIR = Path(os.getenv("DATA_DIR", Path(__file__).resolve().parents[1] / "data" / "raw"))
ACTUALS_PATH = DATA_DIR / "fuelhh_wind_january_2026.json.gz"
FORECASTS_PATH = DATA_DIR / "windfor_january_2026.json.gz"
UK = ZoneInfo("Europe/London")
UTC = timezone.utc

app = FastAPI(title="Wind Forecast Insights API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "*").split(","),
    allow_credentials=False,
    allow_methods=["GET"],
    allow_headers=["*"],
)


def _read_rows(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        raise RuntimeError(f"Required dataset not found: {path}")
    with gzip.open(path, mode="rt", encoding="utf-8") as data_file:
        rows = json.load(data_file)
    if not isinstance(rows, list):
        raise RuntimeError(f"Expected a JSON array in {path}")
    return rows


def load_data() -> tuple[pd.DataFrame, pd.DataFrame]:
    actual_rows = _read_rows(ACTUALS_PATH)
    forecast_rows = _read_rows(FORECASTS_PATH)
    actuals = pd.DataFrame(actual_rows)
    forecasts = pd.DataFrame(forecast_rows)

    actuals = actuals.loc[actuals.get("fuelType", pd.Series(dtype=str)) == "WIND"].copy()
    for col in ("startTime", "publishTime"):
        actuals[col] = pd.to_datetime(actuals[col], utc=True, errors="coerce")
        forecasts[col] = pd.to_datetime(forecasts[col], utc=True, errors="coerce")
    actuals["generation"] = pd.to_numeric(actuals["generation"], errors="coerce")
    forecasts["generation"] = pd.to_numeric(forecasts["generation"], errors="coerce")
    actuals = actuals.dropna(subset=["startTime", "generation"])
    forecasts = forecasts.dropna(subset=["startTime", "publishTime", "generation"])

    # FUELHH is 30-minute average MW. WINDFOR timestamps are hourly in this extract;
    # average the two half-hours beginning at H and H+00:30 to match the forecast hour.
    actuals["hourStart"] = actuals["startTime"].dt.floor("h")
    hourly = actuals.groupby("hourStart", as_index=False).agg(
        actualMW=("generation", "mean"),
        halfHourRecords=("generation", "size"),
        actualPublishTime=("publishTime", "max"),
    )
    hourly = hourly.loc[hourly["halfHourRecords"] == 2].copy()
    forecasts = forecasts.rename(columns={"generation": "forecastMW"})
    forecasts = forecasts.drop_duplicates(subset=["startTime", "publishTime"], keep="last")
    return hourly, forecasts


ACTUAL_HOURLY, FORECAST_VINTAGES = load_data()


def _utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=UK).astimezone(UTC)
    return value.astimezone(UTC)


def _iso(value: Any) -> str | None:
    if pd.isna(value):
        return None
    return value.to_pydatetime().isoformat().replace("+00:00", "Z")


def _window(day: date, cutoff_local: time) -> tuple[datetime, datetime]:
    decision = datetime.combine(day - timedelta(days=1), cutoff_local, tzinfo=UK)
    start = datetime.combine(day, time.min, tzinfo=UK)
    return _utc(start), _utc(decision)


def _select_day(day: date, cutoff_local: time) -> tuple[pd.DataFrame, datetime]:
    start_utc, cutoff_utc = _window(day, cutoff_local)
    end_utc = start_utc + timedelta(days=1)
    targets = pd.date_range(start=start_utc, end=end_utc, freq="h", inclusive="left", tz="UTC")
    target_frame = pd.DataFrame({"startTime": targets})
    candidates = FORECAST_VINTAGES.loc[
        (FORECAST_VINTAGES["startTime"] >= start_utc)
        & (FORECAST_VINTAGES["startTime"] < end_utc)
        & (FORECAST_VINTAGES["publishTime"] <= cutoff_utc)
    ].sort_values("publishTime")
    chosen = candidates.drop_duplicates(subset=["startTime"], keep="last")
    selected = target_frame.merge(chosen[["startTime", "publishTime", "forecastMW"]], on="startTime", how="left")
    selected = selected.merge(ACTUAL_HOURLY[["hourStart", "actualMW"]], left_on="startTime", right_on="hourStart", how="left")
    selected = selected.drop(columns=["hourStart"])
    return selected, cutoff_utc


def _metric_values(frame: pd.DataFrame) -> dict[str, float | int | None]:
    paired = frame.dropna(subset=["actualMW", "forecastMW"])
    if paired.empty:
        return {"pairedHours": 0, "maeMW": None, "rmseMW": None, "biasMW": None, "wmapePercent": None}
    errors = paired["forecastMW"] - paired["actualMW"]
    denominator = paired["actualMW"].abs().sum()
    return {
        "pairedHours": int(len(paired)),
        "maeMW": round(float(errors.abs().mean()), 1),
        "rmseMW": round(float((errors.pow(2).mean()) ** 0.5), 1),
        "biasMW": round(float(errors.mean()), 1),
        "wmapePercent": round(float(errors.abs().sum() / denominator * 100), 2) if denominator else None,
    }


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/metadata")
def metadata() -> dict[str, Any]:
    dates = sorted(ACTUAL_HOURLY["hourStart"].dt.strftime("%Y-%m-%d").unique().tolist())
    return {
        "actualRows": int(len(ACTUAL_HOURLY) * 2),
        "actualHours": int(len(ACTUAL_HOURLY)),
        "forecastRows": int(len(FORECAST_VINTAGES)),
        "forecastVintages": int(FORECAST_VINTAGES["publishTime"].nunique()),
        "deliveryDates": dates,
        "defaultDeliveryDate": "2026-01-15" if "2026-01-15" in dates else (dates[len(dates) // 2] if dates else None),
        "actualCoverage": {"from": _iso(ACTUAL_HOURLY["hourStart"].min()), "to": _iso(ACTUAL_HOURLY["hourStart"].max())},
        "forecastCoverage": {"from": _iso(FORECAST_VINTAGES["startTime"].min()), "to": _iso(FORECAST_VINTAGES["startTime"].max())},
        "forecastPublishCoverage": {"from": _iso(FORECAST_VINTAGES["publishTime"].min()), "to": _iso(FORECAST_VINTAGES["publishTime"].max())},
        "unit": "MW",
        "timezone": "Europe/London",
    }


@app.get("/api/analysis")
def analysis(
    delivery_date: date = Query(..., alias="deliveryDate"),
    decision_time: time = Query(time(12, 0), alias="decisionTime"),
) -> dict[str, Any]:
    if delivery_date.month != 1 or delivery_date.year != 2026:
        raise HTTPException(status_code=400, detail="Select a delivery date in January 2026.")
    frame, cutoff_utc = _select_day(delivery_date, decision_time)
    points: list[dict[str, Any]] = []
    for row in frame.itertuples(index=False):
        points.append({
            "startTime": _iso(row.startTime),
            "localTime": row.startTime.tz_convert(UK).strftime("%H:%M"),
            "forecastMW": None if pd.isna(row.forecastMW) else round(float(row.forecastMW), 1),
            "actualMW": None if pd.isna(row.actualMW) else round(float(row.actualMW), 1),
            "publishTime": _iso(row.publishTime),
            "errorMW": None if pd.isna(row.actualMW) or pd.isna(row.forecastMW) else round(float(row.forecastMW - row.actualMW), 1),
        })
    return {
        "deliveryDate": delivery_date.isoformat(),
        "decisionTimeLocal": datetime.combine(delivery_date - timedelta(days=1), decision_time, tzinfo=UK).isoformat(),
        "decisionTimeUtc": cutoff_utc.isoformat().replace("+00:00", "Z"),
        "points": points,
        "metrics": _metric_values(frame),
        "coverage": {
            "expectedHours": int(len(frame)),
            "forecastHours": int(frame["forecastMW"].notna().sum()),
            "actualHours": int(frame["actualMW"].notna().sum()),
            "pairedHours": int(frame.dropna(subset=["forecastMW", "actualMW"]).shape[0]),
        },
    }


@app.get("/api/vintages")
def vintages(
    delivery_date: date = Query(..., alias="deliveryDate"),
) -> dict[str, Any]:
    if delivery_date.month != 1 or delivery_date.year != 2026:
        raise HTTPException(status_code=400, detail="Select a delivery date in January 2026.")
    start_utc = datetime.combine(delivery_date, time.min, tzinfo=UK).astimezone(UTC)
    end_utc = start_utc + timedelta(days=1)
    subset = FORECAST_VINTAGES.loc[
        (FORECAST_VINTAGES["startTime"] >= start_utc) & (FORECAST_VINTAGES["startTime"] < end_utc)
    ]
    publish_times = sorted(subset["publishTime"].dropna().unique())
    return {"deliveryDate": delivery_date.isoformat(), "publishTimes": [_iso(pd.Timestamp(value)) for value in publish_times]}


# In the single-container deployment, FastAPI serves the built React app.
STATIC_DIR = Path(__file__).resolve().parent / "static"
if STATIC_DIR.exists():
    app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="frontend")
