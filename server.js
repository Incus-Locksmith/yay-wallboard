const express = require("express");
const { Pool } = require("pg");
const fetch = require("node-fetch");
const PDFDocument = require("pdfkit");
const path = require("path");
const crypto = require("crypto");

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

const agentNames = Object.values(agents).sort((a, b) => a.localeCompare(b));

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

function authSecret() {
  return process.env.DASHBOARD_PASSWORD || "change-me-now";
}

function parseCookies(req) {
  const header = req.headers.cookie || "";
  const cookies = {};

  header.split(";").forEach(part => {
    const index = part.indexOf("=");
    if (index === -1) return;

    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();

    cookies[key] = decodeURIComponent(value);
  });

  return cookies;
}

function signValue(value) {
  return crypto
    .createHmac("sha256", authSecret())
    .update(value)
    .digest("hex");
}

function makeSessionCookie(agentName) {
  const payload = Buffer.from(
    JSON.stringify({
      agentName,
      createdAt: Date.now()
    })
  ).toString("base64url");

  const signature = signValue(payload);
  return `${payload}.${signature}`;
}

function readSession(req) {
  const cookies = parseCookies(req);
  const raw = cookies.dashboard_session;

  if (!raw || !raw.includes(".")) return null;

  const [payload, signature] = raw.split(".");
  const expected = signValue(payload);

  try {
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
      return null;
    }
  } catch (error) {
    return null;
  }

  try {
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));

    if (!decoded.agentName || !agentNames.includes(decoded.agentName)) return null;

    const maxAgeMs = 1000 * 60 * 60 * 24 * 7;
    if (!decoded.createdAt || Date.now() - decoded.createdAt > maxAgeMs) return null;

    return decoded;
  } catch (error) {
    return null;
  }
}

function setSessionCookie(res, agentName) {
  const cookieValue = makeSessionCookie(agentName);

  res.setHeader(
    "Set-Cookie",
    `dashboard_session=${encodeURIComponent(cookieValue)}; HttpOnly; SameSite=Lax; Secure; Path=/; Max-Age=${60 * 60 * 24 * 7}`
  );
}

function clearSessionCookie(res) {
  res.setHeader(
    "Set-Cookie",
    "dashboard_session=; HttpOnly; SameSite=Lax; Secure; Path=/; Max-Age=0"
  );
}

function requireLogin(req, res, next) {
  const openPaths = ["/login", "/logout", "/webhook/yay"];

  if (openPaths.includes(req.path)) return next();

  const session = readSession(req);

  if (!session) {
    return res.redirect(`/login?next=${encodeURIComponent(req.originalUrl)}`);
  }

  req.currentAgent = session.agentName;
  next();
}

app.use(requireLogin);

function currentAgentName(req) {
  return req.currentAgent || "";
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
    minute: "2-digit"
  });
}

function formatDateTimeWithSeconds(date) {
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
    return {
      ok: false,
      latitude: null,
      longitude: null,
      precision: "Unknown",
      error: "No postcode"
    };
  }

  try {
    if (isFullUkPostcode(clean)) {
      const response = await fetch(
        `https://api.postcodes.io/postcodes/${encodeURIComponent(clean)}`
      );

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

    const outcodeResponse = await fetch(
      `https://api.postcodes.io/outcodes/${encodeURIComponent(outcode)}`
    );

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

    return {
      ok: false,
      latitude: null,
      longitude: null,
      precision: "Unknown",
      error: "Postcode not found"
    };
  } catch (error) {
    console.error("Postcode lookup error:", error);

    return {
      ok: false,
      latitude: null,
      longitude: null,
      precision: "Unknown",
      error: "Lookup failed"
    };
  }
}

function distanceMiles(lat1, lon1, lat2, lon2) {
  if ([lat1, lon1, lat2, lon2].some(v => v === null || v === undefined)) {
    return null;
  }

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
  if (distance === null || distance === undefined || Number.isNaN(distance)) {
    return "—";
  }

  return `${distance.toFixed(1)} miles`;
}

