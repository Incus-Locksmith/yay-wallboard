const express = require("express");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Temporary in-memory storage.
// This is enough to prove the wallboard works.
// Later we can move this to a proper database.
let calls = [];

// Extension-to-agent lookup
const agents = {
  "1003": "Agent 1003",
  "1004": "Agent 1004",
  "1005": "Agent 1005"
};

// Home page / wallboard
app.get("/", (req, res) => {
  const now = new Date();
  const since = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const recentCalls = calls.filter(call => {
    const start = new Date(call.start_time);
    return start >= since;
  });

  const answeredCalls = recentCalls.filter(call => call.answered_by);
  const missedCalls = recentCalls.filter(call => !call.answered_by);

  const agentStats = {};

  answeredCalls.forEach(call => {
    const ext = call.answered_by;
    const name = agents[ext] || `Ext ${ext}`;

    if (!agentStats[ext]) {
      agentStats[ext] = {
        name,
        answered: 0,
        totalDuration: 0
      };
    }

    agentStats[ext].answered += 1;
    agentStats[ext].totalDuration += Number(call.duration_seconds || 0);
  });

  const agentRows = Object.values(agentStats).map(agent => {
    const avgDuration = agent.answered
      ? Math.round(agent.totalDuration / agent.answered)
      : 0;

    return `
      <tr>
        <td>${agent.name}</td>
        <td>${agent.answered}</td>
        <td>${formatSeconds(avgDuration)}</td>
      </tr>
    `;
  }).join("");

  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Keys247 Call Wallboard (Incus)</title>
      <meta http-equiv="refresh" content="5">
      <style>
        body {
          font-family: Arial, sans-serif;
          background: #111827;
          color: white;
          padding: 40px;
        }
        h1 {
          font-size: 42px;
          margin-bottom: 5px;
        }
        .subtitle {
          color: #9ca3af;
          margin-bottom: 30px;
        }
        .cards {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 20px;
          margin-bottom: 40px;
        }
        .card {
          background: #1f2937;
          border-radius: 14px;
          padding: 25px;
        }
        .label {
          color: #9ca3af;
          font-size: 16px;
        }
        .value {
          font-size: 42px;
          font-weight: bold;
          margin-top: 10px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          background: #1f2937;
          border-radius: 14px;
          overflow: hidden;
        }
        th, td {
          text-align: left;
          padding: 18px;
          border-bottom: 1px solid #374151;
          font-size: 22px;
        }
        th {
          color: #9ca3af;
          font-size: 16px;
          text-transform: uppercase;
        }
      </style>
    </head>
    <body>
      <h1>Keys247 Call Wallboard (Incus)</h1>
      <div class="subtitle">Rolling last 24 hours · Auto-refreshes every 5 seconds</div>

      <div class="cards">
        <div class="card">
          <div class="label">Total Calls</div>
          <div class="value">${recentCalls.length}</div>
        </div>
        <div class="card">
          <div class="label">Answered</div>
          <div class="value">${answeredCalls.length}</div>
        </div>
        <div class="card">
          <div class="label">Missed</div>
          <div class="value">${missedCalls.length}</div>
        </div>
        <div class="card">
          <div class="label">Miss Rate</div>
          <div class="value">${recentCalls.length ? Math.round((missedCalls.length / recentCalls.length) * 100) : 0}%</div>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Agent</th>
            <th>Answered</th>
            <th>Avg Duration</th>
          </tr>
        </thead>
        <tbody>
          ${agentRows || `<tr><td colspan="3">No answered calls yet</td></tr>`}
        </tbody>
      </table>
    </body>
    </html>
  `);
});

// Yay webhook endpoint
app.post("/webhook/yay", (req, res) => {
  const data = req.body;

  console.log("Received Yay webhook:", data);

  calls.push({
    uuid: data.uuid,
    call_type: data.call_type,
    from_number: data.from,
    to_number: data.to,
    start_time: data.start,
    end_time: data.end || null,
    duration_seconds: data.duration || 0,
    answered_by: data.answered_by || "",
    answer_type: data.answer_type || "",
    raw_json: data,
    received_at: new Date().toISOString()
  });

  res.status(200).send("OK");
});

// Debug page so you can see raw calls
app.get("/debug", (req, res) => {
  res.json(calls);
});

function formatSeconds(seconds) {
  if (!seconds) return "0s";

  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;

  if (mins === 0) return `${secs}s`;
  return `${mins}m ${secs}s`;
}

app.listen(PORT, () => {
  console.log(`Yay wallboard running on port ${PORT}`);
});
