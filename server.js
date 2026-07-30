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
app.use(express.static(path.join(__dirname)));

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

const defaultInvoiceItems = [
  ["Locksmith call out", 40, 10],
  ["Emergency response (locksmith call out)", 55, 20],
  ["Labour to open security lock", 60, 30],
  ["Labour to force open security lock", 75, 40],
  ["Labour to replace lock", 55, 50],
  ["Supply of euro cylinder", 40, 60],
  ["Supply of night latch", 55, 70],
  ["Supply of mortice lock", 65, 80],
  ["Fresh installation labour", 150, 90],
  ["Boarding up / temporary security", 120, 100],
  ["Additional labour", 40, 110],
  ["Parking / congestion charge", 15, 120],
  ["Other", 0, 999]
];

const defaultInvoiceTemplates = [
  ["Adam Lee", "Adam Lee Property Maintenance LTD", "8 Langley Park\nLondon", "NW7 2AA", 10],
  ["CSG", "Classic Services Group", "Classic House, Genesis Business Centre, Redkiln Way\nHorsham", "RH13 5QH", 20],
  ["Buns From Home", "Buns From Home LTD", "22 Charterhouse Square\nLONDON", "EC1M 6DX", 30]
];


const defaultCampaigns = [
  ['24H DR LOCKSMITH', 'Online lead', 'Unknown', 0, 10, 'Official campaign/source list. Online, app, text, or inbound lead source.'],
  ['99 HOMES', 'Account', 'Account', 0, 20, 'Official campaign/source list. Account, partner, property, or business source.'],
  ['A HUNT & CO', 'Account', 'Account', 0, 30, 'Official campaign/source list. Account, partner, property, or business source.'],
  ['ADAM LEE', 'Account', 'Account', 0, 40, 'Official campaign/source list. Account, partner, property, or business source.'],
  ['ANDY', 'Account', 'Account', 0, 50, 'Official campaign/source list. Account, partner, property, or business source.'],
  ['ARTHUR GRACE', 'Account', 'Account', 0, 60, 'Official campaign/source list. Account, partner, property, or business source.'],
  ['BETTER HOMES COMPANY', 'Account', 'Account', 0, 70, 'Official campaign/source list. Account, partner, property, or business source.'],
  ['BLUE PLANETIC', 'Account', 'Account', 0, 80, 'Official campaign/source list. Account, partner, property, or business source.'],
  ['BONUS EVENTUS', 'Account', 'Account', 0, 90, 'Official campaign/source list. Account, partner, property, or business source.'],
  ['BUNS FROM HOME', 'Account', 'Account', 0, 100, 'Official campaign/source list. Account, partner, property, or business source.'],
  ['CIF BUILDERS', 'Account', 'Account', 0, 110, 'Official campaign/source list. Account, partner, property, or business source.'],
  ['COUNTY RENTS', 'Account', 'Account', 0, 120, 'Official campaign/source list. Account, partner, property, or business source.'],
  ['CROSSTOWN', 'Account', 'Account', 0, 130, 'Official campaign/source list. Account, partner, property, or business source.'],
  ['CSG', 'Account', 'Account', 0, 140, 'Official campaign/source list. Account, partner, property, or business source.'],
  ['DEXTERS', 'Account', 'Account', 0, 150, 'Official campaign/source list. Account, partner, property, or business source.'],
  ['ELITE', 'Account', 'Account', 0, 160, 'Official campaign/source list. Account, partner, property, or business source.'],
  ['EMAIL & WEB/ CHAT', 'Online lead', 'Unknown', 0, 170, 'Official campaign/source list. Online, app, text, or inbound lead source.'],
  ['ERG', 'Account', 'Account', 0, 180, 'Official campaign/source list. Account, partner, property, or business source.'],
  ['EYAL', 'Account', 'Account', 0, 190, 'Official campaign/source list. Account, partner, property, or business source.'],
  ['FANTASTIC', 'Account', 'Account', 0, 200, 'Official campaign/source list. Account, partner, property, or business source.'],
  ['FINE MOVE', 'Account', 'Account', 0, 210, 'Official campaign/source list. Account, partner, property, or business source.'],
  ['FLARE', 'Account', 'Account', 0, 220, 'Official campaign/source list. Account, partner, property, or business source.'],
  ['FLEX GLOBAL', 'Account', 'Account', 0, 230, 'Official campaign/source list. Account, partner, property, or business source.'],
  ['FOCUS FURNISHING', 'Account', 'Account', 0, 240, 'Official campaign/source list. Account, partner, property, or business source.'],
  ['GAYBANK', 'Account', 'Account', 0, 250, 'Official campaign/source list. Account, partner, property, or business source.'],
  ['GRD', 'Affiliate', 'Unknown', 50, 260, 'Official campaign/source list. Affiliate split 50%.'],
  ['HBS CONSTRUCT', 'Account', 'Account', 0, 270, 'Official campaign/source list. Account, partner, property, or business source.'],
  ['HESTON CLEANING', 'Account', 'Account', 0, 280, 'Official campaign/source list. Account, partner, property, or business source.'],
  ['ITCC', 'Affiliate', 'Unknown', 40, 290, 'Official campaign/source list. Affiliate split 40%.'],
  ['JB STAYS', 'Account', 'Account', 0, 300, 'Official campaign/source list. Account, partner, property, or business source.'],
  ['JHM', 'Account', 'Account', 0, 310, 'Official campaign/source list. Account, partner, property, or business source.'],
  ['JOHN LOCKSMITH', 'Locksmith partner', 'Unknown', 0, 320, 'Official campaign/source list. Locksmith partner or trade source.'],
  ['KEYS247', 'Locksmith partner', 'Unknown', 0, 330, 'Official campaign/source list. Locksmith partner or trade source.'],
  ['L24', 'Locksmith partner', 'Unknown', 0, 340, 'Official campaign/source list. Locksmith partner or trade source.'],
  ['LANDMARK', 'Account', 'Account', 0, 350, 'Official campaign/source list. Account, partner, property, or business source.'],
  ['LDN PM', 'Account', 'Account', 0, 360, 'Official campaign/source list. Account, partner, property, or business source.'],
  ['LOCKFIT', 'Locksmith partner', 'Unknown', 0, 370, 'Official campaign/source list. Locksmith partner or trade source.'],
  ['LOCKSMITH UNION', 'Locksmith partner', 'Unknown', 0, 380, 'Official campaign/source list. Locksmith partner or trade source.'],
  ['LOCKSUB', 'Locksmith partner', 'Unknown', 0, 390, 'Official campaign/source list. Locksmith partner or trade source.'],
  ['LONDON LOCKSMITH', 'Affiliate', 'Unknown', 50, 400, 'Official campaign/source list. Affiliate split 50%.'],
  ['LONDON WILDLIFE', 'Account', 'Account', 0, 410, 'Official campaign/source list. Account, partner, property, or business source.'],
  ['LTA', 'Account', 'Account', 0, 420, 'Official campaign/source list. Account, partner, property, or business source.'],
  ['MACK SERVICES', 'Account', 'Account', 0, 430, 'Official campaign/source list. Account, partner, property, or business source.'],
  ['MAGNA', 'Account', 'Account', 0, 440, 'Official campaign/source list. Account, partner, property, or business source.'],
  ['MANDIRI', 'Account', 'Account', 0, 450, 'Official campaign/source list. Account, partner, property, or business source.'],
  ['MARTIN&CO', 'Account', 'Account', 0, 460, 'Official campaign/source list. Account, partner, property, or business source.'],
  ['MINISTAY UK', 'Account', 'Account', 0, 470, 'Official campaign/source list. Account, partner, property, or business source.'],
  ['NEILSON PROJECTS', 'Account', 'Account', 0, 480, 'Official campaign/source list. Account, partner, property, or business source.'],
  ['NOAH', 'Account', 'Account', 0, 490, 'Official campaign/source list. Account, partner, property, or business source.'],
  ['OCP', 'Account', 'Account', 0, 500, 'Official campaign/source list. Account, partner, property, or business source.'],
  ['PARAMOUNT', 'Account', 'Account', 0, 510, 'Official campaign/source list. Account, partner, property, or business source.'],
  ['PEACOCK', 'Account', 'Account', 0, 520, 'Official campaign/source list. Account, partner, property, or business source.'],
  ['PIPEDRIVE', 'Online lead', 'Unknown', 0, 530, 'Official campaign/source list. Online, app, text, or inbound lead source.'],
  ['PROPERTY PARTNERS', 'Account', 'Account', 0, 540, 'Official campaign/source list. Account, partner, property, or business source.'],
  ['PROPERTY RESCUE', 'Account', 'Account', 0, 550, 'Official campaign/source list. Account, partner, property, or business source.'],
  ['RECALL', 'Online lead', 'Unknown', 0, 560, 'Official campaign/source list. Online, app, text, or inbound lead source.'],
  ['REDROCK', 'Account', 'Account', 0, 570, 'Official campaign/source list. Account, partner, property, or business source.'],
  ['ROBERT', 'Account', 'Account', 0, 580, 'Official campaign/source list. Account, partner, property, or business source.'],
  ['ROSEMOND SERVICES', 'Account', 'Account', 0, 590, 'Official campaign/source list. Account, partner, property, or business source.'],
  ['RYL', 'Account', 'Account', 0, 600, 'Official campaign/source list. Account, partner, property, or business source.'],
  ['S&K', 'Account', 'Account', 0, 610, 'Official campaign/source list. Account, partner, property, or business source.'],
  ['SAVILLS', 'Account', 'Account', 0, 620, 'Official campaign/source list. Account, partner, property, or business source.'],
  ['SCRAYE', 'Account', 'Account', 0, 630, 'Official campaign/source list. Account, partner, property, or business source.'],
  ['SCRIBBLER', 'Account', 'Account', 0, 640, 'Official campaign/source list. Account, partner, property, or business source.'],
  ['SECRET KEYS', 'Locksmith partner', 'Unknown', 0, 650, 'Official campaign/source list. Locksmith partner or trade source.'],
  ['SECURITY SHUTTERS', 'Account', 'Account', 0, 660, 'Official campaign/source list. Account, partner, property, or business source.'],
  ['SHP', 'Account', 'Account', 0, 670, 'Official campaign/source list. Account, partner, property, or business source.'],
  ['SPETZ', 'Locksmith partner', 'Unknown', 0, 680, 'Official campaign/source list. Locksmith partner or trade source.'],
  ['STEFAN', 'Affiliate', 'Unknown', 30, 690, 'Official campaign/source list. Affiliate split 30%.'],
  ['STONEVIEW', 'Account', 'Account', 0, 700, 'Official campaign/source list. Account, partner, property, or business source.'],
  ['SULLCROM', 'Account', 'Account', 0, 710, 'Official campaign/source list. Account, partner, property, or business source.'],
  ['SUNSHINE ESTATES', 'Account', 'Account', 0, 720, 'Official campaign/source list. Account, partner, property, or business source.'],
  ['SWIFT LOCKSMITH', 'Locksmith partner', 'Unknown', 0, 730, 'Official campaign/source list. Locksmith partner or trade source.'],
  ['TEMPUS', 'Account', 'Account', 0, 740, 'Official campaign/source list. Account, partner, property, or business source.'],
  ['W-APP/ TXT', 'Online lead', 'Unknown', 0, 750, 'Official campaign/source list. Online, app, text, or inbound lead source.'],
  ['WINGFIELD', 'Account', 'Account', 0, 760, 'Official campaign/source list. Account, partner, property, or business source.'],
  ['Z-CLIENT', 'Account', 'Account', 0, 770, 'Official campaign/source list. Account, partner, property, or business source.'],
  ['ZIMA GROUP', 'Account', 'Account', 0, 780, 'Official campaign/source list. Account, partner, property, or business source.'],
  ['ZONE PROPERTY', 'Account', 'Account', 0, 790, 'Official campaign/source list. Account, partner, property, or business source.']
];

function authSecret() {
  return process.env.DASHBOARD_PASSWORD || "change-me-now";
}

function parseCookies(req) {
  const header = req.headers.cookie || "";
  const cookies = {};
  header.split(";").forEach(part => {
    const index = part.indexOf("=");
    if (index === -1) return;
    cookies[part.slice(0, index).trim()] = decodeURIComponent(part.slice(index + 1).trim());
  });
  return cookies;
}

function signValue(value) {
  return crypto.createHmac("sha256", authSecret()).update(value).digest("hex");
}

function makeSessionCookie(agentName) {
  const payload = Buffer.from(JSON.stringify({ agentName, createdAt: Date.now() })).toString("base64url");
  return `${payload}.${signValue(payload)}`;
}

function readSession(req) {
  const raw = parseCookies(req).dashboard_session;
  if (!raw || !raw.includes(".")) return null;

  const [payload, signature] = raw.split(".");
  const expected = signValue(payload);

  try {
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  } catch (error) {
    return null;
  }

  try {
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!decoded.agentName) return null;

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
  res.setHeader("Set-Cookie", "dashboard_session=; HttpOnly; SameSite=Lax; Secure; Path=/; Max-Age=0");
}

function requireLogin(req, res, next) {
  const openPaths = ["/login", "/logout", "/webhook/yay"];
  if (openPaths.includes(req.path) || req.path.startsWith("/tech-checkin/") || req.path.startsWith("/tech-workspace/")) return next();

  const session = readSession(req);
  if (!session) return res.redirect(`/login?next=${encodeURIComponent(req.originalUrl)}`);

  req.currentAgent = session.agentName;
  next();
}

app.use(requireLogin);

function currentAgentName(req) {
  return req.currentAgent || "";
}

