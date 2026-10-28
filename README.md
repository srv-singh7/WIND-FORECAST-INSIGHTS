# Northstar — Wind Forecast Insights

A full-stack pilot dashboard for a UK day-ahead power procurement team. It compares Elexon national wind forecasts with actual wind generation for January 2026 and makes forecast publication time visible alongside quantitative forecast error.

> **Pilot boundary:** this app analyses national wind data only. It does not include electricity demand, market prices, thermal generation, or a recommended purchase quantity. Forecast error is an input to procurement judgement, not a trading instruction.

## What the app does

- Select a January 2026 delivery date and a configurable decision cutoff on the previous day (UK local time).
- Select the latest WINDFOR vintage for each delivery hour whose `publishTime` is at or before the cutoff.
- Compare forecast generation with FUELHH actual generation in a profile chart and hourly table.
- Calculate MAE, RMSE, forecast bias, and generation-weighted MAPE for paired hourly periods.
- Show forecast, actual, and paired-period coverage so missing vintages or outturns are visible.

## Data and analysis assumptions

- `backend/data/raw/fuelhh_wind_january_2026.json.gz` is the supplied, gzip-compressed FUELHH extract. The app filters for `fuelType == "WIND"`.
- `backend/data/raw/windfor_january_2026.json.gz` is the supplied, gzip-compressed WINDFOR extract. Forecasts are identified by `startTime` and publication vintage by `publishTime`.
- The supplied FUELHH file has 1,488 half-hour records covering January 2026. WINDFOR has 17,520 records and 240 distinct publication timestamps. Its target timestamps in this extract are hourly.
- FUELHH reports average MW per half-hour; this app averages the two half-hour actual values in each clock hour to compare to hourly WINDFOR targets. It only includes complete two-record hours.
- The brief says decisions happen one day ahead but does not specify the exact decision time. The app defaults to 12:00 UK time on the previous day and lets the user change it. This is a demonstration assumption, not an Elexon rule. The selected forecast vintage is the newest record published by that cutoff.
- All dataset timestamps are parsed as UTC and displayed in `Europe/London`. January 2026 is GMT (UTC+0).
- Metrics use `error = forecast − actual`: MAE is mean absolute error; RMSE is root mean squared error; bias is mean signed error (positive means over-forecast); weighted MAPE is sum of absolute errors divided by sum of absolute actual generation. Weighted MAPE is undefined when the actual-generation denominator is zero.
- The app uses only the two datasets supplied for the challenge. It does not fetch live API data.

## Project structure

```text
wind-forecast-insights/
├── backend/
│   ├── app/main.py             # Data loading, vintage selection, metrics, API routes
│   ├── data/raw/               # Supplied January 2026 source JSON files (gzip)
│   ├── Dockerfile              # FastAPI container for local Compose
│   └── requirements.txt        # Python dependencies
├── frontend/
│   ├── src/App.jsx             # Dashboard, chart, metric cards, hourly table
│   ├── src/styles.css          # Responsive dashboard styling
│   ├── Dockerfile              # Build React and serve it through Nginx
│   ├── nginx.conf              # Proxy API requests to FastAPI
│   └── package.json            # React, Vite, Recharts dependencies
├── Dockerfile                  # Single-container image for a Docker host
├── docker-compose.yml          # Local frontend + backend services
└── vercel.json                 # Frontend + FastAPI service and routing configuration
```

## Run locally without Docker

Requires Python 3.11 or 3.12 and Node.js 24 LTS (or another compatible current LTS).

### Backend

```powershell
cd backend
py -3.11 -m venv .venv
.\\.venv\\Scripts\\python.exe -m pip install -r requirements.txt
.\\.venv\\Scripts\\python.exe -m uvicorn app.main:app --reload --port 8000
```

The API is available at `http://localhost:8000`; interactive API docs are at `http://localhost:8000/docs`.

### Frontend

In a second terminal:

```powershell
cd frontend
npm install
npm run dev
```

Open the Vite URL shown in the terminal (normally `http://localhost:5173`). Vite proxies `/api` to the backend on port 8000.

## Run with Docker

Install and start Docker Desktop, then from this project directory:

```powershell
docker compose up --build
```

Open `http://localhost:8080`. The API is available at `http://localhost:8000/docs`. Stop with `Ctrl+C`, then `docker compose down`.

## Deploy the sample app to Vercel

The root `vercel.json` defines a Vite web service and a FastAPI service in one project. It sends `/api/*` and `/health` requests to FastAPI and all other paths to the React app. See [Vercel Services](https://vercel.com/docs/services) for the current multi-service deployment model.

In Vercel, import this public GitHub repository and deploy from the repository root. If prompted, set the project framework to **Services**. Vercel Services are currently in beta and may require access to be enabled for your account. Alternatively, with the Vercel CLI installed and authenticated:

```powershell
npx vercel
npx vercel --prod
```

Add the final public Vercel URL to this README. The root `Dockerfile` remains available if you choose a Docker host such as Heroku instead.

## GitHub and challenge submission checklist

- Create a **public GitHub repository** with a random/anonymous name, then push this folder.
- Keep the source data files in the repository so the deployed demo can start without a separate data download.
- Replace the deployment placeholder with the public app URL.