function sharedStyles() {
  return `
    body {
      font-family: Arial, sans-serif;
      background: #111827;
      color: white;
      padding: 32px;
    }

    a {
      color: #93c5fd;
      text-decoration: none;
      margin-right: 14px;
      font-weight: bold;
    }

    h1 {
      font-size: 40px;
      margin-bottom: 5px;
    }

    h2 {
      margin-top: 0;
    }

    .subtitle {
      color: #9ca3af;
      margin-bottom: 24px;
    }

    .nav {
      margin-bottom: 22px;
    }

    .login-bar {
      background: #1f2937;
      border: 1px solid #374151;
      border-radius: 12px;
      padding: 12px 16px;
      margin-bottom: 20px;
      color: #d1d5db;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .panel {
      background: #1f2937;
      border-radius: 14px;
      padding: 22px;
      margin-bottom: 28px;
    }

    input, select, textarea, button {
      font-size: 15px;
      padding: 10px;
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
      padding: 12px;
      border-bottom: 1px solid #374151;
      font-size: 14px;
      vertical-align: middle;
    }

    th {
      color: #9ca3af;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }

    .invoice-table th,
    .invoice-table td {
      padding: 11px 10px;
      font-size: 13px;
    }

    .invoice-main {
      font-weight: bold;
      font-size: 14px;
    }

    .invoice-sub {
      color: #9ca3af;
      font-size: 12px;
      margin-top: 4px;
      line-height: 1.35;
    }

    .compact-stage {
      min-width: 245px;
    }

    .compact-stage-top {
      margin-bottom: 7px;
    }

    .compact-stage-form {
      display: flex;
      gap: 6px;
      align-items: center;
    }

    .compact-stage-form select {
      font-size: 12px;
      padding: 7px;
      width: 180px;
    }

    .compact-stage-form button {
      font-size: 12px;
      padding: 7px 10px;
    }

    .actions {
      display: flex;
      flex-direction: column;
      gap: 8px;
      align-items: flex-start;
    }

    .actions a {
      margin-right: 0;
      font-size: 13px;
    }

    .delete-link {
      color: #fca5a5;
    }

    .delete-button {
      background: #dc2626;
    }

    .cancel-button {
      background: #374151;
    }

    .pill, .status {
      padding: 6px 10px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: bold;
      white-space: nowrap;
      display: inline-block;
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

    .muted {
      color: #9ca3af;
    }

    .audit {
      color: #9ca3af;
      font-size: 12px;
      line-height: 1.35;
      margin-top: 6px;
    }

    .warning-text {
      color: #fbbf24;
      font-weight: bold;
    }

    .distance {
      font-size: 22px;
      font-weight: bold;
    }

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

    .search-form {
      display: grid;
      grid-template-columns: 2fr 1fr;
      gap: 15px;
      align-items: center;
    }
  `;
}

function nav(req) {
  const name = currentAgentName(req);

  return `
    <div class="login-bar">
      <div>Logged in as <strong>${escapeHtml(name)}</strong></div>
      <div><a href="/logout">Logout</a></div>
    </div>

    <div class="nav">
      <a href="/">Call Wallboard</a>
      <a href="/technicians">Technicians</a>
      <a href="/dispatch">Dispatch</a>
      <a href="/invoices">Invoices</a>
      <a href="/invoices/historic">Historic Invoices</a>
      <a href="/invoices/new">New Invoice</a>
    </div>
  `;
}

function invoiceRows(invoices) {
  return invoices.map(invoice => {
    const company = companies[invoice.company_key] || companies.online;
    const stage = invoice.invoice_stage || "Draft only";
    const stageClass = invoiceStageClass(stage);

    const sitePostcode = invoice.site_same_as_invoice
      ? invoice.customer_postcode
      : invoice.site_postcode;

    const updatedText = invoice.stage_updated_by
      ? `Updated by ${escapeHtml(invoice.stage_updated_by)} · ${formatDateTime(invoice.stage_updated_at)}`
      : "";

    return `
      <tr>
        <td>
          <div class="invoice-main">${escapeHtml(invoice.invoice_number)}</div>
          <div class="invoice-sub">By ${escapeHtml(invoice.dispatcher_name || "Unknown")}</div>
        </td>

        <td>
          <div class="invoice-main">${escapeHtml(invoice.customer_name || "—")}</div>
          <div class="invoice-sub">Site: ${escapeHtml(sitePostcode || "—")}</div>
        </td>

        <td>
          <div class="invoice-main">${escapeHtml(company.name)}</div>
          <div class="invoice-sub">${escapeHtml(invoice.payment_method || "—")}</div>
        </td>

        <td>
          <div class="invoice-main">${escapeHtml(invoice.invoice_date || "—")}</div>
          <div class="invoice-sub">${money(invoice.total)}</div>
        </td>

        <td class="compact-stage">
          <div class="compact-stage-top">
            <span class="pill ${stageClass}">${escapeHtml(stage)}</span>
          </div>

          <form class="compact-stage-form" method="POST" action="/invoices/stage">
            <input type="hidden" name="id" value="${invoice.id}">
            <select name="invoice_stage">
              ${invoiceStageOptions(stage)}
            </select>
            <button type="submit">Save</button>
          </form>

          ${updatedText ? `<div class="audit">${updatedText}</div>` : ""}
        </td>

        <td>
          <div class="actions">
            <a href="/invoices/${invoice.id}/pdf" target="_blank">PDF</a>
            <a class="delete-link" href="/invoices/${invoice.id}/delete">Delete</a>
          </div>
        </td>
      </tr>
    `;
  }).join("");
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
      updated_by TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
  `);

  await pool.query(`ALTER TABLE technicians ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'Normal';`);
  await pool.query(`ALTER TABLE technicians ADD COLUMN IF NOT EXISTS updated_by TEXT;`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS invoices (
      id SERIAL PRIMARY KEY,
      invoice_number TEXT NOT NULL,
      company_key TEXT NOT NULL,
      payment_method TEXT NOT NULL,
      dispatcher_name TEXT,
      invoice_stage TEXT DEFAULT 'Draft only',
      stage_updated_by TEXT,
      stage_updated_at TIMESTAMP,
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
  await pool.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS stage_updated_by TEXT;`);
  await pool.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS stage_updated_at TIMESTAMP;`);
  await pool.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS site_same_as_invoice BOOLEAN DEFAULT TRUE;`);
  await pool.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS site_address TEXT;`);
  await pool.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS site_postcode TEXT;`);
}

