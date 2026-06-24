/**
 * k6 PROOFS — HTML Report Generator
 * 
 * Custom handleSummary for proof runs that produces an HTML report
 * alongside the standard k6 output.
 */

export function generateHtmlReport(data, opts = {}) {
  const title = opts.title || 'k6 PROOFS Report';
  const sha = opts.sha || __ENV.PROOF_SHA || 'unknown';
  const seat = opts.seat || __ENV.PROOF_SEAT || 'unknown';
  const timestamp = new Date().toISOString();

  const metrics = data.metrics;
  const passCount = metrics.proof_row_pass ? metrics.proof_row_pass.values.count : 0;
  const failCount = metrics.proof_row_fail ? metrics.proof_row_fail.values.count : 0;
  const total = passCount + failCount;
  const passRate = total > 0 ? ((passCount / total) * 100).toFixed(1) : '0';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; margin: 2rem; background: #1a1a2e; color: #eee; }
    h1 { color: #4ecdc4; }
    .meta { color: #888; margin-bottom: 2rem; }
    .summary { display: flex; gap: 2rem; margin-bottom: 2rem; }
    .card { background: #16213e; padding: 1.5rem; border-radius: 8px; min-width: 120px; text-align: center; }
    .card .num { font-size: 2rem; font-weight: bold; }
    .pass { color: #4ecdc4; }
    .fail { color: #ff6b6b; }
    .rate { color: #ffd93d; }
    table { border-collapse: collapse; width: 100%; }
    th, td { padding: 0.75rem 1rem; text-align: left; border-bottom: 1px solid #333; }
    th { background: #16213e; color: #4ecdc4; }
    .verdict-pass { color: #4ecdc4; font-weight: bold; }
    .verdict-fail { color: #ff6b6b; font-weight: bold; }
  </style>
</head>
<body>
  <h1>${title}</h1>
  <div class="meta">
    SHA: <code>${sha}</code> | Seat: <code>${seat}</code> | Generated: ${timestamp}
  </div>
  <div class="summary">
    <div class="card"><div class="num pass">${passCount}</div>PASS</div>
    <div class="card"><div class="num fail">${failCount}</div>FAIL</div>
    <div class="card"><div class="num rate">${passRate}%</div>Rate</div>
    <div class="card"><div class="num">${total}</div>Total</div>
  </div>
  <h2>Metrics</h2>
  <table>
    <tr><th>Metric</th><th>Value</th></tr>
    ${Object.entries(metrics).map(([name, m]) => {
      const val = m.values;
      const display = val.avg !== undefined ? \`avg: \${val.avg.toFixed(2)}ms\` :
                      val.count !== undefined ? \`count: \${val.count}\` :
                      val.rate !== undefined ? \`rate: \${(val.rate * 100).toFixed(1)}%\` :
                      JSON.stringify(val);
      return \`<tr><td>\${name}</td><td>\${display}</td></tr>\`;
    }).join('\\n    ')}
  </table>
</body>
</html>`;
}

export function handleSummary(data) {
  const html = generateHtmlReport(data);
  const jsonSummary = JSON.stringify(data, null, 2);
  
  return {
    'stdout': textSummary(data, { indent: ' ', enableColors: true }),
    'report.html': html,
    'summary.json': jsonSummary,
  };
}
