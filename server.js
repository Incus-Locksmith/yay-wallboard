const express = require("express");
const { Pool } = require("pg");
const fetch = require("node-fetch");
const PDFDocument = require("pdfkit");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

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

const companies = {
  locksmiths: {
    name: "24H Locksmiths Ltd",
    displayName: "24H LOCKSMITHS",
    logo: "logo-locksmiths.png",
    address1: "158 Uxbridge Road",
    address2: "London",
    postcode: "W13 8SB",
    tel: "020 3870 3732",
    sortCode: "04-29-09",
    account: "54913012",
    reg: "14972013",
    vat: "463918561",
    footer: "158 Uxbridge Road, London, England, W13 8SB"
  },
  online: {
    name: "24H Online Services Ltd",
    displayName: "24H ONLINE SERVICES",
    logo: "logo-online.png",
    address1: "128 City Road",
    address2: "London",
    postcode: "EC1V 2NX",
    tel: "020 3870 3732",
    sortCode: "04-29-09",
    account: "65479521",
    reg: "15885567",
    vat: "485300691",
    footer: "128 City Road, London, EC1V 2NX"
  }
};

function isPaymentAllowedForCompany(companyKey, paymentMethod) {
  if (companyKey === "locksmiths") {
    return paymentMethod === "Bank transfer" || paymentMethod === "Cash";
  }

  if (companyKey === "online") {
    return paymentMethod === "Card" || paymentMethod === "Cash";
  }

  return false;
}

function paymentRuleMessage(companyKey) {
  if (companyKey === "locksmiths") {
    return "24H Locksmiths Ltd can only use Bank transfer or Cash.";
  }

  if (companyKey === "online") {
    return "24H Online Services Ltd can only use Card or Cash.";
  }

  return "Invalid company selected.";
}

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

  await pool.query(`ALTER TABLE calls ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();`);

  await pool.query(`
    DELETE FROM calls a
    USING calls b
    WHERE a.id > b.id
    AND a.uuid = b.uuid
    AND a.uuid IS NOT NULL;
  `);

  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS calls_uuid_unique ON calls (uuid);`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS technicians (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT,
      base_postcode TEXT,
      current_postcode TEXT,
      status TEXT DEFAULT 'Available',
      priority TEXT DEFAULT 'Normal',
      available_from TEXT,
      skills TEXT,
      notes TEXT,
      active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
  `);

  await pool.query(`ALTER TABLE technicians ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'Normal';`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS invoices (
      id SERIAL PRIMARY KEY,
      invoice_number TEXT NOT NULL,
      company_key TEXT NOT NULL,
      payment_method TEXT NOT NULL,
      dispatcher_name TEXT,
      invoice_stage TEXT DEFAULT 'Draft only',
      customer_name TEXT,
      customer_address TEXT,
      customer_postcode TEXT,
      site_same_as_invoice BOOLEAN DEFAULT TRUE,
      site_address TEXT,
      site_postcode TEXT,
      customer_email TEXT,
      invoice_date TEXT,
      locksmith_name TEXT,
      paid_status TEXT,
      line_items JSONB,
      subtotal NUMERIC(10,2),
      vat_amount NUMERIC(10,2),
      total NUMERIC(10,2),
      notes TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
  `);

  await pool.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS dispatcher_name TEXT;`);
  await pool.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS invoice_stage TEXT DEFAULT 'Draft only';`);
  await pool.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS site_same_as_invoice BOOLEAN DEFAULT TRUE;`);
  await pool.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS site_address TEXT;`);
  await pool.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS site_postcode TEXT;`);
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

