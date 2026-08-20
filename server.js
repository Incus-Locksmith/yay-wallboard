const express = require("express");
const { Pool } = require("pg");
const fetch = require("node-fetch");
const PDFDocument = require("pdfkit");
const path = require("path");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({
  verify: (req, res, buf) => {
    if (req.originalUrl === "/stripe/webhook") req.rawBody = Buffer.from(buf);
  }
}));
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
  if (openPaths.includes(req.path) || req.path.startsWith("/tech-checkin/") || req.path === "/tech-workspace" || req.path.startsWith("/tech-workspace/")) return next();

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
  { value: "invoiced_account", label: "Invoice sent to Acc Dept" },
  { value: "cancelled_before_arrival", label: "Cancelled by client before arrival" },
  { value: "cancelled_onsite", label: "Cancelled onsite" }
];

const closingJobStatuses = [
  { value: "fully_paid", label: "Fully paid" },
  { value: "sent_to_pm", label: "Sent to PM" },
  { value: "awaiting_balance", label: "Awaiting balance" },
  { value: "awaiting_payment", label: "Awaiting payment" },
  { value: "disputed", label: "Disputed" }
];

const unpaidJobStatuses = ["awaiting_payment", "awaiting_balance", "sent_to_pm", "disputed"];

function isUnpaidTrackingStatus(status) {
  return unpaidJobStatuses.includes(String(status || ""));
}

function chaseDateInputValue(value) {
  if (!value) return dateInputValue(new Date());
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return dateInputValue(new Date());
  return date.toISOString().slice(0, 10);
}

function renderPaymentChaseHistory(chases = []) {
  if (!chases.length) return `<p class="muted-note">No payment chases logged yet.</p>`;
  return `
    <div class="activity-list">
      ${chases.map(chase => `
        <div class="activity-item">
          <span class="activity-dot"></span>
          <div>
            <div class="activity-label">Chased on ${escapeHtml(chaseDateInputValue(chase.chase_date))}</div>
            <div class="activity-value">
              ${escapeHtml(chase.outcome || "No outcome entered")}<br>
              ${chase.next_follow_up_date ? `<span class="muted">Next follow-up: ${escapeHtml(chaseDateInputValue(chase.next_follow_up_date))}</span><br>` : ""}
              ${chase.notes ? `<span class="muted">${escapeHtml(chase.notes)}</span><br>` : ""}
              <span class="muted">Logged ${escapeHtml(formatDateTime(chase.created_at))} by ${escapeHtml(chase.chased_by || "Unknown")}</span>
            </div>
          </div>
        </div>
      `).join("")}
    </div>
  `;
}

const legacyJobStatusLabels = {
  completed: "Completed",
  fully_paid_private: "Fully paid (private)"
};

const activeJobStatuses = ["open", "assigned", "scheduled"];

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
const etaOptions = ["15-20 mins", "25-30 mins", "< 60 mins", "Scheduled", "Other"];
const jobPaymentMethods = ["Unknown", "Cash", "Card", "Bank transfer", "Account"];
const splitPaymentMethods = ["Cash", "Card", "Bank transfer", "Account"];
const UK_VAT_RATE = 0.20;

function calculateVatFromNet(netValue) {
  const net = Number(netValue || 0);
  return Number.isFinite(net) ? Math.round((net * UK_VAT_RATE) * 100) / 100 : 0;
}

function calculateGrossFromNet(netValue) {
  const net = Number(netValue || 0);
  return Number.isFinite(net) ? Math.round((net + calculateVatFromNet(net)) * 100) / 100 : 0;
}

function buildSplitPaymentSummary(body) {
  const rows = [
    { method: String(body.payment_method_1 || "").trim(), amount: parseMoneyInput(body.payment_amount_1) },
    { method: String(body.payment_method_2 || "").trim(), amount: parseMoneyInput(body.payment_amount_2) }
  ].filter(row => row.method && row.method !== "Unknown");

  if (!rows.length) return String(body.payment_method || "Unknown").trim() || "Unknown";

  return rows.map(row => {
    const amountText = row.amount !== null && row.amount !== undefined ? ` ${money(row.amount)}` : "";
    return `${row.method}${amountText}`;
  }).join(" + ");
}

function closePaymentRequiresInvoicePhotos(body) {
  const methods = [body.payment_method_1, body.payment_method_2, body.payment_method].map(value => String(value || "").toLowerCase());
  return methods.some(value => value.includes("card") || value.includes("bank transfer"));
}

function closePaymentIncludesCard(body) {
  const methods = [body.payment_method_1, body.payment_method_2, body.payment_method].map(value => String(value || "").toLowerCase());
  return methods.some(value => value.includes("card"));
}

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
  const found = jobStatuses.find(item => item.value === status) || closingJobStatuses.find(item => item.value === status);
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

function closingJobStatusOptions(selectedStatus = "fully_paid") {
  const selected = closingJobStatuses.some(item => item.value === selectedStatus) ? selectedStatus : "fully_paid";
  return optionList(closingJobStatuses, selected);
}

function literalClosingStatusOptions(selectedStatus = "fully_paid") {
  const selected = closingJobStatuses.some(item => item.value === selectedStatus) ? selectedStatus : "fully_paid";
  const rows = [
    ["fully_paid", "Fully paid"],
    ["sent_to_pm", "Sent to PM"],
    ["awaiting_balance", "Awaiting balance"],
    ["awaiting_payment", "Awaiting payment"],
    ["disputed", "Disputed"]
  ];
  return rows.map(([value, label]) => `<option value="${value}" ${value === selected ? "selected" : ""}>${label}</option>`).join("");
}

function etaSelectOptions(selectedEta = "") {
  const value = String(selectedEta || "").trim();
  const options = etaOptions.slice();
  if (value && !options.includes(value)) options.splice(options.length - 1, 0, value);
  return optionList(options, value);
}

function normaliseEta(body) {
  const selected = String(body.eta || "").trim();
  const other = String(body.eta_other || "").trim();
  if (selected === "Other") return other || "Other";
  return selected;
}

function datetimeLocalValue(value) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = number => String(number).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function scheduledDateValue(value) {
  const local = datetimeLocalValue(value);
  return local ? local.slice(0, 10) : "";
}

function scheduledTimeValue(value) {
  const local = datetimeLocalValue(value);
  return local ? local.slice(11, 16) : "";
}

function quarterHourTimeOptions(selectedTime = "") {
  const selected = String(selectedTime || "").trim();
  const opts = [`<option value="">Select time</option>`];
  for (let hour = 0; hour < 24; hour += 1) {
    for (const minute of [0, 15, 30, 45]) {
      const value = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
      const isSelected = value === selected ? "selected" : "";
      opts.push(`<option value="${value}" ${isSelected}>${value}</option>`);
    }
  }
  return opts.join("");
}

function isValid24HourTime(value) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(String(value || "").trim());
}

function compactScheduledTimePicker(prefix, selectedTime = "") {
  const selected = String(selectedTime || "").trim();
  return `
    <div class="scheduled-time-simple">
      <label for="${prefix}_time">Time</label>
      <input
        type="text"
        id="${prefix}_time"
        name="scheduled_time"
        value="${escapeHtml(selected)}"
        placeholder="09:00"
        inputmode="numeric"
        maxlength="5"
        pattern="([01][0-9]|2[0-3]):[0-5][0-9]"
        title="Enter the time in 24 hour format, for example 09:00 or 14:30"
        autocomplete="off"
        oninput="this.value = this.value.replace(/[^0-9:]/g, '').slice(0, 5); if (this.value.length === 2 && !this.value.includes(':')) this.value += ':';"
      >
      <small class="muted">24-hour time only, e.g. 09:00 or 14:30.</small>
    </div>
  `;
}

function parseScheduledTimestamp(body) {
  const date = String(body.scheduled_date || "").trim();
  const time = String(body.scheduled_time || "").trim();
  if (date && time && isValid24HourTime(time)) return `${date} ${time}`;
  return parseOptionalTimestamp(body.scheduled_at);
}

function parseOptionalTimestamp(value) {
  if (!value || !String(value).trim()) return null;
  return String(value).trim().replace("T", " ");
}

function scheduledDisplay(value) {
  return value ? formatDateTime(value) : "—";
}

const auditFieldLabels = {
  customer_name: "Customer name",
  customer_phone: "Customer phone",
  customer_alt_phone: "Alternative phone",
  customer_email: "Customer email",
  address_line_1: "Address line 1",
  address_line_2: "Address line 2",
  address_line_3: "Address line 3",
  town: "Town",
  county: "County",
  postcode: "Postcode",
  job_type: "Category",
  job_description: "Job description",
  lock_change_keys: "Lock change keys",
  urgency: "Urgency",
  source_campaign: "Campaign/source",
  quoted_price: "Quoted price",
  starting_price: "Starting price",
  call_out_agreed: "Call-out agreed",
  start_price_locks: "Start price of parts",
  offsite_payment: "Offsite payment",
  bill_payer_name: "Bill payer name",
  bill_payer_phone: "Bill payer phone",
  expected_payment_method: "Expected payment method",
  account_job: "Account job",
  account_template_id: "Account template",
  assigned_technician_id: "Technician",
  eta: "ETA",
  scheduled_at: "Scheduled date/time",
  dispatcher_notes: "Dispatcher notes",
  status: "Status",
  net_value: "NET value",
  vat_amount: "VAT",
  final_value: "Full value inc VAT",
  payment_method: "Payment method",
  payment_method_1: "Payment method 1",
  payment_amount_1: "Payment amount 1",
  payment_method_2: "Payment method 2",
  payment_amount_2: "Payment amount 2",
  invoice_photos_confirmed: "Invoice/photos confirmation",
  card_is_amex: "AMEX payment",
  amex_id_provided: "AMEX ID provided",
  customer_paid: "Customer paid",
  materials_used: "Materials used",
  materials_cost: "Materials cost",
  outcome: "Outcome",
  tech_notes: "Technician notes",
  close_notes: "Close notes",
  onsite_at: "On site time"
};

const auditMoneyFields = new Set(["quoted_price", "starting_price", "call_out_agreed", "start_price_locks", "net_value", "vat_amount", "final_value", "payment_amount_1", "payment_amount_2", "materials_cost"]);
const auditDateFields = new Set(["scheduled_at", "onsite_at", "closed_at", "created_at", "updated_at"]);

function auditDisplayValue(field, value, technicianNames = {}) {
  if (value === null || value === undefined || value === "") return "—";
  if (field === "status") return jobStatusLabel(value);
  if (field === "assigned_technician_id") return technicianNames[String(value)] || value || "Unassigned";
  if (field === "customer_paid" || field === "offsite_payment" || field === "account_job" || field === "invoice_photos_confirmed" || field === "card_is_amex" || field === "amex_id_provided") return value === true || value === "true" ? "Yes" : "No";
  if (auditMoneyFields.has(field)) return money(value || 0);
  if (auditDateFields.has(field)) return formatDateTime(value);
  return String(value);
}

function auditNormalValue(field, value) {
  if (value === null || value === undefined) return "";
  if (auditMoneyFields.has(field)) {
    const number = Number(String(value).replace(/[^0-9.-]/g, ""));
    return Number.isFinite(number) ? number.toFixed(2) : "";
  }
  if (field === "customer_paid" || field === "offsite_payment" || field === "account_job" || field === "invoice_photos_confirmed" || field === "card_is_amex" || field === "amex_id_provided") {
    return value === true || value === "true" ? "true" : "false";
  }
  if (auditDateFields.has(field)) {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return String(value).trim();
    return date.toISOString().slice(0, 16);
  }
  return String(value).trim();
}

async function loadTechnicianNameMap(ids = []) {
  const cleanIds = [...new Set(ids.filter(id => id !== null && id !== undefined && String(id).trim() !== "").map(id => Number(id)).filter(Number.isFinite))];
  if (!cleanIds.length) return {};
  const result = await pool.query(`SELECT id, name FROM technicians WHERE id = ANY($1::int[])`, [cleanIds]);
  const map = {};
  result.rows.forEach(row => { map[String(row.id)] = row.name; });
  return map;
}

async function addJobAuditEntry(jobId, actionType, fieldName, oldValue, newValue, changedBy, technicianNames = {}) {
  await pool.query(`
    INSERT INTO job_audit_log (job_id, action_type, field_name, old_value, new_value, changed_by, created_at)
    VALUES ($1, $2, $3, $4, $5, $6, NOW())
  `, [
    jobId,
    actionType,
    auditFieldLabels[fieldName] || fieldName || actionType,
    auditDisplayValue(fieldName, oldValue, technicianNames),
    auditDisplayValue(fieldName, newValue, technicianNames),
    changedBy || "Unknown"
  ]);
}

async function logJobChanges(jobId, oldJob, newValues, changedBy, actionType = "job_updated") {
  if (!oldJob) return;
  const technicianIds = [];
  if (Object.prototype.hasOwnProperty.call(newValues, "assigned_technician_id")) {
    technicianIds.push(oldJob.assigned_technician_id, newValues.assigned_technician_id);
  }
  const technicianNames = await loadTechnicianNameMap(technicianIds);
  for (const [field, newValue] of Object.entries(newValues)) {
    const oldValue = oldJob[field];
    if (auditNormalValue(field, oldValue) === auditNormalValue(field, newValue)) continue;
    await addJobAuditEntry(jobId, actionType, field, oldValue, newValue, changedBy, technicianNames);
  }
}

function renderJobAuditTrail(auditRows = []) {
  if (!auditRows.length) {
    return `<p class="muted-note">No audit entries yet. Future edits will appear here with the user, change, and time.</p>`;
  }
  return `
    <div class="activity-list">
      ${auditRows.map(row => `
        <div class="activity-item">
          <span class="activity-dot"></span>
          <div>
            <div class="activity-label">${escapeHtml(row.field_name || row.action_type || "Job updated")}</div>
            <div class="activity-value">
              ${escapeHtml(row.old_value || "—")} → ${escapeHtml(row.new_value || "—")}<br>
              <span class="muted">${escapeHtml(formatDateTime(row.created_at))} by ${escapeHtml(row.changed_by || "Unknown")}</span>
            </div>
          </div>
        </div>
      `).join("")}
    </div>
  `;
}

const jobEvidenceTypes = [
  "Job photos",
  "Invoice copy",
  "Payment proof",
  "AMEX ID proof",
  "Signed paperwork",
  "Other evidence"
];

function evidenceTypeOptions(selected = "") {
  return jobEvidenceTypes.map(type => `<option value="${escapeHtml(type)}" ${type === selected ? "selected" : ""}>${escapeHtml(type)}</option>`).join("");
}

function mainDropboxEvidenceFolderUrl() {
  return String(process.env.DROPBOX_EVIDENCE_FOLDER_URL || "").trim();
}

function renderMainEvidenceFolderLink() {
  const url = mainDropboxEvidenceFolderUrl();
  if (!url) {
    return `
      <div style="margin:10px 0 14px; padding:12px; border-radius:14px; background:#f8fafc; border:1px solid #e5e7eb;">
        <strong>Main Dropbox evidence folder not connected yet.</strong><br>
        <span class="muted-note">Add DROPBOX_EVIDENCE_FOLDER_URL in Render environment variables to show the shared Dropbox folder button here.</span>
      </div>
    `;
  }
  return `
    <div style="margin:10px 0 14px; padding:12px; border-radius:14px; background:#ecfdf5; border:1px solid #bbf7d0;">
      <strong>Dropbox filing folder</strong><br>
      <span class="muted-note">Open the shared evidence folder, then file under Month/Year → Tech name → Postcode.</span><br>
      <a class="button green" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" style="margin-top:10px; display:inline-flex;">Open Job evidence Dropbox folder</a>
    </div>
  `;
}

function cleanEvidenceUrl(value) {
  return String(value || "").trim();
}

function evidenceLabel(row) {
  const type = row.evidence_type || "Evidence";
  const archived = row.archived ? " · Archived" : "";
  return `${type}${archived}`;
}

function renderJobEvidenceLinks(rows = []) {
  if (!rows.length) {
    return `<p class="muted-note">No job-specific evidence links have been added yet. Open the shared Dropbox folder, file the media by Month/Year → Tech name → Postcode, then paste the job folder or file link here.</p>`;
  }
  return `
    <div class="activity-list">
      ${rows.map(row => `
        <div class="activity-item">
          <span class="activity-dot"></span>
          <div>
            <div class="activity-label">${escapeHtml(evidenceLabel(row))}</div>
            <div class="activity-value">
              <a href="${escapeHtml(row.evidence_url || '#')}" target="_blank" rel="noopener noreferrer">Open Dropbox link</a><br>
              ${row.notes ? `${escapeHtml(row.notes)}<br>` : ""}
              <span class="muted">Added ${escapeHtml(formatDateTime(row.added_at))} by ${escapeHtml(row.added_by || "Unknown")}</span>
              ${row.archived_at ? `<br><span class="muted">Archived ${escapeHtml(formatDateTime(row.archived_at))}</span>` : ""}
            </div>
          </div>
        </div>
      `).join("")}
    </div>
  `;
}

function jobEvidenceForm(jobId, compact = false) {
  return `
    <div class="job-grid" style="margin-top:10px;">
      <div class="field"><label>Evidence type</label><select name="evidence_type">${evidenceTypeOptions()}</select></div>
      <div class="field"><label>Job-specific Dropbox link</label><input name="evidence_url" placeholder="Paste job folder or file link"></div>
      <div class="field ${compact ? '' : 'wide'}"><label>Evidence notes</label><input name="evidence_notes" placeholder="Optional notes, e.g. before/after photos or invoice copy"></div>
    </div>
  `;
}

async function addJobEvidenceLink(jobId, body, addedBy, actionType = "job_evidence_added") {
  const evidenceUrl = cleanEvidenceUrl(body.evidence_url);
  if (!evidenceUrl) return null;
  const evidenceType = jobEvidenceTypes.includes(body.evidence_type) ? body.evidence_type : "Other evidence";
  const notes = String(body.evidence_notes || body.notes || "").trim();
  const result = await pool.query(`
    INSERT INTO job_evidence_links (job_id, evidence_type, evidence_url, notes, added_by, added_at, archived)
    VALUES ($1, $2, $3, $4, $5, NOW(), FALSE)
    RETURNING *
  `, [jobId, evidenceType, evidenceUrl, notes, addedBy || "Unknown"]);
  await addJobAuditEntry(jobId, actionType, "Evidence", "—", `${evidenceType}: ${evidenceUrl}`, addedBy || "Unknown");
  return result.rows[0];
}


const defaultSmsTemplates = [
  {
    key: "booking_confirmation",
    name: "Booking confirmation",
    message: "Hi {customer_name}, your locksmith job for {postcode} has been booked. ETA/appointment: {eta_or_scheduled}. 24H Locksmiths: {office_tel}"
  },
  {
    key: "technician_assigned",
    name: "Technician assigned",
    message: "Hi {customer_name}, your locksmith has been assigned: {technician_name}. ETA/appointment: {eta_or_scheduled}. 24H Locksmiths: {office_tel}"
  },
  {
    key: "eta_update",
    name: "ETA update",
    message: "Hi {customer_name}, update for your locksmith job at {postcode}: ETA/appointment is now {eta_or_scheduled}. 24H Locksmiths: {office_tel}"
  },
  {
    key: "scheduled_appointment_reminder",
    name: "Scheduled appointment reminder",
    message: "Hi {customer_name}, reminder of your locksmith appointment for {postcode}: {scheduled_display}. 24H Locksmiths: {office_tel}"
  },
  {
    key: "payment_reminder",
    name: "Payment reminder",
    message: "Hi {customer_name}, this is a reminder that payment is still outstanding for your locksmith job at {postcode}. Please contact 24H Locksmiths on {office_tel}."
  },
  {
    key: "invoice_reminder",
    name: "Invoice reminder",
    message: "Hi {customer_name}, your invoice for the locksmith job at {postcode} is awaiting payment. Please contact 24H Locksmiths on {office_tel} if you need help."
  },
  {
    key: "trustpilot_review_request",
    name: "Request Trustpilot review",
    message: "Hi {customer_name}, thank you for using 24H Locksmiths. If you were happy with the service, please leave us a Trustpilot review: {trustpilot_review_url}"
  },
  {
    key: "service_feedback_request",
    name: "Feedback on service provided",
    message: "Hi {customer_name}, thank you for using 24H Locksmiths. We would appreciate your feedback on the service we provided. Please reply to this text with any comments."
  },
  {
    key: "ten_percent_discount",
    name: "Offer 10% discount on next job",
    message: "Hi {customer_name}, thank you for using 24H Locksmiths. As a thank you, we would like to offer 10% off your next job. Quote your postcode when booking."
  },
  {
    key: "custom",
    name: "Custom message",
    message: ""
  }
];

function smsTemplateByKey(key) {
  return defaultSmsTemplates.find(template => template.key === key) || defaultSmsTemplates[0];
}

function smsTrustpilotReviewUrl() {
  return String(process.env.TRUSTPILOT_REVIEW_URL || "https://www.trustpilot.com/evaluate/24hrslocksmith.co.uk").trim();
}

function smsOfficeTel() {
  return compactPhone(process.env.SMS_OFFICE_TEL || companies.locksmiths.tel || "02038703732");
}

function cleanSmsNumber(value) {
  return String(value || "").replace(/\s+/g, "").trim();
}

function smsTemplateContext(job = {}) {
  const etaOrScheduled = job.eta === "Scheduled" && job.scheduled_at
    ? scheduledDisplay(job.scheduled_at)
    : (job.eta || "TBC");
  return {
    customer_name: job.customer_name || "",
    postcode: job.postcode || "",
    job_number: job.job_number || jobNumber(job.id),
    eta: job.eta || "TBC",
    scheduled_display: job.scheduled_at ? scheduledDisplay(job.scheduled_at) : etaOrScheduled,
    eta_or_scheduled: etaOrScheduled,
    technician_name: job.technician_name || "your locksmith",
    office_tel: smsOfficeTel(),
    trustpilot_review_url: smsTrustpilotReviewUrl()
  };
}

function fillSmsTemplate(message, job) {
  const context = smsTemplateContext(job);
  return String(message || "").replace(/\{([a-zA-Z0-9_]+)\}/g, (_, key) => context[key] || "");
}

function smsTemplateOptions(job, selected = "") {
  return defaultSmsTemplates.map(template => {
    const message = fillSmsTemplate(template.message, job);
    return `<option value="${escapeHtml(template.key)}" data-message="${escapeHtml(message)}" ${template.key === selected ? "selected" : ""}>${escapeHtml(template.name)}</option>`;
  }).join("");
}

function yayApiHost() {
  return String(process.env.YAY_API_HOSTNAME || "https://api.yay.com").replace(/\/+$/, "");
}

function yayAuthConfigured() {
  return Boolean(process.env.YAY_AUTH_RESELLER && process.env.YAY_AUTH_USER && process.env.YAY_AUTH_PASSWORD);
}

function yayAuthHeaders() {
  return {
    "Content-Type": "application/json",
    "Accept": "application/json",
    "User-Agent": "YourDispatchPartnerPortal/1.0 (+https://yay-wallboard.onrender.com)",
    "X-Auth-Reseller": String(process.env.YAY_AUTH_RESELLER || "").trim(),
    "X-Auth-User": String(process.env.YAY_AUTH_USER || "").trim(),
    "X-Auth-Password": String(process.env.YAY_AUTH_PASSWORD || "").trim()
  };
}

function maskedYayAuthSummary() {
  const reseller = String(process.env.YAY_AUTH_RESELLER || "").trim();
  const user = String(process.env.YAY_AUTH_USER || "").trim();
  const password = String(process.env.YAY_AUTH_PASSWORD || "");
  return {
    host: yayApiHost(),
    reseller_present: Boolean(reseller),
    reseller_start: reseller ? reseller.slice(0, 6) : "",
    reseller_length: reseller.length,
    user,
    password_present: Boolean(password),
    password_length: password.length,
    user_agent_added: true
  };
}

async function yayApiDebugRequest(method, path, body = null) {
  const url = `${yayApiHost()}${path}`;
  const started = Date.now();
  try {
    const response = await fetch(url, {
      method,
      headers: yayAuthHeaders(),
      body: body === null ? undefined : JSON.stringify(body)
    });
    const text = await response.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch (_) {}
    return {
      path,
      method,
      url,
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      ms: Date.now() - started,
      contentType: response.headers.get("content-type") || "",
      text: text ? text.slice(0, 4000) : "",
      json
    };
  } catch (error) {
    return { path, method, url, ok: false, status: "FETCH_ERROR", statusText: error.message, ms: Date.now() - started, text: error.stack || error.message };
  }
}

function looksLikeUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || "").trim());
}

function smsProviderConfigured() {
  return Boolean(yayAuthConfigured() && looksLikeUuid(process.env.YAY_SMS_CALLER_ID_UUID));
}

function renderSmsConfigNotice() {
  if (smsProviderConfigured()) return `<p class="muted-note">SMS will be sent through Yay and logged against this job.</p>`;
  return `
    <div style="margin:10px 0 14px; padding:12px; border-radius:14px; background:#fff7ed; border:1px solid #fed7aa; color:#9a3412; font-size:13px; line-height:1.45;">
      <strong>Yay SMS is not fully connected yet.</strong><br>
      Add YAY_API_HOSTNAME, YAY_AUTH_RESELLER, YAY_AUTH_USER, YAY_AUTH_PASSWORD and the real YAY_SMS_CALLER_ID_UUID in Render.
      <br><a href="/admin/yay-caller-ids">Look up Yay caller IDs</a> once the auth details are saved.
    </div>
  `;
}

function renderSmsHistory(rows = []) {
  if (!rows.length) return `<p class="muted-note">No SMS messages logged for this job yet.</p>`;
  return `
    <div class="activity-list">
      ${rows.map(row => `
        <div class="activity-item">
          <span class="activity-dot"></span>
          <div>
            <div class="activity-label">${escapeHtml(row.template_name || row.sms_type || "SMS")} · ${escapeHtml(row.status || "logged")}</div>
            <div class="activity-value">
              To: ${escapeHtml(row.sent_to || "—")}<br>
              ${escapeHtml(row.message_body || "")}<br>
              <span class="muted">${escapeHtml(formatDateTime(row.created_at))} by ${escapeHtml(row.sent_by || "Unknown")}</span>
              ${row.provider_response ? `<br><span class="muted">Provider: ${escapeHtml(String(row.provider_response).slice(0, 240))}</span>` : ""}
            </div>
          </div>
        </div>
      `).join("")}
    </div>
  `;
}

function normaliseYaySmsRecipient(value) {
  let phone = cleanSmsNumber(value).replace(/[^0-9+]/g, "");
  if (phone.startsWith("00")) phone = "+" + phone.slice(2);
  if (phone.startsWith("0")) phone = "+44" + phone.slice(1);
  return phone;
}

async function yayApiRequest(method, path, body = null) {
  if (!yayAuthConfigured()) {
    throw new Error("Yay auth environment variables missing");
  }

  const response = await fetch(`${yayApiHost()}${path}`, {
    method,
    headers: yayAuthHeaders(),
    body: body === null ? undefined : JSON.stringify(body)
  });

  const providerText = await response.text();
  let parsed = null;
  try { parsed = providerText ? JSON.parse(providerText) : null; } catch (_) {}

  if (!response.ok) {
    throw new Error(`Yay API failed ${response.status}: ${providerText}`);
  }
  return { text: providerText, json: parsed, status: response.status };
}

function yayFutureSendOn(minutesAhead = 2) {
  // Yay rejects send_on if it is too close to their current server time.
  // Use a safe future time, rounded to whole seconds with no milliseconds.
  const date = new Date(Date.now() + minutesAhead * 60 * 1000);
  date.setMilliseconds(0);
  return date.toISOString().replace(/\.\d{3}Z$/, "Z");
}

async function sendYaySms(to, message, campaignName = "Portal SMS") {
  if (!smsProviderConfigured()) {
    return { status: "not_sent", providerResponse: "Yay SMS environment variables missing or caller ID UUID not set" };
  }

  const recipient = normaliseYaySmsRecipient(to);
  const sendOn = yayFutureSendOn(2);

  // Yay's campaign confirm endpoint has returned 404 for a newly-created draft campaign in live testing.
  // To avoid creating a draft that cannot be confirmed, create the campaign as non-draft so Yay queues it directly.
  // send_on still has to be in the future, so we use a two-minute buffer.
  const payload = {
    campaign_name: campaignName,
    message_content: message,
    caller_id_uuid: String(process.env.YAY_SMS_CALLER_ID_UUID || "").trim(),
    send_on: sendOn,
    is_draft: false,
    recipients: [{ phone_number: recipient }]
  };

  const created = await yayApiRequest("POST", "/voip/text-message/campaign", payload);
  const campaignUuid = created.json?.result?.uuid || created.json?.uuid || "";

  return {
    status: "queued",
    providerResponse: JSON.stringify({
      send_on: sendOn,
      campaign_uuid: campaignUuid,
      note: "Created with is_draft=false so Yay queues the campaign directly.",
      created: created.json || created.text
    }).slice(0, 1600)
  };
}

function stripeSecretKey() {
  return String(process.env.STRIPE_SECRET_KEY || "").trim();
}

function stripeConfigured() {
  return Boolean(stripeSecretKey());
}

function stripeModeLabel() {
  const envMode = String(process.env.STRIPE_MODE || "").trim().toLowerCase();
  if (envMode) return envMode;
  const key = stripeSecretKey();
  if (key.startsWith("sk_live_")) return "live";
  if (key.startsWith("sk_test_")) return "test";
  return "unknown";
}

function stripeConfigurationError() {
  const key = stripeSecretKey();
  const mode = stripeModeLabel();
  if (!key) return "Stripe secret key is missing from Render environment variables.";
  if (!["live", "test"].includes(mode)) return "STRIPE_MODE must be live or test.";
  if (mode === "live" && !key.startsWith("sk_live_")) return "STRIPE_MODE is live but STRIPE_SECRET_KEY is not a live key.";
  if (mode === "test" && !key.startsWith("sk_test_")) return "STRIPE_MODE is test but STRIPE_SECRET_KEY is not a test key.";
  return "";
}

function stripeReady() {
  return !stripeConfigurationError();
}

function jobOutstandingAmount(job) {
  const finalValue = parseMoneyInput(job && job.final_value);
  if (finalValue === null || finalValue <= 0) return null;
  if (job && job.customer_paid) return null;

  const raw1 = job && job.payment_amount_1;
  const raw2 = job && job.payment_amount_2;
  const hasRecordedSplitPayment = [raw1, raw2].some(value => value !== null && value !== undefined && String(value).trim() !== "");
  if (!hasRecordedSplitPayment) return finalValue;

  const paid1 = parseMoneyInput(raw1) || 0;
  const paid2 = parseMoneyInput(raw2) || 0;
  const outstanding = Math.round((finalValue - paid1 - paid2) * 100) / 100;
  return outstanding > 0 ? outstanding : null;
}

function stripeVatBreakdown(grossAmount) {
  const grossPence = Math.round((Number(grossAmount) || 0) * 100);
  const netPence = Math.round(grossPence / 1.2);
  const vatPence = grossPence - netPence;
  return {
    net: netPence / 100,
    vat: vatPence / 100,
    gross: grossPence / 100
  };
}

function stripeInvoiceAddress(job) {
  return [job.address_line_1, job.address_line_2, job.address_line_3, job.town, job.county]
    .filter(Boolean)
    .join("\n");
}

async function nextStripeInvoiceNumber(client, job) {
  const ref = String(job.job_number || jobNumber(job.id)).trim();
  const existing = (await client.query(`
    SELECT invoice_number
    FROM invoices
    WHERE invoice_number = $1 OR invoice_number LIKE $2
    ORDER BY id ASC
  `, [ref, `${ref}-%`])).rows;
  if (!existing.length) return ref;
  const used = new Set(existing.map(row => String(row.invoice_number || "")));
  let suffix = 2;
  while (used.has(`${ref}-${suffix}`)) suffix += 1;
  return `${ref}-${suffix}`;
}

async function createStripeInvoiceForJob(client, { job, grossAmount, reason, createdBy, locksmithName, paymentLinkId }) {
  const breakdown = stripeVatBreakdown(grossAmount);
  const invoiceNumber = await nextStripeInvoiceNumber(client, job);
  const invoiceDate = new Date().toISOString().slice(0, 10);
  const customerAddress = stripeInvoiceAddress(job);
  const postcode = compactPostcode(job.postcode || "");
  const lineItems = [{ description: reason || `Locksmith services${postcode ? ` (${postcode})` : ""}`, qty: 1, unitPrice: breakdown.net }];

  const result = await client.query(`
    INSERT INTO invoices (
      invoice_number, company_key, payment_method, dispatcher_name, invoice_stage,
      stage_updated_by, stage_updated_at, customer_name, customer_address,
      customer_postcode, site_same_as_invoice, site_address, site_postcode,
      customer_email, invoice_date, locksmith_name, paid_status, line_items,
      subtotal, vat_amount, total, notes, source_job_id, stripe_payment_link_id, updated_at
    ) VALUES (
      $1, 'online', 'Card', $2, 'Draft only',
      $2, NOW(), $3, $4,
      $5, TRUE, $4, $5,
      $6, $7, $8, 'Unpaid', $9,
      $10, $11, $12, $13, $14, $15, NOW()
    )
    RETURNING id, invoice_number
  `, [
    invoiceNumber,
    createdBy,
    job.customer_name || "Customer",
    customerAddress,
    postcode,
    job.customer_email || "",
    invoiceDate,
    locksmithName || job.technician_name || "",
    JSON.stringify(lineItems),
    breakdown.net.toFixed(2),
    breakdown.vat.toFixed(2),
    breakdown.gross.toFixed(2),
    "6 months warranty on parts fitted",
    Number(job.id),
    Number(paymentLinkId)
  ]);

  return { ...result.rows[0], ...breakdown };
}

async function stripeApiFormRequest(path, formData) {
  const configError = stripeConfigurationError();
  if (configError) throw new Error(configError);

  const response = await fetch(`https://api.stripe.com${path}`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${stripeSecretKey()}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: formData
  });

  const text = await response.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch (_) {}

  if (!response.ok) {
    const message = json && json.error && json.error.message ? json.error.message : (text || `Stripe API failed with status ${response.status}`);
    throw new Error(message);
  }
  return { text, json, status: response.status };
}


function stripeWebhookSecret() {
  return String(process.env.STRIPE_WEBHOOK_SECRET || "").trim();
}

function stripeWebhookConfigured() {
  return Boolean(stripeWebhookSecret());
}

function verifyStripeWebhookSignature(rawBody, signatureHeader) {
  const secret = stripeWebhookSecret();
  if (!secret) throw new Error("STRIPE_WEBHOOK_SECRET is not configured.");
  if (!rawBody || !Buffer.isBuffer(rawBody)) throw new Error("Stripe webhook raw body is unavailable.");
  if (!signatureHeader) throw new Error("Stripe-Signature header is missing.");

  const parts = String(signatureHeader).split(",").map(part => part.trim());
  const timestampPart = parts.find(part => part.startsWith("t="));
  const signatures = parts.filter(part => part.startsWith("v1=")).map(part => part.slice(3));
  if (!timestampPart || !signatures.length) throw new Error("Stripe webhook signature header is invalid.");

  const timestamp = Number(timestampPart.slice(2));
  if (!Number.isFinite(timestamp)) throw new Error("Stripe webhook timestamp is invalid.");
  const tolerance = Math.max(0, Number(process.env.STRIPE_WEBHOOK_TOLERANCE_SEC || 300));
  const age = Math.abs(Math.floor(Date.now() / 1000) - timestamp);
  if (tolerance && age > tolerance) throw new Error(`Stripe webhook timestamp is outside the ${tolerance}s tolerance.`);

  const signedPayload = Buffer.concat([Buffer.from(String(timestamp)), Buffer.from("."), rawBody]);
  const expected = crypto.createHmac("sha256", secret).update(signedPayload).digest("hex");
  const expectedBuffer = Buffer.from(expected, "utf8");
  const valid = signatures.some(signature => {
    const candidate = Buffer.from(String(signature), "utf8");
    return candidate.length === expectedBuffer.length && crypto.timingSafeEqual(candidate, expectedBuffer);
  });
  if (!valid) throw new Error("Stripe webhook signature verification failed.");
  return true;
}

async function stripeApiGetRequest(pathname, params = {}) {
  const configError = stripeConfigurationError();
  if (configError) throw new Error(configError);
  const query = new URLSearchParams();
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== null && value !== undefined && String(value) !== "") query.append(key, String(value));
  });
  const suffix = query.toString() ? `?${query.toString()}` : "";
  const response = await fetch(`https://api.stripe.com${pathname}${suffix}`, {
    method: "GET",
    headers: { "Authorization": `Bearer ${stripeSecretKey()}` }
  });
  const text = await response.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch (_) {}
  if (!response.ok) {
    const message = json && json.error && json.error.message ? json.error.message : (text || `Stripe API failed with status ${response.status}`);
    throw new Error(message);
  }
  return { text, json, status: response.status };
}

function stripeObjectId(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object" && value.id) return String(value.id);
  return "";
}

async function reconcileStripePaidSession(session, eventId = "", source = "Stripe webhook") {
  if (!session || String(session.payment_status || "").toLowerCase() !== "paid") {
    return { matched: false, paid: false, reason: "Checkout Session is not marked paid." };
  }

  const paymentLinkProviderId = stripeObjectId(session.payment_link);
  const checkoutSessionId = String(session.id || "").trim();
  const paymentIntentId = stripeObjectId(session.payment_intent);
  if (!paymentLinkProviderId) return { matched: false, paid: true, reason: "Checkout Session has no Payment Link id." };
  if (!checkoutSessionId) return { matched: false, paid: true, reason: "Checkout Session id is missing." };

  const client = await pool.connect();
  let jobId = null;
  let linkId = null;
  let invoiceId = null;
  let duplicatePayment = false;
  let reviewRequired = false;
  let auditMessage = "";
  let linkProviderIdForDeactivate = paymentLinkProviderId;

  try {
    await client.query("BEGIN");
    const linkResult = await client.query(`
      SELECT *
      FROM job_payment_links
      WHERE provider = 'stripe' AND provider_session_id = $1
      ORDER BY id DESC
      LIMIT 1
      FOR UPDATE
    `, [paymentLinkProviderId]);

    if (!linkResult.rows.length) {
      await client.query("ROLLBACK");
      return { matched: false, paid: true, reason: `No portal Stripe link matches ${paymentLinkProviderId}.` };
    }

    const link = linkResult.rows[0];
    linkId = Number(link.id);
    jobId = Number(link.job_id);
    invoiceId = link.invoice_id ? Number(link.invoice_id) : null;

    const amountPaid = Number.isFinite(Number(session.amount_total)) ? Number(session.amount_total) / 100 : null;
    const currency = String(session.currency || "").toLowerCase();
    const expectedAmount = Number(link.amount || 0);
    const expectedCurrency = String(link.currency || "gbp").toLowerCase();
    const amountMatches = amountPaid !== null && Math.abs(amountPaid - expectedAmount) < 0.005;
    const currencyMatches = !currency || currency === expectedCurrency;

    const receiptInsert = await client.query(`
      INSERT INTO stripe_payment_receipts (
        checkout_session_id, payment_link_row_id, job_id, invoice_id,
        stripe_payment_link_id, payment_intent_id, amount_paid, currency,
        event_id, paid_at, raw_summary, created_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,TO_TIMESTAMP($10),$11,NOW())
      ON CONFLICT (checkout_session_id) DO NOTHING
      RETURNING id
    `, [
      checkoutSessionId,
      linkId,
      jobId,
      invoiceId,
      paymentLinkProviderId,
      paymentIntentId,
      amountPaid,
      currency || expectedCurrency,
      eventId || null,
      Number(session.created || Math.floor(Date.now()/1000)),
      JSON.stringify({ id: checkoutSessionId, payment_status: session.payment_status, amount_total: session.amount_total, currency: session.currency }).slice(0, 1800)
    ]);

    if (!receiptInsert.rows.length) {
      await client.query("COMMIT");
      return { matched: true, paid: true, duplicateEvent: true, jobId, linkId, invoiceId };
    }

    const priorReceiptCount = Number((await client.query(`
      SELECT COUNT(*)::int AS count
      FROM stripe_payment_receipts
      WHERE payment_link_row_id = $1
    `, [linkId])).rows[0].count || 0);
    duplicatePayment = priorReceiptCount > 1;
    reviewRequired = !amountMatches || !currencyMatches || duplicatePayment;

    const status = reviewRequired ? (duplicatePayment ? "paid_multiple_review" : "payment_review") : "paid";
    await client.query(`
      UPDATE job_payment_links
      SET status = $1,
          paid_at = COALESCE(paid_at, TO_TIMESTAMP($2)),
          amount_paid = COALESCE(amount_paid, $3),
          stripe_checkout_session_id = COALESCE(stripe_checkout_session_id, $4),
          stripe_payment_intent_id = COALESCE(stripe_payment_intent_id, $5),
          last_webhook_event_id = COALESCE(NULLIF($6,''), last_webhook_event_id),
          reconciled_at = NOW(),
          provider_response = $7
      WHERE id = $8
    `, [
      status,
      Number(session.created || Math.floor(Date.now()/1000)),
      amountPaid,
      checkoutSessionId,
      paymentIntentId,
      eventId || "",
      JSON.stringify({ checkout_session_id: checkoutSessionId, payment_link: paymentLinkProviderId, payment_intent: paymentIntentId, payment_status: session.payment_status, amount_total: session.amount_total, currency: session.currency, reconciled_by: source }).slice(0, 1800),
      linkId
    ]);

    if (!reviewRequired && invoiceId) {
      await client.query(`
        UPDATE invoices
        SET paid_status = 'Paid with thanks',
            stripe_paid_at = COALESCE(stripe_paid_at, TO_TIMESTAMP($1)),
            stripe_checkout_session_id = COALESCE(stripe_checkout_session_id, $2),
            updated_at = NOW()
        WHERE id = $3
      `, [Number(session.created || Math.floor(Date.now()/1000)), checkoutSessionId, invoiceId]);
    }

    if (!reviewRequired) {
      const jobResult = await client.query(`
        SELECT id, final_value, payment_amount_1, payment_amount_2, customer_paid, payment_method
        FROM jobs WHERE id = $1 FOR UPDATE
      `, [jobId]);
      if (jobResult.rows.length) {
        const job = jobResult.rows[0];
        const finalValue = Number(job.final_value || 0);
        const manualPaid = Number(job.payment_amount_1 || 0) + Number(job.payment_amount_2 || 0);
        const stripePaidResult = await client.query(`
          SELECT COALESCE(SUM(r.amount_paid),0)::numeric AS total
          FROM stripe_payment_receipts r
          JOIN job_payment_links l ON l.id = r.payment_link_row_id
          WHERE r.job_id = $1
            AND l.status IN ('paid','paid_multiple_review')
        `, [jobId]);
        const stripePaid = Number(stripePaidResult.rows[0].total || 0);
        const fullyPaid = finalValue > 0 && (manualPaid + stripePaid) >= (finalValue - 0.005);
        await client.query(`
          UPDATE jobs
          SET customer_paid = CASE WHEN $1 THEN TRUE ELSE customer_paid END,
              payment_method = CASE
                WHEN COALESCE(NULLIF(payment_method,''),'') = '' THEN 'Stripe card'
                WHEN LOWER(COALESCE(payment_method,'')) NOT LIKE '%stripe%' AND $2 > 0 THEN payment_method || ' + Stripe card'
                ELSE payment_method
              END,
              updated_at = NOW()
          WHERE id = $3
        `, [fullyPaid, amountPaid || 0, jobId]);
      }
    }

    await client.query("COMMIT");

    if (reviewRequired) {
      auditMessage = duplicatePayment
        ? `WARNING: more than one successful Stripe payment was received for the same payment link. Latest session ${checkoutSessionId}. Review Stripe before refunding or closing the job.`
        : `Stripe payment needs review. Expected ${money(expectedAmount)} ${expectedCurrency.toUpperCase()}, received ${amountPaid === null ? 'unknown amount' : money(amountPaid)} ${(currency || expectedCurrency).toUpperCase()} in ${checkoutSessionId}.`;
      await addJobAuditEntry(jobId, "stripe_payment_review", "Stripe payment review", "—", auditMessage, source);
    } else {
      auditMessage = `PAID ${money(amountPaid || expectedAmount)} by Stripe · session ${checkoutSessionId}${invoiceId ? ` · invoice ${invoiceId}` : ""}`;
      await addJobAuditEntry(jobId, "stripe_payment_received", "Stripe payment received", "Unpaid", "Paid with thanks", source);
    }

    if (!duplicatePayment) {
      try {
        const deactivate = new URLSearchParams();
        deactivate.append("active", "false");
        await stripeApiFormRequest(`/v1/payment_links/${linkProviderIdForDeactivate}`, deactivate);
      } catch (deactivateError) {
        console.error("Could not deactivate paid Stripe Payment Link:", deactivateError);
      }
    }

    return { matched: true, paid: true, reviewRequired, duplicatePayment, jobId, linkId, invoiceId, amountPaid };
  } catch (error) {
    try { await client.query("ROLLBACK"); } catch (_) {}
    throw error;
  } finally {
    client.release();
  }
}

async function syncStripePaymentLink(linkId, source = "Manual Stripe check") {
  const linkResult = await pool.query(`SELECT * FROM job_payment_links WHERE id = $1 AND provider = 'stripe'`, [linkId]);
  if (!linkResult.rows.length) throw new Error("Stripe payment link not found.");
  const link = linkResult.rows[0];
  if (!link.provider_session_id) throw new Error("Stripe Payment Link id is missing from this record.");

  const result = await stripeApiGetRequest("/v1/checkout/sessions", {
    payment_link: link.provider_session_id,
    limit: 10
  });
  const sessions = Array.isArray(result.json && result.json.data) ? result.json.data : [];
  const paidSessions = sessions.filter(session => String(session.payment_status || "").toLowerCase() === "paid");
  if (!paidSessions.length) return { matched: true, paid: false, linkId: Number(linkId), jobId: Number(link.job_id) };

  let lastResult = null;
  for (const session of paidSessions.slice().reverse()) {
    lastResult = await reconcileStripePaidSession(session, `manual_${session.id}`, source);
  }
  return lastResult || { matched: true, paid: false, linkId: Number(linkId), jobId: Number(link.job_id) };
}

async function processStripeWebhookEvent(event) {
  const eventId = String(event && event.id || "").trim();
  const eventType = String(event && event.type || "").trim();
  if (!eventId) throw new Error("Stripe event id is missing.");

  await pool.query(`
    INSERT INTO stripe_webhook_events (event_id, event_type, status, payload, received_at)
    VALUES ($1,$2,'received',$3,NOW())
    ON CONFLICT (event_id) DO NOTHING
  `, [eventId, eventType, JSON.stringify(event).slice(0, 12000)]);

  const existing = (await pool.query(`SELECT status FROM stripe_webhook_events WHERE event_id = $1`, [eventId])).rows[0];
  if (existing && ["processed","ignored"].includes(existing.status)) return { duplicate: true };

  try {
    if (eventType === "checkout.session.completed" || eventType === "checkout.session.async_payment_succeeded") {
      const session = event && event.data && event.data.object ? event.data.object : null;
      if (session && String(session.payment_status || "").toLowerCase() === "paid") {
        const result = await reconcileStripePaidSession(session, eventId, "Stripe webhook");
        await pool.query(`UPDATE stripe_webhook_events SET status='processed', processed_at=NOW(), error=NULL WHERE event_id=$1`, [eventId]);
        return result;
      }
    }

    await pool.query(`UPDATE stripe_webhook_events SET status='ignored', processed_at=NOW(), error=NULL WHERE event_id=$1`, [eventId]);
    return { ignored: true };
  } catch (error) {
    await pool.query(`UPDATE stripe_webhook_events SET status='failed', error=$2 WHERE event_id=$1`, [eventId, String(error.message || error).slice(0,1800)]);
    throw error;
  }
}

function buildStripePaymentSms(job, link) {
  const tel = process.env.SMS_OFFICE_TEL || companies.locksmiths.tel || "020 3870 3732";
  const ref = job.job_number || jobNumber(job.id);
  return `Hi ${job.customer_name || "there"}, your invoice has been created for locksmith job ${ref}. Please pay securely here: ${link.payment_url}. 24H Locksmiths: ${tel}. Please do not reply to this SMS.`;
}

function stripeLinkIsPaid(row) {
  return ["paid", "paid_multiple_review", "payment_review"].includes(String(row && row.status || "").toLowerCase());
}

function stripeLinkNeedsReview(row) {
  return ["paid_multiple_review", "payment_review"].includes(String(row && row.status || "").toLowerCase());
}

function renderTechnicianStripePaymentArea(job, token, rows = []) {
  const configError = stripeConfigurationError();
  const defaultAmount = jobOutstandingAmount(job);
  const defaultReason = `Locksmith services${job.postcode ? ` (${job.postcode})` : ""}`;
  const recentRows = (rows || []).slice(0, 3);

  const historyHtml = recentRows.length ? `
    <div style="margin-top:12px;">
      ${recentRows.map(row => {
        const paid = String(row.status || "").toLowerCase() === "paid";
        const review = stripeLinkNeedsReview(row);
        return `
        <div style="border-top:1px solid #e2e8f0; padding:10px 0;">
          <div style="font-weight:900;">${money(row.amount || 0)} GROSS · ${escapeHtml(row.reason || "Stripe payment link")}</div>
          <div class="job-sub" style="margin-top:3px;">NET ${money(stripeVatBreakdown(row.amount || 0).net)} · VAT @ 20% ${money(stripeVatBreakdown(row.amount || 0).vat)} · GROSS ${money(stripeVatBreakdown(row.amount || 0).gross)}</div>
          ${paid ? `<div style="margin-top:5px;color:#15803d;font-weight:900;">✓ PAID${row.paid_at ? ` · ${escapeHtml(formatDateTime(row.paid_at))}` : ""}</div>` : review ? `<div style="margin-top:5px;color:#b45309;font-weight:900;">⚠ PAYMENT RECEIVED — REVIEW REQUIRED</div>` : `<div class="job-sub" style="margin-top:5px;">Awaiting Stripe payment</div>`}
          <div class="job-sub" style="margin-top:3px;">Created ${escapeHtml(formatDateTime(row.created_at))} by ${escapeHtml(row.created_by || "Unknown")}</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;">
            ${!paid && !review ? `<a class="button dark" style="padding:9px 12px;" href="${escapeHtml(row.payment_url || "#")}" target="_blank" rel="noopener noreferrer">Open payment link</a>` : ""}
            ${row.invoice_id ? `<a class="button dark" style="padding:9px 12px;" href="/invoices/${row.invoice_id}/pdf" target="_blank" rel="noopener noreferrer">View invoice</a><a class="button amber" style="padding:9px 12px;" href="/invoices/${row.invoice_id}/pdf?download=1">Download invoice</a>` : ""}
            ${!paid && !review ? `<button class="button amber" style="padding:9px 12px;" type="button" data-link="${escapeHtml(row.payment_url || "")}" onclick="navigator.clipboard.writeText(this.dataset.link).then(()=>{this.textContent='Copied';setTimeout(()=>this.textContent='Copy link',1400);}).catch(()=>window.prompt('Copy this Stripe link:',this.dataset.link));">Copy link</button>
            <form method="POST" action="/tech-workspace/${escapeHtml(token)}/job/${job.id}/stripe-link/${row.id}/send-sms" style="margin:0;" onsubmit="return confirm('Send this Stripe payment link to the customer by SMS?');"><button class="button green" style="padding:9px 12px;" type="submit">Send payment SMS</button></form>` : ""}
            ${!paid ? `<form method="POST" action="/tech-workspace/${escapeHtml(token)}/job/${job.id}/stripe-link/${row.id}/check-payment" style="margin:0;"><button class="button dark" style="padding:9px 12px;" type="submit">Check Stripe payment</button></form>` : ""}
          </div>
        </div>`;
      }).join("")}
    </div>
  ` : `<div class="job-sub" style="margin-top:10px;">No Stripe links created for this job yet.</div>`;

  return `
    <div style="margin-top:16px;border-top:1px solid #e2e8f0;padding-top:14px;">
      <div style="font-weight:900;font-size:15px;">Invoice + Stripe payment</div>
      ${configError
        ? `<div class="job-sub" style="color:#b91c1c;margin-top:6px;">Stripe unavailable: ${escapeHtml(configError)}</div>`
        : `
          <form method="POST" action="/tech-workspace/${escapeHtml(token)}/job/${job.id}/stripe-link" style="margin-top:10px;" onsubmit="return confirm('Create a LIVE Stripe payment link AND invoice for this GROSS amount?');">
            <div class="field-grid">
              <div><label>GROSS amount customer will pay</label><input name="amount" inputmode="decimal" placeholder="£" value="${defaultAmount !== null ? Number(defaultAmount).toFixed(2) : ""}" oninput="updateStripeGrossBreakdownForInput(this)" required></div>
              <div><label>Description</label><input name="reason" maxlength="180" value="${escapeHtml(defaultReason)}" required></div>
            </div>
            <div class="vat-preview" style="margin-top:10px;padding:10px 12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;font-weight:800;">${defaultAmount !== null ? `NET ${money(stripeVatBreakdown(defaultAmount).net)} · VAT @ 20% ${money(stripeVatBreakdown(defaultAmount).vat)} · GROSS ${money(stripeVatBreakdown(defaultAmount).gross)}` : "Enter the gross amount to see NET and VAT."}</div>
            <div class="job-sub" style="margin-top:8px;">Invoice: 24H Online Services Ltd · Card · UK VAT 20%</div>
            <div class="job-sub" style="margin-top:4px;">${stripeWebhookConfigured() ? "Automatic Stripe payment confirmation is ON." : "Automatic confirmation needs STRIPE_WEBHOOK_SECRET. The Check Stripe payment button works as a backup."}</div>
            <button class="button green" type="submit" style="margin-top:10px;">Create Invoice & Stripe Link</button>
          </form>`}
      ${historyHtml}
    </div>
  `;
}

function renderStripePaymentLinks(rows = []) {
  if (!rows.length) return `<p class="muted-note">No Stripe payment links created for this job yet.</p>`;
  return `
    <div class="activity-list">
      ${rows.map(row => {
        const paid = String(row.status || "").toLowerCase() === "paid";
        const review = stripeLinkNeedsReview(row);
        return `
        <div class="activity-item">
          <span class="activity-dot"></span>
          <div>
            <div class="activity-label">${paid ? "PAID" : review ? "PAYMENT REVIEW" : escapeHtml(row.status || "created")} · GROSS ${money(row.amount || 0)} · ${escapeHtml((row.currency || "GBP").toUpperCase())}</div>
            <div class="activity-value">
              ${escapeHtml(row.reason || "Stripe payment link")}<br>
              <span class="muted">NET ${money(stripeVatBreakdown(row.amount || 0).net)} · VAT @ 20% ${money(stripeVatBreakdown(row.amount || 0).vat)} · GROSS ${money(stripeVatBreakdown(row.amount || 0).gross)}</span><br>
              ${paid ? `<strong style="color:#15803d;">✓ Paid by Stripe${row.paid_at ? ` · ${escapeHtml(formatDateTime(row.paid_at))}` : ""}</strong>` : review ? `<strong style="color:#b45309;">⚠ Payment received — review in Stripe</strong>` : `<span class="muted">Awaiting payment</span>`}<br>
              ${!paid && !review ? `<a href="${escapeHtml(row.payment_url || "#")}" target="_blank" rel="noopener noreferrer">Open Stripe link</a>` : ""}
              ${row.invoice_id ? `${!paid && !review ? " · " : ""}<a href="/invoices/${row.invoice_id}/pdf" target="_blank" rel="noopener noreferrer">View invoice</a> · <a href="/invoices/${row.invoice_id}/pdf?download=1">Download invoice</a>` : ""}
              ${!paid && !review ? `<button class="copy-mini" type="button" style="margin-left:8px; padding:7px 10px;" data-link="${escapeHtml(row.payment_url || "")}" onclick="copyText(this.dataset.link)">Copy</button>
              <form method="POST" action="/jobs/${row.job_id}/stripe-link/${row.id}/send-sms" style="display:inline; margin-left:8px;" onsubmit="return confirm('Send this Stripe payment link by SMS?');"><button type="submit" class="copy-mini" style="padding:7px 10px; background:#188a18;">Send SMS</button></form>` : ""}
              ${!paid ? `<form method="POST" action="/jobs/${row.job_id}/stripe-link/${row.id}/check-payment" style="display:inline; margin-left:8px;"><button type="submit" class="copy-mini" style="padding:7px 10px; background:#334155;">Check payment</button></form>` : ""}
              <br><span class="muted">Created ${escapeHtml(formatDateTime(row.created_at))} by ${escapeHtml(row.created_by || "Unknown")} · ${escapeHtml(row.stripe_mode || "unknown")} mode</span>
              ${row.sent_at ? `<br><span class="muted">SMS sent ${escapeHtml(formatDateTime(row.sent_at))} by ${escapeHtml(row.sent_by || "Unknown")}</span>` : ""}
            </div>
          </div>
        </div>`;
      }).join("")}
    </div>
  `;
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

function compactPhone(value) {
  return String(value || "").replace(/\s+/g, "").trim();
}

function compactPostcode(value) {
  return String(value || "").toUpperCase().replace(/\s+/g, "").trim();
}

function hasFilledValue(value) {
  return value !== null && value !== undefined && String(value).trim() !== "";
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
  return compactPostcode(postcode);
}

function cleanPostcode(postcode) {
  return normalisePostcode(postcode);
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
    .action-button.blue { background: #2563eb; }
    .action-button.orange { background: #f97316; color: white; }
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
    .job-scheduled { background: #7c3aed; color: white; }
    .job-closed, .job-fully-paid { background: var(--brand-red); color: white; }
    .job-awaiting-payment, .job-awaiting-balance { background: #f59e0b; color: black; }
    .job-invoiced-account, .job-sent-to-pm { background: #ec4899; color: white; }
    .job-disputed { background: #f97316; color: white; }
    .job-cancelled-before-arrival { background: #6b7280; color: white; }
    .job-cancelled-onsite { background: #4b5563; color: white; }
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
        <a class="side-link${active("/mobile-orders")}" href="/mobile-orders"><span class="side-dot dot-green"></span><span>Mobile Orders</span></a>
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
        <a class="side-link${active("/management-dashboard")}" href="/management-dashboard"><span class="side-dot dot-blue"></span><span>Management Dashboard</span></a>
        <a class="side-link${active("/reports")}" href="/reports"><span class="side-dot dot-green"></span><span>Reports</span></a>
        <a class="side-link${active("/payment-chasing")}" href="/payment-chasing"><span class="side-dot dot-amber"></span><span>Payment chasing</span></a>
        <a class="side-link${active("/disputes")}" href="/disputes"><span class="side-dot dot-red"></span><span>Disputes</span></a>

        <div class="sidebar-label section-label">Admin</div>
        <a class="side-link${active("/admin")}" href="/admin/users"><span class="side-dot dot-red"></span><span>Admin Manager</span></a>
        <a class="side-link${active("/admin/yay-caller-ids")}" href="/admin/yay-caller-ids"><span class="side-dot dot-blue"></span><span>Yay SMS setup</span></a>
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
  await pool.query(`ALTER TABLE technicians ADD COLUMN IF NOT EXISTS technician_pin TEXT;`);
  await pool.query(`ALTER TABLE technicians ADD COLUMN IF NOT EXISTS return_to_work_date DATE;`);
  const techPinRows = (await pool.query(`SELECT id FROM technicians WHERE technician_pin IS NULL OR technician_pin = ''`)).rows;
  for (const row of techPinRows) {
    await pool.query(`UPDATE technicians SET technician_pin = $1 WHERE id = $2`, [makeTechnicianPin(), row.id]);
  }
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
  await pool.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS source_job_id INTEGER;`);
  await pool.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS stripe_payment_link_id INTEGER;`);
  await pool.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS stripe_paid_at TIMESTAMP;`);
  await pool.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS stripe_checkout_session_id TEXT;`);
  await pool.query(`CREATE INDEX IF NOT EXISTS invoices_source_job_idx ON invoices (source_job_id, created_at DESC);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS invoices_stripe_link_idx ON invoices (stripe_payment_link_id);`);

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
      lock_change_keys TEXT,
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
      scheduled_at TIMESTAMP,
      dispatcher_name TEXT,
      dispatcher_notes TEXT,
      status TEXT DEFAULT 'open',
      net_value NUMERIC(10,2),
      vat_amount NUMERIC(10,2),
      final_value NUMERIC(10,2),
      payment_method TEXT,
      payment_method_1 TEXT,
      payment_amount_1 NUMERIC(10,2),
      payment_method_2 TEXT,
      payment_amount_2 NUMERIC(10,2),
      invoice_photos_confirmed BOOLEAN DEFAULT FALSE,
      card_is_amex BOOLEAN DEFAULT FALSE,
      amex_id_provided BOOLEAN DEFAULT FALSE,
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
  await pool.query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS lock_change_keys TEXT;`);
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
  await pool.query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMP;`);
  await pool.query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS dispatcher_name TEXT;`);
  await pool.query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS dispatcher_notes TEXT;`);
  await pool.query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS net_value NUMERIC(10,2);`);
  await pool.query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS vat_amount NUMERIC(10,2);`);
  await pool.query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS final_value NUMERIC(10,2);`);
  await pool.query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS payment_method TEXT;`);
  await pool.query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS payment_method_1 TEXT;`);
  await pool.query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS payment_amount_1 NUMERIC(10,2);`);
  await pool.query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS payment_method_2 TEXT;`);
  await pool.query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS payment_amount_2 NUMERIC(10,2);`);
  await pool.query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS invoice_photos_confirmed BOOLEAN DEFAULT FALSE;`);
  await pool.query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS card_is_amex BOOLEAN DEFAULT FALSE;`);
  await pool.query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS amex_id_provided BOOLEAN DEFAULT FALSE;`);
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
  await pool.query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS imported_from TEXT;`);
  await pool.query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS old_order_id TEXT;`);
  await pool.query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS old_portal_url TEXT;`);
  await pool.query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS is_imported BOOLEAN DEFAULT FALSE;`);
  await pool.query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS imported_at TIMESTAMP;`);
  await pool.query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS import_batch TEXT;`);
  await pool.query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS original_status TEXT;`);
  await pool.query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS original_technician_name TEXT;`);
  await pool.query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS original_raw_json JSONB;`);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS jobs_old_order_id_unique ON jobs (old_order_id) WHERE old_order_id IS NOT NULL;`);

  await pool.query(`CREATE INDEX IF NOT EXISTS jobs_status_idx ON jobs (status);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS jobs_created_at_idx ON jobs (created_at);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS jobs_postcode_idx ON jobs (postcode);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS jobs_assigned_technician_idx ON jobs (assigned_technician_id);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS jobs_source_campaign_idx ON jobs (source_campaign);`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS deleted_jobs_log (
      id SERIAL PRIMARY KEY,
      job_id INTEGER,
      job_number TEXT,
      postcode TEXT,
      customer_name TEXT,
      deleted_by TEXT,
      deleted_at TIMESTAMP DEFAULT NOW(),
      job_snapshot JSONB
    );
  `);
  await pool.query(`ALTER TABLE deleted_jobs_log ADD COLUMN IF NOT EXISTS job_id INTEGER;`);
  await pool.query(`ALTER TABLE deleted_jobs_log ADD COLUMN IF NOT EXISTS job_number TEXT;`);
  await pool.query(`ALTER TABLE deleted_jobs_log ADD COLUMN IF NOT EXISTS postcode TEXT;`);
  await pool.query(`ALTER TABLE deleted_jobs_log ADD COLUMN IF NOT EXISTS customer_name TEXT;`);
  await pool.query(`ALTER TABLE deleted_jobs_log ADD COLUMN IF NOT EXISTS deleted_by TEXT;`);
  await pool.query(`ALTER TABLE deleted_jobs_log ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP DEFAULT NOW();`);
  await pool.query(`ALTER TABLE deleted_jobs_log ADD COLUMN IF NOT EXISTS job_snapshot JSONB;`);
  await pool.query(`CREATE INDEX IF NOT EXISTS deleted_jobs_log_deleted_at_idx ON deleted_jobs_log (deleted_at DESC);`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS job_audit_log (
      id SERIAL PRIMARY KEY,
      job_id INTEGER NOT NULL,
      action_type TEXT,
      field_name TEXT,
      old_value TEXT,
      new_value TEXT,
      changed_by TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  await pool.query(`ALTER TABLE job_audit_log ADD COLUMN IF NOT EXISTS action_type TEXT;`);
  await pool.query(`ALTER TABLE job_audit_log ADD COLUMN IF NOT EXISTS field_name TEXT;`);
  await pool.query(`ALTER TABLE job_audit_log ADD COLUMN IF NOT EXISTS old_value TEXT;`);
  await pool.query(`ALTER TABLE job_audit_log ADD COLUMN IF NOT EXISTS new_value TEXT;`);
  await pool.query(`ALTER TABLE job_audit_log ADD COLUMN IF NOT EXISTS changed_by TEXT;`);
  await pool.query(`ALTER TABLE job_audit_log ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();`);
  await pool.query(`CREATE INDEX IF NOT EXISTS job_audit_log_job_idx ON job_audit_log (job_id, created_at DESC);`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS job_payment_chases (
      id SERIAL PRIMARY KEY,
      job_id INTEGER NOT NULL,
      chase_date DATE NOT NULL DEFAULT CURRENT_DATE,
      outcome TEXT,
      next_follow_up_date DATE,
      notes TEXT,
      chased_by TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);
  await pool.query(`ALTER TABLE job_payment_chases ADD COLUMN IF NOT EXISTS job_id INTEGER NOT NULL;`);
  await pool.query(`ALTER TABLE job_payment_chases ADD COLUMN IF NOT EXISTS chase_date DATE NOT NULL DEFAULT CURRENT_DATE;`);
  await pool.query(`ALTER TABLE job_payment_chases ADD COLUMN IF NOT EXISTS action_taken TEXT;`);
  await pool.query(`ALTER TABLE job_payment_chases ADD COLUMN IF NOT EXISTS outcome TEXT;`);
  await pool.query(`ALTER TABLE job_payment_chases ADD COLUMN IF NOT EXISTS next_follow_up_date DATE;`);
  await pool.query(`ALTER TABLE job_payment_chases ADD COLUMN IF NOT EXISTS notes TEXT;`);
  await pool.query(`ALTER TABLE job_payment_chases ADD COLUMN IF NOT EXISTS chased_by TEXT;`);
  await pool.query(`ALTER TABLE job_payment_chases ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();`);
  await pool.query(`CREATE INDEX IF NOT EXISTS job_payment_chases_job_idx ON job_payment_chases (job_id, chase_date DESC, created_at DESC);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS job_payment_chases_follow_up_idx ON job_payment_chases (next_follow_up_date);`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS job_evidence_links (
      id SERIAL PRIMARY KEY,
      job_id INTEGER NOT NULL,
      evidence_type TEXT DEFAULT 'Other evidence',
      evidence_url TEXT NOT NULL,
      notes TEXT,
      added_by TEXT,
      added_at TIMESTAMP DEFAULT NOW(),
      archived BOOLEAN DEFAULT FALSE,
      archived_at TIMESTAMP
    );
  `);
  await pool.query(`ALTER TABLE job_evidence_links ADD COLUMN IF NOT EXISTS job_id INTEGER;`);
  await pool.query(`ALTER TABLE job_evidence_links ADD COLUMN IF NOT EXISTS evidence_type TEXT DEFAULT 'Other evidence';`);
  await pool.query(`ALTER TABLE job_evidence_links ADD COLUMN IF NOT EXISTS evidence_url TEXT;`);
  await pool.query(`ALTER TABLE job_evidence_links ADD COLUMN IF NOT EXISTS notes TEXT;`);
  await pool.query(`ALTER TABLE job_evidence_links ADD COLUMN IF NOT EXISTS added_by TEXT;`);
  await pool.query(`ALTER TABLE job_evidence_links ADD COLUMN IF NOT EXISTS added_at TIMESTAMP DEFAULT NOW();`);
  await pool.query(`ALTER TABLE job_evidence_links ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT FALSE;`);
  await pool.query(`ALTER TABLE job_evidence_links ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP;`);
  await pool.query(`CREATE INDEX IF NOT EXISTS job_evidence_links_job_idx ON job_evidence_links (job_id, added_at DESC);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS job_evidence_links_archive_idx ON job_evidence_links (archived, added_at);`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS job_payment_links (
      id SERIAL PRIMARY KEY,
      job_id INTEGER NOT NULL,
      provider TEXT DEFAULT 'stripe',
      amount NUMERIC(10,2) NOT NULL,
      currency TEXT DEFAULT 'gbp',
      reason TEXT,
      payment_url TEXT NOT NULL,
      provider_session_id TEXT,
      status TEXT DEFAULT 'created',
      stripe_mode TEXT,
      provider_response TEXT,
      created_by TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      sent_by TEXT,
      sent_at TIMESTAMP,
      invoice_id INTEGER
    );
  `);
  await pool.query(`ALTER TABLE job_payment_links ADD COLUMN IF NOT EXISTS job_id INTEGER;`);
  await pool.query(`ALTER TABLE job_payment_links ADD COLUMN IF NOT EXISTS provider TEXT DEFAULT 'stripe';`);
  await pool.query(`ALTER TABLE job_payment_links ADD COLUMN IF NOT EXISTS amount NUMERIC(10,2);`);
  await pool.query(`ALTER TABLE job_payment_links ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'gbp';`);
  await pool.query(`ALTER TABLE job_payment_links ADD COLUMN IF NOT EXISTS reason TEXT;`);
  await pool.query(`ALTER TABLE job_payment_links ADD COLUMN IF NOT EXISTS payment_url TEXT;`);
  await pool.query(`ALTER TABLE job_payment_links ADD COLUMN IF NOT EXISTS provider_session_id TEXT;`);
  await pool.query(`ALTER TABLE job_payment_links ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'created';`);
  await pool.query(`ALTER TABLE job_payment_links ADD COLUMN IF NOT EXISTS stripe_mode TEXT;`);
  await pool.query(`ALTER TABLE job_payment_links ADD COLUMN IF NOT EXISTS provider_response TEXT;`);
  await pool.query(`ALTER TABLE job_payment_links ADD COLUMN IF NOT EXISTS created_by TEXT;`);
  await pool.query(`ALTER TABLE job_payment_links ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();`);
  await pool.query(`ALTER TABLE job_payment_links ADD COLUMN IF NOT EXISTS sent_by TEXT;`);
  await pool.query(`ALTER TABLE job_payment_links ADD COLUMN IF NOT EXISTS sent_at TIMESTAMP;`);
  await pool.query(`ALTER TABLE job_payment_links ADD COLUMN IF NOT EXISTS invoice_id INTEGER;`);
  await pool.query(`ALTER TABLE job_payment_links ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP;`);
  await pool.query(`ALTER TABLE job_payment_links ADD COLUMN IF NOT EXISTS amount_paid NUMERIC(10,2);`);
  await pool.query(`ALTER TABLE job_payment_links ADD COLUMN IF NOT EXISTS stripe_checkout_session_id TEXT;`);
  await pool.query(`ALTER TABLE job_payment_links ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT;`);
  await pool.query(`ALTER TABLE job_payment_links ADD COLUMN IF NOT EXISTS last_webhook_event_id TEXT;`);
  await pool.query(`ALTER TABLE job_payment_links ADD COLUMN IF NOT EXISTS reconciled_at TIMESTAMP;`);
  await pool.query(`CREATE INDEX IF NOT EXISTS job_payment_links_job_idx ON job_payment_links (job_id, created_at DESC);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS job_payment_links_invoice_idx ON job_payment_links (invoice_id);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS job_payment_links_session_idx ON job_payment_links (provider_session_id);`);

  await pool.query(`CREATE INDEX IF NOT EXISTS job_payment_links_checkout_idx ON job_payment_links (stripe_checkout_session_id);`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS stripe_payment_receipts (
      id SERIAL PRIMARY KEY,
      checkout_session_id TEXT UNIQUE NOT NULL,
      payment_link_row_id INTEGER NOT NULL,
      job_id INTEGER NOT NULL,
      invoice_id INTEGER,
      stripe_payment_link_id TEXT,
      payment_intent_id TEXT,
      amount_paid NUMERIC(10,2),
      currency TEXT,
      event_id TEXT,
      paid_at TIMESTAMP,
      raw_summary TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS stripe_payment_receipts_job_idx ON stripe_payment_receipts (job_id, paid_at DESC);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS stripe_payment_receipts_link_idx ON stripe_payment_receipts (payment_link_row_id, paid_at DESC);`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS stripe_webhook_events (
      event_id TEXT PRIMARY KEY,
      event_type TEXT,
      status TEXT DEFAULT 'received',
      payload TEXT,
      error TEXT,
      received_at TIMESTAMP DEFAULT NOW(),
      processed_at TIMESTAMP
    );
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS stripe_webhook_events_status_idx ON stripe_webhook_events (status, received_at DESC);`);



  await pool.query(`
    CREATE TABLE IF NOT EXISTS job_sms_log (
      id SERIAL PRIMARY KEY,
      job_id INTEGER NOT NULL,
      sent_to TEXT,
      sms_type TEXT,
      template_name TEXT,
      message_body TEXT,
      status TEXT DEFAULT 'logged',
      provider TEXT DEFAULT 'yay',
      provider_response TEXT,
      sent_by TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);
  await pool.query(`ALTER TABLE job_sms_log ADD COLUMN IF NOT EXISTS job_id INTEGER;`);
  await pool.query(`ALTER TABLE job_sms_log ADD COLUMN IF NOT EXISTS sent_to TEXT;`);
  await pool.query(`ALTER TABLE job_sms_log ADD COLUMN IF NOT EXISTS sms_type TEXT;`);
  await pool.query(`ALTER TABLE job_sms_log ADD COLUMN IF NOT EXISTS template_name TEXT;`);
  await pool.query(`ALTER TABLE job_sms_log ADD COLUMN IF NOT EXISTS message_body TEXT;`);
  await pool.query(`ALTER TABLE job_sms_log ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'logged';`);
  await pool.query(`ALTER TABLE job_sms_log ADD COLUMN IF NOT EXISTS provider TEXT DEFAULT 'yay';`);
  await pool.query(`ALTER TABLE job_sms_log ADD COLUMN IF NOT EXISTS provider_response TEXT;`);
  await pool.query(`ALTER TABLE job_sms_log ADD COLUMN IF NOT EXISTS sent_by TEXT;`);
  await pool.query(`ALTER TABLE job_sms_log ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();`);
  await pool.query(`CREATE INDEX IF NOT EXISTS job_sms_log_job_idx ON job_sms_log (job_id, created_at DESC);`);

  await pool.query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS payment_chase_closed_at TIMESTAMP;`);
  await pool.query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS payment_chase_closed_by TEXT;`);
  await pool.query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS payment_chase_close_note TEXT;`);

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
  const agentName = currentAgentName(req) || "there";

  const safeCount = async (label, sql, params = []) => {
    try {
      const result = await pool.query(sql, params);
      return Number(result.rows[0]?.count || 0);
    } catch (error) {
      console.error(`Start shift count error (${label}):`, error);
      return 0;
    }
  };

  const safeRows = async (label, sql, params = []) => {
    try {
      const result = await pool.query(sql, params);
      return result.rows || [];
    } catch (error) {
      console.error(`Start shift list error (${label}):`, error);
      return [];
    }
  };

  const callsTakenToday = await safeCount("calls taken today", `
    SELECT COUNT(*)::int AS count
    FROM calls
    WHERE start_time >= date_trunc('day', NOW())
      AND LOWER(COALESCE(call_type, '')) = 'inbound'
      AND COALESCE(answered_by, '') <> ''
  `);

  const activeJobsToday = await safeCount("active jobs today", `
    SELECT COUNT(*)::int AS count
    FROM jobs
    WHERE created_at >= date_trunc('day', NOW())
      AND status IN ('open', 'assigned')
  `);

  const jobsNotClosed = await safeCount("jobs not closed", `
    SELECT COUNT(*)::int AS count
    FROM jobs
    WHERE COALESCE(status, 'open') NOT IN (
      'closed', 'fully_paid', 'cancelled_before_arrival', 'cancelled_onsite', 'completed', 'fully_paid_private'
    )
  `);

  const disputedJobs = await safeCount("disputed jobs", `
    SELECT COUNT(*)::int AS count
    FROM (
      SELECT id FROM jobs WHERE status = 'disputed'
      UNION
      SELECT job_id AS id
      FROM disputes
      WHERE job_id IS NOT NULL
        AND LOWER(COALESCE(status, 'open_dispute')) NOT IN ('resolved', 'rejected', 'refund_processed')
    ) disputed_jobs
  `);

  const paymentFollowUp = await safeCount("payment follow up", `
    SELECT COUNT(*)::int AS count
    FROM jobs
    WHERE status IN ('awaiting_payment', 'awaiting_balance', 'sent_to_pm', 'disputed')
       OR customer_paid = FALSE
  `);

  const invoicesNotSent = await safeCount("invoices not sent", `
    SELECT COUNT(*)::int AS count
    FROM invoices
    WHERE LOWER(COALESCE(invoice_stage, 'Draft only')) NOT LIKE '%emailed%'
      AND LOWER(COALESCE(invoice_stage, '')) NOT LIKE '%cancelled%'
  `);

  const openRows = await safeRows("open unassigned jobs", `
    SELECT job_number, postcode, job_type, created_at
    FROM jobs
    WHERE status = 'open'
      AND assigned_technician_id IS NULL
    ORDER BY created_at ASC
    LIMIT 5
  `);

  const assignedRows = await safeRows("assigned jobs", `
    SELECT j.job_number, j.postcode, j.job_type, j.created_at, t.name AS technician_name
    FROM jobs j
    LEFT JOIN technicians t ON t.id = j.assigned_technician_id
    WHERE j.status = 'assigned'
    ORDER BY j.created_at ASC
    LIMIT 5
  `);

  const disputedRows = await safeRows("disputed rows", `
    SELECT DISTINCT j.id, j.job_number, j.postcode, j.job_type, j.customer_name, j.updated_at, j.created_at
    FROM jobs j
    LEFT JOIN disputes d ON d.job_id = j.id
    WHERE j.status = 'disputed'
       OR LOWER(COALESCE(d.status, '')) NOT IN ('', 'resolved', 'rejected', 'refund_processed')
    ORDER BY COALESCE(j.updated_at, j.created_at) DESC
    LIMIT 5
  `);

  const followUpRows = await safeRows("payment follow up rows", `
    WITH latest_chase AS (
      SELECT DISTINCT ON (job_id) job_id, chase_date, outcome, next_follow_up_date, chased_by, created_at
      FROM job_payment_chases
      ORDER BY job_id, chase_date DESC, created_at DESC, id DESC
    )
    SELECT j.id, j.job_number, j.postcode, j.customer_name, j.status, lc.chase_date, lc.outcome, lc.next_follow_up_date
    FROM jobs j
    LEFT JOIN latest_chase lc ON lc.job_id = j.id
    WHERE j.status IN ('awaiting_payment', 'awaiting_balance', 'sent_to_pm', 'disputed')
       OR j.customer_paid = FALSE
    ORDER BY lc.next_follow_up_date ASC NULLS FIRST, COALESCE(j.updated_at, j.created_at) DESC
    LIMIT 5
  `);

  const unsentInvoiceRows = await safeRows("unsent invoice rows", `
    SELECT invoice_number, customer_name, customer_postcode, invoice_stage, created_at
    FROM invoices
    WHERE LOWER(COALESCE(invoice_stage, 'Draft only')) NOT LIKE '%emailed%'
      AND LOWER(COALESCE(invoice_stage, '')) NOT LIKE '%cancelled%'
    ORDER BY created_at DESC
    LIMIT 5
  `);

  const techRows = await safeRows("technician availability", `
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE LOWER(COALESCE(status, '')) LIKE '%available%' AND LOWER(COALESCE(status, '')) NOT LIKE '%soon%')::int AS available,
      COUNT(*) FILTER (WHERE LOWER(COALESCE(status, '')) LIKE '%job%')::int AS on_job,
      COUNT(*) FILTER (WHERE LOWER(COALESCE(status, '')) LIKE '%soon%')::int AS soon
    FROM technicians
    WHERE active = TRUE
  `);
  const tech = techRows[0] || {};

  const metric = (label, value, href, tone = "") => `
    <a class="metric-card ${tone}" href="${escapeHtml(href)}">
      <span>${escapeHtml(label)}</span>
      <strong>${Number(value || 0)}</strong>
    </a>
  `;

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

  const disputeList = lineList(disputedRows, "No disputed jobs showing right now.", job => `
    <div class="brief-line"><strong>${escapeHtml(job.postcode || job.job_number || 'Job')}</strong> — ${escapeHtml(job.customer_name || 'Customer')} · ${escapeHtml(job.job_type || 'Job')}</div>
  `);

  const followUpList = lineList(followUpRows, "No unpaid follow-up items showing right now.", job => `
    <div class="brief-line"><strong>${escapeHtml(job.postcode || job.job_number || 'Job')}</strong> — ${escapeHtml(jobStatusLabel(job.status))}${job.next_follow_up_date ? ` · next ${escapeHtml(chaseDateInputValue(job.next_follow_up_date))}` : ' · follow-up needed'}</div>
  `);

  const invoiceList = lineList(unsentInvoiceRows, "No unsent invoices showing right now.", invoice => `
    <div class="brief-line"><strong>${escapeHtml(invoice.customer_postcode || invoice.invoice_number || 'Invoice')}</strong> — ${escapeHtml(invoice.customer_name || 'Customer')} · ${escapeHtml(invoice.invoice_stage || 'Draft only')}</div>
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
          --blue: #2563eb;
          --purple: #7c3aed;
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
          width: min(820px, 100%);
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
        .metric-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin: 18px 0 22px; }
        .metric-card {
          display: block;
          text-decoration: none;
          border: 1px solid var(--border);
          border-radius: 16px;
          padding: 14px;
          background: #f8fafc;
          color: #1f2937;
        }
        .metric-card span { display: block; color: #64748b; font-size: 12px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.05em; line-height: 1.25; min-height: 30px; }
        .metric-card strong { display: block; margin-top: 8px; font-size: 30px; line-height: 1; }
        .metric-card.red { border-color: #fecaca; background: #fff1f2; }
        .metric-card.amber { border-color: #fde68a; background: #fffbeb; }
        .metric-card.blue { border-color: #bfdbfe; background: #eff6ff; }
        .metric-card.purple { border-color: #ddd6fe; background: #f5f3ff; }
        .metric-card.green { border-color: #bbf7d0; background: #f0fdf4; }
        .brief-item {
          border-radius: 14px;
          padding: 15px 17px;
          margin: 12px 0;
          border-left: 5px solid;
        }
        .brief-red { background: #fde9e7; border-left-color: var(--red); }
        .brief-amber { background: #fff3e1; border-left-color: var(--amber); }
        .brief-green { background: #e7f7ed; border-left-color: var(--green); }
        .brief-blue { background: #eff6ff; border-left-color: var(--blue); }
        .brief-purple { background: #f5f3ff; border-left-color: var(--purple); }
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
        @media (max-width: 720px) { .metric-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
        @media (max-width: 560px) {
          body { padding: 16px; align-items: flex-start; }
          .brief-card { padding: 24px; margin-top: 20px; }
          .logo-row { justify-content: center; align-items: flex-start; }
          .logo-row img { width: 92px; height: 92px; }
          h1 { font-size: 26px; }
          .metric-grid { grid-template-columns: 1fr; }
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

        <div class="metric-grid">
          ${metric("Calls taken today", callsTakenToday, "/call-wallboard", "blue")}
          ${metric("Active jobs today", activeJobsToday, "/jobs", "green")}
          ${metric("Jobs not yet closed", jobsNotClosed, "/jobs", "amber")}
          ${metric("Disputed jobs", disputedJobs, "/disputes", "purple")}
          ${metric("Payment follow-up", paymentFollowUp, "/payment-chasing", "red")}
          ${metric("Invoices not sent", invoicesNotSent, "/invoices", "amber")}
        </div>

        <section class="brief-item brief-red">
          <div class="brief-title">Open jobs waiting to be assigned</div>
          ${openList}
        </section>

        <section class="brief-item brief-amber">
          <div class="brief-title">Assigned jobs awaiting completion</div>
          ${assignedList}
        </section>

        <section class="brief-item brief-purple">
          <div class="brief-title">Disputed jobs</div>
          ${disputeList}
        </section>

        <section class="brief-item brief-red">
          <div class="brief-title">Partially paid / unpaid jobs needing follow-up</div>
          ${followUpList}
        </section>

        <section class="brief-item brief-blue">
          <div class="brief-title">Invoices not yet sent</div>
          ${invoiceList}
        </section>

        <section class="brief-item brief-green">
          <div class="brief-title">Technician availability</div>
          <div class="brief-line">${Number(tech.available || 0)} available · ${Number(tech.on_job || 0)} on job · ${Number(tech.soon || 0)} available soon</div>
        </section>

        <a class="start-button" href="/call-wallboard">Start shift — enter portal</a>
        <a class="secondary-link" href="/jobs">Go straight to Dispatch Board</a>
      </main>
    </body>
    </html>
  `);
});
app.get("/", (req, res) => res.redirect("/start-shift"));

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


function flattenYayCallerIds(value, found = []) {
  if (!value || typeof value !== "object") return found;
  if (Array.isArray(value)) {
    value.forEach(item => flattenYayCallerIds(item, found));
    return found;
  }

  const uuid = value.uuid || value.caller_id_uuid || value.id || "";
  const possibleNumber = value.number || value.phone_number || value.cli || value.caller_id || value.destination_number || value.name || "";
  if (uuid || possibleNumber) {
    found.push({
      uuid: String(uuid || ""),
      number: String(possibleNumber || ""),
      label: String(value.nickname || value.name || value.description || value.friendly_name || "")
    });
  }

  Object.values(value).forEach(child => flattenYayCallerIds(child, found));
  return found;
}

app.get("/admin/yay-caller-ids", async (req, res) => {
  try {
    let apiResult = null;
    let rows = [];
    let errorMessage = "";
    let debugResults = [];

    if (yayAuthConfigured()) {
      debugResults = [
        await yayApiDebugRequest("GET", "/authenticated", null),
        await yayApiDebugRequest("GET", "/voip/caller-id", null),
        await yayApiDebugRequest("GET", "/voip/caller-id/cli", null)
      ];

      const firstGoodCallerId = debugResults.find(result => result.ok && (result.path === "/voip/caller-id" || result.path === "/voip/caller-id/cli"));
      if (firstGoodCallerId) {
        apiResult = { json: firstGoodCallerId.json, text: firstGoodCallerId.text, status: firstGoodCallerId.status };
        rows = flattenYayCallerIds(firstGoodCallerId.json || {});
      } else {
        const authCheck = debugResults.find(result => result.path === "/authenticated");
        const callerCheck = debugResults.find(result => result.path === "/voip/caller-id") || debugResults[0];
        errorMessage = `Yay API failed. Auth test ${authCheck ? authCheck.status : "not run"}; caller ID test ${callerCheck ? callerCheck.status : "not run"}. See diagnostics below.`;
      }
    } else {
      errorMessage = "Yay auth variables are missing in Render.";
    }

    const configuredCallerId = String(process.env.YAY_SMS_CALLER_ID_UUID || "").trim();
    const rowHtml = rows.length ? rows.map(row => `
      <tr>
        <td>${escapeHtml(row.label || "—")}</td>
        <td>${escapeHtml(row.number || "—")}</td>
        <td><code>${escapeHtml(row.uuid || "—")}</code></td>
        <td>${looksLikeUuid(row.uuid) ? `<span class="pill available">UUID found</span>` : `<span class="pill awaiting">Check response</span>`}</td>
      </tr>
    `).join("") : `<tr><td colspan="4">No caller IDs found yet. Check the raw response below or the Render/Yay settings.</td></tr>`;

    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Yay SMS Setup</title>
        <style>${sharedStyles()}</style>
      </head>
      <body>
        ${nav(req)}
        <h1>Yay SMS Setup</h1>
        <div class="subtitle">Use this page to find the caller ID UUID for the SMS sender number.</div>

        <div class="panel">
          <h2>Current Render SMS settings</h2>
          <div class="grid-3">
            <div class="metric-card"><div class="metric-label">Yay API host</div><div class="metric-value" style="font-size:16px;">${escapeHtml(yayApiHost())}</div></div>
            <div class="metric-card"><div class="metric-label">Yay auth</div><div class="metric-value" style="font-size:16px;">${yayAuthConfigured() ? "Configured" : "Missing"}</div></div>
            <div class="metric-card"><div class="metric-label">SMS caller ID UUID</div><div class="metric-value" style="font-size:16px;">${escapeHtml(configuredCallerId || "Not set")}</div></div>
          </div>
          ${configuredCallerId && !looksLikeUuid(configuredCallerId) ? `
            <div style="margin-top:12px; padding:12px; border-radius:14px; background:#fff7ed; border:1px solid #fed7aa; color:#9a3412;">
              <strong>Action needed:</strong> YAY_SMS_CALLER_ID_UUID currently does not look like a UUID. Once you find the correct UUID below, replace the phone number in Render with that UUID.
            </div>
          ` : ""}
          ${errorMessage ? `<div style="margin-top:12px; padding:12px; border-radius:14px; background:#fee2e2; border:1px solid #fecaca; color:#991b1b;"><strong>Yay API error:</strong> ${escapeHtml(errorMessage)}</div>` : ""}
        </div>

        <div class="panel">
          <h2>Caller IDs returned by Yay</h2>
          <table>
            <thead><tr><th>Label</th><th>Number / caller ID</th><th>UUID</th><th>Status</th></tr></thead>
            <tbody>${rowHtml}</tbody>
          </table>
          <p class="muted-note">Find the row for 02080501579, copy the UUID, then paste it into Render as YAY_SMS_CALLER_ID_UUID.</p>
        </div>

        <div class="panel">
          <h2>Yay diagnostics</h2>
          <p class="muted-note">This safely shows whether Render has the values and which Yay endpoint is rejecting the request. Passwords are not displayed.</p>
          <pre style="white-space:pre-wrap; font-size:12px; background:#111827; color:#f9fafb; padding:14px; border-radius:14px; overflow:auto; max-height:520px;">${escapeHtml(JSON.stringify({ auth_summary: maskedYayAuthSummary(), tests: debugResults }, null, 2))}</pre>
        </div>

        <div class="panel">
          <h2>Raw Yay response</h2>
          <pre style="white-space:pre-wrap; font-size:12px; background:#111827; color:#f9fafb; padding:14px; border-radius:14px; overflow:auto; max-height:420px;">${escapeHtml(apiResult ? JSON.stringify(apiResult.json || apiResult.text, null, 2) : "No successful caller ID response yet")}</pre>
        </div>
      </body>
      </html>
    `);
  } catch (error) {
    console.error("Yay caller ID lookup error:", error);
    res.status(500).send("Yay caller ID lookup error. Check Render logs.");
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
    const customerPostcode = compactPostcode(req.body.customer_postcode);
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
      ? compactPostcode(req.body.customer_postcode)
      : compactPostcode(req.body.site_postcode);

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
      compactPostcode(req.body.customer_postcode),
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
    const invoiceDisposition = req.query.download === "1" ? "attachment" : "inline";
    res.setHeader("Content-Disposition", `${invoiceDisposition}; filename="invoice-${invoice.invoice_number}.pdf"`);

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
    doc.text("NET", 380, totalsY);
    doc.text(money(invoice.subtotal), 480, totalsY);
    doc.text("VAT @ 20%", 380, totalsY + 18);
    doc.text(money(invoice.vat_amount), 480, totalsY + 18);

    doc.font("Helvetica-Bold");
    doc.text("TOTAL (GROSS)", 380, totalsY + 38);
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



function managementMetricCard(title, value, hint = "") {
  return `
    <div class="metric-card">
      <div class="metric-title">${escapeHtml(title)}</div>
      <div class="metric-value">${value}</div>
      ${hint ? `<div class="muted" style="font-size:12px;margin-top:6px;">${escapeHtml(hint)}</div>` : ""}
    </div>
  `;
}

function percentChangeText(current, previous) {
  const c = Number(current || 0);
  const p = Number(previous || 0);
  if (!p && !c) return "No change";
  if (!p && c) return "New activity";
  const diff = ((c - p) / p) * 100;
  const sign = diff > 0 ? "+" : "";
  return `${sign}${diff.toFixed(1)}%`;
}

function managementComparisonRow(label, current, previous, formatter = value => Number(value || 0)) {
  return `
    <tr>
      <td><strong>${escapeHtml(label)}</strong></td>
      <td>${formatter(current)}</td>
      <td>${formatter(previous)}</td>
      <td>${escapeHtml(percentChangeText(current, previous))}</td>
    </tr>
  `;
}

async function managementPeriodSummary(start, end) {
  const jobsResult = await pool.query(`
    SELECT
      COUNT(*) FILTER (WHERE created_at >= $1 AND created_at < $2)::int AS jobs_created,
      COUNT(*) FILTER (WHERE closed_at >= $1 AND closed_at < $2)::int AS jobs_closed,
      COUNT(*) FILTER (
        WHERE status IN ('cancelled_before_arrival', 'cancelled_onsite')
        AND COALESCE(closed_at, updated_at, created_at) >= $1
        AND COALESCE(closed_at, updated_at, created_at) < $2
      )::int AS jobs_cancelled,
      COUNT(*) FILTER (
        WHERE status IN ('awaiting_payment', 'awaiting_balance')
        AND COALESCE(closed_at, updated_at, created_at) >= $1
        AND COALESCE(closed_at, updated_at, created_at) < $2
      )::int AS awaiting_money_jobs,
      COUNT(*) FILTER (
        WHERE status = 'disputed'
        AND COALESCE(closed_at, updated_at, created_at) >= $1
        AND COALESCE(closed_at, updated_at, created_at) < $2
      )::int AS disputed_close_status_jobs,
      COALESCE(SUM(COALESCE(net_value, CASE WHEN final_value IS NOT NULL THEN final_value / 1.2 ELSE 0 END)) FILTER (WHERE closed_at >= $1 AND closed_at < $2), 0)::numeric AS net_value,
      COALESCE(SUM(COALESCE(vat_amount, CASE WHEN final_value IS NOT NULL THEN final_value - (final_value / 1.2) ELSE 0 END)) FILTER (WHERE closed_at >= $1 AND closed_at < $2), 0)::numeric AS vat_value,
      COALESCE(SUM(COALESCE(final_value, 0)) FILTER (WHERE closed_at >= $1 AND closed_at < $2), 0)::numeric AS gross_value,
      COALESCE(SUM(COALESCE(materials_cost, 0)) FILTER (WHERE closed_at >= $1 AND closed_at < $2), 0)::numeric AS materials_cost,
      COALESCE(AVG(NULLIF(final_value, 0)) FILTER (WHERE closed_at >= $1 AND closed_at < $2), 0)::numeric AS average_job_value,
      COUNT(*) FILTER (
        WHERE closed_at >= $1 AND closed_at < $2
        AND (payment_method ILIKE '%card%' OR payment_method_1 ILIKE '%card%' OR payment_method_2 ILIKE '%card%')
      )::int AS card_jobs,
      COUNT(*) FILTER (
        WHERE closed_at >= $1 AND closed_at < $2
        AND (payment_method ILIKE '%cash%' OR payment_method_1 ILIKE '%cash%' OR payment_method_2 ILIKE '%cash%')
      )::int AS cash_jobs,
      COUNT(*) FILTER (
        WHERE closed_at >= $1 AND closed_at < $2
        AND (payment_method ILIKE '%bank%' OR payment_method_1 ILIKE '%bank%' OR payment_method_2 ILIKE '%bank%')
      )::int AS bank_jobs
    FROM jobs
  `, [start, end]);

  const disputesResult = await pool.query(`
    SELECT
      COUNT(*) FILTER (WHERE created_at >= $1 AND created_at < $2)::int AS disputes_created,
      COUNT(*) FILTER (WHERE status NOT IN ('resolved', 'rejected', 'refund_processed'))::int AS open_disputes,
      COALESCE(SUM(COALESCE(disputed_amount, 0)) FILTER (WHERE created_at >= $1 AND created_at < $2), 0)::numeric AS disputed_amount,
      COALESCE(SUM(COALESCE(refund_amount, 0)) FILTER (WHERE created_at >= $1 AND created_at < $2), 0)::numeric AS refund_amount
    FROM disputes
  `, [start, end]);

  return { ...(jobsResult.rows[0] || {}), ...(disputesResult.rows[0] || {}) };
}

async function managementCampaignRows(start, end) {
  const result = await pool.query(`
    SELECT
      COALESCE(NULLIF(source_campaign, ''), 'Unknown') AS campaign,
      COUNT(*) FILTER (WHERE created_at >= $1 AND created_at < $2)::int AS jobs_created,
      COUNT(*) FILTER (WHERE closed_at >= $1 AND closed_at < $2)::int AS jobs_closed,
      COUNT(*) FILTER (WHERE status IN ('cancelled_before_arrival', 'cancelled_onsite') AND COALESCE(closed_at, updated_at, created_at) >= $1 AND COALESCE(closed_at, updated_at, created_at) < $2)::int AS cancelled_jobs,
      COUNT(*) FILTER (WHERE status IN ('awaiting_payment', 'awaiting_balance') AND COALESCE(closed_at, updated_at, created_at) >= $1 AND COALESCE(closed_at, updated_at, created_at) < $2)::int AS awaiting_money_jobs,
      COUNT(*) FILTER (WHERE status = 'disputed' AND COALESCE(closed_at, updated_at, created_at) >= $1 AND COALESCE(closed_at, updated_at, created_at) < $2)::int AS disputed_status_jobs,
      COALESCE(SUM(COALESCE(net_value, CASE WHEN final_value IS NOT NULL THEN final_value / 1.2 ELSE 0 END)) FILTER (WHERE closed_at >= $1 AND closed_at < $2), 0)::numeric AS net_value,
      COALESCE(SUM(COALESCE(final_value, 0)) FILTER (WHERE closed_at >= $1 AND closed_at < $2), 0)::numeric AS gross_value,
      COALESCE(SUM(COALESCE(materials_cost, 0)) FILTER (WHERE closed_at >= $1 AND closed_at < $2), 0)::numeric AS materials_cost,
      COALESCE(AVG(NULLIF(final_value, 0)) FILTER (WHERE closed_at >= $1 AND closed_at < $2), 0)::numeric AS average_job_value
    FROM jobs
    WHERE created_at >= $1 OR closed_at >= $1 OR updated_at >= $1
    GROUP BY COALESCE(NULLIF(source_campaign, ''), 'Unknown')
    HAVING COUNT(*) FILTER (WHERE created_at >= $1 AND created_at < $2) > 0 OR COUNT(*) FILTER (WHERE closed_at >= $1 AND closed_at < $2) > 0
    ORDER BY gross_value DESC, jobs_created DESC, campaign ASC
    LIMIT 25
  `, [start, end]);
  return result.rows;
}

async function managementTechnicianRows(start, end) {
  const result = await pool.query(`
    SELECT
      COALESCE(t.name, j.tech_close_submitted_by, 'Unassigned') AS technician_name,
      COUNT(j.id) FILTER (WHERE j.closed_at >= $1 AND j.closed_at < $2)::int AS jobs_closed,
      COUNT(j.id) FILTER (WHERE j.status IN ('cancelled_before_arrival', 'cancelled_onsite') AND COALESCE(j.closed_at, j.updated_at, j.created_at) >= $1 AND COALESCE(j.closed_at, j.updated_at, j.created_at) < $2)::int AS cancelled_jobs,
      COUNT(j.id) FILTER (WHERE j.status = 'disputed' AND COALESCE(j.closed_at, j.updated_at, j.created_at) >= $1 AND COALESCE(j.closed_at, j.updated_at, j.created_at) < $2)::int AS disputed_status_jobs,
      COALESCE(SUM(COALESCE(j.net_value, CASE WHEN j.final_value IS NOT NULL THEN j.final_value / 1.2 ELSE 0 END)) FILTER (WHERE j.closed_at >= $1 AND j.closed_at < $2), 0)::numeric AS net_value,
      COALESCE(SUM(COALESCE(j.final_value, 0)) FILTER (WHERE j.closed_at >= $1 AND j.closed_at < $2), 0)::numeric AS gross_value,
      COALESCE(SUM(COALESCE(j.materials_cost, 0)) FILTER (WHERE j.closed_at >= $1 AND j.closed_at < $2), 0)::numeric AS materials_cost,
      COALESCE(AVG(NULLIF(j.final_value, 0)) FILTER (WHERE j.closed_at >= $1 AND j.closed_at < $2), 0)::numeric AS average_job_value
    FROM jobs j
    LEFT JOIN technicians t ON t.id = j.assigned_technician_id
    WHERE j.created_at >= $1 OR j.closed_at >= $1 OR j.updated_at >= $1
    GROUP BY COALESCE(t.name, j.tech_close_submitted_by, 'Unassigned')
    HAVING COUNT(j.id) FILTER (WHERE j.closed_at >= $1 AND j.closed_at < $2) > 0 OR COUNT(j.id) FILTER (WHERE j.status IN ('cancelled_before_arrival', 'cancelled_onsite', 'disputed') AND COALESCE(j.closed_at, j.updated_at, j.created_at) >= $1 AND COALESCE(j.closed_at, j.updated_at, j.created_at) < $2) > 0
    ORDER BY gross_value DESC, jobs_closed DESC, technician_name ASC
    LIMIT 25
  `, [start, end]);
  return result.rows;
}

async function managementProblemJobs(start, end) {
  const result = await pool.query(`
    SELECT j.id, j.job_number, j.customer_name, j.postcode, j.source_campaign, j.status, j.final_value, j.materials_cost, j.closed_at, j.updated_at, t.name AS technician_name
    FROM jobs j
    LEFT JOIN technicians t ON t.id = j.assigned_technician_id
    WHERE (
      j.status IN ('cancelled_before_arrival', 'cancelled_onsite', 'awaiting_payment', 'awaiting_balance', 'disputed')
      OR j.id IN (SELECT job_id FROM disputes WHERE job_id IS NOT NULL AND status NOT IN ('resolved', 'rejected', 'refund_processed'))
    )
    AND COALESCE(j.closed_at, j.updated_at, j.created_at) >= $1
    AND COALESCE(j.closed_at, j.updated_at, j.created_at) < $2
    ORDER BY COALESCE(j.closed_at, j.updated_at, j.created_at) DESC
    LIMIT 40
  `, [start, end]);
  return result.rows;
}

async function managementTrendRows(mode, count) {
  const nowParts = londonDateParts();
  const today = makeDate(nowParts.year, nowParts.month, nowParts.day);
  const ranges = [];
  if (mode === "week") {
    const thisWeekStart = startOfWeekMonday(today);
    for (let i = count - 1; i >= 0; i--) {
      const start = addDays(thisWeekStart, -7 * i);
      const end = i === 0 ? addDays(today, 1) : addDays(start, 7);
      ranges.push({ label: `${dateInputValue(start)} to ${dateInputValue(addDays(end, -1))}`, start, end });
    }
  } else {
    let year = nowParts.year;
    let month = nowParts.month;
    for (let i = count - 1; i >= 0; i--) {
      let m = month - i;
      let y = year;
      while (m <= 0) { m += 12; y -= 1; }
      const start = makeDate(y, m, 1);
      const nextMonth = m === 12 ? makeDate(y + 1, 1, 1) : makeDate(y, m + 1, 1);
      const end = i === 0 ? addDays(today, 1) : nextMonth;
      ranges.push({ label: start.toLocaleString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" }), start, end });
    }
  }
  const rows = [];
  for (const range of ranges) {
    rows.push({ ...range, summary: await managementPeriodSummary(range.start, range.end) });
  }
  return rows;
}

function managementTrendTable(title, rows) {
  return `
    <div class="panel">
      <h2>${escapeHtml(title)}</h2>
      <table>
        <thead><tr><th>Period</th><th>Jobs booked</th><th>Closed</th><th>Cancelled</th><th>Disputes</th><th>NET</th><th>VAT</th><th>Gross</th><th>Materials</th><th>After materials</th><th>Avg value</th></tr></thead>
        <tbody>
          ${rows.map(row => {
            const s = row.summary || {};
            const gross = Number(s.gross_value || 0);
            const materials = Number(s.materials_cost || 0);
            return `
              <tr>
                <td><strong>${escapeHtml(row.label)}</strong></td>
                <td>${Number(s.jobs_created || 0)}</td>
                <td>${Number(s.jobs_closed || 0)}</td>
                <td>${Number(s.jobs_cancelled || 0)}</td>
                <td>${Number(s.disputes_created || 0)}</td>
                <td>${money(s.net_value || 0)}</td>
                <td>${money(s.vat_value || 0)}</td>
                <td>${money(gross)}</td>
                <td>${money(materials)}</td>
                <td><strong>${money(gross - materials)}</strong></td>
                <td>${money(s.average_job_value || 0)}</td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>
    </div>
  `;
}


app.get("/payment-chasing", async (req, res) => {
  try {
    const selected = String(req.query.view || "active").trim();
    const today = dateInputValue(new Date());
    const unpaidWhere = `(j.payment_chase_closed_at IS NULL AND (j.status IN ('awaiting_payment', 'awaiting_balance', 'sent_to_pm', 'disputed') OR (j.closed_at IS NOT NULL AND COALESCE(j.customer_paid, FALSE) = FALSE AND COALESCE(j.final_value, 0) > 0 AND COALESCE(j.status, '') <> 'fully_paid'))) `;
    const where = selected === "due"
      ? `WHERE ${unpaidWhere} AND pc.next_follow_up_date IS NOT NULL AND pc.next_follow_up_date <= CURRENT_DATE`
      : `WHERE ${unpaidWhere}`;

    const result = await pool.query(`
      WITH latest_chase AS (
        SELECT DISTINCT ON (job_id) *
        FROM job_payment_chases
        ORDER BY job_id, chase_date DESC, created_at DESC, id DESC
      ), chase_counts AS (
        SELECT job_id, COUNT(*)::int AS chase_count
        FROM job_payment_chases
        GROUP BY job_id
      ), chase_history AS (
        SELECT
          job_id,
          json_agg(json_build_object(
            'id', id,
            'chase_date', chase_date,
            'action_taken', action_taken,
            'outcome', outcome,
            'next_follow_up_date', next_follow_up_date,
            'notes', notes,
            'chased_by', chased_by,
            'created_at', created_at
          ) ORDER BY chase_date DESC, created_at DESC, id DESC) AS history
        FROM job_payment_chases
        GROUP BY job_id
      )
      SELECT
        j.*, t.name AS technician_name,
        pc.chase_date AS last_chase_date,
        pc.action_taken AS last_action_taken,
        pc.outcome AS last_chase_outcome,
        pc.next_follow_up_date,
        pc.notes AS last_chase_notes,
        pc.chased_by AS last_chased_by,
        pc.created_at AS last_chase_logged_at,
        COALESCE(cc.chase_count, 0)::int AS chase_count,
        COALESCE(ch.history, '[]'::json) AS chase_history
      FROM jobs j
      LEFT JOIN technicians t ON t.id = j.assigned_technician_id
      LEFT JOIN latest_chase pc ON pc.job_id = j.id
      LEFT JOIN chase_counts cc ON cc.job_id = j.id
      LEFT JOIN chase_history ch ON ch.job_id = j.id
      ${where}
      ORDER BY
        CASE WHEN pc.next_follow_up_date IS NOT NULL AND pc.next_follow_up_date <= CURRENT_DATE THEN 0 ELSE 1 END,
        COALESCE(pc.next_follow_up_date, CURRENT_DATE + INTERVAL '90 days') ASC,
        COALESCE(j.closed_at, j.updated_at, j.created_at) DESC
      LIMIT 300
    `);

    const rows = result.rows;
    const dueCount = rows.filter(row => row.next_follow_up_date && chaseDateInputValue(row.next_follow_up_date) <= today).length;
    const noChaseCount = rows.filter(row => !row.last_chase_date).length;
    const totalAttempts = rows.reduce((sum, row) => sum + Number(row.chase_count || 0), 0);
    const totalOwed = rows.reduce((sum, row) => sum + Number(row.final_value || 0), 0);
    const totalMaterials = rows.reduce((sum, row) => sum + Number(row.materials_cost || 0), 0);

    const cards = `
      <div class="metric-grid">
        <div class="metric-card"><div class="metric-label">Open payment chase logs</div><div class="metric-value">${rows.length}</div></div>
        <div class="metric-card"><div class="metric-label">Total chase attempts</div><div class="metric-value">${totalAttempts}</div></div>
        <div class="metric-card"><div class="metric-label">Follow-up due</div><div class="metric-value">${dueCount}</div></div>
        <div class="metric-card"><div class="metric-label">Never chased</div><div class="metric-value">${noChaseCount}</div></div>
        <div class="metric-card"><div class="metric-label">Value outstanding</div><div class="metric-value">${money(totalOwed)}</div></div>
        <div class="metric-card"><div class="metric-label">Materials exposed</div><div class="metric-value">${money(totalMaterials)}</div></div>
      </div>
    `;

    function chaseHistoryList(job) {
      const history = Array.isArray(job.chase_history) ? job.chase_history : [];
      if (!history.length) return `<div class="chase-history empty">No chase attempts logged yet.</div>`;
      return `<div class="chase-history">
        <div class="chase-history-title">${Number(job.chase_count || 0)} payment chase attempt${Number(job.chase_count || 0) === 1 ? "" : "s"}</div>
        ${history.map((chase, index) => `
          <div class="chase-attempt">
            <div class="attempt-number">#${history.length - index}</div>
            <div>
              <strong>${escapeHtml(chaseDateInputValue(chase.chase_date))}</strong>
              ${chase.action_taken ? ` · ${escapeHtml(chase.action_taken)}` : ""}
              <br><span>${escapeHtml(chase.outcome || "No outcome entered")}</span>
              ${chase.notes ? `<br><span class="muted">Notes: ${escapeHtml(chase.notes)}</span>` : ""}
              ${chase.next_follow_up_date ? `<br><span class="muted">Next follow-up: ${escapeHtml(chaseDateInputValue(chase.next_follow_up_date))}</span>` : ""}
              <br><span class="muted">Logged by ${escapeHtml(chase.chased_by || "Unknown")} on ${escapeHtml(formatDateTime(chase.created_at))}</span>
            </div>
          </div>
        `).join("")}
      </div>`;
    }

    const body = rows.map(job => `
      <tr>
        <td>
          <a href="/jobs/${job.id}/edit"><strong>${escapeHtml(job.job_number || jobNumber(job.id))}${job.postcode ? ` · ${escapeHtml(job.postcode)}` : ""}</strong></a><br>
          <span class="muted">${escapeHtml(job.customer_name || "—")} ${job.customer_phone ? `· ${escapeHtml(job.customer_phone)}` : ""}</span><br>
          <span class="pill ${jobStatusClass(job.status)}">${escapeHtml(jobStatusLabel(job.status))}</span>
        </td>
        <td>
          <strong>${money(job.final_value || 0)}</strong><br>
          <span class="muted">Paid: ${job.customer_paid ? "Yes" : "No"}</span><br>
          <span class="muted">Tech: ${escapeHtml(job.technician_name || "Unassigned")}</span>
        </td>
        <td>
          ${job.last_chase_date ? `<strong>${escapeHtml(chaseDateInputValue(job.last_chase_date))}</strong><br><span class="muted">${escapeHtml(job.last_action_taken || "Action not recorded")}</span><br><span class="muted">${escapeHtml(job.last_chased_by || "Unknown")}</span>` : `<span class="muted">Not chased yet</span>`}
        </td>
        <td>
          ${job.last_chase_outcome ? escapeHtml(job.last_chase_outcome) : `<span class="muted">—</span>`}
          ${job.last_chase_notes ? `<br><span class="muted">${escapeHtml(job.last_chase_notes)}</span>` : ""}
        </td>
        <td>${job.next_follow_up_date ? `<strong>${escapeHtml(chaseDateInputValue(job.next_follow_up_date))}</strong>` : `<span class="muted">Not set</span>`}</td>
        <td>
          <form method="POST" action="/jobs/${job.id}/payment-chase" class="chase-form">
            <label>Chase date<input type="date" name="chase_date" value="${escapeHtml(today)}" required></label>
            <label>Action taken
              <select name="action_taken" required>
                <option value="">Select action</option>
                <option>Called client</option>
                <option>Left voicemail</option>
                <option>Sent SMS</option>
                <option>Sent WhatsApp</option>
                <option>Sent email</option>
                <option>Sent invoice reminder</option>
                <option>Contacted PM / account client</option>
                <option>Disputed</option>
                <option>Other</option>
              </select>
            </label>
            <label>Outcome<input name="outcome" placeholder="e.g. promised payment today" required></label>
            <label>Next follow-up<input type="date" name="next_follow_up_date"></label>
            <label>Notes<input name="notes" placeholder="Extra notes"></label>
            <button type="submit">Log attempt</button>
          </form>
          <form method="POST" action="/jobs/${job.id}/payment-chase/close" class="close-chase-form" onsubmit="return confirm('Close this payment chase log as paid/resolved?');">
            <input name="close_note" placeholder="Close note, e.g. paid by card" required>
            <button type="submit" class="red-button">Mark paid / close chase</button>
          </form>
        </td>
      </tr>
      <tr class="history-row"><td colspan="6">${chaseHistoryList(job)}</td></tr>
    `).join("");

    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Payment Chasing</title>
        <style>
          ${sharedStyles()}
          .chase-form { display:grid; grid-template-columns: 130px 170px minmax(180px,1fr) 130px minmax(160px,1fr) auto; gap:8px; align-items:end; }
          .chase-form label { font-size:11px; font-weight:800; color:#64748b; text-transform:uppercase; letter-spacing:.04em; }
          .chase-form input, .chase-form select { width:100%; margin-top:4px; padding:9px; min-width:0; }
          .chase-form button { padding:10px 12px; white-space:nowrap; }
          .close-chase-form { display:flex; gap:8px; margin-top:10px; align-items:center; }
          .close-chase-form input { flex:1; padding:9px; min-width:180px; }
          .red-button { background:#dc2626 !important; }
          .chase-history { background:#f8fafc; border:1px solid #e2e8f0; border-radius:14px; padding:12px; }
          .chase-history.empty { color:#64748b; }
          .chase-history-title { font-weight:900; margin-bottom:8px; }
          .chase-attempt { display:grid; grid-template-columns:44px 1fr; gap:10px; padding:9px 0; border-top:1px solid #e2e8f0; }
          .chase-attempt:first-of-type { border-top:0; }
          .attempt-number { width:34px; height:34px; border-radius:999px; background:#111827; color:#fff; display:flex; align-items:center; justify-content:center; font-weight:900; font-size:12px; }
          .history-row td { padding-top:0; border-top:0; }
          @media (max-width: 1200px) { .chase-form { grid-template-columns: 1fr 1fr; } .close-chase-form { flex-direction:column; align-items:stretch; } }
          @media (max-width: 700px) { .chase-form { grid-template-columns: 1fr; } }
        </style>
      </head>
      <body>
        ${nav(req)}
        <h1>Payment Chasing</h1>
        <div class="subtitle">Track each chase attempt, the action taken, the outcome, and the next follow-up date. Close the chase once the payment has been received.</div>
        <div class="page-actions">
          <a class="action-button ${selected === "active" ? "dark" : ""}" href="/payment-chasing">Open payment chases</a>
          <a class="action-button ${selected === "due" ? "dark" : ""}" href="/payment-chasing?view=due">Follow-up due</a>
          <a class="action-button" href="/jobs">Back to Dispatch Board</a>
        </div>
        ${cards}
        <div class="panel">
          <h2>Open payment chase logs</h2>
          <table>
            <thead><tr><th>Job / customer</th><th>Value / tech</th><th>Last action</th><th>Last outcome</th><th>Next follow-up</th><th>Log next attempt / close</th></tr></thead>
            <tbody>${body || `<tr><td colspan="6" class="muted">No open payment chase logs.</td></tr>`}</tbody>
          </table>
        </div>
      </body>
      </html>
    `);
  } catch (error) {
    console.error("Payment chasing page error:", error);
    res.status(500).send(`Payment chasing page error: ${escapeHtml(error.message)}. Check Render logs.`);
  }
});

app.post("/jobs/:id/payment-chase", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const body = req.body;
    const chaseDate = body.chase_date || dateInputValue(new Date());
    const actionTaken = String(body.action_taken || "").trim();
    const nextFollowUp = body.next_follow_up_date || null;
    const outcome = String(body.outcome || "").trim();
    const notes = String(body.notes || "").trim();
    const changedBy = currentAgentName(req);

    await pool.query(`
      INSERT INTO job_payment_chases (job_id, chase_date, action_taken, outcome, next_follow_up_date, notes, chased_by, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
    `, [id, chaseDate, actionTaken, outcome, nextFollowUp, notes, changedBy]);

    await addJobAuditEntry(
      id,
      "payment_chase_logged",
      "Payment chase",
      "—",
      `${chaseDate}${actionTaken ? ` · ${actionTaken}` : ""}${outcome ? ` · ${outcome}` : ""}${nextFollowUp ? ` · next ${nextFollowUp}` : ""}`,
      changedBy
    );

    if (actionTaken.toLowerCase() === "disputed") {
      const jobResult = await pool.query(`
        SELECT j.*, t.name AS technician_name
        FROM jobs j
        LEFT JOIN technicians t ON t.id = j.assigned_technician_id
        WHERE j.id = $1
      `, [id]);
      const job = jobResult.rows[0] || {};

      const historyResult = await pool.query(`
        SELECT chase_date, action_taken, outcome, next_follow_up_date, notes, chased_by, created_at
        FROM job_payment_chases
        WHERE job_id = $1
        ORDER BY chase_date ASC, created_at ASC, id ASC
      `, [id]);

      const chaseLines = historyResult.rows.map((chase, index) => {
        const pieces = [
          `#${index + 1}`,
          chaseDateInputValue(chase.chase_date),
          chase.action_taken || "Action not recorded",
          chase.outcome || "No outcome recorded"
        ];
        let line = pieces.join(" - ");
        if (chase.notes) line += ` | Notes: ${chase.notes}`;
        if (chase.next_follow_up_date) line += ` | Next follow-up: ${chaseDateInputValue(chase.next_follow_up_date)}`;
        if (chase.chased_by) line += ` | By: ${chase.chased_by}`;
        return line;
      }).join("\n");

      const disputeSummary = [
        `Payment chase escalated to dispute on ${chaseDateInputValue(chaseDate)} by ${changedBy}.`,
        `Job: ${job.job_number || jobNumber(id)}${job.postcode ? ` / ${job.postcode}` : ""}`,
        job.customer_name ? `Customer: ${job.customer_name}` : "",
        job.customer_phone ? `Phone: ${job.customer_phone}` : "",
        job.technician_name ? `Technician: ${job.technician_name}` : "",
        `Outstanding / disputed value: ${money(job.final_value || 0)}`,
        "",
        "Payment chase history:",
        chaseLines || "No chase history recorded."
      ].filter(line => line !== "").join("\n");

      const existingDispute = await pool.query(`
        SELECT id
        FROM disputes
        WHERE job_id = $1
          AND status NOT IN ('resolved', 'rejected', 'refund_processed')
        ORDER BY created_at DESC
        LIMIT 1
      `, [id]);

      let disputeId;
      if (existingDispute.rows[0]) {
        disputeId = existingDispute.rows[0].id;
        await pool.query(`
          UPDATE disputes
          SET status = 'open_dispute',
              complaint_type = COALESCE(NULLIF(complaint_type, ''), 'Payment chase escalated'),
              disputed_amount = COALESCE(disputed_amount, $2),
              complaint_summary = $3,
              updated_by = $4,
              updated_at = NOW()
          WHERE id = $1
        `, [disputeId, parseMoneyInput(job.final_value), disputeSummary, changedBy]);
      } else {
        const insert = await pool.query(`
          INSERT INTO disputes (
            job_id, customer_name, customer_phone, technician_id, complaint_type,
            disputed_amount, refund_amount, chargeback, status, complaint_summary,
            resolution_notes, created_by, updated_by, resolved_at
          ) VALUES ($1,$2,$3,$4,$5,$6,NULL,FALSE,'open_dispute',$7,'',$8,$8,NULL)
          RETURNING id
        `, [
          id,
          job.customer_name || "",
          compactPhone(job.customer_phone || ""),
          job.assigned_technician_id || null,
          "Payment chase escalated",
          parseMoneyInput(job.final_value),
          disputeSummary,
          changedBy
        ]);
        disputeId = insert.rows[0].id;
      }

      await pool.query(`
        UPDATE jobs
        SET status = 'disputed',
            payment_chase_closed_at = NOW(),
            payment_chase_closed_by = $2,
            payment_chase_close_note = 'Escalated to dispute',
            updated_at = NOW()
        WHERE id = $1
      `, [id, changedBy]);

      await addJobAuditEntry(
        id,
        "payment_chase_escalated_to_dispute",
        "Payment chase",
        "Open payment chase",
        `Escalated to dispute #${disputeId}`,
        changedBy
      );

      res.redirect(`/disputes/${disputeId}`);
      return;
    }

    const back = req.headers.referer && String(req.headers.referer).includes('/payment-chasing') ? '/payment-chasing' : `/jobs/${id}/edit`;
    res.redirect(back);
  } catch (error) {
    console.error("Payment chase save error:", error);
    res.status(500).send(`Payment chase save error: ${escapeHtml(error.message)}. Check Render logs.`);
  }
});

app.post("/jobs/:id/payment-chase/close", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const closeNote = String(req.body.close_note || "").trim();
    const changedBy = currentAgentName(req);

    await pool.query(`
      UPDATE jobs
      SET customer_paid = TRUE,
          status = 'fully_paid',
          payment_chase_closed_at = NOW(),
          payment_chase_closed_by = $2,
          payment_chase_close_note = $3,
          updated_at = NOW()
      WHERE id = $1
    `, [id, changedBy, closeNote]);

    await addJobAuditEntry(
      id,
      "payment_chase_closed",
      "Payment chase",
      "Open",
      `Closed as paid/resolved${closeNote ? ` · ${closeNote}` : ""}`,
      changedBy
    );

    res.redirect('/payment-chasing');
  } catch (error) {
    console.error("Payment chase close error:", error);
    res.status(500).send(`Payment chase close error: ${escapeHtml(error.message)}. Check Render logs.`);
  }
});



function managementDashboardMetric(title, value, hint = "", href = "", tone = "") {
  const inner = `
    <div class="mgmt-kpi ${tone}">
      <div class="mgmt-kpi-label">${escapeHtml(title)}</div>
      <div class="mgmt-kpi-value">${value}</div>
      ${hint ? `<div class="mgmt-kpi-hint">${escapeHtml(hint)}</div>` : ""}
    </div>
  `;
  return href ? `<a class="mgmt-kpi-link" href="${href}">${inner}</a>` : inner;
}

function managementDashboardBar(label, value, maxValue, displayValue) {
  const numeric = Number(value || 0);
  const max = Math.max(Number(maxValue || 0), 0.01);
  const width = Math.max(2, Math.min(100, (numeric / max) * 100));
  return `
    <div class="mgmt-bar-row">
      <div class="mgmt-bar-label">${escapeHtml(label || "Unknown")}</div>
      <div class="mgmt-bar-track"><div class="mgmt-bar-fill" style="width:${width.toFixed(1)}%"></div></div>
      <div class="mgmt-bar-value">${displayValue}</div>
    </div>
  `;
}

app.get("/management-dashboard", async (req, res) => {
  try {
    const reportRange = buildReportRange(req.query.range ? req.query : { ...req.query, range: "today" });
    const start = reportRange.start;
    const end = reportRange.end;

    const [
      summary,
      technicianRows,
      campaignRows,
      paidJobsResult,
      stripeCollectedResult,
      outstandingResult,
      liveJobsResult,
      techSnapshotResult,
      stripeReviewResult,
      dispatcherResult
    ] = await Promise.all([
      managementPeriodSummary(start, end),
      managementTechnicianRows(start, end),
      managementCampaignRows(start, end),
      pool.query(`
        SELECT
          COUNT(*)::int AS paid_jobs,
          COALESCE(SUM(COALESCE(final_value,0)),0)::numeric AS paid_value
        FROM jobs
        WHERE COALESCE(customer_paid,FALSE) = TRUE
          AND COALESCE(closed_at, updated_at, created_at) >= $1
          AND COALESCE(closed_at, updated_at, created_at) < $2
      `, [start, end]),
      pool.query(`
        SELECT
          COUNT(*)::int AS payment_count,
          COALESCE(SUM(COALESCE(amount_paid,0)),0)::numeric AS stripe_value
        FROM stripe_payment_receipts
        WHERE paid_at >= $1 AND paid_at < $2
      `, [start, end]),
      pool.query(`
        SELECT
          COUNT(*)::int AS count,
          COALESCE(SUM(GREATEST(
            COALESCE(j.final_value,0)
            - COALESCE(j.payment_amount_1,0)
            - COALESCE(j.payment_amount_2,0)
            - COALESCE(sr.stripe_paid,0),
            0
          )),0)::numeric AS value
        FROM jobs j
        LEFT JOIN (
          SELECT job_id, SUM(COALESCE(amount_paid,0))::numeric AS stripe_paid
          FROM stripe_payment_receipts
          GROUP BY job_id
        ) sr ON sr.job_id = j.id
        WHERE COALESCE(j.customer_paid,FALSE) = FALSE
          AND COALESCE(j.final_value,0) > 0
          AND COALESCE(j.status,'') NOT IN ('cancelled_before_arrival','cancelled_onsite','fully_paid')
          AND (j.closed_at IS NOT NULL OR j.status IN ('awaiting_payment','awaiting_balance','sent_to_pm','disputed'))
      `),
      pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE status = 'open')::int AS unassigned,
          COUNT(*) FILTER (WHERE status = 'assigned')::int AS assigned,
          COUNT(*) FILTER (WHERE status IN ('open','assigned','scheduled'))::int AS active_jobs
        FROM jobs
      `),
      pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE active = TRUE)::int AS active_techs,
          COUNT(*) FILTER (WHERE active = TRUE AND LOWER(COALESCE(status,'')) LIKE '%job%')::int AS on_job,
          COUNT(*) FILTER (WHERE active = TRUE AND LOWER(COALESCE(status,'')) LIKE '%available%')::int AS available
        FROM technicians
      `),
      pool.query(`
        SELECT COUNT(*)::int AS count
        FROM job_payment_links
        WHERE status IN ('payment_review','paid_multiple_review')
      `),
      pool.query(`
        SELECT
          COALESCE(NULLIF(dispatcher_name,''),'Unknown') AS dispatcher_name,
          COUNT(*) FILTER (WHERE created_at >= $1 AND created_at < $2)::int AS jobs_booked,
          COUNT(*) FILTER (WHERE closed_at >= $1 AND closed_at < $2)::int AS jobs_closed,
          COALESCE(SUM(COALESCE(final_value,0)) FILTER (WHERE closed_at >= $1 AND closed_at < $2),0)::numeric AS gross_value
        FROM jobs
        WHERE created_at >= $1 OR closed_at >= $1
        GROUP BY COALESCE(NULLIF(dispatcher_name,''),'Unknown')
        HAVING COUNT(*) FILTER (WHERE created_at >= $1 AND created_at < $2) > 0
            OR COUNT(*) FILTER (WHERE closed_at >= $1 AND closed_at < $2) > 0
        ORDER BY jobs_booked DESC, gross_value DESC
        LIMIT 20
      `, [start, end])
    ]);

    const paidJobs = paidJobsResult.rows[0] || {};
    const stripeCollected = stripeCollectedResult.rows[0] || {};
    const outstanding = outstandingResult.rows[0] || {};
    const liveJobs = liveJobsResult.rows[0] || {};
    const techSnapshot = techSnapshotResult.rows[0] || {};
    const stripeReview = stripeReviewResult.rows[0] || {};
    const dispatcherRows = dispatcherResult.rows || [];

    const gross = Number(summary.gross_value || 0);
    const net = Number(summary.net_value || 0);
    const vat = Number(summary.vat_value || 0);
    const materials = Number(summary.materials_cost || 0);
    const closed = Number(summary.jobs_closed || 0);
    const booked = Number(summary.jobs_created || 0);
    const cancelled = Number(summary.jobs_cancelled || 0);
    const disputes = Number(summary.disputes_created || 0);
    const avgJob = Number(summary.average_job_value || 0);
    const paidValue = Number(paidJobs.paid_value || 0);
    const stripeValue = Number(stripeCollected.stripe_value || 0);
    const outstandingValue = Number(outstanding.value || 0);
    const collectionRate = gross > 0 ? Math.min(100, (paidValue / gross) * 100) : 0;
    const closureRate = booked > 0 ? Math.min(100, (closed / booked) * 100) : 0;

    const topTechMax = Math.max(0, ...technicianRows.slice(0, 8).map(row => Number(row.gross_value || 0)));
    const topCampaignMax = Math.max(0, ...campaignRows.slice(0, 8).map(row => Number(row.gross_value || 0)));

    const techBars = technicianRows.slice(0, 8).map(row =>
      managementDashboardBar(row.technician_name || "Unassigned", row.gross_value, topTechMax, `${Number(row.jobs_closed || 0)} jobs · ${money(row.gross_value || 0)}`)
    ).join("");

    const campaignBars = campaignRows.slice(0, 8).map(row =>
      managementDashboardBar(row.campaign || "Unknown", row.gross_value, topCampaignMax, `${Number(row.jobs_created || 0)} booked · ${money(row.gross_value || 0)}`)
    ).join("");

    const technicianBody = technicianRows.slice(0, 12).map((row, index) => {
      const grossValue = Number(row.gross_value || 0);
      const materialValue = Number(row.materials_cost || 0);
      return `
        <tr>
          <td><span class="mgmt-rank">${index + 1}</span> <strong>${escapeHtml(row.technician_name || "Unassigned")}</strong></td>
          <td>${Number(row.jobs_closed || 0)}</td>
          <td>${money(grossValue)}</td>
          <td>${money(row.average_job_value || 0)}</td>
          <td>${money(materialValue)}</td>
          <td><strong>${money(grossValue - materialValue)}</strong></td>
          <td>${Number(row.cancelled_jobs || 0)}</td>
          <td>${Number(row.disputed_status_jobs || 0)}</td>
        </tr>
      `;
    }).join("");

    const dispatcherBody = dispatcherRows.map((row, index) => `
      <tr>
        <td><span class="mgmt-rank">${index + 1}</span> <strong>${escapeHtml(row.dispatcher_name || "Unknown")}</strong></td>
        <td>${Number(row.jobs_booked || 0)}</td>
        <td>${Number(row.jobs_closed || 0)}</td>
        <td>${money(row.gross_value || 0)}</td>
      </tr>
    `).join("");

    const campaignBody = campaignRows.slice(0, 12).map(row => `
      <tr>
        <td><strong>${escapeHtml(row.campaign || "Unknown")}</strong></td>
        <td>${Number(row.jobs_created || 0)}</td>
        <td>${Number(row.jobs_closed || 0)}</td>
        <td>${money(row.gross_value || 0)}</td>
        <td>${money(row.average_job_value || 0)}</td>
        <td>${Number(row.cancelled_jobs || 0)}</td>
        <td>${Number(row.awaiting_money_jobs || 0)}</td>
      </tr>
    `).join("");

    const paymentTotal = Number(summary.card_jobs || 0) + Number(summary.cash_jobs || 0) + Number(summary.bank_jobs || 0);
    const paymentRows = [
      ["Card", Number(summary.card_jobs || 0)],
      ["Cash", Number(summary.cash_jobs || 0)],
      ["Bank transfer", Number(summary.bank_jobs || 0)]
    ].map(([label, count]) => {
      const pct = paymentTotal > 0 ? (count / paymentTotal) * 100 : 0;
      return `<div class="mgmt-payment-row"><span>${escapeHtml(label)}</span><div class="mgmt-payment-track"><div class="mgmt-payment-fill" style="width:${pct.toFixed(1)}%"></div></div><strong>${count}</strong></div>`;
    }).join("");

    const alertItems = [];
    if (Number(liveJobs.unassigned || 0) > 0) alertItems.push(`<a href="/jobs?status=open"><strong>${Number(liveJobs.unassigned || 0)}</strong> job${Number(liveJobs.unassigned || 0) === 1 ? "" : "s"} waiting to be assigned</a>`);
    if (Number(outstanding.count || 0) > 0) alertItems.push(`<a href="/payment-chasing"><strong>${Number(outstanding.count || 0)}</strong> unpaid job${Number(outstanding.count || 0) === 1 ? "" : "s"} · ${money(outstandingValue)} outstanding</a>`);
    if (Number(summary.open_disputes || 0) > 0) alertItems.push(`<a href="/disputes"><strong>${Number(summary.open_disputes || 0)}</strong> open dispute${Number(summary.open_disputes || 0) === 1 ? "" : "s"}</a>`);
    if (Number(stripeReview.count || 0) > 0) alertItems.push(`<a href="/reports"><strong>${Number(stripeReview.count || 0)}</strong> Stripe payment${Number(stripeReview.count || 0) === 1 ? "" : "s"} need review</a>`);

    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Management Dashboard</title>
        <style>
          ${sharedStyles()}
          .management-dashboard { max-width: 1540px; }
          .mgmt-hero { background:linear-gradient(135deg,#111827 0%,#1f2937 55%,#334155 100%);color:#fff;border-radius:22px;padding:24px 26px;margin-bottom:18px;box-shadow:0 14px 34px rgba(15,23,42,.14); }
          .mgmt-hero-top { display:flex;justify-content:space-between;gap:20px;align-items:flex-start;flex-wrap:wrap; }
          .mgmt-hero h1 { color:#fff;margin:0 0 5px; }
          .mgmt-hero .subtitle { color:#cbd5e1;margin:0; }
          .mgmt-periods { display:flex;gap:8px;flex-wrap:wrap; }
          .mgmt-periods a { color:#fff;text-decoration:none;border:1px solid rgba(255,255,255,.26);padding:9px 13px;border-radius:10px;font-weight:900;font-size:12px;background:rgba(255,255,255,.07); }
          .mgmt-periods a.active { background:#fff;color:#111827;border-color:#fff; }
          .mgmt-kpi-grid { display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin:16px 0; }
          .mgmt-kpi-link { text-decoration:none;color:inherit; }
          .mgmt-kpi { background:#fff;border:1px solid #dbe3ee;border-radius:16px;padding:16px;min-height:115px;box-shadow:0 7px 20px rgba(15,23,42,.05); }
          .mgmt-kpi:hover { transform:translateY(-1px);box-shadow:0 10px 24px rgba(15,23,42,.08); }
          .mgmt-kpi.good { border-top:4px solid #16a34a; }
          .mgmt-kpi.warn { border-top:4px solid #f59e0b; }
          .mgmt-kpi.info { border-top:4px solid #2563eb; }
          .mgmt-kpi.danger { border-top:4px solid #dc2626; }
          .mgmt-kpi-label { text-transform:uppercase;letter-spacing:.06em;font-size:11px;color:#64748b;font-weight:900; }
          .mgmt-kpi-value { font-size:29px;line-height:1.1;font-weight:950;color:#0f172a;margin:8px 0 6px; }
          .mgmt-kpi-hint { font-size:12px;color:#64748b;line-height:1.35; }
          .mgmt-section-grid { display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px; }
          .mgmt-panel { background:#fff;border:1px solid #dbe3ee;border-radius:18px;padding:18px;box-shadow:0 7px 20px rgba(15,23,42,.04); }
          .mgmt-panel h2 { margin:0 0 4px; }
          .mgmt-panel-head { display:flex;justify-content:space-between;gap:12px;align-items:center;margin-bottom:14px; }
          .mgmt-panel-head a { font-size:12px;font-weight:900; }
          .mgmt-bar-row { display:grid;grid-template-columns:minmax(110px,180px) 1fr minmax(120px,175px);gap:10px;align-items:center;margin:11px 0; }
          .mgmt-bar-label { font-weight:900;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis; }
          .mgmt-bar-track,.mgmt-payment-track { height:10px;border-radius:999px;background:#e5e7eb;overflow:hidden; }
          .mgmt-bar-fill { height:100%;border-radius:999px;background:linear-gradient(90deg,#2563eb,#16a34a); }
          .mgmt-bar-value { text-align:right;font-size:11px;color:#475569;font-weight:800; }
          .mgmt-rank { display:inline-flex;width:23px;height:23px;border-radius:999px;background:#e2e8f0;align-items:center;justify-content:center;font-size:11px;font-weight:900;margin-right:4px; }
          .mgmt-payment-row { display:grid;grid-template-columns:110px 1fr 40px;gap:10px;align-items:center;margin:13px 0;font-size:12px;font-weight:800; }
          .mgmt-payment-fill { height:100%;border-radius:999px;background:#334155; }
          .mgmt-alerts { display:flex;gap:9px;flex-wrap:wrap;margin-top:17px; }
          .mgmt-alerts a { text-decoration:none;color:#7c2d12;background:#fff7ed;border:1px solid #fed7aa;border-radius:999px;padding:9px 12px;font-size:12px;font-weight:800; }
          .mgmt-quiet { color:#166534;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:10px 12px;font-weight:800;font-size:12px;display:inline-block;margin-top:16px; }
          .mgmt-snapshot { display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:12px; }
          .mgmt-snapshot > div { background:#f8fafc;border:1px solid #e2e8f0;border-radius:13px;padding:13px; }
          .mgmt-snapshot strong { display:block;font-size:23px;color:#0f172a; }
          .mgmt-snapshot span { color:#64748b;font-size:11px;font-weight:800; }
          .mgmt-table-wrap { overflow-x:auto; }
          .mgmt-footer-links { display:flex;gap:10px;flex-wrap:wrap;margin:16px 0 30px; }
          @media(max-width:1150px){.mgmt-kpi-grid{grid-template-columns:repeat(2,1fr)}.mgmt-section-grid{grid-template-columns:1fr}}
          @media(max-width:650px){.mgmt-kpi-grid{grid-template-columns:1fr}.mgmt-snapshot{grid-template-columns:1fr}.mgmt-bar-row{grid-template-columns:110px 1fr}.mgmt-bar-value{grid-column:2;text-align:left}.mgmt-hero{padding:18px}}
        </style>
      </head>
      <body>
        ${nav(req)}
        <main class="app-main management-dashboard">
          <div class="mgmt-hero">
            <div class="mgmt-hero-top">
              <div>
                <h1>Management Dashboard</h1>
                <div class="subtitle">The owner view: how the business is performing, what is moving, and what needs attention.</div>
              </div>
              <div class="mgmt-periods">
                <a class="${reportRange.range === "today" ? "active" : ""}" href="/management-dashboard?range=today">Today</a>
                <a class="${reportRange.range === "this_week" ? "active" : ""}" href="/management-dashboard?range=this_week">This week</a>
                <a class="${reportRange.range === "this_month" ? "active" : ""}" href="/management-dashboard?range=this_month">This month</a>
              </div>
            </div>
            ${alertItems.length ? `<div class="mgmt-alerts">${alertItems.join("")}</div>` : `<div class="mgmt-quiet">✓ Nothing urgent is being flagged right now.</div>`}
          </div>

          <div class="mgmt-kpi-grid">
            ${managementDashboardMetric("Jobs booked", booked, `${reportRange.label} · ${closureRate.toFixed(0)}% closed`, `/reports/management?range=${reportRange.range}`, "info")}
            ${managementDashboardMetric("Jobs completed", closed, `${cancelled} cancelled · ${disputes} new dispute${disputes === 1 ? "" : "s"}`, `/reports/management?range=${reportRange.range}`, closed ? "good" : "")}
            ${managementDashboardMetric("Gross revenue", money(gross), `NET ${money(net)} · VAT ${money(vat)}`, `/reports/management?range=${reportRange.range}`, "good")}
            ${managementDashboardMetric("Average job value", money(avgJob), `${closed} completed job${closed === 1 ? "" : "s"}`, `/reports/management?range=${reportRange.range}`, "info")}
            ${managementDashboardMetric("Paid job value", money(paidValue), `${Number(paidJobs.paid_jobs || 0)} paid job${Number(paidJobs.paid_jobs || 0) === 1 ? "" : "s"} · ${collectionRate.toFixed(0)}% of closed gross`, `/reports/management?range=${reportRange.range}`, "good")}
            ${managementDashboardMetric("Stripe collected", money(stripeValue), `${Number(stripeCollected.payment_count || 0)} confirmed Stripe payment${Number(stripeCollected.payment_count || 0) === 1 ? "" : "s"}`, "/reports", "good")}
            ${managementDashboardMetric("Outstanding now", money(outstandingValue), `${Number(outstanding.count || 0)} job${Number(outstanding.count || 0) === 1 ? "" : "s"} need money`, "/payment-chasing", Number(outstanding.count || 0) ? "warn" : "good")}
            ${managementDashboardMetric("After materials", money(gross - materials), `Materials ${money(materials)}`, `/reports/management?range=${reportRange.range}`, "info")}
          </div>

          <div class="mgmt-section-grid">
            <section class="mgmt-panel">
              <div class="mgmt-panel-head"><div><h2>Live operations</h2><div class="subtitle">What is happening right now.</div></div><a href="/jobs">Open Dispatch Board</a></div>
              <div class="mgmt-snapshot">
                <div><strong>${Number(liveJobs.active_jobs || 0)}</strong><span>Active jobs</span></div>
                <div><strong>${Number(liveJobs.unassigned || 0)}</strong><span>Waiting assignment</span></div>
                <div><strong>${Number(liveJobs.assigned || 0)}</strong><span>Assigned</span></div>
                <div><strong>${Number(techSnapshot.on_job || 0)}</strong><span>Technicians on jobs</span></div>
                <div><strong>${Number(techSnapshot.available || 0)}</strong><span>Technicians available</span></div>
                <div><strong>${Number(techSnapshot.active_techs || 0)}</strong><span>Active technicians</span></div>
              </div>
            </section>

            <section class="mgmt-panel">
              <div class="mgmt-panel-head"><div><h2>How customers paid</h2><div class="subtitle">Payment method mix for completed jobs in ${escapeHtml(reportRange.label.toLowerCase())}.</div></div><a href="/reports/management?range=${reportRange.range}">Full report</a></div>
              ${paymentRows}
              <div class="subtitle" style="margin-top:14px;">Stripe confirms actual online receipts separately: <strong>${money(stripeValue)}</strong>.</div>
            </section>
          </div>

          <div class="mgmt-section-grid">
            <section class="mgmt-panel">
              <div class="mgmt-panel-head"><div><h2>Top technicians</h2><div class="subtitle">Gross value and completed jobs for ${escapeHtml(reportRange.label.toLowerCase())}.</div></div><a href="/reports/management?range=${reportRange.range}">Drill into reporting</a></div>
              ${techBars || `<div class="subtitle">No completed technician jobs in this period yet.</div>`}
            </section>
            <section class="mgmt-panel">
              <div class="mgmt-panel-head"><div><h2>Where the work came from</h2><div class="subtitle">Campaign/source performance for ${escapeHtml(reportRange.label.toLowerCase())}.</div></div><a href="/campaigns">Campaigns</a></div>
              ${campaignBars || `<div class="subtitle">No campaign activity in this period yet.</div>`}
            </section>
          </div>

          <section class="mgmt-panel" style="margin-bottom:16px;">
            <div class="mgmt-panel-head"><div><h2>Technician leaderboard</h2><div class="subtitle">Management-level comparison, using the same job data as Reports.</div></div><a href="/reports/management?range=${reportRange.range}">Full technician report</a></div>
            <div class="mgmt-table-wrap"><table><thead><tr><th>Technician</th><th>Completed</th><th>Gross</th><th>Avg job</th><th>Materials</th><th>After materials</th><th>Cancelled</th><th>Disputed</th></tr></thead><tbody>${technicianBody || `<tr><td colspan="8" class="muted">No technician performance data yet.</td></tr>`}</tbody></table></div>
          </section>

          <div class="mgmt-section-grid">
            <section class="mgmt-panel">
              <div class="mgmt-panel-head"><div><h2>Dispatcher activity</h2><div class="subtitle">Jobs booked and value of jobs closed, attributed to the booking dispatcher.</div></div><a href="/reports">Reports</a></div>
              <div class="mgmt-table-wrap"><table><thead><tr><th>Dispatcher</th><th>Booked</th><th>Closed</th><th>Gross</th></tr></thead><tbody>${dispatcherBody || `<tr><td colspan="4" class="muted">No dispatcher activity in this period.</td></tr>`}</tbody></table></div>
            </section>
            <section class="mgmt-panel">
              <div class="mgmt-panel-head"><div><h2>Source performance</h2><div class="subtitle">A quick commercial view of lead/source quality.</div></div><a href="/reports/management?range=${reportRange.range}">Full source report</a></div>
              <div class="mgmt-table-wrap"><table><thead><tr><th>Source</th><th>Booked</th><th>Closed</th><th>Gross</th><th>Avg</th><th>Cancelled</th><th>Awaiting £</th></tr></thead><tbody>${campaignBody || `<tr><td colspan="7" class="muted">No source data in this period.</td></tr>`}</tbody></table></div>
            </section>
          </div>

          <div class="mgmt-footer-links">
            <a class="action-button" href="/reports/management?range=${reportRange.range}">Open full Management Report</a>
            <a class="action-button dark" href="/reports">Reporting & exports</a>
            <a class="action-button amber" href="/payment-chasing">Payment chasing</a>
            <a class="action-button red" href="/disputes">Disputes</a>
          </div>
        </main>
      </body>
      </html>
    `);
  } catch (error) {
    console.error("Management dashboard error:", error);
    res.status(500).send(`Management dashboard error: ${escapeHtml(error.message || String(error))}. Check Render logs.`);
  }
});

app.get("/reports/management", async (req, res) => {
  try {
    const nowParts = londonDateParts();
    const today = makeDate(nowParts.year, nowParts.month, nowParts.day);
    const thisWeekStart = startOfWeekMonday(today);
    const lastWeekStart = addDays(thisWeekStart, -7);
    const thisMonthStart = makeDate(nowParts.year, nowParts.month, 1);
    const lastMonthNumber = nowParts.month === 1 ? 12 : nowParts.month - 1;
    const lastMonthYear = nowParts.month === 1 ? nowParts.year - 1 : nowParts.year;
    const lastMonthStart = makeDate(lastMonthYear, lastMonthNumber, 1);

    const selectedRange = buildReportRange(req.query.range ? req.query : { ...req.query, range: "this_month" });

    const [thisWeek, lastWeek, thisMonth, lastMonth, selectedSummary, weeklyTrend, monthlyTrend, campaignRows, technicianRows, problemJobs] = await Promise.all([
      managementPeriodSummary(thisWeekStart, addDays(today, 1)),
      managementPeriodSummary(lastWeekStart, thisWeekStart),
      managementPeriodSummary(thisMonthStart, addDays(today, 1)),
      managementPeriodSummary(lastMonthStart, thisMonthStart),
      managementPeriodSummary(selectedRange.start, selectedRange.end),
      managementTrendRows("week", 8),
      managementTrendRows("month", 6),
      managementCampaignRows(selectedRange.start, selectedRange.end),
      managementTechnicianRows(selectedRange.start, selectedRange.end),
      managementProblemJobs(selectedRange.start, selectedRange.end)
    ]);

    const selectedGross = Number(selectedSummary.gross_value || 0);
    const selectedMaterials = Number(selectedSummary.materials_cost || 0);
    const campaignBody = campaignRows.map(row => {
      const gross = Number(row.gross_value || 0);
      const materials = Number(row.materials_cost || 0);
      return `
        <tr>
          <td><strong>${escapeHtml(row.campaign || "Unknown")}</strong></td>
          <td>${Number(row.jobs_created || 0)}</td>
          <td>${Number(row.jobs_closed || 0)}</td>
          <td>${Number(row.cancelled_jobs || 0)}</td>
          <td>${Number(row.awaiting_money_jobs || 0)}</td>
          <td>${Number(row.disputed_status_jobs || 0)}</td>
          <td>${money(row.net_value || 0)}</td>
          <td>${money(gross)}</td>
          <td>${money(materials)}</td>
          <td><strong>${money(gross - materials)}</strong></td>
          <td>${money(row.average_job_value || 0)}</td>
        </tr>
      `;
    }).join("");

    const technicianBody = technicianRows.map(row => {
      const gross = Number(row.gross_value || 0);
      const materials = Number(row.materials_cost || 0);
      return `
        <tr>
          <td><strong>${escapeHtml(row.technician_name || "Unassigned")}</strong></td>
          <td>${Number(row.jobs_closed || 0)}</td>
          <td>${Number(row.cancelled_jobs || 0)}</td>
          <td>${Number(row.disputed_status_jobs || 0)}</td>
          <td>${money(row.net_value || 0)}</td>
          <td>${money(gross)}</td>
          <td>${money(materials)}</td>
          <td><strong>${money(gross - materials)}</strong></td>
          <td>${money(row.average_job_value || 0)}</td>
        </tr>
      `;
    }).join("");

    const problemBody = problemJobs.map(job => `
      <tr>
        <td><a href="/jobs/${job.id}/edit"><strong>${escapeHtml(job.job_number || `J${String(job.id).padStart(5, "0")}`)}${job.postcode ? ` · ${escapeHtml(job.postcode)}` : ""}</strong></a></td>
        <td>${escapeHtml(job.customer_name || "-")}</td>
        <td>${escapeHtml(job.technician_name || "Unassigned")}</td>
        <td>${escapeHtml(job.source_campaign || "Unknown")}</td>
        <td><span class="pill ${jobStatusClass(job.status)}">${escapeHtml(jobStatusLabel(job.status))}</span></td>
        <td>${money(job.final_value || 0)}</td>
        <td>${money(job.materials_cost || 0)}</td>
        <td>${formatDateTime(job.closed_at || job.updated_at)}</td>
      </tr>
    `).join("");

    res.send(`
      <!DOCTYPE html>
      <html>
      <head><title>Management Performance Report</title><style>${sharedStyles()}</style></head>
      <body>
        ${nav(req)}
        <h1>Management Performance Report</h1>
        <div class="subtitle">Owner-level view of job volume, revenue, VAT, materials, cancellations, disputes and campaign performance.</div>

        <div class="page-actions">
          <a class="action-button dark" href="/reports">Back to Reports</a>
          ${reportPeriodLinks(selectedRange.range).replaceAll('/reports?', '/reports/management?')}
        </div>

        <div class="panel">
          <h2>Custom management range</h2>
          <form method="GET" action="/reports/management" class="grid-3">
            <input type="hidden" name="range" value="custom">
            <div><label>From</label><input type="date" name="from" value="${escapeHtml(selectedRange.fromValue)}"></div>
            <div><label>To</label><input type="date" name="to" value="${escapeHtml(selectedRange.toValue)}"></div>
            <div style="display:flex;align-items:end;"><button type="submit">Run report</button></div>
          </form>
        </div>

        <div class="metric-grid">
          ${managementMetricCard("Jobs booked", Number(selectedSummary.jobs_created || 0), selectedRange.label)}
          ${managementMetricCard("Jobs closed", Number(selectedSummary.jobs_closed || 0), "closed within range")}
          ${managementMetricCard("Cancelled", Number(selectedSummary.jobs_cancelled || 0), "before arrival + onsite")}
          ${managementMetricCard("New disputes", Number(selectedSummary.disputes_created || 0), `${Number(selectedSummary.open_disputes || 0)} currently open`)}
          ${managementMetricCard("NET value", money(selectedSummary.net_value || 0), "before VAT")}
          ${managementMetricCard("VAT value", money(selectedSummary.vat_value || 0), "20% UK VAT")}
          ${managementMetricCard("Gross value", money(selectedGross), "inc VAT")}
          ${managementMetricCard("After materials", money(selectedGross - selectedMaterials), `${money(selectedMaterials)} materials`)}
        </div>

        <div class="grid-2">
          <div class="panel"><h2>This week vs last week</h2><table><thead><tr><th>Metric</th><th>This week</th><th>Last week</th><th>Movement</th></tr></thead><tbody>
            ${managementComparisonRow("Jobs booked", thisWeek.jobs_created, lastWeek.jobs_created)}
            ${managementComparisonRow("Jobs closed", thisWeek.jobs_closed, lastWeek.jobs_closed)}
            ${managementComparisonRow("Cancelled", thisWeek.jobs_cancelled, lastWeek.jobs_cancelled)}
            ${managementComparisonRow("New disputes", thisWeek.disputes_created, lastWeek.disputes_created)}
            ${managementComparisonRow("Gross value", thisWeek.gross_value, lastWeek.gross_value, money)}
            ${managementComparisonRow("Materials", thisWeek.materials_cost, lastWeek.materials_cost, money)}
            ${managementComparisonRow("Average job value", thisWeek.average_job_value, lastWeek.average_job_value, money)}
          </tbody></table></div>
          <div class="panel"><h2>This month vs last month</h2><table><thead><tr><th>Metric</th><th>This month</th><th>Last month</th><th>Movement</th></tr></thead><tbody>
            ${managementComparisonRow("Jobs booked", thisMonth.jobs_created, lastMonth.jobs_created)}
            ${managementComparisonRow("Jobs closed", thisMonth.jobs_closed, lastMonth.jobs_closed)}
            ${managementComparisonRow("Cancelled", thisMonth.jobs_cancelled, lastMonth.jobs_cancelled)}
            ${managementComparisonRow("New disputes", thisMonth.disputes_created, lastMonth.disputes_created)}
            ${managementComparisonRow("Gross value", thisMonth.gross_value, lastMonth.gross_value, money)}
            ${managementComparisonRow("Materials", thisMonth.materials_cost, lastMonth.materials_cost, money)}
            ${managementComparisonRow("Average job value", thisMonth.average_job_value, lastMonth.average_job_value, money)}
          </tbody></table></div>
        </div>

        ${managementTrendTable("Week-to-week performance", weeklyTrend)}
        ${managementTrendTable("Month-to-month performance", monthlyTrend)}

        <div class="panel"><h2>Campaign / source performance — ${escapeHtml(selectedRange.label)}</h2><table><thead><tr><th>Campaign</th><th>Booked</th><th>Closed</th><th>Cancelled</th><th>Awaiting money</th><th>Disputed</th><th>NET</th><th>Gross</th><th>Materials</th><th>After materials</th><th>Avg value</th></tr></thead><tbody>${campaignBody || `<tr><td colspan="11" class="muted">No campaign data for this period yet.</td></tr>`}</tbody></table></div>
        <div class="panel"><h2>Technician performance — ${escapeHtml(selectedRange.label)}</h2><table><thead><tr><th>Technician</th><th>Closed</th><th>Cancelled</th><th>Disputed</th><th>NET</th><th>Gross</th><th>Materials</th><th>After materials</th><th>Avg value</th></tr></thead><tbody>${technicianBody || `<tr><td colspan="9" class="muted">No technician data for this period yet.</td></tr>`}</tbody></table></div>
        <div class="panel"><h2>Problem jobs — ${escapeHtml(selectedRange.label)}</h2><div class="subtitle">Cancelled, awaiting payment/balance, disputed, or linked to an open dispute case.</div><table><thead><tr><th>Job</th><th>Customer</th><th>Technician</th><th>Campaign</th><th>Status</th><th>Gross</th><th>Materials</th><th>Last update</th></tr></thead><tbody>${problemBody || `<tr><td colspan="8" class="muted">No problem jobs for this period.</td></tr>`}</tbody></table></div>
      </body>
      </html>
    `);
  } catch (error) {
    console.error("Management report error:", error);
    res.status(500).send(`Management report error: ${escapeHtml(error.message)}. Check Render logs.`);
  }
});

function managementReportCard(title, value, hint, href, accent = "") {
  return `
    <a class="panel report-focus-card ${accent}" href="${href}" style="text-decoration:none;color:inherit;display:block;">
      <div class="muted" style="text-transform:uppercase;font-weight:900;letter-spacing:.08em;">${escapeHtml(title)}</div>
      <div class="big-total">${value}</div>
      <div class="subtitle">${escapeHtml(hint || "Click to view details")}</div>
    </a>
  `;
}

function reportDetailBackLink(type) {
  const labels = {
    paid_week: "Revenue this week",
    awaiting: "Awaiting payment",
    disputed: "Disputed jobs",
    chargebacks: "Chargebacks"
  };
  return labels[type] || "Report detail";
}

app.get("/reports/detail", async (req, res) => {
  try {
    const type = String(req.query.type || "paid_week");
    const nowParts = londonDateParts();
    const today = makeDate(nowParts.year, nowParts.month, nowParts.day);
    const weekStart = startOfWeekMonday(today);
    const tomorrow = addDays(today, 1);

    let title = reportDetailBackLink(type);
    let rows = [];
    let total = 0;
    let tableHead = `<tr><th>Date</th><th>Job</th><th>Postcode</th><th>Customer</th><th>Technician</th><th>Status</th><th>Amount</th><th>Notes</th></tr>`;
    let tableBody = "";

    if (type === "paid_week") {
      const result = await pool.query(`
        SELECT j.*, t.name AS technician_name
        FROM jobs j
        LEFT JOIN technicians t ON t.id = j.assigned_technician_id
        WHERE COALESCE(j.closed_at, j.updated_at, j.created_at) >= $1
          AND COALESCE(j.closed_at, j.updated_at, j.created_at) < $2
          AND (j.status = 'fully_paid' OR j.customer_paid = TRUE)
        ORDER BY COALESCE(j.closed_at, j.updated_at, j.created_at) DESC
      `, [weekStart, tomorrow]);
      rows = result.rows;
      total = rows.reduce((sum, job) => sum + Number(job.final_value || 0), 0);
      tableBody = rows.map(job => `
        <tr>
          <td>${formatDateTime(job.closed_at || job.updated_at || job.created_at)}</td>
          <td><a href="/jobs/${job.id}/edit"><strong>${escapeHtml(job.job_number || jobNumber(job.id))}</strong></a></td>
          <td><strong>${escapeHtml(job.postcode || "-")}</strong></td>
          <td>${escapeHtml(job.customer_name || "-")}</td>
          <td>${escapeHtml(job.technician_name || "Unassigned")}</td>
          <td><span class="pill ${jobStatusClass(job.status)}">${escapeHtml(jobStatusLabel(job.status))}</span></td>
          <td><strong>${money(job.final_value || 0)}</strong></td>
          <td>Fully paid revenue this week</td>
        </tr>
      `).join("");
    } else if (type === "awaiting") {
      const result = await pool.query(`
        SELECT j.*, t.name AS technician_name,
               pc.last_chase_date, pc.next_follow_up_date, pc.last_outcome
        FROM jobs j
        LEFT JOIN technicians t ON t.id = j.assigned_technician_id
        LEFT JOIN LATERAL (
          SELECT chase_date AS last_chase_date, next_follow_up_date, outcome AS last_outcome
          FROM payment_chases
          WHERE job_id = j.id
          ORDER BY chase_date DESC NULLS LAST, created_at DESC
          LIMIT 1
        ) pc ON TRUE
        WHERE j.status IN ('awaiting_payment', 'awaiting_balance', 'sent_to_pm')
           OR (COALESCE(j.final_value, 0) > 0 AND COALESCE(j.customer_paid, FALSE) = FALSE AND j.closed_at IS NOT NULL)
        ORDER BY COALESCE(pc.next_follow_up_date, j.closed_at, j.updated_at, j.created_at) ASC NULLS LAST
      `);
      rows = result.rows;
      total = rows.reduce((sum, job) => sum + Number(job.final_value || 0), 0);
      tableBody = rows.map(job => `
        <tr>
          <td>${formatDateTime(job.closed_at || job.updated_at || job.created_at)}</td>
          <td><a href="/jobs/${job.id}/edit"><strong>${escapeHtml(job.job_number || jobNumber(job.id))}</strong></a></td>
          <td><strong>${escapeHtml(job.postcode || "-")}</strong></td>
          <td>${escapeHtml(job.customer_name || "-")}</td>
          <td>${escapeHtml(job.technician_name || "Unassigned")}</td>
          <td><span class="pill ${jobStatusClass(job.status)}">${escapeHtml(jobStatusLabel(job.status))}</span></td>
          <td><strong>${money(job.final_value || 0)}</strong></td>
          <td>
            ${job.last_chase_date ? `Last chased: ${escapeHtml(chaseDateInputValue(job.last_chase_date))}<br>` : `No chase logged<br>`}
            ${job.last_outcome ? `Outcome: ${escapeHtml(job.last_outcome)}<br>` : ""}
            ${job.next_follow_up_date ? `Next follow-up: ${escapeHtml(chaseDateInputValue(job.next_follow_up_date))}` : ""}
          </td>
        </tr>
      `).join("");
    } else if (type === "disputed") {
      const result = await pool.query(`
        SELECT j.*, t.name AS technician_name,
               d.id AS dispute_id, d.status AS dispute_status, d.disputed_amount, d.complaint_type, d.created_at AS dispute_created_at
        FROM jobs j
        LEFT JOIN technicians t ON t.id = j.assigned_technician_id
        LEFT JOIN disputes d ON d.job_id = j.id AND d.status NOT IN ('resolved', 'rejected', 'refund_processed')
        WHERE j.status = 'disputed' OR d.id IS NOT NULL
        ORDER BY COALESCE(d.created_at, j.closed_at, j.updated_at, j.created_at) DESC
      `);
      rows = result.rows;
      total = rows.reduce((sum, job) => sum + Number(job.disputed_amount || job.final_value || 0), 0);
      tableBody = rows.map(job => `
        <tr>
          <td>${formatDateTime(job.dispute_created_at || job.closed_at || job.updated_at || job.created_at)}</td>
          <td><a href="/jobs/${job.id}/edit"><strong>${escapeHtml(job.job_number || jobNumber(job.id))}</strong></a>${job.dispute_id ? `<br><a class="muted" href="/disputes/${job.dispute_id}">Dispute case</a>` : ""}</td>
          <td><strong>${escapeHtml(job.postcode || "-")}</strong></td>
          <td>${escapeHtml(job.customer_name || "-")}</td>
          <td>${escapeHtml(job.technician_name || "Unassigned")}</td>
          <td><span class="pill ${jobStatusClass(job.status)}">${escapeHtml(jobStatusLabel(job.status))}</span></td>
          <td><strong>${money(job.disputed_amount || job.final_value || 0)}</strong></td>
          <td>${escapeHtml(job.complaint_type || "Marked as disputed")}${job.dispute_status ? `<br>${escapeHtml(disputeStatusLabel(job.dispute_status))}` : ""}</td>
        </tr>
      `).join("");
    } else if (type === "chargebacks") {
      const result = await pool.query(`
        SELECT d.*, j.job_number, j.postcode, j.customer_name, j.final_value, j.status AS job_status, t.name AS technician_name
        FROM disputes d
        LEFT JOIN jobs j ON j.id = d.job_id
        LEFT JOIN technicians t ON t.id = j.assigned_technician_id
        WHERE d.chargeback = TRUE
          AND d.status NOT IN ('resolved', 'rejected')
        ORDER BY d.created_at DESC
      `);
      rows = result.rows;
      total = rows.reduce((sum, row) => sum + Number(row.disputed_amount || row.refund_amount || row.final_value || 0), 0);
      tableBody = rows.map(row => `
        <tr>
          <td>${formatDateTime(row.created_at)}</td>
          <td>${row.job_id ? `<a href="/jobs/${row.job_id}/edit"><strong>${escapeHtml(row.job_number || jobNumber(row.job_id))}</strong></a><br><a class="muted" href="/disputes/${row.id}">Dispute case</a>` : "-"}</td>
          <td><strong>${escapeHtml(row.postcode || "-")}</strong></td>
          <td>${escapeHtml(row.customer_name || "-")}</td>
          <td>${escapeHtml(row.technician_name || "Unassigned")}</td>
          <td>${escapeHtml(disputeStatusLabel(row.status))}</td>
          <td><strong>${money(row.disputed_amount || row.refund_amount || row.final_value || 0)}</strong></td>
          <td>${escapeHtml(row.complaint_type || "Chargeback")}</td>
        </tr>
      `).join("");
    }

    res.send(`
      <!DOCTYPE html>
      <html>
      <head><title>${escapeHtml(title)}</title><style>${sharedStyles()}</style></head>
      <body>
        ${nav(req)}
        <h1>${escapeHtml(title)}</h1>
        <div class="subtitle">Detailed data behind the Reports metric, including dates and technician names.</div>
        <div class="page-actions"><a class="action-button dark" href="/reports">Back to Reports</a></div>
        <div class="metric-grid">
          ${miniMetric("Total value", money(total), `${rows.length} record${rows.length === 1 ? "" : "s"}`)}
        </div>
        <div class="panel">
          <h2>${escapeHtml(title)} details</h2>
          <table>
            <thead>${tableHead}</thead>
            <tbody>${tableBody || `<tr><td colspan="8" class="muted">No records found.</td></tr>`}</tbody>
          </table>
        </div>
      </body>
      </html>
    `);
  } catch (error) {
    console.error("Report detail error:", error);
    res.status(500).send(`Report detail error: ${escapeHtml(error.message)}. Check Render logs.`);
  }
});

app.get("/reports", async (req, res) => {
  try {
    const nowParts = londonDateParts();
    const today = makeDate(nowParts.year, nowParts.month, nowParts.day);
    const weekStart = startOfWeekMonday(today);
    const tomorrow = addDays(today, 1);

    const [paidWeek, awaiting, disputed, chargebacks] = await Promise.all([
      pool.query(`
        SELECT COUNT(*)::int AS count, COALESCE(SUM(COALESCE(final_value, 0)), 0)::numeric AS value
        FROM jobs
        WHERE COALESCE(closed_at, updated_at, created_at) >= $1
          AND COALESCE(closed_at, updated_at, created_at) < $2
          AND (status = 'fully_paid' OR customer_paid = TRUE)
      `, [weekStart, tomorrow]),
      pool.query(`
        SELECT COUNT(*)::int AS count, COALESCE(SUM(COALESCE(final_value, 0)), 0)::numeric AS value
        FROM jobs
        WHERE status IN ('awaiting_payment', 'awaiting_balance', 'sent_to_pm')
           OR (COALESCE(final_value, 0) > 0 AND COALESCE(customer_paid, FALSE) = FALSE AND closed_at IS NOT NULL)
      `),
      pool.query(`
        SELECT COUNT(DISTINCT COALESCE(j.id, d.job_id))::int AS count,
               COALESCE(SUM(COALESCE(d.disputed_amount, j.final_value, 0)), 0)::numeric AS value
        FROM jobs j
        FULL OUTER JOIN disputes d ON d.job_id = j.id AND d.status NOT IN ('resolved', 'rejected', 'refund_processed')
        WHERE j.status = 'disputed' OR d.id IS NOT NULL
      `),
      pool.query(`
        SELECT COUNT(*)::int AS count,
               COALESCE(SUM(COALESCE(disputed_amount, refund_amount, j.final_value, 0)), 0)::numeric AS value
        FROM disputes d
        LEFT JOIN jobs j ON j.id = d.job_id
        WHERE d.chargeback = TRUE
          AND d.status NOT IN ('resolved', 'rejected')
      `)
    ]);

    const paidRow = paidWeek.rows[0] || {};
    const awaitingRow = awaiting.rows[0] || {};
    const disputedRow = disputed.rows[0] || {};
    const chargebackRow = chargebacks.rows[0] || {};

    res.send(`
      <!DOCTYPE html>
      <html>
      <head><title>Reports</title><style>${sharedStyles()}</style></head>
      <body>
        ${nav(req)}
        <h1>Reports</h1>
        <div class="subtitle">Clean management overview. Click any metric to see the underlying jobs, dates and technician names.</div>

        <div class="page-actions">
          <a class="action-button" href="/management-dashboard">Management Dashboard</a>
          <a class="action-button" href="/reports/management?range=this_month">Management Report</a>
          <a class="action-button amber" href="/reports/jobs.csv?range=this_week">Download jobs CSV</a>
          <a class="action-button dark" href="/reports/invoices.csv">Invoices CSV</a>
          <a class="action-button dark" href="/reports/calls.csv">Calls CSV</a>
        </div>

        <div class="metric-grid">
          ${managementReportCard("Revenue this week", money(paidRow.value || 0), `Fully paid · ${Number(paidRow.count || 0)} job${Number(paidRow.count || 0) === 1 ? "" : "s"}`, "/reports/detail?type=paid_week", "")}
          ${managementReportCard("Awaiting payment", money(awaitingRow.value || 0), `${Number(awaitingRow.count || 0)} job${Number(awaitingRow.count || 0) === 1 ? "" : "s"} needs money chasing`, "/reports/detail?type=awaiting", "")}
          ${managementReportCard("Disputed", money(disputedRow.value || 0), `${Number(disputedRow.count || 0)} disputed record${Number(disputedRow.count || 0) === 1 ? "" : "s"}`, "/reports/detail?type=disputed", "")}
          ${managementReportCard("Chargebacks", money(chargebackRow.value || 0), `${Number(chargebackRow.count || 0)} chargeback record${Number(chargebackRow.count || 0) === 1 ? "" : "s"}`, "/reports/detail?type=chargebacks", "")}
        </div>

        <div class="panel">
          <h2>What each number means</h2>
          <table>
            <thead><tr><th>Metric</th><th>Meaning</th><th>Action</th></tr></thead>
            <tbody>
              <tr><td><strong>Revenue this week</strong></td><td>Fully paid jobs closed or updated this week.</td><td>Click to view paid jobs by date and technician.</td></tr>
              <tr><td><strong>Awaiting payment</strong></td><td>Jobs marked awaiting payment, awaiting balance, sent to PM, or closed but not paid.</td><td>Click to chase payment and view follow-up notes.</td></tr>
              <tr><td><strong>Disputed</strong></td><td>Jobs marked disputed or linked to an open dispute case.</td><td>Click to review dispute value, job and technician.</td></tr>
              <tr><td><strong>Chargebacks</strong></td><td>Open dispute records where chargeback has been raised.</td><td>Click to view chargeback cases.</td></tr>
            </tbody>
          </table>
        </div>
      </body>
      </html>
    `);
  } catch (error) {
    console.error("Reports overview error:", error);
    res.status(500).send(`Reports overview error: ${escapeHtml(error.message)}. Check Render logs.`);
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



function dateInputValue(value) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = number => String(number).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function targetDateForAssignment(eta, scheduledAt) {
  if (eta === "Scheduled" && scheduledAt) return dateInputValue(scheduledAt);
  return dateInputValue(new Date());
}

function technicianCanBeAssignedOn(tech, targetDateValue) {
  if (!tech) return false;
  const status = String(tech.status || "").toLowerCase();
  if (status.includes("do not use")) return false;
  if (status.includes("available") || status.includes("soon") || status.includes("job")) return true;

  const target = dateInputValue(targetDateValue || new Date());
  const returnDate = dateInputValue(tech.return_to_work_date);
  if (!returnDate) return false;
  return returnDate <= target;
}

function technicianUnavailableReason(tech, targetDateValue) {
  if (!tech) return "Technician not found.";
  const status = tech.status || "Unavailable";
  const target = dateInputValue(targetDateValue || new Date());
  const returnDate = dateInputValue(tech.return_to_work_date);
  if (String(status).toLowerCase().includes("do not use")) return `${tech.name} is marked Do not use.`;
  if (!returnDate) return `${tech.name} is ${status} and has no return-to-work date set.`;
  return `${tech.name} is ${status} until ${returnDate}. This job is for ${target}.`;
}

async function assertTechnicianAssignableForJob(technicianId, targetDateValue) {
  if (!technicianId) return;
  const result = await pool.query(`SELECT id, name, status, return_to_work_date, active FROM technicians WHERE id = $1`, [technicianId]);
  const tech = result.rows[0];
  if (!tech || tech.active === false) throw new Error("Selected technician is not active.");
  if (!technicianCanBeAssignedOn(tech, targetDateValue)) {
    throw new Error(technicianUnavailableReason(tech, targetDateValue));
  }
}

function technicianOptions(technicians, selectedId = "", targetDateValue = null) {
  return technicians.map(tech => {
    const selected = String(tech.id) === String(selectedId || "") ? "selected" : "";
    const assignableForTarget = targetDateValue ? technicianCanBeAssignedOn(tech, targetDateValue) : true;
    const disabled = !assignableForTarget && !selected ? "disabled" : "";
    const returnDate = dateInputValue(tech.return_to_work_date);
    const labelBits = [tech.name];
    if (tech.status) labelBits.push(tech.status);
    if (returnDate) labelBits.push(`returns ${returnDate}`);
    return `<option value="${tech.id}" data-status="${escapeHtml(tech.status || '')}" data-return-date="${escapeHtml(returnDate)}" ${selected} ${disabled}>${escapeHtml(labelBits.join(" — "))}</option>`;
  }).join("");
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

function getOriginalRawJob(job) {
  if (!job || !job.original_raw_json) return {};
  if (typeof job.original_raw_json === "object") return job.original_raw_json || {};
  try {
    return JSON.parse(job.original_raw_json);
  } catch (error) {
    return {};
  }
}

function originalRawValue(job, key) {
  const raw = getOriginalRawJob(job);
  return raw && raw[key] !== undefined && raw[key] !== null ? String(raw[key]) : "";
}

function importedHistoryCard(job) {
  if (!job || !job.is_imported) return "";

  const oldOrderId = job.old_order_id || String(job.job_number || "").replace(/^OLD-/i, "");
  const rawCreated = originalRawValue(job, "created_at_old_portal");
  const rawCompleted = originalRawValue(job, "completed_at_old_portal");
  const createdDisplay = job.created_at ? formatDateTime(job.created_at) : (rawCreated || "—");
  const closedDisplay = job.closed_at ? formatDateTime(job.closed_at) : (rawCompleted || "—");

  return `
    <div class="control-card imported-history-card">
      <h2>Imported old portal history</h2>
      <div class="job-info-grid">
        <div class="info-block"><strong>Old order ID</strong><span>${escapeHtml(job.job_number || (oldOrderId ? `OLD-${oldOrderId}` : "—"))}</span></div>
        <div class="info-block"><strong>Imported from</strong><span>${escapeHtml(job.imported_from || "Keys Portal")}</span></div>
        <div class="info-block"><strong>Original appointment / order made</strong><span>${escapeHtml(createdDisplay)}</span>${rawCreated ? `<div class="muted-note">Old portal text: ${escapeHtml(rawCreated)}</div>` : ""}</div>
        <div class="info-block"><strong>Original completed / closed</strong><span>${escapeHtml(closedDisplay)}</span>${rawCompleted ? `<div class="muted-note">Old portal text: ${escapeHtml(rawCompleted)}</div>` : ""}</div>
        <div class="info-block"><strong>Original status</strong><span>${escapeHtml(job.original_status || job.status || "—")}</span></div>
        <div class="info-block"><strong>Original technician</strong><span>${escapeHtml(job.original_technician_name || job.tech_notes || "—")}</span></div>
        <div class="info-block wide"><strong>Warranty / complaint check</strong><span>Use the original completed / closed date above when checking warranty timeframes.</span></div>
      </div>
    </div>
  `;
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
  const payerPhone = compactPhone(job.offsite_payment ? job.bill_payer_phone : job.customer_phone);
  const lines = [];

  function add(label, value) {
    if (hasFilledValue(value)) lines.push(`${label}: ${value}`);
  }

  function addMoney(label, value) {
    if (value !== null && value !== undefined && String(value).trim() !== "") {
      lines.push(`${label}: ${money(value)}`);
    }
  }

  add("Name", job.customer_name || "");
  add("Address", jobAddressPlain(job));

  const jobLine = [job.job_type || "Job", job.job_description || ""].filter(hasFilledValue).join(" - ");
  add("Job", jobLine);
  if (job.job_type === "LOCK CHANGE") add("Keys", job.lock_change_keys || "Not asked");

  addMoney("Start price", job.starting_price !== null && job.starting_price !== undefined ? job.starting_price : job.quoted_price);
  addMoney("Call out agreed", job.call_out_agreed);
  addMoney("Start price of parts", job.start_price_locks);

  const payerLine = [payerName, payerPhone].filter(hasFilledValue).join(" ");
  if (job.offsite_payment && hasFilledValue(payerLine)) {
    lines.push(`Bill payer - ${payerLine}`);
  }

  add("ETA", job.eta || "");
  if (job.eta === "Scheduled" && job.scheduled_at) add("Scheduled for", formatDateTime(job.scheduled_at));
  add("Telephone number", compactPhone(job.customer_phone));

  return lines.join("\n");
}
app.get("/jobs", async (req, res) => {
  try {
    const selectedStatus = (req.query.status || "active").trim();
    const selectedTechnician = (req.query.technician || "all").trim();
    const selectedCampaign = (req.query.campaign || "all").trim();
    const selectedDate = (req.query.date || "all").trim();
    const customDateFrom = (req.query.date_from || "").trim();
    const customDateTo = (req.query.date_to || "").trim();
    const search = (req.query.search || "").trim();

    const where = [];
    const params = [];

    if (selectedStatus === "cancelled") {
      where.push(`j.status IN ('cancelled_before_arrival', 'cancelled_onsite')`);
    } else if (selectedStatus === "closed_today") {
      where.push(`j.closed_at IS NOT NULL AND DATE(j.closed_at) = CURRENT_DATE`);
    } else if (selectedStatus && selectedStatus !== "all" && selectedStatus !== "active") {
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
    } else if (selectedDate === "custom") {
      const validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));
      if (validDate(customDateFrom) && validDate(customDateTo)) {
        params.push(customDateFrom, customDateTo);
        where.push(`(
          DATE(j.created_at) BETWEEN $${params.length - 1}::date AND $${params.length}::date
          OR DATE(j.scheduled_at) BETWEEN $${params.length - 1}::date AND $${params.length}::date
          OR DATE(j.closed_at) BETWEEN $${params.length - 1}::date AND $${params.length}::date
        )`);
      } else if (validDate(customDateFrom)) {
        params.push(customDateFrom);
        where.push(`(DATE(j.created_at) >= $${params.length}::date OR DATE(j.scheduled_at) >= $${params.length}::date OR DATE(j.closed_at) >= $${params.length}::date)`);
      } else if (validDate(customDateTo)) {
        params.push(customDateTo);
        where.push(`(DATE(j.created_at) <= $${params.length}::date OR DATE(j.scheduled_at) <= $${params.length}::date OR DATE(j.closed_at) <= $${params.length}::date)`);
      }
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

    const [jobsResult, countsResult, closedTodayResult, techniciansResult, campaignsResult, revenueResult, recentResult, disputesMetricResult, paymentChaseMetricResult] = await Promise.all([
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
            WHEN 'fully_paid' THEN 5
            WHEN 'sent_to_pm' THEN 5
            WHEN 'awaiting_balance' THEN 5
            WHEN 'disputed' THEN 5
            ELSE 9
          END,
          j.created_at DESC
        LIMIT 300
      `, params),
      pool.query(`SELECT status, COUNT(*)::int AS count FROM jobs GROUP BY status`),
      pool.query(`SELECT COUNT(*)::int AS count FROM jobs WHERE closed_at IS NOT NULL AND DATE(closed_at) = CURRENT_DATE`),
      pool.query(`SELECT id, name, status, priority, location_checked_in_at FROM technicians WHERE active = TRUE ORDER BY name ASC`),
      pool.query(`SELECT DISTINCT COALESCE(source_campaign, '') AS campaign FROM jobs WHERE COALESCE(source_campaign, '') <> '' ORDER BY campaign ASC LIMIT 80`),
      pool.query(`
        SELECT
          COALESCE(SUM(final_value), 0) AS income,
          COALESCE(SUM(materials_cost), 0) AS materials,
          COALESCE(SUM(final_value) FILTER (WHERE status = 'awaiting_payment'), 0) AS awaiting_payment,
          COUNT(*) FILTER (WHERE DATE(created_at) = CURRENT_DATE)::int AS created_today,
          COUNT(*) FILTER (WHERE closed_at IS NOT NULL AND DATE(closed_at) = CURRENT_DATE)::int AS closed_today
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
      `),
      pool.query(`
        SELECT COUNT(*)::int AS count
        FROM disputes
        WHERE COALESCE(status, 'open_dispute') NOT IN ('resolved', 'rejected', 'refund_processed')
      `),
      pool.query(`
        SELECT COUNT(*)::int AS count
        FROM jobs
        WHERE status IN ('awaiting_payment', 'awaiting_balance', 'sent_to_pm', 'disputed')
           OR (closed_at IS NOT NULL AND COALESCE(customer_paid, FALSE) = FALSE AND COALESCE(final_value, 0) > 0 AND COALESCE(status, '') <> 'fully_paid')
      `)
    ]);

    const counts = Object.fromEntries(countsResult.rows.map(row => [row.status || "open", row.count]));
    const activeCount = activeJobStatuses.reduce((sum, status) => sum + Number(counts[status] || 0), 0);
    const closedToday = Number(closedTodayResult.rows[0]?.count || 0);
    const revenue = revenueResult.rows[0] || {};

    const statusFilterOptions = [
      { value: "active", label: `Active / scheduled jobs (${activeCount})` },
      { value: "all", label: "All orders" },
      { value: "closed_today", label: `Closed today (${closedToday})` },
      { value: "cancelled", label: `Total cancelled (${Number(counts.cancelled_before_arrival || 0) + Number(counts.cancelled_onsite || 0)})` },
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
      { value: "month", label: "This month" },
      { value: "custom", label: "Custom date range" }
    ];

    const cancelledTotal = Number(counts.cancelled_before_arrival || 0) + Number(counts.cancelled_onsite || 0);
    const openDisputesTotal = Number(disputesMetricResult.rows[0]?.count || 0);
    const paymentChaseTotal = Number(paymentChaseMetricResult.rows[0]?.count || 0);

    const statusCards = [
      { label: "Job awaiting to be assigned", value: Number(counts.open || 0), className: "board-blue", hrefStatus: "open" },
      { label: "Assigned", value: Number(counts.assigned || 0), className: "board-green", hrefStatus: "assigned" },
      { label: "Awaiting payment", value: Number(counts.awaiting_payment || 0), className: "board-amber", hrefStatus: "awaiting_payment" },
      { label: "Invoice sent to Acc Dept", value: Number(counts.invoiced_account || 0), className: "board-pink", hrefStatus: "invoiced_account" },
      { label: "Closed today", value: closedToday, className: "board-red", hrefStatus: "closed_today" },
      { label: "Total cancelled", value: cancelledTotal, className: "board-slate", hrefStatus: "cancelled" },
      { label: "Disputes", value: openDisputesTotal, className: "board-orange", href: "/disputes" },
      { label: "Payment chase", value: paymentChaseTotal, className: "board-purple", href: "/payment-chasing" }
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
          <td>
            <a class="view-button" href="/jobs/${job.id}/edit">View</a>
          </td>
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

    const cardHtml = statusCards.map(card => {
      const href = card.href || `/jobs?status=${encodeURIComponent(card.hrefStatus)}`;
      return `
        <a class="board-card ${card.className}" href="${escapeHtml(href)}">
          <div class="board-card-label">${escapeHtml(card.label)}</div>
          <div class="board-card-number">${card.value}</div>
        </a>
      `;
    }).join("");

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
            grid-template-columns: repeat(8, minmax(135px, 1fr));
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
          .board-slate:before, .board-slate:after { background: #475569; }
          .board-orange:before, .board-orange:after { background: #f97316; }
          .board-purple:before, .board-purple:after { background: #7c3aed; }
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
          .board-filters { display: grid; grid-template-columns: minmax(260px, 1.6fr) minmax(150px, .9fr) minmax(150px, .9fr) minmax(150px, .9fr) minmax(150px, .9fr) auto; gap: 14px; align-items: center; }
          .custom-date-range { display: none; grid-column: 1 / -1; grid-template-columns: repeat(2, minmax(180px, 240px)); gap: 14px; align-items: end; padding-top: 4px; }
          .custom-date-range.is-visible { display: grid; }
          .custom-date-range label { display: block; font-size: 12px; color: #667085; font-weight: 900; text-transform: uppercase; margin-bottom: 5px; }
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
          .job-row-actions { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
          .job-row-actions form { margin: 0; }
          .delete-job-button { border: 0; background: var(--brand-red); color: white; border-radius: 10px; padding: 7px 12px; font-weight: 900; font-size: 12px; cursor: pointer; }
          .delete-job-button:hover { filter: brightness(.95); }
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
          .feed-dot.job-scheduled { background: #7c3aed; }
          .feed-dot.job-awaiting-payment, .feed-dot.job-awaiting-balance { background: #f59e0b; }
          .feed-dot.job-invoiced-account, .feed-dot.job-sent-to-pm { background: #db2777; }
          .feed-dot.job-closed, .feed-dot.job-fully-paid { background: #dc2626; }
          .feed-dot.job-disputed { background: #f97316; }
          .feed-dot.job-cancelled-before-arrival { background: #6b7280; }
          .feed-dot.job-cancelled-onsite { background: #4b5563; }
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
              <select name="date" id="board_date_filter">${optionList(dateOptions, selectedDate || "all")}</select>
              <button type="submit">Apply</button>
              <div id="custom_date_range" class="custom-date-range${selectedDate === "custom" ? " is-visible" : ""}">
                <div>
                  <label>From date</label>
                  <input type="date" name="date_from" value="${escapeHtml(customDateFrom)}">
                </div>
                <div>
                  <label>To date</label>
                  <input type="date" name="date_to" value="${escapeHtml(customDateTo)}">
                </div>
              </div>
            </form>
            <script>
              const boardDateFilter = document.getElementById("board_date_filter");
              const customDateRange = document.getElementById("custom_date_range");
              function toggleBoardCustomDates() {
                if (!boardDateFilter || !customDateRange) return;
                customDateRange.classList.toggle("is-visible", boardDateFilter.value === "custom");
              }
              if (boardDateFilter) {
                boardDateFilter.addEventListener("change", toggleBoardCustomDates);
                toggleBoardCustomDates();
              }
            </script>
          </section>

          <section class="board-content-grid">
            <div class="orders-panel">
              <div class="panel-heading">
                <div>
                  <h2>Live client orders</h2>
                  <div class="muted">Showing ${jobsResult.rows.length} active/scheduled order${jobsResult.rows.length === 1 ? "" : "s"}. Use search or filters to find awaiting payment, closed, disputed or cancelled jobs.</div>
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

app.post("/jobs/:id/delete", async (req, res) => {
  const jobId = Number(req.params.id);
  if (!Number.isFinite(jobId)) return res.redirect("/jobs");

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const jobResult = await client.query(`SELECT * FROM jobs WHERE id = $1`, [jobId]);
    const job = jobResult.rows[0];
    if (!job) {
      await client.query("ROLLBACK");
      return res.redirect("/jobs");
    }

    await client.query(`
      INSERT INTO deleted_jobs_log (job_id, job_number, postcode, customer_name, deleted_by, deleted_at, job_snapshot)
      VALUES ($1, $2, $3, $4, $5, NOW(), $6::jsonb)
    `, [
      job.id,
      job.job_number || jobNumber(job.id),
      job.postcode || "",
      job.customer_name || "",
      currentAgentName(req) || "Unknown",
      JSON.stringify(job)
    ]);

    await client.query(`DELETE FROM job_sms_log WHERE job_id = $1`, [jobId]);
    await client.query(`DELETE FROM job_evidence_links WHERE job_id = $1`, [jobId]);
    await client.query(`DELETE FROM job_payment_chases WHERE job_id = $1`, [jobId]);
    await client.query(`DELETE FROM job_audit_log WHERE job_id = $1`, [jobId]);
    await client.query(`DELETE FROM disputes WHERE job_id = $1`, [jobId]);
    await client.query(`UPDATE quotations SET converted_job_id = NULL WHERE converted_job_id = $1`, [jobId]);
    await client.query(`UPDATE quotations SET source_job_id = NULL WHERE source_job_id = $1`, [jobId]);
    await client.query(`DELETE FROM jobs WHERE id = $1`, [jobId]);

    await client.query("COMMIT");
    res.redirect("/jobs?deleted=1");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Delete job error:", error);
    res.status(500).send(`Delete job error: ${escapeHtml(error.message || String(error))}. Check Render logs.`);
  } finally {
    client.release();
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

    const technicians = (await pool.query(`SELECT id, name, status, return_to_work_date FROM technicians WHERE active = TRUE ORDER BY name ASC`)).rows;
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
          .appointment-time-picker {
            width: 100%;
            max-width: 360px;
            border: 1px solid #d7dee8;
            border-radius: 18px;
            background: #ffffff;
            box-shadow: 0 16px 34px rgba(15, 23, 42, 0.12);
            overflow: hidden;
          }
          .appointment-time-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 12px 14px;
            border-bottom: 1px solid #eef2f7;
            color: #334155;
            font-size: 12px;
            font-weight: 900;
            text-transform: uppercase;
            letter-spacing: .06em;
          }
          .appointment-time-header strong {
            min-width: 72px;
            padding: 7px 10px;
            border-radius: 999px;
            background: #e5e7eb;
            color: #111827;
            text-align: center;
            font-size: 14px;
            letter-spacing: 0;
          }
          .appointment-time-body { padding: 12px 14px; }
          .hour-chip-grid {
            display: grid;
            grid-template-columns: repeat(6, 1fr);
            gap: 6px;
            margin-bottom: 10px;
          }
          .time-hour-chip,
          .minute-pill {
            min-height: 34px;
            border: 1px solid #d7dee8;
            border-radius: 999px;
            background: #ffffff;
            color: #111827;
            font-weight: 900;
            cursor: pointer;
          }
          .minute-buttons {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 8px;
          }
          .time-hour-chip.active,
          .minute-pill.active {
            background: #1e88ff;
            color: #ffffff;
            border-color: #1e88ff;
            box-shadow: 0 6px 14px rgba(30, 136, 255, 0.28);
          }
          .appointment-time-actions {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 10px 14px 14px;
          }
          .time-reset {
            border: 0;
            background: #f1f5f9;
            color: #334155;
            border-radius: 999px;
            padding: 9px 13px;
            font-weight: 900;
            cursor: pointer;
          }
          .time-confirm {
            width: 42px;
            height: 42px;
            border: 0;
            border-radius: 999px;
            background: #1e88ff;
            color: #ffffff;
            font-size: 20px;
            font-weight: 900;
            cursor: pointer;
          }
          @media (max-width: 520px) {
            .appointment-time-picker { max-width: none; }
            .hour-chip-grid { grid-template-columns: repeat(4, 1fr); }
          }
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
                    <select id="create_job_type" name="job_type">${optionList(categoryOptions, "LOCKED OUT")}</select>
                  </div>
                  <div class="field">
                    <label>Campaign</label>
                    <select name="source_campaign">${optionList(campaignOptions, "Unknown")}</select>
                  </div>
                </div>

                <div class="wide-field" id="lock_change_keys_box" style="display:none; background:#0f8f2f; color:#ffffff; padding:14px; border-radius:14px; border:2px solid #087425; box-shadow:0 10px 24px rgba(15,143,47,0.18);">
                  <label style="color:#ffffff; font-weight:900; letter-spacing:.04em;">Lock change prompt</label>
                  <div class="helper-line" style="margin-bottom:10px; font-weight:900; color:#ffffff; font-size:15px;">Ask the customer: Do you have the keys?</div>
                  <select id="lock_change_keys" name="lock_change_keys" style="background:#ffffff; color:#111827; border:0; font-weight:800;">
                    <option value="">Not asked / not applicable</option>
                    <option value="Yes - customer has keys">Yes - customer has keys</option>
                    <option value="No - gain access and change lock">No - gain access and change lock</option>
                    <option value="Unknown - confirm with customer">Unknown - confirm with customer</option>
                  </select>
                  <div class="helper-line" style="color:#ffffff; opacity:.95; margin-top:8px;">This appears when the category is LOCK CHANGE so the technician knows if access is also required.</div>
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
                    <select name="assigned_technician_id"><option value="">-</option>${technicianOptions(technicians)}</select><div class="helper-line">Unavailable technicians can only be assigned if their return-to-work date is on or before the job date.</div>
                  </div>
                  <div class="field">
                    <label>Status</label>
                    <select id="job_status" name="status">${jobStatusOptions("open")}</select>
                  </div>
                  <div class="field">
                    <label>ETA</label>
                    <select id="eta_select" name="eta">${etaSelectOptions("")}</select>
                    <input id="eta_other" name="eta_other" placeholder="Other ETA" style="display:none; margin-top:8px;">
                    <div id="scheduled_box" style="display:none; margin-top:10px;">
                      <label>Scheduled date and time</label>
                      <div class="form-grid-2" style="margin-top:6px; align-items:start;">
                        <div><label>Date</label><input type="date" id="scheduled_date" name="scheduled_date"></div>
                        ${compactScheduledTimePicker("scheduled", "")}
                      </div>
                      <input type="hidden" id="scheduled_at" name="scheduled_at">
                    </div>
                  </div>
                </div>

                <div class="form-grid-3" style="margin-top:16px;">
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
            setValue("postcode", String(address.postcode || "").toUpperCase().replace(/\s+/g, ""));
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
              setValue("postcode", String(template.customer_postcode || "").toUpperCase().replace(/\s+/g, ""));
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


          const jobTypeSelect = document.querySelector('select[name="job_type"]');
          const lockChangeKeysBox = document.getElementById("lock_change_keys_box");
          function toggleLockChangePrompt() {
            if (!jobTypeSelect || !lockChangeKeysBox) return;
            lockChangeKeysBox.style.display = jobTypeSelect.value === "LOCK CHANGE" ? "block" : "none";
          }
          if (jobTypeSelect) {
            jobTypeSelect.addEventListener("change", toggleLockChangePrompt);
            toggleLockChangePrompt();
          }

          const etaSelect = document.getElementById("eta_select");
          const etaOther = document.getElementById("eta_other");
          const scheduledBox = document.getElementById("scheduled_box");
          function toggleEtaFields() {
            if (!etaSelect) return;
            if (etaOther) etaOther.style.display = etaSelect.value === "Other" ? "block" : "none";
            if (scheduledBox) scheduledBox.style.display = etaSelect.value === "Scheduled" ? "block" : "none";
          }
          function validate24HourScheduledTime(dateId, timeId) {
            const scheduledDate = document.getElementById(dateId);
            const scheduledTime = document.getElementById(timeId);
            if (!scheduledDate || !scheduledTime || !scheduledDate.value || !scheduledTime.value) return true;
            const value = scheduledTime.value.trim();
            const ok = /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
            if (!ok) {
              alert("Please enter the scheduled time in 24 hour format, for example 09:00 or 14:30.");
              scheduledTime.focus();
              return false;
            }
            return true;
          }

          function combineScheduledDateTime() {
            const scheduledDate = document.getElementById("scheduled_date");
            const scheduledTime = document.getElementById("scheduled_time");
            const scheduledAt = document.getElementById("scheduled_at");
            if (!scheduledAt) return true;
            if (!validate24HourScheduledTime("scheduled_date", "scheduled_time")) return false;
            scheduledAt.value = scheduledDate && scheduledTime && scheduledDate.value && scheduledTime.value ? scheduledDate.value + "T" + scheduledTime.value.trim() : "";
            return true;
          }
          if (etaSelect) {
            etaSelect.addEventListener("change", toggleEtaFields);
            toggleEtaFields();
          }
          const createOrderForm = document.querySelector('form[action="/jobs/create"]');
          if (createOrderForm) createOrderForm.addEventListener("submit", event => {
            if (!combineScheduledDateTime()) event.preventDefault();
          });
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
    const createEta = normaliseEta(body);
    const createScheduledAt = createEta === "Scheduled" ? parseScheduledTimestamp(body) : null;
    const createTechId = parseOptionalInt(body.assigned_technician_id);
    await assertTechnicianAssignableForJob(createTechId, targetDateForAssignment(createEta, createScheduledAt));
    const result = await pool.query(`
      INSERT INTO jobs (
        customer_name, customer_phone, customer_alt_phone, customer_email,
        address_line_1, address_line_2, address_line_3, town, county, postcode, latitude, longitude, udprn,
        job_type, job_description, lock_change_keys, urgency, source_campaign, quoted_price, starting_price, call_out_agreed, start_price_locks, offsite_payment, bill_payer_name, bill_payer_phone, expected_payment_method,
        account_job, account_template_id, assigned_technician_id, eta, scheduled_at, dispatcher_name, dispatcher_notes, status,
        created_at, updated_at
      ) VALUES (
        $1,$2,$3,$4,
        $5,$6,$7,$8,$9,$10,$11,$12,$13,
        $14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,
        $27,$28,$29,$30,$31,$32,$33,$34,
        NOW(), NOW()
      ) RETURNING id
    `, [
      body.customer_name,
      compactPhone(body.customer_phone),
      compactPhone(body.customer_alt_phone),
      body.customer_email,
      body.address_line_1,
      body.address_line_2,
      body.address_line_3,
      body.town,
      body.county,
      compactPostcode(body.postcode),
      parseMoneyInput(body.latitude),
      parseMoneyInput(body.longitude),
      body.udprn,
      body.job_type,
      body.job_description,
      body.job_type === "LOCK CHANGE" ? (body.lock_change_keys || "Not asked / not applicable") : null,
      body.urgency || "Normal",
      body.source_campaign,
      parseMoneyInput(body.quoted_price),
      parseMoneyInput(body.starting_price),
      parseMoneyInput(body.call_out_agreed),
      parseMoneyInput(body.start_price_locks),
      body.offsite_payment === "true",
      body.bill_payer_name,
      compactPhone(body.bill_payer_phone),
      body.expected_payment_method || "Unknown",
      body.account_job === "true",
      parseOptionalInt(body.account_template_id),
      createTechId,
      createEta,
      createScheduledAt,
      currentAgentName(req),
      body.dispatcher_notes,
      body.status || "open"
    ]);

    const id = result.rows[0].id;
    await pool.query(`UPDATE jobs SET job_number = $1 WHERE id = $2`, [jobNumber(id), id]);
    await addJobAuditEntry(id, "job_created", "status", "—", "Job created", currentAgentName(req));
    res.redirect(`/jobs/${id}/summary`);
  } catch (error) {
    console.error("Create job error:", error);
    res.status(500).send(`Could not create job: ${escapeHtml(error.message)}`);
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
          function copyText(text) {
            if (!text) return;
            navigator.clipboard.writeText(text).then(() => alert("Copied to clipboard."));
          }
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
    const technicians = (await pool.query(`SELECT id, name, status, phone, checkin_token, return_to_work_date FROM technicians WHERE active = TRUE ORDER BY name ASC`)).rows;
    const templates = (await pool.query(`SELECT id, template_name FROM invoice_templates WHERE active = TRUE ORDER BY sort_order ASC, template_name ASC`)).rows;
    const campaignOptions = await getCampaignOptions(job.source_campaign || "Unknown");
    const summary = jobTechnicianSummary(job);
    const customerTel = phoneHref(job.customer_phone);
    const payerTel = phoneHref(job.offsite_payment ? job.bill_payer_phone : job.customer_phone);
    const techWorkspaceUrl = job.technician_token ? `/tech-workspace` : "";
    const auditRows = (await pool.query(`
      SELECT * FROM job_audit_log
      WHERE job_id = $1
      ORDER BY created_at DESC, id DESC
      LIMIT 80
    `, [id])).rows;
    const paymentChases = (await pool.query(`
      SELECT * FROM job_payment_chases
      WHERE job_id = $1
      ORDER BY chase_date DESC, created_at DESC, id DESC
      LIMIT 20
    `, [id])).rows;
    const evidenceRows = (await pool.query(`
      SELECT * FROM job_evidence_links
      WHERE job_id = $1
      ORDER BY added_at DESC, id DESC
      LIMIT 40
    `, [id])).rows;

    const smsRows = (await pool.query(`
      SELECT * FROM job_sms_log
      WHERE job_id = $1
      ORDER BY created_at DESC, id DESC
      LIMIT 30
    `, [id])).rows;

    const stripeRows = (await pool.query(`
      SELECT * FROM job_payment_links
      WHERE job_id = $1
      ORDER BY created_at DESC, id DESC
      LIMIT 20
    `, [id])).rows;

    const isImportedJob = Boolean(job.is_imported);
    const activityItems = [
      { label: isImportedJob ? "Old portal order made" : "Order created", value: `${formatDateTime(job.created_at)} by ${job.dispatcher_name || "Unknown"}` },
      { label: "Current status", value: jobStatusLabel(job.status) },
      { label: "Technician", value: job.technician_name || job.original_technician_name || "Unassigned" },
      { label: "Last updated", value: formatDateTime(job.updated_at) },
      { label: isImportedJob ? "Old portal completed / closed" : "Closed", value: job.closed_at ? `${formatDateTime(job.closed_at)} by ${job.closed_by || "Unknown"}` : "Not closed yet" }
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
          .danger-zone-card { border: 1px solid #fecaca; background: #fff7f7; }
          .danger-zone-card details summary { cursor: pointer; color: #991b1b; font-weight: 900; font-size: 13px; }
          .danger-zone-card p { color: #7f1d1d; font-size: 12px; line-height: 1.5; }
          .danger-zone-card .delete-job-button { margin-top: 8px; }
          .imported-history-card { border-color:#bfdbfe; background:#f8fbff; }
          .imported-history-card h2 { color:#1d4ed8; }
          .info-block.wide { grid-column: 1 / -1; }
          .pill-row { display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
          .stripe-warning { background:#fff7ed; border:1px solid #fed7aa; color:#9a3412; padding:12px; border-radius:14px; font-weight:800; font-size:13px; line-height:1.45; }
          .stripe-live { background:#fef2f2; border-color:#fecaca; color:#991b1b; }
          .stripe-ok { background:#f0fdf4; border-color:#bbf7d0; color:#166534; }
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
              <h1>${escapeHtml(job.job_number || jobNumber(job.id))}${job.postcode ? ` · ${escapeHtml(job.postcode)}` : ""} Control Panel</h1>
              <div class="subtitle">${isImportedJob ? "Old portal order made" : "Created"} ${formatDateTime(job.created_at)} by ${escapeHtml(job.dispatcher_name || "Unknown")} · ${isImportedJob ? "Old portal closed" : "Last updated"} ${isImportedJob && job.closed_at ? formatDateTime(job.closed_at) : formatDateTime(job.updated_at)}</div>
              <div class="pill-row"><span class="pill ${jobStatusClass(job.status)}">${escapeHtml(jobStatusLabel(job.status))}</span>${isImportedJob ? `<span class="pill" style="background:#dbeafe;color:#1d4ed8;">Imported history</span>` : ""}</div>
            </div>
            <div class="job-control-actions">
              <a class="action-button" href="#appointment-card">Edit appointment</a>
              <a class="action-button blue" href="/jobs/${job.id}/summary">Technician summary</a>
              <a class="action-button red" href="/jobs/${job.id}/close">Close / payment</a>
              <a class="action-button orange" href="/disputes/new?job_id=${job.id}">Raise dispute</a>
              <a class="action-button dark" href="/jobs">Back to Dispatch Board</a>
            </div>
          </div>

          <div class="summary-kpis">
            <div class="summary-kpi"><div class="kpi-label">Customer</div><div class="kpi-value">${escapeHtml(job.customer_name || "—")}</div></div>
            <div class="summary-kpi"><div class="kpi-label">Postcode</div><div class="kpi-value">${escapeHtml(job.postcode || "—")}</div></div>
            <div class="summary-kpi"><div class="kpi-label">Technician</div><div class="kpi-value">${escapeHtml(job.technician_name || "Unassigned")}</div></div>
            <div class="summary-kpi"><div class="kpi-label">ETA / scheduled</div><div class="kpi-value">${escapeHtml(job.eta === "Scheduled" && job.scheduled_at ? scheduledDisplay(job.scheduled_at) : (job.eta || "—"))}</div></div>
          </div>

          ${importedHistoryCard(job)}

          <div class="job-control-grid">
            <main>
              <div class="control-card">
                <h2>Job summary</h2>
                <div class="job-info-grid">
                  <div class="info-block"><strong>Customer phone</strong><span><a href="${escapeHtml(customerTel)}">${escapeHtml(job.customer_phone || "—")}</a></span></div>
                  <div class="info-block"><strong>Bill payer</strong><span>${escapeHtml(job.offsite_payment ? (job.bill_payer_name || "—") : (job.customer_name || "—"))}${(job.offsite_payment ? job.bill_payer_phone : job.customer_phone) ? ` · <a href="${escapeHtml(payerTel)}">${escapeHtml(job.offsite_payment ? job.bill_payer_phone : job.customer_phone)}</a>` : ""}</span></div>
                  <div class="info-block"><strong>Address</strong><div>${jobAddressBlock(job) || "—"}</div></div>
                  <div class="info-block"><strong>Job</strong><span>${escapeHtml(job.job_type || "—")} · ${escapeHtml(job.source_campaign || "No campaign")}</span><div class="muted-note">${escapeHtml(job.job_description || "No description entered.")}</div></div>
                  ${job.job_type === "LOCK CHANGE" ? `<div class="info-block" style="background:#0f8f2f; color:#ffffff; border-color:#087425;"><strong style="color:#ffffff;">Lock change prompt</strong><span style="color:#ffffff; font-weight:900;">Do you have the keys?</span><div style="color:#ffffff; opacity:.95; font-weight:800; margin-top:6px;">${escapeHtml(job.lock_change_keys || "Not asked / not applicable")}</div></div>` : ""}
                  <div class="info-block"><strong>Scheduled date/time</strong><span>${escapeHtml(job.scheduled_at ? scheduledDisplay(job.scheduled_at) : "—")}</span></div>
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
                    <div><label>Job type</label><select id="edit_job_type" name="job_type">${optionList(jobTypes, job.job_type)}</select></div>
                    <div><label>Source / campaign</label><select name="source_campaign">${optionList(campaignOptions, job.source_campaign || "Unknown")}</select></div>
                    <div id="edit_lock_change_keys_box" style="display:none; background:#0f8f2f; color:#ffffff; padding:12px; border-radius:14px; border:2px solid #087425;"><label style="color:#ffffff; font-weight:900;">Lock change prompt — Do you have the keys?</label><select name="lock_change_keys" style="background:#ffffff; color:#111827; border:0; font-weight:800;">${optionList(["Not asked / not applicable", "Yes - customer has keys", "No - gain access and change lock", "Unknown - confirm with customer"], job.lock_change_keys || "Not asked / not applicable")}</select></div>
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
                    <div><label>Assigned technician</label><select name="assigned_technician_id"><option value="">Unassigned</option>${technicianOptions(technicians, job.assigned_technician_id)}</select><div class="helper-line">Assignment is checked against the job date.</div><div class="helper-line">System will block unavailable technicians unless their return-to-work date covers the appointment date.</div></div>
                    <div><label>ETA</label><select id="edit_eta_select" name="eta">${etaSelectOptions(job.eta)}</select><input id="edit_eta_other" name="eta_other" value="${etaOptions.includes(job.eta || "") ? "" : escapeHtml(job.eta || "")}" placeholder="Other ETA" style="display:none; margin-top:8px;"><div id="edit_scheduled_box" style="display:none; margin-top:10px;"><label>Scheduled date and time</label><div class="form-grid-2" style="margin-top:6px; align-items:start;"><div><label>Date</label><input type="date" id="edit_scheduled_date" name="scheduled_date" value="${escapeHtml(scheduledDateValue(job.scheduled_at))}"></div>${compactScheduledTimePicker("edit_scheduled", scheduledTimeValue(job.scheduled_at))}</div><input type="hidden" id="edit_scheduled_at" name="scheduled_at" value="${escapeHtml(datetimeLocalValue(job.scheduled_at))}"></div></div>
                    <div><label>Status</label><select id="edit_job_status" name="status">${jobStatusOptions(job.status)}</select></div>
                    <div class="wide"><label>Job description</label><textarea name="job_description" rows="4">${escapeHtml(job.job_description)}</textarea></div>
                    <div class="wide"><label>Dispatcher notes</label><textarea name="dispatcher_notes" rows="3">${escapeHtml(job.dispatcher_notes)}</textarea></div>
                  </div>
                  <br>
                  <button type="submit">Save full order details</button>
                </form>
              </div>
            </main>

            <aside>
              <div class="control-card" id="appointment-card">
                <h2>Quick actions</h2>
                <form class="quick-form" method="POST" action="/jobs/${job.id}/quick-status">
                  <label>Change status</label>
                  <div class="quick-form-row">
                    <select id="quick_status" name="status">${jobStatusOptions(job.status)}</select>
                    <button type="submit">Update</button>
                  </div>
                </form>
                <form class="quick-form" method="POST" action="/jobs/${job.id}/quick-appointment">
                  <label>Change ETA / appointment time</label>
                  <div class="quick-form-row">
                    <select id="quick_eta_select" name="eta">${etaSelectOptions(job.eta)}</select>
                    <button type="submit">Save</button>
                  </div>
                  <input id="quick_eta_other" name="eta_other" value="${etaOptions.includes(job.eta || "") ? "" : escapeHtml(job.eta || "")}" placeholder="Other ETA" style="display:none; margin-top:8px;">
                  <div id="quick_scheduled_box" style="display:none; margin-top:10px;">
                    <label>Scheduled date and time</label>
                    <div class="quick-form-row">
                      <input type="date" id="quick_scheduled_date" name="scheduled_date" value="${escapeHtml(scheduledDateValue(job.scheduled_at))}">
                      ${compactScheduledTimePicker("quick_scheduled", scheduledTimeValue(job.scheduled_at))}
                    </div>
                    <input type="hidden" id="quick_scheduled_at" name="scheduled_at" value="${escapeHtml(datetimeLocalValue(job.scheduled_at))}">
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
                  <a class="action-button red" href="/jobs/${job.id}/close">Close job</a>
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

              <div class="control-card" id="stripe-card">
                <h2>Invoice + Stripe payment <span class="muted" style="font-size:11px; font-weight:700;">v82</span></h2>
                ${stripeReady() ? `<div class="stripe-warning ${stripeModeLabel() === "live" ? "stripe-live" : "stripe-ok"}">Stripe is configured in ${escapeHtml(stripeModeLabel()).toUpperCase()} mode. ${stripeModeLabel() === "live" ? "Live links can take real customer payments. Use a £1 amount for the first live test." : "Test links are safe for testing."}</div>` : `<div class="stripe-warning">Stripe is not ready: ${escapeHtml(stripeConfigurationError())}</div>`}
                <form method="POST" action="/jobs/${job.id}/stripe-link" class="quick-form" onsubmit="return confirm('Create an invoice AND Stripe payment link for this GROSS amount?');">
                  <label>GROSS amount customer will pay</label>
                  <input id="stripe-gross-amount" name="amount" value="${jobOutstandingAmount(job) !== null ? Number(jobOutstandingAmount(job)).toFixed(2) : ""}" inputmode="decimal" placeholder="e.g. 150.00" oninput="updateStripeGrossBreakdown(this.value)" required>
                  <label>Payment reason / note</label>
                  <input name="reason" value="Locksmith services${job.postcode ? ` (${escapeHtml(job.postcode)})` : ""}" maxlength="180" required>
                  <div id="stripe-vat-preview" class="stripe-warning stripe-ok" style="margin-top:8px;">${jobOutstandingAmount(job) !== null ? `NET ${money(stripeVatBreakdown(jobOutstandingAmount(job)).net)} · VAT @ 20% ${money(stripeVatBreakdown(jobOutstandingAmount(job)).vat)} · GROSS ${money(stripeVatBreakdown(jobOutstandingAmount(job)).gross)}` : "Enter the gross amount to see NET and VAT."}</div>
                  <p class="muted-note"><strong>Invoice:</strong> 24H Online Services Ltd · Card · UK VAT 20%</p>
                  <p class="muted-note">${stripeWebhookConfigured() ? "Automatic Stripe payment confirmation is ON." : "Automatic confirmation needs STRIPE_WEBHOOK_SECRET. Check payment works as a backup."}</p>
                  <button type="submit" ${stripeReady() ? "" : "disabled"}>Create Invoice & Stripe Link</button>
                  <p class="muted-note">Creates the PDF invoice and Stripe Payment Link together. Paid links are automatically reconciled when STRIPE_WEBHOOK_SECRET is configured; Check payment is available as a backup.</p>
                </form>
                ${renderStripePaymentLinks(stripeRows)}
              </div>

              <div class="control-card" id="sms-card">
                <h2>Send SMS</h2>
                ${renderSmsConfigNotice()}
                <form method="POST" action="/jobs/${job.id}/send-sms" class="quick-form" onsubmit="return confirm('Send this SMS to the customer?');">
                  <label>Template</label>
                  <select id="sms_template" name="sms_type">${smsTemplateOptions(job)}</select>
                  <label>Send to</label>
                  <input name="sms_to" value="${escapeHtml(job.customer_phone || '')}" placeholder="Customer mobile number" required>
                  <label>Message</label>
                  <textarea id="sms_message" name="sms_message" rows="5" maxlength="480" placeholder="Choose a template or write a custom message" required>${escapeHtml(fillSmsTemplate(defaultSmsTemplates[0].message, job))}</textarea>
                  <button type="submit">Send SMS</button>
                  <p class="muted-note">Marketing-style messages, such as review requests and discounts, should only be sent where the client is allowed to contact the customer.</p>
                </form>
                ${renderSmsHistory(smsRows)}
              </div>

              <div class="control-card">
                <h2>Payment chase</h2>
                <p class="muted-note">Use this when a job is partially or fully unpaid. Log the chase, outcome and next follow-up date.</p>
                <form method="POST" action="/jobs/${job.id}/payment-chase" class="quick-form">
                  <label>Chase made</label>
                  <input type="date" name="chase_date" value="${escapeHtml(dateInputValue(new Date()))}">
                  <label>Outcome</label>
                  <input name="outcome" placeholder="e.g. Left voicemail / client promised payment">
                  <label>Next follow-up date</label>
                  <input type="date" name="next_follow_up_date">
                  <label>Notes</label>
                  <textarea name="notes" rows="2" placeholder="Optional notes"></textarea>
                  <button type="submit">Log payment chase</button>
                </form>
                ${renderPaymentChaseHistory(paymentChases)}
              </div>

              <div class="control-card">
                <h2>Job documents / evidence</h2>
                <p class="muted-note">Use the shared Dropbox filing folder first, then paste the job-specific Dropbox folder or file link here.</p>
                ${renderMainEvidenceFolderLink()}
                <form method="POST" action="/jobs/${job.id}/evidence" class="quick-form">
                  <label>Evidence type</label>
                  <select name="evidence_type">${evidenceTypeOptions()}</select>
                  <label>Dropbox link</label>
                  <input name="evidence_url" placeholder="Paste Dropbox link" required>
                  <label>Notes</label>
                  <textarea name="evidence_notes" rows="2" placeholder="Optional notes"></textarea>
                  <button type="submit">Add evidence link</button>
                </form>
                ${renderJobEvidenceLinks(evidenceRows)}
              </div>

              <div class="control-card">
                <h2>Audit trail</h2>
                ${renderJobAuditTrail(auditRows)}
              </div>

              <div class="control-card danger-zone-card">
                <details>
                  <summary>Danger zone</summary>
                  <p>Only delete a job if it was created in error. This removes it from the live portal, but keeps an internal deleted-job snapshot.</p>
                  <form method="POST" action="/jobs/${job.id}/delete" onsubmit="return confirm('Are you sure you want to delete this job? This cannot be undone.');">
                    <button class="delete-job-button" type="submit">Delete this job</button>
                  </form>
                </details>
              </div>
            </aside>
          </div>
        </div>
        <script>
          function updateStripeGrossBreakdown(value) {
            const box = document.getElementById("stripe-vat-preview");
            if (!box) return;
            const gross = Number(String(value || "").replace(/[^0-9.-]/g, ""));
            if (!Number.isFinite(gross) || gross <= 0) { box.textContent = "Enter the gross amount to see NET and VAT."; return; }
            const grossPence = Math.round(gross * 100);
            const netPence = Math.round(grossPence / 1.2);
            const vatPence = grossPence - netPence;
            box.textContent = "NET £" + (netPence / 100).toFixed(2) + " · VAT @ 20% £" + (vatPence / 100).toFixed(2) + " · GROSS £" + (grossPence / 100).toFixed(2);
          }
          function copyText(text) {
            if (!text) return;
            navigator.clipboard.writeText(text).then(() => alert("Copied to clipboard."));
          }
          function copySummary() {
            const box = document.getElementById("techSummary");
            box.focus();
            box.select();
            document.execCommand("copy");
            alert("Technician summary copied.");
          }

          const smsTemplateSelect = document.getElementById("sms_template");
          const smsMessageBox = document.getElementById("sms_message");
          function updateSmsMessageFromTemplate() {
            if (!smsTemplateSelect || !smsMessageBox) return;
            const option = smsTemplateSelect.options[smsTemplateSelect.selectedIndex];
            const message = option ? option.getAttribute("data-message") : "";
            if (smsTemplateSelect.value !== "custom") smsMessageBox.value = message || "";
            if (smsTemplateSelect.value === "custom" && !smsMessageBox.value.trim()) smsMessageBox.value = "";
          }
          if (smsTemplateSelect) {
            smsTemplateSelect.addEventListener("change", updateSmsMessageFromTemplate);
          }


          const editJobTypeSelect = document.getElementById("edit_job_type");
          const editLockChangeKeysBox = document.getElementById("edit_lock_change_keys_box");
          function toggleEditLockChangePrompt() {
            if (!editJobTypeSelect || !editLockChangeKeysBox) return;
            editLockChangeKeysBox.style.display = editJobTypeSelect.value === "LOCK CHANGE" ? "block" : "none";
          }
          if (editJobTypeSelect) {
            editJobTypeSelect.addEventListener("change", toggleEditLockChangePrompt);
            toggleEditLockChangePrompt();
          }

          const quickEtaSelect = document.getElementById("quick_eta_select");
          const quickEtaOther = document.getElementById("quick_eta_other");
          const quickScheduledBox = document.getElementById("quick_scheduled_box");
          function toggleQuickEtaFields() {
            if (!quickEtaSelect) return;
            if (quickEtaOther) quickEtaOther.style.display = quickEtaSelect.value === "Other" ? "block" : "none";
            if (quickScheduledBox) quickScheduledBox.style.display = quickEtaSelect.value === "Scheduled" ? "block" : "none";
          }
          function validate24HourScheduledTime(dateId, timeId) {
            const scheduledDate = document.getElementById(dateId);
            const scheduledTime = document.getElementById(timeId);
            if (!scheduledDate || !scheduledTime || !scheduledDate.value || !scheduledTime.value) return true;
            const value = scheduledTime.value.trim();
            const ok = /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
            if (!ok) {
              alert("Please enter the scheduled time in 24 hour format, for example 09:00 or 14:30.");
              scheduledTime.focus();
              return false;
            }
            return true;
          }

          function combineQuickScheduledDateTime() {
            const scheduledDate = document.getElementById("quick_scheduled_date");
            const scheduledTime = document.getElementById("quick_scheduled_time");
            const scheduledAt = document.getElementById("quick_scheduled_at");
            if (!scheduledAt) return true;
            if (!validate24HourScheduledTime("quick_scheduled_date", "quick_scheduled_time")) return false;
            scheduledAt.value = scheduledDate && scheduledTime && scheduledDate.value && scheduledTime.value ? scheduledDate.value + "T" + scheduledTime.value.trim() : "";
            return true;
          }
          if (quickEtaSelect) {
            quickEtaSelect.addEventListener("change", toggleQuickEtaFields);
            toggleQuickEtaFields();
          }
          const quickAppointmentForm = document.querySelector('form[action="/jobs/${job.id}/quick-appointment"]');
          if (quickAppointmentForm) quickAppointmentForm.addEventListener("submit", event => {
            if (!combineQuickScheduledDateTime()) event.preventDefault();
          });

          const editEtaSelect = document.getElementById("edit_eta_select");
          const editEtaOther = document.getElementById("edit_eta_other");
          const editScheduledBox = document.getElementById("edit_scheduled_box");
          function toggleEditEtaFields() {
            if (!editEtaSelect) return;
            if (editEtaOther) editEtaOther.style.display = editEtaSelect.value === "Other" ? "block" : "none";
            if (editScheduledBox) editScheduledBox.style.display = editEtaSelect.value === "Scheduled" ? "block" : "none";
          }
          function combineEditScheduledDateTime() {
            const scheduledDate = document.getElementById("edit_scheduled_date");
            const scheduledTime = document.getElementById("edit_scheduled_time");
            const scheduledAt = document.getElementById("edit_scheduled_at");
            if (!scheduledAt) return true;
            if (!validate24HourScheduledTime("edit_scheduled_date", "edit_scheduled_time")) return false;
            scheduledAt.value = scheduledDate && scheduledTime && scheduledDate.value && scheduledTime.value ? scheduledDate.value + "T" + scheduledTime.value.trim() : "";
            return true;
          }
          if (editEtaSelect) {
            editEtaSelect.addEventListener("change", toggleEditEtaFields);
            toggleEditEtaFields();
          }
          const editOrderForm = document.querySelector('form[action="/jobs/${job.id}/update"]');
          if (editOrderForm) editOrderForm.addEventListener("submit", event => {
            if (!combineEditScheduledDateTime()) event.preventDefault();
          });
        </script>
      </body>
      </html>
    `);
  } catch (error) {
    console.error("Edit job page error:", error);
    res.status(500).send("Edit job page error. Check Render logs.");
  }
});

app.post("/jobs/:id/evidence", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const exists = (await pool.query(`SELECT id FROM jobs WHERE id = $1`, [id])).rows[0];
    if (!exists) return res.status(404).send("Job not found");
    await addJobEvidenceLink(id, req.body, currentAgentName(req), "job_evidence_added");
    res.redirect(`/jobs/${id}/edit`);
  } catch (error) {
    console.error("Add job evidence error:", error);
    res.status(500).send("Could not add job evidence link. Check Render logs.");
  }
});


app.post("/jobs/:id/stripe-link", async (req, res) => {
  const id = Number(req.params.id);
  const client = await pool.connect();
  try {
    const jobResult = await client.query(`
      SELECT j.*, t.name AS technician_name
      FROM jobs j
      LEFT JOIN technicians t ON t.id = j.assigned_technician_id
      WHERE j.id = $1
    `, [id]);
    if (!jobResult.rows.length) return res.status(404).send("Job not found");
    const job = jobResult.rows[0];
    const amount = parseMoneyInput(req.body.amount);
    const reason = String(req.body.reason || `Locksmith services${job.postcode ? ` (${job.postcode})` : ""}`).trim().slice(0, 180);
    if (!amount || amount <= 0) return res.status(400).send("Stripe amount must be greater than zero.");
    if (amount > 999999.99) return res.status(400).send("Stripe amount is too large. Please check the amount entered.");
    const configError = stripeConfigurationError();
    if (configError) return res.status(400).send(`Stripe is not ready: ${escapeHtml(configError)}`);

    const unitAmount = Math.round(amount * 100);
    const ref = job.job_number || jobNumber(job.id);
    const description = reason.slice(0, 240);

    const form = new URLSearchParams();
    form.append("line_items[0][quantity]", "1");
    form.append("line_items[0][price_data][currency]", "gbp");
    form.append("line_items[0][price_data][unit_amount]", String(unitAmount));
    form.append("line_items[0][price_data][product_data][name]", `24H Locksmiths payment ${ref}`);
    form.append("line_items[0][price_data][product_data][description]", description);
    form.append("metadata[job_id]", String(job.id));
    form.append("metadata[job_number]", ref);
    form.append("metadata[postcode]", job.postcode || "");
    form.append("metadata[created_by]", currentAgentName(req) || "Unknown");
    const stripeBreakdown = stripeVatBreakdown(amount);
    form.append("metadata[gross_amount]", stripeBreakdown.gross.toFixed(2));
    form.append("metadata[net_amount]", stripeBreakdown.net.toFixed(2));
    form.append("metadata[vat_amount]", stripeBreakdown.vat.toFixed(2));
    form.append("metadata[vat_rate]", "20%");
    form.append("payment_method_types[0]", "card");

    const stripeResult = await stripeApiFormRequest("/v1/payment_links", form);
    const paymentLink = stripeResult.json || {};
    if (!paymentLink.url) throw new Error("Stripe did not return a payment link URL.");

    const createdBy = currentAgentName(req) || "Unknown";
    let paymentLinkRowId = null;
    let invoiceRecord = null;
    await client.query("BEGIN");
    try {
      const linkInsert = await client.query(`
        INSERT INTO job_payment_links (job_id, provider, amount, currency, reason, payment_url, provider_session_id, status, stripe_mode, provider_response, created_by, created_at)
        VALUES ($1, 'stripe', $2, 'gbp', $3, $4, $5, 'created', $6, $7, $8, NOW())
        RETURNING id
      `, [
        id, amount, reason, paymentLink.url, paymentLink.id || "", stripeModeLabel(),
        JSON.stringify({ id: paymentLink.id, url: paymentLink.url, active: paymentLink.active }).slice(0, 1600),
        createdBy
      ]);
      paymentLinkRowId = linkInsert.rows[0].id;
      invoiceRecord = await createStripeInvoiceForJob(client, {
        job,
        grossAmount: amount,
        reason,
        createdBy,
        locksmithName: job.technician_name || "",
        paymentLinkId: paymentLinkRowId
      });
      await client.query(`UPDATE job_payment_links SET invoice_id = $1 WHERE id = $2`, [invoiceRecord.id, paymentLinkRowId]);
      await client.query("COMMIT");
    } catch (dbError) {
      await client.query("ROLLBACK");
      try {
        if (paymentLink.id) {
          const deactivate = new URLSearchParams();
          deactivate.append("active", "false");
          await stripeApiFormRequest(`/v1/payment_links/${paymentLink.id}`, deactivate);
        }
      } catch (deactivateError) {
        console.error("Could not deactivate orphan Stripe link after invoice/database failure:", deactivateError);
      }
      throw dbError;
    }

    try {
      await addJobAuditEntry(id, "stripe_invoice_link_created", "Invoice + Stripe payment link", "—", `${invoiceRecord.invoice_number} · GROSS ${money(amount)} · NET ${money(invoiceRecord.net)} · VAT ${money(invoiceRecord.vat)} · ${reason}`, createdBy);
    } catch (auditError) {
      console.error("Stripe invoice/link audit error:", auditError);
    }
    res.redirect(`/jobs/${id}/edit#stripe-card`);
  } catch (error) {
    console.error("Stripe payment link error:", error);
    res.status(500).send(`Stripe payment link error: ${escapeHtml(error.message || String(error))}. Check Render logs.`);
  } finally {
    client.release();
  }
});

app.post("/jobs/:id/stripe-link/:linkId/send-sms", async (req, res) => {
  const id = Number(req.params.id);
  const linkId = Number(req.params.linkId);
  try {
    const jobResult = await pool.query(`SELECT * FROM jobs WHERE id = $1`, [id]);
    if (!jobResult.rows.length) return res.status(404).send("Job not found");
    const job = jobResult.rows[0];

    const linkResult = await pool.query(`SELECT * FROM job_payment_links WHERE id = $1 AND job_id = $2`, [linkId, id]);
    if (!linkResult.rows.length) return res.status(404).send("Payment link not found");
    const link = linkResult.rows[0];

    const to = cleanSmsNumber(job.customer_phone);
    if (!to) return res.status(400).send("Customer phone number is missing.");
    const message = buildStripePaymentSms(job, link);

    let status = "sent";
    let providerResponse = "";
    try {
      const sendResult = await sendYaySms(to, message, `${job.job_number || jobNumber(job.id)} - Stripe payment link`);
      status = sendResult.status;
      providerResponse = sendResult.providerResponse;
    } catch (sendError) {
      status = "failed";
      providerResponse = sendError.message;
      console.error("Stripe payment SMS error:", sendError);
    }

    await pool.query(`
      INSERT INTO job_sms_log (job_id, sent_to, sms_type, template_name, message_body, status, provider, provider_response, sent_by, created_at)
      VALUES ($1, $2, 'stripe_payment_link', 'Stripe payment link', $3, $4, 'yay', $5, $6, NOW())
    `, [id, to, message, status, providerResponse, currentAgentName(req) || "Unknown"]);

    await pool.query(`
      UPDATE job_payment_links
      SET sent_at = NOW(), sent_by = $1, status = CASE WHEN $2 = 'failed' THEN 'sms_failed' ELSE 'sms_sent' END
      WHERE id = $3
    `, [currentAgentName(req) || "Unknown", status, linkId]);

    await addJobAuditEntry(id, "stripe_link_sms_sent", "Stripe payment SMS", "—", `${money(link.amount)} link to ${to}: ${status}`, currentAgentName(req) || "Unknown");
    res.redirect(`/jobs/${id}/edit#stripe-card`);
  } catch (error) {
    console.error("Stripe payment SMS route error:", error);
    res.status(500).send("Could not send Stripe payment SMS. Check Render logs.");
  }
});

app.post("/jobs/:id/send-sms", async (req, res) => {
  const id = Number(req.params.id);
  try {
    const jobResult = await pool.query(`
      SELECT j.*, t.name AS technician_name
      FROM jobs j
      LEFT JOIN technicians t ON t.id = j.assigned_technician_id
      WHERE j.id = $1
    `, [id]);
    if (!jobResult.rows.length) return res.status(404).send("Job not found");
    const job = jobResult.rows[0];
    const smsType = String(req.body.sms_type || "custom").trim();
    const template = smsTemplateByKey(smsType);
    const to = cleanSmsNumber(req.body.sms_to || job.customer_phone);
    const message = String(req.body.sms_message || fillSmsTemplate(template.message, job)).trim();
    if (!to) return res.status(400).send("SMS recipient number is missing.");
    if (!message) return res.status(400).send("SMS message is missing.");

    let status = "sent";
    let providerResponse = "";
    try {
      const sendResult = await sendYaySms(to, message, `${job.job_number || jobNumber(job.id)} - ${template.name}`);
      status = sendResult.status;
      providerResponse = sendResult.providerResponse;
    } catch (sendError) {
      status = "failed";
      providerResponse = sendError.message;
      console.error("Yay SMS send error:", sendError);
    }

    await pool.query(`
      INSERT INTO job_sms_log (job_id, sent_to, sms_type, template_name, message_body, status, provider, provider_response, sent_by, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, 'yay', $7, $8, NOW())
    `, [id, to, smsType, template.name, message, status, providerResponse, currentAgentName(req) || "Unknown"]);

    await addJobAuditEntry(id, "sms_sent", "SMS", "—", `${template.name} to ${to}: ${status}`, currentAgentName(req) || "Unknown");
    res.redirect(`/jobs/${id}/edit#sms-card`);
  } catch (error) {
    console.error("Send SMS route error:", error);
    res.status(500).send("Could not send/log SMS. Check Render logs.");
  }
});

app.post("/jobs/:id/quick-status", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const status = req.body.status || "open";
    const oldJob = (await pool.query(`SELECT * FROM jobs WHERE id = $1`, [id])).rows[0];
    await pool.query(`UPDATE jobs SET status = $1, updated_at = NOW() WHERE id = $2`, [status, id]);
    await logJobChanges(id, oldJob, { status }, currentAgentName(req), "status_changed");
    res.redirect(`/jobs/${id}/edit`);
  } catch (error) {
    console.error("Quick status update error:", error);
    res.status(500).send("Could not update job status");
  }
});

app.post("/jobs/:id/quick-appointment", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const eta = normaliseEta(req.body);
    const scheduledAt = eta === "Scheduled" ? parseScheduledTimestamp(req.body) : null;
    const oldJob = (await pool.query(`SELECT * FROM jobs WHERE id = $1`, [id])).rows[0];
    await assertTechnicianAssignableForJob(oldJob && oldJob.assigned_technician_id, targetDateForAssignment(eta, scheduledAt));
    await pool.query(`UPDATE jobs SET eta = $1, scheduled_at = $2, updated_at = NOW() WHERE id = $3`, [eta, scheduledAt, id]);
    await logJobChanges(id, oldJob, { eta, scheduled_at: scheduledAt }, currentAgentName(req), "appointment_changed");
    res.redirect(`/jobs/${id}/edit`);
  } catch (error) {
    console.error("Quick appointment update error:", error);
    res.status(500).send(`Could not update appointment time: ${escapeHtml(error.message)}`);
  }
});

app.post("/jobs/:id/quick-assign", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const technicianId = parseOptionalInt(req.body.assigned_technician_id);
    const oldJob = (await pool.query(`SELECT * FROM jobs WHERE id = $1`, [id])).rows[0];
    await assertTechnicianAssignableForJob(technicianId, targetDateForAssignment(oldJob && oldJob.eta, oldJob && oldJob.scheduled_at));
    const newStatus = technicianId !== null && oldJob && oldJob.status === "open" ? "assigned" : oldJob ? oldJob.status : "open";
    await pool.query(`
      UPDATE jobs
      SET assigned_technician_id = $1,
          status = CASE WHEN $1 IS NOT NULL AND status = 'open' THEN 'assigned' ELSE status END,
          updated_at = NOW()
      WHERE id = $2
    `, [technicianId, id]);
    await logJobChanges(id, oldJob, { assigned_technician_id: technicianId, status: newStatus }, currentAgentName(req), "technician_changed");
    res.redirect(`/jobs/${id}/edit`);
  } catch (error) {
    console.error("Quick assign error:", error);
    res.status(500).send(`Could not assign technician: ${escapeHtml(error.message)}`);
  }
});

app.post("/jobs/:id/update", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const body = req.body;
    const oldJob = (await pool.query(`SELECT * FROM jobs WHERE id = $1`, [id])).rows[0];
    const eta = normaliseEta(body);
    const newValues = {
      customer_name: body.customer_name,
      customer_phone: compactPhone(body.customer_phone),
      customer_alt_phone: compactPhone(body.customer_alt_phone),
      customer_email: body.customer_email,
      address_line_1: body.address_line_1,
      address_line_2: body.address_line_2,
      address_line_3: body.address_line_3,
      town: body.town,
      county: body.county,
      postcode: compactPostcode(body.postcode),
      job_type: body.job_type,
      job_description: body.job_description,
      lock_change_keys: body.job_type === "LOCK CHANGE" ? (body.lock_change_keys || "Not asked / not applicable") : null,
      urgency: body.urgency || "Normal",
      source_campaign: body.source_campaign,
      quoted_price: parseMoneyInput(body.quoted_price),
      starting_price: parseMoneyInput(body.starting_price),
      call_out_agreed: parseMoneyInput(body.call_out_agreed),
      start_price_locks: parseMoneyInput(body.start_price_locks),
      offsite_payment: body.offsite_payment === "true",
      bill_payer_name: body.bill_payer_name,
      bill_payer_phone: compactPhone(body.bill_payer_phone),
      expected_payment_method: body.expected_payment_method || "Unknown",
      account_job: body.account_job === "true",
      account_template_id: parseOptionalInt(body.account_template_id),
      assigned_technician_id: parseOptionalInt(body.assigned_technician_id),
      eta,
      scheduled_at: eta === "Scheduled" ? parseScheduledTimestamp(body) : null,
      dispatcher_notes: body.dispatcher_notes,
      status: body.status || "open"
    };
    await assertTechnicianAssignableForJob(newValues.assigned_technician_id, targetDateForAssignment(newValues.eta, newValues.scheduled_at));
    await pool.query(`
      UPDATE jobs SET
        customer_name=$1, customer_phone=$2, customer_alt_phone=$3, customer_email=$4,
        address_line_1=$5, address_line_2=$6, address_line_3=$7, town=$8, county=$9, postcode=$10,
        job_type=$11, job_description=$12, lock_change_keys=$13, urgency=$14, source_campaign=$15, quoted_price=$16,
        starting_price=$17, call_out_agreed=$18, start_price_locks=$19, offsite_payment=$20, bill_payer_name=$21, bill_payer_phone=$22,
        expected_payment_method=$23, account_job=$24, account_template_id=$25, assigned_technician_id=$26,
        eta=$27, scheduled_at=$28, dispatcher_notes=$29, status=$30, updated_at=NOW()
      WHERE id=$31
    `, [
      newValues.customer_name,
      newValues.customer_phone,
      newValues.customer_alt_phone,
      newValues.customer_email,
      newValues.address_line_1,
      newValues.address_line_2,
      newValues.address_line_3,
      newValues.town,
      newValues.county,
      newValues.postcode,
      newValues.job_type,
      newValues.job_description,
      newValues.lock_change_keys,
      newValues.urgency,
      newValues.source_campaign,
      newValues.quoted_price,
      newValues.starting_price,
      newValues.call_out_agreed,
      newValues.start_price_locks,
      newValues.offsite_payment,
      newValues.bill_payer_name,
      newValues.bill_payer_phone,
      newValues.expected_payment_method,
      newValues.account_job,
      newValues.account_template_id,
      newValues.assigned_technician_id,
      newValues.eta,
      newValues.scheduled_at,
      newValues.dispatcher_notes,
      newValues.status,
      id
    ]);
    await logJobChanges(id, oldJob, newValues, currentAgentName(req), "full_job_edit");
    res.redirect(`/jobs/${id}/edit`);
  } catch (error) {
    console.error("Update job error:", error);
    res.status(500).send(`Could not update job: ${escapeHtml(error.message)}`);
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

        <form method="POST" action="/jobs/${job.id}/close" onsubmit="return confirm('Have you closed it correctly, with the NET value?');">
          <div class="panel">
            <h2>Close job / payment</h2>
            <p class="muted">Enter the NET value. VAT is calculated automatically at 20%, and the full value is saved against the job. Cancelled jobs should be cancelled from Quick Actions; they do not need to be closed here.</p>
            <div class="job-grid">
              <div class="field"><label>NET job value</label><input id="netValue" name="net_value" value="${job.net_value !== null && job.net_value !== undefined ? Number(job.net_value).toFixed(2) : (job.final_value !== null && job.final_value !== undefined ? (Number(job.final_value) / 1.2).toFixed(2) : "")}" inputmode="decimal" required></div>
              <div class="field"><label>UK VAT 20%</label><input id="vatValue" name="vat_amount_display" value="" readonly></div>
              <div class="field"><label>Full value inc VAT</label><input id="grossValue" name="final_value_display" value="" readonly></div>
              <div class="field"><label>Customer paid?</label><select name="customer_paid"><option value="false" ${!job.customer_paid ? "selected" : ""}>No</option><option value="true" ${job.customer_paid ? "selected" : ""}>Yes</option></select></div>
              <div class="field"><label>Payment method 1</label><select id="paymentMethod1" name="payment_method_1" onchange="toggleClosePaymentRules()"><option value="">Select method</option>${optionList(splitPaymentMethods, job.payment_method_1 || job.payment_method || job.expected_payment_method || "")}</select></div>
              <div class="field"><label>Payment amount 1</label><input name="payment_amount_1" value="${job.payment_amount_1 !== null && job.payment_amount_1 !== undefined ? Number(job.payment_amount_1).toFixed(2) : (job.final_value !== null && job.final_value !== undefined ? Number(job.final_value).toFixed(2) : "")}" inputmode="decimal" placeholder="£"></div>
              <div class="field"><label>Payment method 2 / split payment</label><select id="paymentMethod2" name="payment_method_2" onchange="toggleClosePaymentRules()"><option value="">No split payment</option>${optionList(splitPaymentMethods, job.payment_method_2 || "")}</select></div>
              <div class="field"><label>Payment amount 2</label><input name="payment_amount_2" value="${job.payment_amount_2 !== null && job.payment_amount_2 !== undefined ? Number(job.payment_amount_2).toFixed(2) : ""}" inputmode="decimal" placeholder="£"></div>
              <div class="field"><label>Final close status</label><select name="status">${literalClosingStatusOptions(job.status || (job.customer_paid ? "fully_paid" : "awaiting_payment"))}</select><small class="muted">Closing outcomes only. Cancelled jobs should be cancelled from Quick Actions, not closed here.</small></div>
              <div class="field"><label>Materials cost</label><input name="materials_cost" value="${job.materials_cost !== null && job.materials_cost !== undefined ? Number(job.materials_cost).toFixed(2) : ""}" inputmode="decimal" placeholder="e.g. 18"></div>
              <div class="field"><label>Outcome</label><select name="outcome">${optionList(jobOutcomes, job.outcome || "Completed")}</select></div>
            </div>
            <div id="invoicePhotosBox" class="panel" style="margin-top:14px; display:none; background:#0f172a;">
              <label>The correct invoice has been used and completed, photos are also on file</label>
              <select name="invoice_photos_confirmed"><option value="false" ${!job.invoice_photos_confirmed ? "selected" : ""}>No</option><option value="true" ${job.invoice_photos_confirmed ? "selected" : ""}>Yes</option></select>
            </div>
            <div id="cardRulesBox" class="panel" style="margin-top:14px; display:none; background:#0f172a;">
              <div class="job-grid">
                <div class="field"><label>Was this card payment AMEX?</label><select id="cardIsAmex" name="card_is_amex" onchange="toggleClosePaymentRules()"><option value="false" ${!job.card_is_amex ? "selected" : ""}>No</option><option value="true" ${job.card_is_amex ? "selected" : ""}>Yes</option></select></div>
                <div id="amexIdBox" class="field" style="display:none;"><label>AMEX ID from client provided?</label><select name="amex_id_provided"><option value="false" ${!job.amex_id_provided ? "selected" : ""}>No</option><option value="true" ${job.amex_id_provided ? "selected" : ""}>Yes</option></select></div>
              </div>
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
          <div class="panel">
            <h2>Job documents / evidence</h2>
            <p class="muted">Use the shared Dropbox filing folder first, then paste the job-specific Dropbox folder or file link here.</p>
            ${renderMainEvidenceFolderLink()}
            ${jobEvidenceForm(job.id)}
          </div>
          <button type="submit">Save close details</button>
          <a href="/jobs/${job.id}/edit" style="margin-left:12px;">Back to job</a>
        </form>
        <script>
          function recalcCloseValues(){
            const netInput = document.getElementById('netValue');
            const vatInput = document.getElementById('vatValue');
            const grossInput = document.getElementById('grossValue');
            const net = Number(String(netInput.value || '').replace(/[^0-9.-]/g, '')) || 0;
            const vat = Math.round(net * 0.20 * 100) / 100;
            const gross = Math.round((net + vat) * 100) / 100;
            vatInput.value = '£' + vat.toFixed(2);
            grossInput.value = '£' + gross.toFixed(2);
          }
          function selectedPaymentMethods(){
            return [document.getElementById('paymentMethod1')?.value || '', document.getElementById('paymentMethod2')?.value || ''].map(v => v.toLowerCase());
          }
          function toggleClosePaymentRules(){
            const methods = selectedPaymentMethods();
            const hasCard = methods.some(v => v.includes('card'));
            const hasBankOrCard = hasCard || methods.some(v => v.includes('bank transfer'));
            document.getElementById('invoicePhotosBox').style.display = hasBankOrCard ? 'block' : 'none';
            document.getElementById('cardRulesBox').style.display = hasCard ? 'block' : 'none';
            const isAmex = document.getElementById('cardIsAmex')?.value === 'true';
            document.getElementById('amexIdBox').style.display = hasCard && isAmex ? 'block' : 'none';
          }
          document.getElementById('netValue').addEventListener('input', recalcCloseValues);
          recalcCloseValues();
          toggleClosePaymentRules();
        </script>
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
    const oldJob = (await pool.query(`SELECT * FROM jobs WHERE id = $1`, [id])).rows[0];
    const netValue = parseMoneyInput(body.net_value);
    const vatAmount = calculateVatFromNet(netValue);
    const finalValue = calculateGrossFromNet(netValue);
    const includesCard = closePaymentIncludesCard(body);
    const isAmex = includesCard && body.card_is_amex === "true";
    const amexIdProvided = isAmex && body.amex_id_provided === "true";
    if (isAmex && !amexIdProvided) {
      return res.status(400).send("AMEX payment selected. Please confirm that ID from the client has been provided.");
    }
    const closeValues = {
      net_value: netValue,
      vat_amount: vatAmount,
      final_value: finalValue,
      payment_method: buildSplitPaymentSummary(body),
      payment_method_1: body.payment_method_1 || "",
      payment_amount_1: parseMoneyInput(body.payment_amount_1),
      payment_method_2: body.payment_method_2 || "",
      payment_amount_2: parseMoneyInput(body.payment_amount_2),
      invoice_photos_confirmed: closePaymentRequiresInvoicePhotos(body) ? body.invoice_photos_confirmed === "true" : false,
      card_is_amex: isAmex,
      amex_id_provided: amexIdProvided,
      customer_paid: body.customer_paid === "true",
      materials_used: body.materials_used,
      materials_cost: parseMoneyInput(body.materials_cost),
      outcome: body.outcome,
      tech_notes: body.tech_notes,
      close_notes: body.close_notes,
      status: body.status || "fully_paid"
    };
    await pool.query(`
      UPDATE jobs SET
        net_value=$1,
        vat_amount=$2,
        final_value=$3,
        payment_method=$4,
        payment_method_1=$5,
        payment_amount_1=$6,
        payment_method_2=$7,
        payment_amount_2=$8,
        invoice_photos_confirmed=$9,
        card_is_amex=$10,
        amex_id_provided=$11,
        customer_paid=$12,
        materials_used=$13,
        materials_cost=$14,
        outcome=$15,
        tech_notes=$16,
        close_notes=$17,
        status=$18,
        closed_by=$19,
        closed_at=COALESCE(closed_at, NOW()),
        updated_at=NOW()
      WHERE id=$20
    `, [
      closeValues.net_value,
      closeValues.vat_amount,
      closeValues.final_value,
      closeValues.payment_method,
      closeValues.payment_method_1,
      closeValues.payment_amount_1,
      closeValues.payment_method_2,
      closeValues.payment_amount_2,
      closeValues.invoice_photos_confirmed,
      closeValues.card_is_amex,
      closeValues.amex_id_provided,
      closeValues.customer_paid,
      closeValues.materials_used,
      closeValues.materials_cost,
      closeValues.outcome,
      closeValues.tech_notes,
      closeValues.close_notes,
      closeValues.status,
      currentAgentName(req),
      id
    ]);
    await logJobChanges(id, oldJob, closeValues, currentAgentName(req), "job_closed_or_payment_updated");
    await addJobEvidenceLink(id, body, currentAgentName(req), "close_evidence_added");
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
          setValue("postcode", String(address.postcode || "").toUpperCase().replace(/\s+/g, ""));
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
    const customerPostcode = cleanPostcode(req.query.postcode || "");
    const jobType = (req.query.job_type || "").trim();

    function postcodeDistrict(value) {
      const clean = cleanPostcode(value || "");
      const match = clean.match(/^([A-Z]{1,2}\d{1,2}[A-Z]?)/);
      return match ? match[1] : clean;
    }

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
          locationDistrict: postcodeDistrict(item.location.postcode || ""),
          locationSource: item.location.source || "",
          skills: tech.skills || "",
          notes: tech.notes || "",
          distance: item.distance === null ? null : Number(item.distance.toFixed(1)),
          latitude: item.techLocation.latitude,
          longitude: item.techLocation.longitude
        };
      });

    const customerDistrict = postcodeDistrict(customerPostcode);

    const mapData = {
      customer: customerLocation && customerLocation.ok
        ? {
            postcode: customerPostcode,
            district: customerDistrict,
            latitude: customerLocation.latitude,
            longitude: customerLocation.longitude,
            precision: customerLocation.precision
          }
        : null,
      technicians: mapTechnicians
    };

    const districtLabels = [
      { code: "W1", name: "West End", lat: 51.5136, lng: -0.1443 },
      { code: "W2", name: "Paddington", lat: 51.5158, lng: -0.1760 },
      { code: "W3", name: "Acton", lat: 51.5087, lng: -0.2678 },
      { code: "W4", name: "Chiswick", lat: 51.4927, lng: -0.2630 },
      { code: "W5", name: "Ealing", lat: 51.5130, lng: -0.3015 },
      { code: "W6", name: "Hammersmith", lat: 51.4920, lng: -0.2260 },
      { code: "W7", name: "Hanwell", lat: 51.5117, lng: -0.3360 },
      { code: "W8", name: "Kensington", lat: 51.5019, lng: -0.1948 },
      { code: "W9", name: "Maida Vale", lat: 51.5272, lng: -0.1899 },
      { code: "W10", name: "North Kensington", lat: 51.5232, lng: -0.2161 },
      { code: "W11", name: "Notting Hill", lat: 51.5121, lng: -0.2054 },
      { code: "W12", name: "Shepherd's Bush", lat: 51.5055, lng: -0.2247 },
      { code: "W13", name: "West Ealing", lat: 51.5136, lng: -0.3200 },
      { code: "W14", name: "West Kensington", lat: 51.4947, lng: -0.2071 },
      { code: "NW1", name: "Camden", lat: 51.5350, lng: -0.1420 },
      { code: "NW2", name: "Cricklewood", lat: 51.5580, lng: -0.2206 },
      { code: "NW3", name: "Hampstead", lat: 51.5563, lng: -0.1744 },
      { code: "NW4", name: "Hendon", lat: 51.5860, lng: -0.2250 },
      { code: "NW5", name: "Kentish Town", lat: 51.5500, lng: -0.1415 },
      { code: "NW6", name: "Kilburn", lat: 51.5435, lng: -0.1960 },
      { code: "NW7", name: "Mill Hill", lat: 51.6150, lng: -0.2440 },
      { code: "NW8", name: "St John's Wood", lat: 51.5335, lng: -0.1720 },
      { code: "NW9", name: "Colindale", lat: 51.5870, lng: -0.2550 },
      { code: "NW10", name: "Willesden", lat: 51.5450, lng: -0.2560 },
      { code: "NW11", name: "Golders Green", lat: 51.5765, lng: -0.1970 },
      { code: "N1", name: "Islington", lat: 51.5390, lng: -0.1010 },
      { code: "N2", name: "East Finchley", lat: 51.5900, lng: -0.1650 },
      { code: "N3", name: "Finchley", lat: 51.6000, lng: -0.1950 },
      { code: "N4", name: "Finsbury Park", lat: 51.5700, lng: -0.1050 },
      { code: "N5", name: "Highbury", lat: 51.5520, lng: -0.0990 },
      { code: "N6", name: "Highgate", lat: 51.5720, lng: -0.1480 },
      { code: "N7", name: "Holloway", lat: 51.5540, lng: -0.1200 },
      { code: "N8", name: "Crouch End", lat: 51.5830, lng: -0.1230 },
      { code: "N10", name: "Muswell Hill", lat: 51.5900, lng: -0.1420 },
      { code: "N15", name: "Seven Sisters", lat: 51.5820, lng: -0.0750 },
      { code: "N16", name: "Stoke Newington", lat: 51.5620, lng: -0.0730 },
      { code: "E1", name: "Whitechapel", lat: 51.5160, lng: -0.0610 },
      { code: "E2", name: "Bethnal Green", lat: 51.5290, lng: -0.0630 },
      { code: "E3", name: "Bow", lat: 51.5270, lng: -0.0240 },
      { code: "E5", name: "Clapton", lat: 51.5580, lng: -0.0540 },
      { code: "E8", name: "Hackney", lat: 51.5430, lng: -0.0640 },
      { code: "E9", name: "Homerton", lat: 51.5450, lng: -0.0380 },
      { code: "E10", name: "Leyton", lat: 51.5650, lng: -0.0140 },
      { code: "E11", name: "Leytonstone", lat: 51.5680, lng: 0.0080 },
      { code: "E13", name: "Plaistow", lat: 51.5280, lng: 0.0270 },
      { code: "E14", name: "Canary Wharf", lat: 51.5050, lng: -0.0180 },
      { code: "E15", name: "Stratford", lat: 51.5420, lng: 0.0050 },
      { code: "E17", name: "Walthamstow", lat: 51.5860, lng: -0.0200 },
      { code: "SE1", name: "Southwark", lat: 51.5010, lng: -0.0890 },
      { code: "SE3", name: "Blackheath", lat: 51.4680, lng: 0.0120 },
      { code: "SE5", name: "Camberwell", lat: 51.4730, lng: -0.0910 },
      { code: "SE8", name: "Deptford", lat: 51.4800, lng: -0.0270 },
      { code: "SE10", name: "Greenwich", lat: 51.4820, lng: -0.0040 },
      { code: "SE11", name: "Kennington", lat: 51.4880, lng: -0.1080 },
      { code: "SE13", name: "Lewisham", lat: 51.4620, lng: -0.0040 },
      { code: "SE14", name: "New Cross", lat: 51.4750, lng: -0.0370 },
      { code: "SE15", name: "Peckham", lat: 51.4710, lng: -0.0660 },
      { code: "SE16", name: "Rotherhithe", lat: 51.4950, lng: -0.0520 },
      { code: "SE18", name: "Woolwich", lat: 51.4890, lng: 0.0670 },
      { code: "SE19", name: "Crystal Palace", lat: 51.4190, lng: -0.0820 },
      { code: "SE23", name: "Forest Hill", lat: 51.4410, lng: -0.0490 },
      { code: "SE25", name: "South Norwood", lat: 51.3990, lng: -0.0750 },
      { code: "SW1", name: "Victoria", lat: 51.4970, lng: -0.1350 },
      { code: "SW2", name: "Brixton Hill", lat: 51.4450, lng: -0.1260 },
      { code: "SW3", name: "Chelsea", lat: 51.4900, lng: -0.1660 },
      { code: "SW4", name: "Clapham", lat: 51.4620, lng: -0.1380 },
      { code: "SW5", name: "Earl's Court", lat: 51.4910, lng: -0.1910 },
      { code: "SW6", name: "Fulham", lat: 51.4800, lng: -0.1970 },
      { code: "SW7", name: "South Kensington", lat: 51.4960, lng: -0.1740 },
      { code: "SW8", name: "Nine Elms", lat: 51.4790, lng: -0.1320 },
      { code: "SW9", name: "Brixton", lat: 51.4630, lng: -0.1120 },
      { code: "SW11", name: "Battersea", lat: 51.4660, lng: -0.1700 },
      { code: "SW12", name: "Balham", lat: 51.4450, lng: -0.1500 },
      { code: "SW14", name: "Mortlake", lat: 51.4650, lng: -0.2670 },
      { code: "SW15", name: "Putney", lat: 51.4600, lng: -0.2180 },
      { code: "SW16", name: "Streatham", lat: 51.4270, lng: -0.1280 },
      { code: "SW17", name: "Tooting", lat: 51.4300, lng: -0.1650 },
      { code: "SW18", name: "Wandsworth", lat: 51.4540, lng: -0.1900 },
      { code: "SW19", name: "Wimbledon", lat: 51.4210, lng: -0.2070 },
      { code: "SW20", name: "Raynes Park", lat: 51.4090, lng: -0.2300 },
      { code: "HA0", name: "Wembley", lat: 51.5510, lng: -0.3050 },
      { code: "HA1", name: "Harrow", lat: 51.5790, lng: -0.3370 },
      { code: "HA2", name: "South Harrow", lat: 51.5650, lng: -0.3520 },
      { code: "HA3", name: "Kenton", lat: 51.5920, lng: -0.3160 },
      { code: "HA4", name: "Ruislip", lat: 51.5730, lng: -0.4120 },
      { code: "HA5", name: "Pinner", lat: 51.5940, lng: -0.3820 },
      { code: "HA6", name: "Northwood", lat: 51.6110, lng: -0.4230 },
      { code: "HA7", name: "Stanmore", lat: 51.6170, lng: -0.3140 },
      { code: "HA8", name: "Edgware", lat: 51.6130, lng: -0.2750 },
      { code: "HA9", name: "Wembley Park", lat: 51.5580, lng: -0.2820 },
      { code: "UB1", name: "Southall", lat: 51.5110, lng: -0.3750 },
      { code: "UB3", name: "Hayes", lat: 51.5060, lng: -0.4210 },
      { code: "UB6", name: "Greenford", lat: 51.5400, lng: -0.3450 },
      { code: "UB8", name: "Uxbridge", lat: 51.5460, lng: -0.4780 },
      { code: "TW3", name: "Hounslow", lat: 51.4700, lng: -0.3610 },
      { code: "TW7", name: "Isleworth", lat: 51.4750, lng: -0.3350 },
      { code: "TW9", name: "Richmond", lat: 51.4630, lng: -0.3000 },
      { code: "KT1", name: "Kingston", lat: 51.4090, lng: -0.3060 },
      { code: "CR0", name: "Croydon", lat: 51.3760, lng: -0.0980 },
      { code: "CR2", name: "South Croydon", lat: 51.3480, lng: -0.0930 },
      { code: "BR1", name: "Bromley", lat: 51.4070, lng: 0.0170 },
      { code: "IG1", name: "Ilford", lat: 51.5590, lng: 0.0740 },
      { code: "RM1", name: "Romford", lat: 51.5760, lng: 0.1830 }
    ];

    const visibleDistricts = districtLabels.filter(label => {
      if (!customerLocation || !customerLocation.ok) return true;
      return distanceMiles(customerLocation.latitude, customerLocation.longitude, label.lat, label.lng) <= 18 || label.code === customerDistrict;
    });

    const mapDataJson = JSON.stringify(mapData).replace(/</g, "\\u003c");
    const districtLabelsJson = JSON.stringify(visibleDistricts).replace(/</g, "\\u003c");

    const topTechCards = mapTechnicians.slice(0, 6).map(tech => {
      const distanceText = tech.distance === null ? "Distance unknown" : `${tech.distance} miles`;
      const etaText = tech.distance === null ? "Check ETA" : `${Math.max(12, Math.round(tech.distance * 3))} mins est.`;
      const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${tech.latitude},${tech.longitude}`)}`;
      return `
        <a class="tech-rank-card" href="${mapsUrl}" target="_blank" rel="noopener">
          <span class="rank-number">${tech.rank}</span>
          <span class="rank-main"><strong>${escapeHtml(tech.name)}</strong><small>${escapeHtml(tech.locationDistrict || tech.locationPostcode || "No postcode")} · ${escapeHtml(tech.status || "")}</small></span>
          <span class="rank-distance"><strong>${escapeHtml(distanceText)}</strong><small>${escapeHtml(etaText)}</small></span>
        </a>
      `;
    }).join("");

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

    const customerMapsUrl = mapData.customer
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${mapData.customer.latitude},${mapData.customer.longitude}`)}`
      : "https://www.google.com/maps/search/London";

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
          .leaflet-tile { filter: saturate(.85) contrast(.95) brightness(1.04); visibility: hidden; }
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
          .leaflet-control-zoom { border: 1px solid #d7dee8; background-clip: padding-box; border-radius: 10px; margin-left: 12px; margin-top: 12px; overflow:hidden; box-shadow:0 8px 20px rgba(15,23,42,.12); }
          .leaflet-control-zoom a { background-color: white; border-bottom: 1px solid #e5e7eb; color: #111827; display: block; height: 34px; line-height: 34px; text-align: center; text-decoration: none; width: 34px; margin: 0; font-size: 20px; font-weight:800; }
          .leaflet-popup { position: absolute; text-align: center; margin-bottom: 20px; }
          .leaflet-popup-content-wrapper { background: white; border-radius: 14px; padding: 1px; text-align: left; box-shadow: 0 16px 40px rgba(15,23,42,.22); }
          .leaflet-popup-content { margin: 14px 18px; line-height: 1.45; color: #111827; }
          .leaflet-popup-tip-container { width: 40px; height: 20px; position: absolute; left: 50%; margin-left: -20px; overflow: hidden; pointer-events: none; }
          .leaflet-popup-tip { width: 17px; height: 17px; padding: 1px; margin: -10px auto 0; background: white; transform: rotate(45deg); box-shadow: 0 3px 14px rgba(0,0,0,0.25); }
          .map-page-head { display:flex; align-items:flex-start; justify-content:space-between; gap:18px; margin-bottom:16px; }
          .map-title-wrap h1 { margin-bottom:4px; }
          .map-actions { display:flex; gap:10px; flex-wrap:wrap; }
          .map-search-panel { margin-bottom:0; }
          form.map-search { display:grid; grid-template-columns: 2fr 1.2fr auto; gap:14px; align-items:end; }
          .dispatch-map-layout { display:grid; grid-template-columns:minmax(0,1fr) 360px; gap:16px; align-items:stretch; }
          .map-frame { position:relative; background:#fff; border:1px solid #dfe5ee; border-radius:18px; overflow:hidden; box-shadow:0 14px 34px rgba(15,23,42,.08); }
          #dispatch-map { height: 720px; width: 100%; background: #f8fafc; }
          .map-footer-note { position:absolute; left:14px; right:14px; bottom:14px; background:rgba(255,255,255,.92); border:1px solid #dfe5ee; border-radius:12px; padding:10px 12px; font-size:12px; color:#475569; box-shadow:0 10px 25px rgba(15,23,42,.08); z-index:750; }
          .map-legend { position:absolute; left:14px; bottom:62px; background:rgba(255,255,255,.94); border:1px solid #dfe5ee; border-radius:14px; padding:14px; box-shadow:0 14px 28px rgba(15,23,42,.12); z-index:760; min-width:190px; }
          .map-legend h4 { margin:0 0 10px; font-size:12px; text-transform:uppercase; letter-spacing:.06em; color:#334155; }
          .legend-item { display:flex; align-items:center; gap:8px; font-size:13px; margin:8px 0; color:#475569; }
          .legend-dot { width:13px; height:13px; border-radius:50%; display:inline-block; }
          .dot-customer { background:#dc2626; }
          .dot-available { background:#16a34a; }
          .dot-soon { background:#f59e0b; }
          .dot-onjob { background:#2563eb; }
          .dot-boundary { width:24px; height:0; border-top:2px dashed #a855f7; border-radius:0; }
          .district-label { background:rgba(255,255,255,.72); border:1px solid rgba(168,85,247,.25); color:#8b5cf6; font-weight:900; font-size:20px; letter-spacing:.02em; padding:2px 8px; border-radius:10px; text-shadow:0 1px 0 #fff; box-shadow:0 4px 10px rgba(15,23,42,.04); }
          .district-label small { display:block; color:#475569; font-size:9px; font-weight:700; letter-spacing:0; text-align:center; margin-top:-2px; }
          .district-label.active { background:#fff7ed; border-color:#fb923c; color:#dc2626; transform:scale(1.08); }
          .marker-pin { width:34px; height:34px; border-radius:999px 999px 999px 4px; transform:rotate(-45deg); display:flex; align-items:center; justify-content:center; color:white; font-weight:900; border:3px solid white; box-shadow:0 7px 18px rgba(15,23,42,.32); }
          .marker-pin span { transform:rotate(45deg); display:block; font-size:12px; }
          .marker-customer { background:#dc2626; }
          .marker-available { background:#16a34a; }
          .marker-soon { background:#f59e0b; color:#111827; }
          .marker-onjob { background:#2563eb; }
          .marker-other { background:#6b7280; }
          .map-side-panel { background:white; border:1px solid #dfe5ee; border-radius:18px; padding:18px; box-shadow:0 14px 34px rgba(15,23,42,.08); display:flex; flex-direction:column; gap:16px; min-height:720px; }
          .side-section { border-bottom:1px solid #e5e7eb; padding-bottom:15px; }
          .side-section:last-child { border-bottom:0; padding-bottom:0; }
          .side-kicker { font-size:11px; color:#64748b; font-weight:900; text-transform:uppercase; letter-spacing:.07em; margin-bottom:8px; }
          .current-job-box { display:flex; gap:12px; align-items:center; }
          .job-pin-icon { width:42px; height:42px; border-radius:14px; background:#fee2e2; color:#dc2626; display:flex; align-items:center; justify-content:center; font-weight:900; font-size:22px; }
          .current-job-box h2 { margin:0 0 3px; font-size:20px; }
          .current-job-box p { margin:0; color:#64748b; }
          .mini-metrics { display:grid; grid-template-columns:repeat(3,1fr); border:1px solid #e5e7eb; border-radius:14px; overflow:hidden; }
          .mini-metric { padding:12px; border-right:1px solid #e5e7eb; }
          .mini-metric:last-child { border-right:0; }
          .mini-metric small { display:block; color:#64748b; font-size:10px; font-weight:900; text-transform:uppercase; margin-bottom:4px; }
          .mini-metric strong { font-size:15px; }
          .tech-rank-card { display:grid; grid-template-columns:32px 1fr auto; gap:10px; align-items:center; text-decoration:none; color:#111827; border:1px solid #e5e7eb; border-radius:12px; padding:10px; margin-bottom:8px; background:#fff; }
          .tech-rank-card:hover { border-color:#93c5fd; background:#f8fbff; }
          .rank-number { width:28px; height:28px; border-radius:9px; background:#111827; color:white; display:flex; align-items:center; justify-content:center; font-weight:900; }
          .rank-main small, .rank-distance small { display:block; color:#64748b; font-size:11px; margin-top:2px; }
          .rank-distance { text-align:right; color:#16a34a; }
          .area-list { display:grid; gap:9px; font-size:13px; color:#334155; }
          .area-list div { display:grid; grid-template-columns:110px 1fr; gap:10px; }
          .area-list strong { color:#64748b; }
          .map-table-panel { margin-top:18px; }
          @media (max-width: 1100px) { .dispatch-map-layout { grid-template-columns:1fr; } .map-side-panel { min-height:auto; } }
          @media (max-width: 900px) { form.map-search { grid-template-columns:1fr; } #dispatch-map { height:540px; } .map-page-head { flex-direction:column; } .map-legend { position:relative; left:auto; bottom:auto; margin:12px; z-index:1; } .map-footer-note { position:relative; left:auto; right:auto; bottom:auto; margin:12px; z-index:1; } }
        </style>
      </head>
      <body>
        ${nav(req)}
        <div class="map-page-head">
          <div class="map-title-wrap">
            <h1>Dispatch Map</h1>
            <div class="subtitle">District view · postcode-led dispatch map for London jobs</div>
          </div>
          <div class="map-actions">
            <a class="action-button dark" href="/jobs">Back to Dispatch Board</a>
            <a class="action-button green" href="/jobs/new">+ Create Order</a>
          </div>
        </div>

        <div class="panel map-search-panel">
          <form class="map-search" method="GET" action="/dispatch">
            <label>Search postcode or place
              <input name="postcode" value="${escapeHtml(customerPostcode)}" placeholder="Customer postcode e.g. SE13 5BY">
            </label>
            <label>Job type
              <input name="job_type" value="${escapeHtml(jobType)}" placeholder="Job type e.g. lockout, uPVC">
            </label>
            <button type="submit">Find Locksmith</button>
          </form>
        </div>

        <div class="dispatch-map-layout">
          <div class="map-frame">
            <div id="dispatch-map"></div>
            <div class="map-legend">
              <h4>Map key</h4>
              <div class="legend-item"><span class="legend-dot dot-customer"></span> Customer location</div>
              <div class="legend-item"><span class="legend-dot dot-available"></span> Available technician</div>
              <div class="legend-item"><span class="legend-dot dot-soon"></span> Available soon</div>
              <div class="legend-item"><span class="legend-dot dot-onjob"></span> On job</div>
              <div class="legend-item"><span class="legend-dot dot-boundary"></span> Postcode district guide</div>
            </div>
            <div class="map-footer-note">Showing a cleaner district view with postcode labels and main roads. Zoom in for more street detail when needed.</div>
          </div>

          <aside class="map-side-panel">
            <div class="side-section">
              <div class="side-kicker">Current job</div>
              <div class="current-job-box">
                <div class="job-pin-icon">⌖</div>
                <div>
                  <h2>${customerPostcode ? escapeHtml(customerPostcode) : "No postcode"}</h2>
                  <p>${customerPostcode ? `${escapeHtml(customerDistrict || "")}${jobType ? ` · ${escapeHtml(jobType)}` : ""}` : "Enter a postcode to rank nearby technicians"}</p>
                </div>
              </div>
            </div>

            <div class="side-section">
              <div class="mini-metrics">
                <div class="mini-metric"><small>Straight line</small><strong>${mapTechnicians[0] && mapTechnicians[0].distance !== null ? `${escapeHtml(String(mapTechnicians[0].distance))} miles` : "—"}</strong></div>
                <div class="mini-metric"><small>Best ETA</small><strong>${mapTechnicians[0] && mapTechnicians[0].distance !== null ? `${Math.max(12, Math.round(mapTechnicians[0].distance * 3))} mins` : "—"}</strong></div>
                <div class="mini-metric"><small>Techs shown</small><strong>${mapTechnicians.length}</strong></div>
              </div>
            </div>

            <div class="side-section">
              <div class="side-kicker">Nearest available locksmiths</div>
              ${topTechCards || `<p class="muted">Enter a postcode or add technician postcodes to show ranked technicians.</p>`}
            </div>

            <div class="side-section">
              <div class="side-kicker">Area information</div>
              <div class="area-list">
                <div><strong>Postcode district</strong><span>${customerDistrict ? escapeHtml(customerDistrict) : "—"}</span></div>
                <div><strong>Location result</strong><span>${customerPostcode ? escapeHtml(customerLocationMessage || "Not searched") : "—"}</span></div>
                <div><strong>Major roads</strong><span>Shown on base map</span></div>
                <div><strong>Map style</strong><span>District labels + reduced street clutter</span></div>
              </div>
            </div>

            <a class="action-button dark" href="${customerMapsUrl}" target="_blank" rel="noopener">Open in Google Maps</a>
          </aside>
        </div>

        <div class="panel map-table-panel">
          <h2>Ranked Technician List</h2>
          <table>
            <thead>
              <tr>
                <th>Rank</th><th>Technician</th><th>Status</th><th>Priority</th><th>Available From</th><th>Location</th><th>Distance</th><th>Skills</th><th>Notes</th><th>Last Updated</th>
              </tr>
            </thead>
            <tbody>${rows || `<tr><td colspan="10">No available technicians found</td></tr>`}</tbody>
          </table>
        </div>
        <script>
          const mapData = ${mapDataJson};
          const districtLabels = ${districtLabelsJson};
          const customerDistrict = ${JSON.stringify(customerDistrict || "")};
          const map = L.map("dispatch-map", { scrollWheelZoom: true, zoomControl: true });

          L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
            subdomains: "abcd",
            maxZoom: 19,
            attribution: "&copy; OpenStreetMap contributors &copy; CARTO"
          }).addTo(map);

          setTimeout(function() { map.invalidateSize(); }, 250);

          const defaultLondonCentre = [51.5072, -0.1276];
          const hasCustomer = !!mapData.customer;

          if (hasCustomer) {
            map.setView([mapData.customer.latitude, mapData.customer.longitude], 11);
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

          function makePinIcon(label, className) {
            return L.divIcon({
              className: "",
              html: '<div class="marker-pin ' + className + '"><span>' + label + '</span></div>',
              iconSize: [38, 38],
              iconAnchor: [19, 36],
              popupAnchor: [0, -34]
            });
          }

          function makeDistrictIcon(label) {
            const activeClass = label.code === customerDistrict ? " active" : "";
            return L.divIcon({
              className: "",
              html: '<div class="district-label' + activeClass + '">' + safeText(label.code) + '<small>' + safeText(label.name) + '</small></div>',
              iconSize: [86, 38],
              iconAnchor: [43, 19]
            });
          }

          districtLabels.forEach(function(label) {
            L.marker([label.lat, label.lng], { icon: makeDistrictIcon(label), interactive: false, keyboard: false }).addTo(map);
          });

          if (mapData.customer) {
            const customerLatLng = [mapData.customer.latitude, mapData.customer.longitude];

            L.marker(customerLatLng, { icon: makePinIcon("C", "marker-customer") })
              .addTo(map)
              .bindPopup("<strong>Customer</strong><br>" + safeText(mapData.customer.postcode) + "<br>District: " + safeText(mapData.customer.district) + "<br>Precision: " + safeText(mapData.customer.precision))
              .openPopup();

            L.circle(customerLatLng, {
              radius: mapData.customer.precision === "Exact" ? 1800 : 4500,
              color: "#dc2626",
              dashArray: "8 8",
              fillColor: "#f97316",
              fillOpacity: 0.10,
              weight: 2
            }).addTo(map);
          }

          const bounds = [];
          if (mapData.customer) bounds.push([mapData.customer.latitude, mapData.customer.longitude]);

          mapData.technicians.forEach(function(tech) {
            const latLng = [tech.latitude, tech.longitude];
            bounds.push(latLng);

            const distanceText = tech.distance === null ? "Distance unavailable" : tech.distance + " miles";
            const etaText = tech.distance === null ? "Check ETA" : Math.max(12, Math.round(tech.distance * 3)) + " mins estimate";

            const popupHtml =
              "<strong>#" + safeText(tech.rank) + " " + safeText(tech.name) + "</strong><br>" +
              safeText(tech.phone) + "<br><br>" +
              "<strong>Status:</strong> " + safeText(tech.status) + "<br>" +
              "<strong>Priority:</strong> " + safeText(tech.priority) + "<br>" +
              "<strong>Available:</strong> " + safeText(tech.availableFrom) + "<br>" +
              "<strong>Postcode:</strong> " + safeText(tech.locationPostcode) + "<br>" +
              "<strong>Distance:</strong> " + safeText(distanceText) + "<br>" +
              "<strong>ETA:</strong> " + safeText(etaText) + "<br>" +
              "<strong>Skills:</strong> " + safeText(tech.skills) + "<br>" +
              "<strong>Notes:</strong> " + safeText(tech.notes);

            L.marker(latLng, { icon: makePinIcon(tech.rank, markerClassForStatus(tech.status)) })
              .addTo(map)
              .bindPopup(popupHtml);
          });

          if (bounds.length > 1) {
            map.fitBounds(bounds, { padding: [50, 50], maxZoom: 11 });
          }
        </script>
      </body>
      </html>
    `);
  } catch (error) {
    console.error("Dispatch page error:", error);
    res.status(500).send(`Dispatch page error: ${escapeHtml(error.message)}. Check Render logs.`);
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
    .job-scheduled { background:#7c3aed; color:white; }
    .job-closed, .job-fully-paid { background:var(--red); color:white; }
    .job-awaiting-payment, .job-awaiting-balance { background:var(--amber); color:#111827; }
    .job-invoiced-account, .job-sent-to-pm { background:var(--pink); color:white; }
    .job-disputed { background:#f97316; color:white; }
    .job-cancelled-before-arrival { background:#6b7280; color:white; }
    .job-cancelled-onsite { background:#4b5563; color:white; }
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
    <body>${bodyHtml}
      <script>
        function updateStripeGrossBreakdownForInput(input) {
          if (!input || !input.form) return;
          const box = input.form.querySelector('.vat-preview');
          if (!box) return;
          const gross = Number(String(input.value || '').replace(/[^0-9.-]/g, ''));
          if (!Number.isFinite(gross) || gross <= 0) { box.textContent = 'Enter the gross amount to see NET and VAT.'; return; }
          const grossPence = Math.round(gross * 100);
          const netPence = Math.round(grossPence / 1.2);
          const vatPence = grossPence - netPence;
          box.textContent = 'NET £' + (netPence / 100).toFixed(2) + ' · VAT @ 20% £' + (vatPence / 100).toFixed(2) + ' · GROSS £' + (grossPence / 100).toFixed(2);
        }
      </script>
    </body>
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

function technicianWorkspaceTabs(token, active, disputeCount = 0) {
  const disputeLabel = disputeCount > 0 ? `Disputes (${disputeCount})` : "Disputes";
  return `
    <div class="tabs">
      <a class="tab ${active === 'jobs' ? 'active' : ''}" href="/tech-workspace/${escapeHtml(token)}">Active jobs</a>
      <a class="tab ${active === 'disputes' ? 'active' : ''}" href="/tech-workspace/${escapeHtml(token)}/disputes">${escapeHtml(disputeLabel)}</a>
      <a class="tab ${active === 'summary' ? 'active' : ''}" href="/tech-workspace/${escapeHtml(token)}/summary">Income summary</a>
      <a class="tab" href="/tech-checkin/${escapeHtml(token)}">Status check-in</a>
      <a class="tab" href="/tech-workspace/${escapeHtml(token)}/logout">Lock dashboard</a>
    </div>
  `;
}


async function ensureTechnicianWorkspaceSchema() {
  await pool.query(`ALTER TABLE technicians ADD COLUMN IF NOT EXISTS checkin_token TEXT;`);
  await pool.query(`ALTER TABLE technicians ADD COLUMN IF NOT EXISTS technician_pin TEXT;`);
  await pool.query(`ALTER TABLE technicians ADD COLUMN IF NOT EXISTS return_to_work_date DATE;`);
  const techPinRows = (await pool.query(`SELECT id FROM technicians WHERE technician_pin IS NULL OR technician_pin = ''`)).rows;
  for (const row of techPinRows) {
    await pool.query(`UPDATE technicians SET technician_pin = $1 WHERE id = $2`, [makeTechnicianPin(), row.id]);
  }
  await pool.query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS assigned_technician_id INTEGER;`);
  await pool.query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS onsite_at TIMESTAMP;`);
  await pool.query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS tech_updated_at TIMESTAMP;`);
  await pool.query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS tech_close_submitted_by TEXT;`);
  await pool.query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS net_value NUMERIC(10,2);`);
  await pool.query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS vat_amount NUMERIC(10,2);`);
  await pool.query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS final_value NUMERIC(10,2);`);
  await pool.query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS payment_method TEXT;`);
  await pool.query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS payment_method_1 TEXT;`);
  await pool.query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS payment_amount_1 NUMERIC(10,2);`);
  await pool.query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS payment_method_2 TEXT;`);
  await pool.query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS payment_amount_2 NUMERIC(10,2);`);
  await pool.query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS invoice_photos_confirmed BOOLEAN DEFAULT FALSE;`);
  await pool.query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS card_is_amex BOOLEAN DEFAULT FALSE;`);
  await pool.query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS amex_id_provided BOOLEAN DEFAULT FALSE;`);
  await pool.query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS customer_paid BOOLEAN DEFAULT FALSE;`);
  await pool.query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS materials_used TEXT;`);
  await pool.query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS materials_cost NUMERIC(10,2);`);
  await pool.query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS outcome TEXT;`);
  await pool.query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS tech_notes TEXT;`);
  await pool.query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS closed_by TEXT;`);
  await pool.query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS closed_at TIMESTAMP;`);
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
      resolved_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);
}

async function getTechnicianByToken(token) {
  const result = await pool.query(`SELECT * FROM technicians WHERE checkin_token = $1 AND active = TRUE`, [token]);
  return result.rows[0];
}

async function getTechnicianByPin(pin) {
  const cleanedPin = String(pin || '').replace(/\D/g, '');
  if (!cleanedPin) return null;
  const result = await pool.query(`SELECT * FROM technicians WHERE technician_pin = $1 AND active = TRUE ORDER BY id ASC LIMIT 1`, [cleanedPin]);
  return result.rows[0];
}

function makeTechnicianPin() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

function makeTechnicianSessionCookie(token) {
  const payload = Buffer.from(JSON.stringify({ token, createdAt: Date.now() })).toString("base64url");
  return `${payload}.${signValue(payload)}`;
}

function readTechnicianSession(req, token) {
  const raw = parseCookies(req).tech_workspace_session;
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
    if (!decoded.token || decoded.token !== token) return null;
    const maxAgeMs = 1000 * 60 * 60 * 24 * 30;
    if (!decoded.createdAt || Date.now() - decoded.createdAt > maxAgeMs) return null;
    return decoded;
  } catch (error) {
    return null;
  }
}

function setTechnicianSessionCookie(res, token) {
  const cookieValue = makeTechnicianSessionCookie(token);
  res.setHeader(
    "Set-Cookie",
    `tech_workspace_session=${encodeURIComponent(cookieValue)}; HttpOnly; SameSite=Lax; Secure; Path=/; Max-Age=${60 * 60 * 24 * 30}`
  );
}

function clearTechnicianSessionCookie(res) {
  res.setHeader("Set-Cookie", "tech_workspace_session=; HttpOnly; SameSite=Lax; Secure; Path=/; Max-Age=0");
}

function isTechnicianWorkspaceLoggedIn(req, token) {
  return !!readTechnicianSession(req, token);
}

function technicianLoginPage(token, tech, errorMessage = "") {
  return technicianPortalShell('Technician PIN required', `
    <div class="wrap" style="max-width:520px;margin:40px auto;">
      <div class="panel">
        <h1>Technician secure access</h1>
        <p class="job-sub">This dashboard is locked to the intended technician. Enter your private 4-digit PIN to view jobs, disputes and income summary.</p>
        ${errorMessage ? `<div class="empty" style="border-left:6px solid #dc2626;">${escapeHtml(errorMessage)}</div>` : ''}
        <form method="POST" action="/tech-workspace/${escapeHtml(token)}/login">
          <label>Technician</label>
          <input value="${escapeHtml(tech.name || 'Technician')}" readonly>
          <br><br>
          <label>Private PIN</label>
          <input name="pin" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" placeholder="4-digit PIN" required autofocus>
          <br><br>
          <button class="button red" type="submit">Unlock my dashboard</button>
        </form>
      </div>
    </div>
  `);
}

function universalTechnicianLoginPage(errorMessage = "") {
  return technicianPortalShell('Technician PIN required', `
    <div class="wrap" style="max-width:520px;margin:40px auto;">
      <div class="panel">
        <h1>Technician secure access</h1>
        <p class="job-sub">Use the universal technician workspace link and enter your private 4-digit PIN. Your PIN opens only your own dashboard.</p>
        ${errorMessage ? `<div class="empty" style="border-left:6px solid #dc2626;">${escapeHtml(errorMessage)}</div>` : ''}
        <form method="POST" action="/tech-workspace/login">
          <label>Private PIN</label>
          <input name="pin" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" placeholder="4-digit PIN" required autofocus>
          <br><br>
          <button class="button red" type="submit">Unlock my dashboard</button>
        </form>
      </div>
    </div>
  `);
}

async function getOpenDisputesForTechnician(tech) {
  const result = await pool.query(`
    SELECT
      d.*,
      j.job_number,
      j.postcode,
      j.job_type,
      j.customer_name AS job_customer_name,
      j.customer_phone AS job_customer_phone,
      j.address_line_1,
      j.address_line_2,
      j.address_line_3,
      j.town,
      j.county,
      j.status AS job_status,
      j.final_value,
      j.materials_used,
      j.materials_cost
    FROM disputes d
    LEFT JOIN jobs j ON j.id = d.job_id
    WHERE (
      d.technician_id = $1
      OR d.technician_id IN (SELECT id FROM technicians WHERE LOWER(name) = LOWER($2))
      OR j.assigned_technician_id = $1
      OR j.assigned_technician_id IN (SELECT id FROM technicians WHERE LOWER(name) = LOWER($2))
    )
    AND COALESCE(d.status, 'open_dispute') NOT IN ('resolved', 'rejected', 'refund_processed')
    ORDER BY d.updated_at DESC, d.created_at DESC
  `, [tech.id, tech.name]);
  return result.rows;
}


app.get('/tech-workspace', async (req, res) => {
  try {
    await ensureTechnicianWorkspaceSchema();
    const raw = parseCookies(req).tech_workspace_session;
    if (raw && raw.includes('.')) {
      const [payload, signature] = raw.split('.');
      const expected = signValue(payload);
      try {
        if (crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
          const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
          if (decoded.token) {
            const tech = await getTechnicianByToken(decoded.token);
            if (tech) return res.redirect(`/tech-workspace/${encodeURIComponent(decoded.token)}`);
          }
        }
      } catch (error) {
        // Invalid or old cookie. Show the PIN screen.
      }
    }
    res.send(universalTechnicianLoginPage());
  } catch (error) {
    console.error('Universal technician workspace error:', error);
    res.status(500).send('Technician workspace error. Check Render logs.');
  }
});

app.post('/tech-workspace/login', async (req, res) => {
  try {
    await ensureTechnicianWorkspaceSchema();
    const enteredPin = String(req.body.pin || '').replace(/\D/g, '');
    const tech = await getTechnicianByPin(enteredPin);
    if (!tech || !tech.checkin_token) {
      return res.status(403).send(universalTechnicianLoginPage('Incorrect PIN. Please check the private PIN issued by the office.'));
    }
    setTechnicianSessionCookie(res, tech.checkin_token);
    res.redirect(`/tech-workspace/${encodeURIComponent(tech.checkin_token)}`);
  } catch (error) {
    console.error('Universal technician PIN login error:', error);
    res.status(500).send('Technician PIN login error. Check Render logs.');
  }
});

app.post('/tech-workspace/:token/login', async (req, res) => {
  try {
    await ensureTechnicianWorkspaceSchema();
    const token = req.params.token;
    const tech = await getTechnicianByToken(token);
    if (!tech) return res.status(404).send(technicianPortalShell('Invalid technician link', `<div class="wrap"><div class="empty">Invalid technician workspace link.</div></div>`));
    const enteredPin = String(req.body.pin || '').replace(/\D/g, '');
    const storedPin = String(tech.technician_pin || '').replace(/\D/g, '');
    if (!storedPin || enteredPin !== storedPin) {
      return res.status(403).send(technicianLoginPage(token, tech, 'Incorrect PIN. Please check the private PIN issued by the office.'));
    }
    setTechnicianSessionCookie(res, token);
    res.redirect(`/tech-workspace/${encodeURIComponent(token)}`);
  } catch (error) {
    console.error('Technician PIN login error:', error);
    res.status(500).send('Technician PIN login error. Check Render logs.');
  }
});

app.get('/tech-workspace/:token/logout', async (req, res) => {
  clearTechnicianSessionCookie(res);
  res.redirect(`/tech-workspace/${encodeURIComponent(req.params.token)}`);
});

app.get('/tech-workspace/:token', async (req, res) => {
  try {
    await ensureTechnicianWorkspaceSchema();
    const token = req.params.token;
    const tech = await getTechnicianByToken(token);
    if (!tech) return res.status(404).send(technicianPortalShell('Invalid technician link', `<div class="wrap"><div class="empty">Invalid technician workspace link.</div></div>`));
    if (!isTechnicianWorkspaceLoggedIn(req, token)) return res.send(technicianLoginPage(token, tech));

    const statusFilter = (req.query.status || '').trim();
    const postcode = (req.query.postcode || '').trim();
    const phone = (req.query.phone || '').trim();

    // Match by this technician ID, and also by any duplicate technician record with the same name.
    // This protects us if a technician was added twice or a job was assigned to an older Ruben/Michele/etc record.
    const values = [tech.id, tech.name];
    let where = `WHERE (j.assigned_technician_id = $1 OR j.assigned_technician_id IN (SELECT id FROM technicians WHERE LOWER(name) = LOWER($2))) AND COALESCE(j.status, 'open') NOT IN ('closed', 'invoiced_account', 'fully_paid', 'sent_to_pm', 'awaiting_balance', 'awaiting_payment', 'disputed', 'cancelled_by_client_before_arrival', 'cancelled_onsite')`;
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

    const technicianStripeLinksByJob = new Map();
    if (jobs.length) {
      const stripeRows = (await pool.query(`
        SELECT *
        FROM job_payment_links
        WHERE job_id = ANY($1::int[])
        ORDER BY created_at DESC, id DESC
      `, [jobs.map(job => Number(job.id))])).rows;
      for (const row of stripeRows) {
        const key = Number(row.job_id);
        if (!technicianStripeLinksByJob.has(key)) technicianStripeLinksByJob.set(key, []);
        technicianStripeLinksByJob.get(key).push(row);
      }
    }

    const openDisputes = await getOpenDisputesForTechnician(tech);
    const disputeNotice = openDisputes.length ? `
      <div class="panel" style="border-left:6px solid #f97316;background:#fff7ed;">
        <h2 style="margin-top:0;">Dispute alert</h2>
        <p><strong>${openDisputes.length} open dispute${openDisputes.length === 1 ? '' : 's'}</strong> currently linked to your name. Please review before taking further related work.</p>
        <a class="button orange" href="/tech-workspace/${escapeHtml(token)}/disputes">View disputes</a>
      </div>
    ` : "";

    const today = new Date();
    const greeting = today.getHours() < 12 ? 'Good morning' : today.getHours() < 17 ? 'Good afternoon' : 'Good evening';
    const briefingLines = [
      `<div class="brief-line red"><strong>${jobs.length} active job${jobs.length === 1 ? '' : 's'}</strong> assigned to you.</div>`,
      openDisputes.length ? `<div class="brief-line red"><strong>${openDisputes.length} open dispute${openDisputes.length === 1 ? '' : 's'}</strong> linked to your name.</div>` : "",
      `<div class="brief-line">Remember to press <strong>On site</strong> when you arrive.</div>`,
      `<div class="brief-line green">Close jobs with final value, payment method and materials used.</div>`
    ].join('');

    const jobCards = jobs.map(job => `
      <div class="job-card" id="job-${job.id}">
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
          <a class="button red" href="/tech-workspace/${escapeHtml(token)}/job/${job.id}/close">Close job</a>
        </div>
        ${renderTechnicianStripePaymentArea(job, token, technicianStripeLinksByJob.get(Number(job.id)) || [])}
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
        ${technicianWorkspaceTabs(token, 'jobs', openDisputes.length)}
        ${disputeNotice}
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

app.post('/tech-workspace/:token/job/:id/stripe-link', async (req, res) => {
  const token = req.params.token;
  const id = Number(req.params.id);
  const client = await pool.connect();

  try {
    await ensureTechnicianWorkspaceSchema();
    const tech = await getTechnicianByToken(token);
    if (!tech) return res.status(404).send('Invalid technician link');
    if (!isTechnicianWorkspaceLoggedIn(req, token)) return res.redirect(`/tech-workspace/${encodeURIComponent(token)}`);

    const jobResult = await client.query(`
      SELECT j.*
      FROM jobs j
      WHERE j.id = $1
        AND (
          j.assigned_technician_id = $2
          OR j.assigned_technician_id IN (
            SELECT id FROM technicians WHERE LOWER(name) = LOWER($3)
          )
        )
    `, [id, tech.id, tech.name]);

    if (!jobResult.rows.length) return res.status(403).send('This job is not assigned to your technician account.');
    const job = jobResult.rows[0];

    const amount = parseMoneyInput(req.body.amount);
    const reason = String(req.body.reason || `Locksmith services${job.postcode ? ` (${job.postcode})` : ""}`).trim().slice(0, 180);

    if (!amount || amount <= 0) return res.status(400).send('Stripe amount must be greater than zero.');
    if (amount > 999999.99) return res.status(400).send('Stripe amount is too large. Please check the amount entered.');

    const configError = stripeConfigurationError();
    if (configError) return res.status(400).send(`Stripe is not ready: ${escapeHtml(configError)}`);

    const unitAmount = Math.round(amount * 100);
    const ref = job.job_number || jobNumber(job.id);
    const createdBy = `${tech.name} workspace`;

    const form = new URLSearchParams();
    form.append('line_items[0][quantity]', '1');
    form.append('line_items[0][price_data][currency]', 'gbp');
    form.append('line_items[0][price_data][unit_amount]', String(unitAmount));
    form.append('line_items[0][price_data][product_data][name]', `24H Locksmiths payment ${ref}`);
    form.append('line_items[0][price_data][product_data][description]', reason.slice(0, 240));
    form.append('metadata[job_id]', String(job.id));
    form.append('metadata[job_number]', ref);
    form.append('metadata[postcode]', job.postcode || '');
    form.append('metadata[created_by]', createdBy);
    const stripeBreakdown = stripeVatBreakdown(amount);
    form.append('metadata[gross_amount]', stripeBreakdown.gross.toFixed(2));
    form.append('metadata[net_amount]', stripeBreakdown.net.toFixed(2));
    form.append('metadata[vat_amount]', stripeBreakdown.vat.toFixed(2));
    form.append('metadata[vat_rate]', '20%');
    form.append('payment_method_types[0]', 'card');

    const stripeResult = await stripeApiFormRequest('/v1/payment_links', form);
    const paymentLink = stripeResult.json || {};
    if (!paymentLink.url) throw new Error('Stripe did not return a payment link URL.');

    let paymentLinkRowId = null;
    let invoiceRecord = null;
    await client.query('BEGIN');
    try {
      const linkInsert = await client.query(`
        INSERT INTO job_payment_links (
          job_id, provider, amount, currency, reason, payment_url,
          provider_session_id, status, stripe_mode, provider_response,
          created_by, created_at
        )
        VALUES ($1, 'stripe', $2, 'gbp', $3, $4, $5, 'created', $6, $7, $8, NOW())
        RETURNING id
      `, [
        id,
        amount,
        reason,
        paymentLink.url,
        paymentLink.id || '',
        stripeModeLabel(),
        JSON.stringify({ id: paymentLink.id, url: paymentLink.url, active: paymentLink.active }).slice(0, 1600),
        createdBy
      ]);
      paymentLinkRowId = linkInsert.rows[0].id;
      invoiceRecord = await createStripeInvoiceForJob(client, {
        job,
        grossAmount: amount,
        reason,
        createdBy,
        locksmithName: tech.name,
        paymentLinkId: paymentLinkRowId
      });
      await client.query(`UPDATE job_payment_links SET invoice_id = $1 WHERE id = $2`, [invoiceRecord.id, paymentLinkRowId]);
      await client.query('COMMIT');
    } catch (dbError) {
      await client.query('ROLLBACK');
      try {
        if (paymentLink.id) {
          const deactivate = new URLSearchParams();
          deactivate.append('active', 'false');
          await stripeApiFormRequest(`/v1/payment_links/${paymentLink.id}`, deactivate);
        }
      } catch (deactivateError) {
        console.error('Could not deactivate orphan technician Stripe link after invoice/database failure:', deactivateError);
      }
      throw dbError;
    }

    try {
      await addJobAuditEntry(
        id,
        'stripe_invoice_link_created',
        'Invoice + Stripe payment link',
        '—',
        `${invoiceRecord.invoice_number} · GROSS ${money(amount)} · NET ${money(invoiceRecord.net)} · VAT ${money(invoiceRecord.vat)} · ${reason}`,
        createdBy
      );
    } catch (auditError) {
      console.error('Technician Stripe invoice/link audit error:', auditError);
    }

    res.redirect(`/tech-workspace/${encodeURIComponent(token)}#job-${id}`);
  } catch (error) {
    console.error('Technician Stripe payment link error:', error);
    res.status(500).send(`Stripe payment link error: ${escapeHtml(error.message || String(error))}. Check Render logs.`);
  } finally {
    client.release();
  }
});

app.post('/tech-workspace/:token/job/:id/stripe-link/:linkId/send-sms', async (req, res) => {
  const token = req.params.token;
  const id = Number(req.params.id);
  const linkId = Number(req.params.linkId);

  try {
    await ensureTechnicianWorkspaceSchema();
    const tech = await getTechnicianByToken(token);
    if (!tech) return res.status(404).send('Invalid technician link');
    if (!isTechnicianWorkspaceLoggedIn(req, token)) return res.redirect(`/tech-workspace/${encodeURIComponent(token)}`);

    const jobResult = await pool.query(`
      SELECT j.*
      FROM jobs j
      WHERE j.id = $1
        AND (
          j.assigned_technician_id = $2
          OR j.assigned_technician_id IN (
            SELECT id FROM technicians WHERE LOWER(name) = LOWER($3)
          )
        )
    `, [id, tech.id, tech.name]);

    if (!jobResult.rows.length) return res.status(403).send('This job is not assigned to your technician account.');
    const job = jobResult.rows[0];

    const linkResult = await pool.query(
      `SELECT * FROM job_payment_links WHERE id = $1 AND job_id = $2`,
      [linkId, id]
    );
    if (!linkResult.rows.length) return res.status(404).send('Payment link not found');
    const link = linkResult.rows[0];

    const to = cleanSmsNumber(job.customer_phone);
    if (!to) return res.status(400).send('Customer phone number is missing.');

    const message = buildStripePaymentSms(job, link);
    let status = 'sent';
    let providerResponse = '';

    try {
      const sendResult = await sendYaySms(to, message, `${job.job_number || jobNumber(job.id)} - Stripe payment link`);
      status = sendResult.status;
      providerResponse = sendResult.providerResponse;
    } catch (sendError) {
      status = 'failed';
      providerResponse = sendError.message;
      console.error('Technician Stripe payment SMS error:', sendError);
    }

    const sentBy = `${tech.name} workspace`;

    await pool.query(`
      INSERT INTO job_sms_log (
        job_id, sent_to, sms_type, template_name, message_body,
        status, provider, provider_response, sent_by, created_at
      )
      VALUES ($1, $2, 'stripe_payment_link', 'Stripe payment link', $3, $4, 'yay', $5, $6, NOW())
    `, [id, to, message, status, providerResponse, sentBy]);

    await pool.query(`
      UPDATE job_payment_links
      SET sent_at = NOW(),
          sent_by = $1,
          status = CASE WHEN $2 = 'failed' THEN 'sms_failed' ELSE 'sms_sent' END
      WHERE id = $3 AND job_id = $4
    `, [sentBy, status, linkId, id]);

    await addJobAuditEntry(
      id,
      'stripe_link_sms_sent',
      'Stripe payment SMS',
      '—',
      `${money(link.amount)} link to ${to}: ${status}`,
      sentBy
    );

    res.redirect(`/tech-workspace/${encodeURIComponent(token)}#job-${id}`);
  } catch (error) {
    console.error('Technician Stripe payment SMS route error:', error);
    res.status(500).send('Could not send Stripe payment SMS. Check Render logs.');
  }
});

app.post('/tech-workspace/:token/job/:id/onsite', async (req, res) => {
  try {
    await ensureTechnicianWorkspaceSchema();
    const token = req.params.token;
    const tech = await getTechnicianByToken(token);
    if (!tech) return res.status(404).send('Invalid technician link');
    if (!isTechnicianWorkspaceLoggedIn(req, token)) return res.redirect(`/tech-workspace/${encodeURIComponent(token)}`);

    const oldJob = (await pool.query(`SELECT * FROM jobs WHERE id = $1`, [req.params.id])).rows[0];
    await pool.query(`
      UPDATE jobs
      SET status = 'assigned', onsite_at = NOW(), tech_updated_at = NOW(), updated_at = NOW()
      WHERE id = $1
        AND (assigned_technician_id = $2 OR assigned_technician_id IN (SELECT id FROM technicians WHERE LOWER(name) = LOWER($3)))
    `, [req.params.id, tech.id, tech.name]);
    await logJobChanges(Number(req.params.id), oldJob, { status: "assigned", onsite_at: new Date() }, `${tech.name} workspace`, "technician_on_site");

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
    if (!isTechnicianWorkspaceLoggedIn(req, token)) return res.send(technicianLoginPage(token, tech));

    const result = await pool.query(`
      SELECT * FROM jobs
      WHERE id = $1
        AND (assigned_technician_id = $2 OR assigned_technician_id IN (SELECT id FROM technicians WHERE LOWER(name) = LOWER($3)))
    `, [req.params.id, tech.id, tech.name]);
    const job = result.rows[0];
    if (!job) return res.status(404).send(technicianPortalShell('Job not found', `<div class="wrap"><div class="empty">Job not found for this technician.</div></div>`));
    const openDisputeCount = (await getOpenDisputesForTechnician(tech)).length;

    const body = `
      <div class="topbar">
        <div class="brand"><span class="brand-badge">24H</span><span>${escapeHtml(tech.name)}</span></div>
        <a class="button dark" href="/tech-workspace/${escapeHtml(token)}">Back to jobs</a>
      </div>
      <div class="wrap">
        ${technicianWorkspaceTabs(token, 'jobs', openDisputeCount)}
        <div class="panel">
          <h1>Close job</h1>
          <p class="job-sub"><strong>${escapeHtml(job.postcode || job.job_number || 'Job')}</strong> · ${escapeHtml(job.job_type || '')} · ${escapeHtml(job.customer_name || '')}</p>
          <p class="job-sub">${escapeHtml(techJobAddress(job) || '')}</p>
          <form method="POST" action="/tech-workspace/${escapeHtml(token)}/job/${job.id}/close" onsubmit="return confirm('Have you closed it correctly, with the NET value?');">
            <p class="job-sub">Enter the NET value only. VAT is calculated automatically at 20%.</p>
            <div class="field-grid">
              <div><label>NET job value</label><input id="techNetValue" name="net_value" value="${job.net_value !== null && job.net_value !== undefined ? Number(job.net_value).toFixed(2) : (job.final_value !== null && job.final_value !== undefined ? (Number(job.final_value) / 1.2).toFixed(2) : '')}" inputmode="decimal" placeholder="£ ex VAT" required></div>
              <div><label>UK VAT 20%</label><input id="techVatValue" value="" readonly></div>
              <div><label>Full value inc VAT</label><input id="techGrossValue" value="" readonly></div>
              <div><label>Customer paid?</label><select name="customer_paid"><option value="true" ${job.customer_paid ? 'selected' : ''}>Yes</option><option value="false" ${!job.customer_paid ? 'selected' : ''}>No</option></select></div>
              <div><label>Payment method 1</label><select id="techPaymentMethod1" name="payment_method_1" onchange="toggleTechClosePaymentRules()"><option value="">Select method</option>${optionList(splitPaymentMethods, job.payment_method_1 || job.payment_method || job.expected_payment_method || '')}</select></div>
              <div><label>Payment amount 1</label><input name="payment_amount_1" value="${job.payment_amount_1 !== null && job.payment_amount_1 !== undefined ? Number(job.payment_amount_1).toFixed(2) : (job.final_value !== null && job.final_value !== undefined ? Number(job.final_value).toFixed(2) : '')}" inputmode="decimal" placeholder="£"></div>
              <div><label>Payment method 2 / split payment</label><select id="techPaymentMethod2" name="payment_method_2" onchange="toggleTechClosePaymentRules()"><option value="">No split payment</option>${optionList(splitPaymentMethods, job.payment_method_2 || '')}</select></div>
              <div><label>Payment amount 2</label><input name="payment_amount_2" value="${job.payment_amount_2 !== null && job.payment_amount_2 !== undefined ? Number(job.payment_amount_2).toFixed(2) : ''}" inputmode="decimal" placeholder="£"></div>
              <div><label>Final close status</label><select name="status">${literalClosingStatusOptions(job.status || (job.customer_paid ? 'fully_paid' : 'awaiting_payment'))}</select></div>
              <div><label>Materials cost</label><input name="materials_cost" value="${job.materials_cost !== null && job.materials_cost !== undefined ? Number(job.materials_cost).toFixed(2) : ''}" inputmode="decimal" placeholder="£"></div>
              <div><label>Outcome</label><select name="outcome">${optionList(jobOutcomes, job.outcome || 'Completed')}</select></div>
            </div>
            <div id="techInvoicePhotosBox" class="panel" style="margin-top:14px; display:none; background:#0f172a; color:white;">
              <label>The correct invoice has been used and completed, photos are also on file</label>
              <select name="invoice_photos_confirmed"><option value="false" ${!job.invoice_photos_confirmed ? 'selected' : ''}>No</option><option value="true" ${job.invoice_photos_confirmed ? 'selected' : ''}>Yes</option></select>
            </div>
            <div id="techCardRulesBox" class="panel" style="margin-top:14px; display:none; background:#0f172a; color:white;">
              <div class="field-grid">
                <div><label>Was this card payment AMEX?</label><select id="techCardIsAmex" name="card_is_amex" onchange="toggleTechClosePaymentRules()"><option value="false" ${!job.card_is_amex ? 'selected' : ''}>No</option><option value="true" ${job.card_is_amex ? 'selected' : ''}>Yes</option></select></div>
                <div id="techAmexIdBox" style="display:none;"><label>AMEX ID from client provided?</label><select name="amex_id_provided"><option value="false" ${!job.amex_id_provided ? 'selected' : ''}>No</option><option value="true" ${job.amex_id_provided ? 'selected' : ''}>Yes</option></select></div>
              </div>
            </div>
            <div class="field-grid" style="margin-top:14px;">
              <div class="full"><label>Materials used</label><textarea name="materials_used" placeholder="e.g. Euro cylinder, night latch, screws">${escapeHtml(job.materials_used || '')}</textarea></div>
              <div class="full"><label>Technician notes</label><textarea name="tech_notes" placeholder="Any notes for the office">${escapeHtml(job.tech_notes || '')}</textarea></div>
              <div class="full"><label>Close notes</label><textarea name="close_notes" placeholder="Anything the office should know">${escapeHtml(job.close_notes || '')}</textarea></div>
            </div>
            <div class="panel" style="margin-top:14px; background:#f8fafc; color:#111827;">
              <h3 style="margin-top:0;">Job documents / evidence</h3>
              <p class="job-sub">The office will file photos, invoices and proof in Dropbox after the job. Please send any job photos/evidence to the office in the usual way.</p>
            </div>
            <br>
            <button class="button red" type="submit">Submit close job</button>
          </form>
          <script>
            function recalcTechCloseValues(){
              const netInput = document.getElementById('techNetValue');
              const vatInput = document.getElementById('techVatValue');
              const grossInput = document.getElementById('techGrossValue');
              const net = Number(String(netInput.value || '').replace(/[^0-9.-]/g, '')) || 0;
              const vat = Math.round(net * 0.20 * 100) / 100;
              const gross = Math.round((net + vat) * 100) / 100;
              vatInput.value = '£' + vat.toFixed(2);
              grossInput.value = '£' + gross.toFixed(2);
            }
            function selectedTechPaymentMethods(){
              return [document.getElementById('techPaymentMethod1')?.value || '', document.getElementById('techPaymentMethod2')?.value || ''].map(v => v.toLowerCase());
            }
            function toggleTechClosePaymentRules(){
              const methods = selectedTechPaymentMethods();
              const hasCard = methods.some(v => v.includes('card'));
              const hasBankOrCard = hasCard || methods.some(v => v.includes('bank transfer'));
              document.getElementById('techInvoicePhotosBox').style.display = hasBankOrCard ? 'block' : 'none';
              document.getElementById('techCardRulesBox').style.display = hasCard ? 'block' : 'none';
              const isAmex = document.getElementById('techCardIsAmex')?.value === 'true';
              document.getElementById('techAmexIdBox').style.display = hasCard && isAmex ? 'block' : 'none';
            }
            document.getElementById('techNetValue').addEventListener('input', recalcTechCloseValues);
            recalcTechCloseValues();
            toggleTechClosePaymentRules();
          </script>
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
    if (!isTechnicianWorkspaceLoggedIn(req, token)) return res.redirect(`/tech-workspace/${encodeURIComponent(token)}`);

    const body = req.body;
    const netValue = parseMoneyInput(body.net_value || body.final_value);
    const vatAmount = calculateVatFromNet(netValue);
    const finalValue = calculateGrossFromNet(netValue);
    const includesCard = closePaymentIncludesCard(body);
    const isAmex = includesCard && body.card_is_amex === 'true';
    const amexIdProvided = isAmex && body.amex_id_provided === 'true';
    if (isAmex && !amexIdProvided) {
      return res.status(400).send('AMEX payment selected. Please confirm that ID from the client has been provided.');
    }
    const selectedStatus = closingJobStatuses.some(item => item.value === body.status) ? body.status : 'fully_paid';
    const oldJob = (await pool.query(`SELECT * FROM jobs WHERE id = $1`, [req.params.id])).rows[0];
    const techCloseValues = {
      net_value: netValue,
      vat_amount: vatAmount,
      final_value: finalValue,
      payment_method: buildSplitPaymentSummary(body),
      payment_method_1: body.payment_method_1 || '',
      payment_amount_1: parseMoneyInput(body.payment_amount_1),
      payment_method_2: body.payment_method_2 || '',
      payment_amount_2: parseMoneyInput(body.payment_amount_2),
      invoice_photos_confirmed: closePaymentRequiresInvoicePhotos(body) ? body.invoice_photos_confirmed === 'true' : false,
      card_is_amex: isAmex,
      amex_id_provided: amexIdProvided,
      customer_paid: body.customer_paid === 'true',
      materials_used: body.materials_used || '',
      materials_cost: parseMoneyInput(body.materials_cost),
      outcome: body.outcome || '',
      tech_notes: body.tech_notes || '',
      close_notes: body.close_notes || '',
      status: selectedStatus
    };

    await pool.query(`
      UPDATE jobs
      SET net_value = $1,
          vat_amount = $2,
          final_value = $3,
          payment_method = $4,
          payment_method_1 = $5,
          payment_amount_1 = $6,
          payment_method_2 = $7,
          payment_amount_2 = $8,
          invoice_photos_confirmed = $9,
          card_is_amex = $10,
          amex_id_provided = $11,
          customer_paid = $12,
          materials_used = $13,
          materials_cost = $14,
          outcome = $15,
          tech_notes = $16,
          close_notes = $17,
          status = $18,
          closed_by = $19,
          closed_at = COALESCE(closed_at, NOW()),
          tech_updated_at = NOW(),
          tech_close_submitted_by = $19,
          updated_at = NOW()
      WHERE id = $20
        AND (assigned_technician_id = $21 OR assigned_technician_id IN (SELECT id FROM technicians WHERE LOWER(name) = LOWER($22)))
    `, [
      techCloseValues.net_value,
      techCloseValues.vat_amount,
      techCloseValues.final_value,
      techCloseValues.payment_method,
      techCloseValues.payment_method_1,
      techCloseValues.payment_amount_1,
      techCloseValues.payment_method_2,
      techCloseValues.payment_amount_2,
      techCloseValues.invoice_photos_confirmed,
      techCloseValues.card_is_amex,
      techCloseValues.amex_id_provided,
      techCloseValues.customer_paid,
      techCloseValues.materials_used,
      techCloseValues.materials_cost,
      techCloseValues.outcome,
      techCloseValues.tech_notes,
      techCloseValues.close_notes,
      techCloseValues.status,
      tech.name,
      req.params.id,
      tech.id,
      tech.name
    ]);
    await logJobChanges(Number(req.params.id), oldJob, techCloseValues, `${tech.name} workspace`, "technician_close_submit");
    await addJobEvidenceLink(Number(req.params.id), body, `${tech.name} workspace`, "technician_close_evidence_added");

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
    if (!isTechnicianWorkspaceLoggedIn(req, token)) return res.send(technicianLoginPage(token, tech));

    const openDisputeCount = (await getOpenDisputesForTechnician(tech)).length;
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
        ${technicianWorkspaceTabs(token, 'summary', openDisputeCount)}
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

app.get('/tech-workspace/:token/disputes', async (req, res) => {
  try {
    await ensureTechnicianWorkspaceSchema();
    const token = req.params.token;
    const tech = await getTechnicianByToken(token);
    if (!tech) return res.status(404).send(technicianPortalShell('Invalid technician link', `<div class="wrap"><div class="empty">Invalid technician workspace link.</div></div>`));
    if (!isTechnicianWorkspaceLoggedIn(req, token)) return res.send(technicianLoginPage(token, tech));

    const disputes = await getOpenDisputesForTechnician(tech);
    const rows = disputes.map(dispute => `
      <div class="job-card" style="border-left:6px solid #f97316;">
        <div class="job-head">
          <div>
            <h2 class="job-title">${escapeHtml(dispute.postcode || dispute.job_number || `Dispute ${dispute.id}`)}</h2>
            <div class="job-sub">
              <strong>Status:</strong> ${escapeHtml(disputeStatusLabel(dispute.status))}<br>
              <strong>Customer:</strong> ${escapeHtml(dispute.customer_name || dispute.job_customer_name || 'Customer not set')} ${dispute.customer_phone || dispute.job_customer_phone ? `· ${escapeHtml(dispute.customer_phone || dispute.job_customer_phone || '')}` : ''}<br>
              <strong>Job:</strong> ${escapeHtml(dispute.job_type || '')} ${dispute.job_number ? `· ${escapeHtml(dispute.job_number)}` : ''}<br>
              ${techJobAddress(dispute) ? `<strong>Address:</strong> ${escapeHtml(techJobAddress(dispute))}<br>` : ''}
              ${dispute.complaint_type ? `<strong>Type:</strong> ${escapeHtml(dispute.complaint_type)}<br>` : ''}
              ${dispute.disputed_amount ? `<strong>Disputed amount:</strong> ${money(dispute.disputed_amount)}<br>` : ''}
              ${dispute.refund_amount ? `<strong>Refund logged:</strong> ${money(dispute.refund_amount)}<br>` : ''}
              ${dispute.chargeback ? `<strong>Chargeback:</strong> Yes<br>` : ''}
              <strong>Updated:</strong> ${formatDateTime(dispute.updated_at || dispute.created_at)}
            </div>
          </div>
          <span class="pill ${disputeStatusClass(dispute.status)}">${escapeHtml(disputeStatusLabel(dispute.status))}</span>
        </div>
        ${dispute.complaint_summary ? `<div class="panel" style="margin-top:12px;"><strong>Complaint summary</strong><br>${escapeHtml(dispute.complaint_summary).replaceAll('\n', '<br>')}</div>` : ''}
        ${dispute.resolution_notes ? `<div class="panel" style="margin-top:12px;"><strong>Office notes</strong><br>${escapeHtml(dispute.resolution_notes).replaceAll('\n', '<br>')}</div>` : ''}
      </div>
    `).join('');

    const body = `
      <div class="topbar">
        <div class="brand"><span class="brand-badge">24H</span><span>${escapeHtml(tech.name)}</span></div>
        <div class="live">● Disputes</div>
      </div>
      <div class="wrap">
        ${technicianWorkspaceTabs(token, 'disputes', disputes.length)}
        <h1>Disputes linked to your name</h1>
        <div class="panel" style="border-left:6px solid #f97316;background:#fff7ed;">
          <strong>${disputes.length} open dispute${disputes.length === 1 ? '' : 's'}</strong><br>
          <span class="muted">These are dispute records assigned directly to you or linked to jobs currently under your technician name. Resolved and rejected disputes are hidden from this technician view.</span>
        </div>
        ${rows || `<div class="empty"><strong>No open disputes linked to ${escapeHtml(tech.name)}.</strong><br><br>Resolved, rejected and processed refund disputes do not show here.</div>`}
      </div>
    `;

    res.send(technicianPortalShell('Technician Disputes', body));
  } catch (error) {
    console.error('Technician disputes error:', error);
    res.status(500).send('Technician disputes error: ' + escapeHtml(error.message || 'Unknown error') + '. Check Render logs.');
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

    const currentPostcode = compactPostcode(req.body.current_postcode);
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
    await ensureTechnicianWorkspaceSchema();
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
          <td>${escapeHtml(dateInputValue(tech.return_to_work_date) || "—")}</td>
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
            <a href="/tech-checkin/${escapeHtml(tech.checkin_token || "")}" target="_blank">Check-in link</a><br><a href="/tech-workspace" target="_blank">Workspace link</a><div class="audit">PIN: ${escapeHtml(tech.technician_pin || '')}</div>
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
            <input type="date" name="return_to_work_date" title="Return to work date">
            <input name="skills" placeholder="Skills e.g. Lockout, uPVC">
            <button type="submit">Save Technician</button>
            <textarea name="notes" placeholder="Notes"></textarea>
          </form>
        </div>
        <table>
          <thead>
            <tr><th>Name</th><th>Phone</th><th>Base</th><th>Current</th><th>Status</th><th>Priority</th><th>Available From</th><th>Return to Work</th><th>Skills</th><th>Notes</th><th>Last Updated</th><th>GPS Check-In</th><th>Edit / Link</th></tr>
          </thead>
          <tbody>${rows || `<tr><td colspan="13">No technicians added yet</td></tr>`}</tbody>
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
    await ensureTechnicianWorkspaceSchema();
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
          <div class="help">This is the technician's active jobs, close-job and income summary portal. The link now also requires the private PIN below, so another technician cannot open this dashboard from the link alone.</div>
          <br>
          <input class="copy-input" readonly value="${`${req.protocol}://${req.get("host")}/tech-workspace`}">
          <br><br>
          <label>Private workspace PIN</label>
          <input class="copy-input" readonly value="${escapeHtml(tech.technician_pin || '')}">
          <br><br>
          <a href="/tech-workspace" target="_blank">Open technician workspace</a>
        </div>

        <div class="panel">
          <form class="edit" method="POST" action="/technicians/save">
            <input type="hidden" name="id" value="${tech.id}">
            <input name="name" value="${escapeHtml(tech.name)}" placeholder="Name" required>
            <input name="phone" value="${escapeHtml(tech.phone)}" placeholder="Phone">
            <input name="technician_pin" value="${escapeHtml(tech.technician_pin || '')}" placeholder="Workspace PIN e.g. 1234" maxlength="4" inputmode="numeric">
            <input name="base_postcode" value="${escapeHtml(tech.base_postcode)}" placeholder="Base postcode">
            <input name="current_postcode" value="${escapeHtml(tech.current_postcode)}" placeholder="Current postcode">
            <select name="status">${statusOptions}</select>
            <select name="priority">${priorityOptions}</select>
            <input name="available_from" value="${escapeHtml(tech.available_from)}" placeholder="Available from">
            <input type="date" name="return_to_work_date" value="${escapeHtml(dateInputValue(tech.return_to_work_date))}" title="Return to work date">
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
    await ensureTechnicianWorkspaceSchema();
    const { id, name, phone, base_postcode, current_postcode, status, priority, available_from, return_to_work_date, skills, notes } = req.body;
    const technicianPin = String(req.body.technician_pin || '').replace(/\D/g, '').slice(0, 4) || makeTechnicianPin();
    const agentName = currentAgentName(req);

    if (id) {
      await pool.query(`
        UPDATE technicians
        SET name = $1, phone = $2, base_postcode = $3, current_postcode = $4,
            status = $5, priority = $6, available_from = $7, return_to_work_date = $8, skills = $9,
            notes = $10, technician_pin = $11, updated_by = $12, updated_at = NOW()
        WHERE id = $13
      `, [name, compactPhone(phone), compactPostcode(base_postcode), compactPostcode(current_postcode), status, priority || "Normal", available_from, return_to_work_date || null, skills, notes, technicianPin, agentName, id]);
    } else {
      await pool.query(`
        INSERT INTO technicians (
          name, phone, base_postcode, current_postcode, status, priority,
          available_from, return_to_work_date, skills, notes, updated_by, checkin_token, technician_pin, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())
      `, [name, compactPhone(phone), compactPostcode(base_postcode), compactPostcode(current_postcode), status, priority || "Normal", available_from, return_to_work_date || null, skills, notes, agentName, makeCheckinToken(), technicianPin]);
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

    const defaultCustomerName = job ? (job.customer_name || "") : "";
    const defaultPhone = job ? (job.customer_phone || "") : "";
    const defaultEmail = job ? (job.customer_email || "") : "";
    const defaultSiteAddress = job ? jobAddressPlain(job) : "";
    const defaultSitePostcode = job ? (job.postcode || "") : "";
    const defaultDescription = job ? `${job.job_type || "Works"}${job.job_description ? ` - ${job.job_description}` : ""}` : "";

    function lineBlock(i, description = "", price = "") {
      return `
        <div class="line-block">
          <div class="line-grid quote-line-grid">
            <select name="line${i}_item_id" onchange="fillQuoteLine(${i}, this)">
              <option value="">Choose quotation line</option>
              ${itemOptions}
            </select>
            <div class="money-input"><span>£</span><input name="line${i}_price" value="${escapeHtml(price)}" placeholder="0.00"></div>
          </div>
          <input class="description-input" name="line${i}_description" value="${escapeHtml(description)}" placeholder="Description appears on quotation">
        </div>
      `;
    }

    res.send(`
      <html>
      <head>
        <title>Create Quotation</title>
        <style>
          ${sharedStyles()}
          textarea { min-height: 90px; }
          .line-block { margin-bottom: 18px; padding-bottom: 18px; border-bottom: 1px solid #e5e7eb; }
          .quote-line-grid { display: grid; grid-template-columns: 1fr 180px; gap: 12px; margin-bottom: 10px; }
          .description-input { width: 100%; box-sizing: border-box; }
          .account-row { display: grid; grid-template-columns: 2fr 1fr; gap: 15px; align-items: center; }
          @media (max-width: 800px) { .quote-line-grid, .account-row { grid-template-columns: 1fr; } }
        </style>
        <script>
          function fillQuoteLine(number, select) {
            const selected = select.options[select.selectedIndex];
            const description = selected.getAttribute("data-description") || "";
            const price = selected.getAttribute("data-price") || "";
            const descriptionInput = document.querySelector("[name='line" + number + "_description']");
            const priceInput = document.querySelector("[name='line" + number + "_price']");
            if (descriptionInput && description) descriptionInput.value = description;
            if (priceInput && price) priceInput.value = price;
          }

          function fillQuoteTemplate(select) {
            const selected = select.options[select.selectedIndex];
            if (!selected || !selected.value) return;
            document.querySelector("[name='customer_name']").value = selected.getAttribute("data-name") || "";
            document.querySelector("[name='customer_address']").value = selected.getAttribute("data-address") || "";
            document.querySelector("[name='customer_postcode']").value = selected.getAttribute("data-postcode") || "";
          }
        </script>
      </head>
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
              <h2>Account Template / Quote Address</h2>
              <div class="account-row">
                <select name="quote_template_id" onchange="fillQuoteTemplate(this)">
                  <option value="">Normal customer / no template</option>
                  ${templateOptions}
                </select>
                <a href="/invoice-templates">Edit account templates</a>
              </div>
              <br>
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
              <div class="help">Pick a dropdown line, then adjust the description or price if needed. Prices are excluding VAT. The PDF will calculate 20% VAT and show the inc VAT total.</div>
              <br>
              ${lineBlock(1, defaultDescription, job && job.quoted_price ? job.quoted_price : "")}
              ${lineBlock(2)}
              ${lineBlock(3)}
              ${lineBlock(4)}
              ${lineBlock(5)}
              <a href="/invoice-items">Edit quotation dropdown lines</a>
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
      compactPhone(req.body.customer_phone),
      req.body.customer_address,
      compactPostcode(req.body.customer_postcode),
      req.body.site_address,
      compactPostcode(req.body.site_postcode),
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
      compactPhone(req.body.customer_phone),
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


app.post("/stripe/webhook", async (req, res) => {
  try {
    verifyStripeWebhookSignature(req.rawBody, req.headers["stripe-signature"]);
    const event = req.body;
    const result = await processStripeWebhookEvent(event);
    res.status(200).json({ received: true, result });
  } catch (error) {
    console.error("Stripe webhook error:", error);
    res.status(400).send(`Stripe webhook error: ${String(error.message || error)}`);
  }
});

app.post("/jobs/:id/stripe-link/:linkId/check-payment", async (req, res) => {
  const jobId = Number(req.params.id);
  const linkId = Number(req.params.linkId);
  try {
    const link = (await pool.query(`SELECT id, job_id FROM job_payment_links WHERE id=$1 AND job_id=$2`, [linkId, jobId])).rows[0];
    if (!link) return res.status(404).send("Payment link not found.");
    const checkedBy = currentAgentName(req) || "Unknown";
    const result = await syncStripePaymentLink(linkId, `${checkedBy} manual Stripe check`);
    if (!result.paid) await addJobAuditEntry(jobId, "stripe_payment_checked", "Stripe payment check", "—", "No paid Stripe Checkout Session found yet.", checkedBy);
    res.redirect(`/jobs/${jobId}/edit#stripe-card`);
  } catch (error) {
    console.error("Manual Stripe payment check error:", error);
    res.status(500).send(`Could not check Stripe payment: ${escapeHtml(error.message || String(error))}`);
  }
});

app.post('/tech-workspace/:token/job/:id/stripe-link/:linkId/check-payment', async (req, res) => {
  const token = req.params.token;
  const jobId = Number(req.params.id);
  const linkId = Number(req.params.linkId);
  try {
    await ensureTechnicianWorkspaceSchema();
    const tech = await getTechnicianByToken(token);
    if (!tech) return res.status(404).send('Invalid technician link');
    if (!isTechnicianWorkspaceLoggedIn(req, token)) return res.redirect(`/tech-workspace/${encodeURIComponent(token)}`);

    const job = (await pool.query(`
      SELECT id FROM jobs
      WHERE id=$1 AND (assigned_technician_id=$2 OR assigned_technician_id IN (SELECT id FROM technicians WHERE LOWER(name)=LOWER($3)))
    `, [jobId, tech.id, tech.name])).rows[0];
    if (!job) return res.status(403).send('This job is not assigned to your technician account.');

    const link = (await pool.query(`SELECT id FROM job_payment_links WHERE id=$1 AND job_id=$2`, [linkId, jobId])).rows[0];
    if (!link) return res.status(404).send('Payment link not found.');

    const source = `${tech.name} workspace manual Stripe check`;
    const result = await syncStripePaymentLink(linkId, source);
    if (!result.paid) await addJobAuditEntry(jobId, 'stripe_payment_checked', 'Stripe payment check', '—', 'No paid Stripe Checkout Session found yet.', `${tech.name} workspace`);
    res.redirect(`/tech-workspace/${encodeURIComponent(token)}#job-${jobId}`);
  } catch (error) {
    console.error('Technician manual Stripe payment check error:', error);
    res.status(500).send(`Could not check Stripe payment: ${escapeHtml(error.message || String(error))}`);
  }
});



// -----------------------------------------------------------------------------
// Mobile Orders v88 — Create + Close only, with Postcoder address lookup on mobile create, campaign selection, and installable PWA support.
// Uses the same authenticated portal session and the same Postgres jobs table.
// -----------------------------------------------------------------------------

function mobileOrdersStyles() {
  return `
    * { box-sizing: border-box; }
    body.mobile-orders-page { margin:0; background:#f3f6fa; color:#132238; font-family:Arial,Helvetica,sans-serif; }
    .mobile-shell { width:100%; max-width:720px; margin:0 auto; padding:16px 14px 42px; }
    .mobile-top { display:flex; align-items:center; justify-content:space-between; gap:12px; margin:0 0 16px; }
    .mobile-brand-wrap { display:flex; align-items:center; gap:10px; min-width:0; }
    .mobile-brand-icon { width:42px; height:42px; border-radius:12px; background:#fff; border:1px solid #dbe3ec; box-shadow:0 6px 18px rgba(15,23,42,.08); flex:0 0 auto; }
    .mobile-brand { font-size:14px; font-weight:900; letter-spacing:.02em; color:#263646; }
    .mobile-brand-sub { font-size:11px; color:#64748b; margin-top:2px; }
    .mobile-user { font-size:12px; color:#64748b; text-align:right; }
    .mobile-hero { background:#172433; color:#fff; border-radius:22px; padding:22px 20px; box-shadow:0 14px 36px rgba(15,23,42,.12); }
    .mobile-hero h1 { margin:0 0 6px; font-size:26px; line-height:1.08; }
    .mobile-hero p { margin:0; color:#d9e2ec; font-size:14px; line-height:1.45; }
    .mobile-home-actions { display:grid; grid-template-columns:1fr; gap:14px; margin-top:18px; }
    .mobile-big-action { display:block; text-decoration:none; border-radius:20px; padding:24px 20px; font-weight:900; font-size:21px; box-shadow:0 10px 26px rgba(15,23,42,.08); border:1px solid #dbe3ec; }
    .mobile-big-action small { display:block; margin-top:5px; font-weight:600; font-size:12px; opacity:.76; }
    .mobile-big-action.create { background:#16a34a; color:#fff; border-color:#16a34a; }
    .mobile-big-action.close { background:#fff; color:#172433; }
    .mobile-panel { background:#fff; border:1px solid #dbe3ec; border-radius:20px; padding:18px; margin-top:14px; box-shadow:0 9px 24px rgba(15,23,42,.05); }
    .mobile-panel h2 { margin:0 0 14px; font-size:18px; }
    .mobile-section-title { margin:18px 0 9px; color:#475569; font-size:12px; text-transform:uppercase; letter-spacing:.08em; font-weight:900; }
    .mobile-field { margin:0 0 13px; }
    .mobile-field label { display:block; margin:0 0 6px; font-size:12px; font-weight:900; color:#334155; }
    .mobile-field input,.mobile-field select,.mobile-field textarea { width:100%; min-height:48px; border:1px solid #cbd5e1; border-radius:12px; padding:11px 12px; background:#fff; color:#0f172a; font:inherit; font-size:16px; }
    .mobile-field textarea { min-height:86px; resize:vertical; }
    .mobile-grid-2 { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
    .mobile-button { width:100%; min-height:52px; border:0; border-radius:14px; padding:13px 16px; background:#172433; color:#fff; font-weight:900; font-size:16px; cursor:pointer; }
    .mobile-button.green { background:#16a34a; }
    .mobile-button.red { background:#dc2626; }
    .mobile-button.amber { background:#f59e0b; color:#172433; }
    .mobile-secondary { display:block; text-align:center; color:#475569; font-weight:800; text-decoration:none; padding:13px 6px; margin-top:4px; }
    .mobile-search { display:flex; gap:8px; margin-top:14px; }
    .mobile-search input { flex:1; min-width:0; min-height:48px; border:1px solid #cbd5e1; border-radius:12px; padding:10px 12px; font-size:16px; }
    .mobile-search button { min-width:92px; border:0; border-radius:12px; background:#172433; color:#fff; font-weight:900; }
    .mobile-job { background:#fff; border:1px solid #dbe3ec; border-radius:17px; padding:15px; margin-top:11px; }
    .mobile-job-head { display:flex; justify-content:space-between; gap:10px; align-items:flex-start; }
    .mobile-job-title { font-weight:900; font-size:17px; }
    .mobile-job-meta { color:#64748b; font-size:12px; line-height:1.5; margin-top:4px; }
    .mobile-pill { white-space:nowrap; border-radius:999px; padding:5px 8px; background:#dcfce7; color:#166534; font-size:10px; font-weight:900; text-transform:uppercase; }
    .mobile-job .mobile-button { margin-top:12px; min-height:44px; font-size:14px; text-decoration:none; display:flex; align-items:center; justify-content:center; }
    .mobile-money-preview { background:#ecfdf5; border:1px solid #bbf7d0; color:#166534; border-radius:12px; padding:11px 12px; font-size:13px; font-weight:900; margin:4px 0 13px; }
    .mobile-note { border-radius:12px; padding:11px 12px; font-size:12px; line-height:1.45; background:#eff6ff; color:#1e40af; border:1px solid #bfdbfe; margin:0 0 13px; }
    .mobile-success { background:#ecfdf5; color:#166534; border-color:#bbf7d0; }
    .mobile-danger { background:#fef2f2; color:#991b1b; border-color:#fecaca; }
    .mobile-empty { text-align:center; color:#64748b; padding:24px 10px; }
    .mobile-footer { text-align:center; color:#94a3b8; font-size:11px; margin-top:24px; }
    .mobile-install-wrap { margin-top:14px; display:flex; flex-direction:column; gap:8px; align-items:center; }
    .mobile-install-button { border:0; border-radius:999px; background:#f97316; color:#fff; font-weight:900; padding:10px 16px; min-height:42px; box-shadow:0 8px 18px rgba(249,115,22,.24); cursor:pointer; }
    .mobile-install-hint { color:#64748b; font-size:11px; line-height:1.45; max-width:360px; }
    .mobile-inline-note { font-size:12px; color:#64748b; margin-top:6px; }
    @media(max-width:520px){ .mobile-shell{padding:12px 10px 34px}.mobile-grid-2{grid-template-columns:1fr}.mobile-hero{border-radius:18px;padding:20px 16px}.mobile-hero h1{font-size:24px}.mobile-user{font-size:11px}.mobile-brand-sub{display:none} }
  `;
}

const mobileOrdersIcon192PngBase64 = "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gmZw1dXV3HTTTdx1112MHj062gVfeeUVfvGLX/C73/2OTCZDcXFxBKaLC7Xv+3R3d7Nx48Z+AmqEyASm4l45o35MnDiR2tra6LP79+9nz549kXFsgHZxldQYzTNnzmThwoXRvOZyOR599FGam5uPmbccD35poLqqiuuuu+49k+uHXADGjBnDueeey28efJCW5uajoo5mVcjlcnR2dka6XxyO29nZyX/8x39QU1PDF7/4xYh5li1bRnNzM21tbbz22msA9PT0sG7dOtatWxfptPX19fzd3/0d3/72t9m4cSPd3d1ks9lI9y8qKmLatGksX76c8vJy/u3f/o2tW7cGpQt7e/sZzQCvvvoqTz/9NDNnzsT3fWpqavjKV77Sz2hes2ZNpMvGVRUdwiQuvPBCEokEa9eu5ciRI5GQxPV6pVQ0TmM3ZbPZaI5qamq46aab+MpXvkJtbW3EDJs2beJf//VfWblyJZZlUVlZGXnT4szseR6u67J9+3Z++MMfRuOEY2PujY3leR5jx47l61//Otdccw2u69LX18eqVav4P//n/5BIJOjr64vct+bezBxMnTqVCy64gIqKimgR2rdvH7/97W/JZrPvWvPJ5I/PmDmT85YuPen534MCrTtzxgwuXL6c3z74YKS7GgM07oc2+PE4ft7YB21tbdx///1UVVVx0003RSjEq6++msOHD9PS0sLevXuxbZtt27bxr//6r4wfP57Ro0ejtWbp0qV897vf5bHHHmP16tVRgkVJSQkzZszgiiuu4Nxzz6W3t5dUKsU3v/lNWlpagP4xCyklzc3NbNiwgf379zNx4kQ8z6Ouri4KfGUyGZ555hmampr6qRuG+WbNmsXf/M3fMGHCBJ599llWrVrF3r17OXjwYOTuLC0tZdasWSxfvpxRo0ZF8IA9e/agtaa0tJQ77riDW265hdra2kjn7+jooKOjg7Fjx3L11VfjOA5FRUUkEglyuVykXhj7aNWqVWzfvp2+vr5IdTseiquSRjg7OzvZv39/v9wF492LM+rChQtZtmxZJBC9vb1RboLhj4FpqHGqDfMZBp73pNBghJPzrqt/+rOfacu2NaATiUQEhfA8T+fzed3c3KyvvvrqKMRtQvrEYBS2beszzzxTr1y5Uvf29mqttfY8T7e2tuq/+Zu/0SUlJdqyLO04jh43bpz+/ve/rw8dOqRd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";
const mobileOrdersIcon512PngBase64 = "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";
const mobileOrdersIcon192Png = Buffer.from(mobileOrdersIcon192PngBase64, "base64");
const mobileOrdersIcon512Png = Buffer.from(mobileOrdersIcon512PngBase64, "base64");

function mobileOrdersPage(req, title, content, extraScript = "") {
  const baseScript = `
    (function(){
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/mobile-orders/sw.js').catch(function(){});
      }
      var installButton = document.getElementById('mobile-install-button');
      var deferredPrompt = null;
      window.addEventListener('beforeinstallprompt', function(event){
        event.preventDefault();
        deferredPrompt = event;
        if (installButton) installButton.hidden = false;
      });
      if (installButton) {
        installButton.addEventListener('click', async function(){
          if (deferredPrompt) {
            deferredPrompt.prompt();
            try { await deferredPrompt.userChoice; } catch (_) {}
            deferredPrompt = null;
            installButton.hidden = true;
            return;
          }
          var isApple = /iphone|ipad|ipod/i.test(navigator.userAgent || '');
          alert(isApple
            ? 'On iPhone or iPad, tap Share and choose “Add to Home Screen”.'
            : 'Use your browser menu and choose “Install app” or “Add to Home Screen”.');
        });
      }
    })();
  `;
  const pageScript = baseScript + (extraScript ? "\n" + extraScript : "");
  return `<!DOCTYPE html>
  <html><head><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>${escapeHtml(title)}</title>
  <meta name="theme-color" content="#f97316">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="default">
  <meta name="apple-mobile-web-app-title" content="Keys247 Orders">
  <link rel="manifest" href="/mobile-orders/manifest.webmanifest">
  <link rel="icon" type="image/png" sizes="192x192" href="/mobile-orders/icon-192.png">
  <link rel="apple-touch-icon" href="/mobile-orders/icon-192.png">
  <style>${mobileOrdersStyles()}</style></head>
  <body class="mobile-orders-page"><main class="mobile-shell">
    <div class="mobile-top"><div class="mobile-brand-wrap"><img class="mobile-brand-icon" src="/mobile-orders/icon-192.png" alt="Keys247"><div><div class="mobile-brand">Keys247 Orders</div><div class="mobile-brand-sub">Fast create and close workflow</div></div></div><div class="mobile-user">${escapeHtml(currentAgentName(req) || "Portal user")}<br><a href="/logout" style="color:#64748b">Logout</a></div></div>
    ${content}
    <div class="mobile-footer">Mobile Orders v88 · Same live database as the Dispatch Portal<div class="mobile-install-wrap"><button id="mobile-install-button" class="mobile-install-button" type="button" hidden>Install app</button><div class="mobile-install-hint">Add this to the phone home screen for app-style use. On iPhone, use Share → Add to Home Screen.</div></div></div>
  </main><script>${pageScript}</script></body></html>`;
}

app.get('/mobile-orders/icon-192.png', (req, res) => {
  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.send(mobileOrdersIcon192Png);
});

app.get('/mobile-orders/icon-512.png', (req, res) => {
  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.send(mobileOrdersIcon512Png);
});

app.get('/mobile-orders/manifest.webmanifest', (req, res) => {
  res.setHeader('Content-Type', 'application/manifest+json');
  res.send(JSON.stringify({
    name: 'Keys247 Orders',
    short_name: 'Keys247',
    description: 'Mobile create and close workflow for Keys247 orders.',
    start_url: '/mobile-orders',
    scope: '/mobile-orders',
    display: 'standalone',
    background_color: '#f3f6fa',
    theme_color: '#f97316',
    icons: [
      { src: '/mobile-orders/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/mobile-orders/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' }
    ]
  }));
});

app.get('/mobile-orders/sw.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.setHeader('Cache-Control', 'no-cache');
  res.send(`
    const CACHE_NAME = 'keys247-mobile-orders-v88';
    const ASSETS = ['/mobile-orders', '/mobile-orders/create', '/mobile-orders/close', '/mobile-orders/manifest.webmanifest', '/mobile-orders/icon-192.png', '/mobile-orders/icon-512.png'];
    self.addEventListener('install', event => {
      event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
    });
    self.addEventListener('activate', event => {
      event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))).then(() => self.clients.claim()));
    });
    self.addEventListener('fetch', event => {
      if (event.request.method !== 'GET') return;
      const requestUrl = new URL(event.request.url);
      if (!requestUrl.pathname.startsWith('/mobile-orders')) return;
      event.respondWith(fetch(event.request).then(response => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy)).catch(() => {});
        return response;
      }).catch(() => caches.match(event.request).then(response => response || caches.match('/mobile-orders'))));
    });
  `);
});

app.get("/mobile-orders", async (req, res) => {
  try {
    const counts = (await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE COALESCE(is_imported,FALSE)=FALSE AND closed_at IS NULL AND status NOT IN ('cancelled','fully_paid'))::int AS open_jobs,
        COUNT(*) FILTER (WHERE COALESCE(is_imported,FALSE)=FALSE AND created_at::date=CURRENT_DATE)::int AS created_today,
        COUNT(*) FILTER (WHERE COALESCE(is_imported,FALSE)=FALSE AND closed_at::date=CURRENT_DATE)::int AS closed_today
      FROM jobs
    `)).rows[0] || {};
    res.send(mobileOrdersPage(req, "Mobile Orders", `
      <section class="mobile-hero"><h1>Mobile Orders</h1><p>Fast access for creating and closing orders only. Everything saves into the main live portal.</p></section>
      <div class="mobile-home-actions">
        <a class="mobile-big-action create" href="/mobile-orders/create">＋ Create Order<small>${Number(counts.created_today||0)} created today</small></a>
        <a class="mobile-big-action close" href="/mobile-orders/close">✓ Close Order<small>${Number(counts.open_jobs||0)} open · ${Number(counts.closed_today||0)} closed today</small></a>
      </div>
    `));
  } catch (error) {
    console.error("Mobile orders home error:", error);
    res.status(500).send("Could not load Mobile Orders.");
  }
});

app.get("/mobile-orders/create", async (req, res) => {
  try {
    const technicians = (await pool.query(`SELECT id,name,status,return_to_work_date FROM technicians WHERE active=TRUE ORDER BY name ASC`)).rows;
    const techOptions = technicians.map(t => `<option value="${t.id}">${escapeHtml(t.name)}${t.status ? ` · ${escapeHtml(t.status)}` : ""}</option>`).join("");
    const campaignOptions = await getCampaignOptions("Unknown");
    const categories = ["BAILIFF (COURT ORDERED)","BIKE LOCK (FROM £75, 1HR ETA)","DOOR FIX/ REPLACEMENT","FIX LOCK","FRESH INSTALLATION (LOCK ON BLANK DOOR)","KEY BROKEN IN LOCK","KEY SAFE INSTALLATION","LOCK CHANGE","LOCKED IN","LOCKED OUT","OPEN SAFE (FROM £120)","QUOTE","RECALL (UNDER WARRANTY)","SPECIALIST"];
    res.send(mobileOrdersPage(req, "Create Order", `
      <section class="mobile-hero"><h1>Create Order</h1><p>The essentials only. The full order remains available in the desktop Job Control Panel after creation.</p></section>
      <form method="POST" action="/mobile-orders/create">
        <div class="mobile-panel">
          <div class="mobile-section-title">Customer</div>
          <div class="mobile-field"><label>Customer name</label><input name="customer_name" autocomplete="name" required></div>
          <div class="mobile-field"><label>Phone</label><input name="customer_phone" type="tel" inputmode="tel" autocomplete="tel" required></div>
          <div class="mobile-field"><label>Email (optional)</label><input name="customer_email" type="email" autocomplete="email"></div>
          <div class="mobile-section-title">Address</div>
          <div class="mobile-field">
            <label>Postcode</label>
            <div style="display:grid;grid-template-columns:1fr auto;gap:8px;">
              <input id="mobile-postcode" name="postcode" autocapitalize="characters" autocomplete="postal-code" required>
              <button id="mobile-find-address" type="button" style="border:0;border-radius:12px;background:#172433;color:#fff;font-weight:900;padding:0 14px;min-height:48px;">Find address</button>
            </div>
            <div id="mobile-address-status" class="mobile-note" style="margin-top:8px;margin-bottom:0;">Enter the postcode and tap Find address.</div>
          </div>
          <div id="mobile-address-choice" class="mobile-field" style="display:none;">
            <label>Select address</label>
            <select id="mobile-address-select"><option value="">Choose an address...</option></select>
          </div>
          <div class="mobile-field"><label>Address</label><input id="mobile-address-line-1" name="address_line_1" autocomplete="street-address" required></div>
          <input id="mobile-address-line-2" name="address_line_2" type="hidden">
          <input id="mobile-address-line-3" name="address_line_3" type="hidden">
          <input id="mobile-latitude" name="latitude" type="hidden">
          <input id="mobile-longitude" name="longitude" type="hidden">
          <input id="mobile-udprn" name="udprn" type="hidden">
          <div class="mobile-grid-2"><div class="mobile-field"><label>Town</label><input id="mobile-town" name="town"></div><div class="mobile-field"><label>County</label><input id="mobile-county" name="county"></div></div>
          <div class="mobile-section-title">Order</div>
          <div class="mobile-field"><label>Job category</label><select name="job_type" required><option value="">Select category</option>${categories.map(c=>`<option>${escapeHtml(c)}</option>`).join("")}</select></div>
          <div class="mobile-field"><label>Description</label><textarea name="job_description" placeholder="What does the customer need?"></textarea></div>
          <div class="mobile-field"><label>Source / campaign</label><select name="source_campaign" required><option value="">Select campaign...</option>${optionList(campaignOptions, "")}</select><div class="mobile-inline-note">Required so reporting and campaign tracking stay accurate.</div></div>
          <div class="mobile-grid-2"><div class="mobile-field"><label>Quoted price</label><input name="quoted_price" inputmode="decimal" placeholder="£"></div><div class="mobile-field"><label>Expected payment</label><select name="expected_payment_method"><option>Unknown</option>${splitPaymentMethods.map(m=>`<option>${escapeHtml(m)}</option>`).join("")}</select></div></div>
          <div class="mobile-section-title">Dispatch</div>
          <div class="mobile-field"><label>Technician</label><select name="assigned_technician_id"><option value="">Unassigned</option>${techOptions}</select></div>
          <div class="mobile-field"><label>ETA</label><select name="eta"><option value="">Not set</option><option>30 mins</option><option>45 mins</option><option>1 hour</option><option>1-2 hours</option><option>2-3 hours</option><option>Scheduled</option></select></div>
          <div class="mobile-field"><label>Dispatcher notes</label><textarea name="dispatcher_notes"></textarea></div>
          <button class="mobile-button green" type="submit">Create Order</button>
          <a class="mobile-secondary" href="/mobile-orders">Cancel</a>
        </div>
      </form>
    `, `
      (function(){
        const postcode = document.getElementById("mobile-postcode");
        const button = document.getElementById("mobile-find-address");
        const status = document.getElementById("mobile-address-status");
        const choice = document.getElementById("mobile-address-choice");
        const select = document.getElementById("mobile-address-select");
        let addresses = [];

        function setValue(id, value) {
          const el = document.getElementById(id);
          if (el) el.value = value == null ? "" : value;
        }

        function showStatus(message, isError) {
          status.textContent = message;
          status.className = "mobile-note" + (isError ? " mobile-danger" : "");
        }

        async function findAddress() {
          const search = String(postcode.value || "").trim();
          if (!search) { showStatus("Enter a postcode first.", true); postcode.focus(); return; }
          button.disabled = true;
          button.textContent = "Finding…";
          choice.style.display = "none";
          select.innerHTML = '<option value="">Choose an address...</option>';
          try {
            const response = await fetch("/api/postcoder-addresses?postcode=" + encodeURIComponent(search), { headers: { "Accept": "application/json" } });
            const data = await response.json();
            addresses = data && Array.isArray(data.addresses) ? data.addresses : [];
            if (!response.ok || !data.ok || !addresses.length) {
              showStatus((data && data.error) || "No addresses found. You can still enter the address manually.", true);
              return;
            }
            addresses.forEach(function(address, index){
              const option = document.createElement("option");
              option.value = String(index);
              option.textContent = address.summary || address.full_address || ("Address " + (index + 1));
              select.appendChild(option);
            });
            choice.style.display = "block";
            showStatus(addresses.length + (addresses.length === 1 ? " address found. Select it below." : " addresses found. Select the correct one below."), false);
            select.focus();
          } catch (error) {
            showStatus("Address lookup failed. You can still enter the address manually.", true);
          } finally {
            button.disabled = false;
            button.textContent = "Find address";
          }
        }

        button.addEventListener("click", findAddress);
        postcode.addEventListener("keydown", function(event){
          if (event.key === "Enter") { event.preventDefault(); findAddress(); }
        });
        select.addEventListener("change", function(){
          const address = addresses[Number(select.value)];
          if (!address) return;
          setValue("mobile-address-line-1", address.address_line_1);
          setValue("mobile-address-line-2", address.address_line_2);
          setValue("mobile-address-line-3", address.address_line_3);
          setValue("mobile-town", address.town);
          setValue("mobile-county", address.county);
          setValue("mobile-postcode", String(address.postcode || postcode.value || "").toUpperCase());
          setValue("mobile-latitude", address.latitude);
          setValue("mobile-longitude", address.longitude);
          setValue("mobile-udprn", address.udprn);
          showStatus("Address selected and filled in. You can edit it if needed.", false);
        });
      })();
    `));
  } catch (error) {
    console.error("Mobile create page error:", error);
    res.status(500).send("Could not load mobile create order page.");
  }
});

app.post("/mobile-orders/create", async (req, res) => {
  try {
    const body=req.body;
    const createEta=normaliseEta(body);
    const createScheduledAt=null; // Mobile quick-create intentionally does not schedule a date/time; use desktop for scheduled jobs.
    const createTechId=parseOptionalInt(body.assigned_technician_id);
    await assertTechnicianAssignableForJob(createTechId, targetDateForAssignment(createEta, createScheduledAt));
    const result=await pool.query(`
      INSERT INTO jobs (
        customer_name,customer_phone,customer_email,
        address_line_1,address_line_2,address_line_3,town,county,postcode,latitude,longitude,udprn,
        job_type,job_description,urgency,source_campaign,quoted_price,expected_payment_method,
        assigned_technician_id,eta,scheduled_at,dispatcher_name,dispatcher_notes,status,created_at,updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'Normal',$15,$16,$17,$18,$19,$20,$21,$22,'open',NOW(),NOW()) RETURNING id
    `,[
      body.customer_name,compactPhone(body.customer_phone),body.customer_email,
      body.address_line_1,body.address_line_2,body.address_line_3,body.town,body.county,compactPostcode(body.postcode),
      body.latitude ? Number(body.latitude) : null,body.longitude ? Number(body.longitude) : null,body.udprn || null,
      body.job_type,body.job_description,body.source_campaign,parseMoneyInput(body.quoted_price),body.expected_payment_method||'Unknown',
      createTechId,createEta,createScheduledAt,currentAgentName(req),body.dispatcher_notes
    ]);
    const id=result.rows[0].id;
    await pool.query(`UPDATE jobs SET job_number=$1 WHERE id=$2`,[jobNumber(id),id]);
    await addJobAuditEntry(id,"job_created_mobile","status","—","Job created from Mobile Orders",currentAgentName(req));
    res.redirect(`/mobile-orders/created/${id}`);
  } catch(error){
    console.error("Mobile create order error:",error);
    res.status(500).send(`Could not create order: ${escapeHtml(error.message)}`);
  }
});

app.get("/mobile-orders/created/:id", async (req,res)=>{
  const job=(await pool.query(`SELECT j.*,t.name technician_name FROM jobs j LEFT JOIN technicians t ON t.id=j.assigned_technician_id WHERE j.id=$1`,[req.params.id])).rows[0];
  if(!job) return res.status(404).send("Job not found");
  res.send(mobileOrdersPage(req,"Order Created",`
    <section class="mobile-hero"><h1>Order Created ✓</h1><p>${escapeHtml(job.job_number||jobNumber(job.id))} has been added to the live Dispatch Board.</p></section>
    <div class="mobile-panel"><h2>${escapeHtml(job.postcode||"")} · ${escapeHtml(job.customer_name||"")}</h2><div class="mobile-note mobile-success">Technician: ${escapeHtml(job.technician_name||"Unassigned")}<br>ETA: ${escapeHtml(job.eta||"Not set")}<br>Campaign: ${escapeHtml(job.source_campaign||"Unknown")}</div>
      <a class="mobile-button green" href="/mobile-orders/create">Create Another Order</a><a class="mobile-secondary" href="/mobile-orders">Mobile Orders Home</a></div>
  `));
});

app.get("/mobile-orders/close", async (req,res)=>{
  try {
    const q=String(req.query.q||"").trim();
    const params=[]; let searchSql="";
    if(q){ params.push(`%${q}%`); searchSql=`AND (COALESCE(j.job_number,'') ILIKE $1 OR COALESCE(j.postcode,'') ILIKE $1 OR COALESCE(j.customer_phone,'') ILIKE $1 OR COALESCE(j.customer_name,'') ILIKE $1)`; }
    const rows=(await pool.query(`SELECT j.*,t.name technician_name FROM jobs j LEFT JOIN technicians t ON t.id=j.assigned_technician_id WHERE COALESCE(j.is_imported,FALSE)=FALSE AND j.closed_at IS NULL AND COALESCE(j.status,'open') NOT IN ('cancelled','fully_paid') ${searchSql} ORDER BY j.created_at DESC LIMIT 60`,params)).rows;
    const jobCards=rows.map(job=>`<div class="mobile-job"><div class="mobile-job-head"><div><div class="mobile-job-title">${escapeHtml(job.job_number||jobNumber(job.id))} · ${escapeHtml(job.postcode||"")}</div><div class="mobile-job-meta">${escapeHtml(job.customer_name||"")} · ${escapeHtml(job.customer_phone||"")}<br>${escapeHtml(job.job_type||"")} · ${escapeHtml(job.technician_name||"Unassigned")}</div></div><span class="mobile-pill">${escapeHtml(jobStatusLabel(job.status))}</span></div><a class="mobile-button red" href="/mobile-orders/job/${job.id}/close">Close this order</a></div>`).join("");
    res.send(mobileOrdersPage(req,"Close Order",`<section class="mobile-hero"><h1>Close Order</h1><p>Search by order number, postcode, customer or phone, then open the close screen.</p></section><form class="mobile-search" method="GET" action="/mobile-orders/close"><input name="q" value="${escapeHtml(q)}" placeholder="Postcode, phone, order…"><button>Search</button></form>${jobCards||'<div class="mobile-panel mobile-empty">No open orders found.</div>'}<a class="mobile-secondary" href="/mobile-orders">Mobile Orders Home</a>`));
  } catch(error){ console.error("Mobile close list error:",error); res.status(500).send("Could not load open orders."); }
});

app.get("/mobile-orders/job/:id/close", async (req,res)=>{
  try {
    const job=(await pool.query(`SELECT j.*,t.name technician_name FROM jobs j LEFT JOIN technicians t ON t.id=j.assigned_technician_id WHERE j.id=$1`,[req.params.id])).rows[0];
    if(!job) return res.status(404).send("Job not found");
    const stripePaid=(await pool.query(`SELECT COALESCE(SUM(amount),0)::numeric total FROM stripe_payment_receipts WHERE job_id=$1 AND status='paid'`,[job.id])).rows[0];
    const paidByStripe=Number(stripePaid?.total||0)>0;
    const defaultPaid=job.customer_paid||paidByStripe;
    const defaultMethod=paidByStripe?'Stripe':(job.payment_method_1||job.payment_method||job.expected_payment_method||'');
    res.send(mobileOrdersPage(req,"Close Order",`
      <section class="mobile-hero"><h1>Close ${escapeHtml(job.job_number||jobNumber(job.id))}</h1><p>${escapeHtml(job.customer_name||"")} · ${escapeHtml(job.postcode||"")} · ${escapeHtml(job.technician_name||"Unassigned")}</p></section>
      <form method="POST" action="/mobile-orders/job/${job.id}/close" onsubmit="return confirm('Close this order now?');"><div class="mobile-panel">
        ${paidByStripe?`<div class="mobile-note mobile-success">✓ Stripe payment has already been confirmed by the portal.</div>`:""}
        <div class="mobile-field"><label>NET job value</label><input id="mobileNet" name="net_value" inputmode="decimal" value="${job.net_value!=null?Number(job.net_value).toFixed(2):(job.final_value!=null?(Number(job.final_value)/1.2).toFixed(2):"")}" required></div>
        <div id="mobileMoney" class="mobile-money-preview">Enter NET to calculate VAT and GROSS.</div>
        <div class="mobile-grid-2"><div class="mobile-field"><label>Customer paid?</label><select name="customer_paid"><option value="true" ${defaultPaid?'selected':''}>Yes</option><option value="false" ${!defaultPaid?'selected':''}>No</option></select></div><div class="mobile-field"><label>Payment method</label><select name="payment_method_1"><option value="">Select method</option><option value="Stripe" ${defaultMethod==='Stripe'?'selected':''}>Stripe</option>${splitPaymentMethods.map(m=>`<option ${m===defaultMethod?'selected':''}>${escapeHtml(m)}</option>`).join("")}</select></div></div>
        <div class="mobile-field"><label>Payment amount</label><input name="payment_amount_1" inputmode="decimal" value="${job.payment_amount_1!=null?Number(job.payment_amount_1).toFixed(2):(job.final_value!=null?Number(job.final_value).toFixed(2):"")}"></div>
        <div class="mobile-grid-2"><div class="mobile-field"><label>Close status</label><select name="status">${literalClosingStatusOptions(defaultPaid?'fully_paid':(job.status||'awaiting_payment'))}</select></div><div class="mobile-field"><label>Outcome</label><select name="outcome">${optionList(jobOutcomes,job.outcome||'Completed')}</select></div></div>
        <div class="mobile-field"><label>Materials cost</label><input name="materials_cost" inputmode="decimal" value="${job.materials_cost!=null?Number(job.materials_cost).toFixed(2):''}"></div>
        <div class="mobile-field"><label>Materials used</label><textarea name="materials_used">${escapeHtml(job.materials_used||'')}</textarea></div>
        <div class="mobile-field"><label>Technician / close notes</label><textarea name="close_notes">${escapeHtml(job.close_notes||'')}</textarea></div>
        <input type="hidden" name="payment_method_2" value=""><input type="hidden" name="payment_amount_2" value=""><input type="hidden" name="card_is_amex" value="false"><input type="hidden" name="amex_id_provided" value="false"><input type="hidden" name="invoice_photos_confirmed" value="${job.invoice_photos_confirmed?'true':'false'}"><input type="hidden" name="tech_notes" value="${escapeHtml(job.tech_notes||'')}">
        <button class="mobile-button red" type="submit">Close Order</button><a class="mobile-secondary" href="/mobile-orders/close">Back to open orders</a>
      </div></form>
    `,`function calc(){const e=document.getElementById('mobileNet');const b=document.getElementById('mobileMoney');const n=Number(String(e.value||'').replace(/[^0-9.-]/g,''))||0;const v=Math.round(n*.2*100)/100;const g=Math.round((n+v)*100)/100;b.textContent='NET £'+n.toFixed(2)+' · VAT @ 20% £'+v.toFixed(2)+' · GROSS £'+g.toFixed(2);}document.getElementById('mobileNet').addEventListener('input',calc);calc();`));
  } catch(error){ console.error("Mobile close page error:",error); res.status(500).send("Could not load close order page."); }
});

app.post("/mobile-orders/job/:id/close", async (req,res)=>{
  try {
    const id=Number(req.params.id), body=req.body;
    const oldJob=(await pool.query(`SELECT * FROM jobs WHERE id=$1`,[id])).rows[0];
    if(!oldJob) return res.status(404).send("Job not found");
    const netValue=parseMoneyInput(body.net_value), vatAmount=calculateVatFromNet(netValue), finalValue=calculateGrossFromNet(netValue);
    const closeValues={net_value:netValue,vat_amount:vatAmount,final_value:finalValue,payment_method:buildSplitPaymentSummary(body),payment_method_1:body.payment_method_1||"",payment_amount_1:parseMoneyInput(body.payment_amount_1),payment_method_2:"",payment_amount_2:null,invoice_photos_confirmed:body.invoice_photos_confirmed==="true",card_is_amex:false,amex_id_provided:false,customer_paid:body.customer_paid==="true",materials_used:body.materials_used||"",materials_cost:parseMoneyInput(body.materials_cost),outcome:body.outcome||"Completed",tech_notes:body.tech_notes||"",close_notes:body.close_notes||"",status:body.status||(body.customer_paid==="true"?"fully_paid":"awaiting_payment")};
    await pool.query(`UPDATE jobs SET net_value=$1,vat_amount=$2,final_value=$3,payment_method=$4,payment_method_1=$5,payment_amount_1=$6,payment_method_2=$7,payment_amount_2=$8,invoice_photos_confirmed=$9,card_is_amex=$10,amex_id_provided=$11,customer_paid=$12,materials_used=$13,materials_cost=$14,outcome=$15,tech_notes=$16,close_notes=$17,status=$18,closed_by=$19,closed_at=COALESCE(closed_at,NOW()),updated_at=NOW() WHERE id=$20`,[closeValues.net_value,closeValues.vat_amount,closeValues.final_value,closeValues.payment_method,closeValues.payment_method_1,closeValues.payment_amount_1,closeValues.payment_method_2,closeValues.payment_amount_2,closeValues.invoice_photos_confirmed,closeValues.card_is_amex,closeValues.amex_id_provided,closeValues.customer_paid,closeValues.materials_used,closeValues.materials_cost,closeValues.outcome,closeValues.tech_notes,closeValues.close_notes,closeValues.status,currentAgentName(req),id]);
    await logJobChanges(id,oldJob,closeValues,currentAgentName(req),"job_closed_mobile");
    await addJobAuditEntry(id,"job_closed_mobile","status",oldJob.status||"—",closeValues.status,currentAgentName(req));
    res.redirect(`/mobile-orders/closed/${id}`);
  } catch(error){console.error("Mobile close submit error:",error);res.status(500).send(`Could not close order: ${escapeHtml(error.message)}`);}
});

app.get("/mobile-orders/closed/:id", async(req,res)=>{
  const job=(await pool.query(`SELECT * FROM jobs WHERE id=$1`,[req.params.id])).rows[0];
  if(!job) return res.status(404).send("Job not found");
  res.send(mobileOrdersPage(req,"Order Closed",`<section class="mobile-hero"><h1>Order Closed ✓</h1><p>${escapeHtml(job.job_number||jobNumber(job.id))} has been updated in the live portal.</p></section><div class="mobile-panel"><div class="mobile-note mobile-success"><strong>${escapeHtml(job.postcode||'')}</strong><br>GROSS ${money(job.final_value||0)} · ${escapeHtml(jobStatusLabel(job.status))}<br>Paid: ${job.customer_paid?'Yes':'No'}</div><a class="mobile-button red" href="/mobile-orders/close">Close Another Order</a><a class="mobile-secondary" href="/mobile-orders">Mobile Orders Home</a></div>`));
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
