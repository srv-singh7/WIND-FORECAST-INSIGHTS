# Video demo script — target length: 8–9 minutes

The challenge asks for one unlisted YouTube video no longer than 10 minutes, with a customer-facing pilot overview and a technical review. This outline aims for about 4 minutes per part, leaving time for transitions.

## Part 1 — Customer pitch (about 4 minutes)

### 0:00–0:35 | Context

“This pilot is designed for the day-ahead procurement desk. Wind output is weather-dependent, and the team needs a clear view of the latest available wind forecast before deciding how much additional generation to procure. This dashboard focuses on national wind generation and makes both the forecast and its historical error visible.”

### 0:35–1:10 | Decision context

Show the delivery-day selector and decision-cutoff time. Choose a mid-January day with a reasonable forecast match.

“I can choose a January delivery day and set the decision cutoff on the previous day. For this demo the default is noon UK time. The challenge brief says the decision is made one day ahead but does not prescribe a clock time, so the cutoff is configurable. The dashboard selects the newest forecast publication available by that cutoff.”

### 1:10–2:05 | Supply profile

Point to the blue forecast curve, green actual curve, and coverage count.

“The profile shows expected wind alongside actual generation. The coverage indicator matters: it tells us how many hours have both a qualifying forecast and an actual value, so missing data is not mistaken for zero generation. Hovering a point shows the forecast issue time as well as its value.”

### 2:05–3:05 | Quantified uncertainty

Point to MAE, RMSE, bias, weighted MAPE, and the period table.

“These measures answer different questions. MAE gives typical absolute error in MW. RMSE makes larger misses count more. Bias shows whether this forecast vintage leaned high or low. Weighted MAPE expresses total absolute error relative to the actual generation volume. The table lets the buyer inspect period-by-period differences. A positive forecast error means wind was over-forecast; a negative error means it was under-forecast.”

### 3:05–4:00 | Decision value and boundaries

“The pilot makes the available renewable supply and forecast uncertainty easier to inspect before a day-ahead decision. It does not calculate total residual demand or recommend a trade, because the challenge restricts us to wind actuals and forecasts; demand, prices, and thermal availability are not included. The intended next step is to add validated operational inputs and agree the desk’s decision-time convention.”

## Transition (about 10 seconds)

“I’ll now switch from the buyer’s view to the implementation and data methodology.”

## Part 2 — Technical review (about 4 minutes)

### 0:00–0:45 | Architecture

Show the repository tree.

“The UI is a React single-page app built with Vite and Recharts. A Python FastAPI service loads the supplied Elexon JSON files, performs the time-series selection and metric calculations, and exposes metadata and daily analysis endpoints. Local Docker Compose runs Nginx and the API as separate services. A root multi-stage Dockerfile builds the React assets and serves them from FastAPI in one container for a simple hosted sample.”

### 0:45–1:45 | Data handling

Show the raw data filenames and the relevant API/data code.

“The sample contains 1,488 FUELHH WIND records and 17,520 WINDFOR records. Timestamps are parsed as UTC; display and decision cutoffs use Europe/London. Forecasts can have several publication vintages for one delivery hour, so the backend filters to publications at or before the configured cutoff and keeps the latest one per target hour. That avoids using a forecast issued after the buyer’s decision.”

“In the supplied extract, FUELHH is half-hourly and WINDFOR target timestamps are hourly. To compare the same time basis, the app averages each pair of half-hour actual MW values into an hourly actual; incomplete hours are omitted and coverage is reported.”

### 1:45–2:30 | Metrics

Show `_metric_values` in `backend/app/main.py`.

“Metrics are calculated only on paired forecast and actual hours. Error is forecast minus actual. MAE is mean absolute error; RMSE is the square root of mean squared error; bias is mean signed error; weighted MAPE divides summed absolute errors by summed absolute actual generation. We use weighted MAPE rather than averaging period-level percentage errors, which can become unstable at low actual output.”

### 2:30–3:20 | API and front end

Show the analysis route and the dashboard.

“The analysis endpoint accepts deliveryDate and decisionTime, validates that the selected delivery day is in January 2026, and returns the hourly points, publication times, metrics, and coverage counts. The UI uses these values for the metric cards, profile chart, and detail table. Raw sample data is local to the backend so the pilot does not depend on a live upstream request at runtime.”

### 3:20–4:00 | Practices and caveats

Show README, Docker files, and the script/checklist.

“The README documents startup, architecture, the data files, the assumptions, and the AI assistance disclosure. Dependencies are pinned, generated frontend output and local environments are ignored by Git, and Docker Compose separates the services for local work. The exact desk cutoff is still a configurable assumption; results should be reviewed against the client’s actual decision process. This pilot does not include load, market prices, costs, or a procurement recommendation.”

## Recording checklist

- Keep the full recording at 10 minutes or less; target roughly 8–9 minutes.
- Use a clean browser window and hide personal tabs, email addresses, desktop notifications, and unrelated account information.
- Confirm the dashboard is running and has loaded the selected day before recording.
- Make the recording unlisted, then open the video link in an incognito window to verify access.
- Submit that link together with the public repository and deployed app URLs in the challenge form.