async function getActivePortalUsers() {
  const result = await pool.query(`
    SELECT name, role, extension_number
    FROM app_users
    WHERE active = TRUE
    ORDER BY name ASC
  `);

  if (result.rows.length) return result.rows;

  return Object.entries(agents)
    .map(([extension_number, name]) => ({ name, role: "dispatcher", extension_number }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

async function getWallboardAgents() {
  const result = await pool.query(`
    SELECT name, extension_number
    FROM app_users
    WHERE active = TRUE
    AND extension_number IS NOT NULL
    AND TRIM(extension_number) <> ''
    ORDER BY name ASC
  `);

  const mapped = {};
  result.rows.forEach(user => {
    mapped[String(user.extension_number).trim()] = user.name;
  });

  return Object.keys(mapped).length ? mapped : agents;
}

async function seedDefaultPortalUsers() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS app_users (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      role TEXT DEFAULT 'dispatcher',
      extension_number TEXT,
      active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
  `);

  await pool.query(`ALTER TABLE app_users ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'dispatcher';`);
  await pool.query(`ALTER TABLE app_users ADD COLUMN IF NOT EXISTS extension_number TEXT;`);
  await pool.query(`ALTER TABLE app_users ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT TRUE;`);
  await pool.query(`ALTER TABLE app_users ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();`);
  await pool.query(`ALTER TABLE app_users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();`);

  for (const [extensionNumber, name] of Object.entries(agents)) {
    await pool.query(`
      INSERT INTO app_users (name, role, extension_number, active, created_at, updated_at)
      VALUES ($1, $2, $3, TRUE, NOW(), NOW())
      ON CONFLICT (name) DO UPDATE SET
        extension_number = COALESCE(app_users.extension_number, EXCLUDED.extension_number),
        updated_at = NOW()
    `, [name, name === "Rachel" ? "admin" : "dispatcher", extensionNumber]);
  }
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


function formatDate(date) {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-GB", {
    timeZone: "Europe/London",
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric"
  });
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

function dateInputValue(date) {
  return date.toISOString().slice(0, 10);
}

function londonDateParts(date = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });

  const parts = formatter.formatToParts(date);
  const lookup = {};
  parts.forEach(part => {
    lookup[part.type] = part.value;
  });

  return {
    year: Number(lookup.year),
    month: Number(lookup.month),
    day: Number(lookup.day)
  };
}

function makeDate(year, month, day) {
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
}

function addDays(date, days) {
  const copy = new Date(date);
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

function startOfWeekMonday(date) {
  const day = date.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  return addDays(date, diff);
}

function buildReportRange(query) {
  const range = query.range || "today";
  const nowParts = londonDateParts();
  const today = makeDate(nowParts.year, nowParts.month, nowParts.day);

  let start = today;
  let end = addDays(today, 1);
  let label = "Today";

  if (range === "yesterday") {
    start = addDays(today, -1);
    end = today;
    label = "Yesterday";
  } else if (range === "this_week") {
    start = startOfWeekMonday(today);
    end = addDays(today, 1);
    label = "This week";
  } else if (range === "this_month") {
    start = makeDate(nowParts.year, nowParts.month, 1);
    end = addDays(today, 1);
    label = "This month";
  } else if (range === "last_month") {
    const lastMonth = nowParts.month === 1 ? 12 : nowParts.month - 1;
    const year = nowParts.month === 1 ? nowParts.year - 1 : nowParts.year;
    start = makeDate(year, lastMonth, 1);
    end = makeDate(nowParts.year, nowParts.month, 1);
    label = "Last month";
  } else if (range === "custom") {
    const from = query.from || dateInputValue(today);
    const to = query.to || dateInputValue(today);
    start = new Date(`${from}T00:00:00.000Z`);
    end = addDays(new Date(`${to}T00:00:00.000Z`), 1);
    label = `Custom: ${from} to ${to}`;
  }

  return {
    range,
    label,
    start,
    end,
    fromValue: dateInputValue(start),
    toValue: dateInputValue(addDays(end, -1))
  };
}

function csvValue(value) {
  if (value === null || value === undefined) return "\"\"";
  return `"${String(value).replace(/"/g, "\"\"")}"`;
}

function isPaymentAllowedForCompany(companyKey, paymentMethod) {
  if (companyKey === "locksmiths") return paymentMethod === "Bank transfer" || paymentMethod === "Cash";
  if (companyKey === "online") return paymentMethod === "Card" || paymentMethod === "Cash";
  return false;
}

function paymentRuleMessage(companyKey) {
  if (companyKey === "locksmiths") return "24H Locksmiths Ltd can only use Bank transfer or Cash.";
  if (companyKey === "online") return "24H Online Services Ltd can only use Card or Cash.";
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



const quotationStatuses = [
  { value: "quote_requested", label: "Quote requested" },
  { value: "quote_drafted", label: "Quote drafted" },
  { value: "quote_sent", label: "Quote sent" },
  { value: "quote_accepted", label: "Quote accepted" },
  { value: "quote_declined", label: "Quote declined" },
  { value: "converted_to_order", label: "Converted to order" },
  { value: "expired", label: "Expired" }
];

function quotationStatusLabel(status) {
  const found = quotationStatuses.find(item => item.value === status);
  return found ? found.label : (status || "Quote drafted");
}

function quotationStatusClass(status) {
  const clean = String(status || "quote_drafted").replaceAll("_", "-");
  return `quote-${clean}`;
}

function quotationStatusOptions(selectedStatus = "quote_drafted") {
  return optionList(quotationStatuses, selectedStatus);
}

function quoteNumber(id) {
  return `Q${String(id).padStart(5, "0")}`;
}

function quoteAddressPlain(quote) {
  return [quote.site_address, quote.site_postcode].filter(Boolean).join(", ");
}

const jobStatuses = [
  { value: "open", label: "Job awaiting to be assigned" },
  { value: "assigned", label: "Assigned" },
  { value: "closed", label: "Closed" },
  { value: "awaiting_payment", label: "Awaiting payment" },
  { value: "invoiced_account", label: "Invoice sent to Acc Dept" }
];

const legacyJobStatusLabels = {
  completed: "Completed",
  fully_paid_private: "Fully paid (private)"
};

const activeJobStatuses = ["open", "assigned", "awaiting_payment"];

const jobTypes = [
  "BAILIFF (COURT ORDERED)",
  "BIKE LOCK (FROM £75, 1HR ETA)",
  "DOOR FIX/ REPLACEMENT",
  "FIX LOCK",
  "FRESH INSTALLATION (LOCK ON BLANK DOOR)",
  "KEY BROKEN IN LOCK",
  "KEY SAFE INSTALLATION",
  "LOCK CHANGE",
  "LOCKED IN",
  "LOCKED OUT",
  "OPEN SAFE (FROM £120)",
  "QUOTE",
  "RECALL (UNDER WARRANTY)",
  "SPECIALIST"
];

const jobUrgencies = ["Normal", "Urgent", "Emergency"];
const jobPaymentMethods = ["Unknown", "Cash", "Card", "Bank transfer", "Account"];
const jobOutcomes = ["Completed", "Cancelled", "No answer", "Customer declined", "Follow-up needed", "Other"];


const disputeStatuses = [
  { value: "open_dispute", label: "Open dispute" },
  { value: "awaiting_customer_email", label: "Awaiting customer email" },
  { value: "under_review", label: "Under review" },
  { value: "refund_agreed", label: "Refund agreed" },
  { value: "refund_processed", label: "Refund processed" },
  { value: "chargeback_raised", label: "Chargeback raised" },
  { value: "resolved", label: "Resolved" },
  { value: "rejected", label: "Rejected" }
];

const complaintTypes = [
  "Price dispute",
  "Workmanship complaint",
  "Parts/materials dispute",
  "Arrival time complaint",
  "Refund request",
  "Chargeback",
  "Other"
];

function disputeStatusLabel(status) {
  const found = disputeStatuses.find(item => item.value === status);
  return found ? found.label : (status || "Open dispute");
}

function disputeStatusClass(status) {
  const clean = String(status || "open_dispute").replaceAll("_", "-");
  return `dispute-${clean}`;
}

function disputeStatusOptions(selectedStatus = "open_dispute") {
  return optionList(disputeStatuses, selectedStatus);
}

function complaintTypeOptions(selectedType = "") {
  return optionList(complaintTypes, selectedType);
}


function disputeJobSnapshot(job) {
  if (!job) return "";
  const billPayer = job.offsite_payment
    ? `${job.bill_payer_name || ""}${job.bill_payer_phone ? ` · ${job.bill_payer_phone}` : ""}`.trim()
    : `${job.customer_name || ""}${job.customer_phone ? ` · ${job.customer_phone}` : ""}`.trim();

  const rows = [
    ["Order", job.job_number || jobNumber(job.id)],
    ["Customer", `${job.customer_name || ""}${job.customer_phone ? ` · ${job.customer_phone}` : ""}`],
    ["Address", jobAddressPlain(job)],
    ["Job type", `${job.job_type || ""}${job.source_campaign ? ` · ${job.source_campaign}` : ""}`],
    ["Technician", job.technician_name || "Unassigned"],
    ["Status", jobStatusLabel(job.status)],
    ["ETA", job.eta || ""],
    ["Payment", `${job.payment_method || job.expected_payment_method || "Unknown"}${job.customer_paid ? " · Paid" : ""}`],
    ["Final value", money(job.final_value || 0)],
    ["Materials", `${job.materials_used || ""}${job.materials_cost ? ` · ${money(job.materials_cost)}` : ""}`],
    ["Bill payer", billPayer],
    ["Created", formatDateTime(job.created_at)]
  ];

  return `
    <div class="panel linked-job-box">
      <div class="topbar" style="margin-bottom:10px;">
        <div>
          <strong>Original job pulled through</strong><br>
          <span class="muted">These details come from the linked client order. The dispute remains connected to this job.</span>
        </div>
        <a class="button secondary small" href="/jobs/${job.id}/edit">Open job</a>
      </div>
      <div class="grid-2">
        ${rows.map(([label, value]) => `
          <div class="info-block">
            <strong>${escapeHtml(label)}</strong>
            <div>${escapeHtml(value || "—")}</div>
          </div>
        `).join("")}
      </div>
    </div>
  `;
}

function disputeComplaintStarter(job) {
  if (!job) return "";
  return [
    `Original job: ${job.job_number || jobNumber(job.id)}`,
    `Customer: ${job.customer_name || ""}${job.customer_phone ? ` (${job.customer_phone})` : ""}`,
    `Address: ${jobAddressPlain(job)}`,
    `Job type: ${job.job_type || ""}`,
    `Technician: ${job.technician_name || "Unassigned"}`,
    `Final value: ${money(job.final_value || 0)}`,
    `Payment method: ${job.payment_method || job.expected_payment_method || "Unknown"}`,
    `Materials used: ${job.materials_used || ""}${job.materials_cost ? ` (${money(job.materials_cost)})` : ""}`,
    "",
    "Complaint / dispute details:",
    ""
  ].join("\n");
}

function optionList(items, selectedValue = "") {
  return items.map(item => {
    const value = typeof item === "string" ? item : item.value;
    const label = typeof item === "string" ? item : item.label;
    const selected = String(value) === String(selectedValue || "") ? "selected" : "";
    return `<option value="${escapeHtml(value)}" ${selected}>${escapeHtml(label)}</option>`;
  }).join("");
}

function jobStatusLabel(status) {
  const found = jobStatuses.find(item => item.value === status);
  if (found) return found.label;
  if (legacyJobStatusLabels[status]) return legacyJobStatusLabels[status];
  return status || "Job awaiting to be assigned";
}

function jobStatusClass(status) {
  const clean = String(status || "open").replaceAll("_", "-");
  return `job-${clean}`;
}

function jobStatusOptions(selectedStatus = "open") {
  return optionList(jobStatuses, selectedStatus);
}

function parseMoneyInput(value) {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  const number = Number(String(value).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(number) ? number : null;
}

function parseOptionalInt(value) {
  if (!value) return null;
  const number = Number(value);
  return Number.isInteger(number) ? number : null;
}

function jobNumber(id) {
  return `J${String(id).padStart(5, "0")}`;
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
  return value.includes("available") || value.includes("soon") || value.includes("job");
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


function postcoderApiKey() {
  return (process.env.POSTCODER_API_KEY || "").trim();
}

function safeAddressPart(value) {
  return (value || "").toString().trim();
}

function compactPostcoderAddress(address) {
  const line1 = safeAddressPart(address.addressline1);
  const line2 = safeAddressPart(address.addressline2);
  const line3 = safeAddressPart(address.addressline3);
  const posttown = safeAddressPart(address.posttown);
  const county = safeAddressPart(address.county);
  const postcode = safeAddressPart(address.postcode);

  const addressLines = [line1, line2, line3].filter(Boolean);
  const fullAddressLines = [...addressLines, posttown, postcode].filter(Boolean);

  return {
    summary: safeAddressPart(address.summaryline) || fullAddressLines.join(", "),
    address_line_1: line1,
    address_line_2: line2,
    address_line_3: line3,
    town: posttown,
    county,
    postcode,
    latitude: address.latitude || null,
    longitude: address.longitude || null,
    udprn: address.udprn || null,
    full_address: fullAddressLines.join("\n")
  };
}

async function lookupPostcoderAddresses(searchTerm) {
  const apiKey = postcoderApiKey();
  const search = (searchTerm || "").trim();

  if (!apiKey) {
    return { ok: false, addresses: [], error: "POSTCODER_API_KEY is missing in Render environment variables." };
  }

  if (!search) {
    return { ok: false, addresses: [], error: "Enter a postcode or part of an address." };
  }

  const url = `https://ws.postcoder.com/pcw/${encodeURIComponent(apiKey)}/address/uk/${encodeURIComponent(search)}?format=json&lines=3&addtags=latitude,longitude,udprn&identifier=dispatch-office-booking-test`;

  try {
    const response = await fetch(url);
    const json = await response.json();

    if (!response.ok) {
      const message = Array.isArray(json) ? JSON.stringify(json) : (json.message || json.error || "Postcoder lookup failed.");
      return { ok: false, addresses: [], error: message };
    }

    if (!Array.isArray(json)) {
      return { ok: false, addresses: [], error: "Unexpected response from Postcoder." };
    }

    return {
      ok: true,
      addresses: json.map(compactPostcoderAddress),
      error: null
    };
  } catch (error) {
    console.error("Postcoder lookup error:", error);
    return { ok: false, addresses: [], error: "Postcoder lookup failed. Check Render logs." };
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

function makeCheckinToken() {
  return crypto.randomBytes(24).toString("hex");
}

function locationAgeMinutes(date) {
  if (!date) return null;
  return Math.floor((Date.now() - new Date(date).getTime()) / 60000);
}

function locationFreshnessClass(date) {
  const age = locationAgeMinutes(date);
  if (age === null) return "bad";
  if (age <= 60) return "available";
  if (age <= 180) return "soon";
  return "bad";
}

function locationFreshnessText(date) {
  const age = locationAgeMinutes(date);
  if (age === null) return "No GPS check-in yet";
  if (age < 1) return "Updated just now";
  if (age === 1) return "Updated 1 minute ago";
  if (age < 60) return `Updated ${age} minutes ago`;
  const hours = Math.floor(age / 60);
  const minutes = age % 60;
  if (hours === 1 && minutes === 0) return "Updated 1 hour ago";
  if (hours === 1) return `Updated 1 hour ${minutes} mins ago`;
  if (minutes === 0) return `Updated ${hours} hours ago`;
  return `Updated ${hours} hours ${minutes} mins ago`;
}

function technicianHasGps(tech) {
  return tech.current_latitude !== null &&
    tech.current_latitude !== undefined &&
    tech.current_longitude !== null &&
    tech.current_longitude !== undefined;
}

async function getTechnicianDispatchLocation(tech) {
  if (technicianHasGps(tech)) {
    return {
      ok: true,
      latitude: Number(tech.current_latitude),
      longitude: Number(tech.current_longitude),
      precision: "GPS",
      postcode: tech.current_postcode || "",
      source: "GPS check-in",
      error: null
    };
  }

  const location = getBestLocation(tech);
  const lookedUp = await lookupPostcodeLocation(location.postcode);

  return {
    ...lookedUp,
    postcode: location.postcode,
    source: location.source
  };
}

function sharedStyles() {
  return `
    :root {
      --brand-red: #d9462e;
      --brand-green: #2ebd2e;
      --brand-green-dark: #188a18;
      --brand-amber: #f2c94c;
      --brand-amber-dark: #b98a12;
      --charcoal: #26323a;
      --charcoal-dark: #1e272e;
      --sidebar-button: #303c45;
      --bg: #f5f6f8;
      --card: #ffffff;
      --border: #e5e7eb;
      --muted: #6b7280;
      --text: #2b2f36;
    }

    * { box-sizing: border-box; }

    body {
      font-family: Arial, sans-serif;
      background: var(--bg);
      color: var(--text);
      margin: 0;
      padding: 34px 38px 44px 370px;
      min-height: 100vh;
    }

    a { color: var(--brand-green-dark); text-decoration: none; font-weight: bold; }
    a:hover { text-decoration: underline; }

    h1 { font-size: 38px; margin: 0 0 6px; color: var(--text); letter-spacing: -0.02em; }
    h2 { margin-top: 0; color: var(--text); }
    h3 { color: var(--text); }
    label { color: var(--text); font-weight: bold; display: block; margin-bottom: 7px; }
    .subtitle { color: var(--muted); margin-bottom: 24px; }

    .sidebar {
      position: fixed;
      left: 0;
      top: 0;
      bottom: 0;
      width: 330px;
      background: var(--charcoal);
      color: white;
      padding: 22px 24px;
      overflow-y: auto;
      box-shadow: 8px 0 30px rgba(17, 24, 39, 0.14);
      z-index: 1000;
    }

    .sidebar-logo-card {
      background: #ffffff;
      border-radius: 22px;
      min-height: 228px;
      padding: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 28px;
      box-shadow: 0 14px 26px rgba(0,0,0,0.14);
      cursor: pointer;
      text-decoration: none;
      transition: transform 0.15s ease, box-shadow 0.15s ease;
    }

    .sidebar-logo-card:hover {
      transform: translateY(-1px);
      box-shadow: 0 18px 30px rgba(0,0,0,0.18);
      text-decoration: none;
    }

    .sidebar-logo-card img {
      max-width: 245px;
      max-height: 210px;
      display: block;
      object-fit: contain;
    }

    .sidebar-fallback-logo {
      color: var(--charcoal);
      text-align: center;
      font-size: 24px;
      line-height: 1.15;
      font-weight: 900;
    }

    .sidebar-label {
      color: #c8d0d6;
      font-size: 12px;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      margin: 0 0 12px 10px;
      font-weight: bold;
    }

    .sidebar-nav { display: flex; flex-direction: column; gap: 10px; }
    .sidebar-nav-sectioned .sidebar-label { margin: 14px 6px 2px; }
    .sidebar-nav-sectioned .sidebar-label:first-child { margin-top: 0; }
    .section-label { border-top: 1px solid rgba(255,255,255,0.10); padding-top: 14px; }

    .side-link,
    .side-group-title {
      display: flex;
      align-items: center;
      gap: 12px;
      min-height: 50px;
      padding: 12px 14px;
      border-radius: 16px;
      background: var(--sidebar-button);
      color: #ffffff;
      text-decoration: none;
      font-size: 15px;
      font-weight: 800;
      letter-spacing: 0.01em;
      border: 1px solid rgba(255,255,255,0.04);
    }

    .side-link:hover,
    .side-group-title:hover {
      text-decoration: none;
      background: #3a4751;
      transform: translateY(-1px);
    }

    .side-link.active {
      background: #ffffff;
      color: var(--charcoal);
      box-shadow: 0 10px 20px rgba(0,0,0,0.14);
    }

    .side-dot {
      width: 13px;
      height: 13px;
      border-radius: 999px;
      flex: 0 0 auto;
      box-shadow: 0 0 0 3px rgba(255,255,255,0.08);
    }

    .side-icon {
      width: 26px;
      height: 26px;
      border-radius: 9px;
      flex: 0 0 auto;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: var(--brand-amber);
      color: #1f2937;
      font-size: 16px;
      line-height: 1;
      box-shadow: 0 0 0 3px rgba(255,255,255,0.08);
    }

    .dot-green { background: var(--brand-green); }
    .dot-red { background: var(--brand-red); }
    .dot-amber { background: var(--brand-amber); }
    .dot-blue { background: #2563eb; }
    .dot-charcoal { background: #94a3b8; }

    .side-group { margin-top: 0; }
    .side-submenu {
      margin: 8px 0 4px 30px;
      padding-left: 13px;
      border-left: 2px solid rgba(255,255,255,0.16);
      display: grid;
      gap: 5px;
    }
    .side-submenu a {
      color: #d8e0e6;
      font-size: 13px;
      padding: 7px 8px;
      border-radius: 10px;
      display: block;
      font-weight: bold;
    }
    .side-submenu a:hover { background: rgba(255,255,255,0.08); color: white; text-decoration: none; }

    .sidebar-user {
      margin-top: 26px;
      background: var(--sidebar-button);
      border-radius: 18px;
      padding: 14px 16px;
      color: #ffffff;
      border: 1px solid rgba(255,255,255,0.06);
    }
    .sidebar-user-label { color: #c8d0d6; font-size: 12px; margin-bottom: 5px; }
    .sidebar-user-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
    .sidebar-user-name { font-size: 17px; font-weight: 900; }
    .sidebar-user a { color: var(--brand-amber); font-size: 13px; margin: 0; }

    .sidebar-academy-bottom {
      margin-top: 48px;
      display: flex;
      align-items: center;
      gap: 12px;
      min-height: 58px;
      padding: 14px 16px;
      border-radius: 18px;
      background: linear-gradient(135deg, rgba(242,201,76,0.98), rgba(185,138,18,0.98));
      color: #1f2937;
      text-decoration: none;
      font-size: 16px;
      font-weight: 950;
      box-shadow: 0 16px 28px rgba(0,0,0,0.18);
      border: 1px solid rgba(255,255,255,0.18);
    }
    .sidebar-academy-bottom:hover {
      transform: translateY(-1px);
      text-decoration: none;
      box-shadow: 0 20px 34px rgba(0,0,0,0.22);
    }
    .sidebar-academy-bottom.active {
      background: #ffffff;
      color: var(--charcoal);
      box-shadow: 0 12px 24px rgba(0,0,0,0.18);
    }
    .academy-bottom-icon {
      width: 34px;
      height: 34px;
      border-radius: 12px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: var(--charcoal);
      color: var(--brand-amber);
      font-size: 19px;
      flex: 0 0 auto;
    }
    .academy-bottom-text { display: grid; gap: 2px; }
    .academy-bottom-main { line-height: 1; }
    .academy-bottom-sub { font-size: 11px; font-weight: 800; color: rgba(31,41,55,0.72); }
    .sidebar-academy-bottom.active .academy-bottom-sub { color: rgba(38,50,58,0.65); }

    .page-actions { display: flex; gap: 12px; flex-wrap: wrap; margin: 18px 0 22px; }
    .action-button, a.action-button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 12px 16px;
      border-radius: 14px;
      background: var(--brand-green-dark);
      color: white;
      text-decoration: none;
      font-weight: 900;
      border: none;
      min-height: 44px;
    }
    .action-button.red { background: var(--brand-red); }
    .action-button.amber { background: var(--brand-amber-dark); }
    .action-button.dark { background: var(--charcoal); }

    .nav { display: none; }
    .dropdown, .dropdown-content { display: none; }
    .login-bar { display: none; }

    .panel {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 22px;
      padding: 24px;
      margin-bottom: 24px;
      box-shadow: 0 14px 30px rgba(17, 24, 39, 0.06);
    }

    input, select, textarea, button {
      font-size: 15px;
      padding: 10px;
      border-radius: 10px;
      border: 1px solid #d1d5db;
    }
    input, select, textarea {
      background: #ffffff;
      color: var(--text);
      width: 100%;
    }
    textarea { min-height: 95px; }
    button {
      background: var(--brand-green-dark);
      color: white;
      border: none;
      cursor: pointer;
      font-weight: 900;
    }
    button:hover { filter: brightness(0.96); }

    table {
      width: 100%;
      border-collapse: separate;
      border-spacing: 0;
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 18px;
      overflow: hidden;
      box-shadow: 0 14px 30px rgba(17, 24, 39, 0.05);
    }
    th, td {
      text-align: left;
      padding: 12px;
      border-bottom: 1px solid #eef0f3;
      font-size: 14px;
      vertical-align: middle;
      color: var(--text);
    }
    tr:last-child td { border-bottom: none; }
    th {
      color: var(--muted);
      background: #f9fafb;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .invoice-table th, .invoice-table td { padding: 11px 10px; font-size: 13px; }
    .invoice-main { font-weight: bold; font-size: 14px; color: var(--text); }
    .invoice-sub { color: var(--muted); font-size: 12px; margin-top: 4px; line-height: 1.35; }
    .compact-stage { min-width: 245px; }
    .compact-stage-top { margin-bottom: 7px; }
    .compact-stage-form { display: flex; gap: 6px; align-items: center; }
    .compact-stage-form select { font-size: 12px; padding: 7px; width: 180px; }
    .compact-stage-form button { font-size: 12px; padding: 7px 10px; }
    .actions { display: flex; flex-direction: column; gap: 8px; align-items: flex-start; }
    .actions a { margin-right: 0; font-size: 13px; }
    .inline-form { display: inline-block; margin: 0 8px 0 0; }
    .inline-form button { width: auto; }
    .delete-link { color: var(--brand-red); }
    .delete-button, .danger { background: var(--brand-red); }
    .cancel-button { background: var(--charcoal); }
    .small-button { font-size: 12px; padding: 7px 10px; }

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
    .bad { background: var(--brand-red); color: white; }
    .neutral, .inactive { background: #e5e7eb; color: #374151; }
    .engaged { background: var(--brand-red); color: white; }
    .priority-high { background: var(--brand-red); color: white; }
    .priority-push { background: #f59e0b; color: black; }
    .priority-normal { background: #e5e7eb; color: #374151; }
    .priority-low { background: #9ca3af; color: white; }

    .stage-draft { background: #374151; color: #d1d5db; }
    .stage-approval { background: #f59e0b; color: black; }
    .stage-approved { background: #2563eb; color: white; }
    .stage-emailed { background: #16a34a; color: white; }
    .stage-emailed-photos { background: #22c55e; color: black; }
    .stage-cancelled { background: var(--brand-red); color: white; }

    .muted { color: var(--muted); }
    .audit { color: var(--muted); font-size: 12px; line-height: 1.35; margin-top: 6px; }
    .warning-text { color: var(--brand-amber-dark); font-weight: bold; }
    .distance { font-size: 22px; font-weight: bold; }
    .grid-2 { display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; }
    .grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; }
    .grid-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; }
    .checkbox-row { display: flex; align-items: center; gap: 10px; margin: 16px 0; color: var(--text); font-size: 16px; }
    .checkbox-row input { width: 18px; height: 18px; }
    .help { color: var(--muted); font-size: 14px; margin-top: 8px; }
    .search-form { display: grid; grid-template-columns: 2fr 1fr; gap: 15px; align-items: center; }
    .copy-input { width: 100%; box-sizing: border-box; font-size: 12px; padding: 7px; color: var(--text); }

    .job-open { background: #2563eb; color: white; }
    .job-assigned { background: #16a34a; color: white; }
    .job-closed { background: var(--brand-red); color: white; }
    .job-awaiting-payment { background: #f59e0b; color: black; }
    .job-invoiced-account { background: #ec4899; color: white; }
    .quote-quote-requested { background: #dbeafe; color: #1d4ed8; }
    .quote-quote-drafted { background: #374151; color: white; }
    .quote-quote-sent { background: #fef3c7; color: #92400e; }
    .quote-quote-accepted { background: #dcfce7; color: #166534; }
    .quote-quote-declined { background: #fee2e2; color: #991b1b; }
    .quote-converted-to-order { background: #ec4899; color: white; }
    .quote-expired { background: #e5e7eb; color: #374151; }
    .job-completed { background: #6b7280; color: white; }
    .job-fully-paid-private { background: #6b7280; color: white; }
    .dispute-open-dispute { background: #dc2626; color: white; }
    .dispute-awaiting-customer-email { background: #f59e0b; color: black; }
    .dispute-under-review { background: #2563eb; color: white; }
    .dispute-refund-agreed { background: #db2777; color: white; }
    .dispute-refund-processed { background: #16a34a; color: white; }
    .dispute-chargeback-raised { background: #7c2d12; color: white; }
    .dispute-resolved { background: #16a34a; color: white; }
    .dispute-rejected { background: #6b7280; color: white; }
    .danger-zone { border: 1px solid rgba(220, 38, 38, 0.25); background: #fff7f7; }
    .linked-job-box { padding: 14px; border: 1px solid var(--border); border-radius: 14px; background: #f9fafb; line-height: 1.5; }
    .job-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; }
    .job-grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; }
    .job-card-title { font-weight: bold; font-size: 16px; color: var(--text); }
    .job-card-sub { color: var(--muted); font-size: 13px; margin-top: 4px; line-height: 1.35; }
    .big-total { font-size: 30px; font-weight: bold; color: var(--text); }

    .dashboard-card, .metric-card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 20px;
      padding: 20px;
      box-shadow: 0 14px 30px rgba(17, 24, 39, 0.05);
    }

    @media (max-width: 1000px) {
      body { padding: 24px; padding-top: 360px; }
      .sidebar { right: 0; width: 100%; height: 330px; bottom: auto; display: block; overflow-x: auto; }
      .sidebar-logo-card { position: absolute; left: 20px; top: 20px; width: 220px; height: 180px; min-height: 180px; margin: 0; }
      .sidebar-logo-card img { max-width: 190px; max-height: 160px; }
      .sidebar-label { margin-left: 250px; margin-top: 10px; }
      .sidebar-nav { margin-left: 250px; display: grid; grid-template-columns: repeat(2, minmax(150px, 1fr)); gap: 8px; }
      .sidebar-user { margin-left: 250px; margin-top: 10px; }
      .sidebar-academy-bottom { margin-left: 250px; margin-top: 10px; min-height: 52px; padding: 10px 14px; }
      .academy-bottom-sub { display: none; }
      .side-submenu { display: none; }
      .job-grid, .job-grid-3, .grid-2, .grid-3, .grid-4, .search-form { grid-template-columns: 1fr; }
    }
  `;
}

function nav(req) {
  const name = currentAgentName(req);
  const path = req.path || "/";
  const active = (href) => {
    if (href === "/") return path === "/" ? " active" : "";
    return path.startsWith(href) ? " active" : "";
  };

  return `
    <aside class="sidebar">
      <a class="sidebar-logo-card" href="/call-wallboard" title="Go to Call wallboard / refresh">
        <img src="/brand-logo.png" alt="Your Dispatch Partner" onerror="this.style.display='none'; this.parentNode.innerHTML='<div class=&quot;sidebar-fallback-logo&quot;>Your Dispatch Partner<br><span style=&quot;font-size:16px;color:#4b5563;&quot;>The Dispatch Office</span></div>';">
      </a>

      <nav class="sidebar-nav sidebar-nav-sectioned">
        <div class="sidebar-label">Operations</div>
        <a class="side-link${active("/call-wallboard")}" href="/call-wallboard"><span class="side-dot dot-green"></span><span>Call wallboard</span></a>
        <a class="side-link${active("/jobs")}" href="/jobs"><span class="side-dot dot-red"></span><span>Dispatch Board</span></a>
        <a class="side-link${active("/jobs/new")}" href="/jobs/new"><span class="side-dot dot-blue"></span><span>Create order</span></a>
        <a class="side-link${active("/customers")}" href="/customers"><span class="side-dot dot-green"></span><span>Customers</span></a>
        <a class="side-link${active("/campaigns")}" href="/campaigns"><span class="side-dot dot-amber"></span><span>Campaigns</span></a>
        <a class="side-link${active("/dispatch")}" href="/dispatch"><span class="side-dot dot-amber"></span><span>Live map</span></a>

        <div class="sidebar-label section-label">Team</div>
        <a class="side-link${active("/technicians")}" href="/technicians"><span class="side-dot dot-green"></span><span>Technicians</span></a>

        <div class="sidebar-label section-label">Finance</div>
        <a class="side-link${active("/quotations")}" href="/quotations"><span class="side-dot dot-blue"></span><span>Quotations</span></a>
        <div class="side-group">
          <a class="side-group-title${active("/invoices")}" href="/invoices"><span class="side-dot dot-amber"></span><span>Invoices</span></a>
          <div class="side-submenu">
            <a href="/invoices">Active invoices</a>
            <a href="/invoices/historic">Historic invoices</a>
            <a href="/invoices/new">New invoice</a>
            <a href="/invoice-items">Invoice items</a>
            <a href="/invoice-templates">Account templates</a>
          </div>
        </div>
        <a class="side-link${active("/reports")}" href="/reports"><span class="side-dot dot-green"></span><span>Reports</span></a>
        <a class="side-link${active("/disputes")}" href="/disputes"><span class="side-dot dot-red"></span><span>Disputes</span></a>

        <div class="sidebar-label section-label">Admin</div>
        <a class="side-link${active("/admin")}" href="/admin/users"><span class="side-dot dot-red"></span><span>Admin Manager</span></a>
      </nav>

      <div class="sidebar-user">
        <div class="sidebar-user-label">Logged in as</div>
        <div class="sidebar-user-row">
          <div class="sidebar-user-name">${escapeHtml(name)}</div>
          <a href="/logout">Logout</a>
        </div>
      </div>

      <a class="sidebar-academy-bottom" href="/academy" target="_blank" rel="noopener noreferrer">
        <span class="academy-bottom-icon" aria-hidden="true">🎓</span>
        <span class="academy-bottom-text">
          <span class="academy-bottom-main">Academy</span>
          <span class="academy-bottom-sub">Training & onboarding</span>
        </span>
      </a>
    </aside>
  `;
}

function invoiceRows(invoices) {
  return invoices.map(invoice => {
    const company = companies[invoice.company_key] || companies.online;
    const stage = invoice.invoice_stage || "Draft only";
    const stageClass = invoiceStageClass(stage);

    const sitePostcode = invoice.site_same_as_invoice ? invoice.customer_postcode : invoice.site_postcode;

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
          <div class="compact-stage-top"><span class="pill ${stageClass}">${escapeHtml(stage)}</span></div>
          <form class="compact-stage-form" method="POST" action="/invoices/stage">
            <input type="hidden" name="id" value="${invoice.id}">
            <select name="invoice_stage">${invoiceStageOptions(stage)}</select>
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

async function seedDefaultInvoiceItems() {
  const countResult = await pool.query(`SELECT COUNT(*)::int AS count FROM invoice_items`);
  if (countResult.rows[0].count > 0) return;

  for (const [description, defaultPrice, sortOrder] of defaultInvoiceItems) {
    await pool.query(`
      INSERT INTO invoice_items (description, default_price, sort_order, active, created_at, updated_at)
      VALUES ($1, $2, $3, TRUE, NOW(), NOW())
    `, [description, defaultPrice, sortOrder]);
  }
}

async function seedDefaultInvoiceTemplates() {
  const countResult = await pool.query(`SELECT COUNT(*)::int AS count FROM invoice_templates`);
  if (countResult.rows[0].count > 0) return;

  for (const [templateName, customerName, customerAddress, customerPostcode, sortOrder] of defaultInvoiceTemplates) {
    await pool.query(`
      INSERT INTO invoice_templates (
        template_name, customer_name, customer_address, customer_postcode,
        sort_order, active, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, TRUE, NOW(), NOW())
    `, [templateName, customerName, customerAddress, customerPostcode, sortOrder]);
  }
}


async function seedDefaultCampaigns() {
  const officialCampaignNames = defaultCampaigns.map(item => item[0]);
  const oldStarterCampaigns = ['Unknown', 'Google', 'Google Ads', 'Organic', 'Repeat customer', 'Account customer', 'Adam Lee', 'Buns From Home', 'Referral', 'Emergency callout', 'Other'];

  for (const [name, campaignType, defaultPaymentMethod, commissionPercentage, sortOrder, notes] of defaultCampaigns) {
    await pool.query(`
      INSERT INTO campaigns (
        name, campaign_type, default_payment_method, commission_percentage,
        sort_order, notes, active, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, TRUE, NOW(), NOW())
      ON CONFLICT (name) DO UPDATE SET
        campaign_type = EXCLUDED.campaign_type,
        default_payment_method = EXCLUDED.default_payment_method,
        commission_percentage = EXCLUDED.commission_percentage,
        sort_order = EXCLUDED.sort_order,
        notes = EXCLUDED.notes,
        active = TRUE,
        updated_at = NOW()
    `, [name, campaignType, defaultPaymentMethod, commissionPercentage, sortOrder, notes]);
  }

  await pool.query(`
    UPDATE campaigns
    SET active = FALSE, updated_at = NOW()
    WHERE name = ANY($1::text[])
    AND NOT (name = ANY($2::text[]))
  `, [oldStarterCampaigns, officialCampaignNames]);
}

async function getCampaignOptions(selectedValue = "") {
  try {
    const result = await pool.query(`
      SELECT name, campaign_type
      FROM campaigns
      WHERE active = TRUE
      ORDER BY sort_order ASC, name ASC
    `);
    if (!result.rows.length) return defaultCampaigns.map(item => ({ value: item[0], label: item[0] }));
    return result.rows.map(row => ({
      value: row.name,
      label: row.name
    }));
  } catch (error) {
    console.error("Campaign option load error:", error);
    return defaultCampaigns.map(item => ({ value: item[0], label: item[0] }));
  }
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
  await pool.query(`ALTER TABLE technicians ADD COLUMN IF NOT EXISTS checkin_token TEXT;`);
  await pool.query(`ALTER TABLE technicians ADD COLUMN IF NOT EXISTS current_latitude NUMERIC(10,7);`);
  await pool.query(`ALTER TABLE technicians ADD COLUMN IF NOT EXISTS current_longitude NUMERIC(10,7);`);
  await pool.query(`ALTER TABLE technicians ADD COLUMN IF NOT EXISTS location_accuracy NUMERIC(10,2);`);
  await pool.query(`ALTER TABLE technicians ADD COLUMN IF NOT EXISTS location_checked_in_at TIMESTAMP;`);

  const tokenResult = await pool.query(`SELECT id FROM technicians WHERE checkin_token IS NULL`);
  for (const row of tokenResult.rows) {
    await pool.query(`UPDATE technicians SET checkin_token = $1 WHERE id = $2`, [makeCheckinToken(), row.id]);
  }

  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS technicians_checkin_token_unique ON technicians (checkin_token);`);

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

  await pool.query(`
    CREATE TABLE IF NOT EXISTS invoice_items (
      id SERIAL PRIMARY KEY,
      description TEXT NOT NULL,
      default_price NUMERIC(10,2) DEFAULT 0,
      sort_order INTEGER DEFAULT 100,
      active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
  `);

  await pool.query(`ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS default_price NUMERIC(10,2) DEFAULT 0;`);
  await pool.query(`ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 100;`);
  await pool.query(`ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT TRUE;`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS invoice_templates (
      id SERIAL PRIMARY KEY,
      template_name TEXT NOT NULL,
      customer_name TEXT NOT NULL,
      customer_address TEXT,
      customer_postcode TEXT,
      sort_order INTEGER DEFAULT 100,
      active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
  `);

  await pool.query(`ALTER TABLE invoice_templates ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 100;`);
  await pool.query(`ALTER TABLE invoice_templates ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT TRUE;`);



  await pool.query(`
    CREATE TABLE IF NOT EXISTS jobs (
      id SERIAL PRIMARY KEY,
      job_number TEXT,
      customer_name TEXT,
      customer_phone TEXT,
      customer_alt_phone TEXT,
      customer_email TEXT,
      address_line_1 TEXT,
      address_line_2 TEXT,
      address_line_3 TEXT,
      town TEXT,
      county TEXT,
      postcode TEXT,
      latitude NUMERIC(12,8),
      longitude NUMERIC(12,8),
      udprn TEXT,
      job_type TEXT,
      job_description TEXT,
      urgency TEXT DEFAULT 'Normal',
      source_campaign TEXT,
      quoted_price NUMERIC(10,2),
      starting_price NUMERIC(10,2),
      call_out_agreed NUMERIC(10,2),
      start_price_locks NUMERIC(10,2),
      offsite_payment BOOLEAN DEFAULT FALSE,
      bill_payer_name TEXT,
      bill_payer_phone TEXT,
      expected_payment_method TEXT DEFAULT 'Unknown',
      account_job BOOLEAN DEFAULT FALSE,
      account_template_id INTEGER,
      assigned_technician_id INTEGER,
      eta TEXT,
      dispatcher_name TEXT,
      dispatcher_notes TEXT,
      status TEXT DEFAULT 'open',
      final_value NUMERIC(10,2),
      payment_method TEXT,
      customer_paid BOOLEAN DEFAULT FALSE,
      materials_used TEXT,
      materials_cost NUMERIC(10,2),
      outcome TEXT,
      tech_notes TEXT,
      close_notes TEXT,
      closed_by TEXT,
      closed_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
  `);

  await pool.query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS job_number TEXT;`);
  await pool.query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS customer_alt_phone TEXT;`);
  await pool.query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS address_line_3 TEXT;`);
  await pool.query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS latitude NUMERIC(12,8);`);
  await pool.query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS longitude NUMERIC(12,8);`);
  await pool.query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS udprn TEXT;`);
  await pool.query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS source_campaign TEXT;`);
  await pool.query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS quoted_price NUMERIC(10,2);`);
  await pool.query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS starting_price NUMERIC(10,2);`);
  await pool.query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS call_out_agreed NUMERIC(10,2);`);
  await pool.query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS start_price_locks NUMERIC(10,2);`);
  await pool.query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS offsite_payment BOOLEAN DEFAULT FALSE;`);
  await pool.query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS bill_payer_name TEXT;`);
  await pool.query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS bill_payer_phone TEXT;`);
  await pool.query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS expected_payment_method TEXT DEFAULT 'Unknown';`);
  await pool.query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS account_job BOOLEAN DEFAULT FALSE;`);
  await pool.query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS account_template_id INTEGER;`);
  await pool.query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS assigned_technician_id INTEGER;`);
  await pool.query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS eta TEXT;`);
  await pool.query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS dispatcher_name TEXT;`);
  await pool.query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS dispatcher_notes TEXT;`);
  await pool.query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS final_value NUMERIC(10,2);`);
  await pool.query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS payment_method TEXT;`);
  await pool.query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS customer_paid BOOLEAN DEFAULT FALSE;`);
  await pool.query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS materials_used TEXT;`);
  await pool.query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS materials_cost NUMERIC(10,2);`);
  await pool.query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS outcome TEXT;`);
  await pool.query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS tech_notes TEXT;`);
  await pool.query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS close_notes TEXT;`);
  await pool.query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS closed_by TEXT;`);
  await pool.query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS closed_at TIMESTAMP;`);
  await pool.query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS onsite_at TIMESTAMP;`);
  await pool.query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS tech_updated_at TIMESTAMP;`);
  await pool.query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS tech_close_submitted_by TEXT;`);

  await pool.query(`CREATE INDEX IF NOT EXISTS jobs_status_idx ON jobs (status);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS jobs_created_at_idx ON jobs (created_at);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS jobs_postcode_idx ON jobs (postcode);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS jobs_assigned_technician_idx ON jobs (assigned_technician_id);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS jobs_source_campaign_idx ON jobs (source_campaign);`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS campaigns (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      campaign_type TEXT DEFAULT 'Private',
      default_payment_method TEXT DEFAULT 'Unknown',
      commission_percentage NUMERIC(6,2) DEFAULT 0,
      sort_order INTEGER DEFAULT 100,
      active BOOLEAN DEFAULT TRUE,
      notes TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
  `);

  await pool.query(`ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS campaign_type TEXT DEFAULT 'Private';`);
  await pool.query(`ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS default_payment_method TEXT DEFAULT 'Unknown';`);
  await pool.query(`ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS commission_percentage NUMERIC(6,2) DEFAULT 0;`);
  await pool.query(`ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 100;`);
  await pool.query(`ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT TRUE;`);
  await pool.query(`ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS notes TEXT;`);
  await pool.query(`CREATE INDEX IF NOT EXISTS campaigns_active_idx ON campaigns (active);`);


  await pool.query(`
    CREATE TABLE IF NOT EXISTS quotations (
      id SERIAL PRIMARY KEY,
      quote_number TEXT,
      company_key TEXT DEFAULT 'online',
      customer_name TEXT,
      customer_email TEXT,
      customer_phone TEXT,
      customer_address TEXT,
      customer_postcode TEXT,
      site_address TEXT,
      site_postcode TEXT,
      quote_date TEXT,
      valid_until TEXT,
      prepared_by TEXT,
      prepared_role TEXT DEFAULT 'Head of Operations',
      status TEXT DEFAULT 'quote_drafted',
      line_items JSONB,
      subtotal NUMERIC(10,2),
      vat_amount NUMERIC(10,2),
      total NUMERIC(10,2),
      warranty_text TEXT,
      acceptance_text TEXT,
      notes TEXT,
      converted_job_id INTEGER,
      sent_at TIMESTAMP,
      accepted_at TIMESTAMP,
      declined_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
  `);

  await pool.query(`ALTER TABLE quotations ADD COLUMN IF NOT EXISTS quote_number TEXT;`);
  await pool.query(`ALTER TABLE quotations ADD COLUMN IF NOT EXISTS company_key TEXT DEFAULT 'online';`);
  await pool.query(`ALTER TABLE quotations ADD COLUMN IF NOT EXISTS customer_email TEXT;`);
  await pool.query(`ALTER TABLE quotations ADD COLUMN IF NOT EXISTS customer_phone TEXT;`);
  await pool.query(`ALTER TABLE quotations ADD COLUMN IF NOT EXISTS customer_postcode TEXT;`);
  await pool.query(`ALTER TABLE quotations ADD COLUMN IF NOT EXISTS site_address TEXT;`);
  await pool.query(`ALTER TABLE quotations ADD COLUMN IF NOT EXISTS site_postcode TEXT;`);
  await pool.query(`ALTER TABLE quotations ADD COLUMN IF NOT EXISTS quote_date TEXT;`);
  await pool.query(`ALTER TABLE quotations ADD COLUMN IF NOT EXISTS valid_until TEXT;`);
  await pool.query(`ALTER TABLE quotations ADD COLUMN IF NOT EXISTS prepared_by TEXT;`);
  await pool.query(`ALTER TABLE quotations ADD COLUMN IF NOT EXISTS prepared_role TEXT DEFAULT 'Head of Operations';`);
  await pool.query(`ALTER TABLE quotations ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'quote_drafted';`);
  await pool.query(`ALTER TABLE quotations ADD COLUMN IF NOT EXISTS line_items JSONB;`);
  await pool.query(`ALTER TABLE quotations ADD COLUMN IF NOT EXISTS subtotal NUMERIC(10,2);`);
  await pool.query(`ALTER TABLE quotations ADD COLUMN IF NOT EXISTS vat_amount NUMERIC(10,2);`);
  await pool.query(`ALTER TABLE quotations ADD COLUMN IF NOT EXISTS total NUMERIC(10,2);`);
  await pool.query(`ALTER TABLE quotations ADD COLUMN IF NOT EXISTS warranty_text TEXT;`);
  await pool.query(`ALTER TABLE quotations ADD COLUMN IF NOT EXISTS acceptance_text TEXT;`);
  await pool.query(`ALTER TABLE quotations ADD COLUMN IF NOT EXISTS notes TEXT;`);
  await pool.query(`ALTER TABLE quotations ADD COLUMN IF NOT EXISTS converted_job_id INTEGER;`);
  await pool.query(`ALTER TABLE quotations ADD COLUMN IF NOT EXISTS sent_at TIMESTAMP;`);
  await pool.query(`ALTER TABLE quotations ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMP;`);
  await pool.query(`ALTER TABLE quotations ADD COLUMN IF NOT EXISTS declined_at TIMESTAMP;`);
  await pool.query(`CREATE INDEX IF NOT EXISTS quotations_status_idx ON quotations (status);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS quotations_created_at_idx ON quotations (created_at);`);


  await pool.query(`
    CREATE TABLE IF NOT EXISTS disputes (
      id SERIAL PRIMARY KEY,
      job_id INTEGER,
      customer_name TEXT,
      customer_phone TEXT,
      technician_id INTEGER,
      complaint_type TEXT,
      disputed_amount NUMERIC(10,2),
      refund_amount NUMERIC(10,2),
      chargeback BOOLEAN DEFAULT FALSE,
      status TEXT DEFAULT 'open_dispute',
      complaint_summary TEXT,
      resolution_notes TEXT,
      created_by TEXT,
      updated_by TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      resolved_at TIMESTAMP
    );
  `);

  await pool.query(`ALTER TABLE disputes ADD COLUMN IF NOT EXISTS job_id INTEGER;`);
  await pool.query(`ALTER TABLE disputes ADD COLUMN IF NOT EXISTS customer_name TEXT;`);
  await pool.query(`ALTER TABLE disputes ADD COLUMN IF NOT EXISTS customer_phone TEXT;`);
  await pool.query(`ALTER TABLE disputes ADD COLUMN IF NOT EXISTS technician_id INTEGER;`);
  await pool.query(`ALTER TABLE disputes ADD COLUMN IF NOT EXISTS complaint_type TEXT;`);
  await pool.query(`ALTER TABLE disputes ADD COLUMN IF NOT EXISTS disputed_amount NUMERIC(10,2);`);
  await pool.query(`ALTER TABLE disputes ADD COLUMN IF NOT EXISTS refund_amount NUMERIC(10,2);`);
  await pool.query(`ALTER TABLE disputes ADD COLUMN IF NOT EXISTS chargeback BOOLEAN DEFAULT FALSE;`);
  await pool.query(`ALTER TABLE disputes ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'open_dispute';`);
  await pool.query(`ALTER TABLE disputes ADD COLUMN IF NOT EXISTS complaint_summary TEXT;`);
  await pool.query(`ALTER TABLE disputes ADD COLUMN IF NOT EXISTS resolution_notes TEXT;`);
  await pool.query(`ALTER TABLE disputes ADD COLUMN IF NOT EXISTS created_by TEXT;`);
  await pool.query(`ALTER TABLE disputes ADD COLUMN IF NOT EXISTS updated_by TEXT;`);
  await pool.query(`ALTER TABLE disputes ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMP;`);
  await pool.query(`CREATE INDEX IF NOT EXISTS disputes_status_idx ON disputes (status);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS disputes_job_id_idx ON disputes (job_id);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS disputes_created_at_idx ON disputes (created_at);`);

  await seedDefaultPortalUsers();
  await seedDefaultInvoiceItems();
  await seedDefaultInvoiceTemplates();
  await seedDefaultCampaigns();
}

/* The rest of this file keeps all your current working routes and adds the invoice upgrade.
   Because this response needs to be copied safely, the complete route set continues below. */

app.get("/login", async (req, res) => {
  const next = req.query.next || "/start-shift";
  const error = req.query.error === "1";
  let users = [];
  try {
    users = await getActivePortalUsers();
  } catch (err) {
    console.error("Login users error:", err);
    users = Object.entries(agents).map(([extension_number, name]) => ({ name, role: "dispatcher", extension_number }));
  }
  const options = users.map(user => `<option value="${escapeHtml(user.name)}">${escapeHtml(user.name)}${user.role ? ` · ${escapeHtml(user.role)}` : ""}</option>`).join("");

  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Your Dispatch Partner Login</title>
      <style>
        :root {
          --brand-red: #d9462e;
          --brand-green: #2ebd2e;
          --brand-green-dark: #188a18;
          --brand-amber: #f2c94c;
          --charcoal: #26323a;
          --bg: #f5f6f8;
          --border: #e5e7eb;
          --muted: #6b7280;
        }
        * { box-sizing: border-box; }
        body {
          font-family: Arial, sans-serif;
          background: radial-gradient(circle at top left, rgba(46,189,46,0.14), transparent 30%), var(--bg);
          color: var(--charcoal);
          margin: 0;
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 34px;
        }
        .login-shell {
          width: 100%;
          max-width: 980px;
          display: grid;
          grid-template-columns: 1fr 430px;
          gap: 28px;
          align-items: stretch;
        }
        .brand-panel, .login-box {
          background: white;
          border: 1px solid var(--border);
          border-radius: 28px;
          box-shadow: 0 24px 60px rgba(17, 24, 39, 0.10);
        }
        .brand-panel {
          padding: 34px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          text-align: center;
        }
        .brand-panel img { max-width: 100%; max-height: 420px; object-fit: contain; }
        .brand-fallback { font-size: 42px; font-weight: 900; color: var(--brand-green-dark); }
        .tagline { margin-top: 18px; color: var(--muted); font-size: 18px; line-height: 1.45; max-width: 420px; }
        .login-box { padding: 34px; }
        h1 { margin: 0 0 8px; font-size: 34px; letter-spacing: -0.02em; }
        .subtitle { color: var(--muted); margin-bottom: 25px; line-height: 1.45; }
        label { display: block; font-weight: bold; margin-bottom: 7px; }
        select, input, button {
          width: 100%;
          font-size: 17px;
          padding: 14px;
          border-radius: 13px;
          border: 1px solid #d1d5db;
          margin-bottom: 14px;
        }
        select, input { background: #ffffff; color: var(--charcoal); }
        button { background: var(--brand-green-dark); color: white; border: none; font-weight: 900; cursor: pointer; }
        button:hover { filter: brightness(0.96); }
        .error { background: var(--brand-red); color: white; border-radius: 13px; padding: 12px; margin-bottom: 14px; font-weight: bold; }
        .status-dots { display: flex; gap: 8px; margin-top: 20px; justify-content: center; }
        .status-dots span { width: 12px; height: 12px; border-radius: 999px; display: block; }
        .red { background: var(--brand-red); }
        .amber { background: var(--brand-amber); }
        .green { background: var(--brand-green); }
        @media (max-width: 850px) { .login-shell { grid-template-columns: 1fr; } .brand-panel img { max-height: 260px; } }
      </style>
    </head>
    <body>
      <div class="login-shell">
        <div class="brand-panel">
          <img src="/brand-logo.png" alt="Your Dispatch Partner" onerror="this.style.display='none'; this.parentNode.innerHTML='<div class=&quot;brand-fallback&quot;>Your Dispatch Partner</div><div class=&quot;tagline&quot;>Home of The Dispatch Office</div>';">
          <div class="tagline">From first call to final invoice — live operations control for busy trade callouts.</div>
          <div class="status-dots"><span class="red"></span><span class="amber"></span><span class="green"></span></div>
        </div>

        <div class="login-box">
          <h1>Portal Login</h1>
          <div class="subtitle">Choose your name and enter the dashboard password.</div>
          ${error ? `<div class="error">Wrong agent or password. Try again.</div>` : ""}
          <form method="POST" action="/login">
            <input type="hidden" name="next" value="${escapeHtml(next)}">
            <label>Your name</label>
            <select name="agent_name" required>
              <option value="">Choose your name</option>
              ${options}
            </select>
            <label>Password</label>
            <input name="password" type="password" placeholder="Password" required>
            <button type="submit">Log in</button>
          </form>
        </div>
      </div>
    </body>
    </html>
  `);
});

app.post("/login", async (req, res) => {
  const agentName = req.body.agent_name || "";
  const password = req.body.password || "";
  const next = req.body.next || "/call-wallboard";

  let validUser = false;
  try {
    const result = await pool.query(`SELECT id FROM app_users WHERE name = $1 AND active = TRUE`, [agentName]);
    validUser = result.rows.length > 0;
  } catch (err) {
    console.error("Login validation error:", err);
    validUser = agentNames.includes(agentName);
  }

  if (!validUser || password !== authSecret()) {
    return res.redirect(`/login?error=1&next=${encodeURIComponent(next)}`);
  }

  setSessionCookie(res, agentName);
  const safeNext = String(next || "");
  if (safeNext && safeNext !== "/" && safeNext !== "/call-wallboard" && safeNext !== "/start-shift") {
    return res.redirect(safeNext);
  }
  res.redirect("/start-shift");
});

app.get("/logout", (req, res) => {
  clearSessionCookie(res);
  res.redirect("/login");
});