app.get("/login", (req, res) => {
  const next = req.query.next || "/";
  const error = req.query.error === "1";

  const options = agentNames.map(name => {
    return `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`;
  }).join("");

  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Dashboard Login</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          background: #111827;
          color: white;
          padding: 40px;
        }

        .login-box {
          max-width: 440px;
          margin: 80px auto;
          background: #1f2937;
          border-radius: 16px;
          padding: 30px;
          border: 1px solid #374151;
        }

        h1 {
          margin-top: 0;
          font-size: 36px;
        }

        .subtitle {
          color: #9ca3af;
          margin-bottom: 25px;
        }

        select, input, button {
          width: 100%;
          box-sizing: border-box;
          font-size: 17px;
          padding: 14px;
          border-radius: 8px;
          border: 1px solid #374151;
          margin-bottom: 14px;
        }

        select, input {
          background: #111827;
          color: white;
        }

        button {
          background: #2563eb;
          color: white;
          border: none;
          font-weight: bold;
          cursor: pointer;
        }

        .error {
          background: #dc2626;
          color: white;
          border-radius: 8px;
          padding: 12px;
          margin-bottom: 14px;
        }
      </style>
    </head>
    <body>
      <div class="login-box">
        <h1>Dashboard Login</h1>
        <div class="subtitle">Choose your name and enter the shared password.</div>

        ${error ? `<div class="error">Wrong agent or password. Try again.</div>` : ""}

        <form method="POST" action="/login">
          <input type="hidden" name="next" value="${escapeHtml(next)}">

          <select name="agent_name" required>
            <option value="">Choose your name</option>
            ${options}
          </select>

          <input name="password" type="password" placeholder="Password" required>

          <button type="submit">Log in</button>
        </form>
      </div>
    </body>
    </html>
  `);
});

app.post("/login", (req, res) => {
  const agentName = req.body.agent_name || "";
  const password = req.body.password || "";
  const next = req.body.next || "/";

  if (!agentNames.includes(agentName) || password !== authSecret()) {
    return res.redirect(`/login?error=1&next=${encodeURIComponent(next)}`);
  }

  setSessionCookie(res, agentName);
  res.redirect(next);
});

app.get("/logout", (req, res) => {
  clearSessionCookie(res);
  res.redirect("/login");
});

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

    const missedCalls = recentCalls.filter(call => !call.answered_by);

    const reportableCalls = [...answeredCalls, ...missedCalls];

    const missedRate = reportableCalls.length
      ? Math.round((missedCalls.length / reportableCalls.length) * 100)
      : 0;

    let missedRateClass = "good";

    if (reportableCalls.length === 0) missedRateClass = "neutral";
    else if (missedRate >= 20) missedRateClass = "bad";
    else if (missedRate >= 10) missedRateClass = "soon";

    const lastReceived = latestResult.rows[0].last_received;

    const lastUpdatedText = lastReceived
      ? `Last call received: ${formatDateTimeWithSeconds(lastReceived)}`
      : "No calls received yet";

    const pageUpdatedText = `Page refreshed: ${formatDateTimeWithSeconds(new Date())}`;

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
        <title>Keys247 Call Wallboard</title>
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
        ${nav(req)}

        <h1>Keys247 Call Wallboard</h1>
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

app.get("/invoices", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT *
      FROM invoices
      WHERE LOWER(COALESCE(invoice_stage, 'Draft only')) NOT LIKE '%emailed%'
      ORDER BY created_at DESC
      LIMIT 100
    `);

    const rows = invoiceRows(result.rows);

    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Invoices</title>
        <style>${sharedStyles()}</style>
      </head>
      <body>
        ${nav(req)}

        <h1>Invoices</h1>
        <div class="subtitle">Active invoices only. Emailed invoices move into Historic Invoices.</div>

        <div class="panel">
          <a href="/invoices/new">Create New Invoice</a>
          <a href="/invoices/historic">Historic Invoices</a>
        </div>

        <table class="invoice-table">
          <thead>
            <tr>
              <th>Invoice</th>
              <th>Customer / Site</th>
              <th>Company / Payment</th>
              <th>Date / Total</th>
              <th>Stage</th>
              <th>Actions</th>
            </tr>
          </thead>

          <tbody>
            ${rows || `<tr><td colspan="6">No active invoices waiting to be sent</td></tr>`}
          </tbody>
        </table>
      </body>
      </html>
    `);
  } catch (error) {
    console.error("Invoices list error:", error);
    res.status(500).send("Invoices list error. Check Render logs.");
  }
});

app.get("/invoices/historic", async (req, res) => {
  try {
    const postcode = (req.query.postcode || "").trim();

    let result;

    if (postcode) {
      result = await pool.query(`
        SELECT *
        FROM invoices
        WHERE LOWER(COALESCE(invoice_stage, '')) LIKE '%emailed%'
        AND (
          LOWER(COALESCE(customer_postcode, '')) LIKE LOWER($1)
          OR LOWER(COALESCE(site_postcode, '')) LIKE LOWER($1)
        )
        ORDER BY created_at DESC
        LIMIT 100
      `, [`%${postcode}%`]);
    } else {
      result = await pool.query(`
        SELECT *
        FROM invoices
        WHERE LOWER(COALESCE(invoice_stage, '')) LIKE '%emailed%'
        ORDER BY created_at DESC
        LIMIT 100
      `);
    }

    const rows = invoiceRows(result.rows);

    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Historic Invoices</title>
        <style>${sharedStyles()}</style>
      </head>
      <body>
        ${nav(req)}

        <h1>Historic Invoices</h1>
        <div class="subtitle">Invoices marked as emailed are filed here. Search by invoice or site postcode.</div>

        <div class="panel">
          <form class="search-form" method="GET" action="/invoices/historic">
            <input name="postcode" value="${escapeHtml(postcode)}" placeholder="Search historic invoices by postcode">
            <button type="submit">Search</button>
          </form>

          <br>

          <a href="/invoices/historic">Clear search</a>
          <a href="/invoices">Back to active invoices</a>
        </div>

        <table class="invoice-table">
          <thead>
            <tr>
              <th>Invoice</th>
              <th>Customer / Site</th>
              <th>Company / Payment</th>
              <th>Date / Total</th>
              <th>Stage</th>
              <th>Actions</th>
            </tr>
          </thead>

          <tbody>
            ${rows || `<tr><td colspan="6">No historic invoices found</td></tr>`}
          </tbody>
        </table>
      </body>
      </html>
    `);
  } catch (error) {
    console.error("Historic invoices error:", error);
    res.status(500).send("Historic invoices error. Check Render logs.");
  }
});

