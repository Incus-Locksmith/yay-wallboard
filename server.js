const express = require("express");
const { Pool } = require("pg");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

// Extension-to-agent lookup
const agents = {
  "1002": "Amel",
  "1012": "Armin",
  "1005": "Christian",
  "1008": "Daniel",
  "1010": "Dawn",
  "1004": "Erika",
  "1009": "Hemen",
  "1015": "Louay",
  "1007": "Michele",
  "1003": "Rachel",
  "1001": "Rose",
  "1011": "Selma",
  "1017": "Semir",
  "1013": "Sofa"
};

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS calls (
      id SERIAL PRIMARY KEY,
      uuid TEXT UNIQUE,
      call_type TEXT,
      from_number TEXT,
      to_number TEXT,
      start_time TIMESTAMP,
      end_time TIMESTAMP,
      duration_seconds INTEGER DEFAULT 0,
      answered_by TEXT,
      answer_type TEXT,
      raw_json JSONB,
      received_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
  `);

  await pool.query(`
    ALTER TABLE calls
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();
  `);

  await pool.query(`
  DELETE FROM calls a
  USING calls b
  WHERE a.id > b.id
  AND a.uuid = b.uuid;
`);

await pool.query(`
  CREATE UNIQUE INDEX IF NOT EXISTS calls_uuid_unique
  ON calls (uuid);
`);
}

function formatSeconds(seconds) {
  if (!seconds) return "0s";

  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;

  if (mins === 0) return `${secs}s`;
  return `${mins}m ${secs}s`;
}

// Wallboard page
app.get("/", async (req, res) => {
  const result = await pool.query(`
    SELECT *
    FROM calls
    WHERE start_time >= NOW() - INTERVAL '24 hours'
    ORDER BY start_time DESC
  `);

  const recentCalls = result.rows;
  const answeredCalls = recentCalls.filter(call => call.answered_by);
  const missedCalls = recentCalls.filter(call => !call.answered_by);

  const agentStats = {};

  // Start with every agent, even if they have zero calls
  Object.entries(agents).forEach(([ext, name]) => {
    agentStats[ext] = {
      ext,
      name,
      answered: 0,
      totalDuration: 0,
      status: "No active call"
    };
  });

  answeredCalls.forEach(call => {
    const ext = call.answered_by;
    const name = agents[ext] || `Ext ${ext}`;

    if (!agentStats[ext]) {
      agentStats[ext] = {
        ext,
        name,
        answered: 0,
        totalDuration: 0,
        status: "No active call"
      };
    }

    agentStats[ext].answered += 1;
    agentStats[ext].totalDuration += Number(call.duration_seconds || 0);

    // If there is no end time, treat the agent as engaged
    if (!call.end_time) {
      agentStats[ext].status = "Engaged";
    }
  });

  const agentRows = Object.values(agentStats)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(agent => {
      const avgDuration = agent.answered
        ? Math.round(agent.totalDuration / agent.answered)
        : 0;

      const statusClass = agent.status === "Engaged" ? "engaged" : "inactive";

      return `
        <tr>
          <td>${agent.name}</td>
          <td>${agent.answered}</td>
          <td>${formatSeconds(avgDuration)}</td>
          <td><span class="status ${statusClass}">${agent.status}</span></td>
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
        .status {
          padding: 8px 14px;
          border-radius: 999px;
          font-size: 16px;
          font-weight: bold;
        }
        .engaged {
          background: #dc2626;
          color: white;
        }
        .inactive {
          background: #374151;
          color: #d1d5db;
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
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${agentRows}
        </tbody>
      </table>
    </body>
    </html>
  `);
});

// Yay webhook endpoint
app.post("/webhook/yay", async (req, res) => {
  const data = req.body;

  console.log("Received Yay webhook:", data);

  await pool.query(`
    INSERT INTO calls (
      uuid,
      call_type,
      from_number,
      to_number,
      start_time,
      end_time,
      duration_seconds,
      answered_by,
      answer_type,
      raw_json,
      updated_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
    ON CONFLICT (uuid)
    DO UPDATE SET
      call_type = EXCLUDED.call_type,
      from_number = EXCLUDED.from_number,
      to_number = EXCLUDED.to_number,
      start_time = COALESCE(EXCLUDED.start_time, calls.start_time),
      end_time = COALESCE(EXCLUDED.end_time, calls.end_time),
      duration_seconds = GREATEST(EXCLUDED.duration_seconds, calls.duration_seconds),
      answered_by = COALESCE(NULLIF(EXCLUDED.answered_by, ''), calls.answered_by),
      answer_type = COALESCE(NULLIF(EXCLUDED.answer_type, ''), calls.answer_type),
      raw_json = EXCLUDED.raw_json,
      updated_at = NOW()
  `, [
    data.uuid,
    data.call_type,
    data.from,
    data.to,
    data.start || null,
    data.end || null,
    data.duration || 0,
    data.answered_by || "",
    data.answer_type || "",
    data
  ]);

  res.status(200).send("OK");
});

// Debug page
app.get("/debug", async (req, res) => {
  const result = await pool.query(`
    SELECT *
    FROM calls
    ORDER BY received_at DESC
    LIMIT 50
  `);

  res.json(result.rows);
});

initDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Yay wallboard running on port ${PORT}`);
    });
  })
  .catch(error => {
    console.error("Database failed to start:", error);
    process.exit(1);
  });