app.get("/start-shift", async (req, res) => {
  try {
    const agentName = currentAgentName(req) || "there";

    const openUnassignedResult = await pool.query(`
      SELECT job_number, postcode, job_type, created_at
      FROM jobs
      WHERE status = 'open'
        AND assigned_technician_id IS NULL
      ORDER BY created_at ASC
      LIMIT 5
    `);

    const openUnassignedCount = await pool.query(`
      SELECT COUNT(*)::int AS count
      FROM jobs
      WHERE status = 'open'
        AND assigned_technician_id IS NULL
    `);

    const assignedResult = await pool.query(`
      SELECT j.job_number, j.postcode, j.job_type, j.created_at, t.name AS technician_name
      FROM jobs j
      LEFT JOIN technicians t ON t.id = j.assigned_technician_id
      WHERE j.status = 'assigned'
      ORDER BY j.created_at ASC
      LIMIT 5
    `);

    const assignedCount = await pool.query(`
      SELECT COUNT(*)::int AS count
      FROM jobs
      WHERE status = 'assigned'
    `);

    const paymentResult = await pool.query(`
      SELECT job_number, postcode, job_type, customer_name, status, final_value, created_at
      FROM jobs
      WHERE status IN ('awaiting_payment', 'invoiced_account')
      ORDER BY updated_at DESC NULLS LAST, created_at DESC
      LIMIT 5
    `);

    const paymentCount = await pool.query(`
      SELECT COUNT(*)::int AS count
      FROM jobs
      WHERE status IN ('awaiting_payment', 'invoiced_account')
    `);

    const todayRevenueResult = await pool.query(`
      SELECT
        COUNT(*)::int AS finished_count,
        COALESCE(SUM(COALESCE(final_value, 0)), 0)::numeric AS revenue,
        COALESCE(SUM(COALESCE(materials_cost, 0)), 0)::numeric AS material_cost
      FROM jobs
      WHERE created_at >= date_trunc('day', NOW())
        AND final_value IS NOT NULL
    `);

    const weekJobsResult = await pool.query(`
      SELECT COUNT(*)::int AS count
      FROM jobs
      WHERE created_at >= date_trunc('week', NOW())
    `);

    const missedTodayResult = await pool.query(`
      SELECT COUNT(*)::int AS count
      FROM calls
      WHERE start_time >= date_trunc('day', NOW())
        AND LOWER(COALESCE(call_type, '')) = 'inbound'
        AND COALESCE(answered_by, '') = ''
    `);

    const techResult = await pool.query(`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE LOWER(COALESCE(status, '')) LIKE '%available%' AND LOWER(COALESCE(status, '')) NOT LIKE '%soon%')::int AS available,
        COUNT(*) FILTER (WHERE LOWER(COALESCE(status, '')) LIKE '%job%')::int AS on_job,
        COUNT(*) FILTER (WHERE LOWER(COALESCE(status, '')) LIKE '%soon%')::int AS soon
      FROM technicians
      WHERE active = TRUE
    `);

    const openRows = openUnassignedResult.rows;
    const assignedRows = assignedResult.rows;
    const paymentRows = paymentResult.rows;
    const revenue = todayRevenueResult.rows[0] || {};
    const tech = techResult.rows[0] || {};

    const lineList = (rows, emptyText, formatter) => {
      if (!rows.length) return `<div class="brief-small">${escapeHtml(emptyText)}</div>`;
      return rows.map(formatter).join("");
    };

    const openList = lineList(openRows, "No unassigned open jobs.", job => `
      <div class="brief-line"><strong>${escapeHtml(job.postcode || job.job_number || 'Job')}</strong> — ${escapeHtml(job.job_type || 'Job')} · waiting to assign</div>
    `);

    const assignedList = lineList(assignedRows, "No assigned jobs waiting for completion.", job => `
      <div class="brief-line"><strong>${escapeHtml(job.postcode || job.job_number || 'Job')}</strong> — ${escapeHtml(job.job_type || 'Job')} · ${escapeHtml(job.technician_name || 'Technician assigned')}</div>
    `);

    const paymentList = lineList(paymentRows, "No payment or accounts items waiting.", job => `
      <div class="brief-line"><strong>${escapeHtml(job.postcode || job.job_number || 'Job')}</strong> — ${escapeHtml(jobStatusLabel(job.status))}${job.final_value !== null && job.final_value !== undefined ? ` · ${money(job.final_value)}` : ''}</div>
    `);

    const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hour: 'numeric', hour12: false }).format(new Date()));
    const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
    const todayLabel = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/London', weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
    }).format(new Date());

    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Start shift</title>
        <style>
          :root {
            --red: #d9462e;
            --green: #22a851;
            --amber: #f59e0b;
            --charcoal: #26323a;
            --muted: #637083;
            --bg: #f5f6f8;
            --border: #e5e7eb;
          }
          * { box-sizing: border-box; }
          body {
            margin: 0;
            min-height: 100vh;
            font-family: Arial, sans-serif;
            color: #1f2937;
            background:
              linear-gradient(rgba(17,24,39,0.68), rgba(17,24,39,0.68)),
              radial-gradient(circle at top left, rgba(34,168,81,0.14), transparent 34%),
              #1f2937;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 28px;
          }
          .brief-card {
            width: min(620px, 100%);
            background: white;
            border-radius: 24px;
            padding: 34px;
            box-shadow: 0 28px 90px rgba(0,0,0,0.36);
            border: 1px solid rgba(255,255,255,0.65);
          }
          .logo-row { display: flex; align-items: center; gap: 16px; margin-bottom: 14px; }
          .logo-row img { width: 78px; height: 78px; object-fit: contain; border-radius: 16px; background: #fff; }
          .brief-pill {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            background: #fee2e2;
            color: var(--red);
            border-radius: 999px;
            padding: 8px 14px;
            font-size: 12px;
            font-weight: 900;
            text-transform: uppercase;
            letter-spacing: 0.04em;
          }
          .brief-pill::before { content: ""; width: 8px; height: 8px; border-radius: 999px; background: var(--red); display: inline-block; }
          h1 { margin: 18px 0 6px; font-size: 31px; line-height: 1.1; letter-spacing: -0.02em; color: #1f2937; }
          .intro { color: var(--muted); margin: 0 0 24px; line-height: 1.45; }
          .brief-item {
            border-radius: 14px;
            padding: 15px 17px;
            margin: 12px 0;
            border-left: 5px solid;
          }
          .brief-red { background: #fde9e7; border-left-color: var(--red); }
          .brief-amber { background: #fff3e1; border-left-color: var(--amber); }
          .brief-green { background: #e7f7ed; border-left-color: var(--green); }
          .brief-title { font-weight: 900; margin-bottom: 7px; color: #1f2937; }
          .brief-line { color: #334155; font-size: 14px; line-height: 1.45; margin: 3px 0; }
          .brief-small { color: #64748b; font-size: 14px; }
          .start-button {
            display: flex;
            align-items: center;
            justify-content: center;
            margin-top: 26px;
            width: 100%;
            background: var(--red);
            color: white;
            border: 0;
            border-radius: 12px;
            padding: 16px 20px;
            text-decoration: none;
            font-weight: 900;
            box-shadow: 0 12px 26px rgba(217,70,46,0.22);
          }
          .secondary-link { display: block; text-align: center; margin-top: 14px; color: #64748b; font-size: 13px; text-decoration: none; }
          @media (max-width: 560px) {
            body { padding: 16px; align-items: flex-start; }
            .brief-card { padding: 24px; margin-top: 20px; }
            .logo-row { justify-content: center; }
            .logo-row img { width: 92px; height: 92px; }
            h1 { font-size: 26px; }
          }
        </style>
      </head>
      <body>
        <main class="brief-card">
          <div class="logo-row">
            <img src="/brand-logo.png" alt="Your Dispatch Partner" onerror="this.style.display='none';">
            <div>
              <div class="brief-pill">Operations briefing — ${escapeHtml(todayLabel)}</div>
              <h1>${escapeHtml(greeting)}, ${escapeHtml(agentName)}.</h1>
              <p class="intro">Here’s what needs attention before you start your shift.</p>
            </div>
          </div>

          <section class="brief-item brief-red">
            <div class="brief-title">${Number(openUnassignedCount.rows[0]?.count || 0)} open job${Number(openUnassignedCount.rows[0]?.count || 0) === 1 ? "" : "s"} waiting to be assigned</div>
            ${openList}
          </section>

          <section class="brief-item brief-amber">
            <div class="brief-title">${Number(assignedCount.rows[0]?.count || 0)} assigned job${Number(assignedCount.rows[0]?.count || 0) === 1 ? "" : "s"} awaiting completion</div>
            ${assignedList}
          </section>

          <section class="brief-item brief-amber">
            <div class="brief-title">${Number(paymentCount.rows[0]?.count || 0)} payment / accounts item${Number(paymentCount.rows[0]?.count || 0) === 1 ? "" : "s"} needing attention</div>
            ${paymentList}
          </section>

          <section class="brief-item brief-green">
            <div class="brief-title">Today’s revenue: ${money(revenue.revenue || 0)}</div>
            <div class="brief-line">${Number(revenue.finished_count || 0)} job${Number(revenue.finished_count || 0) === 1 ? "" : "s"} with value today · materials ${money(revenue.material_cost || 0)} · ${Number(weekJobsResult.rows[0]?.count || 0)} orders created this week</div>
            <div class="brief-line">Technicians: ${Number(tech.available || 0)} available · ${Number(tech.on_job || 0)} on job · ${Number(tech.soon || 0)} available soon · ${Number(missedTodayResult.rows[0]?.count || 0)} missed inbound call${Number(missedTodayResult.rows[0]?.count || 0) === 1 ? "" : "s"} today</div>
          </section>

          <a class="start-button" href="/call-wallboard">Start shift — enter portal</a>
          <a class="secondary-link" href="/jobs">Go straight to Dispatch Board</a>
        </main>
      </body>
      </html>
    `);
  } catch (error) {
    console.error("Start shift error:", error);
    res.redirect("/call-wallboard");
  }
});

app.get("/", (req, res) => res.redirect("/call-wallboard"));

app.get("/call-wallboard", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT *
      FROM calls
      WHERE start_time >= NOW() - INTERVAL '24 hours'
      ORDER BY start_time DESC
    `);

    const latestResult = await pool.query(`SELECT MAX(received_at) AS last_received FROM calls`);
    const recentCalls = result.rows;

    // Only inbound calls should count towards answered/missed call reporting.
    // This stops outgoing/internal calls with no answered_by value being treated as missed customer calls.
    const inboundCalls = recentCalls.filter(call => (call.call_type || "").toLowerCase() === "inbound");
    const answeredCalls = inboundCalls.filter(call => call.answered_by);
    const missedCalls = inboundCalls.filter(call => !call.answered_by);
    const reportableCalls = inboundCalls;

    const missedRate = reportableCalls.length ? Math.round((missedCalls.length / reportableCalls.length) * 100) : 0;

    let missedRateClass = "good";
    if (reportableCalls.length === 0) missedRateClass = "neutral";
    else if (missedRate >= 20) missedRateClass = "bad";
    else if (missedRate >= 10) missedRateClass = "soon";

    const lastReceived = latestResult.rows[0].last_received;
    const lastUpdatedText = lastReceived ? `Last call received: ${formatDateTimeWithSeconds(lastReceived)}` : "No calls received yet";
    const pageUpdatedText = `Page refreshed: ${formatDateTimeWithSeconds(new Date())}`;

    const wallboardAgents = await getWallboardAgents();
    const agentStats = {};
    Object.entries(wallboardAgents).forEach(([ext, name]) => {
      agentStats[ext] = { ext, name, answered: 0, totalDuration: 0, lastCallTime: null, status: "No active call" };
    });

    answeredCalls.forEach(call => {
      const ext = String(call.answered_by || "").trim();
      if (!wallboardAgents[ext]) return;
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
      }).join("");

    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Call wallboard</title>
        <meta http-equiv="refresh" content="5">
        <style>
          ${sharedStyles()}
          .updated { color: #6b7280; font-size: 16px; margin-bottom: 30px; font-weight: 600; }
          .cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin-bottom: 40px; }
          .card { background: #1f2937; border-radius: 14px; padding: 25px; border: 2px solid transparent; box-shadow: 0 14px 30px rgba(17, 24, 39, 0.12); }
          .card.good { border-color: #16a34a; }
          .card.soon { border-color: #f59e0b; }
          .card.bad { border-color: #dc2626; }
          .card.neutral { border-color: #94a3b8; }
          .label { color: #e5e7eb; font-size: 16px; font-weight: 700; }
          .value { color: #ffffff; font-size: 42px; font-weight: bold; margin-top: 10px; }
          .value.good { color: #22c55e; }
          .value.soon { color: #fbbf24; }
          .value.bad { color: #ef4444; }
          .value.neutral { color: white; }
          .card-link { color: inherit; text-decoration: none; display: block; }
          .card-link:hover { text-decoration: none; transform: translateY(-1px); }
          .card-link .card { cursor: pointer; }
        </style>
      </head>
      <body>
        ${nav(req)}
        <h1>Call wallboard</h1>
        <div class="subtitle">Rolling last 24 hours · Auto-refreshes every 5 seconds</div>
        <div class="updated">${lastUpdatedText} · ${pageUpdatedText}</div>
        <div class="cards">
          <div class="card"><div class="label">Total Calls</div><div class="value">${reportableCalls.length}</div></div>
          <div class="card"><div class="label">Answered</div><div class="value">${answeredCalls.length}</div></div>
          <div class="card"><div class="label">Missed</div><div class="value">${missedCalls.length}</div></div>
          <a class="card-link" href="/call-wallboard/missed-calls"><div class="card ${missedRateClass}"><div class="label">Miss Rate · click for details</div><div class="value ${missedRateClass}">${missedRate}%</div></div></a>
        </div>
        <table>
          <thead>
            <tr><th>Agent</th><th>Answered</th><th>Avg Duration</th><th>Last Call</th><th>Status</th></tr>
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

app.get("/call-wallboard/missed-calls", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT *
      FROM calls
      WHERE start_time >= NOW() - INTERVAL '24 hours'
      AND LOWER(COALESCE(call_type, '')) = 'inbound'
      AND COALESCE(answered_by, '') = ''
      ORDER BY start_time DESC
    `);

    const rows = result.rows.map(call => `
      <tr>
        <td>${formatDateTimeWithSeconds(call.start_time || call.received_at)}</td>
        <td><a href="tel:${escapeHtml(call.from_number || "")}">${escapeHtml(call.from_number || "—")}</a></td>
        <td>${escapeHtml(call.to_number || "—")}</td>
        <td>${escapeHtml(call.call_type || "—")}</td>
        <td>${escapeHtml(call.answer_type || "—")}</td>
        <td>${formatSeconds(Number(call.duration_seconds || 0))}</td>
        <td><code>${escapeHtml(call.uuid || "—")}</code></td>
      </tr>
    `).join("");

    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Missed Call Details</title>
        <style>${sharedStyles()}</style>
      </head>
      <body>
        ${nav(req)}
        <h1>Missed Call Details</h1>
        <div class="subtitle">Inbound customer calls missed in the last 24 hours. Internal and outgoing calls are excluded.</div>
        <div class="page-actions">
          <a class="action-button dark" href="/call-wallboard">Back to Call wallboard</a>
        </div>
        <table>
          <thead>
            <tr>
              <th>Time</th>
              <th>From</th>
              <th>To</th>
              <th>Type</th>
              <th>Answer type</th>
              <th>Duration</th>
              <th>UUID</th>
            </tr>
          </thead>
          <tbody>${rows || `<tr><td colspan="7">No missed inbound calls in the last 24 hours.</td></tr>`}</tbody>
        </table>
      </body>
      </html>
    `);
  } catch (error) {
    console.error("Missed calls error:", error);
    res.status(500).send("Missed calls error. Check Render logs.");
  }
});

app.get("/admin/users", async (req, res) => {
  try {
    const result = await pool.query(`SELECT * FROM app_users ORDER BY active DESC, name ASC`);

    const rows = result.rows.map(user => `
      <tr>
        <td>
          <div class="job-card-title">${escapeHtml(user.name)}</div>
          <div class="job-card-sub">Created ${formatDateTime(user.created_at)}<br>Last updated ${formatDateTime(user.updated_at)}</div>
        </td>
        <td>${escapeHtml(user.role || "dispatcher")}</td>
        <td>${escapeHtml(user.extension_number || "—")}</td>
        <td>${user.active ? `<span class="pill available">Active</span>` : `<span class="pill off">Removed</span>`}</td>
        <td>
          <div class="actions">
            <a href="/admin/users/${user.id}/edit">Edit</a>
            ${user.active ? `
              <form class="inline-form" method="POST" action="/admin/users/remove" onsubmit="return confirm('Remove this user from login?');">
                <input type="hidden" name="id" value="${user.id}">
                <button class="delete-button small-button" type="submit">Remove</button>
              </form>
            ` : `
              <form class="inline-form" method="POST" action="/admin/users/reactivate">
                <input type="hidden" name="id" value="${user.id}">
                <button class="small-button" type="submit">Reactivate</button>
              </form>
            `}
          </div>
        </td>
      </tr>
    `).join("");

    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Admin Manager - Users</title>
        <style>${sharedStyles()}</style>
      </head>
      <body>
        ${nav(req)}
        <h1>Admin Manager</h1>
        <div class="subtitle">Add, edit or remove portal users. This controls who appears on the login screen.</div>

        <div class="panel">
          <h2>Add new user</h2>
          <form method="POST" action="/admin/users/add">
            <div class="grid-4">
              <div>
                <label>Name</label>
                <input name="name" placeholder="e.g. Sarah" required>
              </div>
              <div>
                <label>Extension number</label>
                <input name="extension_number" placeholder="e.g. 1018">
              </div>
              <div>
                <label>Role</label>
                <select name="role">
                  <option value="dispatcher">Dispatcher</option>
                  <option value="manager">Manager</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div style="display:flex; align-items:end;">
                <button type="submit">Add user</button>
              </div>
            </div>
            <div class="help">The extension number connects this user to Yay call data. If Yay sends answered_by as this extension, their answered-call stats will appear on the Call wallboard.</div>
            <div class="help">For now, users still use the shared dashboard password. Proper individual passwords and reset links should be the next security upgrade.</div>
          </form>
        </div>

        <table>
          <thead><tr><th>User</th><th>Role</th><th>Extension</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </body>
      </html>
    `);
  } catch (error) {
    console.error("Admin users error:", error);
    res.status(500).send("Admin users error. Check Render logs.");
  }
});

app.get("/admin/users/:id/edit", async (req, res) => {
  try {
    const result = await pool.query(`SELECT * FROM app_users WHERE id = $1`, [req.params.id]);
    const user = result.rows[0];
    if (!user) return res.status(404).send("User not found");

    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Edit User</title>
        <style>${sharedStyles()}</style>
      </head>
      <body>
        ${nav(req)}
        <h1>Edit User</h1>
        <div class="subtitle">Update this user's display name, role and active status.</div>

        <div class="panel">
          <form method="POST" action="/admin/users/${user.id}/edit">
            <div class="grid-4">
              <div>
                <label>Name</label>
                <input name="name" value="${escapeHtml(user.name)}" required>
              </div>
              <div>
                <label>Extension number</label>
                <input name="extension_number" value="${escapeHtml(user.extension_number || "")}" placeholder="e.g. 1018">
              </div>
              <div>
                <label>Role</label>
                <select name="role">
                  <option value="dispatcher" ${user.role === "dispatcher" ? "selected" : ""}>Dispatcher</option>
                  <option value="manager" ${user.role === "manager" ? "selected" : ""}>Manager</option>
                  <option value="admin" ${user.role === "admin" ? "selected" : ""}>Admin</option>
                </select>
              </div>
              <div>
                <label>Status</label>
                <select name="active">
                  <option value="true" ${user.active ? "selected" : ""}>Active</option>
                  <option value="false" ${!user.active ? "selected" : ""}>Removed</option>
                </select>
              </div>
            </div>
            <div class="help">The extension number links this user to Call wallboard stats.</div>
            <br>
            <button type="submit">Save changes</button>
            <a href="/admin/users" style="margin-left:12px;">Cancel</a>
          </form>
        </div>
      </body>
      </html>
    `);
  } catch (error) {
    console.error("Edit user page error:", error);
    res.status(500).send("Edit user page error. Check Render logs.");
  }
});

app.post("/admin/users/:id/edit", async (req, res) => {
  try {
    const name = (req.body.name || "").trim();
    const role = req.body.role || "dispatcher";
    const extensionNumber = (req.body.extension_number || "").trim();
    const active = req.body.active === "true";
    if (!name) return res.redirect(`/admin/users/${req.params.id}/edit`);

    await pool.query(`
      UPDATE app_users
      SET name = $1, role = $2, extension_number = NULLIF($3, ''), active = $4, updated_at = NOW()
      WHERE id = $5
    `, [name, role, extensionNumber, active, req.params.id]);

    res.redirect("/admin/users");
  } catch (error) {
    console.error("Edit user error:", error);
    res.status(500).send("Edit user error. The name may already exist. Check Render logs.");
  }
});

app.post("/admin/users/add", async (req, res) => {
  try {
    const name = (req.body.name || "").trim();
    const role = req.body.role || "dispatcher";
    const extensionNumber = (req.body.extension_number || "").trim();
    if (!name) return res.redirect("/admin/users");

    await pool.query(`
      INSERT INTO app_users (name, role, extension_number, active, created_at, updated_at)
      VALUES ($1, $2, NULLIF($3, ''), TRUE, NOW(), NOW())
      ON CONFLICT (name) DO UPDATE SET
        role = EXCLUDED.role,
        extension_number = EXCLUDED.extension_number,
        active = TRUE,
        updated_at = NOW()
    `, [name, role, extensionNumber]);

    res.redirect("/admin/users");
  } catch (error) {
    console.error("Add user error:", error);
    res.status(500).send("Add user error. Check Render logs.");
  }
});

app.post("/admin/users/remove", async (req, res) => {
  try {
    await pool.query(`UPDATE app_users SET active = FALSE, updated_at = NOW() WHERE id = $1`, [req.body.id]);
    res.redirect("/admin/users");
  } catch (error) {
    console.error("Remove user error:", error);
    res.status(500).send("Remove user error. Check Render logs.");
  }
});

app.post("/admin/users/reactivate", async (req, res) => {
  try {
    await pool.query(`UPDATE app_users SET active = TRUE, updated_at = NOW() WHERE id = $1`, [req.body.id]);
    res.redirect("/admin/users");
  } catch (error) {
    console.error("Reactivate user error:", error);
    res.status(500).send("Reactivate user error. Check Render logs.");
  }
});

app.get("/invoice-items", async (req, res) => {
  try {
    const result = await pool.query(`SELECT * FROM invoice_items ORDER BY active DESC, sort_order ASC, description ASC`);

    const rows = result.rows.map(item => `
      <tr>
        <form method="POST" action="/invoice-items/save">
          <input type="hidden" name="id" value="${item.id}">
          <td><input name="description" value="${escapeHtml(item.description)}" required style="width:95%;"></td>
          <td><input name="default_price" value="${Number(item.default_price || 0).toFixed(2)}" style="width:90px;"></td>
          <td><input name="sort_order" value="${item.sort_order || 100}" style="width:70px;"></td>
          <td>
            <select name="active">
              <option value="true" ${item.active ? "selected" : ""}>Active</option>
              <option value="false" ${!item.active ? "selected" : ""}>Hidden</option>
            </select>
          </td>
          <td><button class="small-button" type="submit">Save</button></td>
        </form>
      </tr>
    `).join("");

    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Invoice Items</title>
        <style>
          ${sharedStyles()}
          .add-grid { display: grid; grid-template-columns: 3fr 1fr 1fr 1fr; gap: 12px; }
        </style>
      </head>
      <body>
        ${nav(req)}
        <h1>Invoice Items</h1>
        <div class="subtitle">Edit the dropdown lines used when generating invoices.</div>
        <div class="panel">
          <h2>Add New Invoice Item</h2>
          <form class="add-grid" method="POST" action="/invoice-items/save">
            <input name="description" placeholder="Description e.g. Supply of lock" required>
            <input name="default_price" placeholder="Default price" value="0.00">
            <input name="sort_order" placeholder="Sort" value="100">
            <button type="submit">Add Item</button>
          </form>
          <div class="help">Hidden items stay in old invoices but disappear from the new invoice dropdown.</div>
        </div>
        <table>
          <thead>
            <tr><th>Description</th><th>Default Price</th><th>Sort</th><th>Status</th><th>Save</th></tr>
          </thead>
          <tbody>${rows || `<tr><td colspan="5">No invoice items found</td></tr>`}</tbody>
        </table>
      </body>
      </html>
    `);
  } catch (error) {
    console.error("Invoice items page error:", error);
    res.status(500).send("Invoice items page error. Check Render logs.");
  }
});

app.post("/invoice-items/save", async (req, res) => {
  try {
    const id = req.body.id || "";
    const description = req.body.description || "";
    const defaultPrice = Number(req.body.default_price || 0);
    const sortOrder = Number(req.body.sort_order || 100);
    const active = req.body.active === "false" ? false : true;

    if (id) {
      await pool.query(`
        UPDATE invoice_items
        SET description = $1, default_price = $2, sort_order = $3, active = $4, updated_at = NOW()
        WHERE id = $5
      `, [description, defaultPrice, sortOrder, active, id]);
    } else {
      await pool.query(`
        INSERT INTO invoice_items (description, default_price, sort_order, active, created_at, updated_at)
        VALUES ($1, $2, $3, TRUE, NOW(), NOW())
      `, [description, defaultPrice, sortOrder]);
    }

    res.redirect("/invoice-items");
  } catch (error) {
    console.error("Save invoice item error:", error);
    res.status(500).send("Save invoice item error. Check Render logs.");
  }
});

app.get("/invoice-templates", async (req, res) => {
  try {
    const result = await pool.query(`SELECT * FROM invoice_templates ORDER BY active DESC, sort_order ASC, template_name ASC`);

    const rows = result.rows.map(template => `
      <tr>
        <form method="POST" action="/invoice-templates/save">
          <input type="hidden" name="id" value="${template.id}">
          <td><input name="template_name" value="${escapeHtml(template.template_name)}" required style="width:95%;"></td>
          <td><input name="customer_name" value="${escapeHtml(template.customer_name)}" required style="width:95%;"></td>
          <td><textarea name="customer_address" style="width:95%; min-height:70px;">${escapeHtml(template.customer_address)}</textarea></td>
          <td><input name="customer_postcode" value="${escapeHtml(template.customer_postcode)}" style="width:95%;"></td>
          <td><input name="sort_order" value="${template.sort_order || 100}" style="width:65px;"></td>
          <td>
            <select name="active">
              <option value="true" ${template.active ? "selected" : ""}>Active</option>
              <option value="false" ${!template.active ? "selected" : ""}>Hidden</option>
            </select>
          </td>
          <td><button class="small-button" type="submit">Save</button></td>
        </form>
      </tr>
    `).join("");

    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Account Templates</title>
        <style>
          ${sharedStyles()}
          .add-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
          textarea { min-height: 80px; }
        </style>
      </head>
      <body>
        ${nav(req)}
        <h1>Account Templates</h1>
        <div class="subtitle">Add and edit property management/account invoice address templates.</div>
        <div class="panel">
          <h2>Add New Account Template</h2>
          <form class="add-grid" method="POST" action="/invoice-templates/save">
            <input name="template_name" placeholder="Template name e.g. Property Account" required>
            <input name="customer_name" placeholder="Invoice name / company" required>
            <textarea name="customer_address" placeholder="Invoice address"></textarea>
            <input name="customer_postcode" placeholder="Invoice postcode">
            <input name="sort_order" placeholder="Sort order" value="100">
            <button type="submit">Add Template</button>
          </form>
          <div class="help">Templates auto-fill the invoice address. The site address can still be different.</div>
        </div>
        <table>
          <thead>
            <tr><th>Template</th><th>Invoice Name</th><th>Address</th><th>Postcode</th><th>Sort</th><th>Status</th><th>Save</th></tr>
          </thead>
          <tbody>${rows || `<tr><td colspan="7">No account templates found</td></tr>`}</tbody>
        </table>
      </body>
      </html>
    `);
  } catch (error) {
    console.error("Invoice templates page error:", error);
    res.status(500).send("Invoice templates page error. Check Render logs.");
  }
});

app.post("/invoice-templates/save", async (req, res) => {
  try {
    const id = req.body.id || "";
    const templateName = req.body.template_name || "";
    const customerName = req.body.customer_name || "";
    const customerAddress = req.body.customer_address || "";
    const customerPostcode = req.body.customer_postcode || "";
    const sortOrder = Number(req.body.sort_order || 100);
    const active = req.body.active === "false" ? false : true;

    if (id) {
      await pool.query(`
        UPDATE invoice_templates
        SET template_name = $1, customer_name = $2, customer_address = $3,
            customer_postcode = $4, sort_order = $5, active = $6, updated_at = NOW()
        WHERE id = $7
      `, [templateName, customerName, customerAddress, customerPostcode, sortOrder, active, id]);
    } else {
      await pool.query(`
        INSERT INTO invoice_templates (
          template_name, customer_name, customer_address, customer_postcode,
          sort_order, active, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, TRUE, NOW(), NOW())
      `, [templateName, customerName, customerAddress, customerPostcode, sortOrder]);
    }

    res.redirect("/invoice-templates");
  } catch (error) {
    console.error("Save invoice template error:", error);
    res.status(500).send("Save invoice template error. Check Render logs.");
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
      <head><title>Invoices</title><style>${sharedStyles()}</style></head>
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
            <tr><th>Invoice</th><th>Customer / Site</th><th>Company / Payment</th><th>Date / Total</th><th>Stage</th><th>Actions</th></tr>
          </thead>
          <tbody>${rows || `<tr><td colspan="6">No active invoices waiting to be sent</td></tr>`}</tbody>
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
      <head><title>Historic Invoices</title><style>${sharedStyles()}</style></head>
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
            <tr><th>Invoice</th><th>Customer / Site</th><th>Company / Payment</th><th>Date / Total</th><th>Stage</th><th>Actions</th></tr>
          </thead>
          <tbody>${rows || `<tr><td colspan="6">No historic invoices found</td></tr>`}</tbody>
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
          .danger-panel { max-width: 680px; background: #1f2937; border: 1px solid #dc2626; border-radius: 16px; padding: 28px; }
          .button-row { display: flex; gap: 12px; margin-top: 22px; }
          .button-row form { margin: 0; }
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
            <form method="POST" action="/invoices/${invoice.id}/delete"><button class="delete-button" type="submit">Yes, delete invoice</button></form>
            <form method="GET" action="/invoices"><button class="cancel-button" type="submit">Cancel</button></form>
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

app.get("/invoices/new", async (req, res) => {
  try {
    const today = new Date().toLocaleDateString("en-GB", {
      timeZone: "Europe/London",
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    });

    const agentName = currentAgentName(req);

    const itemResult = await pool.query(`
      SELECT *
      FROM invoice_items
      WHERE active = TRUE
      ORDER BY sort_order ASC, description ASC
    `);

    const templateResult = await pool.query(`
      SELECT *
      FROM invoice_templates
      WHERE active = TRUE
      ORDER BY sort_order ASC, template_name ASC
    `);

    const itemOptions = itemResult.rows.map(item => {
      return `<option value="${item.id}" data-description="${escapeHtml(item.description)}" data-price="${Number(item.default_price || 0).toFixed(2)}">${escapeHtml(item.description)} — ${money(item.default_price)}</option>`;
    }).join("");

    const templateOptions = templateResult.rows.map(template => {
      return `<option value="${template.id}" data-name="${escapeHtml(template.customer_name)}" data-address="${escapeHtml(template.customer_address)}" data-postcode="${escapeHtml(template.customer_postcode)}">${escapeHtml(template.template_name)}</option>`;
    }).join("");

    function lineBlock(number) {
      return `
        <div class="line-block">
          <div class="line-grid">
            <select name="line${number}_item_id" onchange="fillInvoiceLine(${number}, this)">
              <option value="">Choose invoice line</option>
              ${itemOptions}
            </select>
            <input name="line${number}_qty" value="${number <= 2 ? "1" : ""}" placeholder="Qty">
            <input name="line${number}_unit_price" placeholder="Unit price">
          </div>
          <input class="description-input" name="line${number}_description" placeholder="Description appears on invoice">
        </div>
      `;
    }

    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>New Invoice</title>
        <style>
          ${sharedStyles()}
          textarea { min-height: 90px; }
          .line-block { margin-bottom: 18px; padding-bottom: 18px; border-bottom: 1px solid #374151; }
          .line-grid { display: grid; grid-template-columns: 1fr 90px 140px; gap: 12px; margin-bottom: 10px; }
          .description-input { width: 100%; box-sizing: border-box; }
          .notice { background: #1f2937; border-left: 5px solid #f59e0b; border-radius: 10px; padding: 18px; margin-bottom: 25px; color: #d1d5db; }
          .rule-box { display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin-top: 15px; }
          .rule { background: #111827; border-radius: 10px; padding: 15px; border: 1px solid #374151; }
          #site-fields { margin-top: 18px; }
          .account-row { display: grid; grid-template-columns: 2fr 1fr; gap: 15px; align-items: center; }
        </style>

        <script>
          function toggleSiteAddress() {
            const checkbox = document.getElementById("site_same_as_invoice");
            const siteFields = document.getElementById("site-fields");
            siteFields.style.display = checkbox.checked ? "none" : "block";
          }

          function fillInvoiceLine(number, select) {
            const selected = select.options[select.selectedIndex];
            const description = selected.getAttribute("data-description") || "";
            const price = selected.getAttribute("data-price") || "";

            const descriptionInput = document.querySelector("[name='line" + number + "_description']");
            const priceInput = document.querySelector("[name='line" + number + "_unit_price']");
            const qtyInput = document.querySelector("[name='line" + number + "_qty']");

            if (descriptionInput && description) descriptionInput.value = description;
            if (priceInput && price) priceInput.value = price;
            if (qtyInput && !qtyInput.value) qtyInput.value = "1";
          }

          function fillTemplate(select) {
            const selected = select.options[select.selectedIndex];
            if (!selected || !selected.value) return;

            document.querySelector("[name='customer_name']").value = selected.getAttribute("data-name") || "";
            document.querySelector("[name='customer_address']").value = selected.getAttribute("data-address") || "";
            document.querySelector("[name='customer_postcode']").value = selected.getAttribute("data-postcode") || "";

            document.getElementById("site_same_as_invoice").checked = false;
            toggleSiteAddress();
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
            <div class="rule"><strong>24H Locksmiths Ltd</strong><br>Bank transfer or Cash only</div>
            <div class="rule"><strong>24H Online Services Ltd</strong><br>Card or Cash only</div>
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
              <select name="invoice_stage" required>${invoiceStageOptions("Draft only")}</select>
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
            <h2>Account Template / Invoice Address</h2>

            <div class="account-row">
              <select name="invoice_template_id" onchange="fillTemplate(this)">
                <option value="">Normal customer / no template</option>
                ${templateOptions}
              </select>
              <a href="/invoice-templates">Edit account templates</a>
            </div>

            <br>

            <div class="grid-2">
              <input name="customer_name" placeholder="Customer / invoice name" required>
              <input name="customer_postcode" placeholder="Invoice postcode">
            </div>

            <br>

            <textarea name="customer_address" placeholder="Invoice address"></textarea>

            <label class="checkbox-row">
              <input id="site_same_as_invoice" name="site_same_as_invoice" type="checkbox" value="yes" checked onchange="toggleSiteAddress()">
              Site address same as invoice address
            </label>

            <div id="site-fields">
              <h2>Site Address</h2>
              <div class="help">Use this if the job location is different from the invoice/account address.</div>
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
            <div class="help">Pick a dropdown line, then adjust qty or price if needed. Use Other for custom lines.</div>
            <br>
            ${lineBlock(1)}
            ${lineBlock(2)}
            ${lineBlock(3)}
            ${lineBlock(4)}
            ${lineBlock(5)}
            <a href="/invoice-items">Edit invoice dropdown lines</a>
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
  } catch (error) {
    console.error("New invoice page error:", error);
    res.status(500).send("New invoice page error. Check Render logs.");
  }
});

app.post("/invoices/create", async (req, res) => {
  try {
    const companyKey = req.body.company_key;
    const paymentMethod = req.body.payment_method;
    const dispatcherName = currentAgentName(req);

    if (!companies[companyKey]) return res.status(400).send("Invalid company selected.");

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

    const lineItems = [];

    for (let i = 1; i <= 5; i += 1) {
      const description = (req.body[`line${i}_description`] || "").trim();
      const qty = Number(req.body[`line${i}_qty`] || 0);
      const unitPrice = Number(req.body[`line${i}_unit_price`] || 0);

      if (description && qty > 0) {
        lineItems.push({ description, qty, unitPrice });
      }
    }

    const subtotal = lineItems.reduce((sum, item) => sum + item.qty * item.unitPrice, 0);
    const vatAmount = subtotal * 0.2;
    const total = subtotal + vatAmount;

    const result = await pool.query(`
      INSERT INTO invoices (
        invoice_number, company_key, payment_method, dispatcher_name, invoice_stage,
        stage_updated_by, stage_updated_at, customer_name, customer_address,
        customer_postcode, site_same_as_invoice, site_address, site_postcode,
        customer_email, invoice_date, locksmith_name, paid_status, line_items,
        subtotal, vat_amount, total, notes, updated_at
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
    res.setHeader("Content-Disposition", `inline; filename="invoice-${invoice.invoice_number}.pdf"`);

    const doc = new PDFDocument({ size: "A4", margin: 50 });
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
      .text(pdfText(invoice.customer_address), 65, 233, { width: 190, height: 40 })
      .text(`Postcode: ${pdfText(invoice.customer_postcode)}`, 65, 276, { width: 190 });

    doc.roundedRect(305, 185, 240, 110, 8).stroke();
    doc.fontSize(11).font("Helvetica-Bold").text("Site Address", 320, 197);

    doc.font("Helvetica").fontSize(9.5)
      .text(siteSameAsInvoice ? "Same as invoice address" : pdfText(siteAddress), 320, 217, { width: 190, height: 56 })
      .text(`Postcode: ${pdfText(sitePostcode)}`, 320, 276, { width: 190 });

    doc.roundedRect(50, 310, 495, 52, 8).stroke();
    doc.fontSize(11).font("Helvetica-Bold").text("Invoice Details", 65, 322);

    doc.font("Helvetica").fontSize(10)
      .text(`Payment: ${pdfText(invoice.payment_method)}`, 65, 342)
      .text(`Status: ${pdfText(invoice.paid_status)}`, 250, 342);

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

      doc.font("Helvetica-Bold").text(company.name, 70, paymentBoxY + 55, { width: 220 });

      doc.font("Helvetica")
        .text(`Sort code: ${company.sortCode}`, 70, paymentBoxY + 73)
        .text(`Account: ${company.account}`, 70, paymentBoxY + 88);
    } else if (invoice.payment_method === "Card") {
      doc.font("Helvetica").fontSize(10)
        .text("Payment method: Card", 70, paymentBoxY + 34)
        .text("Please use the card payment link provided separately.", 70, paymentBoxY + 55, { width: 210 });
    } else {
      doc.font("Helvetica").fontSize(10)
        .text("Payment method: Cash", 70, paymentBoxY + 34)
        .text("Cash payment to be collected/confirmed by the office.", 70, paymentBoxY + 55, { width: 210 });
    }

    doc.roundedRect(330, paymentBoxY, 215, 105, 8).stroke();
    doc.font("Helvetica-Bold").fontSize(10).text("Notes", 350, paymentBoxY + 15);

    doc.font("Helvetica").fontSize(9.5).text(
      pdfText(invoice.notes || "6 months warranty on parts fitted"),
      350,
      paymentBoxY + 35,
      { width: 175, height: 55 }
    );

    doc.font("Helvetica-Bold").fontSize(10).text(company.name, 50, 718, { align: "center", width: 495 });

    doc.font("Helvetica").fontSize(9)
      .text(company.footer, 50, 733, { align: "center", width: 495 })
      .text(`REG: ${company.reg}    VAT NO: ${company.vat}`, 50, 748, { align: "center", width: 495 });

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

/* Existing dispatch, reports and technician routes are preserved below in compact form. */

function reportPeriodLinks(selectedRange) {
  const periods = [
    { value: "today", label: "Today" },
    { value: "this_week", label: "This week" },
    { value: "this_month", label: "This month" },
    { value: "custom", label: "Custom" }
  ];

  return periods.map(period => `
    <a class="action-button ${selectedRange === period.value ? "" : "dark"}" href="/reports?range=${period.value}">${period.label}</a>
  `).join("");
}

function miniMetric(title, value, hint = "") {
  return `
    <div class="panel">
      <div class="muted">${escapeHtml(title)}</div>
      <div class="big-total">${value}</div>
      ${hint ? `<div class="audit">${escapeHtml(hint)}</div>` : ""}
    </div>
  `;
}

async function jobCountSummary(start, end) {
  const result = await pool.query(`
    SELECT
      COUNT(*)::int AS total_jobs,
      COUNT(*) FILTER (WHERE status = 'open')::int AS open_jobs,
      COUNT(*) FILTER (WHERE status = 'assigned')::int AS assigned_jobs,
      COUNT(*) FILTER (WHERE status = 'completed')::int AS completed_jobs,
      COUNT(*) FILTER (WHERE status = 'awaiting_payment')::int AS awaiting_payment_jobs,
      COUNT(*) FILTER (WHERE status = 'fully_paid_private')::int AS fully_paid_private_jobs,
      COUNT(*) FILTER (WHERE status = 'invoiced_account')::int AS invoiced_account_jobs,
      COUNT(*) FILTER (WHERE status = 'closed')::int AS closed_jobs
    FROM jobs
    WHERE created_at >= $1
    AND created_at < $2
  `, [start, end]);
  return result.rows[0] || {};
}

async function revenueSummaryByTechnician(start, end) {
  const result = await pool.query(`
    SELECT
      COALESCE(t.name, 'Unassigned') AS technician_name,
      COUNT(j.id)::int AS job_count,
      COALESCE(SUM(COALESCE(j.final_value, 0)), 0)::numeric AS income,
      COALESCE(SUM(COALESCE(j.materials_cost, 0)), 0)::numeric AS material_cost
    FROM jobs j
    LEFT JOIN technicians t ON t.id = j.assigned_technician_id
    WHERE COALESCE(j.closed_at, j.updated_at, j.created_at) >= $1
    AND COALESCE(j.closed_at, j.updated_at, j.created_at) < $2
    AND (
      j.final_value IS NOT NULL
      OR j.materials_cost IS NOT NULL
      OR j.status IN ('fully_paid_private', 'invoiced_account', 'closed')
    )
    GROUP BY COALESCE(t.name, 'Unassigned')
    ORDER BY income DESC, technician_name ASC
  `, [start, end]);
  return result.rows;
}

function revenueTable(title, rows) {
  const totalIncome = rows.reduce((sum, row) => sum + Number(row.income || 0), 0);
  const totalMaterials = rows.reduce((sum, row) => sum + Number(row.material_cost || 0), 0);
  const body = rows.map(row => {
    const income = Number(row.income || 0);
    const materials = Number(row.material_cost || 0);
    return `
      <tr>
        <td><strong>${escapeHtml(row.technician_name || "Unassigned")}</strong></td>
        <td>${Number(row.job_count || 0)}</td>
        <td>${money(income)}</td>
        <td>${money(materials)}</td>
        <td><strong>${money(income - materials)}</strong></td>
      </tr>
    `;
  }).join("");

  return `
    <div class="panel">
      <h2>${escapeHtml(title)}</h2>
      <div class="grid-3">
        ${miniMetric("Income", money(totalIncome))}
        ${miniMetric("Material cost", money(totalMaterials))}
        ${miniMetric("Income after materials", money(totalIncome - totalMaterials))}
      </div>
      <table>
        <thead><tr><th>Technician</th><th>Jobs</th><th>Income</th><th>Material cost</th><th>Income after materials</th></tr></thead>
        <tbody>${body || `<tr><td colspan="5" class="muted">No revenue data for this period yet.</td></tr>`}</tbody>
      </table>
    </div>
  `;
}


app.get("/academy", (req, res) => {
  res.redirect("https://locksmith-academy-quiz.onrender.com/");
});

function campaignTypeOptions(selected = "Private") {
  return optionList([
    "Private",
    "Account",
    "Affiliate",
    "Subcontractor",
    "Online lead",
    "Referral",
    "Other"
  ], selected || "Private");
}

function campaignPaymentOptions(selected = "Unknown") {
  return optionList([
    "Unknown",
    "Cash",
    "Card",
    "Bank transfer",
    "Account"
  ], selected || "Unknown");
}

function campaignBadgeClass(type) {
  const value = String(type || "").toLowerCase();
  if (value.includes("account")) return "stage-approved";
  if (value.includes("affiliate") || value.includes("subcontractor")) return "stage-approval";
  if (value.includes("online")) return "stage-emailed";
  if (value.includes("referral")) return "stage-emailed-photos";
  return "stage-draft";
}

app.get("/campaigns", async (req, res) => {
  try {
    const search = (req.query.search || "").trim();
    const params = [];
    let where = "";
    if (search) {
      params.push(`%${search}%`);
      where = `WHERE name ILIKE $1 OR campaign_type ILIKE $1 OR notes ILIKE $1`;
    }

    const [campaignsResult, statsResult] = await Promise.all([
      pool.query(`
        SELECT *
        FROM campaigns
        ${where}
        ORDER BY active DESC, sort_order ASC, name ASC
      `, params),
      pool.query(`
        SELECT
          COALESCE(NULLIF(j.source_campaign, ''), 'Unknown') AS campaign,
          COUNT(*)::int AS job_count,
          COUNT(*) FILTER (WHERE j.status IN ('closed', 'fully_paid_private', 'invoiced_account', 'invoice_sent_accounts'))::int AS finished_jobs,
          COUNT(*) FILTER (WHERE j.status = 'awaiting_payment')::int AS awaiting_payment_jobs,
          COALESCE(SUM(COALESCE(j.final_value, 0)), 0)::numeric AS income,
          COALESCE(SUM(COALESCE(j.materials_cost, 0)), 0)::numeric AS material_cost,
          COALESCE(AVG(NULLIF(j.final_value, 0)), 0)::numeric AS average_job_value,
          MAX(j.created_at) AS last_job_at
        FROM jobs j
        GROUP BY COALESCE(NULLIF(j.source_campaign, ''), 'Unknown')
      `)
    ]);

    const statsByCampaign = Object.fromEntries(statsResult.rows.map(row => [row.campaign, row]));

    const rows = campaignsResult.rows.map(campaign => {
      const stats = statsByCampaign[campaign.name] || {};
      return `
        <tr>
          <td>
            <strong>${escapeHtml(campaign.name)}</strong><br>
            <span class="muted">Sort ${Number(campaign.sort_order || 100)}</span>
          </td>
          <td><span class="pill ${campaignBadgeClass(campaign.campaign_type)}">${escapeHtml(campaign.campaign_type || "Private")}</span></td>
          <td>${escapeHtml(campaign.default_payment_method || "Unknown")}</td>
          <td>${Number(campaign.commission_percentage || 0).toFixed(2)}%</td>
          <td>${campaign.active ? `<span class="pill stage-emailed">Active</span>` : `<span class="pill stage-cancelled">Hidden</span>`}</td>
          <td>
            <strong>${Number(stats.job_count || 0)}</strong><br>
            <span class="muted">Finished ${Number(stats.finished_jobs || 0)}</span>
          </td>
          <td>
            <strong>${money(stats.income || 0)}</strong><br>
            <span class="muted">Net ${money(Number(stats.income || 0) - Number(stats.material_cost || 0))}</span>
          </td>
          <td>${stats.last_job_at ? formatDateTime(stats.last_job_at) : "—"}</td>
          <td><a class="button secondary small" href="/campaigns/${campaign.id}/edit">Edit</a></td>
        </tr>
      `;
    }).join("");

    res.send(`
      <!DOCTYPE html>
      <html>
      <head><title>Campaigns</title><style>${sharedStyles()}</style></head>
      <body>
        ${nav(req)}
        <main class="app-main">
          <div class="topbar">
            <div>
              <h1>Campaigns</h1>
              <div class="subtitle">Manage job sources so dispatchers select clean campaign names and reports stay accurate.</div>
            </div>
          </div>

          <div class="panel">
            <h2>Add campaign / source</h2>
            <form method="POST" action="/campaigns/save" class="grid-4">
              <div><label>Name</label><input name="name" placeholder="e.g. Google Ads" required></div>
              <div><label>Type</label><select name="campaign_type">${campaignTypeOptions("Private")}</select></div>
              <div><label>Default payment</label><select name="default_payment_method">${campaignPaymentOptions("Unknown")}</select></div>
              <div><label>Commission / split %</label><input name="commission_percentage" value="0"></div>
              <div><label>Sort order</label><input name="sort_order" value="100"></div>
              <div><label>Status</label><select name="active"><option value="true">Active</option><option value="false">Hidden</option></select></div>
              <div style="grid-column: span 2;"><label>Notes</label><input name="notes" placeholder="Internal notes about this campaign/source"></div>
              <div style="display:flex;align-items:end;"><button type="submit">Add campaign</button></div>
            </form>
          </div>

          <div class="panel">
            <form method="GET" action="/campaigns" class="search-form">
              <input name="search" value="${escapeHtml(search)}" placeholder="Search campaigns, type or notes...">
              <button type="submit">Search</button>
              <a class="button secondary" href="/campaigns">Clear</a>
            </form>
          </div>

          <div class="panel">
            <h2>Campaign performance</h2>
            <table>
              <thead><tr><th>Campaign</th><th>Type</th><th>Default payment</th><th>Split</th><th>Status</th><th>Jobs</th><th>Income</th><th>Last job</th><th>Action</th></tr></thead>
              <tbody>${rows || `<tr><td colspan="9" class="muted">No campaigns found.</td></tr>`}</tbody>
            </table>
          </div>
        </main>
      </body>
      </html>
    `);
  } catch (error) {
    console.error("Campaigns page error:", error);
    res.status(500).send(`Campaigns page error: ${escapeHtml(error.message)}. Check Render logs.`);
  }
});

app.get("/campaigns/:id/edit", async (req, res) => {
  try {
    const result = await pool.query(`SELECT * FROM campaigns WHERE id = $1`, [req.params.id]);
    const campaign = result.rows[0];
    if (!campaign) return res.status(404).send("Campaign not found");

    res.send(`
      <!DOCTYPE html>
      <html>
      <head><title>Edit Campaign</title><style>${sharedStyles()}</style></head>
      <body>
        ${nav(req)}
        <main class="app-main">
          <h1>Edit Campaign</h1>
          <div class="subtitle">Update how this campaign/source appears in Create Order and reports.</div>
          <div class="panel">
            <form method="POST" action="/campaigns/save" class="grid-4">
              <input type="hidden" name="id" value="${campaign.id}">
              <div><label>Name</label><input name="name" value="${escapeHtml(campaign.name)}" required></div>
              <div><label>Type</label><select name="campaign_type">${campaignTypeOptions(campaign.campaign_type)}</select></div>
              <div><label>Default payment</label><select name="default_payment_method">${campaignPaymentOptions(campaign.default_payment_method)}</select></div>
              <div><label>Commission / split %</label><input name="commission_percentage" value="${Number(campaign.commission_percentage || 0).toFixed(2)}"></div>
              <div><label>Sort order</label><input name="sort_order" value="${Number(campaign.sort_order || 100)}"></div>
              <div><label>Status</label><select name="active"><option value="true" ${campaign.active ? "selected" : ""}>Active</option><option value="false" ${!campaign.active ? "selected" : ""}>Hidden</option></select></div>
              <div style="grid-column: span 2;"><label>Notes</label><input name="notes" value="${escapeHtml(campaign.notes || "")}"></div>
              <div style="display:flex;align-items:end;gap:12px;"><button type="submit">Save campaign</button><a href="/campaigns">Cancel</a></div>
            </form>
          </div>
        </main>
      </body>
      </html>
    `);
  } catch (error) {
    console.error("Edit campaign error:", error);
    res.status(500).send(`Edit campaign error: ${escapeHtml(error.message)}. Check Render logs.`);
  }
});

app.post("/campaigns/save", async (req, res) => {
  try {
    const id = req.body.id || "";
    const name = (req.body.name || "").trim();
    const campaignType = req.body.campaign_type || "Private";
    const defaultPaymentMethod = req.body.default_payment_method || "Unknown";
    const commissionPercentage = Number(req.body.commission_percentage || 0) || 0;
    const sortOrder = Number(req.body.sort_order || 100) || 100;
    const active = req.body.active !== "false";
    const notes = req.body.notes || "";

    if (!name) return res.redirect("/campaigns");

    if (id) {
      await pool.query(`
        UPDATE campaigns
        SET name = $1, campaign_type = $2, default_payment_method = $3,
            commission_percentage = $4, sort_order = $5, active = $6,
            notes = $7, updated_at = NOW()
        WHERE id = $8
      `, [name, campaignType, defaultPaymentMethod, commissionPercentage, sortOrder, active, notes, id]);
    } else {
      await pool.query(`
        INSERT INTO campaigns (
          name, campaign_type, default_payment_method, commission_percentage,
          sort_order, active, notes, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
        ON CONFLICT (name) DO UPDATE SET
          campaign_type = EXCLUDED.campaign_type,
          default_payment_method = EXCLUDED.default_payment_method,
          commission_percentage = EXCLUDED.commission_percentage,
          sort_order = EXCLUDED.sort_order,
          active = TRUE,
          notes = EXCLUDED.notes,
          updated_at = NOW()
      `, [name, campaignType, defaultPaymentMethod, commissionPercentage, sortOrder, active, notes]);
    }

    res.redirect("/campaigns");
  } catch (error) {
    console.error("Save campaign error:", error);
    res.status(500).send(`Save campaign error: ${escapeHtml(error.message)}. Check Render logs.`);
  }
});


app.get("/reports", async (req, res) => {
  try {
    const nowParts = londonDateParts();
    const today = makeDate(nowParts.year, nowParts.month, nowParts.day);
    const dayRange = { label: "Today", start: today, end: addDays(today, 1) };
    const weekRange = { label: "This week", start: startOfWeekMonday(today), end: addDays(today, 1) };
    const monthRange = { label: "This month", start: makeDate(nowParts.year, nowParts.month, 1), end: addDays(today, 1) };
    const selectedRange = buildReportRange(req.query);

    const [dayCounts, weekCounts, monthCounts, selectedCounts, dayRevenue, weekRevenue, monthRevenue, selectedRevenue, campaignPerformance] = await Promise.all([
      jobCountSummary(dayRange.start, dayRange.end),
      jobCountSummary(weekRange.start, weekRange.end),
      jobCountSummary(monthRange.start, monthRange.end),
      jobCountSummary(selectedRange.start, selectedRange.end),
      revenueSummaryByTechnician(dayRange.start, dayRange.end),
      revenueSummaryByTechnician(weekRange.start, weekRange.end),
      revenueSummaryByTechnician(monthRange.start, monthRange.end),
      revenueSummaryByTechnician(selectedRange.start, selectedRange.end),
      pool.query(`
        SELECT
          COALESCE(NULLIF(j.source_campaign, ''), 'Unknown') AS campaign,
          COUNT(*)::int AS job_count,
          COUNT(*) FILTER (WHERE j.status IN ('closed', 'fully_paid_private', 'invoiced_account', 'invoice_sent_accounts'))::int AS finished_jobs,
          COALESCE(SUM(COALESCE(j.final_value, 0)), 0)::numeric AS income,
          COALESCE(SUM(COALESCE(j.materials_cost, 0)), 0)::numeric AS material_cost,
          COALESCE(AVG(NULLIF(j.final_value, 0)), 0)::numeric AS average_job_value,
          COUNT(*) FILTER (WHERE j.status = 'awaiting_payment')::int AS awaiting_payment_jobs
        FROM jobs j
        WHERE j.created_at >= $1 AND j.created_at < $2
        GROUP BY COALESCE(NULLIF(j.source_campaign, ''), 'Unknown')
        ORDER BY income DESC, job_count DESC, campaign ASC
      `, [selectedRange.start, selectedRange.end])
    ]);

    const countSummaryRow = (label, counts) => `
      <tr>
        <td><strong>${escapeHtml(label)}</strong></td>
        <td>${Number(counts.total_jobs || 0)}</td>
        <td>${Number(counts.open_jobs || 0)}</td>
        <td>${Number(counts.assigned_jobs || 0)}</td>
        <td>${Number(counts.completed_jobs || 0)}</td>
        <td>${Number(counts.awaiting_payment_jobs || 0)}</td>
        <td>${Number(counts.fully_paid_private_jobs || 0)}</td>
        <td>${Number(counts.invoiced_account_jobs || 0)}</td>
        <td>${Number(counts.closed_jobs || 0)}</td>
      </tr>
    `;

    res.send(`
      <!DOCTYPE html>
      <html>
      <head><title>Reports</title><style>${sharedStyles()}</style></head>
      <body>
        ${nav(req)}
        <h1>Reports</h1>
        <div class="subtitle">Job count and revenue reporting. Job counts are based on when the client order was created. Revenue uses the close/update date and final job value.</div>

        <div class="page-actions">
          ${reportPeriodLinks(selectedRange.range)}
          <a class="action-button amber" href="/reports/jobs.csv?range=${encodeURIComponent(selectedRange.range)}&from=${encodeURIComponent(selectedRange.fromValue)}&to=${encodeURIComponent(selectedRange.toValue)}">Download jobs CSV</a>
          <a class="action-button dark" href="/reports/invoices.csv">Invoices CSV</a>
          <a class="action-button dark" href="/reports/calls.csv">Calls CSV</a>
        </div>

        <div class="panel">
          <h2>Custom report range</h2>
          <form method="GET" action="/reports" class="grid-3">
            <input type="hidden" name="range" value="custom">
            <div>
              <label>From</label>
              <input type="date" name="from" value="${escapeHtml(selectedRange.fromValue)}">
            </div>
            <div>
              <label>To</label>
              <input type="date" name="to" value="${escapeHtml(selectedRange.toValue)}">
            </div>
            <div style="display:flex; align-items:end;">
              <button type="submit">Run custom report</button>
            </div>
          </form>
        </div>

        <div class="panel">
          <h2>Job count summary</h2>
          <table>
            <thead>
              <tr><th>Period</th><th>Total</th><th>Open</th><th>Assigned</th><th>Completed</th><th>Awaiting payment</th><th>Fully paid private</th><th>Invoiced account</th><th>Closed</th></tr>
            </thead>
            <tbody>
              ${countSummaryRow("Today", dayCounts)}
              ${countSummaryRow("This week", weekCounts)}
              ${countSummaryRow("This month", monthCounts)}
              ${selectedRange.range === "custom" ? countSummaryRow(selectedRange.label, selectedCounts) : ""}
            </tbody>
          </table>
        </div>

        ${revenueTable("Revenue by technician — Today", dayRevenue)}
        ${revenueTable("Revenue by technician — This week", weekRevenue)}
        ${revenueTable("Revenue by technician — This month", monthRevenue)}
        ${selectedRange.range === "custom" ? revenueTable(`Revenue by technician — ${selectedRange.label}`, selectedRevenue) : ""}

        <div class="panel">
          <h2>Campaign / source performance — ${escapeHtml(selectedRange.label)}</h2>
          <table>
            <thead><tr><th>Campaign</th><th>Jobs</th><th>Finished</th><th>Income</th><th>Materials</th><th>Net after materials</th><th>Average value</th><th>Awaiting payment</th></tr></thead>
            <tbody>
              ${campaignPerformance.rows.map(row => `
                <tr>
                  <td><strong>${escapeHtml(row.campaign || "Unknown")}</strong></td>
                  <td>${Number(row.job_count || 0)}</td>
                  <td>${Number(row.finished_jobs || 0)}</td>
                  <td>${money(row.income || 0)}</td>
                  <td>${money(row.material_cost || 0)}</td>
                  <td>${money(Number(row.income || 0) - Number(row.material_cost || 0))}</td>
                  <td>${money(row.average_job_value || 0)}</td>
                  <td>${Number(row.awaiting_payment_jobs || 0)}</td>
                </tr>
              `).join("") || `<tr><td colspan="8" class="muted">No campaign data for this range.</td></tr>`}
            </tbody>
          </table>
        </div>
      </body>
      </html>
    `);
  } catch (error) {
    console.error("Reports page error:", error);
    res.status(500).send("Reports page error. Check Render logs.");
  }
});

app.get("/reports/jobs.csv", async (req, res) => {
  try {
    const reportRange = buildReportRange(req.query);
    const result = await pool.query(`
      SELECT j.*, t.name AS technician_name
      FROM jobs j
      LEFT JOIN technicians t ON t.id = j.assigned_technician_id
      WHERE j.created_at >= $1
      AND j.created_at < $2
      ORDER BY j.created_at DESC
    `, [reportRange.start, reportRange.end]);

    const header = [
      "Job Number", "Created At", "Status", "Customer", "Phone", "Postcode",
      "Job Type", "Campaign", "Technician", "Starting Price", "Call Out Agreed", "Start Price Of Locks",
      "Final Job Value", "Payment Method", "Customer Paid", "Materials Used", "Material Cost", "Outcome"
    ];

    const lines = [header.map(csvValue).join(",")];

    result.rows.forEach(job => {
      lines.push([
        job.job_number || jobNumber(job.id),
        formatDateTime(job.created_at),
        jobStatusLabel(job.status),
        job.customer_name,
        job.customer_phone,
        job.postcode,
        job.job_type,
        job.source_campaign,
        job.technician_name,
        job.starting_price,
        job.call_out_agreed,
        job.start_price_locks,
        job.final_value,
        job.payment_method,
        job.customer_paid ? "Yes" : "No",
        job.materials_used,
        job.materials_cost,
        job.outcome
      ].map(csvValue).join(","));
    });

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="jobs-report-${reportRange.fromValue}-to-${reportRange.toValue}.csv"`);
    res.send(lines.join("\n"));
  } catch (error) {
    console.error("Jobs CSV error:", error);
    res.status(500).send("Jobs CSV error. Check Render logs.");
  }
});

app.get("/reports/invoices.csv", async (req, res) => {
  try {
    const reportRange = buildReportRange(req.query);
    const result = await pool.query(`
      SELECT *
      FROM invoices
      WHERE created_at >= $1
      AND created_at < $2
      ORDER BY created_at DESC
    `, [reportRange.start, reportRange.end]);

    const header = [
      "Invoice Number", "Created At", "Invoice Date", "Customer", "Customer Postcode",
      "Site Postcode", "Company", "Payment Method", "Paid Status", "Stage",
      "Dispatcher", "Subtotal", "VAT", "Total"
    ];

    const lines = [header.map(csvValue).join(",")];

    result.rows.forEach(invoice => {
      const company = companies[invoice.company_key] || {};
      const sitePostcode = invoice.site_same_as_invoice ? invoice.customer_postcode : invoice.site_postcode;

      lines.push([
        invoice.invoice_number,
        formatDateTime(invoice.created_at),
        invoice.invoice_date,
        invoice.customer_name,
        invoice.customer_postcode,
        sitePostcode,
        company.name || invoice.company_key,
        invoice.payment_method,
        invoice.paid_status,
        invoice.invoice_stage,
        invoice.dispatcher_name,
        invoice.subtotal,
        invoice.vat_amount,
        invoice.total
      ].map(csvValue).join(","));
    });

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="invoice-report-${reportRange.fromValue}-to-${reportRange.toValue}.csv"`);
    res.send(lines.join("\n"));
  } catch (error) {
    console.error("Invoice CSV error:", error);
    res.status(500).send("Invoice CSV error. Check Render logs.");
  }
});

app.get("/reports/calls.csv", async (req, res) => {
  try {
    const reportRange = buildReportRange(req.query);
    const result = await pool.query(`
      SELECT *
      FROM calls
      WHERE start_time >= $1
      AND start_time < $2
      ORDER BY start_time DESC
    `, [reportRange.start, reportRange.end]);

    const wallboardAgents = await getWallboardAgents();
    const header = ["Call Time", "From", "To", "Answered By Extension", "Answered By Agent", "Answer Type", "Duration Seconds", "Call Result"];
    const lines = [header.map(csvValue).join(",")];

    result.rows.forEach(call => {
      const agent = wallboardAgents[String(call.answered_by || "").trim()] || "";
      const resultText = call.answered_by && agent ? "Answered" : "Missed";

      lines.push([
        formatDateTimeWithSeconds(call.start_time),
        call.from_number,
        call.to_number,
        call.answered_by,
        agent,
        call.answer_type,
        call.duration_seconds,
        resultText
      ].map(csvValue).join(","));
    });

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="call-report-${reportRange.fromValue}-to-${reportRange.toValue}.csv"`);
    res.send(lines.join("\n"));
  } catch (error) {
    console.error("Calls CSV error:", error);
    res.status(500).send("Calls CSV error. Check Render logs.");
  }
});


app.get("/api/postcoder-addresses", async (req, res) => {
  try {
    const result = await lookupPostcoderAddresses(req.query.search || req.query.postcode || "");
    res.json(result);
  } catch (error) {
    console.error("Postcoder API route error:", error);
    res.status(500).json({ ok: false, addresses: [], error: "Address lookup failed. Check Render logs." });
  }
});


function technicianOptions(technicians, selectedId = "") {
  return technicians.map(tech => `<option value="${tech.id}" ${String(tech.id) === String(selectedId || "") ? "selected" : ""}>${escapeHtml(tech.name)}${tech.status ? ` — ${escapeHtml(tech.status)}` : ""}</option>`).join("");
}

function accountTemplateOptions(templates, selectedId = "") {
  return templates.map(template => `<option value="${template.id}" ${String(template.id) === String(selectedId || "") ? "selected" : ""}>${escapeHtml(template.template_name)}</option>`).join("");
}

function jobAddressBlock(job) {
  return [
    job.address_line_1,
    job.address_line_2,
    job.address_line_3,
    job.town,
    job.county,
    job.postcode
  ].filter(Boolean).map(escapeHtml).join("<br>");
}


function jobAddressPlain(job) {
  return [
    job.address_line_1,
    job.address_line_2,
    job.address_line_3,
    job.town,
    job.county,
    job.postcode
  ].filter(Boolean).join(", ");
}

function phoneHref(value) {
  const clean = String(value || "").replace(/[^0-9+]/g, "");
  return clean ? `tel:${clean}` : "#";
}

function jobTechnicianSummary(job) {
  const payerName = job.offsite_payment ? (job.bill_payer_name || "") : (job.customer_name || "");
  const payerPhone = job.offsite_payment ? (job.bill_payer_phone || "") : (job.customer_phone || "");
  return [
    `Name: ${job.customer_name || ""}`,
    `Address: ${jobAddressPlain(job)}`,
    `${job.job_type || "Job"} - ${job.job_description || ""}`,
    `Start price: ${money(job.starting_price || job.quoted_price || 0)}`,
    `Call out agreed: ${money(job.call_out_agreed || 0)}`,
    `Start price of parts: ${money(job.start_price_locks || 0)}`,
    `Bill payer - ${payerName || ""}${payerPhone ? ` ${payerPhone}` : ""}`,
    `ETA: ${job.eta || ""}`,
    `Telephone number: ${job.customer_phone || ""}`
  ].join("\n");
}

app.get("/jobs", async (req, res) => {
  try {
    const selectedStatus = (req.query.status || "active").trim();
    const selectedTechnician = (req.query.technician || "all").trim();
    const selectedCampaign = (req.query.campaign || "all").trim();
    const selectedDate = (req.query.date || "all").trim();
    const search = (req.query.search || "").trim();

    const where = [];
    const params = [];

    if (selectedStatus && selectedStatus !== "all" && selectedStatus !== "active") {
      params.push(selectedStatus);
      where.push(`j.status = $${params.length}`);
    } else if (selectedStatus === "active") {
      params.push(activeJobStatuses);
      where.push(`j.status = ANY($${params.length})`);
    }

    if (selectedTechnician && selectedTechnician !== "all") {
      params.push(Number(selectedTechnician));
      where.push(`j.assigned_technician_id = $${params.length}`);
    }

    if (selectedCampaign && selectedCampaign !== "all") {
      params.push(selectedCampaign);
      where.push(`COALESCE(j.source_campaign, '') = $${params.length}`);
    }

    if (selectedDate === "today") {
      where.push(`DATE(j.created_at) = CURRENT_DATE`);
    } else if (selectedDate === "yesterday") {
      where.push(`DATE(j.created_at) = CURRENT_DATE - INTERVAL '1 day'`);
    } else if (selectedDate === "week") {
      where.push(`j.created_at >= date_trunc('week', NOW())`);
    } else if (selectedDate === "month") {
      where.push(`j.created_at >= date_trunc('month', NOW())`);
    }

    if (search) {
      params.push(`%${search}%`);
      where.push(`(
        COALESCE(j.job_number, '') ILIKE $${params.length}
        OR COALESCE(j.customer_name, '') ILIKE $${params.length}
        OR COALESCE(j.customer_phone, '') ILIKE $${params.length}
        OR COALESCE(j.postcode, '') ILIKE $${params.length}
        OR COALESCE(j.address_line_1, '') ILIKE $${params.length}
        OR COALESCE(j.job_type, '') ILIKE $${params.length}
        OR COALESCE(j.source_campaign, '') ILIKE $${params.length}
      )`);
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const [jobsResult, countsResult, closedTodayResult, techniciansResult, campaignsResult, revenueResult, recentResult] = await Promise.all([
      pool.query(`
        SELECT j.*, t.name AS technician_name
        FROM jobs j
        LEFT JOIN technicians t ON t.id = j.assigned_technician_id
        ${whereSql}
        ORDER BY
          CASE j.status
            WHEN 'open' THEN 1
            WHEN 'assigned' THEN 2
            WHEN 'awaiting_payment' THEN 3
            WHEN 'invoiced_account' THEN 4
            WHEN 'closed' THEN 5
            ELSE 9
          END,
          j.created_at DESC
        LIMIT 300
      `, params),
      pool.query(`SELECT status, COUNT(*)::int AS count FROM jobs GROUP BY status`),
      pool.query(`SELECT COUNT(*)::int AS count FROM jobs WHERE status = 'closed' AND DATE(COALESCE(closed_at, updated_at, created_at)) = CURRENT_DATE`),
      pool.query(`SELECT id, name, status, priority, location_checked_in_at FROM technicians WHERE active = TRUE ORDER BY name ASC`),
      pool.query(`SELECT DISTINCT COALESCE(source_campaign, '') AS campaign FROM jobs WHERE COALESCE(source_campaign, '') <> '' ORDER BY campaign ASC LIMIT 80`),
      pool.query(`
        SELECT
          COALESCE(SUM(final_value), 0) AS income,
          COALESCE(SUM(materials_cost), 0) AS materials,
          COALESCE(SUM(final_value) FILTER (WHERE status = 'awaiting_payment'), 0) AS awaiting_payment,
          COUNT(*) FILTER (WHERE DATE(created_at) = CURRENT_DATE)::int AS created_today,
          COUNT(*) FILTER (WHERE status = 'closed' AND DATE(COALESCE(closed_at, updated_at, created_at)) = CURRENT_DATE)::int AS closed_today
        FROM jobs
        WHERE DATE(COALESCE(closed_at, updated_at, created_at)) = CURRENT_DATE
           OR DATE(created_at) = CURRENT_DATE
      `),
      pool.query(`
        SELECT j.id, j.job_number, j.status, j.postcode, j.job_type, j.customer_name, j.dispatcher_name, j.updated_at, j.created_at, t.name AS technician_name
        FROM jobs j
        LEFT JOIN technicians t ON t.id = j.assigned_technician_id
        ORDER BY COALESCE(j.updated_at, j.created_at) DESC
        LIMIT 8
      `)
    ]);

    const counts = Object.fromEntries(countsResult.rows.map(row => [row.status || "open", row.count]));
    const activeCount = activeJobStatuses.reduce((sum, status) => sum + Number(counts[status] || 0), 0);
    const closedToday = Number(closedTodayResult.rows[0]?.count || 0);
    const revenue = revenueResult.rows[0] || {};

    const statusFilterOptions = [
      { value: "active", label: `Active orders (${activeCount})` },
      { value: "all", label: "All orders" },
      ...jobStatuses.map(item => ({ value: item.value, label: `${item.label} (${counts[item.value] || 0})` }))
    ];

    const technicianOptions = [
      { value: "all", label: "All technicians" },
      ...techniciansResult.rows.map(tech => ({ value: String(tech.id), label: tech.name }))
    ];

    const campaignOptions = [
      { value: "all", label: "All campaigns" },
      ...campaignsResult.rows.map(row => ({ value: row.campaign, label: row.campaign }))
    ];

    const dateOptions = [
      { value: "all", label: "All dates" },
      { value: "today", label: "Today" },
      { value: "yesterday", label: "Yesterday" },
      { value: "week", label: "This week" },
      { value: "month", label: "This month" }
    ];

    const statusCards = [
      { label: "Job awaiting to be assigned", value: Number(counts.open || 0), className: "board-blue" },
      { label: "Assigned", value: Number(counts.assigned || 0), className: "board-green" },
      { label: "Awaiting payment", value: Number(counts.awaiting_payment || 0), className: "board-amber" },
      { label: "Invoice sent to Acc Dept", value: Number(counts.invoiced_account || 0), className: "board-pink" },
      { label: "Closed today", value: closedToday, className: "board-red" }
    ];

    function technicianBadgeClass(status) {
      const value = String(status || "").toLowerCase();
      if (value.includes("available") && !value.includes("soon")) return "tech-green";
      if (value.includes("soon") || value.includes("job")) return "tech-amber";
      if (value.includes("off") || value.includes("holiday") || value.includes("sick") || value.includes("issue") || value.includes("do not")) return "tech-red";
      return "tech-grey";
    }

    const technicianStrip = techniciansResult.rows.slice(0, 12).map(tech => `
      <div class="tech-chip">
        <span class="tech-dot ${technicianBadgeClass(tech.status)}"></span>
        <span class="tech-name">${escapeHtml(tech.name)}</span>
        <span class="tech-status">${escapeHtml(tech.status || "Unknown")}</span>
      </div>
    `).join("");

    const rows = jobsResult.rows.map(job => {
      const customerPhone = job.customer_phone ? `<a class="phone-link" href="${phoneHref(job.customer_phone)}">${escapeHtml(job.customer_phone)}</a>` : "";
      return `
        <tr>
          <td><span class="board-status ${jobStatusClass(job.status)}">${escapeHtml(jobStatusLabel(job.status))}</span></td>
          <td><strong>${escapeHtml(job.postcode || "—")}</strong><div class="small-muted">${escapeHtml(job.job_number || jobNumber(job.id))}</div></td>
          <td>${escapeHtml(job.job_type || "—")}</td>
          <td>${escapeHtml(job.source_campaign || "—")}</td>
          <td>${escapeHtml(job.technician_name || "Unassigned")}</td>
          <td>${escapeHtml(job.dispatcher_name || "Unknown")}</td>
          <td><strong>${escapeHtml(job.customer_name || "—")}</strong><div class="small-muted">${customerPhone}</div></td>
          <td>${formatDateTime(job.created_at)}</td>
          <td><a class="view-button" href="/jobs/${job.id}/edit">View</a></td>
        </tr>
      `;
    }).join("");

    const recentFeed = recentResult.rows.map(job => {
      const status = jobStatusLabel(job.status);
      const who = job.technician_name || job.dispatcher_name || "Office";
      return `
        <div class="feed-row">
          <span class="feed-dot ${jobStatusClass(job.status)}"></span>
          <div>
            <strong>${escapeHtml(who)}</strong> · ${escapeHtml(status)}
            <div class="small-muted">${escapeHtml(job.postcode || job.job_number || jobNumber(job.id))} ${job.job_type ? `· ${escapeHtml(job.job_type)}` : ""}</div>
          </div>
        </div>
      `;
    }).join("");

    const cardHtml = statusCards.map(card => `
      <a class="board-card ${card.className}" href="/jobs?status=${encodeURIComponent(card.label === "Closed today" ? "closed" : card.label === "Job awaiting to be assigned" ? "open" : card.label === "Invoice sent to Acc Dept" ? "invoiced_account" : card.label === "Awaiting payment" ? "awaiting_payment" : "assigned")}">
        <div class="board-card-label">${escapeHtml(card.label)}</div>
        <div class="board-card-number">${card.value}</div>
      </a>
    `).join("");

    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Dispatch Board</title>
        <style>
          ${sharedStyles()}
          .dispatch-board {
            width: 100%;
            max-width: 1680px;
            margin: 0 auto;
          }
          .board-topbar {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            gap: 20px;
            margin-bottom: 22px;
            padding-right: 4px;
          }
          .board-actions { display: flex; gap: 12px; align-items: center; flex: 0 0 auto; }
          .board-actions .primary-action { background: var(--brand-green-dark); color: white; padding: 14px 18px; border-radius: 14px; font-weight: 900; text-decoration: none; }
          .board-actions .secondary-action { background: var(--charcoal); color: white; padding: 14px 18px; border-radius: 14px; font-weight: 900; text-decoration: none; }
          .status-card-grid {
            display: grid;
            grid-template-columns: repeat(5, minmax(175px, 1fr));
            gap: 18px;
            margin: 22px 0 20px;
          }
          .board-card { position: relative; display: block; background: #fff; border: 1px solid #e5e7eb; border-radius: 20px; min-height: 110px; padding: 20px 20px 16px 24px; text-decoration: none; box-shadow: 0 12px 28px rgba(17,24,39,0.05); overflow: hidden; }
          .board-card:before { content: ""; position: absolute; left: 0; top: 0; bottom: 0; width: 8px; }
          .board-card:after { content: ""; position: absolute; right: -28px; top: -34px; width: 110px; height: 110px; border-radius: 999px; opacity: 0.10; }
          .board-card-label { color: #667085; font-size: 13px; font-weight: 900; text-transform: uppercase; letter-spacing: .04em; min-height: 34px; max-width: 160px; }
          .board-card-number { color: #111827; font-size: 40px; font-weight: 900; margin-top: 12px; }
          .board-blue:before, .board-blue:after { background: #2563eb; }
          .board-green:before, .board-green:after { background: #16a34a; }
          .board-red:before, .board-red:after { background: #dc2626; }
          .board-amber:before, .board-amber:after { background: #f59e0b; }
          .board-pink:before, .board-pink:after { background: #db2777; }
          .tech-strip { background: #fff; border: 1px solid #e5e7eb; border-radius: 20px; padding: 18px 20px; margin-bottom: 20px; box-shadow: 0 10px 24px rgba(17,24,39,0.04); }
          .tech-strip-title { color: #667085; font-size: 13px; font-weight: 900; text-transform: uppercase; letter-spacing: .04em; margin-bottom: 12px; }
          .tech-chip-row { display: flex; gap: 10px; flex-wrap: wrap; }
          .tech-chip { display: flex; align-items: center; gap: 8px; background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 999px; padding: 8px 12px; }
          .tech-dot { width: 11px; height: 11px; border-radius: 999px; display: inline-block; }
          .tech-green { background: #16a34a; }
          .tech-amber { background: #f59e0b; }
          .tech-red { background: #dc2626; }
          .tech-grey { background: #94a3b8; }
          .tech-name { color: #111827; font-size: 13px; font-weight: 900; }
          .tech-status { color: #64748b; font-size: 12px; }
          .board-filter-panel { background: #fff; border: 1px solid #e5e7eb; border-radius: 20px; padding: 18px; margin-bottom: 20px; box-shadow: 0 10px 24px rgba(17,24,39,0.04); }
          .board-filters { display: grid; grid-template-columns: minmax(320px, 2.2fr) minmax(165px, 1fr) minmax(165px, 1fr) minmax(165px, 1fr) minmax(150px, .9fr) auto; gap: 14px; align-items: center; }
          .board-filters input, .board-filters select { min-height: 44px; border: 1px solid #d1d5db; background: #f9fafb; color: #111827; border-radius: 12px; padding: 10px 12px; }
          .board-filters button { min-height: 44px; border-radius: 12px; padding: 10px 16px; background: #2563eb; }
          .board-content-grid { display: grid; grid-template-columns: minmax(760px, 1fr) minmax(330px, 370px); gap: 22px; align-items: start; }
          .orders-panel, .control-panel { background: #fff; border: 1px solid #e5e7eb; border-radius: 20px; box-shadow: 0 12px 28px rgba(17,24,39,0.05); overflow: hidden; }
          .panel-heading { padding: 18px 20px; border-bottom: 1px solid #eef0f3; display: flex; justify-content: space-between; align-items: center; }
          .panel-heading h2 { margin: 0; color: #111827; font-size: 21px; }
          .panel-heading .muted { font-size: 13px; }
          .dispatch-table { width: 100%; border-collapse: collapse; margin: 0; }
          .dispatch-table th { background: #f1f5f9; color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: .04em; padding: 13px 16px; }
          .dispatch-table td { padding: 14px 16px; border-bottom: 1px solid #eef0f3; color: #25313a; font-size: 14px; vertical-align: middle; }
          .dispatch-table tr:hover td { background: #f8fafc; }
          .board-status { display: inline-block; border-radius: 999px; padding: 6px 10px; color: white; font-size: 12px; font-weight: 900; white-space: nowrap; }
          .small-muted { color: #667085; font-size: 12px; line-height: 1.35; margin-top: 3px; }
          .phone-link { color: #2563eb; font-weight: 800; text-decoration: none; }
          .view-button { display: inline-block; background: var(--charcoal); color: white; border-radius: 10px; padding: 7px 12px; text-decoration: none; font-weight: 900; font-size: 12px; }
          .control-card { margin: 18px; padding: 16px; background: #f9fafb; border: 1px solid #eef0f3; border-radius: 16px; }
          .control-card-label { color: #667085; font-size: 13px; font-weight: 900; text-transform: uppercase; }
          .control-card-value { color: #111827; font-size: 28px; font-weight: 900; margin-top: 6px; }
          .control-card.green { border-left: 6px solid #16a34a; }
          .control-card.amber { border-left: 6px solid #f59e0b; }
          .control-card.red { border-left: 6px solid #dc2626; }
          .feed-row { display: flex; gap: 10px; padding: 12px 18px; border-top: 1px solid #eef0f3; color: #25313a; }
          .feed-dot { width: 10px; height: 10px; border-radius: 999px; margin-top: 5px; flex: 0 0 10px; }
          .feed-dot.job-open { background: #2563eb; }
          .feed-dot.job-assigned { background: #16a34a; }
          .feed-dot.job-awaiting-payment { background: #f59e0b; }
          .feed-dot.job-invoiced-account { background: #db2777; }
          .feed-dot.job-closed { background: #dc2626; }
          @media (max-width: 1500px) {
            .status-card-grid { grid-template-columns: repeat(3, minmax(175px, 1fr)); }
            .board-content-grid { grid-template-columns: minmax(0, 1fr) 330px; }
          }
          @media (max-width: 1200px) {
            .status-card-grid { grid-template-columns: repeat(2, minmax(150px, 1fr)); }
            .board-content-grid { grid-template-columns: 1fr; }
            .board-filters { grid-template-columns: 1fr; }
            .dispatch-table { display: block; overflow-x: auto; }
          }
        </style>
      </head>
      <body>
        ${nav(req)}
        <main class="dispatch-board">
          <div class="board-topbar">
            <div>
              <h1>Dispatch Board</h1>
              <div class="subtitle">Live client orders, technician status, payments and dispatch actions.</div>
            </div>
            <div class="board-actions">
              <a class="primary-action" href="/jobs/new">+ Create Order</a>
              <a class="secondary-action" href="/jobs">Refresh Board</a>
            </div>
          </div>

          <section class="status-card-grid">
            ${cardHtml}
          </section>

          <section class="tech-strip">
            <div class="tech-strip-title">Technician availability</div>
            <div class="tech-chip-row">${technicianStrip || `<span class="muted">No active technicians found.</span>`}</div>
          </section>

          <section class="board-filter-panel">
            <form method="GET" action="/jobs" class="board-filters">
              <input name="search" value="${escapeHtml(search)}" placeholder="Search order, phone, postcode, customer, category...">
              <select name="status">${optionList(statusFilterOptions, selectedStatus || "active")}</select>
              <select name="technician">${optionList(technicianOptions, selectedTechnician || "all")}</select>
              <select name="campaign">${optionList(campaignOptions, selectedCampaign || "all")}</select>
              <select name="date">${optionList(dateOptions, selectedDate || "all")}</select>
              <button type="submit">Apply</button>
            </form>
          </section>

          <section class="board-content-grid">
            <div class="orders-panel">
              <div class="panel-heading">
                <div>
                  <h2>Live client orders</h2>
                  <div class="muted">Showing ${jobsResult.rows.length} order${jobsResult.rows.length === 1 ? "" : "s"}</div>
                </div>
              </div>
              <table class="dispatch-table">
                <tr>
                  <th>Status</th>
                  <th>Postcode</th>
                  <th>Category</th>
                  <th>Campaign</th>
                  <th>Technician</th>
                  <th>Dispatcher</th>
                  <th>Customer</th>
                  <th>Created</th>
                  <th>Action</th>
                </tr>
                ${rows || `<tr><td colspan="9" class="muted">No orders found.</td></tr>`}
              </table>
            </div>

            <aside class="control-panel">
              <div class="panel-heading"><h2>Today's control panel</h2></div>
              <div class="control-card green">
                <div class="control-card-label">Income</div>
                <div class="control-card-value">${money(revenue.income || 0)}</div>
                <div class="small-muted">${Number(revenue.closed_today || 0)} closed today</div>
              </div>
              <div class="control-card amber">
                <div class="control-card-label">Materials</div>
                <div class="control-card-value">${money(revenue.materials || 0)}</div>
                <div class="small-muted">Recorded against closed/updated jobs today</div>
              </div>
              <div class="control-card red">
                <div class="control-card-label">Awaiting payment</div>
                <div class="control-card-value">${money(revenue.awaiting_payment || 0)}</div>
                <div class="small-muted">Orders currently marked awaiting payment</div>
              </div>
              <div class="panel-heading"><h2>Recent activity</h2></div>
              ${recentFeed || `<div class="feed-row"><span class="muted">No recent activity.</span></div>`}
            </aside>
          </section>
        </main>
      </body>
      </html>
    `);
  } catch (error) {
    console.error("Jobs page error:", error);
    res.status(500).send(`Dispatch Board error: ${escapeHtml(error.message || String(error))}. Check Render logs.`);
  }
});

app.get("/jobs/new", async (req, res) => {
  try {
    const search = (req.query.search || "").trim();
    let lookup = null;
    if (search) {
      try {
        lookup = await lookupPostcoderAddresses(search);
      } catch (error) {
        console.error("Job address lookup error:", error);
        lookup = { ok: false, addresses: [], error: "Address lookup failed. Check Render logs." };
      }
    }

    const addresses = lookup && lookup.ok && Array.isArray(lookup.addresses) ? lookup.addresses : [];
    const addressesJson = JSON.stringify(addresses).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");
    const addressOptions = addresses.map((address, index) => `<option value="${index}">${escapeHtml(address.summary || address.full_address || `Address ${index + 1}`)}</option>`).join("");

    const technicians = (await pool.query(`SELECT id, name, status FROM technicians WHERE active = TRUE ORDER BY name ASC`)).rows;
    const templates = (await pool.query(`SELECT id, template_name, customer_name, customer_address, customer_postcode FROM invoice_templates WHERE active = TRUE ORDER BY sort_order ASC, template_name ASC`)).rows;
    const templatesJson = JSON.stringify(templates).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");

    const statusMessage = !search
      ? "Enter a postcode, press Find address, then choose the address from the dropdown."
      : addresses.length
        ? `${addresses.length} address${addresses.length === 1 ? "" : "es"} found. Select the correct address from the dropdown.`
        : lookup && lookup.error
          ? lookup.error
          : "No addresses found. You can still type the address manually.";

    const categoryOptions = [
      "BAILIFF (COURT ORDERED)",
      "BIKE LOCK (FROM £75, 1HR ETA)",
      "DOOR FIX/ REPLACEMENT",
      "FIX LOCK",
      "FRESH INSTALLATION (LOCK ON BLANK DOOR)",
      "KEY BROKEN IN LOCK",
      "KEY SAFE INSTALLATION",
      "LOCK CHANGE",
      "LOCKED IN",
      "LOCKED OUT",
      "OPEN SAFE (FROM £120)",
      "QUOTE",
      "RECALL (UNDER WARRANTY)",
      "SPECIALIST"
    ];

    const campaignOptions = await getCampaignOptions("Unknown");

    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Create New Job</title>
        <style>
          ${sharedStyles()}
          body { background: #f3f4f6; }
          h1 { margin-bottom: 8px; }
          .order-shell {
            max-width: 1050px;
            margin: 0 auto 40px;
          }
          .order-panel {
            background: #ffffff;
            color: #111827;
            border: 1px solid #d1d5db;
            box-shadow: 0 12px 30px rgba(15, 23, 42, 0.08);
          }
          .order-title {
            padding: 18px 22px;
            border-bottom: 1px solid #e5e7eb;
            font-size: 18px;
            font-weight: 800;
            color: #111827;
          }
          .order-body { padding: 22px; }
          .section-title {
            margin: 26px 0 14px;
            padding-bottom: 8px;
            border-bottom: 1px solid #d1d5db;
            color: #111827;
            font-size: 15px;
            font-weight: 800;
          }
          .section-title:first-child { margin-top: 0; }
          .form-grid-2 {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 16px 26px;
          }
          .form-grid-3 {
            display: grid;
            grid-template-columns: 1fr 1fr 1fr;
            gap: 16px 22px;
          }
          .field label, .wide-field label, .postcode-lookup label {
            display: block;
            color: #374151;
            font-size: 12px;
            font-weight: 800;
            margin-bottom: 7px;
          }
          .field input,
          .field select,
          .field textarea,
          .wide-field input,
          .wide-field select,
          .wide-field textarea,
          .postcode-lookup input,
          .address-select {
            width: 100%;
            box-sizing: border-box;
            min-height: 42px;
            border: 1px solid #bfc7d1;
            border-radius: 2px;
            background: #ffffff;
            color: #111827;
            padding: 9px 10px;
            font-size: 14px;
          }
          .field textarea, .wide-field textarea { min-height: 110px; resize: vertical; }
          .wide-field { margin-top: 16px; }
          .helper-line {
            color: #6b7280;
            font-size: 12px;
            margin-top: 8px;
          }
          .divider-text {
            display: flex;
            align-items: center;
            gap: 12px;
            color: #6b7280;
            font-size: 12px;
            margin: 14px 0;
          }
          .divider-text:before,
          .divider-text:after {
            content: "";
            flex: 1;
            height: 1px;
            background: #d1d5db;
          }
          .postcode-row {
            display: grid;
            grid-template-columns: minmax(240px, 1fr) auto;
            gap: 12px;
            align-items: end;
            max-width: 700px;
          }
          .lookup-button, .create-button {
            border: 0;
            border-radius: 4px;
            background: #2563eb;
            color: white;
            font-weight: 800;
            padding: 11px 16px;
            cursor: pointer;
            min-height: 42px;
          }
          .create-button {
            padding: 13px 22px;
            background: #1f5fbf;
          }
          .address-choice {
            margin: 14px 0 6px;
            padding: 14px;
            border: 1px solid #d1d5db;
            background: #f9fafb;
          }
          .address-choice label {
            color: #111827;
            font-size: 13px;
            font-weight: 800;
          }
          .address-choice select { margin-top: 8px; }
          .form-footer {
            margin: 28px -22px -22px;
            padding: 16px 22px;
            background: #f9fafb;
            border-top: 1px solid #d1d5db;
            text-align: right;
          }
          .customer-line {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 26px;
          }
          .phone-line {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 26px;
          }
          .tel-wrap { display: grid; grid-template-columns: 58px 1fr; }
          .money-wrap { display: grid; grid-template-columns: 42px 1fr; }
          .money-prefix {
            min-height: 42px;
            display: flex;
            align-items: center;
            justify-content: center;
            border: 1px solid #bfc7d1;
            border-right: 0;
            color: #374151;
            font-size: 15px;
            font-weight: 800;
            background: #f9fafb;
          }
          .money-wrap input { border-top-left-radius: 0; border-bottom-left-radius: 0; }
          .checkbox-line { display:flex; align-items:center; gap:10px; margin-top: 16px; font-weight:800; color:#111827; }
          .checkbox-line input { width:18px; height:18px; }
          .offsite-box { margin-top:14px; padding:14px; border:1px solid #d1d5db; background:#f9fafb; display:none; }
          .tel-prefix {
            min-height: 42px;
            display: flex;
            align-items: center;
            justify-content: center;
            border: 1px solid #bfc7d1;
            border-right: 0;
            color: #6b7280;
            font-size: 12px;
            background: #f9fafb;
          }
          .tel-wrap input { border-top-left-radius: 0; border-bottom-left-radius: 0; }
          .muted-light { color: #6b7280; font-size: 12px; }
          @media (max-width: 800px) {
            .form-grid-2, .form-grid-3, .customer-line, .phone-line, .postcode-row { grid-template-columns: 1fr; }
            .order-body { padding: 16px; }
            .form-footer { margin-left: -16px; margin-right: -16px; margin-bottom: -16px; }
          }
        </style>
      </head>
      <body>
        ${nav(req)}
        <div class="order-shell">
          <h1>Create New Job</h1>
          <div class="subtitle">Single-page booking form for dispatchers taking jobs by telephone.</div>

          <div class="order-panel">
            <div class="order-title">Create New Order</div>
            <div class="order-body">

              <form method="GET" action="/jobs/new" id="postcodeLookupForm">
                <div class="section-title">Address Lookup</div>
                <div class="postcode-row">
                  <div class="postcode-lookup">
                    <label>Enter customer postcode</label>
                    <input name="search" value="${escapeHtml(search)}" placeholder="Enter your Postcode">
                  </div>
                  <button class="lookup-button" type="submit">Find your Address</button>
                </div>
                <div class="helper-line">${escapeHtml(statusMessage)}</div>

                ${addresses.length ? `
                  <div class="address-choice">
                    <label for="address-select">Select address</label>
                    <select id="address-select" class="address-select">
                      <option value="">Choose an address...</option>
                      ${addressOptions}
                    </select>
                    <div class="helper-line">The selected address will fill the address fields below.</div>
                  </div>
                ` : ""}
              </form>

              <form method="POST" action="/jobs/create" id="jobForm">
                <div class="section-title">Job Details</div>
                <div class="form-grid-2">
                  <div class="field">
                    <label>Category</label>
                    <select name="job_type">${optionList(categoryOptions, "Locksmith")}</select>
                  </div>
                  <div class="field">
                    <label>Campaign</label>
                    <select name="source_campaign">${optionList(campaignOptions, "Unknown")}</select>
                  </div>
                </div>

                <div class="wide-field">
                  <label>Description</label>
                  <textarea name="job_description" placeholder="Describe the job while the customer is on the phone. Include lock type, access issue, door type, urgency and anything the technician should know."></textarea>
                </div>

                <div class="section-title">Customer Details</div>
                <div class="field" style="max-width: 500px;">
                  <label>Existing Customer</label>
                  <select id="existing_customer">
                    <option value="">--</option>
                    ${templates.map(template => `<option value="${template.id}">${escapeHtml(template.template_name)} — ${escapeHtml(template.customer_name)}</option>`).join("")}
                  </select>
                </div>

                <div class="divider-text">Or Create New Customer</div>

                <div class="customer-line">
                  <div class="field">
                    <label>Customer Name</label>
                    <input id="customer_name" name="customer_name" required>
                  </div>
                  <div></div>
                </div>

                <div class="phone-line" style="margin-top:16px;">
                  <div class="field">
                    <label>Customer Phone</label>
                    <div class="tel-wrap"><div class="tel-prefix">TEL</div><input name="customer_phone" required></div>
                  </div>
                  <div class="field">
                    <label>Email</label>
                    <input name="customer_email" type="email">
                  </div>
                </div>

                <div class="field" style="max-width: 500px; margin-top:16px;">
                  <label>Alternative Phone</label>
                  <div class="tel-wrap"><div class="tel-prefix">TEL</div><input name="customer_alt_phone"></div>
                </div>

                <div class="section-title">Address</div>
                <div class="wide-field" style="margin-top:0;">
                  <label>Address Line 1</label>
                  <input id="address_line_1" name="address_line_1" required>
                </div>
                <div class="form-grid-2" style="margin-top:16px;">
                  <div class="field"><label>Address Line 2</label><input id="address_line_2" name="address_line_2"></div>
                  <div class="field"><label>Address Line 3</label><input id="address_line_3" name="address_line_3"></div>
                </div>
                <div class="form-grid-3" style="margin-top:16px;">
                  <div class="field"><label>Town</label><input id="town" name="town"></div>
                  <div class="field"><label>County</label><input id="county" name="county"></div>
                  <div class="field"><label>Postcode</label><input id="postcode" name="postcode" value="${escapeHtml(search)}" required></div>
                </div>

                <input id="latitude" name="latitude" type="hidden">
                <input id="longitude" name="longitude" type="hidden">
                <input id="udprn" name="udprn" type="hidden">

                <div class="section-title">Dispatch Details</div>
                <div class="form-grid-3">
                  <div class="field">
                    <label>Technician</label>
                    <select name="assigned_technician_id"><option value="">-</option>${technicianOptions(technicians)}</select>
                  </div>
                  <div class="field">
                    <label>Status</label>
                    <select name="status">${jobStatusOptions("open")}</select>
                  </div>
                  <div class="field">
                    <label>ETA</label>
                    <input name="eta" placeholder="e.g. 30-45 mins">
                  </div>
                </div>

                <div class="form-grid-3" style="margin-top:16px;">
                  <div class="field"><label>Urgency</label><select name="urgency">${optionList(jobUrgencies, "Normal")}</select></div>
                  <div class="field"><label>Starting price</label><div class="money-wrap"><div class="money-prefix">£</div><input name="starting_price" inputmode="decimal" placeholder="e.g. 75"></div></div>
                  <div class="field"><label>Call out agreed</label><div class="money-wrap"><div class="money-prefix">£</div><input name="call_out_agreed" inputmode="decimal" placeholder="e.g. 55"></div></div>
                </div>

                <div class="form-grid-3" style="margin-top:16px;">
                  <div class="field"><label>Start price of locks</label><div class="money-wrap"><div class="money-prefix">£</div><input name="start_price_locks" inputmode="decimal" placeholder="e.g. 40"></div></div>
                  <div class="field"><label>Expected Payment Method</label><select name="expected_payment_method">${optionList(jobPaymentMethods, "Unknown")}</select></div>
                  <div class="field"><label>Quoted / overall price notes</label><div class="money-wrap"><div class="money-prefix">£</div><input name="quoted_price" inputmode="decimal" placeholder="optional"></div></div>
                </div>

                <label class="checkbox-line"><input type="checkbox" id="offsite_payment" name="offsite_payment" value="true"> Offsite payment</label>
                <div class="offsite-box" id="offsite_payment_box">
                  <div class="form-grid-2">
                    <div class="field"><label>Bill payer name</label><input id="bill_payer_name" name="bill_payer_name" placeholder="Name of person paying"></div>
                    <div class="field"><label>Bill payer telephone</label><div class="tel-wrap"><div class="tel-prefix">TEL</div><input id="bill_payer_phone" name="bill_payer_phone" placeholder="Telephone number"></div></div>
                  </div>
                  <div class="helper-line">Use this when someone other than the caller is paying, for example landlord, relative, office manager or account contact.</div>
                </div>

                <div class="form-grid-2" style="margin-top:16px;">
                  <div class="field"><label>Account Job?</label><select id="account_job" name="account_job"><option value="false">No</option><option value="true">Yes</option></select></div>
                  <div class="field"><label>Account Template</label><select id="account_template_id" name="account_template_id"><option value="">None</option>${accountTemplateOptions(templates)}</select></div>
                </div>

                <div class="wide-field">
                  <label>Dispatcher Notes</label>
                  <textarea name="dispatcher_notes" placeholder="Internal office notes. These are not customer-facing."></textarea>
                </div>

                <div class="form-footer">
                  <a href="/jobs" style="margin-right:14px;">Cancel</a>
                  <button class="create-button" type="submit">Create Order</button>
                </div>
              </form>
            </div>
          </div>
        </div>

        <script>
          const addresses = ${addressesJson};
          const templates = ${templatesJson};

          function setValue(id, value) {
            const element = document.getElementById(id);
            if (element) element.value = value || "";
          }

          function chooseAddress(index) {
            const address = addresses[Number(index)];
            if (!address) return;
            setValue("address_line_1", address.address_line_1);
            setValue("address_line_2", address.address_line_2);
            setValue("address_line_3", address.address_line_3);
            setValue("town", address.town);
            setValue("county", address.county);
            setValue("postcode", address.postcode);
            setValue("latitude", address.latitude);
            setValue("longitude", address.longitude);
            setValue("udprn", address.udprn);
          }

          const addressSelect = document.getElementById("address-select");
          if (addressSelect) addressSelect.addEventListener("change", () => chooseAddress(addressSelect.value));

          const existingCustomer = document.getElementById("existing_customer");
          if (existingCustomer) {
            existingCustomer.addEventListener("change", () => {
              const template = templates.find(item => String(item.id) === String(existingCustomer.value));
              if (!template) return;
              setValue("customer_name", template.customer_name || "");
              setValue("postcode", template.customer_postcode || "");
              const accountJob = document.getElementById("account_job");
              const accountTemplate = document.getElementById("account_template_id");
              if (accountJob) accountJob.value = "true";
              if (accountTemplate) accountTemplate.value = String(template.id);
            });
          }

          const accountTemplate = document.getElementById("account_template_id");
          const accountJob = document.getElementById("account_job");
          if (accountTemplate) {
            accountTemplate.addEventListener("change", () => {
              if (accountTemplate.value && accountJob) accountJob.value = "true";
            });
          }

          const offsitePayment = document.getElementById("offsite_payment");
          const offsitePaymentBox = document.getElementById("offsite_payment_box");
          function toggleOffsitePayment() {
            if (!offsitePayment || !offsitePaymentBox) return;
            offsitePaymentBox.style.display = offsitePayment.checked ? "block" : "none";
          }
          if (offsitePayment) {
            offsitePayment.addEventListener("change", toggleOffsitePayment);
            toggleOffsitePayment();
          }
        </script>
      </body>
      </html>
    `);
  } catch (error) {
    console.error("New job page error:", error);
    res.status(500).send("New job page error");
  }
});

app.post("/jobs/create", async (req, res) => {
  try {
    const body = req.body;
    const result = await pool.query(`
      INSERT INTO jobs (
        customer_name, customer_phone, customer_alt_phone, customer_email,
        address_line_1, address_line_2, address_line_3, town, county, postcode, latitude, longitude, udprn,
        job_type, job_description, urgency, source_campaign, quoted_price, starting_price, call_out_agreed, start_price_locks, offsite_payment, bill_payer_name, bill_payer_phone, expected_payment_method,
        account_job, account_template_id, assigned_technician_id, eta, dispatcher_name, dispatcher_notes, status,
        created_at, updated_at
      ) VALUES (
        $1,$2,$3,$4,
        $5,$6,$7,$8,$9,$10,$11,$12,$13,
        $14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,
        $26,$27,$28,$29,$30,$31,$32,
        NOW(), NOW()
      ) RETURNING id
    `, [
      body.customer_name,
      body.customer_phone,
      body.customer_alt_phone,
      body.customer_email,
      body.address_line_1,
      body.address_line_2,
      body.address_line_3,
      body.town,
      body.county,
      (body.postcode || "").toUpperCase(),
      parseMoneyInput(body.latitude),
      parseMoneyInput(body.longitude),
      body.udprn,
      body.job_type,
      body.job_description,
      body.urgency || "Normal",
      body.source_campaign,
      parseMoneyInput(body.quoted_price),
      parseMoneyInput(body.starting_price),
      parseMoneyInput(body.call_out_agreed),
      parseMoneyInput(body.start_price_locks),
      body.offsite_payment === "true",
      body.bill_payer_name,
      body.bill_payer_phone,
      body.expected_payment_method || "Unknown",
      body.account_job === "true",
      parseOptionalInt(body.account_template_id),
      parseOptionalInt(body.assigned_technician_id),
      body.eta,
      currentAgentName(req),
      body.dispatcher_notes,
      body.status || "open"
    ]);

    const id = result.rows[0].id;
    await pool.query(`UPDATE jobs SET job_number = $1 WHERE id = $2`, [jobNumber(id), id]);
    res.redirect(`/jobs/${id}/summary`);
  } catch (error) {
    console.error("Create job error:", error);
    res.status(500).send("Could not create job");
  }
});


app.get("/jobs/:id/summary", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const result = await pool.query(`SELECT * FROM jobs WHERE id = $1`, [id]);
    if (!result.rows.length) return res.status(404).send("Job not found");
    const job = result.rows[0];
    const summary = jobTechnicianSummary(job);
    const telLink = phoneHref(job.customer_phone);

    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Technician Summary</title>
        <style>
          ${sharedStyles()}
          .summary-card { background:#111827; border:1px solid #374151; border-radius:12px; padding:20px; max-width:760px; }
          .summary-box { width:100%; min-height:260px; box-sizing:border-box; border-radius:10px; border:1px solid #4b5563; background:#020617; color:#e5e7eb; padding:16px; font-size:16px; line-height:1.55; white-space:pre-wrap; }
          .copy-button { margin-top:12px; background:#22c55e; color:#052e16; border:0; border-radius:8px; padding:12px 16px; font-weight:900; cursor:pointer; }
          .quick-links { margin-top:16px; display:flex; gap:12px; flex-wrap:wrap; }
        </style>
      </head>
      <body>
        ${nav(req)}
        <h1>Technician Summary</h1>
        <div class="subtitle">Copy and paste this into WhatsApp for the technician.</div>

        <div class="summary-card">
          <textarea id="techSummary" class="summary-box" readonly>${escapeHtml(summary)}</textarea>
          <button class="copy-button" type="button" onclick="copySummary()">Copy technician summary</button>
          <div class="quick-links">
            <a href="${escapeHtml(telLink)}">Call customer</a>
            <a href="/jobs/${job.id}/edit">Open / edit job</a>
            <a href="/jobs/${job.id}/close">Close job</a>
            <a href="/jobs">Back to jobs</a>
          </div>
        </div>

        <script>
          function copySummary() {
            const box = document.getElementById("techSummary");
            box.focus();
            box.select();
            document.execCommand("copy");
            alert("Technician summary copied.");
          }
        </script>
      </body>
      </html>
    `);
  } catch (error) {
    console.error("Job summary error:", error);
    res.status(500).send("Could not load job summary");
  }
});

app.get("/jobs/:id/edit", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const jobResult = await pool.query(`
      SELECT j.*, t.name AS technician_name, t.phone AS technician_phone, t.checkin_token AS technician_token
      FROM jobs j
      LEFT JOIN technicians t ON t.id = j.assigned_technician_id
      WHERE j.id = $1
    `, [id]);
    if (!jobResult.rows.length) return res.status(404).send("Job not found");
    const job = jobResult.rows[0];
    const technicians = (await pool.query(`SELECT id, name, status, phone, checkin_token FROM technicians WHERE active = TRUE ORDER BY name ASC`)).rows;
    const templates = (await pool.query(`SELECT id, template_name FROM invoice_templates WHERE active = TRUE ORDER BY sort_order ASC, template_name ASC`)).rows;
    const campaignOptions = await getCampaignOptions(job.source_campaign || "Unknown");
    const summary = jobTechnicianSummary(job);
    const customerTel = phoneHref(job.customer_phone);
    const payerTel = phoneHref(job.offsite_payment ? job.bill_payer_phone : job.customer_phone);
    const techWorkspaceUrl = job.technician_token ? `/tech-workspace/${job.technician_token}` : "";

    const activityItems = [
      { label: "Order created", value: `${formatDateTime(job.created_at)} by ${job.dispatcher_name || "Unknown"}` },
      { label: "Current status", value: jobStatusLabel(job.status) },
      { label: "Technician", value: job.technician_name || "Unassigned" },
      { label: "Last updated", value: formatDateTime(job.updated_at) },
      { label: "Closed", value: job.closed_at ? `${formatDateTime(job.closed_at)} by ${job.closed_by || "Unknown"}` : "Not closed yet" }
    ];

    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Job Control Panel</title>
        <style>
          ${sharedStyles()}
          .job-control-shell { max-width: 1560px; margin: 0 auto; }
          .job-control-header {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 18px;
            margin-bottom: 22px;
          }
          .job-control-title { display: flex; flex-direction: column; gap: 6px; }
          .job-control-actions { display: flex; flex-wrap: wrap; gap: 10px; justify-content: flex-end; }
          .job-control-grid {
            display: grid;
            grid-template-columns: minmax(0, 1.55fr) minmax(330px, 0.85fr);
            gap: 22px;
            align-items: start;
          }
          .control-card {
            background: #ffffff;
            border: 1px solid #e5e7eb;
            border-radius: 22px;
            padding: 22px;
            box-shadow: 0 14px 30px rgba(17, 24, 39, 0.06);
            margin-bottom: 22px;
          }
          .control-card h2 { margin: 0 0 16px; font-size: 22px; }
          .summary-kpis { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; margin-bottom: 22px; }
          .summary-kpi {
            background: #f9fafb;
            border: 1px solid #edf0f3;
            border-radius: 18px;
            padding: 16px;
          }
          .summary-kpi .kpi-label { color: #6b7280; font-size: 12px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.06em; }
          .summary-kpi .kpi-value { color: #25313a; font-size: 22px; font-weight: 950; margin-top: 6px; word-break: break-word; }
          .job-info-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
          .info-block { background: #fbfcfd; border: 1px solid #eef0f3; border-radius: 16px; padding: 15px; }
          .info-block strong { display: block; color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 7px; }
          .info-block span, .info-block div { color: #25313a; font-weight: 800; line-height: 1.45; }
          .quick-form { display: grid; gap: 10px; margin-bottom: 14px; }
          .quick-form-row { display: grid; grid-template-columns: 1fr auto; gap: 10px; align-items: end; }
          .quick-form label, .control-card label { color: #25313a; font-size: 13px; font-weight: 900; margin-bottom: 6px; }
          .quick-form select, .quick-form input { width: 100%; }
          .money-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
          .money-box { border-radius: 16px; padding: 15px; border: 1px solid #eef0f3; background: #fbfcfd; }
          .money-box .money-label { color: #6b7280; font-size: 12px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.05em; }
          .money-box .money-value { margin-top: 6px; color: #25313a; font-size: 20px; font-weight: 950; }
          .tech-summary-box { width: 100%; min-height: 210px; border: 1px solid #d1d5db; border-radius: 16px; padding: 14px; background: #111827; color: #e5e7eb; line-height: 1.55; font-size: 14px; white-space: pre-wrap; }
          .activity-list { display: grid; gap: 10px; }
          .activity-item { display: grid; grid-template-columns: 14px 1fr; gap: 10px; align-items: start; padding: 10px 0; border-bottom: 1px solid #eef0f3; }
          .activity-dot { width: 10px; height: 10px; border-radius: 999px; background: var(--brand-green); margin-top: 4px; }
          .activity-label { color: #25313a; font-weight: 950; }
          .activity-value { color: #6b7280; font-size: 13px; margin-top: 2px; }
          .edit-form-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
          .edit-form-grid .wide { grid-column: 1 / -1; }
          .edit-form-grid input, .edit-form-grid select, .edit-form-grid textarea { width: 100%; }
          .copy-mini { background:#26323a; color:white; border:none; border-radius:12px; font-weight:900; padding:11px 14px; cursor:pointer; }
          .muted-note { color:#6b7280; font-size:13px; line-height:1.4; }
          .pill-row { display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
          @media (max-width: 1180px) {
            .job-control-grid { grid-template-columns: 1fr; }
            .summary-kpis, .money-grid, .edit-form-grid, .job-info-grid { grid-template-columns: 1fr; }
            .job-control-header { flex-direction: column; }
            .job-control-actions { justify-content: flex-start; }
          }
        </style>
      </head>
      <body>
        ${nav(req)}
        <div class="job-control-shell">
          <div class="job-control-header">
            <div class="job-control-title">
              <h1>${escapeHtml(job.job_number || jobNumber(job.id))} Control Panel</h1>
              <div class="subtitle">Created ${formatDateTime(job.created_at)} by ${escapeHtml(job.dispatcher_name || "Unknown")} · Last updated ${formatDateTime(job.updated_at)}</div>
              <div class="pill-row"><span class="pill ${jobStatusClass(job.status)}">${escapeHtml(jobStatusLabel(job.status))}</span>${job.urgency ? `<span class="pill stage-draft">${escapeHtml(job.urgency)}</span>` : ""}</div>
            </div>
            <div class="job-control-actions">
              <a class="action-button" href="/jobs/${job.id}/summary">Technician summary</a>
              <a class="action-button amber" href="/jobs/${job.id}/close">Close / payment</a>
              <a class="action-button" href="/disputes/new?job_id=${job.id}">Raise dispute</a>
              <a class="action-button dark" href="/jobs">Back to Dispatch Board</a>
            </div>
          </div>

          <div class="summary-kpis">
            <div class="summary-kpi"><div class="kpi-label">Customer</div><div class="kpi-value">${escapeHtml(job.customer_name || "—")}</div></div>
            <div class="summary-kpi"><div class="kpi-label">Postcode</div><div class="kpi-value">${escapeHtml(job.postcode || "—")}</div></div>
            <div class="summary-kpi"><div class="kpi-label">Technician</div><div class="kpi-value">${escapeHtml(job.technician_name || "Unassigned")}</div></div>
            <div class="summary-kpi"><div class="kpi-label">ETA</div><div class="kpi-value">${escapeHtml(job.eta || "—")}</div></div>
          </div>

          <div class="job-control-grid">
            <main>
              <div class="control-card">
                <h2>Job summary</h2>
                <div class="job-info-grid">
                  <div class="info-block"><strong>Customer phone</strong><span><a href="${escapeHtml(customerTel)}">${escapeHtml(job.customer_phone || "—")}</a></span></div>
                  <div class="info-block"><strong>Bill payer</strong><span>${escapeHtml(job.offsite_payment ? (job.bill_payer_name || "—") : (job.customer_name || "—"))}${(job.offsite_payment ? job.bill_payer_phone : job.customer_phone) ? ` · <a href="${escapeHtml(payerTel)}">${escapeHtml(job.offsite_payment ? job.bill_payer_phone : job.customer_phone)}</a>` : ""}</span></div>
                  <div class="info-block"><strong>Address</strong><div>${jobAddressBlock(job) || "—"}</div></div>
                  <div class="info-block"><strong>Job</strong><span>${escapeHtml(job.job_type || "—")} · ${escapeHtml(job.source_campaign || "No campaign")}</span><div class="muted-note">${escapeHtml(job.job_description || "No description entered.")}</div></div>
                </div>
              </div>

              <div class="control-card">
                <h2>Money & payment</h2>
                <div class="money-grid">
                  <div class="money-box"><div class="money-label">Starting price</div><div class="money-value">${money(job.starting_price || job.quoted_price || 0)}</div></div>
                  <div class="money-box"><div class="money-label">Call out agreed</div><div class="money-value">${money(job.call_out_agreed || 0)}</div></div>
                  <div class="money-box"><div class="money-label">Start price of locks</div><div class="money-value">${money(job.start_price_locks || 0)}</div></div>
                  <div class="money-box"><div class="money-label">Final value</div><div class="money-value">${job.final_value !== null && job.final_value !== undefined ? money(job.final_value) : "—"}</div></div>
                  <div class="money-box"><div class="money-label">Payment method</div><div class="money-value">${escapeHtml(job.payment_method || job.expected_payment_method || "Unknown")}</div></div>
                  <div class="money-box"><div class="money-label">Materials cost</div><div class="money-value">${job.materials_cost !== null && job.materials_cost !== undefined ? money(job.materials_cost) : "—"}</div></div>
                </div>
              </div>

              <div class="control-card">
                <h2>Edit full order details</h2>
                <form method="POST" action="/jobs/${job.id}/update">
                  <div class="edit-form-grid">
                    <div><label>Customer name</label><input name="customer_name" value="${escapeHtml(job.customer_name)}" required></div>
                    <div><label>Customer phone</label><input name="customer_phone" value="${escapeHtml(job.customer_phone)}" required></div>
                    <div><label>Email</label><input name="customer_email" value="${escapeHtml(job.customer_email)}"></div>
                    <div><label>Alternative phone</label><input name="customer_alt_phone" value="${escapeHtml(job.customer_alt_phone)}"></div>
                    <div><label>Address line 1</label><input name="address_line_1" value="${escapeHtml(job.address_line_1)}" required></div>
                    <div><label>Address line 2</label><input name="address_line_2" value="${escapeHtml(job.address_line_2)}"></div>
                    <div><label>Address line 3</label><input name="address_line_3" value="${escapeHtml(job.address_line_3)}"></div>
                    <div><label>Town</label><input name="town" value="${escapeHtml(job.town)}"></div>
                    <div><label>County</label><input name="county" value="${escapeHtml(job.county)}"></div>
                    <div><label>Postcode</label><input name="postcode" value="${escapeHtml(job.postcode)}" required></div>
                    <div><label>Job type</label><select name="job_type">${optionList(jobTypes, job.job_type)}</select></div>
                    <div><label>Urgency</label><select name="urgency">${optionList(jobUrgencies, job.urgency)}</select></div>
                    <div><label>Source / campaign</label><select name="source_campaign">${optionList(campaignOptions, job.source_campaign || "Unknown")}</select></div>
                    <div><label>Starting price £</label><input name="starting_price" value="${job.starting_price !== null && job.starting_price !== undefined ? Number(job.starting_price).toFixed(2) : ""}"></div>
                    <div><label>Call out agreed £</label><input name="call_out_agreed" value="${job.call_out_agreed !== null && job.call_out_agreed !== undefined ? Number(job.call_out_agreed).toFixed(2) : ""}"></div>
                    <div><label>Start price of locks £</label><input name="start_price_locks" value="${job.start_price_locks !== null && job.start_price_locks !== undefined ? Number(job.start_price_locks).toFixed(2) : ""}"></div>
                    <div><label>Quoted / overall price notes £</label><input name="quoted_price" value="${job.quoted_price !== null && job.quoted_price !== undefined ? Number(job.quoted_price).toFixed(2) : ""}"></div>
                    <div><label>Offsite payment?</label><select name="offsite_payment"><option value="false" ${!job.offsite_payment ? "selected" : ""}>No</option><option value="true" ${job.offsite_payment ? "selected" : ""}>Yes</option></select></div>
                    <div><label>Bill payer name</label><input name="bill_payer_name" value="${escapeHtml(job.bill_payer_name)}"></div>
                    <div><label>Bill payer telephone</label><input name="bill_payer_phone" value="${escapeHtml(job.bill_payer_phone)}"></div>
                    <div><label>Expected payment method</label><select name="expected_payment_method">${optionList(jobPaymentMethods, job.expected_payment_method)}</select></div>
                    <div><label>Account job?</label><select name="account_job"><option value="false" ${!job.account_job ? "selected" : ""}>No</option><option value="true" ${job.account_job ? "selected" : ""}>Yes</option></select></div>
                    <div><label>Account template</label><select name="account_template_id"><option value="">None</option>${accountTemplateOptions(templates, job.account_template_id)}</select></div>
                    <div><label>Assigned technician</label><select name="assigned_technician_id"><option value="">Unassigned</option>${technicianOptions(technicians, job.assigned_technician_id)}</select></div>
                    <div><label>ETA</label><input name="eta" value="${escapeHtml(job.eta)}"></div>
                    <div><label>Status</label><select name="status">${jobStatusOptions(job.status)}</select></div>
                    <div class="wide"><label>Job description</label><textarea name="job_description" rows="4">${escapeHtml(job.job_description)}</textarea></div>
                    <div class="wide"><label>Dispatcher notes</label><textarea name="dispatcher_notes" rows="3">${escapeHtml(job.dispatcher_notes)}</textarea></div>
                  </div>
                  <br>
                  <button type="submit">Save full order details</button>
                </form>
              </div>
            </main>

            <aside>
              <div class="control-card">
                <h2>Quick actions</h2>
                <form class="quick-form" method="POST" action="/jobs/${job.id}/quick-status">
                  <label>Change status</label>
                  <div class="quick-form-row">
                    <select name="status">${jobStatusOptions(job.status)}</select>
                    <button type="submit">Update</button>
                  </div>
                </form>
                <form class="quick-form" method="POST" action="/jobs/${job.id}/quick-assign">
                  <label>Assign / change technician</label>
                  <div class="quick-form-row">
                    <select name="assigned_technician_id"><option value="">Unassigned</option>${technicianOptions(technicians, job.assigned_technician_id)}</select>
                    <button type="submit">Assign</button>
                  </div>
                </form>
                <div class="page-actions">
                  <a class="action-button amber" href="/jobs/${job.id}/close">Close job</a>
                  <a class="action-button dark" href="/dispatch?postcode=${encodeURIComponent(job.postcode || "")}">Open map</a>
                  ${techWorkspaceUrl ? `<a class="action-button" href="${escapeHtml(techWorkspaceUrl)}" target="_blank" rel="noopener noreferrer">Tech workspace</a>` : ""}
                </div>
              </div>

              <div class="control-card">
                <h2>Copy technician summary</h2>
                <textarea id="techSummary" class="tech-summary-box" readonly>${escapeHtml(summary)}</textarea>
                <br><br>
                <button class="copy-mini" type="button" onclick="copySummary()">Copy summary</button>
              </div>

              <div class="control-card">
                <h2>Activity / history</h2>
                <div class="activity-list">
                  ${activityItems.map(item => `
                    <div class="activity-item">
                      <span class="activity-dot"></span>
                      <div><div class="activity-label">${escapeHtml(item.label)}</div><div class="activity-value">${escapeHtml(item.value)}</div></div>
                    </div>
                  `).join("")}
                </div>
                <p class="muted-note">This is a basic history view for now. A full audit trail can be added later.</p>
              </div>
            </aside>
          </div>
        </div>
        <script>
          function copySummary() {
            const box = document.getElementById("techSummary");
            box.focus();
            box.select();
            document.execCommand("copy");
            alert("Technician summary copied.");
          }
        </script>
      </body>
      </html>
    `);
  } catch (error) {
    console.error("Edit job page error:", error);
    res.status(500).send("Edit job page error. Check Render logs.");
  }
});

app.post("/jobs/:id/quick-status", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const status = req.body.status || "open";
    await pool.query(`UPDATE jobs SET status = $1, updated_at = NOW() WHERE id = $2`, [status, id]);
    res.redirect(`/jobs/${id}/edit`);
  } catch (error) {
    console.error("Quick status update error:", error);
    res.status(500).send("Could not update job status");
  }
});

app.post("/jobs/:id/quick-assign", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const technicianId = parseOptionalInt(req.body.assigned_technician_id);
    await pool.query(`
      UPDATE jobs
      SET assigned_technician_id = $1,
          status = CASE WHEN $1 IS NOT NULL AND status = 'open' THEN 'assigned' ELSE status END,
          updated_at = NOW()
      WHERE id = $2
    `, [technicianId, id]);
    res.redirect(`/jobs/${id}/edit`);
  } catch (error) {
    console.error("Quick assign error:", error);
    res.status(500).send("Could not assign technician");
  }
});

app.post("/jobs/:id/update", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const body = req.body;
    await pool.query(`
      UPDATE jobs SET
        customer_name=$1, customer_phone=$2, customer_alt_phone=$3, customer_email=$4,
        address_line_1=$5, address_line_2=$6, address_line_3=$7, town=$8, county=$9, postcode=$10,
        job_type=$11, job_description=$12, urgency=$13, source_campaign=$14, quoted_price=$15,
        starting_price=$16, call_out_agreed=$17, start_price_locks=$18, offsite_payment=$19, bill_payer_name=$20, bill_payer_phone=$21,
        expected_payment_method=$22, account_job=$23, account_template_id=$24, assigned_technician_id=$25,
        eta=$26, dispatcher_notes=$27, status=$28, updated_at=NOW()
      WHERE id=$29
    `, [
      body.customer_name,
      body.customer_phone,
      body.customer_alt_phone,
      body.customer_email,
      body.address_line_1,
      body.address_line_2,
      body.address_line_3,
      body.town,
      body.county,
      (body.postcode || "").toUpperCase(),
      body.job_type,
      body.job_description,
      body.urgency || "Normal",
      body.source_campaign,
      parseMoneyInput(body.quoted_price),
      parseMoneyInput(body.starting_price),
      parseMoneyInput(body.call_out_agreed),
      parseMoneyInput(body.start_price_locks),
      body.offsite_payment === "true",
      body.bill_payer_name,
      body.bill_payer_phone,
      body.expected_payment_method || "Unknown",
      body.account_job === "true",
      parseOptionalInt(body.account_template_id),
      parseOptionalInt(body.assigned_technician_id),
      body.eta,
      body.dispatcher_notes,
      body.status || "open",
      id
    ]);
    res.redirect(`/jobs/${id}/edit`);
  } catch (error) {
    console.error("Update job error:", error);
    res.status(500).send("Could not update job");
  }
});

app.get("/jobs/:id/close", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const result = await pool.query(`
      SELECT j.*, t.name AS technician_name
      FROM jobs j
      LEFT JOIN technicians t ON t.id = j.assigned_technician_id
      WHERE j.id = $1
    `, [id]);
    if (!result.rows.length) return res.status(404).send("Job not found");
    const job = result.rows[0];

    res.send(`
      <!DOCTYPE html>
      <html>
      <head><title>Close Job</title><style>${sharedStyles()} label { color:#d1d5db; font-size:13px; font-weight:bold; margin-bottom:5px; display:block; } .field input,.field select,.field textarea{width:100%;box-sizing:border-box;}</style></head>
      <body>
        ${nav(req)}
        <h1>Close ${escapeHtml(job.job_number || jobNumber(job.id))}</h1>
        <div class="subtitle">${escapeHtml(job.customer_name || "")} · ${escapeHtml(job.postcode || "")} · Technician: ${escapeHtml(job.technician_name || "Unassigned")}</div>

        <div class="panel">
          <h2>Job summary</h2>
          <p><strong>Address:</strong><br>${jobAddressBlock(job) || "—"}</p>
          <p><strong>Job:</strong> ${escapeHtml(job.job_type || "—")} ${job.quoted_price !== null && job.quoted_price !== undefined ? `· Quoted ${money(job.quoted_price)}` : ""}</p>
          <p><strong>Description:</strong><br>${escapeHtml(job.job_description || "—")}</p>
        </div>

        <form method="POST" action="/jobs/${job.id}/close">
          <div class="panel">
            <h2>Close job / payment</h2>
            <div class="job-grid">
              <div class="field"><label>Final job value</label><input name="final_value" value="${job.final_value !== null && job.final_value !== undefined ? Number(job.final_value).toFixed(2) : ""}" inputmode="decimal" required></div>
              <div class="field"><label>Payment method</label><select name="payment_method">${optionList(jobPaymentMethods, job.payment_method || job.expected_payment_method || "Unknown")}</select></div>
              <div class="field"><label>Customer paid?</label><select name="customer_paid"><option value="false" ${!job.customer_paid ? "selected" : ""}>No</option><option value="true" ${job.customer_paid ? "selected" : ""}>Yes</option></select></div>
              <div class="field"><label>Final status</label><select name="status">${jobStatusOptions(job.status || "completed")}</select></div>
              <div class="field"><label>Materials cost</label><input name="materials_cost" value="${job.materials_cost !== null && job.materials_cost !== undefined ? Number(job.materials_cost).toFixed(2) : ""}" inputmode="decimal" placeholder="e.g. 18"></div>
              <div class="field"><label>Outcome</label><select name="outcome">${optionList(jobOutcomes, job.outcome || "Completed")}</select></div>
            </div>
            <br>
            <label>Materials used</label>
            <textarea name="materials_used" rows="3" placeholder="Parts/materials used by the technician">${escapeHtml(job.materials_used)}</textarea>
            <br><br>
            <label>Technician notes</label>
            <textarea name="tech_notes" rows="3">${escapeHtml(job.tech_notes)}</textarea>
            <br><br>
            <label>Close notes</label>
            <textarea name="close_notes" rows="3">${escapeHtml(job.close_notes)}</textarea>
          </div>
          <button type="submit">Save close details</button>
          <a href="/jobs/${job.id}/edit" style="margin-left:12px;">Back to job</a>
        </form>
      </body>
      </html>
    `);
  } catch (error) {
    console.error("Close job page error:", error);
    res.status(500).send("Close job page error");
  }
});

app.post("/jobs/:id/close", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const body = req.body;
    await pool.query(`
      UPDATE jobs SET
        final_value=$1,
        payment_method=$2,
        customer_paid=$3,
        materials_used=$4,
        materials_cost=$5,
        outcome=$6,
        tech_notes=$7,
        close_notes=$8,
        status=$9,
        closed_by=$10,
        closed_at=COALESCE(closed_at, NOW()),
        updated_at=NOW()
      WHERE id=$11
    `, [
      parseMoneyInput(body.final_value),
      body.payment_method || "Unknown",
      body.customer_paid === "true",
      body.materials_used,
      parseMoneyInput(body.materials_cost),
      body.outcome,
      body.tech_notes,
      body.close_notes,
      body.status || "completed",
      currentAgentName(req),
      id
    ]);
    res.redirect(`/jobs/${id}/edit`);
  } catch (error) {
    console.error("Close job error:", error);
    res.status(500).send("Could not close job");
  }
});

app.get("/address-lookup-test", (req, res) => {
  res.redirect("/jobs/new");
});

/* Address lookup test page removed from menu. Kept below as inactive reference. */
app.get("/address-lookup-test-old", async (req, res) => {
  const search = (req.query.search || "").trim();
  let lookup = null;

  if (search) {
    try {
      lookup = await lookupPostcoderAddresses(search);
    } catch (error) {
      console.error("Address lookup test page error:", error);
      lookup = { ok: false, addresses: [], error: "Address lookup failed. Check Render logs." };
    }
  }

  const addresses = lookup && lookup.ok && Array.isArray(lookup.addresses) ? lookup.addresses : [];

  const addressOptions = addresses.length
    ? addresses.map((address, index) => {
        return `<option value="${index}">${escapeHtml(address.summary || address.full_address || `Address ${index + 1}`)}</option>`;
      }).join("")
    : "";

  const addressesJson = JSON.stringify(addresses)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");

  const statusMessage = !search
    ? "Enter a postcode and press Find address."
    : addresses.length
      ? `${addresses.length} address${addresses.length === 1 ? "" : "es"} found. Use the Select address dropdown below.`
      : lookup && lookup.error
        ? lookup.error
        : "No addresses found. Check the postcode or enter the address manually.";

  const statusClass = search && !addresses.length ? "status error" : "status";

  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Address Lookup Test</title>
      <style>
        ${sharedStyles()}
        .lookup-grid { display: grid; grid-template-columns: 1fr auto; gap: 12px; align-items: center; }
        .address-select-wrap { margin-top: 22px; padding: 16px; border: 1px solid #374151; background: #111827; border-radius: 12px; }
        .address-select-wrap label { display: block; margin-bottom: 10px; color: #fbbf24; font-weight: 800; font-size: 15px; }
        .address-select { width: 100%; min-height: 52px; background: #030712; border: 2px solid #f59e0b; color: #f9fafb; border-radius: 10px; padding: 12px; font-size: 16px; }
        .address-select:focus { outline: none; border-color: #22c55e; box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.18); }
        .picked { white-space: pre-line; background: #111827; border: 1px solid #374151; border-radius: 10px; padding: 16px; min-height: 80px; color: #d1d5db; }
        .status { margin-top: 12px; color: #9ca3af; }
        .status strong { color: #fbbf24; }
        .status.error { color: #fca5a5; }
        .form-preview { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-top: 18px; }
        .manual-note { color: #9ca3af; font-size: 13px; margin-top: 10px; }
        .small-debug { color: #6b7280; font-size: 12px; margin-top: 8px; }
        @media (max-width: 700px) {
          .lookup-grid { grid-template-columns: 1fr; }
          .form-preview { grid-template-columns: 1fr; }
        }
      </style>
    </head>
    <body>
      ${nav(req)}

      <h1>Address Lookup Test</h1>
      <div class="subtitle">Dispatcher flow: enter postcode, press Find address, choose the correct address from the dropdown, then the form fields fill in.</div>

      <div class="panel">
        <h2>Find address</h2>
        <form method="GET" action="/address-lookup-test" class="lookup-grid">
          <input id="postcode-search" name="search" value="${escapeHtml(search)}" placeholder="Enter postcode, e.g. W3 7AR">
          <button type="submit">Find address</button>
        </form>
        <div class="${statusClass}">${escapeHtml(statusMessage)}</div>

        ${addresses.length ? `
          <div class="address-select-wrap">
            <label for="address-select">Select address</label>
            <select id="address-select" name="address_select" class="address-select">
              <option value="">Choose an address...</option>
              ${addressOptions}
            </select>
            <div class="small-debug">Dropdown loaded with ${addresses.length} option${addresses.length === 1 ? "" : "s"}.</div>
          </div>
        ` : ""}

        <div class="manual-note">If the customer gives a flat number or building name that is not obvious, choose the closest address and adjust the address fields manually.</div>
      </div>

      <div class="panel">
        <h2>Booking form preview</h2>
        <div class="form-preview">
          <input id="address_line_1" placeholder="Address line 1">
          <input id="address_line_2" placeholder="Address line 2">
          <input id="address_line_3" placeholder="Address line 3">
          <input id="town" placeholder="Town">
          <input id="county" placeholder="County">
          <input id="postcode" placeholder="Postcode">
          <input id="latitude" placeholder="Latitude">
          <input id="longitude" placeholder="Longitude">
          <input id="udprn" placeholder="UDPRN / unique address id">
        </div>
        <br>
        <div id="picked-address" class="picked">Choose an address from the dropdown and it will populate these fields.</div>
      </div>

      <script>
        const addresses = ${addressesJson};

        function setValue(id, value) {
          const element = document.getElementById(id);
          if (element) element.value = value || "";
        }

        function chooseAddress(index) {
          const address = addresses[Number(index)];
          if (!address) {
            document.getElementById("picked-address").textContent = "Choose an address from the dropdown and it will populate these fields.";
            return;
          }

          setValue("address_line_1", address.address_line_1);
          setValue("address_line_2", address.address_line_2);
          setValue("address_line_3", address.address_line_3);
          setValue("town", address.town);
          setValue("county", address.county);
          setValue("postcode", address.postcode);
          setValue("latitude", address.latitude);
          setValue("longitude", address.longitude);
          setValue("udprn", address.udprn);

          const picked = [
            address.address_line_1,
            address.address_line_2,
            address.address_line_3,
            address.town,
            address.county,
            address.postcode
          ].filter(Boolean).join("\n");

          document.getElementById("picked-address").textContent = picked || "Address selected.";
        }

        const addressSelect = document.getElementById("address-select");
        if (addressSelect) {
          addressSelect.addEventListener("change", function() {
            chooseAddress(addressSelect.value);
          });
        }
      </script>
    </body>
    </html>
  `);
});


app.get("/customers", async (req, res) => {
  try {
    await initDb();
    const search = (req.query.search || "").trim();
    const params = [];
    let where = "WHERE COALESCE(j.customer_name, '') <> '' OR COALESCE(j.customer_phone, '') <> ''";

    if (search) {
      params.push(`%${search.toLowerCase()}%`);
      where += ` AND LOWER(CONCAT_WS(' ', j.customer_name, j.customer_phone, j.customer_email, j.postcode, j.address_line_1, j.town, j.source_campaign)) LIKE $${params.length}`;
    }

    const jobsResult = await pool.query(`
      SELECT j.*, t.name AS technician_name
      FROM jobs j
      LEFT JOIN technicians t ON t.id = j.assigned_technician_id
      ${where}
      ORDER BY j.created_at DESC
      LIMIT 1500
    `, params);

    const customers = new Map();
    for (const job of jobsResult.rows) {
      const phoneKey = String(job.customer_phone || "").replace(/[^0-9]/g, "");
      const nameKey = String(job.customer_name || "").trim().toLowerCase();
      const key = phoneKey || `${nameKey}|${String(job.postcode || "").trim().toLowerCase()}` || `job-${job.id}`;
      if (!customers.has(key)) {
        customers.set(key, {
          key,
          name: job.customer_name || "Unknown customer",
          phone: job.customer_phone || "",
          email: job.customer_email || "",
          lastPostcode: job.postcode || "",
          lastAddress: jobAddressPlain(job),
          lastJobAt: job.created_at,
          jobs: [],
          totalValue: 0,
          openJobs: 0,
          disputesHint: 0,
          campaigns: new Set(),
          postcodes: new Set()
        });
      }
      const customer = customers.get(key);
      customer.jobs.push(job);
      if (!customer.name || customer.name === "Unknown customer") customer.name = job.customer_name || customer.name;
      if (!customer.phone) customer.phone = job.customer_phone || "";
      if (!customer.email) customer.email = job.customer_email || "";
      if (!customer.lastPostcode) customer.lastPostcode = job.postcode || "";
      if (!customer.lastAddress) customer.lastAddress = jobAddressPlain(job);
      if (job.final_value) customer.totalValue += Number(job.final_value || 0);
      if (!["closed", "invoiced_account"].includes(job.status)) customer.openJobs += 1;
      if (job.source_campaign) customer.campaigns.add(job.source_campaign);
      if (job.postcode) customer.postcodes.add(job.postcode);
    }

    const list = Array.from(customers.values()).sort((a, b) => new Date(b.lastJobAt || 0) - new Date(a.lastJobAt || 0));
    const totalJobs = list.reduce((sum, c) => sum + c.jobs.length, 0);
    const totalValue = list.reduce((sum, c) => sum + c.totalValue, 0);
    const repeatCustomers = list.filter(c => c.jobs.length > 1).length;

    const rows = list.map(customer => {
      const phoneQuery = encodeURIComponent(customer.phone || "");
      const nameQuery = encodeURIComponent(customer.name || "");
      const postcodeList = Array.from(customer.postcodes).slice(0, 3).join(", ");
      const campaigns = Array.from(customer.campaigns).slice(0, 3).join(", ");
      return `
        <tr>
          <td><strong>${escapeHtml(customer.name || "Unknown")}</strong><br><span class="muted">${customer.phone ? `<a href="${escapeHtml(phoneHref(customer.phone))}">${escapeHtml(customer.phone)}</a>` : "No phone"}${customer.email ? ` · ${escapeHtml(customer.email)}` : ""}</span></td>
          <td>${customer.jobs.length}<br><span class="muted">${customer.openJobs} active</span></td>
          <td>${money(customer.totalValue)}<br><span class="muted">closed value</span></td>
          <td>${escapeHtml(postcodeList || customer.lastPostcode || "—")}</td>
          <td>${escapeHtml(campaigns || "—")}</td>
          <td>${formatDateTime(customer.lastJobAt)}</td>
          <td><a class="action-button" href="/customers/history?phone=${phoneQuery}&name=${nameQuery}">View history</a></td>
        </tr>
      `;
    }).join("");

    res.send(`
      <html>
        <head><title>Customers</title><style>${sharedStyles()}</style></head>
        <body>${nav(req)}<main class="app-main">
          <div class="page-header">
            <div>
              <h1>Customers</h1>
              <div class="subtitle">Search customers by name, phone, email, postcode or campaign and view full job history.</div>
            </div>
            <a class="action-button good" href="/jobs/new">+ Create order</a>
          </div>

          <div class="dashboard-grid cols-3">
            <div class="metric-card"><div class="metric-label">Customers found</div><div class="metric-value">${list.length}</div></div>
            <div class="metric-card"><div class="metric-label">Jobs in view</div><div class="metric-value">${totalJobs}</div></div>
            <div class="metric-card"><div class="metric-label">Repeat customers</div><div class="metric-value">${repeatCustomers}</div></div>
          </div>

          <div class="panel">
            <form class="search-form" method="GET" action="/customers">
              <input name="search" value="${escapeHtml(search)}" placeholder="Search name, phone, postcode, email, campaign...">
              <button class="action-button" type="submit">Search</button>
              <a class="secondary-button" href="/customers">Clear</a>
            </form>
          </div>

          <div class="panel">
            <h2>Customer list</h2>
            <table>
              <thead><tr><th>Customer</th><th>Jobs</th><th>Value</th><th>Postcodes</th><th>Campaigns</th><th>Last job</th><th>Action</th></tr></thead>
              <tbody>${rows || `<tr><td colspan="7">No customers found yet.</td></tr>`}</tbody>
            </table>
          </div>
        </main></body>
      </html>
    `);
  } catch (error) {
    console.error("Customers page error:", error);
    res.status(500).send(`Customers page error: ${escapeHtml(error.message)}. Check Render logs.`);
  }
});

app.get("/customers/history", async (req, res) => {
  try {
    await initDb();
    const phone = (req.query.phone || "").trim();
    const name = (req.query.name || "").trim();

    if (!phone && !name) {
      return res.redirect("/customers");
    }

    const params = [];
    let where = "";
    if (phone) {
      params.push(String(phone).replace(/[^0-9]/g, ""));
      where = `regexp_replace(COALESCE(j.customer_phone, ''), '[^0-9]', '', 'g') = $1`;
    } else {
      params.push(name.toLowerCase());
      where = `LOWER(COALESCE(j.customer_name, '')) = $1`;
    }

    const jobsResult = await pool.query(`
      SELECT j.*, t.name AS technician_name
      FROM jobs j
      LEFT JOIN technicians t ON t.id = j.assigned_technician_id
      WHERE ${where}
      ORDER BY j.created_at DESC
    `, params);

    const jobs = jobsResult.rows;
    const first = jobs[0] || {};
    const totalValue = jobs.reduce((sum, job) => sum + Number(job.final_value || 0), 0);
    const materialCost = jobs.reduce((sum, job) => sum + Number(job.materials_cost || 0), 0);
    const activeJobs = jobs.filter(job => !["closed", "invoiced_account"].includes(job.status)).length;
    const addresses = [...new Set(jobs.map(jobAddressPlain).filter(Boolean))].slice(0, 8);
    const campaigns = [...new Set(jobs.map(j => j.source_campaign).filter(Boolean))].slice(0, 8);

    const rows = jobs.map(job => `
      <tr>
        <td><strong>${escapeHtml(job.job_number || jobNumber(job.id))}</strong><br><span class="muted">${formatDateTime(job.created_at)}</span></td>
        <td><span class="board-status ${jobStatusClass(job.status)}">${escapeHtml(jobStatusLabel(job.status))}</span></td>
        <td>${escapeHtml(job.postcode || "—")}<br><span class="muted">${escapeHtml(job.job_type || "—")}</span></td>
        <td>${escapeHtml(job.technician_name || "Unassigned")}<br><span class="muted">${escapeHtml(job.source_campaign || "—")}</span></td>
        <td>${money(job.final_value || 0)}<br><span class="muted">Materials ${money(job.materials_cost || 0)}</span></td>
        <td>${escapeHtml(job.payment_method || job.expected_payment_method || "—")}</td>
        <td><a class="action-button" href="/jobs/${job.id}/edit">View job</a></td>
      </tr>
    `).join("");

    const phoneDisplay = first.customer_phone || phone;
    const customerName = first.customer_name || name || "Customer";

    res.send(`
      <html>
        <head><title>Customer History</title><style>${sharedStyles()}</style></head>
        <body>${nav(req)}<main class="app-main">
          <div class="page-header">
            <div>
              <h1>${escapeHtml(customerName)}</h1>
              <div class="subtitle">Customer job history${phoneDisplay ? ` · <a href="${escapeHtml(phoneHref(phoneDisplay))}">${escapeHtml(phoneDisplay)}</a>` : ""}${first.customer_email ? ` · ${escapeHtml(first.customer_email)}` : ""}</div>
            </div>
            <div class="button-row">
              <a class="secondary-button" href="/customers">Back to customers</a>
              <a class="action-button good" href="/jobs/new">+ Create order</a>
            </div>
          </div>

          <div class="dashboard-grid cols-4">
            <div class="metric-card"><div class="metric-label">Total jobs</div><div class="metric-value">${jobs.length}</div></div>
            <div class="metric-card"><div class="metric-label">Active jobs</div><div class="metric-value">${activeJobs}</div></div>
            <div class="metric-card"><div class="metric-label">Closed value</div><div class="metric-value">${money(totalValue)}</div></div>
            <div class="metric-card"><div class="metric-label">Materials cost</div><div class="metric-value">${money(materialCost)}</div></div>
          </div>

          <div class="grid-2">
            <div class="panel">
              <h2>Known addresses</h2>
              ${addresses.length ? addresses.map(addr => `<div class="linked-job-box">${escapeHtml(addr)}</div>`).join("<br>") : `<p class="muted">No addresses recorded.</p>`}
            </div>
            <div class="panel">
              <h2>Campaign / source history</h2>
              ${campaigns.length ? campaigns.map(c => `<span class="pill stage-approved">${escapeHtml(c)}</span>`).join(" ") : `<p class="muted">No campaign history recorded.</p>`}
              <hr>
              <p class="muted">Use this page while a repeat customer is on the phone to quickly check previous jobs, payments, materials and disputes raised from job records.</p>
            </div>
          </div>

          <div class="panel">
            <h2>Job history</h2>
            <table>
              <thead><tr><th>Job</th><th>Status</th><th>Postcode / Type</th><th>Technician / Campaign</th><th>Value</th><th>Payment</th><th>Action</th></tr></thead>
              <tbody>${rows || `<tr><td colspan="7">No jobs found for this customer.</td></tr>`}</tbody>
            </table>
          </div>
        </main></body>
      </html>
    `);
  } catch (error) {
    console.error("Customer history error:", error);
    res.status(500).send(`Customer history error: ${escapeHtml(error.message)}. Check Render logs.`);
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

    const result = await pool.query(`SELECT * FROM technicians WHERE active = TRUE ORDER BY updated_at DESC`);
    const candidates = result.rows.filter(tech => isUsableForDispatch(tech.status));

    const candidatesWithDistance = await Promise.all(candidates.map(async tech => {
      const techLocation = await getTechnicianDispatchLocation(tech);
      const location = {
        postcode: techLocation.postcode || "",
        source: techLocation.source || "Unknown"
      };

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
    }));

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
      .filter(item => {
        if (!item.techLocation || !item.techLocation.ok) return false;
        if (customerLocation && customerLocation.ok) return item.distance !== null && item.distance <= 25;
        return true;
      })
      .map((item, index) => {
        const tech = item.tech;
        return {
          rank: index + 1,
          name: tech.name || "",
          phone: tech.phone || "",
          status: tech.status || "",
          priority: tech.priority || "Normal",
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
      const precision = item.techLocation.ok ? item.techLocation.precision : postcodePrecision(item.location.postcode);
      const precisionText = precision === "Approx" ? `<span class="warning-text">Approx</span>` : escapeHtml(precision);
      const distanceText = customerPostcode ? formatDistance(item.distance) : "Enter postcode";

      return `
        <tr>
          <td>${index + 1}</td>
          <td><strong>${escapeHtml(tech.name)}</strong><br><span class="muted">${escapeHtml(tech.phone)}</span></td>
          <td><span class="pill ${statusClass}">${escapeHtml(tech.status)}</span></td>
          <td><span class="pill ${priorityBadgeClass}">${escapeHtml(priority)}</span></td>
          <td>${escapeHtml(tech.available_from || "Now / check")}</td>
          <td>${escapeHtml(item.location.postcode || "No postcode")}<br><span class="muted">${escapeHtml(item.location.source)} · ${precisionText}</span></td>
          <td><span class="distance">${distanceText}</span><br><span class="muted">Straight-line estimate</span></td>
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
        <title>Dispatch Map</title>
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
        <style>
          ${sharedStyles()}
          .leaflet-container { overflow: hidden; position: relative; outline-style: none; }
          .leaflet-pane, .leaflet-tile, .leaflet-marker-icon, .leaflet-marker-shadow, .leaflet-tile-container, .leaflet-pane > svg, .leaflet-pane > canvas, .leaflet-zoom-box, .leaflet-image-layer, .leaflet-layer { position: absolute; left: 0; top: 0; }
          .leaflet-container { font-family: Arial, sans-serif; font-size: 12px; line-height: 1.5; }
          .leaflet-tile, .leaflet-marker-icon, .leaflet-marker-shadow { user-select: none; -webkit-user-drag: none; }
          .leaflet-tile { filter: inherit; visibility: hidden; }
          .leaflet-tile-loaded { visibility: inherit; }
          .leaflet-zoom-animated { transform-origin: 0 0; }
          .leaflet-map-pane { z-index: 400; }
          .leaflet-tile-pane { z-index: 200; }
          .leaflet-overlay-pane { z-index: 400; }
          .leaflet-shadow-pane { z-index: 500; }
          .leaflet-marker-pane { z-index: 600; }
          .leaflet-tooltip-pane { z-index: 650; }
          .leaflet-popup-pane { z-index: 700; }
          .leaflet-control { position: relative; z-index: 800; pointer-events: auto; }
          .leaflet-top, .leaflet-bottom { position: absolute; z-index: 1000; pointer-events: none; }
          .leaflet-top { top: 0; }
          .leaflet-right { right: 0; }
          .leaflet-bottom { bottom: 0; }
          .leaflet-left { left: 0; }
          .leaflet-control-zoom { border: 2px solid rgba(0,0,0,0.2); background-clip: padding-box; border-radius: 4px; margin-left: 10px; margin-top: 10px; }
          .leaflet-control-zoom a { background-color: white; border-bottom: 1px solid #ccc; color: black; display: block; height: 26px; line-height: 26px; text-align: center; text-decoration: none; width: 26px; margin: 0; font-size: 18px; }
          .leaflet-popup { position: absolute; text-align: center; margin-bottom: 20px; }
          .leaflet-popup-content-wrapper { background: white; border-radius: 12px; padding: 1px; text-align: left; box-shadow: 0 3px 14px rgba(0,0,0,0.4); }
          .leaflet-popup-content { margin: 13px 19px; line-height: 1.45; color: #111827; }
          .leaflet-popup-tip-container { width: 40px; height: 20px; position: absolute; left: 50%; margin-left: -20px; overflow: hidden; pointer-events: none; }
          .leaflet-popup-tip { width: 17px; height: 17px; padding: 1px; margin: -10px auto 0; background: white; transform: rotate(45deg); box-shadow: 0 3px 14px rgba(0,0,0,0.4); }
          form.search { display: grid; grid-template-columns: 2fr 2fr 1fr; gap: 15px; }
          .notice { background: #1f2937; border-left: 5px solid #f59e0b; border-radius: 10px; padding: 18px; margin-bottom: 25px; color: #d1d5db; }
          .notice.good { border-left-color: #16a34a; }
          .notice.bad { border-left-color: #dc2626; }
          #dispatch-map { height: 680px; width: 100%; border-radius: 16px; overflow: hidden; border: 1px solid #374151; background: #111827; margin-bottom: 28px; }
          .map-summary { background: #1f2937; border: 1px solid #374151; border-radius: 14px; padding: 16px 20px; margin-bottom: 20px; color: #d1d5db; display: flex; flex-wrap: wrap; gap: 18px; align-items: center; }
          .legend-item { display: flex; align-items: center; gap: 8px; font-size: 14px; }
          .legend-dot { width: 13px; height: 13px; border-radius: 50%; display: inline-block; }
          .dot-customer { background: #a855f7; }
          .dot-available { background: #16a34a; }
          .dot-soon { background: #f59e0b; }
          .dot-onjob { background: #2563eb; }
          .dot-other { background: #6b7280; }
          .marker-label { background: white; border: 2px solid #111827; border-radius: 999px; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; color: #111827; font-weight: bold; font-size: 13px; box-shadow: 0 2px 8px rgba(0,0,0,0.35); }
          .marker-customer { background: #a855f7; color: white; }
          .marker-available { background: #16a34a; color: white; }
          .marker-soon { background: #f59e0b; color: black; }
          .marker-onjob { background: #2563eb; color: white; }
          .marker-other { background: #6b7280; color: white; }
          @media (max-width: 900px) { form.search { grid-template-columns: 1fr; } #dispatch-map { height: 540px; } }
        </style>
      </head>
      <body>
        ${nav(req)}
        <h1>Dispatch Map</h1>
        <div class="subtitle">Search a postcode to zoom into that region only</div>
        <div class="panel">
          <form class="search" method="GET" action="/dispatch">
            <input name="postcode" value="${escapeHtml(customerPostcode)}" placeholder="Customer postcode e.g. SE13 5BY">
            <input name="job_type" value="${escapeHtml(jobType)}" placeholder="Job type e.g. lockout, uPVC">
            <button type="submit">Find Locksmith</button>
          </form>
        </div>
        ${
          customerPostcode
            ? `<div class="notice ${customerLocation && customerLocation.ok ? "good" : "bad"}"><strong>${escapeHtml(customerPostcode)}</strong> — ${escapeHtml(customerLocationMessage)}<br>The map is zoomed into this postcode region. Technician pins shown are within roughly 25 miles.</div>`
            : `<div class="notice">Enter a customer postcode to zoom into that area and show nearby locksmiths.</div>`
        }
        <div class="map-summary">
          <div class="legend-item"><span class="legend-dot dot-customer"></span>Customer</div>
          <div class="legend-item"><span class="legend-dot dot-available"></span>Available</div>
          <div class="legend-item"><span class="legend-dot dot-soon"></span>Available soon</div>
          <div class="legend-item"><span class="legend-dot dot-onjob"></span>On job</div>
          <div class="legend-item"><span class="legend-dot dot-other"></span>Other usable status</div>
          <div class="legend-item muted">Straight-line distance only, not driving time.</div>
        </div>
        <div id="dispatch-map"></div>
        <h2>Ranked Technician List</h2>
        <table>
          <thead>
            <tr>
              <th>Rank</th><th>Technician</th><th>Status</th><th>Priority</th><th>Available From</th><th>Location</th><th>Distance</th><th>Skills</th><th>Notes</th><th>Last Updated</th>
            </tr>
          </thead>
          <tbody>${rows || `<tr><td colspan="10">No available technicians found</td></tr>`}</tbody>
        </table>
        <script>
          const mapData = ${mapDataJson};
          const map = L.map("dispatch-map", { scrollWheelZoom: true });

          L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
            maxZoom: 19,
            attribution: "&copy; OpenStreetMap contributors"
          }).addTo(map);

          setTimeout(function() { map.invalidateSize(); }, 250);

          const defaultLondonCentre = [51.5072, -0.1276];
          const hasCustomer = !!mapData.customer;

          if (hasCustomer) {
            const zoomLevel = mapData.customer.precision === "Exact" ? 14 : 12;
            map.setView([mapData.customer.latitude, mapData.customer.longitude], zoomLevel);
          } else {
            map.setView(defaultLondonCentre, 10);
          }

          function safeText(value) {
            return String(value || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
          }

          function markerClassForStatus(status) {
            const value = String(status || "").toLowerCase();
            if (value.includes("available") && !value.includes("soon")) return "marker-available";
            if (value.includes("soon")) return "marker-soon";
            if (value.includes("job")) return "marker-onjob";
            return "marker-other";
          }

          function makeNumberIcon(number, className) {
            return L.divIcon({
              className: "",
              html: '<div class="marker-label ' + className + '">' + number + '</div>',
              iconSize: [30, 30],
              iconAnchor: [15, 15],
              popupAnchor: [0, -15]
            });
          }

          if (mapData.customer) {
            const customerLatLng = [mapData.customer.latitude, mapData.customer.longitude];

            L.marker(customerLatLng, { icon: makeNumberIcon("C", "marker-customer") })
              .addTo(map)
              .bindPopup("<strong>Customer</strong><br>" + safeText(mapData.customer.postcode) + "<br>Precision: " + safeText(mapData.customer.precision))
              .openPopup();

            L.circle(customerLatLng, {
              radius: mapData.customer.precision === "Exact" ? 1200 : 4500,
              color: "#a855f7",
              fillColor: "#a855f7",
              fillOpacity: 0.08,
              weight: 2
            }).addTo(map);
          }

          const technicianBounds = [];

          mapData.technicians.forEach(function(tech) {
            const latLng = [tech.latitude, tech.longitude];
            technicianBounds.push(latLng);

            const distanceText = tech.distance === null ? "Distance unavailable" : tech.distance + " miles";

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

            L.marker(latLng, { icon: makeNumberIcon(tech.rank, markerClassForStatus(tech.status)) })
              .addTo(map)
              .bindPopup(popupHtml);
          });

          if (!hasCustomer && technicianBounds.length > 0) {
            map.fitBounds(technicianBounds, { padding: [45, 45], maxZoom: 11 });
          }
        </script>
      </body>
      </html>
    `);
  } catch (error) {
    console.error("Dispatch page error:", error);
    res.status(500).send("Dispatch page error. Check Render logs.");
  }
});




function technicianWorkspaceStyles() {
  return `
    :root {
      --bg:#f3f5f9; --card:#ffffff; --text:#172033; --muted:#64748b; --border:#dfe5ee;
      --red:#c9342b; --green:#16a34a; --amber:#f59e0b; --blue:#2563eb; --pink:#ec4899;
      --charcoal:#26323a; --soft:#f8fafc;
    }
    * { box-sizing:border-box; }
    body { margin:0; background:var(--bg); color:var(--text); font-family: Arial, Helvetica, sans-serif; }
    .topbar { height:70px; background:white; border-bottom:1px solid var(--border); display:flex; align-items:center; justify-content:space-between; padding:0 18px; position:sticky; top:0; z-index:5; }
    .brand { display:flex; align-items:center; gap:12px; font-weight:800; }
    .brand-badge { width:38px; height:38px; border-radius:10px; background:var(--red); color:white; display:flex; align-items:center; justify-content:center; font-weight:900; font-size:13px; }
    .live { display:inline-flex; align-items:center; gap:8px; background:#dcfce7; color:#166534; border-radius:999px; padding:7px 12px; font-weight:800; font-size:13px; }
    .wrap { max-width:1200px; margin:0 auto; padding:18px; }
    .briefing { position:fixed; inset:0; background:rgba(0,0,0,.72); display:flex; align-items:center; justify-content:center; z-index:20; padding:20px; }
    .brief-card { width:min(560px,100%); background:white; border-radius:18px; padding:34px; box-shadow:0 30px 70px rgba(0,0,0,.35); }
    .brief-pill { display:inline-block; border-radius:999px; padding:8px 16px; background:#fee2e2; color:var(--red); font-size:12px; font-weight:900; text-transform:uppercase; letter-spacing:.04em; margin-bottom:16px; }
    .brief-card h1 { margin:0 0 6px; font-size:28px; }
    .brief-card p { color:#475569; margin:0 0 22px; }
    .brief-line { border-left:5px solid var(--amber); background:#fff7ed; border-radius:10px; padding:13px 15px; margin:10px 0; line-height:1.35; }
    .brief-line.red { border-color:var(--red); background:#fee2e2; }
    .brief-line.green { border-color:var(--green); background:#dcfce7; }
    .brief-button { display:block; width:100%; background:var(--red); color:white; text-align:center; border:0; border-radius:10px; padding:17px 18px; margin-top:24px; font-weight:900; cursor:pointer; font-size:15px; }
    .tabs { display:flex; gap:10px; margin:18px 0; flex-wrap:wrap; }
    .tab { display:inline-flex; align-items:center; gap:8px; padding:11px 16px; border:1px solid var(--border); border-radius:12px; background:white; color:var(--text); text-decoration:none; font-weight:800; }
    .tab.active { background:var(--charcoal); color:white; border-color:var(--charcoal); }
    .toolbar { display:grid; grid-template-columns:2fr 1fr 1fr auto; gap:10px; margin:14px 0; }
    input, select, textarea { width:100%; border:1px solid var(--border); border-radius:10px; padding:12px; font-size:15px; background:white; color:var(--text); }
    textarea { min-height:95px; resize:vertical; }
    .button { border:0; border-radius:10px; padding:12px 16px; font-weight:900; cursor:pointer; text-decoration:none; display:inline-flex; align-items:center; justify-content:center; gap:8px; }
    .button.red { background:var(--red); color:white; }
    .button.green { background:var(--green); color:white; }
    .button.dark { background:var(--charcoal); color:white; }
    .button.amber { background:var(--amber); color:#111827; }
    .summary-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:14px; margin:18px 0; }
    .metric { background:white; border:1px solid var(--border); border-radius:16px; padding:18px; box-shadow:0 12px 25px rgba(15,23,42,.04); }
    .metric .label { color:var(--muted); font-size:12px; font-weight:900; text-transform:uppercase; letter-spacing:.05em; }
    .metric .value { font-size:30px; font-weight:900; margin-top:8px; color:var(--text); }
    .job-card { background:white; border:1px solid var(--border); border-radius:16px; padding:18px; margin:14px 0; box-shadow:0 12px 25px rgba(15,23,42,.04); }
    .job-head { display:flex; justify-content:space-between; gap:14px; align-items:flex-start; }
    .job-title { font-size:22px; font-weight:900; margin:0; }
    .job-sub { color:var(--muted); line-height:1.45; margin-top:5px; }
    .pill { display:inline-block; border-radius:999px; padding:7px 11px; font-size:12px; font-weight:900; white-space:nowrap; }
    .job-open { background:var(--blue); color:white; }
    .job-assigned { background:var(--green); color:white; }
    .job-closed { background:var(--red); color:white; }
    .job-awaiting-payment { background:var(--amber); color:#111827; }
    .job-invoiced-account { background:var(--pink); color:white; }
    .job-completed, .job-fully-paid-private { background:#64748b; color:white; }
    .actions { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:16px; }
    .panel { background:white; border:1px solid var(--border); border-radius:16px; padding:18px; box-shadow:0 12px 25px rgba(15,23,42,.04); margin:14px 0; }
    .field-grid { display:grid; grid-template-columns:repeat(2,1fr); gap:14px; }
    .full { grid-column:1/-1; }
    label { display:block; font-size:13px; font-weight:900; color:#334155; margin-bottom:6px; }
    table { width:100%; border-collapse:collapse; background:white; border-radius:16px; overflow:hidden; border:1px solid var(--border); }
    th,td { padding:12px; border-bottom:1px solid var(--border); text-align:left; font-size:14px; }
    th { background:#f8fafc; color:#64748b; font-size:12px; text-transform:uppercase; letter-spacing:.04em; }
    .empty { background:white; border:1px dashed var(--border); padding:30px; border-radius:16px; text-align:center; color:var(--muted); }
    .money { font-weight:900; }
    @media(max-width:760px){
      .topbar { height:auto; padding:12px; align-items:flex-start; }
      .wrap { padding:12px; }
      .toolbar, .summary-grid, .field-grid, .actions { grid-template-columns:1fr; }
      .brief-card { padding:24px; }
      table { display:block; overflow-x:auto; }
    }
  `;
}

function technicianPortalShell(title, bodyHtml) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>${escapeHtml(title)}</title>
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style>${technicianWorkspaceStyles()}</style>
    </head>
    <body>${bodyHtml}</body>
    </html>
  `;
}

function techJobAddress(job) {
  return [job.address_line_1, job.address_line_2, job.address_line_3, job.town, job.county, job.postcode]
    .filter(Boolean)
    .join(', ');
}

function techPaymentOptions(selected = '') {
  return optionList(['Cash', 'Card', 'BACS', 'Cheque', 'Bank transfer', 'Account', 'Other'], selected);
}

function technicianWorkspaceTabs(token, active) {
  return `
    <div class="tabs">
      <a class="tab ${active === 'jobs' ? 'active' : ''}" href="/tech-workspace/${escapeHtml(token)}">Active jobs</a>
      <a class="tab ${active === 'summary' ? 'active' : ''}" href="/tech-workspace/${escapeHtml(token)}/summary">Income summary</a>
      <a class="tab" href="/tech-checkin/${escapeHtml(token)}">Status check-in</a>
    </div>
  `;
}


async function ensureTechnicianWorkspaceSchema() {
  await pool.query(`ALTER TABLE technicians ADD COLUMN IF NOT EXISTS checkin_token TEXT;`);
  await pool.query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS assigned_technician_id INTEGER;`);
  await pool.query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS onsite_at TIMESTAMP;`);
  await pool.query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS tech_updated_at TIMESTAMP;`);
  await pool.query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS tech_close_submitted_by TEXT;`);
  await pool.query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS final_value NUMERIC(10,2);`);
  await pool.query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS payment_method TEXT;`);
  await pool.query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS customer_paid BOOLEAN DEFAULT FALSE;`);
  await pool.query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS materials_used TEXT;`);
  await pool.query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS materials_cost NUMERIC(10,2);`);
  await pool.query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS outcome TEXT;`);
  await pool.query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS tech_notes TEXT;`);
  await pool.query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS closed_by TEXT;`);
  await pool.query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS closed_at TIMESTAMP;`);
}

async function getTechnicianByToken(token) {
  const result = await pool.query(`SELECT * FROM technicians WHERE checkin_token = $1 AND active = TRUE`, [token]);
  return result.rows[0];
}

app.get('/tech-workspace/:token', async (req, res) => {
  try {
    await ensureTechnicianWorkspaceSchema();
    const token = req.params.token;
    const tech = await getTechnicianByToken(token);
    if (!tech) return res.status(404).send(technicianPortalShell('Invalid technician link', `<div class="wrap"><div class="empty">Invalid technician workspace link.</div></div>`));

    const statusFilter = (req.query.status || '').trim();
    const postcode = (req.query.postcode || '').trim();
    const phone = (req.query.phone || '').trim();

    // Match by this technician ID, and also by any duplicate technician record with the same name.
    // This protects us if a technician was added twice or a job was assigned to an older Ruben/Michele/etc record.
    const values = [tech.id, tech.name];
    let where = `WHERE (j.assigned_technician_id = $1 OR j.assigned_technician_id IN (SELECT id FROM technicians WHERE LOWER(name) = LOWER($2))) AND COALESCE(j.status, 'open') NOT IN ('closed', 'invoiced_account')`;
    if (statusFilter) { values.push(statusFilter); where += ` AND j.status = $${values.length}`; }
    if (postcode) { values.push(`%${postcode}%`); where += ` AND COALESCE(j.postcode, '') ILIKE $${values.length}`; }
    if (phone) { values.push(`%${phone}%`); where += ` AND COALESCE(j.customer_phone, '') ILIKE $${values.length}`; }

    const jobs = (await pool.query(`
      SELECT j.*
      FROM jobs j
      ${where}
      ORDER BY
        CASE COALESCE(j.status, 'open')
          WHEN 'assigned' THEN 1
          WHEN 'open' THEN 2
          WHEN 'awaiting_payment' THEN 3
          ELSE 4
        END,
        j.created_at DESC
    `, values)).rows;

    const today = new Date();
    const greeting = today.getHours() < 12 ? 'Good morning' : today.getHours() < 17 ? 'Good afternoon' : 'Good evening';
    const briefingLines = [
      `<div class="brief-line red"><strong>${jobs.length} active job${jobs.length === 1 ? '' : 's'}</strong> assigned to you.</div>`,
      `<div class="brief-line">Remember to press <strong>On site</strong> when you arrive.</div>`,
      `<div class="brief-line green">Close jobs with final value, payment method and materials used.</div>`
    ].join('');

    const jobCards = jobs.map(job => `
      <div class="job-card">
        <div class="job-head">
          <div>
            <h2 class="job-title">${escapeHtml(job.postcode || job.job_number || 'Job')}</h2>
            <div class="job-sub">
              ${escapeHtml(job.job_type || 'Job')} ${job.source_campaign ? `· ${escapeHtml(job.source_campaign)}` : ''}<br>
              ${escapeHtml(job.customer_name || 'Customer')} ${job.customer_phone ? `· <a href="tel:${escapeHtml(job.customer_phone)}">${escapeHtml(job.customer_phone)}</a>` : ''}<br>
              ${escapeHtml(techJobAddress(job) || 'Address not set')}<br>
              ${job.eta ? `ETA: ${escapeHtml(job.eta)}<br>` : ''}
              ${job.job_description ? `<strong>Job notes:</strong> ${escapeHtml(job.job_description)}<br>` : ''}
              ${job.dispatcher_notes ? `<strong>Office notes:</strong> ${escapeHtml(job.dispatcher_notes)}` : ''}
            </div>
          </div>
          <span class="pill ${jobStatusClass(job.status)}">${escapeHtml(jobStatusLabel(job.status))}</span>
        </div>
        <div class="actions">
          <form method="POST" action="/tech-workspace/${escapeHtml(token)}/job/${job.id}/onsite">
            <button class="button red" type="submit">On site</button>
          </form>
          <a class="button green" href="/tech-workspace/${escapeHtml(token)}/job/${job.id}/close">Close job</a>
        </div>
      </div>
    `).join('');

    const body = `
      <div class="briefing" id="briefing">
        <div class="brief-card">
          <div class="brief-pill">Technician briefing — ${escapeHtml(formatDate(new Date()))}</div>
          <h1>${greeting}, ${escapeHtml(tech.name)}.</h1>
          <p>Here is what needs your attention before you start.</p>
          ${briefingLines}
          <button class="brief-button" onclick="document.getElementById('briefing').style.display='none'">Start shift — view jobs</button>
        </div>
      </div>
      <div class="topbar">
        <div class="brand"><span class="brand-badge">24H</span><span>${escapeHtml(tech.name)}</span></div>
        <div class="live">● ${escapeHtml(tech.status || 'Available')}</div>
      </div>
      <div class="wrap">
        ${technicianWorkspaceTabs(token, 'jobs')}
        <h1>Your active jobs</h1>
        <form class="toolbar" method="GET" action="/tech-workspace/${escapeHtml(token)}">
          <input name="postcode" value="${escapeHtml(postcode)}" placeholder="Postcode">
          <input name="phone" value="${escapeHtml(phone)}" placeholder="Phone">
          <select name="status"><option value="">All statuses</option>${jobStatusOptions(statusFilter)}</select>
          <button class="button dark" type="submit">Filter</button>
        </form>
        ${jobCards || `<div class="empty"><strong>No active jobs assigned to ${escapeHtml(tech.name)}.</strong><br><br>If you have just assigned a job, check the Client order edit page and make sure the technician dropdown is set to ${escapeHtml(tech.name)} and the status is not Closed or Invoice sent to Acc Dept.</div>`}
      </div>
    `;

    res.send(technicianPortalShell('Technician Workspace', body));
  } catch (error) {
    console.error('Technician workspace error:', error);
    res.status(500).send('Technician workspace error: ' + escapeHtml(error.message || 'Unknown error') + '. Check Render logs.');
  }
});

app.post('/tech-workspace/:token/job/:id/onsite', async (req, res) => {
  try {
    await ensureTechnicianWorkspaceSchema();
    const token = req.params.token;
    const tech = await getTechnicianByToken(token);
    if (!tech) return res.status(404).send('Invalid technician link');

    await pool.query(`
      UPDATE jobs
      SET status = 'assigned', onsite_at = NOW(), tech_updated_at = NOW(), updated_at = NOW()
      WHERE id = $1
        AND (assigned_technician_id = $2 OR assigned_technician_id IN (SELECT id FROM technicians WHERE LOWER(name) = LOWER($3)))
    `, [req.params.id, tech.id, tech.name]);

    await pool.query(`
      UPDATE technicians
      SET status = 'On job', updated_by = $1, updated_at = NOW()
      WHERE id = $2
    `, [`${tech.name} workspace`, tech.id]);

    res.redirect(`/tech-workspace/${encodeURIComponent(token)}`);
  } catch (error) {
    console.error('Technician on-site error:', error);
    res.status(500).send('Technician on-site error. Check Render logs.');
  }
});

app.get('/tech-workspace/:token/job/:id/close', async (req, res) => {
  try {
    await ensureTechnicianWorkspaceSchema();
    const token = req.params.token;
    const tech = await getTechnicianByToken(token);
    if (!tech) return res.status(404).send(technicianPortalShell('Invalid technician link', `<div class="wrap"><div class="empty">Invalid technician workspace link.</div></div>`));

    const result = await pool.query(`
      SELECT * FROM jobs
      WHERE id = $1
        AND (assigned_technician_id = $2 OR assigned_technician_id IN (SELECT id FROM technicians WHERE LOWER(name) = LOWER($3)))
    `, [req.params.id, tech.id, tech.name]);
    const job = result.rows[0];
    if (!job) return res.status(404).send(technicianPortalShell('Job not found', `<div class="wrap"><div class="empty">Job not found for this technician.</div></div>`));

    const body = `
      <div class="topbar">
        <div class="brand"><span class="brand-badge">24H</span><span>${escapeHtml(tech.name)}</span></div>
        <a class="button dark" href="/tech-workspace/${escapeHtml(token)}">Back to jobs</a>
      </div>
      <div class="wrap">
        ${technicianWorkspaceTabs(token, 'jobs')}
        <div class="panel">
          <h1>Close job</h1>
          <p class="job-sub"><strong>${escapeHtml(job.postcode || job.job_number || 'Job')}</strong> · ${escapeHtml(job.job_type || '')} · ${escapeHtml(job.customer_name || '')}</p>
          <p class="job-sub">${escapeHtml(techJobAddress(job) || '')}</p>
          <form method="POST" action="/tech-workspace/${escapeHtml(token)}/job/${job.id}/close">
            <div class="field-grid">
              <div><label>Final job value</label><input name="final_value" value="${job.final_value || ''}" placeholder="£"></div>
              <div><label>Payment method</label><select name="payment_method">${techPaymentOptions(job.payment_method || '')}</select></div>
              <div><label>Customer paid?</label><select name="customer_paid"><option value="yes" ${job.customer_paid ? 'selected' : ''}>Yes</option><option value="no" ${!job.customer_paid ? 'selected' : ''}>No</option></select></div>
              <div><label>New status</label><select name="status">
                <option value="closed">Closed</option>
                <option value="awaiting_payment">Awaiting payment</option>
                <option value="invoiced_account">Invoice sent to Acc Dept</option>
              </select></div>
              <div class="full"><label>Materials used</label><textarea name="materials_used" placeholder="e.g. Euro cylinder, night latch, screws">${escapeHtml(job.materials_used || '')}</textarea></div>
              <div><label>Materials cost</label><input name="materials_cost" value="${job.materials_cost || ''}" placeholder="£"></div>
              <div><label>Outcome</label><select name="outcome">${optionList(jobOutcomes, job.outcome || 'Completed')}</select></div>
              <div class="full"><label>Technician notes</label><textarea name="tech_notes" placeholder="Any notes for the office">${escapeHtml(job.tech_notes || '')}</textarea></div>
            </div>
            <br>
            <button class="button green" type="submit">Submit close job</button>
          </form>
        </div>
      </div>
    `;

    res.send(technicianPortalShell('Close job', body));
  } catch (error) {
    console.error('Technician close page error:', error);
    res.status(500).send('Technician close page error: ' + escapeHtml(error.message || 'Unknown error') + '. Check Render logs.');
  }
});

app.post('/tech-workspace/:token/job/:id/close', async (req, res) => {
  try {
    await ensureTechnicianWorkspaceSchema();
    const token = req.params.token;
    const tech = await getTechnicianByToken(token);
    if (!tech) return res.status(404).send('Invalid technician link');

    const finalValue = parseMoneyInput(req.body.final_value);
    const materialsCost = parseMoneyInput(req.body.materials_cost);
    const allowedStatuses = ['closed', 'awaiting_payment', 'invoiced_account'];
    const newStatus = allowedStatuses.includes(req.body.status) ? req.body.status : 'closed';

    await pool.query(`
      UPDATE jobs
      SET final_value = $1,
          payment_method = $2,
          customer_paid = $3,
          materials_used = $4,
          materials_cost = $5,
          outcome = $6,
          tech_notes = $7,
          status = $8,
          closed_by = $9,
          closed_at = COALESCE(closed_at, NOW()),
          tech_updated_at = NOW(),
          tech_close_submitted_by = $9,
          updated_at = NOW()
      WHERE id = $10
        AND (assigned_technician_id = $11 OR assigned_technician_id IN (SELECT id FROM technicians WHERE LOWER(name) = LOWER($12)))
    `, [
      finalValue,
      req.body.payment_method || '',
      req.body.customer_paid === 'yes',
      req.body.materials_used || '',
      materialsCost,
      req.body.outcome || '',
      req.body.tech_notes || '',
      newStatus,
      tech.name,
      req.params.id,
      tech.id,
      tech.name
    ]);

    await pool.query(`
      UPDATE technicians
      SET status = CASE WHEN status = 'On job' THEN 'Available' ELSE status END,
          updated_by = $1,
          updated_at = NOW()
      WHERE id = $2
    `, [`${tech.name} closed job`, tech.id]);

    res.redirect(`/tech-workspace/${encodeURIComponent(token)}/summary`);
  } catch (error) {
    console.error('Technician close submit error:', error);
    res.status(500).send('Technician close submit error: ' + escapeHtml(error.message || 'Unknown error') + '. Check Render logs.');
  }
});

app.get('/tech-workspace/:token/summary', async (req, res) => {
  try {
    await ensureTechnicianWorkspaceSchema();
    const token = req.params.token;
    const tech = await getTechnicianByToken(token);
    if (!tech) return res.status(404).send(technicianPortalShell('Invalid technician link', `<div class="wrap"><div class="empty">Invalid technician workspace link.</div></div>`));

    const period = req.query.period || 'today';
    let start = new Date();
    let end = new Date();
    start.setHours(0,0,0,0);
    end.setHours(23,59,59,999);
    if (period === 'week') {
      const day = start.getDay() || 7;
      start.setDate(start.getDate() - day + 1);
    } else if (period === 'month') {
      start = new Date(start.getFullYear(), start.getMonth(), 1);
    } else if (period === 'custom') {
      if (req.query.start) start = new Date(req.query.start + 'T00:00:00');
      if (req.query.end) end = new Date(req.query.end + 'T23:59:59');
    }

    const rows = (await pool.query(`
      SELECT * FROM jobs
      WHERE (assigned_technician_id = $1 OR assigned_technician_id IN (SELECT id FROM technicians WHERE LOWER(name) = LOWER($2)))
        AND COALESCE(closed_at, updated_at, created_at) BETWEEN $3 AND $4
        AND (final_value IS NOT NULL OR materials_cost IS NOT NULL OR status IN ('closed','awaiting_payment','invoiced_account'))
      ORDER BY COALESCE(closed_at, updated_at, created_at) DESC
    `, [tech.id, tech.name, start, end])).rows;

    const totalIncome = rows.reduce((sum, row) => sum + Number(row.final_value || 0), 0);
    const totalMaterials = rows.reduce((sum, row) => sum + Number(row.materials_cost || 0), 0);
    const net = totalIncome - totalMaterials;
    const paidCount = rows.filter(row => row.customer_paid).length;

    const payments = {};
    rows.forEach(row => {
      const key = row.payment_method || 'Unknown';
      payments[key] = (payments[key] || 0) + Number(row.final_value || 0);
    });

    const paymentRows = Object.entries(payments).sort((a,b)=>b[1]-a[1]).map(([method,total]) => `
      <tr><td>${escapeHtml(method)}</td><td class="money">${money(total)}</td></tr>
    `).join('');

    const jobRows = rows.map(job => `
      <tr>
        <td><span class="pill ${jobStatusClass(job.status)}">${escapeHtml(jobStatusLabel(job.status))}</span></td>
        <td>${escapeHtml(job.postcode || '')}</td>
        <td>${escapeHtml(job.job_type || '')}</td>
        <td>${escapeHtml(job.payment_method || '')}</td>
        <td class="money">${money(job.final_value || 0)}</td>
        <td class="money">${money(job.materials_cost || 0)}</td>
        <td>${formatDateTime(job.closed_at || job.updated_at || job.created_at)}</td>
      </tr>
    `).join('');

    const body = `
      <div class="topbar">
        <div class="brand"><span class="brand-badge">24H</span><span>${escapeHtml(tech.name)}</span></div>
        <div class="live">● Summary</div>
      </div>
      <div class="wrap">
        ${technicianWorkspaceTabs(token, 'summary')}
        <h1>Income summary</h1>
        <form class="toolbar" method="GET" action="/tech-workspace/${escapeHtml(token)}/summary">
          <select name="period">
            <option value="today" ${period === 'today' ? 'selected' : ''}>Today</option>
            <option value="week" ${period === 'week' ? 'selected' : ''}>This week</option>
            <option value="month" ${period === 'month' ? 'selected' : ''}>This month</option>
            <option value="custom" ${period === 'custom' ? 'selected' : ''}>Custom range</option>
          </select>
          <input name="start" type="date" value="${escapeHtml(req.query.start || '')}">
          <input name="end" type="date" value="${escapeHtml(req.query.end || '')}">
          <button class="button dark" type="submit">Filter</button>
        </form>
        <div class="summary-grid">
          <div class="metric"><div class="label">Jobs</div><div class="value">${rows.length}</div></div>
          <div class="metric"><div class="label">Income</div><div class="value">${money(totalIncome)}</div></div>
          <div class="metric"><div class="label">Materials</div><div class="value">${money(totalMaterials)}</div></div>
          <div class="metric"><div class="label">After materials</div><div class="value">${money(net)}</div></div>
        </div>
        <div class="panel">
          <h2>Payment methods</h2>
          <table><thead><tr><th>Payment method</th><th>Total</th></tr></thead><tbody>${paymentRows || `<tr><td colspan="2">No payment data for this range.</td></tr>`}</tbody></table>
        </div>
        <div class="panel">
          <h2>Materials used / closed jobs</h2>
          <table><thead><tr><th>Status</th><th>Postcode</th><th>Job type</th><th>Payment</th><th>Income</th><th>Materials</th><th>Closed/Updated</th></tr></thead><tbody>${jobRows || `<tr><td colspan="7">No jobs for this range.</td></tr>`}</tbody></table>
        </div>
      </div>
    `;

    res.send(technicianPortalShell('Technician Summary', body));
  } catch (error) {
    console.error('Technician summary error:', error);
    res.status(500).send('Technician summary error: ' + escapeHtml(error.message || 'Unknown error') + '. Check Render logs.');
  }
});

app.get("/tech-checkin/:token", async (req, res) => {
  try {
    const result = await pool.query(`SELECT * FROM technicians WHERE checkin_token = $1 AND active = TRUE`, [req.params.token]);
    const tech = result.rows[0];

    if (!tech) {
      return res.status(404).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Check-In Link Not Found</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            :root {
              --charcoal: #26323A;
              --charcoal-2: #1E272E;
              --green: #2EBD2E;
              --green-dark: #188A18;
              --red: #D9462E;
              --amber: #F2C94C;
              --page: #F5F6F8;
              --card: #FFFFFF;
              --border: #E5E7EB;
              --text: #25313A;
              --muted: #6B7280;
            }
            body {
              margin: 0;
              font-family: Arial, sans-serif;
              background: var(--page);
              color: var(--text);
              padding: 20px;
            }
            .box {
              max-width: 560px;
              margin: 60px auto;
              background: var(--card);
              border-radius: 24px;
              padding: 28px;
              border: 1px solid var(--border);
              box-shadow: 0 18px 40px rgba(38, 50, 58, 0.12);
            }
            .logo-wrap { text-align: center; margin-bottom: 22px; }
            .logo-wrap img { max-width: 250px; width: 78%; height: auto; }
            h1 { margin: 0 0 8px; color: var(--charcoal); }
            p { color: var(--muted); line-height: 1.5; }
          </style>
        </head>
        <body>
          <div class="box">
            <div class="logo-wrap"><img src="/brand-logo.png" alt="Your Dispatch Partner"></div>
            <h1>Link not found</h1>
            <p>This technician check-in link is not valid. Ask the office for a new link.</p>
          </div>
        </body>
        </html>
      `);
    }

    const statusOptions = ["Available", "On job", "Available soon", "Off today"]
      .map(status => `<option ${status === tech.status ? "selected" : ""}>${escapeHtml(status)}</option>`)
      .join("");

    const statusClass = technicianStatusClass(tech.status);

    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Technician Check-In</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          :root {
            --charcoal: #26323A;
            --charcoal-2: #1E272E;
            --green: #2EBD2E;
            --green-dark: #188A18;
            --red: #D9462E;
            --red-dark: #B73421;
            --amber: #F2C94C;
            --amber-dark: #B98A12;
            --blue: #2563EB;
            --page: #F5F6F8;
            --card: #FFFFFF;
            --border: #E5E7EB;
            --text: #25313A;
            --muted: #6B7280;
            --soft: #F9FAFB;
          }
          * { box-sizing: border-box; }
          body {
            font-family: Arial, sans-serif;
            background: var(--page);
            color: var(--text);
            padding: 16px;
            margin: 0;
          }
          .wrap { max-width: 620px; margin: 0 auto; }
          .brand-card {
            background: var(--charcoal);
            border-radius: 28px;
            padding: 20px 20px 22px;
            margin: 0 0 16px;
            box-shadow: 0 18px 40px rgba(38, 50, 58, 0.18);
            color: white;
          }
          .logo-panel {
            background: white;
            border-radius: 22px;
            padding: 16px;
            text-align: center;
            margin-bottom: 18px;
          }
          .logo-panel img { max-width: 275px; width: 82%; height: auto; display: inline-block; }
          .brand-kicker {
            font-size: 13px;
            text-transform: uppercase;
            letter-spacing: .08em;
            color: #C8D0D6;
            margin-bottom: 8px;
            font-weight: bold;
          }
          h1 { font-size: 34px; margin: 0 0 8px; letter-spacing: -0.02em; }
          h2 { margin: 0 0 16px; color: var(--charcoal); }
          .subtitle { color: #E5E7EB; margin-bottom: 14px; line-height: 1.45; }
          .card {
            background: var(--card);
            border: 1px solid var(--border);
            border-radius: 24px;
            padding: 22px;
            margin-bottom: 16px;
            box-shadow: 0 10px 24px rgba(38, 50, 58, 0.06);
          }
          .status-pill {
            display: inline-block;
            padding: 9px 14px;
            border-radius: 999px;
            font-weight: bold;
            font-size: 14px;
            background: var(--blue);
            color: white;
            margin-bottom: 14px;
          }
          .status-available { background: var(--green-dark); }
          .status-soon { background: var(--amber); color: #111827; }
          .status-job { background: var(--blue); }
          .status-off { background: #6B7280; }
          .last {
            background: rgba(255,255,255,0.08);
            border: 1px solid rgba(255,255,255,0.14);
            border-radius: 18px;
            padding: 14px;
            color: #E5E7EB;
            line-height: 1.5;
            font-size: 15px;
          }
          input, select, textarea, button {
            width: 100%;
            box-sizing: border-box;
            font-size: 17px;
            padding: 14px;
            border-radius: 14px;
            border: 1px solid var(--border);
            margin-bottom: 12px;
          }
          input, select, textarea {
            background: #FFFFFF;
            color: var(--text);
          }
          textarea { min-height: 96px; resize: vertical; }
          button {
            border: none;
            color: white;
            font-weight: bold;
            cursor: pointer;
            transition: transform .12s ease, opacity .12s ease;
          }
          button:active { transform: scale(0.99); }
          .big-button {
            font-size: 19px;
            padding: 18px;
            margin-bottom: 12px;
            box-shadow: 0 8px 18px rgba(38, 50, 58, 0.10);
          }
          .available { background: var(--green-dark); }
          .job { background: var(--blue); }
          .soon { background: var(--amber); color: #111827; }
          .off { background: #6b7280; }
          .manual { background: var(--charcoal); }
          .danger { background: var(--red); }
          .message {
            display: none;
            padding: 14px;
            border-radius: 16px;
            margin-bottom: 16px;
            line-height: 1.4;
            font-weight: bold;
          }
          .message.good { background: #DCFCE7; color: #14532D; border: 1px solid #86EFAC; display: block; }
          .message.bad { background: #FEE2E2; color: #7F1D1D; border: 1px solid #FCA5A5; display: block; }
          .help {
            background: var(--soft);
            border: 1px solid var(--border);
            border-left: 5px solid var(--amber);
            border-radius: 16px;
            color: var(--muted);
            font-size: 14px;
            line-height: 1.45;
            padding: 14px;
          }
          .small { font-size: 13px; color: #C8D0D6; }
          .field-label { font-size: 13px; color: var(--muted); font-weight: bold; margin: 0 0 6px; }
        </style>
        <script>
          const token = ${JSON.stringify(req.params.token)};

          function setMessage(text, type) {
            const box = document.getElementById("message");
            box.textContent = text;
            box.className = "message " + (type || "good");
          }

          function getFormValues(statusOverride) {
            return {
              status: statusOverride || document.getElementById("status").value,
              current_postcode: document.getElementById("current_postcode").value,
              available_from: document.getElementById("available_from").value,
              notes: document.getElementById("notes").value
            };
          }

          async function sendUpdate(payload) {
            const response = await fetch("/tech-checkin/" + token, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload)
            });

            const json = await response.json();

            if (!response.ok || !json.ok) {
              throw new Error(json.error || "Update failed");
            }

            setMessage(json.message || "Updated successfully.", "good");

            if (json.reload) {
              setTimeout(() => window.location.reload(), 900);
            }
          }

          function updateWithLocation(statusOverride) {
            setMessage("Getting your location. Your phone may ask for permission.", "good");

            if (!navigator.geolocation) {
              setMessage("Your phone/browser does not support location check-in. You can still save postcode/status manually below.", "bad");
              return;
            }

            navigator.geolocation.getCurrentPosition(async function(position) {
              try {
                const values = getFormValues(statusOverride);

                await sendUpdate({
                  ...values,
                  latitude: position.coords.latitude,
                  longitude: position.coords.longitude,
                  accuracy: position.coords.accuracy,
                  use_gps: true
                });
              } catch (error) {
                setMessage(error.message, "bad");
              }
            }, function(error) {
              let text = "Location permission was not allowed or GPS was unavailable. You can still save your postcode/status manually below.";
              if (error && error.message) text += " " + error.message;
              setMessage(text, "bad");
            }, {
              enableHighAccuracy: true,
              timeout: 12000,
              maximumAge: 60000
            });
          }

          async function manualUpdate(statusOverride) {
            try {
              const values = getFormValues(statusOverride);
              await sendUpdate({
                ...values,
                use_gps: false
              });
            } catch (error) {
              setMessage(error.message, "bad");
            }
          }
        </script>
      </head>
      <body>
        <div class="wrap">
          <div class="brand-card">
            <div class="logo-panel">
              <img src="/brand-logo.png" alt="Your Dispatch Partner" onerror="this.style.display='none';">
            </div>
            <div class="brand-kicker">Technician portal</div>
            <h1>${escapeHtml(tech.name)}</h1>
            <div class="subtitle">Update your status and location for dispatch.</div>
            <div class="status-pill ${escapeHtml(statusClass)}">${escapeHtml(tech.status || "No status")}</div>
            <div class="last">
              <strong>Last GPS check-in:</strong><br>
              ${escapeHtml(locationFreshnessText(tech.location_checked_in_at))}
              ${tech.location_checked_in_at ? `<br>${escapeHtml(formatDateTimeWithSeconds(tech.location_checked_in_at))}` : ""}
              ${tech.location_accuracy ? `<br><span class="small">Accuracy: roughly ${escapeHtml(tech.location_accuracy)} metres</span>` : ""}
            </div>
          </div>

          <div id="message" class="message"></div>

          <div class="card">
            <h2>Quick check-in</h2>
            <button class="big-button available" onclick="updateWithLocation('Available')">Available + update my location</button>
            <button class="big-button job" onclick="updateWithLocation('On job')">On job + update my location</button>
            <button class="big-button soon" onclick="updateWithLocation('Available soon')">Available soon + update my location</button>
            <button class="big-button off" onclick="manualUpdate('Off today')">Off today</button>
            <div class="help">
              This is not background tracking. Your location only updates when you press one of the location buttons.
            </div>
          </div>

          <div class="card">
            <h2>Manual details</h2>
            <div class="field-label">Status</div>
            <select id="status">${statusOptions}</select>
            <div class="field-label">Current postcode</div>
            <input id="current_postcode" value="${escapeHtml(tech.current_postcode || "")}" placeholder="Current postcode e.g. W3 7AR">
            <div class="field-label">Available from</div>
            <input id="available_from" value="${escapeHtml(tech.available_from || "")}" placeholder="Available from e.g. 14:30 / 30 mins">
            <div class="field-label">Notes for dispatch</div>
            <textarea id="notes" placeholder="Notes for dispatch">${escapeHtml(tech.notes || "")}</textarea>
            <button class="manual" onclick="manualUpdate()">Save without GPS</button>
            <button class="available" onclick="updateWithLocation()">Save and update GPS location</button>
          </div>
        </div>
      </body>
      </html>
    `);
  } catch (error) {
    console.error("Tech check-in page error:", error);
    res.status(500).send("Tech check-in page error. Check Render logs.");
  }
});
app.post("/tech-checkin/:token", async (req, res) => {
  try {
    const result = await pool.query(`SELECT * FROM technicians WHERE checkin_token = $1 AND active = TRUE`, [req.params.token]);
    const tech = result.rows[0];

    if (!tech) {
      return res.status(404).json({ ok: false, error: "Invalid technician check-in link." });
    }

    const allowedStatuses = ["Available", "On job", "Available soon", "Off today"];
    const status = allowedStatuses.includes(req.body.status) ? req.body.status : tech.status;

    const currentPostcode = (req.body.current_postcode || "").trim();
    const availableFrom = (req.body.available_from || "").trim();
    const notes = (req.body.notes || "").trim();

    const useGps = req.body.use_gps === true;
    const latitude = Number(req.body.latitude);
    const longitude = Number(req.body.longitude);
    const accuracy = Number(req.body.accuracy);

    if (useGps) {
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        return res.status(400).json({ ok: false, error: "GPS location was not received. Please try again." });
      }

      await pool.query(`
        UPDATE technicians
        SET status = $1,
            current_postcode = $2,
            available_from = $3,
            notes = $4,
            current_latitude = $5,
            current_longitude = $6,
            location_accuracy = $7,
            location_checked_in_at = NOW(),
            updated_by = $8,
            updated_at = NOW()
        WHERE id = $9
      `, [
        status,
        currentPostcode,
        availableFrom,
        notes,
        latitude,
        longitude,
        Number.isFinite(accuracy) ? accuracy.toFixed(2) : null,
        `${tech.name} check-in`,
        tech.id
      ]);

      return res.json({
        ok: true,
        reload: true,
        message: "Location check-in saved. The office dashboard has been updated."
      });
    }

    await pool.query(`
      UPDATE technicians
      SET status = $1,
          current_postcode = $2,
          available_from = $3,
          notes = $4,
          updated_by = $5,
          updated_at = NOW()
      WHERE id = $6
    `, [
      status,
      currentPostcode,
      availableFrom,
      notes,
      `${tech.name} check-in`,
      tech.id
    ]);

    res.json({
      ok: true,
      reload: true,
      message: "Status saved. GPS location was not updated."
    });
  } catch (error) {
    console.error("Tech check-in update error:", error);
    res.status(500).json({ ok: false, error: "Check-in update failed. Please tell the office." });
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
            <span class="pill ${locationFreshnessClass(tech.location_checked_in_at)}">${escapeHtml(locationFreshnessText(tech.location_checked_in_at))}</span>
            ${technicianHasGps(tech) ? `<div class="audit">Accuracy: ${escapeHtml(tech.location_accuracy || "—")}m</div>` : ""}
          </td>
          <td>
            <form method="GET" action="/technicians/edit" style="display:inline;">
              <input type="hidden" name="id" value="${tech.id}">
              <button type="submit">Edit</button>
            </form>
            <br><br>
            <a href="/tech-checkin/${escapeHtml(tech.checkin_token || "")}" target="_blank">Check-in link</a><br><a href="/tech-workspace/${escapeHtml(tech.checkin_token || "")}" target="_blank">Workspace link</a>
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
          form.grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; }
          textarea { grid-column: span 4; min-height: 70px; }
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
              <option>Available</option><option>On job</option><option>Available soon</option><option>Off today</option><option>Holiday</option><option>Sick</option><option>Vehicle issue</option><option>Do not use</option>
            </select>
            <select name="priority">
              <option>Normal</option><option>Push</option><option>High priority</option><option>Do not prioritise</option>
            </select>
            <input name="available_from" placeholder="Available from e.g. 15:30">
            <input name="skills" placeholder="Skills e.g. Lockout, uPVC">
            <button type="submit">Save Technician</button>
            <textarea name="notes" placeholder="Notes"></textarea>
          </form>
        </div>
        <table>
          <thead>
            <tr><th>Name</th><th>Phone</th><th>Base</th><th>Current</th><th>Status</th><th>Priority</th><th>Available From</th><th>Skills</th><th>Notes</th><th>Last Updated</th><th>GPS Check-In</th><th>Edit / Link</th></tr>
          </thead>
          <tbody>${rows || `<tr><td colspan="12">No technicians added yet</td></tr>`}</tbody>
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

    const statuses = ["Available", "On job", "Available soon", "Off today", "Holiday", "Sick", "Vehicle issue", "Do not use"];
    const priorities = ["Normal", "Push", "High priority", "Do not prioritise"];

    const statusOptions = statuses.map(status => `<option ${status === tech.status ? "selected" : ""}>${escapeHtml(status)}</option>`).join("");
    const priorityOptions = priorities.map(priority => `<option ${priority === (tech.priority || "Normal") ? "selected" : ""}>${escapeHtml(priority)}</option>`).join("");

    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Edit Technician</title>
        <style>
          ${sharedStyles()}
          .panel { max-width: 900px; }
          form.edit { display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; }
          textarea { grid-column: span 2; min-height: 100px; }
        </style>
      </head>
      <body>
        ${nav(req)}
        <h1>Edit Technician</h1>
        <div class="subtitle">Last updated by ${escapeHtml(tech.updated_by || "Unknown")} · ${formatDateTimeWithSeconds(tech.updated_at)}</div>

        <div class="panel">
          <h2>Technician Check-In Link</h2>
          <div class="help">Send this private link to the technician. It lets them update their own status and GPS check-in manually.</div>
          <br>
          <input class="copy-input" readonly value="${`${req.protocol}://${req.get("host")}/tech-checkin/${tech.checkin_token || ""}`}">
          <br><br>
          <a href="/tech-checkin/${escapeHtml(tech.checkin_token || "")}" target="_blank">Open technician check-in page</a>
          <br><br>
          <h2>Technician Workspace Link</h2>
          <div class="help">This is the technician's active jobs, close-job and income summary portal.</div>
          <br>
          <input class="copy-input" readonly value="${`${req.protocol}://${req.get("host")}/tech-workspace/${tech.checkin_token || ""}`}">
          <br><br>
          <a href="/tech-workspace/${escapeHtml(tech.checkin_token || "")}" target="_blank">Open technician workspace</a>
        </div>

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
    const { id, name, phone, base_postcode, current_postcode, status, priority, available_from, skills, notes } = req.body;
    const agentName = currentAgentName(req);

    if (id) {
      await pool.query(`
        UPDATE technicians
        SET name = $1, phone = $2, base_postcode = $3, current_postcode = $4,
            status = $5, priority = $6, available_from = $7, skills = $8,
            notes = $9, updated_by = $10, updated_at = NOW()
        WHERE id = $11
      `, [name, phone, base_postcode, current_postcode, status, priority || "Normal", available_from, skills, notes, agentName, id]);
    } else {
      await pool.query(`
        INSERT INTO technicians (
          name, phone, base_postcode, current_postcode, status, priority,
          available_from, skills, notes, updated_by, checkin_token, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
      `, [name, phone, base_postcode, current_postcode, status, priority || "Normal", available_from, skills, notes, agentName, makeCheckinToken()]);
    }

    res.redirect("/technicians");
  } catch (error) {
    console.error("Save technician error:", error);
    res.status(500).send("Save technician error. Check Render logs.");
  }
});

app.post("/technicians/delete", async (req, res) => {
  try {
    await pool.query(`UPDATE technicians SET active = FALSE, updated_by = $1, updated_at = NOW() WHERE id = $2`, [currentAgentName(req), req.body.id]);
    res.redirect("/technicians");
  } catch (error) {
    console.error("Delete technician error:", error);
    res.status(500).send("Delete technician error. Check Render logs.");
  }
});



async function ensureQuotationsSchemaOnly() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS quotations (
      id SERIAL PRIMARY KEY,
      quote_number TEXT,
      company_key TEXT DEFAULT 'online',
      customer_name TEXT,
      customer_email TEXT,
      customer_phone TEXT,
      customer_address TEXT,
      customer_postcode TEXT,
      site_address TEXT,
      site_postcode TEXT,
      quote_date TEXT,
      valid_until TEXT,
      prepared_by TEXT,
      prepared_role TEXT DEFAULT 'Head of Operations',
      status TEXT DEFAULT 'quote_drafted',
      line_items JSONB,
      subtotal NUMERIC(10,2),
      vat_amount NUMERIC(10,2),
      total NUMERIC(10,2),
      warranty_text TEXT,
      acceptance_text TEXT,
      notes TEXT,
      converted_job_id INTEGER,
      source_job_id INTEGER,
      sent_at TIMESTAMP,
      accepted_at TIMESTAMP,
      declined_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
  `);
  const columns = [
    [`quote_number`, `TEXT`],
    [`company_key`, `TEXT DEFAULT 'online'`],
    [`customer_name`, `TEXT`],
    [`customer_email`, `TEXT`],
    [`customer_phone`, `TEXT`],
    [`customer_address`, `TEXT`],
    [`customer_postcode`, `TEXT`],
    [`site_address`, `TEXT`],
    [`site_postcode`, `TEXT`],
    [`quote_date`, `TEXT`],
    [`valid_until`, `TEXT`],
    [`prepared_by`, `TEXT`],
    [`prepared_role`, `TEXT DEFAULT 'Head of Operations'`],
    [`status`, `TEXT DEFAULT 'quote_drafted'`],
    [`line_items`, `JSONB`],
    [`subtotal`, `NUMERIC(10,2)`],
    [`vat_amount`, `NUMERIC(10,2)`],
    [`total`, `NUMERIC(10,2)`],
    [`warranty_text`, `TEXT`],
    [`acceptance_text`, `TEXT`],
    [`notes`, `TEXT`],
    [`converted_job_id`, `INTEGER`],
    [`source_job_id`, `INTEGER`],
    [`sent_at`, `TIMESTAMP`],
    [`accepted_at`, `TIMESTAMP`],
    [`declined_at`, `TIMESTAMP`],
    [`created_at`, `TIMESTAMP DEFAULT NOW()`],
    [`updated_at`, `TIMESTAMP DEFAULT NOW()`]
  ];
  for (const [name, type] of columns) {
    await pool.query(`ALTER TABLE quotations ADD COLUMN IF NOT EXISTS ${name} ${type};`);
  }
  await pool.query(`CREATE INDEX IF NOT EXISTS quotations_status_idx ON quotations (status);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS quotations_created_at_idx ON quotations (created_at);`);
}

function quotationRows(quotes) {
  return quotes.map(quote => {
    const status = quote.status || "quote_drafted";
    const company = companies[quote.company_key] || companies.online;
    return `
      <tr>
        <td>
          <strong>${escapeHtml(quote.quote_number || quoteNumber(quote.id))}</strong><br>
          <span class="muted">${escapeHtml(company.name)}</span>
        </td>
        <td>
          <strong>${escapeHtml(quote.customer_name || "—")}</strong><br>
          <span class="muted">${escapeHtml(quote.customer_phone || quote.customer_email || "")}</span>
        </td>
        <td>
          <strong>${escapeHtml(quote.site_postcode || quote.customer_postcode || "—")}</strong><br>
          <span class="muted">${escapeHtml(quote.site_address || "")}</span>
        </td>
        <td><span class="pill ${quotationStatusClass(status)}">${escapeHtml(quotationStatusLabel(status))}</span></td>
        <td>
          <strong>${money(quote.total || 0)}</strong><br>
          <span class="muted">ex VAT ${money(quote.subtotal || 0)}</span>
        </td>
        <td>${escapeHtml(quote.quote_date || formatDate(quote.created_at))}</td>
        <td class="action-links">
          <a href="/quotations/${quote.id}">View</a>
          <a href="/quotations/${quote.id}/pdf" target="_blank">PDF</a>
        </td>
      </tr>
    `;
  }).join("");
}

app.get("/quotations", async (req, res) => {
  try {
    await ensureQuotationsSchemaOnly();
    const statusFilter = req.query.status || "";
    const search = (req.query.search || "").trim();
    const params = [];
    const where = [];

    if (statusFilter) {
      params.push(statusFilter);
      where.push(`status = $${params.length}`);
    }
    if (search) {
      params.push(`%${search}%`);
      where.push(`(
        quote_number ILIKE $${params.length}
        OR customer_name ILIKE $${params.length}
        OR customer_phone ILIKE $${params.length}
        OR customer_email ILIKE $${params.length}
        OR site_postcode ILIKE $${params.length}
        OR site_address ILIKE $${params.length}
      )`);
    }

    const result = await pool.query(`
      SELECT * FROM quotations
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY created_at DESC
      LIMIT 200
    `, params);

    const countsResult = await pool.query(`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status = 'quote_drafted')::int AS drafted,
        COUNT(*) FILTER (WHERE status = 'quote_sent')::int AS sent,
        COUNT(*) FILTER (WHERE status = 'quote_accepted')::int AS accepted,
        COUNT(*) FILTER (WHERE status = 'converted_to_order')::int AS converted,
        COALESCE(SUM(COALESCE("total", 0)), 0)::numeric AS total_value
      FROM quotations
    `);
    const counts = countsResult.rows[0] || {};

    res.send(`
      <html>
      <head><title>Quotations</title><style>${sharedStyles()}</style></head>
      <body>
        ${nav(req)}
        <main class="app-main">
          <div class="topbar">
            <div>
              <h1>Quotations</h1>
              <div class="subtitle">Create formal quote PDFs, track acceptance and convert accepted quotes into client orders.</div>
            </div>
            <a class="button" href="/quotations/new">+ Create quotation</a>
          </div>

          <div class="dashboard-cards">
            <div class="card"><h2>Total quotes</h2><div class="number">${Number(counts.total || 0)}</div></div>
            <div class="card"><h2>Drafted</h2><div class="number">${Number(counts.drafted || 0)}</div></div>
            <div class="card"><h2>Sent</h2><div class="number">${Number(counts.sent || 0)}</div></div>
            <div class="card"><h2>Accepted</h2><div class="number">${Number(counts.accepted || 0)}</div></div>
            <div class="card"><h2>Total value</h2><div class="number">${money(counts.total_value || 0)}</div></div>
          </div>

          <div class="panel">
            <form class="filter-form" method="GET" action="/quotations">
              <input name="search" value="${escapeHtml(search)}" placeholder="Search quote, customer, phone, postcode...">
              <select name="status"><option value="">All statuses</option>${quotationStatusOptions(statusFilter)}</select>
              <button type="submit">Filter</button>
              <a class="button secondary" href="/quotations">Clear</a>
            </form>
          </div>

          <div class="panel">
            <table>
              <thead><tr><th>Quote</th><th>Customer</th><th>Site</th><th>Status</th><th>Total</th><th>Date</th><th>Action</th></tr></thead>
              <tbody>${quotationRows(result.rows) || `<tr><td colspan="7" class="muted">No quotations yet.</td></tr>`}</tbody>
            </table>
          </div>
        </main>
      </body>
      </html>
    `);
  } catch (error) {
    console.error("Quotations page error:", error);
    res.status(500).send(`Quotations page error: ${escapeHtml(error.message)}. Check Render logs.`);
  }
});

app.get("/quotations/new", async (req, res) => {
  try {
    await ensureQuotationsSchemaOnly();
    let job = null;
    if (req.query.job_id) {
      const jobResult = await pool.query(`SELECT * FROM jobs WHERE id = $1`, [req.query.job_id]);
      job = jobResult.rows[0] || null;
    }

    const today = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
    const validUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
    const preparedBy = currentAgentName(req) || "Daniel van Her";

    const defaultCustomerName = job ? (job.customer_name || "") : "";
    const defaultPhone = job ? (job.customer_phone || "") : "";
    const defaultEmail = job ? (job.customer_email || "") : "";
    const defaultSiteAddress = job ? jobAddressPlain(job) : "";
    const defaultSitePostcode = job ? (job.postcode || "") : "";
    const defaultDescription = job ? `${job.job_type || "Works"}${job.job_description ? ` - ${job.job_description}` : ""}` : "";

    function lineBlock(i, description = "", price = "") {
      return `
        <div class="line-item-row">
          <input name="line${i}_description" value="${escapeHtml(description)}" placeholder="Description">
          <div class="money-input"><span>£</span><input name="line${i}_price" value="${escapeHtml(price)}" placeholder="0.00"></div>
        </div>
      `;
    }

    res.send(`
      <html>
      <head><title>Create Quotation</title><style>${sharedStyles()}</style></head>
      <body>
        ${nav(req)}
        <main class="app-main">
          <div class="topbar">
            <div>
              <h1>Create quotation</h1>
              <div class="subtitle">Create a formal quote PDF in the same letter style as your sample.</div>
            </div>
            <a class="button secondary" href="/quotations">Back to quotations</a>
          </div>

          <form method="POST" action="/quotations/create">
            <input type="hidden" name="source_job_id" value="${job ? job.id : ""}">

            <div class="panel">
              <h2>Quote details</h2>
              <div class="grid-3">
                <select name="company_key" required>
                  <option value="online">24H Online Services Ltd</option>
                  <option value="locksmiths">24H Locksmiths Ltd</option>
                </select>
                <input name="quote_date" value="${escapeHtml(today)}" placeholder="Quote date">
                <input name="valid_until" value="${escapeHtml(validUntil)}" placeholder="Valid until">
              </div>
              <br>
              <div class="grid-3">
                <select name="status">${quotationStatusOptions("quote_drafted")}</select>
                <input name="prepared_by" value="${escapeHtml(preparedBy)}" placeholder="Prepared by">
                <input name="prepared_role" value="Head of Operations" placeholder="Role / title">
              </div>
            </div>

            <div class="panel">
              <h2>Customer / account</h2>
              <div class="grid-3">
                <input name="customer_name" value="${escapeHtml(defaultCustomerName)}" placeholder="Customer / account name" required>
                <input name="customer_phone" value="${escapeHtml(defaultPhone)}" placeholder="Customer phone">
                <input name="customer_email" value="${escapeHtml(defaultEmail)}" placeholder="Customer email">
              </div>
              <br>
              <textarea name="customer_address" placeholder="Office / invoice address"></textarea>
              <br><br>
              <input name="customer_postcode" placeholder="Office postcode">
            </div>

            <div class="panel">
              <h2>Site / Re line</h2>
              <div class="grid-2">
                <input name="site_address" value="${escapeHtml(defaultSiteAddress)}" placeholder="Site address / Re:">
                <input name="site_postcode" value="${escapeHtml(defaultSitePostcode)}" placeholder="Site postcode">
              </div>
            </div>

            <div class="panel">
              <h2>Quote lines</h2>
              <div class="help">Enter prices excluding VAT. The PDF will calculate 20% VAT and show the inc VAT total.</div>
              ${lineBlock(1, defaultDescription, job && job.quoted_price ? job.quoted_price : "")}
              ${lineBlock(2)}
              ${lineBlock(3)}
              ${lineBlock(4)}
              ${lineBlock(5)}
            </div>

            <div class="panel">
              <h2>Quote wording</h2>
              <textarea name="warranty_text">We hope the above quote is satisfactory, and the prices above will be honored for 30 days from the date above, 12 months warranty is included on all parts fitted.</textarea>
              <br><br>
              <textarea name="acceptance_text">Upon acceptance of the quote and payment of a deposit, we will arrange a convenient appointment with you, so we can carry out the above works.</textarea>
              <br><br>
              <textarea name="notes" placeholder="Internal notes - not shown on PDF"></textarea>
            </div>

            <button type="submit">Save quotation and generate PDF</button>
          </form>
        </main>
      </body>
      </html>
    `);
  } catch (error) {
    console.error("New quotation page error:", error);
    res.status(500).send("New quotation page error. Check Render logs.");
  }
});

app.post("/quotations/create", async (req, res) => {
  try {
    await ensureQuotationsSchemaOnly();
    const lineItems = [];
    for (let i = 1; i <= 5; i += 1) {
      const description = (req.body[`line${i}_description`] || "").trim();
      const price = parseMoneyInput(req.body[`line${i}_price`]);
      if (description && price !== null) lineItems.push({ description, price });
    }

    const subtotal = lineItems.reduce((sum, item) => sum + Number(item.price || 0), 0);
    const vatAmount = subtotal * 0.2;
    const total = subtotal + vatAmount;

    const result = await pool.query(`
      INSERT INTO quotations (
        company_key, customer_name, customer_email, customer_phone, customer_address, customer_postcode,
        site_address, site_postcode, quote_date, valid_until, prepared_by, prepared_role, status,
        line_items, subtotal, vat_amount, total, warranty_text, acceptance_text, notes, updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,NOW())
      RETURNING id
    `, [
      req.body.company_key || "online",
      req.body.customer_name,
      req.body.customer_email,
      req.body.customer_phone,
      req.body.customer_address,
      req.body.customer_postcode,
      req.body.site_address,
      req.body.site_postcode,
      req.body.quote_date,
      req.body.valid_until,
      req.body.prepared_by || currentAgentName(req),
      req.body.prepared_role || "Head of Operations",
      req.body.status || "quote_drafted",
      JSON.stringify(lineItems),
      subtotal.toFixed(2),
      vatAmount.toFixed(2),
      total.toFixed(2),
      req.body.warranty_text,
      req.body.acceptance_text,
      req.body.notes
    ]);

    const id = result.rows[0].id;
    await pool.query(`UPDATE quotations SET quote_number = $1 WHERE id = $2 AND quote_number IS NULL`, [quoteNumber(id), id]);

    res.redirect(`/quotations/${id}/pdf`);
  } catch (error) {
    console.error("Create quotation error:", error);
    res.status(500).send("Create quotation error. Check Render logs.");
  }
});

app.get("/quotations/:id", async (req, res) => {
  try {
    await ensureQuotationsSchemaOnly();
    const result = await pool.query(`SELECT * FROM quotations WHERE id = $1`, [req.params.id]);
    const quote = result.rows[0];
    if (!quote) return res.status(404).send("Quotation not found");

    const lineItems = Array.isArray(quote.line_items) ? quote.line_items : JSON.parse(quote.line_items || "[]");
    const company = companies[quote.company_key] || companies.online;

    res.send(`
      <html>
      <head><title>${escapeHtml(quote.quote_number || quoteNumber(quote.id))}</title><style>${sharedStyles()}</style></head>
      <body>
        ${nav(req)}
        <main class="app-main">
          <div class="topbar">
            <div>
              <h1>${escapeHtml(quote.quote_number || quoteNumber(quote.id))}</h1>
              <div class="subtitle">${escapeHtml(company.name)} · ${escapeHtml(quote.customer_name || "Customer")}</div>
            </div>
            <div class="action-links">
              <a class="button" href="/quotations/${quote.id}/pdf" target="_blank">Open PDF</a>
              <a class="button secondary" href="/quotations">Back</a>
            </div>
          </div>

          <div class="grid-3">
            ${miniMetric("Status", quotationStatusLabel(quote.status))}
            ${miniMetric("Total inc VAT", money(quote.total || 0))}
            ${miniMetric("Valid until", quote.valid_until || "—")}
          </div>

          <div class="panel">
            <h2>Quote controls</h2>
            <form class="compact-stage-form" method="POST" action="/quotations/${quote.id}/status">
              <select name="status">${quotationStatusOptions(quote.status)}</select>
              <button type="submit">Update status</button>
            </form>
            <br>
            <div class="action-links">
              <a class="button" href="/quotations/${quote.id}/pdf" target="_blank">Generate PDF</a>
              ${quote.converted_job_id ? `<a class="button secondary" href="/jobs/${quote.converted_job_id}/edit">Open converted order</a>` : `<form method="POST" action="/quotations/${quote.id}/convert-to-order" style="display:inline;"><button type="submit">Convert to client order</button></form>`}
            </div>
          </div>

          <div class="grid-2">
            <div class="panel">
              <h2>Customer</h2>
              <p><strong>${escapeHtml(quote.customer_name || "—")}</strong></p>
              <p>${escapeHtml(quote.customer_phone || "")}</p>
              <p>${escapeHtml(quote.customer_email || "")}</p>
              <p>${escapeHtml(quote.customer_address || "")}</p>
            </div>
            <div class="panel">
              <h2>Site / Re</h2>
              <p>${escapeHtml(quote.site_address || "—")}</p>
              <p>${escapeHtml(quote.site_postcode || "")}</p>
              <p class="muted">Prepared by ${escapeHtml(quote.prepared_by || "—")}</p>
            </div>
          </div>

          <div class="panel">
            <h2>Lines</h2>
            <table>
              <thead><tr><th>Description</th><th>Price ex VAT</th></tr></thead>
              <tbody>${lineItems.map(item => `<tr><td>${escapeHtml(item.description)}</td><td>${money(item.price)}</td></tr>`).join("") || `<tr><td colspan="2">No lines</td></tr>`}</tbody>
              <tfoot><tr><th>Total</th><th>${money(quote.subtotal || 0)} + VAT (${money(quote.total || 0)} inc VAT)</th></tr></tfoot>
            </table>
          </div>
        </main>
      </body>
      </html>
    `);
  } catch (error) {
    console.error("Quotation view error:", error);
    res.status(500).send("Quotation view error. Check Render logs.");
  }
});

app.post("/quotations/:id/status", async (req, res) => {
  try {
    await ensureQuotationsSchemaOnly();
    const status = req.body.status || "quote_drafted";
    const updates = [`status = $1`, `updated_at = NOW()`];
    if (status === "quote_sent") updates.push(`sent_at = COALESCE(sent_at, NOW())`);
    if (status === "quote_accepted") updates.push(`accepted_at = COALESCE(accepted_at, NOW())`);
    if (status === "quote_declined") updates.push(`declined_at = COALESCE(declined_at, NOW())`);
    await pool.query(`UPDATE quotations SET ${updates.join(", ")} WHERE id = $2`, [status, req.params.id]);
    res.redirect(`/quotations/${req.params.id}`);
  } catch (error) {
    console.error("Quotation status update error:", error);
    res.status(500).send("Quotation status update error. Check Render logs.");
  }
});

app.post("/quotations/:id/convert-to-order", async (req, res) => {
  try {
    await ensureQuotationsSchemaOnly();
    const result = await pool.query(`SELECT * FROM quotations WHERE id = $1`, [req.params.id]);
    const quote = result.rows[0];
    if (!quote) return res.status(404).send("Quotation not found");

    const lineItems = Array.isArray(quote.line_items) ? quote.line_items : JSON.parse(quote.line_items || "[]");
    const description = lineItems.map(item => `${item.description} - ${money(item.price)}`).join("\n");

    const insert = await pool.query(`
      INSERT INTO jobs (
        customer_name, customer_phone, customer_email, address_line_1, postcode,
        job_type, job_description, source_campaign, quoted_price, expected_payment_method,
        dispatcher_name, status, created_at, updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'open',NOW(),NOW())
      RETURNING id
    `, [
      quote.customer_name,
      quote.customer_phone,
      quote.customer_email,
      quote.site_address || quote.customer_address,
      quote.site_postcode || quote.customer_postcode,
      "Quoted works",
      description,
      "Quotation",
      quote.total,
      "Unknown",
      currentAgentName(req)
    ]);

    const jobId = insert.rows[0].id;
    await pool.query(`UPDATE jobs SET job_number = $1 WHERE id = $2 AND job_number IS NULL`, [jobNumber(jobId), jobId]);
    await pool.query(`UPDATE quotations SET status = 'converted_to_order', converted_job_id = $1, updated_at = NOW() WHERE id = $2`, [jobId, quote.id]);

    res.redirect(`/jobs/${jobId}/edit`);
  } catch (error) {
    console.error("Convert quote to order error:", error);
    res.status(500).send("Convert quote to order error. Check Render logs.");
  }
});

app.get("/quotations/:id/pdf", async (req, res) => {
  try {
    await ensureQuotationsSchemaOnly();
    const result = await pool.query(`SELECT * FROM quotations WHERE id = $1`, [req.params.id]);
    const quote = result.rows[0];
    if (!quote) return res.status(404).send("Quotation not found");

    const company = companies[quote.company_key] || companies.online;
    const lineItems = Array.isArray(quote.line_items) ? quote.line_items : JSON.parse(quote.line_items || "[]");
    const quoteNo = quote.quote_number || quoteNumber(quote.id);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="quote-${quoteNo}.pdf"`);

    const doc = new PDFDocument({ size: "A4", margin: 0 });
    doc.pipe(res);

    const pageW = 595;
    const left = 50;
    const bodyW = 495;
    const footerTop = 730;

    function addQuoteLetterhead() {
      doc.save();
      doc.rect(0, 0, pageW, 86).fill("#111111");
      doc.moveTo(0, 82)
        .bezierCurveTo(125, 132, 265, 55, pageW, 76)
        .lineTo(pageW, 104)
        .lineTo(0, 124)
        .closePath()
        .fill("#55cdb0");
      doc.moveTo(0, 102)
        .bezierCurveTo(150, 146, 310, 69, pageW, 89)
        .lineTo(pageW, 110)
        .lineTo(0, 142)
        .closePath()
        .fill("#ffffff");
      doc.restore();
    }

    function addQuoteFooter() {
      doc.save();
      doc.rect(0, footerTop, pageW, 14).fill("#55cdb0");
      doc.rect(230, footerTop, 145, 14).fill("#6fb99f");
      doc.rect(375, footerTop, 220, 14).fill("#7aa08d");

      doc.fillColor("#6b7280").font("Helvetica").fontSize(8.5)
        .text(`REG: ${company.reg}`, 50, 755)
        .text(`VAT: ${company.vat}`, 50, 767)
        .text(`Tel: ${company.tel}`, 240, 761)
        .text(`${company.name} ${company.footer}`, 390, 753, { width: 155 });
      doc.restore();
    }

    function addBrandMark() {
      const logoPath = path.join(__dirname, company.logo);
      try {
        doc.image(logoPath, 410, 620, { width: 130 });
      } catch (error) {
        doc.fillColor("#111111")
          .font("Helvetica-Bold")
          .fontSize(12)
          .text(company.displayName, 400, 655, { width: 145, align: "right" });
      }
    }

    function addParagraph(text, x, y, options = {}) {
      const width = options.width || bodyW;
      const size = options.size || 10;
      const fontName = options.font || "Helvetica";
      const lineGap = options.lineGap || 2;
      doc.font(fontName).fontSize(size).fillColor("#111111");
      const clean = pdfText(text);
      doc.text(clean, x, y, { width, lineGap });
      return y + doc.heightOfString(clean, { width, lineGap }) + (options.after || 0);
    }

    addQuoteLetterhead();

    let y = 145;
    doc.font("Helvetica").fontSize(10).fillColor("#111111");
    doc.text(pdfText(quote.quote_date || formatDate(quote.created_at)), left, y);
    y += 30;

    y = addParagraph(quote.customer_name, left, y, { width: 250, after: 4 });
    if (quote.customer_address) y = addParagraph(quote.customer_address, left, y, { width: 250, after: 2 });
    if (quote.customer_postcode) y = addParagraph(quote.customer_postcode, left, y, { width: 250, after: 8 });

    y += 12;
    doc.font("Helvetica").fontSize(10).text("Dear Sirs", left, y);
    y += 34;

    const siteReference = pdfText([quote.site_address, quote.site_postcode].filter(Boolean).join("\n") || quote.customer_address || "Site address");
    doc.font("Helvetica-Bold").fontSize(10).text("Re:", left, y);
    doc.font("Helvetica").fontSize(10).text(siteReference, left + 68, y, { width: 380, lineGap: 2 });
    y += Math.max(22, doc.heightOfString(siteReference, { width: 380, lineGap: 2 })) + 18;

    y = addParagraph("Further to our assessment, we have pleasure in submitting the quote below:", left, y, { width: bodyW, after: 18 });

    const tableX = 50;
    const tableW = 495;
    const priceW = 185;
    const descW = tableW - priceW;
    const rowH = 35;

    doc.lineWidth(1);
    doc.rect(tableX, y, tableW, 28).stroke();
    doc.moveTo(tableX + descW, y).lineTo(tableX + descW, y + 28).stroke();
    doc.font("Helvetica-Bold").fontSize(10).fillColor("#111111")
      .text("Description", tableX + 8, y + 9, { width: descW - 16 })
      .text("Price range", tableX + descW + 8, y + 9, { width: priceW - 16 });
    y += 28;

    doc.font("Helvetica").fontSize(10);
    lineItems.forEach(item => {
      const desc = pdfText(item.description);
      const priceText = `${money(item.price)} + VAT`;
      const descH = doc.heightOfString(desc, { width: descW - 16, lineGap: 2 });
      const priceH = doc.heightOfString(priceText, { width: priceW - 16, lineGap: 2 });
      const thisH = Math.max(rowH, 20 + Math.max(descH, priceH));

      doc.rect(tableX, y, tableW, thisH).stroke();
      doc.moveTo(tableX + descW, y).lineTo(tableX + descW, y + thisH).stroke();
      doc.text(desc, tableX + 8, y + 11, { width: descW - 16, lineGap: 2 });
      doc.text(priceText, tableX + descW + 8, y + 11, { width: priceW - 16, lineGap: 2 });
      y += thisH;
    });

    const totalText = `${money(quote.subtotal || 0)} + VAT (${money(quote.total || 0)} inc VAT)`;
    const totalH = Math.max(rowH, 20 + doc.font("Helvetica-Bold").heightOfString(totalText, { width: priceW - 16, lineGap: 2 }));
    doc.rect(tableX, y, tableW, totalH).stroke();
    doc.moveTo(tableX + descW, y).lineTo(tableX + descW, y + totalH).stroke();
    doc.font("Helvetica-Bold").fontSize(10).text("Total", tableX + 8, y + 12, { width: descW - 16 });
    doc.text(totalText, tableX + descW + 8, y + 12, { width: priceW - 16, lineGap: 2 });
    y += totalH + 20;

    const warranty = quote.warranty_text || "We hope the above quote is satisfactory, and the prices above will be honored for 30 days from the date above, 12 months warranty is included on all parts fitted.";
    y = addParagraph(warranty, left, y, { width: bodyW, after: 18 });

    const acceptance = quote.acceptance_text || "Upon acceptance of the quote and payment of a deposit, we will arrange a convenient appointment with you, so we can carry out the above works.";
    y = addParagraph(acceptance, left, y, { width: bodyW, after: 30 });

    if (y > 645) y = 645;
    doc.font("Helvetica").fontSize(10).fillColor("#111111");
    doc.text("Regards,", left, y);
    y += 14;
    doc.text(pdfText(quote.prepared_by || "Daniel van Her"), left, y);
    y += 14;
    doc.text(pdfText(quote.prepared_role || "Head of Operations"), left, y);
    y += 34;
    if (y > 698) y = 698;
    doc.text(`On behalf of | ${company.name}`, left, y, { width: 310 });

    addBrandMark();
    addQuoteFooter();

    doc.end();
  } catch (error) {
    console.error("Quotation PDF error:", error);
    res.status(500).send(`Quotation PDF error: ${error.message}. Check Render logs.`);
  }
});


app.get("/disputes", async (req, res) => {
  try {
    const statusFilter = req.query.status || "";
    const search = (req.query.search || "").trim();

    const conditions = [];
    const params = [];

    if (statusFilter) {
      params.push(statusFilter);
      conditions.push(`d.status = $${params.length}`);
    }

    if (search) {
      params.push(`%${search}%`);
      conditions.push(`(
        LOWER(COALESCE(d.customer_name, '')) LIKE LOWER($${params.length}) OR
        LOWER(COALESCE(d.customer_phone, '')) LIKE LOWER($${params.length}) OR
        LOWER(COALESCE(d.complaint_type, '')) LIKE LOWER($${params.length}) OR
        LOWER(COALESCE(j.postcode, '')) LIKE LOWER($${params.length}) OR
        LOWER(COALESCE(j.job_number, '')) LIKE LOWER($${params.length})
      )`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const result = await pool.query(`
      SELECT
        d.*,
        j.job_number,
        j.postcode,
        j.job_type,
        j.source_campaign,
        j.final_value,
        j.materials_cost,
        t.name AS technician_name
      FROM disputes d
      LEFT JOIN jobs j ON j.id = d.job_id
      LEFT JOIN technicians t ON t.id = COALESCE(d.technician_id, j.assigned_technician_id)
      ${where}
      ORDER BY
        CASE
          WHEN d.status IN ('resolved', 'rejected', 'refund_processed') THEN 2
          ELSE 1
        END,
        d.updated_at DESC,
        d.created_at DESC
      LIMIT 200
    `, params);

    const countsResult = await pool.query(`
      SELECT status, COUNT(*)::int AS count
      FROM disputes
      GROUP BY status
    `);
    const counts = Object.fromEntries(countsResult.rows.map(row => [row.status, row.count]));

    const openCount = result.rows.filter(row => !["resolved", "rejected", "refund_processed"].includes(row.status)).length;
    const chargebackCount = result.rows.filter(row => row.chargeback).length;
    const totalDisputed = result.rows.reduce((sum, row) => sum + Number(row.disputed_amount || 0), 0);
    const totalRefunds = result.rows.reduce((sum, row) => sum + Number(row.refund_amount || 0), 0);

    const rows = result.rows.map(dispute => `
      <tr>
        <td><span class="pill ${disputeStatusClass(dispute.status)}">${escapeHtml(disputeStatusLabel(dispute.status))}</span></td>
        <td>
          <strong>${escapeHtml(dispute.customer_name || "Unknown customer")}</strong><br>
          <span class="muted">${escapeHtml(dispute.customer_phone || "")}</span>
        </td>
        <td>
          ${dispute.job_id ? `<a href="/jobs/${dispute.job_id}/edit">${escapeHtml(dispute.job_number || jobNumber(dispute.job_id))}</a>` : "No linked job"}<br>
          <span class="muted">${escapeHtml(dispute.postcode || "")} ${dispute.job_type ? `· ${escapeHtml(dispute.job_type)}` : ""}</span>
        </td>
        <td>${escapeHtml(dispute.technician_name || "Unassigned")}</td>
        <td>${escapeHtml(dispute.complaint_type || "")}</td>
        <td>${money(dispute.disputed_amount)}</td>
        <td>${money(dispute.refund_amount)}</td>
        <td>${dispute.chargeback ? "Yes" : "No"}</td>
        <td>${formatDateTime(dispute.updated_at || dispute.created_at)}</td>
        <td><a class="button small" href="/disputes/${dispute.id}">View</a></td>
      </tr>
    `).join("");

    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Disputes</title>
        <style>${sharedStyles()}</style>
      </head>
      <body>
        ${nav(req)}
        <div class="topbar">
          <div>
            <h1>Disputes</h1>
            <div class="subtitle">Track complaints, refunds, chargebacks and cost disputes linked to client orders.</div>
          </div>
          <a class="button" href="/disputes/new">+ New dispute</a>
        </div>

        <div class="cards">
          <div class="card"><h2>${openCount}</h2><p>Open / in progress</p></div>
          <div class="card"><h2>${money(totalDisputed)}</h2><p>Total disputed shown</p></div>
          <div class="card"><h2>${money(totalRefunds)}</h2><p>Refunds logged</p></div>
          <div class="card"><h2>${chargebackCount}</h2><p>Chargebacks shown</p></div>
        </div>

        <div class="panel">
          <form method="GET" action="/disputes" class="grid-3">
            <div>
              <label>Search</label>
              <input name="search" value="${escapeHtml(search)}" placeholder="Customer, phone, postcode, job no">
            </div>
            <div>
              <label>Status</label>
              <select name="status"><option value="">All statuses</option>${disputeStatusOptions(statusFilter)}</select>
            </div>
            <div style="display:flex;align-items:end;gap:10px;">
              <button type="submit">Filter</button>
              <a class="button secondary" href="/disputes">Clear</a>
            </div>
          </form>
        </div>

        <div class="panel">
          <h2>Dispute log</h2>
          <table>
            <thead>
              <tr>
                <th>Status</th><th>Customer</th><th>Linked job</th><th>Technician</th><th>Type</th><th>Disputed</th><th>Refund</th><th>Chargeback</th><th>Updated</th><th>Action</th>
              </tr>
            </thead>
            <tbody>${rows || `<tr><td colspan="10">No disputes found.</td></tr>`}</tbody>
          </table>
        </div>
      </body>
      </html>
    `);
  } catch (error) {
    console.error("Disputes page error:", error);
    res.status(500).send("Disputes page error. Check Render logs.");
  }
});

app.get("/disputes/new", async (req, res) => {
  try {
    const jobId = parseOptionalInt(req.query.job_id);
    let linkedJob = null;
    if (jobId) {
      const jobResult = await pool.query(`
        SELECT j.*, t.name AS technician_name
        FROM jobs j
        LEFT JOIN technicians t ON t.id = j.assigned_technician_id
        WHERE j.id = $1
      `, [jobId]);
      linkedJob = jobResult.rows[0] || null;
    }

    const technicianResult = await pool.query(`SELECT id, name FROM technicians WHERE active = TRUE ORDER BY name ASC`);
    const technicianOptions = technicianResult.rows.map(tech => {
      const selected = linkedJob && Number(linkedJob.assigned_technician_id) === Number(tech.id) ? "selected" : "";
      return `<option value="${tech.id}" ${selected}>${escapeHtml(tech.name)}</option>`;
    }).join("");

    const customerName = linkedJob ? linkedJob.customer_name || "" : "";
    const customerPhone = linkedJob ? linkedJob.customer_phone || "" : "";
    const suggestedDisputedAmount = linkedJob
      ? (linkedJob.final_value || linkedJob.call_out_agreed || linkedJob.starting_price || linkedJob.quoted_price || "")
      : "";
    const complaintStarter = disputeComplaintStarter(linkedJob);

    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>New Dispute</title>
        <style>${sharedStyles()}</style>
      </head>
      <body>
        ${nav(req)}
        <div class="topbar">
          <div>
            <h1>New dispute</h1>
            <div class="subtitle">Log a complaint, refund request, material-cost dispute or chargeback.</div>
          </div>
          <a class="button secondary" href="/disputes">Back to disputes</a>
        </div>

        ${linkedJob ? disputeJobSnapshot(linkedJob) : `
          <div class="panel">
            <strong>No job linked yet.</strong><br>
            <span class="muted">For the best result, open the original job from the Dispatch Board and click <strong>Raise dispute</strong>. That will pull the customer, technician, payment and materials details through automatically.</span>
          </div>
        `}

        <form method="POST" action="/disputes/save" class="panel">
          <input type="hidden" name="id" value="">
          <input type="hidden" name="job_id" value="${linkedJob ? linkedJob.id : ""}">

          <div class="grid-2">
            <div><label>Customer name</label><input name="customer_name" value="${escapeHtml(customerName)}"></div>
            <div><label>Customer phone</label><input name="customer_phone" value="${escapeHtml(customerPhone)}"></div>
          </div>

          <div class="grid-3">
            <div><label>Technician</label><select name="technician_id"><option value="">Not linked</option>${technicianOptions}</select></div>
            <div><label>Complaint type</label><select name="complaint_type">${complaintTypeOptions()}</select></div>
            <div><label>Status</label><select name="status">${disputeStatusOptions("open_dispute")}</select></div>
          </div>

          <div class="grid-3">
            <div><label>Disputed amount</label><input name="disputed_amount" value="${escapeHtml(suggestedDisputedAmount || "")}" placeholder="£0.00"></div>
            <div><label>Refund amount</label><input name="refund_amount" placeholder="£0.00"></div>
            <div><label>Chargeback raised?</label><select name="chargeback"><option value="false">No</option><option value="true">Yes</option></select></div>
          </div>

          <div><label>Complaint summary</label><textarea name="complaint_summary" rows="8" placeholder="What is the customer disputing? What happened? What evidence do we have?">${escapeHtml(complaintStarter)}</textarea></div>
          <div><label>Resolution notes</label><textarea name="resolution_notes" rows="5" placeholder="Refund agreed, email sent, bank chargeback notes, manager decision, etc."></textarea></div>

          <button type="submit">Save dispute</button>
          <a class="button secondary" href="/disputes">Cancel</a>
        </form>
      </body>
      </html>
    `);
  } catch (error) {
    console.error("New dispute error:", error);
    res.status(500).send(`New dispute error: ${escapeHtml(error.message)}. Check Render logs.`);
  }
});

app.get("/disputes/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const result = await pool.query(`
      SELECT d.*, j.job_number, j.customer_name AS job_customer_name, j.customer_phone AS job_customer_phone, j.address_line_1, j.address_line_2, j.address_line_3, j.town, j.county, j.postcode, j.job_type, j.source_campaign, j.status AS job_status, j.eta, j.expected_payment_method, j.payment_method, j.customer_paid, j.final_value, j.materials_used, j.materials_cost, j.bill_payer_name, j.bill_payer_phone, j.offsite_payment, j.created_at AS job_created_at,
             t.name AS technician_name
      FROM disputes d
      LEFT JOIN jobs j ON j.id = d.job_id
      LEFT JOIN technicians t ON t.id = COALESCE(d.technician_id, j.assigned_technician_id)
      WHERE d.id = $1
    `, [id]);

    const dispute = result.rows[0];
    if (!dispute) return res.status(404).send("Dispute not found");

    const technicianResult = await pool.query(`SELECT id, name FROM technicians WHERE active = TRUE ORDER BY name ASC`);
    const technicianOptions = technicianResult.rows.map(tech => {
      const selected = Number(dispute.technician_id) === Number(tech.id) ? "selected" : "";
      return `<option value="${tech.id}" ${selected}>${escapeHtml(tech.name)}</option>`;
    }).join("");

    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Dispute #${dispute.id}</title>
        <style>${sharedStyles()}</style>
      </head>
      <body>
        ${nav(req)}
        <div class="topbar">
          <div>
            <h1>Dispute #${dispute.id}</h1>
            <div class="subtitle">Created ${formatDateTime(dispute.created_at)} · Updated ${formatDateTime(dispute.updated_at)}</div>
          </div>
          <a class="button secondary" href="/disputes">Back to disputes</a>
        </div>

        <div class="cards">
          <div class="card"><h2><span class="pill ${disputeStatusClass(dispute.status)}">${escapeHtml(disputeStatusLabel(dispute.status))}</span></h2><p>Status</p></div>
          <div class="card"><h2>${money(dispute.disputed_amount)}</h2><p>Disputed amount</p></div>
          <div class="card"><h2>${money(dispute.refund_amount)}</h2><p>Refund amount</p></div>
          <div class="card"><h2>${dispute.chargeback ? "Yes" : "No"}</h2><p>Chargeback</p></div>
        </div>

        ${dispute.job_id ? disputeJobSnapshot({
          ...dispute,
          id: dispute.job_id,
          customer_name: dispute.job_customer_name || dispute.customer_name,
          customer_phone: dispute.job_customer_phone || dispute.customer_phone,
          status: dispute.job_status,
          created_at: dispute.job_created_at,
          technician_name: dispute.technician_name
        }) : ""}

        <form method="POST" action="/disputes/save" class="panel">
          <input type="hidden" name="id" value="${dispute.id}">
          <input type="hidden" name="job_id" value="${dispute.job_id || ""}">

          <div class="grid-2">
            <div><label>Customer name</label><input name="customer_name" value="${escapeHtml(dispute.customer_name || "")}"></div>
            <div><label>Customer phone</label><input name="customer_phone" value="${escapeHtml(dispute.customer_phone || "")}"></div>
          </div>

          <div class="grid-3">
            <div><label>Technician</label><select name="technician_id"><option value="">Not linked</option>${technicianOptions}</select></div>
            <div><label>Complaint type</label><select name="complaint_type">${complaintTypeOptions(dispute.complaint_type || "")}</select></div>
            <div><label>Status</label><select name="status">${disputeStatusOptions(dispute.status)}</select></div>
          </div>

          <div class="grid-3">
            <div><label>Disputed amount</label><input name="disputed_amount" value="${dispute.disputed_amount || ""}" placeholder="£0.00"></div>
            <div><label>Refund amount</label><input name="refund_amount" value="${dispute.refund_amount || ""}" placeholder="£0.00"></div>
            <div><label>Chargeback raised?</label><select name="chargeback"><option value="false" ${!dispute.chargeback ? "selected" : ""}>No</option><option value="true" ${dispute.chargeback ? "selected" : ""}>Yes</option></select></div>
          </div>

          <div><label>Complaint summary</label><textarea name="complaint_summary" rows="6">${escapeHtml(dispute.complaint_summary || "")}</textarea></div>
          <div><label>Resolution notes</label><textarea name="resolution_notes" rows="6">${escapeHtml(dispute.resolution_notes || "")}</textarea></div>

          <button type="submit">Save dispute</button>
          <a class="button secondary" href="/disputes">Back</a>
        </form>
      </body>
      </html>
    `);
  } catch (error) {
    console.error("Dispute detail error:", error);
    res.status(500).send("Dispute detail error. Check Render logs.");
  }
});

app.post("/disputes/save", async (req, res) => {
  try {
    const id = parseOptionalInt(req.body.id);
    const jobId = parseOptionalInt(req.body.job_id);
    const technicianId = parseOptionalInt(req.body.technician_id);
    const status = req.body.status || "open_dispute";
    const resolvedStatuses = ["resolved", "rejected", "refund_processed"];
    const resolvedAtExpression = resolvedStatuses.includes(status) ? "NOW()" : "NULL";

    const values = [
      jobId,
      req.body.customer_name || "",
      req.body.customer_phone || "",
      technicianId,
      req.body.complaint_type || "",
      parseMoneyInput(req.body.disputed_amount),
      parseMoneyInput(req.body.refund_amount),
      req.body.chargeback === "true",
      status,
      req.body.complaint_summary || "",
      req.body.resolution_notes || "",
      currentAgentName(req)
    ];

    if (id) {
      await pool.query(`
        UPDATE disputes SET
          job_id = $1,
          customer_name = $2,
          customer_phone = $3,
          technician_id = $4,
          complaint_type = $5,
          disputed_amount = $6,
          refund_amount = $7,
          chargeback = $8,
          status = $9,
          complaint_summary = $10,
          resolution_notes = $11,
          updated_by = $12,
          updated_at = NOW(),
          resolved_at = CASE WHEN $9 IN ('resolved', 'rejected', 'refund_processed') THEN COALESCE(resolved_at, NOW()) ELSE NULL END
        WHERE id = $13
      `, [...values, id]);
      res.redirect(`/disputes/${id}`);
      return;
    }

    const insert = await pool.query(`
      INSERT INTO disputes (
        job_id, customer_name, customer_phone, technician_id, complaint_type,
        disputed_amount, refund_amount, chargeback, status, complaint_summary,
        resolution_notes, created_by, updated_by, resolved_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$12,
        CASE WHEN $9 IN ('resolved', 'rejected', 'refund_processed') THEN NOW() ELSE NULL END
      )
      RETURNING id
    `, values);

    res.redirect(`/disputes/${insert.rows[0].id}`);
  } catch (error) {
    console.error("Save dispute error:", error);
    res.status(500).send("Save dispute error. Check Render logs.");
  }
});

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
    const result = await pool.query(`SELECT * FROM calls ORDER BY received_at DESC LIMIT 50`);
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
