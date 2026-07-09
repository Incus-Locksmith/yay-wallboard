const express = require("express");
const { Pool } = require("pg");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
      uuid TEXT,
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
    AND a.uuid = b.uuid
    AND a.uuid IS NOT NULL;
  `);

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS calls_uuid_unique
    ON calls (uuid);
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS technicians (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT,
      base_postcode TEXT,
      current_postcode TEXT,
      status TEXT DEFAULT 'Available',
      available_from TEXT,
      skills TEXT,
      notes TEXT,
      active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
  `);
}

function escapeHtml(value) {
  if (value === null || value === undefined) return "";

  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatSeconds(seconds) {
  if (!seconds) return "0s";

  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;

  if (mins === 0) return `${secs}s`;
  return `${mins}m ${secs}s`;
}

function formatDateTime(date) {
  if (!date) return "—";

  return new Date(date).toLocaleString("en-GB", {
    timeZone: "Europe/London",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
}

function formatTimeOnly(date) {
  if (!date) return "—";

  return new Date(date).toLocaleTimeString("en-GB", {
    timeZone: "Europe/London",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
}

function technicianStatusClass(status) {
  const value = (status || "").toLowerCase();

  if (value.includes("soon")) return "soon";
  if (value.includes("available")) return "available";
  if (value.includes("job")) return "onjob";
  if (value.includes("holiday")) return "off";
  if (value.includes("sick")) return "off";
  if (value.includes("vehicle")) return "bad";
  if (value.includes("do not")) return "bad";
  if (value.includes("off")) return "off";

  return "neutral";
}

function dispatchRank(status) {
  const value = (status || "").toLowerCase();

  if (value.includes("available") && !value.includes("soon")) return 1;
  if (value.includes("soon")) return 2;
  if (value.includes("job")) return 3;
  return 4;
}

function isUsableForDispatch(status) {
  const value = (status || "").toLowerCase();

  return (
    value.includes("available") ||
    value.includes("soon") ||
    value.includes("job")
  );
}

function getBestLocation(tech) {
  const current = (tech.current_postcode || "").trim();
  const base = (tech.base_postcode || "").trim();

  if (current) {
    return {
      postcode: current,
      source: "Current"
    };
  }

  if (base) {
    return {
      postcode: base,
      source: "Base"
    };
  }

  return {
    postcode: "",
    source: "Unknown"
  };
}

function postcodePrecision(postcode) {
  const value = (postcode || "").trim().toUpperCase();

  // Rough UK full postcode check, good enough for display.
  const fullPostcodeRegex = /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i;

  if (!value) return "Unknown";
  if (fullPostcodeRegex.test(value)) return "Exact";

  return "Approx";
}

function sharedStyles() {
  return `
    body {
      font-family: Arial, sans-serif;
      background: #111827;
      color: white;
      padding: 40px;
    }

    a {
      color: #93c5fd;
      text-decoration: none;
      margin-right: 18px;
    }

    h1 {
      font-size: 42px;
      margin-bottom: 5px;
    }

    h2 {
      margin-top: 0;
    }

    .subtitle {
      color: #9ca3af;
      margin-bottom: 30px;
    }

    .nav {
      margin-bottom: 25px;
    }

    .panel {
      background: #1f2937;
      border-radius: 14px;
      padding: 25px;
      margin-bottom: 35px;
    }

    input, select, textarea, button {
      font-size: 16px;
      padding: 12px;
      border-radius: 8px;
      border: 1px solid #374151;
    }

    input, select, textarea {
      background: #111827;
      color: white;
    }

    button {
      background: #2563eb;
      color: white;
      border: none;
      cursor: pointer;
      font-weight: bold;
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
      padding: 14px;
      border-bottom: 1px solid #374151;
      font-size: 16px;
      vertical-align: top;
    }

    th {
      color: #9ca3af;
      font-size: 13px;
      text-transform: uppercase;
    }

    .pill, .status {
      padding: 7px 12px;
      border-radius: 999px;
      font-size: 13px;
      font-weight: bold;
      white-space: nowrap;
    }

    .available {
      background: #16a34a;
      color: white;
    }

    .soon {
      background: #f59e0b;
      color: black;
    }

    .onjob {
      background: #2563eb;
      color: white;
    }

    .off {
      background: #6b7280;
      color: white;
    }

    .bad {
      background: #dc2626;
      color: white;
    }

    .neutral, .inactive {
      background: #374151;
      color: #d1d5db;
    }

    .engaged {
      background: #dc2626;
      color: white;
    }

    .muted {
      color: #9ca3af;
    }

    .warning-text {
      color: #fbbf24;
      font-weight: bold;
    }
  `;
}

// Call wallboard page
app.get("/", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT *
      FROM calls
      WHERE start_time >= NOW() - INTERVAL '24 hours'
      ORDER BY start_time DESC
    `);

    const latestResult = await pool.query(`
      SELECT MAX(received_at) AS last_received
      FROM calls
    `);

    const recentCalls = result.rows;
    const answeredCalls = recentCalls.filter(call => call.answered_by);
    const missedCalls = recentCalls.filter(call => !call.answered_by);

    const missedRate = recentCalls.length
      ? Math.round((missedCalls.length / recentCalls.length) * 100)
      : 0;

    let missedRateClass = "good";

    if (recentCalls.length === 0) {
      missedRateClass = "neutral";
    } else if (missedRate >= 20) {
      missedRateClass = "bad";
    } else if (missedRate >= 10) {
      missedRateClass = "soon";
    }

    const lastReceived = latestResult.rows[0].last_received;

    const lastUpdatedText = lastReceived
      ? `Last call received: ${formatDateTime(lastReceived)}`
      : "No calls received yet";

    const pageUpdatedText = `Page refreshed: ${formatDateTime(new Date())}`;

    const agentStats = {};

    Object.entries(agents).forEach(([ext, name]) => {
      agentStats[ext] = {
        ext,
        name,
        answered: 0,
        totalDuration: 0,
        lastCallTime: null,
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
          lastCallTime: null,
          status: "No active call"
        };
      }

      agentStats[ext].answered += 1;
      agentStats[ext].totalDuration += Number(call.duration_seconds || 0);

      const callTime = call.start_time || call.received_at;

      if (
        !agentStats[ext].lastCallTime ||
        new Date(callTime) > new Date(agentStats[ext].lastCallTime)
      ) {
        agentStats[ext].lastCallTime = callTime;
      }

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
            <td>${escapeHtml(agent.name)}</td>
            <td>${agent.answered}</td>
            <td>${formatSeconds(avgDuration)}</td>
            <td>${formatTimeOnly(agent.lastCallTime)}</td>
            <td><span class="status ${statusClass}">${agent.status}</span></td>
          </tr>
        `;
      })
      .join("");

    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Keys247 Call Wallboard (Incus)</title>
        <meta http-equiv="refresh" content="5">
        <style>
          ${sharedStyles()}

          .updated {
            color: #d1d5db;
            font-size: 16px;
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
            border: 2px solid transparent;
          }

          .card.good {
            border-color: #16a34a;
          }

          .card.soon {
            border-color: #f59e0b;
          }

          .card.bad {
            border-color: #dc2626;
          }

          .card.neutral {
            border-color: #374151;
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

          .value.good {
            color: #22c55e;
          }

          .value.soon {
            color: #fbbf24;
          }

          .value.bad {
            color: #ef4444;
          }

          .value.neutral {
            color: white;
          }
        </style>
      </head>

      <body>
        <div class="nav">
          <a href="/">Call Wallboard</a>
          <a href="/technicians">Technicians</a>
          <a href="/dispatch">Dispatch</a>
        </div>

        <h1>Keys247 Call Wallboard (Incus)</h1>

        <div class="subtitle">Rolling last 24 hours · Auto-refreshes every 5 seconds</div>

        <div class="updated">
          ${lastUpdatedText} · ${pageUpdatedText}
        </div>

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

          <div class="card ${missedRateClass}">
            <div class="label">Miss Rate</div>
            <div class="value ${missedRateClass}">${missedRate}%</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Agent</th>
              <th>Answered</th>
              <th>Avg Duration</th>
              <th>Last Call</th>
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
  } catch (error) {
    console.error("Wallboard error:", error);
    res.status(500).send("Wallboard error. Check Render logs.");
  }
});

// Dispatch page
app.get("/dispatch", async (req, res) => {
  try {
    const customerPostcode = (req.query.postcode || "").trim().toUpperCase();
    const jobType = (req.query.job_type || "").trim();

    const result = await pool.query(`
      SELECT *
      FROM technicians
      WHERE active = TRUE
      ORDER BY updated_at DESC
    `);

    const technicians = result.rows;

    const candidates = technicians
      .filter(tech => isUsableForDispatch(tech.status))
      .sort((a, b) => {
        const rankDiff = dispatchRank(a.status) - dispatchRank(b.status);
        if (rankDiff !== 0) return rankDiff;

        return new Date(b.updated_at) - new Date(a.updated_at);
      });

    const rows = candidates.map((tech, index) => {
      const statusClass = technicianStatusClass(tech.status);
      const location = getBestLocation(tech);
      const precision = postcodePrecision(location.postcode);

      const precisionText = precision === "Approx"
        ? `<span class="warning-text">Approx</span>`
        : escapeHtml(precision);

      return `
        <tr>
          <td>${index + 1}</td>
          <td><strong>${escapeHtml(tech.name)}</strong><br><span class="muted">${escapeHtml(tech.phone)}</span></td>
          <td><span class="pill ${statusClass}">${escapeHtml(tech.status)}</span></td>
          <td>${escapeHtml(tech.available_from || "Now / check")}</td>
          <td>
            ${escapeHtml(location.postcode || "No postcode")}
            <br>
            <span class="muted">${escapeHtml(location.source)} · ${precisionText}</span>
          </td>
          <td>${escapeHtml(tech.skills)}</td>
          <td>${escapeHtml(tech.notes)}</td>
          <td>${formatDateTime(tech.updated_at)}</td>
        </tr>
      `;
    }).join("");

    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Dispatch</title>
        <meta http-equiv="refresh" content="60">
        <style>
          ${sharedStyles()}

          form.search {
            display: grid;
            grid-template-columns: 2fr 2fr 1fr;
            gap: 15px;
          }

          .notice {
            background: #1f2937;
            border-left: 5px solid #f59e0b;
            border-radius: 10px;
            padding: 18px;
            margin-bottom: 25px;
            color: #d1d5db;
          }
        </style>
      </head>

      <body>
        <div class="nav">
          <a href="/">Call Wallboard</a>
          <a href="/technicians">Technicians</a>
          <a href="/dispatch">Dispatch</a>
        </div>

        <h1>Dispatch</h1>
        <div class="subtitle">Find a suitable available locksmith quickly</div>

        <div class="panel">
          <form class="search" method="GET" action="/dispatch">
            <input name="postcode" value="${escapeHtml(customerPostcode)}" placeholder="Customer postcode e.g. CR0 5JH">
            <input name="job_type" value="${escapeHtml(jobType)}" placeholder="Job type e.g. lockout, uPVC">
            <button type="submit">Find Locksmith</button>
          </form>
        </div>

        ${
          customerPostcode
            ? `<div class="notice">
                Showing available / usable locksmiths for <strong>${escapeHtml(customerPostcode)}</strong>.
                This version does not calculate distance yet. Partial postcodes are marked as approximate.
              </div>`
            : `<div class="notice">
                Enter a customer postcode to help the agent shortlist locksmiths. This version sorts by availability and freshness, not driving distance yet.
              </div>`
        }

        <table>
          <thead>
            <tr>
              <th>Rank</th>
              <th>Technician</th>
              <th>Status</th>
              <th>Available From</th>
              <th>Location</th>
              <th>Skills</th>
              <th>Notes</th>
              <th>Last Updated</th>
            </tr>
          </thead>

          <tbody>
            ${rows || `<tr><td colspan="8">No available technicians found</td></tr>`}
          </tbody>
        </table>
      </body>
      </html>
    `);
  } catch (error) {
    console.error("Dispatch page error:", error);
    res.status(500).send("Dispatch page error. Check Render logs.");
  }
});

// Technician availability board
app.get("/technicians", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT *
      FROM technicians
      WHERE active = TRUE
      ORDER BY
        CASE
          WHEN LOWER(status) LIKE '%available%' THEN 1
          WHEN LOWER(status) LIKE '%soon%' THEN 2
          WHEN LOWER(status) LIKE '%job%' THEN 3
          ELSE 4
        END,
        name ASC
    `);

    const technicians = result.rows;

    const rows = technicians.map(tech => {
      const statusClass = technicianStatusClass(tech.status);

      return `
        <tr>
          <td>${escapeHtml(tech.name)}</td>
          <td>${escapeHtml(tech.phone)}</td>
          <td>${escapeHtml(tech.base_postcode)}</td>
          <td>${escapeHtml(tech.current_postcode)}</td>
          <td><span class="pill ${statusClass}">${escapeHtml(tech.status)}</span></td>
          <td>${escapeHtml(tech.available_from)}</td>
          <td>${escapeHtml(tech.skills)}</td>
          <td>${escapeHtml(tech.notes)}</td>
          <td>${formatDateTime(tech.updated_at)}</td>
          <td>
            <form method="GET" action="/technicians/edit" style="display:inline;">
              <input type="hidden" name="id" value="${tech.id}">
              <button type="submit">Edit</button>
            </form>
          </td>
        </tr>
      `;
    }).join("");

    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Technician Availability</title>
        <meta http-equiv="refresh" content="30">
        <style>
          ${sharedStyles()}

          form.grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 15px;
          }

          textarea {
            grid-column: span 4;
            min-height: 70px;
          }
        </style>
      </head>

      <body>
        <div class="nav">
          <a href="/">Call Wallboard</a>
          <a href="/technicians">Technicians</a>
          <a href="/dispatch">Dispatch</a>
        </div>

        <h1>Technician Availability</h1>
        <div class="subtitle">Live locksmith availability board · Auto-refreshes every 30 seconds</div>

        <div class="panel">
          <h2>Add Technician</h2>

          <form class="grid" method="POST" action="/technicians/save">
            <input name="name" placeholder="Name" required>
            <input name="phone" placeholder="Phone">
            <input name="base_postcode" placeholder="Base postcode">
            <input name="current_postcode" placeholder="Current postcode">

            <select name="status">
              <option>Available</option>
              <option>On job</option>
              <option>Available soon</option>
              <option>Off today</option>
              <option>Holiday</option>
              <option>Sick</option>
              <option>Vehicle issue</option>
              <option>Do not use</option>
            </select>

            <input name="available_from" placeholder="Available from e.g. 15:30">
            <input name="skills" placeholder="Skills e.g. Lockout, uPVC">
            <button type="submit">Save Technician</button>

            <textarea name="notes" placeholder="Notes"></textarea>
          </form>
        </div>

        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Phone</th>
              <th>Base</th>
              <th>Current</th>
              <th>Status</th>
              <th>Available From</th>
              <th>Skills</th>
              <th>Notes</th>
              <th>Last Updated</th>
              <th>Edit</th>
            </tr>
          </thead>

          <tbody>
            ${rows || `<tr><td colspan="10">No technicians added yet</td></tr>`}
          </tbody>
        </table>
      </body>
      </html>
    `);
  } catch (error) {
    console.error("Technicians page error:", error);
    res.status(500).send("Technicians page error. Check Render logs.");
  }
});

// Edit technician page
app.get("/technicians/edit", async (req, res) => {
  try {
    const id = req.query.id;

    const result = await pool.query(`
      SELECT *
      FROM technicians
      WHERE id = $1
    `, [id]);

    const tech = result.rows[0];

    if (!tech) {
      return res.status(404).send("Technician not found");
    }

    const statuses = [
      "Available",
      "On job",
      "Available soon",
      "Off today",
      "Holiday",
      "Sick",
      "Vehicle issue",
      "Do not use"
    ];

    const statusOptions = statuses.map(status => {
      const selected = status === tech.status ? "selected" : "";
      return `<option ${selected}>${status}</option>`;
    }).join("");

    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Edit Technician</title>
        <style>
          ${sharedStyles()}

          .panel {
            max-width: 900px;
          }

          form.edit {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 15px;
          }

          textarea {
            grid-column: span 2;
            min-height: 100px;
          }

          .danger {
            background: #dc2626;
          }
        </style>
      </head>

      <body>
        <a href="/technicians">← Back to Technicians</a>

        <h1>Edit Technician</h1>

        <div class="panel">
          <form class="edit" method="POST" action="/technicians/save">
            <input type="hidden" name="id" value="${tech.id}">

            <input name="name" value="${escapeHtml(tech.name)}" placeholder="Name" required>
            <input name="phone" value="${escapeHtml(tech.phone)}" placeholder="Phone">
            <input name="base_postcode" value="${escapeHtml(tech.base_postcode)}" placeholder="Base postcode">
            <input name="current_postcode" value="${escapeHtml(tech.current_postcode)}" placeholder="Current postcode">

            <select name="status">
              ${statusOptions}
            </select>

            <input name="available_from" value="${escapeHtml(tech.available_from)}" placeholder="Available from">
            <input name="skills" value="${escapeHtml(tech.skills)}" placeholder="Skills">
            <button type="submit">Save Changes</button>

            <textarea name="notes" placeholder="Notes">${escapeHtml(tech.notes)}</textarea>
          </form>

          <form method="POST" action="/technicians/delete" style="margin-top:20px;">
            <input type="hidden" name="id" value="${tech.id}">
            <button class="danger" type="submit">Remove Technician</button>
          </form>
        </div>
      </body>
      </html>
    `);
  } catch (error) {
    console.error("Edit technician error:", error);
    res.status(500).send("Edit technician error. Check Render logs.");
  }
});

