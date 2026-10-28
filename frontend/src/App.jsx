import { useEffect, useMemo, useState } from 'react';
import {
  Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from 'recharts';

const fmt = (value, digits = 0) => value == null ? '—' : new Intl.NumberFormat('en-GB', { maximumFractionDigits: digits }).format(value);
const localDay = (date) => new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`));

function MetricCard({ label, value, unit, detail, icon, accent }) {
  return <article className="metric-card">
    <div className="metric-top"><span>{label}</span><span className={`metric-icon ${accent}`}>{icon}</span></div>
    <div className="metric-value">{value}<small>{unit}</small></div>
    <div className="metric-detail">{detail}</div>
  </article>;
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload;
  return <div className="chart-tooltip">
    <strong>{label} UK time</strong>
    <span><i className="dot forecast-dot" />Forecast <b>{fmt(point?.forecastMW)} MW</b></span>
    <span><i className="dot actual-dot" />Actual <b>{fmt(point?.actualMW)} MW</b></span>
    {point?.publishTime && <small>Forecast published {new Date(point.publishTime).toLocaleString('en-GB', { timeZone: 'Europe/London', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</small>}
  </div>;
}

export default function App() {
  const [metadata, setMetadata] = useState(null);
  const [deliveryDate, setDeliveryDate] = useState('2026-01-15');
  const [decisionTime, setDecisionTime] = useState('12:00');
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/metadata').then((r) => { if (!r.ok) throw new Error('Could not load dataset metadata'); return r.json(); })
      .then((data) => { setMetadata(data); setDeliveryDate(data.defaultDeliveryDate || '2026-01-15'); })
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    if (!deliveryDate) return;
    const controller = new AbortController();
    setLoading(true); setError('');
    fetch(`/api/analysis?deliveryDate=${deliveryDate}&decisionTime=${decisionTime}`, { signal: controller.signal })
      .then((r) => { if (!r.ok) return r.json().then((body) => { throw new Error(body.detail || 'Could not load analysis'); }); return r.json(); })
      .then(setAnalysis)
      .catch((e) => { if (e.name !== 'AbortError') setError(e.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [deliveryDate, decisionTime]);

  const dayChoices = useMemo(() => metadata?.deliveryDates?.filter((d) => d.startsWith('2026-01')) || [], [metadata]);
  const points = analysis?.points || [];
  const metrics = analysis?.metrics || {};
  const coverage = analysis?.coverage || {};
  const forecastCoverage = coverage.expectedHours ? Math.round((coverage.forecastHours / coverage.expectedHours) * 100) : 0;

  return <div className="app-shell">
    <aside className="sidebar">
      <a className="brand" href="#overview" aria-label="Northstar home"><span className="brand-mark"><i /></span><span>northstar<small>ENERGY INTELLIGENCE</small></span></a>
      <div className="workspace-label">WORKSPACE</div>
      <nav className="side-nav">
        <a className="nav-item active" href="#overview"><span className="nav-symbol">▦</span>Overview</a>
        <a className="nav-item" href="#forecast"><span className="nav-symbol">⌁</span>Forecast analysis</a>
        <a className="nav-item" href="#periods"><span className="nav-symbol">▤</span>Half-hourly data</a>
      </nav>
      <div className="side-bottom">
        <div className="data-card"><div className="data-card-head"><span className="live-dot" />DATA WINDOW</div><strong>January 2026</strong><span>National wind · Great Britain</span><div className="source-mini"><span>FUELHH</span><span>WINDFOR</span></div></div>
        <div className="profile"><span className="avatar">GB</span><span><b>Grid buyer</b><small>Day-ahead desk</small></span><span className="profile-menu">···</span></div>
      </div>
    </aside>

    <main className="main-content" id="overview">
      <header className="topbar"><div className="breadcrumb">Portfolio <span>/</span> Wind generation</div><div className="top-actions"><span className="demo-badge"><i />Pilot workspace</span><button className="help-button" title="About this pilot">?</button></div></header>
      <section className="page-heading">
        <div><div className="eyebrow"><span className="eyebrow-mark">↗</span> DAY-AHEAD PROCUREMENT</div><h1>Wind forecast outlook</h1><p>Understand expected renewable supply and forecast uncertainty before the market decision.</p></div>
        <div className="heading-meta"><span className="meta-label">DATA SOURCES</span><span className="source-pills"><b>FUELHH</b><b>WINDFOR</b></span><span className="updated-label">January 2026 sample</span></div>
      </section>

      <section className="decision-panel" aria-label="Decision context">
        <div className="decision-intro"><span className="decision-icon">◷</span><div><strong>Decision context</strong><small>Review the latest forecast available before the purchase decision.</small></div></div>
        <label className="field"><span>DELIVERY DAY</span><select value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)}>{dayChoices.map((d) => <option key={d} value={d}>{localDay(d)}</option>)}</select></label>
        <label className="field time-field"><span>DECISION CUTOFF <em>UK time</em></span><input type="time" value={decisionTime} onChange={(e) => setDecisionTime(e.target.value)} /></label>
        <div className="cutoff-note"><span>↳</span> Forecast vintage published by {analysis?.decisionTimeLocal ? new Date(analysis.decisionTimeLocal).toLocaleString('en-GB', { timeZone: 'Europe/London', weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'the previous day'}</div>
      </section>

      {error && <div className="error-banner"><b>Data could not be loaded.</b> {error}. Make sure the API service is running.</div>}
      <section className="metrics-grid" aria-label="Forecast accuracy metrics">
        <MetricCard label="FORECAST ERROR · MAE" value={loading ? '…' : fmt(metrics.maeMW)} unit="MW" detail="Average absolute hourly error" icon="↕" accent="icon-blue" />
        <MetricCard label="RMSE" value={loading ? '…' : fmt(metrics.rmseMW)} unit="MW" detail="Penalises larger misses more" icon="⌁" accent="icon-violet" />
        <MetricCard label="FORECAST BIAS" value={loading ? '…' : fmt(metrics.biasMW)} unit="MW" detail={metrics.biasMW == null ? 'Forecast minus actual' : metrics.biasMW > 0 ? 'Forecast tended to overpredict' : metrics.biasMW < 0 ? 'Forecast tended to underpredict' : 'No net over or underprediction'} icon="↗" accent="icon-amber" />
        <MetricCard label="WEIGHTED MAPE" value={loading ? '…' : fmt(metrics.wmapePercent, 1)} unit="%" detail="Absolute error / actual generation" icon="%" accent="icon-green" />
      </section>

      <section className="chart-card" id="forecast">
        <div className="card-heading"><div><div className="section-kicker">SUPPLY PROFILE</div><h2>Forecast vs actual generation</h2><p>{deliveryDate ? localDay(deliveryDate) : 'January 2026'} <span className="muted-dot">·</span> Hourly average <span className="muted-dot">·</span> MW</p></div><div className="coverage-chip"><span className="live-dot" />{coverage.pairedHours ?? 0} of 24 hours paired</div></div>
        <div className="legend"><span><i className="legend-line forecast-line" />Day-ahead wind forecast</span><span><i className="legend-line actual-line" />Actual wind generation</span></div>
        <div className="chart-wrap">{loading ? <div className="chart-loading">Preparing the day-ahead view…</div> : <ResponsiveContainer width="100%" height="100%"><AreaChart data={points} margin={{ top: 14, right: 10, left: 0, bottom: 0 }}>
          <defs><linearGradient id="forecastFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#5579ef" stopOpacity={0.15} /><stop offset="95%" stopColor="#5579ef" stopOpacity={0.015} /></linearGradient></defs>
          <CartesianGrid stroke="#edf0f5" vertical={false} />
          <XAxis dataKey="localTime" tick={{ fill: '#8a93a3', fontSize: 11 }} tickLine={false} axisLine={false} interval={3} tickMargin={12} />
          <YAxis tick={{ fill: '#8a93a3', fontSize: 11 }} tickLine={false} axisLine={false} width={55} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
          <Tooltip content={<CustomTooltip />} /><ReferenceLine y={0} stroke="#e7ebf1" />
          <Area type="monotone" dataKey="forecastMW" name="Forecast" stroke="#5879eb" strokeWidth={2.5} fill="url(#forecastFill)" connectNulls={false} dot={false} activeDot={{ r: 4, fill: '#fff', stroke: '#5879eb', strokeWidth: 2 }} />
          <Area type="monotone" dataKey="actualMW" name="Actual" stroke="#2aa887" strokeWidth={2.5} fill="transparent" connectNulls={false} dot={false} activeDot={{ r: 4, fill: '#fff', stroke: '#2aa887', strokeWidth: 2 }} />
        </AreaChart></ResponsiveContainer>}</div>
        <div className="chart-footer"><span><b>Forecast coverage</b> {forecastCoverage}% <span className="footer-divider">·</span> {coverage.forecastHours ?? 0}/24 hourly periods</span><span>Forecast issue cutoff: {analysis?.decisionTimeUtc ? new Date(analysis.decisionTimeUtc).toLocaleString('en-GB', { timeZone: 'UTC', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) + ' UTC' : '—'}</span></div>
      </section>

      <section className="bottom-grid">
        <article className="table-card" id="periods">
          <div className="card-heading table-heading"><div><div className="section-kicker">PERIOD DETAIL</div><h2>Hourly delivery periods</h2></div><span className="table-count">24 PERIODS</span></div>
          <div className="table-scroll"><table><thead><tr><th>UK TIME</th><th>FORECAST</th><th>ACTUAL</th><th>ERROR</th><th>ISSUED AT</th></tr></thead><tbody>
            {points.map((p) => <tr key={p.startTime}><td className="time-cell">{p.localTime}</td><td>{fmt(p.forecastMW)} <small>MW</small></td><td>{fmt(p.actualMW)} <small>MW</small></td><td className={p.errorMW == null ? '' : p.errorMW > 0 ? 'error-positive' : 'error-negative'}>{p.errorMW == null ? '—' : `${p.errorMW > 0 ? '+' : ''}${fmt(p.errorMW)}`} {p.errorMW != null && <small>MW</small>}</td><td className="issued-cell">{p.publishTime ? new Date(p.publishTime).toLocaleTimeString('en-GB', { timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit' }) : 'No vintage by cutoff'}</td></tr>)}
          </tbody></table></div>
        </article>
        <aside className="insight-card"><div className="insight-icon">✦</div><div className="section-kicker">HOW TO READ THIS</div><h3>Make uncertainty visible</h3><p>The selected forecast is the latest WINDFOR publication at or before your decision cutoff. Compare it with actual output to see how forecast error could affect the residual power requirement.</p><div className="formula"><span>Residual demand impact</span><b>Forecast error = forecast − actual</b><small>Positive means wind was over-forecast.</small></div><div className="data-note"><span>ⓘ</span><span>GB national aggregates only. Demand and market prices are outside this pilot’s scope.</span></div></aside>
      </section>

      <footer className="page-footer"><span>Northstar <i>·</i> Wind procurement pilot</span><span>Source: Elexon Insights API <i>·</i> Sample period: Jan 2026</span></footer>
    </main>
  </div>;
}