function pdfText(value) {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\u00D0/g, "")
    .replace(/\uFFFD/g, "")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function money(value) {
  return `£${Number(value || 0).toFixed(2)}`;
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

function priorityClass(priority) {
  const value = (priority || "").toLowerCase();

  if (value.includes("high")) return "priority-high";
  if (value.includes("push")) return "priority-push";
  if (value.includes("do not")) return "priority-low";

  return "priority-normal";
}

function priorityRank(priority) {
  const value = (priority || "").toLowerCase();

  if (value.includes("high")) return 1;
  if (value.includes("push")) return 2;
  if (value.includes("do not")) return 9;

  return 3;
}

function invoiceStageClass(stage) {
  const value = (stage || "").toLowerCase();

  if (value.includes("manager")) return "stage-approval";
  if (value.includes("emailed") && value.includes("photos")) return "stage-emailed-photos";
  if (value.includes("emailed")) return "stage-emailed";
  if (value.includes("approved")) return "stage-approved";
  if (value.includes("cancelled")) return "stage-cancelled";

  return "stage-draft";
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

  if (current) return { postcode: current, source: "Current" };
  if (base) return { postcode: base, source: "Base" };

  return { postcode: "", source: "Unknown" };
}

function isFullUkPostcode(postcode) {
  const value = (postcode || "").trim().toUpperCase();
  return /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i.test(value);
}

function postcodePrecision(postcode) {
  const value = (postcode || "").trim().toUpperCase();
  if (!value) return "Unknown";
  if (isFullUkPostcode(value)) return "Exact";
  return "Approx";
}

function normalisePostcode(postcode) {
  return (postcode || "").trim().toUpperCase().replace(/\s+/g, " ");
}

async function lookupPostcodeLocation(postcode) {
  const clean = normalisePostcode(postcode);

  if (!clean) {
    return { ok: false, latitude: null, longitude: null, precision: "Unknown", error: "No postcode" };
  }

  try {
    if (isFullUkPostcode(clean)) {
      const response = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(clean)}`);
      const json = await response.json();

      if (json.status === 200 && json.result) {
        return {
          ok: true,
          latitude: json.result.latitude,
          longitude: json.result.longitude,
          precision: "Exact",
          error: null
        };
      }
    }

    const outcode = clean.split(" ")[0];
    const outcodeResponse = await fetch(`https://api.postcodes.io/outcodes/${encodeURIComponent(outcode)}`);
    const outcodeJson = await outcodeResponse.json();

    if (outcodeJson.status === 200 && outcodeJson.result) {
      return {
        ok: true,
        latitude: outcodeJson.result.latitude,
        longitude: outcodeJson.result.longitude,
        precision: "Approx",
        error: null
      };
    }

    return { ok: false, latitude: null, longitude: null, precision: "Unknown", error: "Postcode not found" };
  } catch (error) {
    console.error("Postcode lookup error:", error);
    return { ok: false, latitude: null, longitude: null, precision: "Unknown", error: "Lookup failed" };
  }
}

function distanceMiles(lat1, lon1, lat2, lon2) {
  if ([lat1, lon1, lat2, lon2].some(v => v === null || v === undefined)) return null;

  const earthRadiusMiles = 3958.8;
  const toRadians = degrees => degrees * Math.PI / 180;

  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) ** 2;

  return earthRadiusMiles * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function formatDistance(distance) {
  if (distance === null || distance === undefined || Number.isNaN(distance)) return "—";
  return `${distance.toFixed(1)} miles`;
}

function dispatcherOptions(selectedName = "") {
  const names = Object.values(agents).sort((a, b) => a.localeCompare(b));

  return [
    `<option value="">Dispatcher / Created by</option>`,
    ...names.map(name => {
      const selected = name === selectedName ? "selected" : "";
      return `<option ${selected}>${escapeHtml(name)}</option>`;
    })
  ].join("");
}

function invoiceStageOptions(selectedStage = "Draft only") {
  const stages = [
    "Draft only",
    "Awaiting manager approval",
    "Approved",
    "Emailed to client",
    "Emailed to client with photos",
    "Cancelled / do not send"
  ];

  return stages.map(stage => {
    const selected = stage === selectedStage ? "selected" : "";
    return `<option ${selected}>${escapeHtml(stage)}</option>`;
  }).join("");
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

    .available { background: #16a34a; color: white; }
    .soon { background: #f59e0b; color: black; }
    .onjob { background: #2563eb; color: white; }
    .off { background: #6b7280; color: white; }
    .bad { background: #dc2626; color: white; }
    .neutral, .inactive { background: #374151; color: #d1d5db; }
    .engaged { background: #dc2626; color: white; }

    .priority-high { background: #dc2626; color: white; }
    .priority-push { background: #f59e0b; color: black; }
    .priority-normal { background: #374151; color: #d1d5db; }
    .priority-low { background: #6b7280; color: white; }

    .stage-draft { background: #374151; color: #d1d5db; }
    .stage-approval { background: #f59e0b; color: black; }
    .stage-approved { background: #2563eb; color: white; }
    .stage-emailed { background: #16a34a; color: white; }
    .stage-emailed-photos { background: #22c55e; color: black; }
    .stage-cancelled { background: #dc2626; color: white; }

    .muted { color: #9ca3af; }
    .warning-text { color: #fbbf24; font-weight: bold; }
    .distance { font-size: 22px; font-weight: bold; }

    .grid-2 {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 15px;
    }

    .grid-3 {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 15px;
    }

    .grid-4 {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 15px;
    }

    .stage-form {
      display: flex;
      gap: 8px;
      align-items: center;
    }

    .stage-form select {
      font-size: 13px;
      padding: 8px;
      min-width: 210px;
    }

    .stage-form button {
      font-size: 13px;
      padding: 8px 12px;
    }

    .checkbox-row {
      display: flex;
      align-items: center;
      gap: 10px;
      margin: 16px 0;
      color: #d1d5db;
      font-size: 16px;
    }

    .checkbox-row input {
      width: 18px;
      height: 18px;
    }

    .help {
      color: #9ca3af;
      font-size: 14px;
      margin-top: 8px;
    }
  `;
}

function nav() {
  return `
    <div class="nav">
      <a href="/">Call Wallboard</a>
      <a href="/technicians">Technicians</a>
      <a href="/dispatch">Dispatch</a>
      <a href="/invoices">Invoices</a>
      <a href="/invoices/new">New Invoice</a>
    </div>
  `;
}

// Call wallboard
app.get("/", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT *
      FROM calls
      WHERE start_time >= NOW() - INTERVAL '24 hours'
      ORDER BY start_time DESC
    `);

    const latestResult = await pool.query(`SELECT MAX(received_at) AS last_received FROM calls`);
    const recentCalls = result.rows;

    const answeredCalls = recentCalls.filter(call =>
      call.answered_by && agents[call.answered_by]
    );

    const missedCalls = recentCalls.filter(call =>
      !call.answered_by
    );

    const reportableCalls = [
      ...answeredCalls,
      ...missedCalls
    ];

    const missedRate = reportableCalls.length
      ? Math.round((missedCalls.length / reportableCalls.length) * 100)
      : 0;

    let missedRateClass = "good";
    if (reportableCalls.length === 0) missedRateClass = "neutral";
    else if (missedRate >= 20) missedRateClass = "bad";
    else if (missedRate >= 10) missedRateClass = "soon";

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
      const name = agents[ext];

      if (!name) return;

      agentStats[ext].answered += 1;
      agentStats[ext].totalDuration += Number(call.duration_seconds || 0);

      const callTime = call.start_time || call.received_at;

      if (!agentStats[ext].lastCallTime || new Date(callTime) > new Date(agentStats[ext].lastCallTime)) {
        agentStats[ext].lastCallTime = callTime;
      }

      if (!call.end_time) agentStats[ext].status = "Engaged";
    });

    const agentRows = Object.values(agentStats)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(agent => {
        const avgDuration = agent.answered ? Math.round(agent.totalDuration / agent.answered) : 0;
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

          .card.good { border-color: #16a34a; }
          .card.soon { border-color: #f59e0b; }
          .card.bad { border-color: #dc2626; }
          .card.neutral { border-color: #374151; }

          .label {
            color: #9ca3af;
            font-size: 16px;
          }

          .value {
            font-size: 42px;
            font-weight: bold;
            margin-top: 10px;
          }

          .value.good { color: #22c55e; }
          .value.soon { color: #fbbf24; }
          .value.bad { color: #ef4444; }
          .value.neutral { color: white; }
        </style>
      </head>
      <body>
        ${nav()}

        <h1>Keys247 Call Wallboard (Incus)</h1>
        <div class="subtitle">Rolling last 24 hours · Auto-refreshes every 5 seconds</div>
        <div class="updated">${lastUpdatedText} · ${pageUpdatedText}</div>

        <div class="cards">
          <div class="card">
            <div class="label">Total Calls</div>
            <div class="value">${reportableCalls.length}</div>
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
          <tbody>${agentRows}</tbody>
        </table>
      </body>
      </html>
    `);
  } catch (error) {
    console.error("Wallboard error:", error);
    res.status(500).send("Wallboard error. Check Render logs.");
  }
});

// Invoice list
app.get("/invoices", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT *
      FROM invoices
      ORDER BY created_at DESC
      LIMIT 100
    `);

    const rows = result.rows.map(invoice => {
      const company = companies[invoice.company_key] || companies.online;
      const stage = invoice.invoice_stage || "Draft only";
      const stageClass = invoiceStageClass(stage);
      const sitePostcode = invoice.site_same_as_invoice
        ? invoice.customer_postcode
        : invoice.site_postcode;

      return `
        <tr>
          <td>${escapeHtml(invoice.invoice_number)}</td>
          <td>${escapeHtml(invoice.dispatcher_name)}</td>
          <td>
            <div style="margin-bottom:8px;">
              <span class="pill ${stageClass}">${escapeHtml(stage)}</span>
            </div>

            <form class="stage-form" method="POST" action="/invoices/stage">
              <input type="hidden" name="id" value="${invoice.id}">
              <select name="invoice_stage">
                ${invoiceStageOptions(stage)}
              </select>
              <button type="submit">Save</button>
            </form>
          </td>
          <td>${escapeHtml(invoice.customer_name)}</td>
          <td>${escapeHtml(sitePostcode)}</td>
          <td>${escapeHtml(company.name)}</td>
          <td>${escapeHtml(invoice.payment_method)}</td>
          <td>${escapeHtml(invoice.invoice_date)}</td>
          <td>${money(invoice.total)}</td>
          <td>
            <a href="/invoices/${invoice.id}/pdf" target="_blank">Download PDF</a>
          </td>
        </tr>
      `;
    }).join("");

    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Invoices</title>
        <style>${sharedStyles()}</style>
      </head>
      <body>
        ${nav()}
        <h1>Invoices</h1>
        <div class="subtitle">Recent invoices · Site postcode shown for operational use</div>

        <div class="panel">
          <a href="/invoices/new">Create New Invoice</a>
        </div>

        <table>
          <thead>
            <tr>
              <th>Invoice / Job No.</th>
              <th>Dispatcher</th>
              <th>Stage</th>
              <th>Customer</th>
              <th>Site Postcode</th>
              <th>Company</th>
              <th>Payment</th>
              <th>Date</th>
              <th>Total</th>
              <th>PDF</th>
            </tr>
          </thead>
          <tbody>${rows || `<tr><td colspan="10">No invoices yet</td></tr>`}</tbody>
        </table>
      </body>
      </html>
    `);
  } catch (error) {
    console.error("Invoices list error:", error);
    res.status(500).send("Invoices list error. Check Render logs.");
  }
});

// Update invoice stage only
app.post("/invoices/stage", async (req, res) => {
  try {
    const id = req.body.id;
    const invoiceStage = req.body.invoice_stage || "Draft only";

    await pool.query(`
      UPDATE invoices
      SET invoice_stage = $1,
          updated_at = NOW()
      WHERE id = $2
    `, [invoiceStage, id]);

    res.redirect("/invoices");
  } catch (error) {
    console.error("Update invoice stage error:", error);
    res.status(500).send("Update invoice stage error. Check Render logs.");
  }
});

// New invoice form
app.get("/invoices/new", (req, res) => {
  const today = new Date().toLocaleDateString("en-GB", {
    timeZone: "Europe/London",
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });

  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>New Invoice</title>
      <style>
        ${sharedStyles()}

        textarea {
          min-height: 90px;
        }

        .line-grid {
          display: grid;
          grid-template-columns: 1fr 90px 140px;
          gap: 12px;
          margin-bottom: 12px;
        }

        .notice {
          background: #1f2937;
          border-left: 5px solid #f59e0b;
          border-radius: 10px;
          padding: 18px;
          margin-bottom: 25px;
          color: #d1d5db;
        }

        .rule-box {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 15px;
          margin-top: 15px;
        }

        .rule {
          background: #111827;
          border-radius: 10px;
          padding: 15px;
          border: 1px solid #374151;
        }

        #site-fields {
          margin-top: 18px;
        }
      </style>

      <script>
        function toggleSiteAddress() {
          const checkbox = document.getElementById("site_same_as_invoice");
          const siteFields = document.getElementById("site-fields");

          if (checkbox.checked) {
            siteFields.style.display = "none";
          } else {
            siteFields.style.display = "block";
          }
        }

        window.addEventListener("DOMContentLoaded", toggleSiteAddress);
      </script>
    </head>
    <body>
      ${nav()}

      <h1>New Invoice</h1>
      <div class="subtitle">Choose the company first, then the correct payment method</div>

      <div class="notice">
        <strong>Invoice rules:</strong>

        <div class="rule-box">
          <div class="rule">
            <strong>24H Locksmiths Ltd</strong><br>
            Bank transfer or Cash only
          </div>

          <div class="rule">
            <strong>24H Online Services Ltd</strong><br>
            Card or Cash only
          </div>
        </div>
      </div>

      <form method="POST" action="/invoices/create">
        <div class="panel">
          <h2>Invoice Details</h2>

          <div class="grid-3">
            <select name="company_key" required>
              <option value="locksmiths">24H Locksmiths Ltd</option>
              <option value="online">24H Online Services Ltd</option>
            </select>

            <select name="payment_method" required>
              <option>Bank transfer</option>
              <option>Cash</option>
              <option>Card</option>
            </select>

            <input name="invoice_number" placeholder="Invoice / Job No." required>
          </div>

          <br>

          <div class="grid-3">
            <input name="invoice_date" value="${today}" placeholder="Date">

            <select name="dispatcher_name" required>
              ${dispatcherOptions()}
            </select>

            <select name="invoice_stage" required>
              ${invoiceStageOptions("Draft only")}
            </select>
          </div>

          <br>

          <div class="grid-3">
            <input name="locksmith_name" placeholder="Locksmith name">

            <select name="paid_status">
              <option>Unpaid</option>
              <option>Paid with thanks</option>
            </select>

            <input name="customer_email" placeholder="Customer email">
          </div>
        </div>

        <div class="panel">
          <h2>Customer / Invoice Address</h2>

          <div class="grid-2">
            <input name="customer_name" placeholder="Customer name" required>
            <input name="customer_postcode" placeholder="Invoice postcode">
          </div>

          <br>

          <textarea name="customer_address" placeholder="Invoice address"></textarea>

          <label class="checkbox-row">
            <input
              id="site_same_as_invoice"
              name="site_same_as_invoice"
              type="checkbox"
              value="yes"
              checked
              onchange="toggleSiteAddress()"
            >
            Site address same as invoice address
          </label>

          <div id="site-fields">
            <h2>Site Address</h2>
            <div class="help">Use this only if the job location is different from the invoice address.</div>
            <br>

            <div class="grid-2">
              <input name="site_postcode" placeholder="Site postcode">
              <input name="site_address_line" placeholder="Quick site address line">
            </div>

            <br>

            <textarea name="site_address" placeholder="Full site address"></textarea>
          </div>
        </div>

        <div class="panel">
          <h2>Line Items</h2>

          <div class="line-grid">
            <input name="line1_description" value="Locksmith call out">
            <input name="line1_qty" value="1">
            <input name="line1_unit_price" value="40.00">
          </div>

          <div class="line-grid">
            <input name="line2_description" value="Labour to open security lock">
            <input name="line2_qty" value="1">
            <input name="line2_unit_price" value="60.00">
          </div>

          <div class="line-grid">
            <input name="line3_description" placeholder="Optional extra line">
            <input name="line3_qty" placeholder="Qty">
            <input name="line3_unit_price" placeholder="Unit price">
          </div>
        </div>

        <div class="panel">
          <h2>Notes</h2>
          <textarea name="notes" placeholder="Invoice notes">6 months warranty on parts fitted</textarea>
        </div>

        <button type="submit">Generate PDF Invoice</button>
      </form>
    </body>
    </html>
  `);
});

// Create invoice
app.post("/invoices/create", async (req, res) => {
  try {
    const companyKey = req.body.company_key;
    const paymentMethod = req.body.payment_method;

    if (!companies[companyKey]) {
      return res.status(400).send("Invalid company selected.");
    }

    if (!isPaymentAllowedForCompany(companyKey, paymentMethod)) {
      return res.status(400).send(`
        <html>
          <body style="font-family: Arial; padding: 40px;">
            <h1>Payment method not allowed</h1>
            <p>${escapeHtml(paymentRuleMessage(companyKey))}</p>
            <p>You selected: <strong>${escapeHtml(paymentMethod)}</strong></p>
            <p><a href="/invoices/new">Go back and create invoice again</a></p>
          </body>
        </html>
      `);
    }

    const siteSameAsInvoice = req.body.site_same_as_invoice === "yes";

    const finalSiteAddress = siteSameAsInvoice
      ? req.body.customer_address
      : (req.body.site_address || req.body.site_address_line || "");

    const finalSitePostcode = siteSameAsInvoice
      ? req.body.customer_postcode
      : req.body.site_postcode;

    const lineItems = [
      {
        description: req.body.line1_description,
        qty: Number(req.body.line1_qty || 0),
        unitPrice: Number(req.body.line1_unit_price || 0)
      },
      {
        description: req.body.line2_description,
        qty: Number(req.body.line2_qty || 0),
        unitPrice: Number(req.body.line2_unit_price || 0)
      },
      {
        description: req.body.line3_description,
        qty: Number(req.body.line3_qty || 0),
        unitPrice: Number(req.body.line3_unit_price || 0)
      }
    ].filter(item => item.description && item.qty > 0);

    const subtotal = lineItems.reduce((sum, item) => sum + item.qty * item.unitPrice, 0);
    const vatAmount = subtotal * 0.2;
    const total = subtotal + vatAmount;

    const result = await pool.query(`
      INSERT INTO invoices (
        invoice_number,
        company_key,
        payment_method,
        dispatcher_name,
        invoice_stage,
        customer_name,
        customer_address,
        customer_postcode,
        site_same_as_invoice,
        site_address,
        site_postcode,
        customer_email,
        invoice_date,
        locksmith_name,
        paid_status,
        line_items,
        subtotal,
        vat_amount,
        total,
        notes,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, NOW())
      RETURNING id
    `, [
      req.body.invoice_number,
      companyKey,
      paymentMethod,
      req.body.dispatcher_name,
      req.body.invoice_stage || "Draft only",
      req.body.customer_name,
      req.body.customer_address,
      req.body.customer_postcode,
      siteSameAsInvoice,
      finalSiteAddress,
      finalSitePostcode,
      req.body.customer_email,
      req.body.invoice_date,
      req.body.locksmith_name,
      req.body.paid_status,
      JSON.stringify(lineItems),
      subtotal.toFixed(2),
      vatAmount.toFixed(2),
      total.toFixed(2),
      req.body.notes
    ]);

    res.redirect(`/invoices/${result.rows[0].id}/pdf`);
  } catch (error) {
    console.error("Create invoice error:", error);
    res.status(500).send("Create invoice error. Check Render logs.");
  }
});

// PDF invoice
app.get("/invoices/:id/pdf", async (req, res) => {
  try {
    const result = await pool.query(`SELECT * FROM invoices WHERE id = $1`, [req.params.id]);
    const invoice = result.rows[0];

    if (!invoice) return res.status(404).send("Invoice not found");

    const company = companies[invoice.company_key] || companies.online;
    const lineItems = Array.isArray(invoice.line_items)
      ? invoice.line_items
      : JSON.parse(invoice.line_items || "[]");

    const siteSameAsInvoice = invoice.site_same_as_invoice !== false;
    const siteAddress = siteSameAsInvoice ? invoice.customer_address : invoice.site_address;
    const sitePostcode = siteSameAsInvoice ? invoice.customer_postcode : invoice.site_postcode;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `inline; filename="invoice-${invoice.invoice_number}.pdf"`
    );

    const doc = new PDFDocument({ size: "A4", margin: 50 });
    doc.pipe(res);

    const logoPath = path.join(__dirname, company.logo);

    try {
      doc.image(logoPath, 50, 35, { width: 160 });
    } catch (error) {
      console.error("Logo load error:", error);
      doc.fontSize(20).font("Helvetica-Bold").text(company.displayName, 50, 48);
    }

    doc.fontSize(9).font("Helvetica")
      .text(company.address1, 50, 102)
      .text(company.address2, 50, 115)
      .text(company.postcode, 50, 128)
      .text(`Tel: ${company.tel}`, 50, 141);

    doc.fontSize(20).font("Helvetica-Bold").text("INVOICE", 390, 55);
    doc.fontSize(10).font("Helvetica")
      .text(`Invoice No: ${pdfText(invoice.invoice_number)}`, 390, 90)
      .text(`Date: ${pdfText(invoice.invoice_date)}`, 390, 105)
      .text(`Locksmith: ${pdfText(invoice.locksmith_name)}`, 390, 120)
      .text(`Created by: ${pdfText(invoice.dispatcher_name)}`, 390, 135);

    doc.moveTo(50, 165).lineTo(545, 165).stroke();

    doc.roundedRect(50, 185, 240, 110, 8).stroke();
    doc.fontSize(11).font("Helvetica-Bold").text("Invoice Address", 65, 197);
    doc.font("Helvetica").fontSize(9.5)
      .text(pdfText(invoice.customer_name), 65, 217, { width: 190 })
      .text(pdfText(invoice.customer_address), 65, 233, { width: 190, height: 40 })
      .text(`Postcode: ${pdfText(invoice.customer_postcode)}`, 65, 276, { width: 190 });

    doc.roundedRect(305, 185, 240, 110, 8).stroke();
    doc.fontSize(11).font("Helvetica-Bold").text("Site Address", 320, 197);
    doc.font("Helvetica").fontSize(9.5)
      .text(siteSameAsInvoice ? "Same as invoice address" : pdfText(siteAddress), 320, 217, {
        width: 190,
        height: 56
      })
      .text(`Postcode: ${pdfText(sitePostcode)}`, 320, 276, { width: 190 });

    doc.roundedRect(50, 310, 495, 52, 8).stroke();
    doc.fontSize(11).font("Helvetica-Bold").text("Invoice Details", 65, 322);
    doc.font("Helvetica").fontSize(10)
      .text(`Payment: ${pdfText(invoice.payment_method)}`, 65, 342)
      .text(`Status: ${pdfText(invoice.paid_status)}`, 210, 342)
      .text(`Dispatcher: ${pdfText(invoice.dispatcher_name)}`, 375, 342);

    const tableTop = 390;

    doc.font("Helvetica-Bold").fontSize(10);
    doc.text("Qty", 55, tableTop);
    doc.text("Description", 105, tableTop);
    doc.text("Unit Price", 400, tableTop);
    doc.text("Total", 480, tableTop);

    doc.moveTo(50, tableTop + 16).lineTo(545, tableTop + 16).stroke();

    let y = tableTop + 32;

    doc.font("Helvetica").fontSize(10);

    lineItems.forEach(item => {
      const description = pdfText(item.description);
      const lineTotal = Number(item.qty || 0) * Number(item.unitPrice || 0);

      doc.text(String(item.qty), 60, y);
      doc.text(description, 105, y, { width: 255 });
      doc.text(money(item.unitPrice), 400, y);
      doc.text(money(lineTotal), 480, y);

      const extraHeight = description.length > 55 ? 14 : 0;
      y += 22 + extraHeight;
    });

    doc.moveTo(50, y + 4).lineTo(545, y + 4).stroke();

    const totalsY = y + 18;

    doc.font("Helvetica").fontSize(10);
    doc.text("Subtotal", 380, totalsY);
    doc.text(money(invoice.subtotal), 480, totalsY);
    doc.text("VAT", 380, totalsY + 18);
    doc.text(money(invoice.vat_amount), 480, totalsY + 18);

    doc.font("Helvetica-Bold");
    doc.text("TOTAL", 380, totalsY + 38);
    doc.text(money(invoice.total), 480, totalsY + 38);

    const paymentBoxY = totalsY + 78;

    doc.roundedRect(50, paymentBoxY, 260, 105, 8).stroke();
    doc.font("Helvetica-Bold").fontSize(10).text("Payment Details", 70, paymentBoxY + 15);

    if (invoice.payment_method === "Bank transfer") {
      doc.font("Helvetica").fontSize(10).text("Please pay via BACS transfer to:", 70, paymentBoxY + 34);
      doc.font("Helvetica-Bold").text(company.name, 70, paymentBoxY + 55, { width: 220 });
      doc.font("Helvetica")
        .text(`Sort code: ${company.sortCode}`, 70, paymentBoxY + 73)
        .text(`Account: ${company.account}`, 70, paymentBoxY + 88);
    } else if (invoice.payment_method === "Card") {
      doc.font("Helvetica").fontSize(10)
        .text("Payment method: Card", 70, paymentBoxY + 34)
        .text("Please use the card payment link provided separately.", 70, paymentBoxY + 55, {
          width: 210
        });
    } else {
      doc.font("Helvetica").fontSize(10)
        .text("Payment method: Cash", 70, paymentBoxY + 34)
        .text("Cash payment to be collected/confirmed by the office.", 70, paymentBoxY + 55, {
          width: 210
        });
    }

    doc.roundedRect(330, paymentBoxY, 215, 105, 8).stroke();
    doc.font("Helvetica-Bold").fontSize(10).text("Notes", 350, paymentBoxY + 15);
    doc.font("Helvetica").fontSize(9.5).text(pdfText(invoice.notes || "6 months warranty on parts fitted"), 350, paymentBoxY + 35, {
      width: 175,
      height: 55
    });

    doc.font("Helvetica-Bold").fontSize(10).text(company.name, 50, 718, {
      align: "center",
      width: 495
    });

    doc.font("Helvetica").fontSize(9)
      .text(company.footer, 50, 733, { align: "center", width: 495 })
      .text(`REG: ${company.reg}    VAT NO: ${company.vat}`, 50, 748, {
        align: "center",
        width: 495
      });

    doc.moveTo(50, 768).lineTo(545, 768).stroke();

    doc.fontSize(9).font("Helvetica-Oblique").text("Thank you for using our services", 50, 780, {
      align: "center",
      width: 495
    });

    doc.end();
  } catch (error) {
    console.error("PDF invoice error:", error);
    res.status(500).send("PDF invoice error. Check Render logs.");
  }
});

// Dispatch page
app.get("/dispatch", async (req, res) => {
  try {
    const customerPostcode = (req.query.postcode || "").trim().toUpperCase();
    const jobType = (req.query.job_type || "").trim();

    let customerLocation = null;
    let customerLocationMessage = "";

    if (customerPostcode) {
      customerLocation = await lookupPostcodeLocation(customerPostcode);
      customerLocationMessage = customerLocation.ok
        ? `Customer postcode located using ${customerLocation.precision.toLowerCase()} postcode data.`
        : `Could not locate customer postcode: ${customerPostcode}`;
    }

    const result = await pool.query(`
      SELECT *
      FROM technicians
      WHERE active = TRUE
      ORDER BY updated_at DESC
    `);

    const candidates = result.rows.filter(tech => isUsableForDispatch(tech.status));

    const candidatesWithDistance = await Promise.all(
      candidates.map(async tech => {
        const location = getBestLocation(tech);
        const techLocation = await lookupPostcodeLocation(location.postcode);

        let distance = null;

        if (customerLocation && customerLocation.ok && techLocation && techLocation.ok) {
          distance = distanceMiles(
            customerLocation.latitude,
            customerLocation.longitude,
            techLocation.latitude,
            techLocation.longitude
          );
        }

        return { tech, location, techLocation, distance };
      })
    );

    candidatesWithDistance.sort((a, b) => {
      const statusDiff = dispatchRank(a.tech.status) - dispatchRank(b.tech.status);
      if (statusDiff !== 0) return statusDiff;

      const priorityDiff = priorityRank(a.tech.priority) - priorityRank(b.tech.priority);
      if (priorityDiff !== 0) return priorityDiff;

      if (a.distance !== null && b.distance === null) return -1;
      if (a.distance === null && b.distance !== null) return 1;
      if (a.distance !== null && b.distance !== null) return a.distance - b.distance;

      return new Date(b.tech.updated_at) - new Date(a.tech.updated_at);
    });

    const rows = candidatesWithDistance.map((item, index) => {
      const tech = item.tech;
      const statusClass = technicianStatusClass(tech.status);
      const priority = tech.priority || "Normal";
      const priorityBadgeClass = priorityClass(priority);
      const precision = item.techLocation.ok ? item.techLocation.precision : postcodePrecision(item.location.postcode);

      const precisionText = precision === "Approx"
        ? `<span class="warning-text">Approx</span>`
        : escapeHtml(precision);

      const distanceText = customerPostcode ? formatDistance(item.distance) : "Enter postcode";

      return `
        <tr>
          <td>${index + 1}</td>
          <td><strong>${escapeHtml(tech.name)}</strong><br><span class="muted">${escapeHtml(tech.phone)}</span></td>
          <td><span class="pill ${statusClass}">${escapeHtml(tech.status)}</span></td>
          <td><span class="pill ${priorityBadgeClass}">${escapeHtml(priority)}</span></td>
          <td>${escapeHtml(tech.available_from || "Now / check")}</td>
          <td>
            ${escapeHtml(item.location.postcode || "No postcode")}
            <br>
            <span class="muted">${escapeHtml(item.location.source)} · ${precisionText}</span>
          </td>
          <td><span class="distance">${distanceText}</span><br><span class="muted">Straight-line estimate</span></td>
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

          .notice.good { border-left-color: #16a34a; }
          .notice.bad { border-left-color: #dc2626; }
        </style>
      </head>
      <body>
        ${nav()}

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
            ? `<div class="notice ${customerLocation && customerLocation.ok ? "good" : "bad"}">
                <strong>${escapeHtml(customerPostcode)}</strong> — ${escapeHtml(customerLocationMessage)}
                <br>
                Distances are straight-line estimates, not driving times. Partial postcodes are approximate.
              </div>`
            : `<div class="notice">
                Enter a customer postcode to sort available locksmiths by approximate distance.
                Priority technicians are ranked higher when availability is equal.
              </div>`
        }

        <table>
          <thead>
            <tr>
              <th>Rank</th>
              <th>Technician</th>
              <th>Status</th>
              <th>Priority</th>
              <th>Available From</th>
              <th>Location</th>
              <th>Distance</th>
              <th>Skills</th>
              <th>Notes</th>
              <th>Last Updated</th>
            </tr>
          </thead>
          <tbody>${rows || `<tr><td colspan="10">No available technicians found</td></tr>`}</tbody>
        </table>
      </body>
      </html>
    `);
  } catch (error) {
    console.error("Dispatch page error:", error);
    res.status(500).send("Dispatch page error. Check Render logs.");
  }
});

// Technicians
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
        CASE
          WHEN LOWER(priority) LIKE '%high%' THEN 1
          WHEN LOWER(priority) LIKE '%push%' THEN 2
          WHEN LOWER(priority) LIKE '%do not%' THEN 9
          ELSE 3
        END,
        name ASC
    `);

    const rows = result.rows.map(tech => {
      const statusClass = technicianStatusClass(tech.status);
      const priority = tech.priority || "Normal";
      const priorityBadgeClass = priorityClass(priority);

      return `
        <tr>
          <td>${escapeHtml(tech.name)}</td>
          <td>${escapeHtml(tech.phone)}</td>
          <td>${escapeHtml(tech.base_postcode)}</td>
          <td>${escapeHtml(tech.current_postcode)}</td>
          <td><span class="pill ${statusClass}">${escapeHtml(tech.status)}</span></td>
          <td><span class="pill ${priorityBadgeClass}">${escapeHtml(priority)}</span></td>
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
        ${nav()}

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

            <select name="priority">
              <option>Normal</option>
              <option>Push</option>
              <option>High priority</option>
              <option>Do not prioritise</option>
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
              <th>Priority</th>
              <th>Available From</th>
              <th>Skills</th>
              <th>Notes</th>
              <th>Last Updated</th>
              <th>Edit</th>
            </tr>
          </thead>
          <tbody>${rows || `<tr><td colspan="11">No technicians added yet</td></tr>`}</tbody>
        </table>
      </body>
      </html>
    `);
  } catch (error) {
    console.error("Technicians page error:", error);
    res.status(500).send("Technicians page error. Check Render logs.");
  }
});

app.get("/technicians/edit", async (req, res) => {
  try {
    const id = req.query.id;

    const result = await pool.query(`SELECT * FROM technicians WHERE id = $1`, [id]);
    const tech = result.rows[0];

    if (!tech) return res.status(404).send("Technician not found");

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

    const priorities = [
      "Normal",
      "Push",
      "High priority",
      "Do not prioritise"
    ];

    const statusOptions = statuses.map(status => {
      const selected = status === tech.status ? "selected" : "";
      return `<option ${selected}>${status}</option>`;
    }).join("");

    const priorityOptions = priorities.map(priority => {
      const selected = priority === (tech.priority || "Normal") ? "selected" : "";
      return `<option ${selected}>${priority}</option>`;
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
            <select name="status">${statusOptions}</select>
            <select name="priority">${priorityOptions}</select>
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

app.post("/technicians/save", async (req, res) => {
  try {
    const {
      id,
      name,
      phone,
      base_postcode,
      current_postcode,
      status,
      priority,
      available_from,
      skills,
      notes
    } = req.body;

    if (id) {
      await pool.query(`
        UPDATE technicians
        SET name = $1,
            phone = $2,
            base_postcode = $3,
            current_postcode = $4,
            status = $5,
            priority = $6,
            available_from = $7,
            skills = $8,
            notes = $9,
            updated_at = NOW()
        WHERE id = $10
      `, [
        name,
        phone,
        base_postcode,
        current_postcode,
        status,
        priority || "Normal",
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
          priority,
          available_from,
          skills,
          notes,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
      `, [
        name,
        phone,
        base_postcode,
        current_postcode,
        status,
        priority || "Normal",
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

// Yay webhook
app.post("/webhook/yay", async (req, res) => {
  try {
    const data = req.body;

    console.log("Received Yay webhook:", data);

    await pool.query(
      `
      INSERT INTO calls (
        uuid, call_type, from_number, to_number, start_time, end_time,
        duration_seconds, answered_by, answer_type, raw_json, updated_at
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