app.post("/invoices/stage", async (req, res) => {
  try {
    const id = req.body.id;
    const invoiceStage = req.body.invoice_stage || "Draft only";
    const redirectTo = req.get("referer") || "/invoices";
    const agentName = currentAgentName(req);

    await pool.query(`
      UPDATE invoices
      SET invoice_stage = $1,
          stage_updated_by = $2,
          stage_updated_at = NOW(),
          updated_at = NOW()
      WHERE id = $3
    `, [invoiceStage, agentName, id]);

    res.redirect(redirectTo);
  } catch (error) {
    console.error("Update invoice stage error:", error);
    res.status(500).send("Update invoice stage error. Check Render logs.");
  }
});

app.get("/invoices/:id/delete", async (req, res) => {
  try {
    const result = await pool.query(`SELECT * FROM invoices WHERE id = $1`, [req.params.id]);
    const invoice = result.rows[0];

    if (!invoice) return res.status(404).send("Invoice not found");

    const company = companies[invoice.company_key] || companies.online;

    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Delete Invoice</title>
        <style>
          ${sharedStyles()}

          .danger-panel {
            max-width: 680px;
            background: #1f2937;
            border: 1px solid #dc2626;
            border-radius: 16px;
            padding: 28px;
          }

          .button-row {
            display: flex;
            gap: 12px;
            margin-top: 22px;
          }

          .button-row form {
            margin: 0;
          }
        </style>
      </head>
      <body>
        ${nav(req)}

        <div class="danger-panel">
          <h1>Delete invoice?</h1>
          <div class="subtitle">This permanently removes the invoice from the dashboard.</div>

          <p><strong>Invoice:</strong> ${escapeHtml(invoice.invoice_number)}</p>
          <p><strong>Customer:</strong> ${escapeHtml(invoice.customer_name || "—")}</p>
          <p><strong>Company:</strong> ${escapeHtml(company.name)}</p>
          <p><strong>Total:</strong> ${money(invoice.total)}</p>

          <div class="button-row">
            <form method="POST" action="/invoices/${invoice.id}/delete">
              <button class="delete-button" type="submit">Yes, delete invoice</button>
            </form>

            <form method="GET" action="/invoices">
              <button class="cancel-button" type="submit">Cancel</button>
            </form>
          </div>
        </div>
      </body>
      </html>
    `);
  } catch (error) {
    console.error("Delete invoice confirmation error:", error);
    res.status(500).send("Delete invoice confirmation error. Check Render logs.");
  }
});

app.post("/invoices/:id/delete", async (req, res) => {
  try {
    await pool.query(`DELETE FROM invoices WHERE id = $1`, [req.params.id]);
    res.redirect("/invoices");
  } catch (error) {
    console.error("Delete invoice error:", error);
    res.status(500).send("Delete invoice error. Check Render logs.");
  }
});

app.get("/invoices/new", (req, res) => {
  const today = new Date().toLocaleDateString("en-GB", {
    timeZone: "Europe/London",
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });

  const agentName = currentAgentName(req);

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
      ${nav(req)}

      <h1>New Invoice</h1>
      <div class="subtitle">Created by ${escapeHtml(agentName)}</div>

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

            <input value="Created by ${escapeHtml(agentName)}" disabled>

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

app.post("/invoices/create", async (req, res) => {
  try {
    const companyKey = req.body.company_key;
    const paymentMethod = req.body.payment_method;
    const dispatcherName = currentAgentName(req);

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

    const subtotal = lineItems.reduce((sum, item) => {
      return sum + item.qty * item.unitPrice;
    }, 0);

    const vatAmount = subtotal * 0.2;
    const total = subtotal + vatAmount;

    const result = await pool.query(`
      INSERT INTO invoices (
        invoice_number,
        company_key,
        payment_method,
        dispatcher_name,
        invoice_stage,
        stage_updated_by,
        stage_updated_at,
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
      VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, NOW())
      RETURNING id
    `, [
      req.body.invoice_number,
      companyKey,
      paymentMethod,
      dispatcherName,
      req.body.invoice_stage || "Draft only",
      dispatcherName,
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

app.get("/invoices/:id/pdf", async (req, res) => {
  try {
    const result = await pool.query(`SELECT * FROM invoices WHERE id = $1`, [
      req.params.id
    ]);

    const invoice = result.rows[0];

    if (!invoice) return res.status(404).send("Invoice not found");

    const company = companies[invoice.company_key] || companies.online;

    const lineItems = Array.isArray(invoice.line_items)
      ? invoice.line_items
      : JSON.parse(invoice.line_items || "[]");

    const siteSameAsInvoice = invoice.site_same_as_invoice !== false;

    const siteAddress = siteSameAsInvoice
      ? invoice.customer_address
      : invoice.site_address;

    const sitePostcode = siteSameAsInvoice
      ? invoice.customer_postcode
      : invoice.site_postcode;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `inline; filename="invoice-${invoice.invoice_number}.pdf"`
    );

    const doc = new PDFDocument({
      size: "A4",
      margin: 50
    });

    doc.pipe(res);

    const logoPath = path.join(__dirname, company.logo);

    try {
      doc.image(logoPath, 50, 22, { width: 160 });
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
      .text(`Locksmith: ${pdfText(invoice.locksmith_name)}`, 390, 120);

    doc.moveTo(50, 165).lineTo(545, 165).stroke();

    doc.roundedRect(50, 185, 240, 110, 8).stroke();
    doc.fontSize(11).font("Helvetica-Bold").text("Invoice Address", 65, 197);

    doc.font("Helvetica").fontSize(9.5)
      .text(pdfText(invoice.customer_name), 65, 217, { width: 190 })
      .text(pdfText(invoice.customer_address), 65, 233, {
        width: 190,
        height: 40
      })
      .text(`Postcode: ${pdfText(invoice.customer_postcode)}`, 65, 276, {
        width: 190
      });

    doc.roundedRect(305, 185, 240, 110, 8).stroke();
    doc.fontSize(11).font("Helvetica-Bold").text("Site Address", 320, 197);

    doc.font("Helvetica").fontSize(9.5)
      .text(siteSameAsInvoice ? "Same as invoice address" : pdfText(siteAddress), 320, 217, {
        width: 190,
        height: 56
      })
      .text(`Postcode: ${pdfText(sitePostcode)}`, 320, 276, {
        width: 190
      });

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
      doc.font("Helvetica").fontSize(10)
        .text("Please pay via BACS transfer to:", 70, paymentBoxY + 34);

      doc.font("Helvetica-Bold")
        .text(company.name, 70, paymentBoxY + 55, { width: 220 });

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

    doc.font("Helvetica").fontSize(9.5).text(
      pdfText(invoice.notes || "6 months warranty on parts fitted"),
      350,
      paymentBoxY + 35,
      {
        width: 175,
        height: 55
      }
    );

    doc.font("Helvetica-Bold").fontSize(10).text(company.name, 50, 718, {
      align: "center",
      width: 495
    });

    doc.font("Helvetica").fontSize(9)
      .text(company.footer, 50, 733, {
        align: "center",
        width: 495
      })
      .text(`REG: ${company.reg}    VAT NO: ${company.vat}`, 50, 748, {
        align: "center",
        width: 495
      });

    doc.moveTo(50, 768).lineTo(545, 768).stroke();

    doc.fontSize(9).font("Helvetica-Oblique").text(
      "Thank you for using our services",
      50,
      780,
      {
        align: "center",
        width: 495
      }
    );

    doc.end();
  } catch (error) {
    console.error("PDF invoice error:", error);
    res.status(500).send("PDF invoice error. Check Render logs.");
  }
});
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

        return {
          tech,
          location,
          techLocation,
          distance
        };
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

    const mapTechnicians = candidatesWithDistance
      .filter(item => item.techLocation && item.techLocation.ok)
      .map((item, index) => {
        const tech = item.tech;
        const status = tech.status || "";
        const priority = tech.priority || "Normal";

        return {
          rank: index + 1,
          name: tech.name || "",
          phone: tech.phone || "",
          status,
          priority,
          availableFrom: tech.available_from || "Now / check",
          locationPostcode: item.location.postcode || "",
          locationSource: item.location.source || "",
          skills: tech.skills || "",
          notes: tech.notes || "",
          distance: item.distance === null ? null : Number(item.distance.toFixed(1)),
          latitude: item.techLocation.latitude,
          longitude: item.techLocation.longitude
        };
      });

    const mapData = {
      customer: customerLocation && customerLocation.ok
        ? {
            postcode: customerPostcode,
            latitude: customerLocation.latitude,
            longitude: customerLocation.longitude,
            precision: customerLocation.precision
          }
        : null,
      technicians: mapTechnicians
    };

    const mapDataJson = JSON.stringify(mapData).replace(/</g, "\\u003c");

    const rows = candidatesWithDistance.map((item, index) => {
      const tech = item.tech;
      const statusClass = technicianStatusClass(tech.status);
      const priority = tech.priority || "Normal";
      const priorityBadgeClass = priorityClass(priority);

      const precision = item.techLocation.ok
        ? item.techLocation.precision
        : postcodePrecision(item.location.postcode);

      const precisionText = precision === "Approx"
        ? `<span class="warning-text">Approx</span>`
        : escapeHtml(precision);

      const distanceText = customerPostcode
        ? formatDistance(item.distance)
        : "Enter postcode";

      return `
        <tr>
          <td>${index + 1}</td>
          <td>
            <strong>${escapeHtml(tech.name)}</strong><br>
            <span class="muted">${escapeHtml(tech.phone)}</span>
          </td>
          <td><span class="pill ${statusClass}">${escapeHtml(tech.status)}</span></td>
          <td><span class="pill ${priorityBadgeClass}">${escapeHtml(priority)}</span></td>
          <td>${escapeHtml(tech.available_from || "Now / check")}</td>
          <td>
            ${escapeHtml(item.location.postcode || "No postcode")}
            <br>
            <span class="muted">${escapeHtml(item.location.source)} · ${precisionText}</span>
          </td>
          <td>
            <span class="distance">${distanceText}</span><br>
            <span class="muted">Straight-line estimate</span>
          </td>
          <td>${escapeHtml(tech.skills)}</td>
          <td>${escapeHtml(tech.notes)}</td>
          <td>${formatDateTimeWithSeconds(tech.updated_at)}</td>
        </tr>
      `;
    }).join("");

    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Dispatch Postcode Map</title>

        <link
          rel="stylesheet"
          href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
          integrity="sha256-p4NxAoJBhIINfQ5d1G1eoYkZrjZ9gHh7uKybqvDMcfM="
          crossorigin=""
        />

        <script
          src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
          integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo="
          crossorigin="">
        </script>

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

          .notice.good {
            border-left-color: #16a34a;
          }

          .notice.bad {
            border-left-color: #dc2626;
          }

          .map-layout {
            display: grid;
            grid-template-columns: 2fr 1fr;
            gap: 20px;
            margin-bottom: 28px;
          }

          #dispatch-map {
            height: 680px;
            width: 100%;
            border-radius: 16px;
            overflow: hidden;
            border: 1px solid #374151;
            background: #111827;
          }

          .map-side-panel {
            background: #1f2937;
            border-radius: 16px;
            border: 1px solid #374151;
            padding: 20px;
          }

          .legend-item {
            display: flex;
            align-items: center;
            gap: 10px;
            margin-bottom: 12px;
            color: #d1d5db;
            font-size: 14px;
          }

          .legend-dot {
            width: 14px;
            height: 14px;
            border-radius: 50%;
            display: inline-block;
          }

          .dot-customer { background: #a855f7; }
          .dot-available { background: #16a34a; }
          .dot-soon { background: #f59e0b; }
          .dot-onjob { background: #2563eb; }
          .dot-other { background: #6b7280; }
          .dot-district { background: #fbbf24; }

          .map-note {
            margin-top: 18px;
            color: #9ca3af;
            line-height: 1.5;
            font-size: 14px;
          }

          .leaflet-popup-content {
            color: #111827;
            font-size: 14px;
            line-height: 1.45;
          }

          .leaflet-popup-content strong {
            font-size: 15px;
          }

          .marker-label {
            background: white;
            border: 2px solid #111827;
            border-radius: 999px;
            width: 28px;
            height: 28px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #111827;
            font-weight: bold;
            font-size: 13px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.35);
          }

          .marker-customer {
            background: #a855f7;
            color: white;
          }

          .marker-available {
            background: #16a34a;
            color: white;
          }

          .marker-soon {
            background: #f59e0b;
            color: black;
          }

          .marker-onjob {
            background: #2563eb;
            color: white;
          }

          .marker-other {
            background: #6b7280;
            color: white;
          }

          .postcode-label {
            background: rgba(17, 24, 39, 0.88);
            color: #f9fafb;
            border: 1px solid rgba(251, 191, 36, 0.75);
            border-radius: 999px;
            padding: 3px 7px;
            font-size: 12px;
            font-weight: bold;
            box-shadow: 0 2px 8px rgba(0,0,0,0.35);
          }

          .loading-map {
            color: #9ca3af;
            font-size: 14px;
            margin-top: 12px;
          }

          @media (max-width: 1100px) {
            .map-layout {
              grid-template-columns: 1fr;
            }

            #dispatch-map {
              height: 560px;
            }
          }
        </style>
      </head>

      <body>
        ${nav(req)}

        <h1>Dispatch Postcode Map</h1>
        <div class="subtitle">London postcode district boundaries · Customer and technician positions</div>

        <div class="panel">
          <form class="search" method="GET" action="/dispatch">
            <input name="postcode" value="${escapeHtml(customerPostcode)}" placeholder="Customer postcode e.g. W13 8SB">
            <input name="job_type" value="${escapeHtml(jobType)}" placeholder="Job type e.g. lockout, uPVC">
            <button type="submit">Find Locksmith</button>
          </form>
        </div>

        ${
          customerPostcode
            ? `<div class="notice ${customerLocation && customerLocation.ok ? "good" : "bad"}">
                <strong>${escapeHtml(customerPostcode)}</strong> — ${escapeHtml(customerLocationMessage)}
                <br>
                Yellow boundary highlight shows the customer's postcode district where available.
              </div>`
            : `<div class="notice">
                Enter a customer postcode to highlight the London postcode district and plot nearby locksmiths.
              </div>`
        }

        <div class="map-layout">
          <div>
            <div id="dispatch-map"></div>
            <div class="loading-map" id="map-load-status">Loading postcode district boundaries...</div>
          </div>

          <div class="map-side-panel">
            <h2>Map Key</h2>

            <div class="legend-item">
              <span class="legend-dot dot-district"></span>
              Customer postcode district
            </div>

            <div class="legend-item">
              <span class="legend-dot dot-customer"></span>
              Customer postcode
            </div>

            <div class="legend-item">
              <span class="legend-dot dot-available"></span>
              Available technician
            </div>

            <div class="legend-item">
              <span class="legend-dot dot-soon"></span>
              Available soon
            </div>

            <div class="legend-item">
              <span class="legend-dot dot-onjob"></span>
              On job
            </div>

            <div class="legend-item">
              <span class="legend-dot dot-other"></span>
              Other usable status
            </div>

            <div class="map-note">
              <strong>Important:</strong><br>
              This is a postcode district view.
              <br><br>
              It shows straight-line distance, not driving time.
              <br><br>
              Technician position uses current postcode first, then base postcode.
            </div>
          </div>
        </div>

        <h2>Ranked Technician List</h2>

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

          <tbody>
            ${rows || `<tr><td colspan="10">No available technicians found</td></tr>`}
          </tbody>
        </table>

        <script>
          const mapData = ${mapDataJson};

          const postcodeAreaFiles = [
            "E",
            "EC",
            "N",
            "NW",
            "SE",
            "SW",
            "W",
            "WC"
          ];

          const postcodeGeoJsonBase =
            "https://raw.githubusercontent.com/missinglink/uk-postcode-polygons/master/geojson/";

          const map = L.map("dispatch-map", {
            scrollWheelZoom: true,
            preferCanvas: true
          });

          L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            maxZoom: 19,
            attribution: "&copy; OpenStreetMap contributors"
          }).addTo(map);

          const defaultLondonCentre = [51.5072, -0.1276];
          map.setView(defaultLondonCentre, 10);

          const bounds = [];
          const districtLayer = L.layerGroup().addTo(map);
          const labelLayer = L.layerGroup().addTo(map);
          const markerLayer = L.layerGroup().addTo(map);

          function safeText(value) {
            return String(value || "")
              .replace(/&/g, "&amp;")
              .replace(/</g, "&lt;")
              .replace(/>/g, "&gt;")
              .replace(/"/g, "&quot;")
              .replace(/'/g, "&#039;");
          }

          function postcodeDistrictFromText(value) {
            const clean = String(value || "")
              .toUpperCase()
              .replace(/[^A-Z0-9 ]/g, " ")
              .replace(/\\s+/g, " ")
              .trim();

            if (!clean) return "";

            if (clean.includes(" ")) {
              return clean.split(" ")[0];
            }

            const match = clean.match(/^([A-Z]{1,2}\\d[A-Z\\d]?)/);
            return match ? match[1] : clean;
          }

          function districtNameFromFeature(feature) {
            const props = feature.properties || {};

            const possibleValues = [
              props.name,
              props.Name,
              props.NAME,
              props.title,
              props.Title,
              props.description,
              props.Description,
              props.id,
              props.ID
            ];

            for (const value of possibleValues) {
              const text = String(value || "").toUpperCase();

              const match = text.match(/\\b(EC\\d[A-Z]?|WC\\d[A-Z]?|E\\d{1,2}[A-Z]?|N\\d{1,2}[A-Z]?|NW\\d{1,2}[A-Z]?|SE\\d{1,2}[A-Z]?|SW\\d{1,2}[A-Z]?|W\\d{1,2}[A-Z]?)\\b/);

              if (match) return match[1];
            }

            return "";
          }

          function markerClassForStatus(status) {
            const value = String(status || "").toLowerCase();

            if (value.includes("available") && !value.includes("soon")) {
              return "marker-available";
            }

            if (value.includes("soon")) {
              return "marker-soon";
            }

            if (value.includes("job")) {
              return "marker-onjob";
            }

            return "marker-other";
          }

          function makeNumberIcon(number, className) {
            return L.divIcon({
              className: "",
              html: '<div class="marker-label ' + className + '">' + number + '</div>',
              iconSize: [28, 28],
              iconAnchor: [14, 14],
              popupAnchor: [0, -14]
            });
          }

          function makePostcodeLabelIcon(label, isHighlighted) {
            return L.divIcon({
              className: "",
              html:
                '<div class="postcode-label" style="' +
                (isHighlighted ? 'background:#fbbf24;color:#111827;border-color:#111827;' : '') +
                '">' +
                safeText(label) +
                '</div>',
              iconSize: null,
              iconAnchor: [14, 10]
            });
          }

          const customerDistrict = mapData.customer
            ? postcodeDistrictFromText(mapData.customer.postcode)
            : "";

          function districtStyle(feature) {
            const district = districtNameFromFeature(feature);
            const isCustomerDistrict = district && district === customerDistrict;

            if (isCustomerDistrict) {
              return {
                color: "#fbbf24",
                weight: 4,
                opacity: 1,
                fillColor: "#fbbf24",
                fillOpacity: 0.28
              };
            }

            return {
              color: "#60a5fa",
              weight: 1.2,
              opacity: 0.65,
              fillColor: "#1d4ed8",
              fillOpacity: 0.08
            };
          }

          function addDistrictLabels(geoJsonLayer) {
            geoJsonLayer.eachLayer(function(layer) {
              if (!layer.feature) return;

              const district = districtNameFromFeature(layer.feature);
              if (!district) return;

              const isCustomerDistrict = district === customerDistrict;

              try {
                const centre = layer.getBounds().getCenter();

                L.marker(centre, {
                  icon: makePostcodeLabelIcon(district, isCustomerDistrict),
                  interactive: false
                }).addTo(labelLayer);
              } catch (error) {
                // Ignore label errors on odd geometries
              }
            });
          }

          async function loadPostcodeDistricts() {
            const status = document.getElementById("map-load-status");
            let loadedCount = 0;

            for (const area of postcodeAreaFiles) {
              try {
                const response = await fetch(postcodeGeoJsonBase + area + ".geojson");
                const geojson = await response.json();

                const geoJsonLayer = L.geoJSON(geojson, {
                  style: districtStyle,
                  onEachFeature: function(feature, layer) {
                    const district = districtNameFromFeature(feature);
                    const isCustomerDistrict = district && district === customerDistrict;

                    layer.bindPopup(
                      "<strong>Postcode district: " + safeText(district || area) + "</strong>" +
                      (isCustomerDistrict ? "<br>Customer area" : "")
                    );

                    layer.on("mouseover", function() {
                      layer.setStyle({
                        weight: isCustomerDistrict ? 5 : 3,
                        fillOpacity: isCustomerDistrict ? 0.35 : 0.16
                      });
                    });

                    layer.on("mouseout", function() {
                      geoJsonLayer.resetStyle(layer);
                    });
                  }
                });

                geoJsonLayer.addTo(districtLayer);
                addDistrictLabels(geoJsonLayer);
                loadedCount += 1;
              } catch (error) {
                console.error("Could not load postcode area", area, error);
              }
            }

            if (status) {
              status.textContent = loadedCount
                ? "Postcode district boundaries loaded."
                : "Could not load postcode district boundaries.";
            }
          }

          if (mapData.customer) {
            const customerLatLng = [
              mapData.customer.latitude,
              mapData.customer.longitude
            ];

            bounds.push(customerLatLng);

            L.marker(customerLatLng, {
              icon: makeNumberIcon("C", "marker-customer")
            })
              .addTo(markerLayer)
              .bindPopup(
                "<strong>Customer</strong><br>" +
                safeText(mapData.customer.postcode) +
                "<br>District: " + safeText(customerDistrict || "Unknown") +
                "<br>Precision: " + safeText(mapData.customer.precision)
              );
          }

          mapData.technicians.forEach(function(tech) {
            const latLng = [tech.latitude, tech.longitude];
            bounds.push(latLng);

            const distanceText = tech.distance === null
              ? "Distance unavailable"
              : tech.distance + " miles";

            const popupHtml =
              "<strong>#" + safeText(tech.rank) + " " + safeText(tech.name) + "</strong><br>" +
              safeText(tech.phone) + "<br><br>" +
              "<strong>Status:</strong> " + safeText(tech.status) + "<br>" +
              "<strong>Priority:</strong> " + safeText(tech.priority) + "<br>" +
              "<strong>Available:</strong> " + safeText(tech.availableFrom) + "<br>" +
              "<strong>Location:</strong> " + safeText(tech.locationPostcode) + " (" + safeText(tech.locationSource) + ")<br>" +
              "<strong>Distance:</strong> " + safeText(distanceText) + "<br>" +
              "<strong>Skills:</strong> " + safeText(tech.skills) + "<br>" +
              "<strong>Notes:</strong> " + safeText(tech.notes);

            L.marker(latLng, {
              icon: makeNumberIcon(tech.rank, markerClassForStatus(tech.status))
            })
              .addTo(markerLayer)
              .bindPopup(popupHtml);
          });

          if (bounds.length > 0) {
            map.fitBounds(bounds, {
              padding: [45, 45],
              maxZoom: 13
            });
          }

          loadPostcodeDistricts();
        </script>
      </body>
      </html>
    `);
  } catch (error) {
    console.error("Dispatch page error:", error);
    res.status(500).send("Dispatch page error. Check Render logs.");
  }
});

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
          <td>
            ${formatDateTimeWithSeconds(tech.updated_at)}
            <div class="audit">By ${escapeHtml(tech.updated_by || "Unknown")}</div>
          </td>
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
        ${nav(req)}

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

          <tbody>
            ${rows || `<tr><td colspan="11">No technicians added yet</td></tr>`}
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
      return `<option ${selected}>${escapeHtml(status)}</option>`;
    }).join("");

    const priorityOptions = priorities.map(priority => {
      const selected = priority === (tech.priority || "Normal") ? "selected" : "";
      return `<option ${selected}>${escapeHtml(priority)}</option>`;
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
        ${nav(req)}

        <h1>Edit Technician</h1>
        <div class="subtitle">
          Last updated by ${escapeHtml(tech.updated_by || "Unknown")} · ${formatDateTimeWithSeconds(tech.updated_at)}
        </div>

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

            <select name="priority">
              ${priorityOptions}
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

    const agentName = currentAgentName(req);

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
            updated_by = $10,
            updated_at = NOW()
        WHERE id = $11
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
        agentName,
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
          updated_by,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
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
        agentName
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
      SET active = FALSE,
          updated_by = $1,
          updated_at = NOW()
      WHERE id = $2
    `, [currentAgentName(req), req.body.id]);

    res.redirect("/technicians");
  } catch (error) {
    console.error("Delete technician error:", error);
    res.status(500).send("Delete technician error. Check Render logs.");
  }
});

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