// Save technician
app.post("/technicians/save", async (req, res) => {
  try {
    const {
      id,
      name,
      phone,
      base_postcode,
      current_postcode,
      status,
      available_from,
      skills,
      notes
    } = req.body;

    if (id) {
      await pool.query(`
        UPDATE technicians
        SET
          name = $1,
          phone = $2,
          base_postcode = $3,
          current_postcode = $4,
          status = $5,
          available_from = $6,
          skills = $7,
          notes = $8,
          updated_at = NOW()
        WHERE id = $9
      `, [
        name,
        phone,
        base_postcode,
        current_postcode,
        status,
        available_from,
        skills,
        notes,
        id
      ]);
    } else {
      await pool.query(`
        INSERT INTO technicians (
          name,
          phone,
          base_postcode,
          current_postcode,
          status,
          available_from,
          skills,
          notes,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
      `, [
        name,
        phone,
        base_postcode,
        current_postcode,
        status,
        available_from,
        skills,
        notes
      ]);
    }

    res.redirect("/technicians");
  } catch (error) {
    console.error("Save technician error:", error);
    res.status(500).send("Save technician error. Check Render logs.");
  }
});

// Soft-delete technician
app.post("/technicians/delete", async (req, res) => {
  try {
    await pool.query(`
      UPDATE technicians
      SET active = FALSE, updated_at = NOW()
      WHERE id = $1
    `, [req.body.id]);

    res.redirect("/technicians");
  } catch (error) {
    console.error("Delete technician error:", error);
    res.status(500).send("Delete technician error. Check Render logs.");
  }
});

// Yay webhook endpoint
app.post("/webhook/yay", async (req, res) => {
  try {
    const data = req.body;

    console.log("Received Yay webhook:", data);

    await pool.query(
      `
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
      `,
      [
        data.uuid,
        data.call_type || "",
        data.from || "",
        data.to || "",
        data.start || null,
        data.end || null,
        data.duration || 0,
        data.answered_by || "",
        data.answer_type || "",
        data
      ]
    );

    res.status(200).send("OK");
  } catch (error) {
    console.error("Webhook error:", error);
    res.status(500).send("Webhook error");
  }
});

// Debug page
app.get("/debug", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT *
      FROM calls
      ORDER BY received_at DESC
      LIMIT 50
    `);

    res.json(result.rows);
  } catch (error) {
    console.error("Debug error:", error);
    res.status(500).send("Debug error. Check Render logs.");
  }
});

initDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Keys247 app running on port ${PORT}`);
    });
  })
  .catch(error => {
    console.error("Database failed to start:", error);
    process.exit(1);
  });
