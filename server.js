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
  res.setHeader("Set-Cookie", "dashboard_session=; HttpOnly; SameSite=Lax; Secure; Path=/; Max-Age=0");
}

function requireLogin(req, res, next) {
  const openPaths = ["/login", "/logout", "/webhook/yay"];
  if (openPaths.includes(req.path) || req.path.startsWith("/tech-checkin/")) return next();

  const session = readSession(req);
  if (!session) return res.redirect(`/login?next=${encodeURIComponent(req.originalUrl)}`);

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


const jobStatuses = [
  { value: "open", label: "Open" },
  { value: "assigned", label: "Assigned" },
  { value: "completed", label: "Completed" },
  { value: "closed", label: "Closed" },
  { value: "awaiting_payment", label: "Awaiting payment" },
  { value: "fully_paid_private", label: "Fully paid (private)" },
  { value: "invoiced_account", label: "Invoiced (Account)" }
];

const activeJobStatuses = ["open", "assigned", "completed", "awaiting_payment"];

const jobTypes = [
  "Lockout",
  "Lock change",
  "Lock repair",
  "Fresh lock installation",
  "Boarding up / temporary security",
  "Safe opening",
  "Account job",
  "Other"
];

const jobUrgencies = ["Normal", "Urgent", "Emergency"];
const jobPaymentMethods = ["Unknown", "Cash", "Card", "Bank transfer", "Account"];
const jobOutcomes = ["Completed", "Cancelled", "No answer", "Customer declined", "Follow-up needed", "Other"];

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
  return found ? found.label : (status || "Open");
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
    body { font-family: Arial, sans-serif; background: #111827; color: white; padding: 32px; }
    a { color: #93c5fd; text-decoration: none; margin-right: 14px; font-weight: bold; }
    h1 { font-size: 40px; margin-bottom: 5px; }
    h2 { margin-top: 0; }
    .subtitle { color: #9ca3af; margin-bottom: 24px; }
    .nav { margin-bottom: 22px; display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
    .nav a { margin-right: 0; }
    .dropdown { position: relative; display: inline-block; }
    .dropdown-button { color: #93c5fd; font-weight: bold; cursor: pointer; padding: 0; }
    .dropdown-content {
      display: none;
      position: absolute;
      top: 20px;
      left: 0;
      background: #1f2937;
      min-width: 220px;
      border: 1px solid #374151;
      border-radius: 10px;
      box-shadow: 0 10px 25px rgba(0,0,0,0.35);
      z-index: 9999;
      overflow: hidden;
    }
    .dropdown-content a {
      display: block;
      padding: 11px 13px;
      color: #bfdbfe;
      white-space: nowrap;
      font-size: 14px;
    }
    .dropdown-content a:hover { background: #374151; color: white; }
    .dropdown:hover .dropdown-content { display: block; }
    .login-bar { background: #1f2937; border: 1px solid #374151; border-radius: 12px; padding: 12px 16px; margin-bottom: 20px; color: #d1d5db; display: flex; justify-content: space-between; align-items: center; }
    .panel { background: #1f2937; border-radius: 14px; padding: 22px; margin-bottom: 28px; }
    input, select, textarea, button { font-size: 15px; padding: 10px; border-radius: 8px; border: 1px solid #374151; }
    input, select, textarea { background: #111827; color: white; }
    button { background: #2563eb; color: white; border: none; cursor: pointer; font-weight: bold; }
    table { width: 100%; border-collapse: collapse; background: #1f2937; border-radius: 14px; overflow: hidden; }
    th, td { text-align: left; padding: 12px; border-bottom: 1px solid #374151; font-size: 14px; vertical-align: middle; }
    th { color: #9ca3af; font-size: 12px; text-transform: uppercase; letter-spacing: 0.03em; }
    .invoice-table th, .invoice-table td { padding: 11px 10px; font-size: 13px; }
    .invoice-main { font-weight: bold; font-size: 14px; }
    .invoice-sub { color: #9ca3af; font-size: 12px; margin-top: 4px; line-height: 1.35; }
    .compact-stage { min-width: 245px; }
    .compact-stage-top { margin-bottom: 7px; }
    .compact-stage-form { display: flex; gap: 6px; align-items: center; }
    .compact-stage-form select { font-size: 12px; padding: 7px; width: 180px; }
    .compact-stage-form button { font-size: 12px; padding: 7px 10px; }
    .actions { display: flex; flex-direction: column; gap: 8px; align-items: flex-start; }
    .actions a { margin-right: 0; font-size: 13px; }
    .delete-link { color: #fca5a5; }
    .delete-button, .danger { background: #dc2626; }
    .cancel-button { background: #374151; }
    .small-button { font-size: 12px; padding: 7px 10px; }
    .pill, .status { padding: 6px 10px; border-radius: 999px; font-size: 12px; font-weight: bold; white-space: nowrap; display: inline-block; }
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
    .audit { color: #9ca3af; font-size: 12px; line-height: 1.35; margin-top: 6px; }
    .warning-text { color: #fbbf24; font-weight: bold; }
    .distance { font-size: 22px; font-weight: bold; }
    .grid-2 { display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; }
    .grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; }
    .checkbox-row { display: flex; align-items: center; gap: 10px; margin: 16px 0; color: #d1d5db; font-size: 16px; }
    .checkbox-row input { width: 18px; height: 18px; }
    .help { color: #9ca3af; font-size: 14px; margin-top: 8px; }
    .search-form { display: grid; grid-template-columns: 2fr 1fr; gap: 15px; align-items: center; }
    .copy-input { width: 100%; box-sizing: border-box; font-size: 12px; padding: 7px; color: #d1d5db; }
    .job-open { background: #2563eb; color: white; }
    .job-assigned { background: #7c3aed; color: white; }
    .job-completed { background: #f59e0b; color: black; }
    .job-closed { background: #374151; color: #d1d5db; }
    .job-awaiting-payment { background: #dc2626; color: white; }
    .job-fully-paid-private { background: #16a34a; color: white; }
    .job-invoiced-account { background: #22c55e; color: black; }
    .job-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; }
    .job-grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; }
    .job-card-title { font-weight: bold; font-size: 16px; }
    .job-card-sub { color: #9ca3af; font-size: 13px; margin-top: 4px; line-height: 1.35; }
    .big-total { font-size: 30px; font-weight: bold; }
    @media (max-width: 800px) { .job-grid, .job-grid-3 { grid-template-columns: 1fr; } }

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
      <a href="/reports">Reports</a>
      <a href="/jobs">Jobs</a>
      <a href="/technicians">Technicians</a>
      <a href="/dispatch">Dispatch</a>
      <a href="/address-lookup-test">Address Lookup</a>

      <div class="dropdown">
        <a class="dropdown-button" href="/invoices">Invoices</a>
        <div class="dropdown-content">
          <a href="/invoices">Active Invoices</a>
          <a href="/invoices/historic">Historic Invoices</a>
          <a href="/invoices/new">New Invoice</a>
          <a href="/invoice-items">Invoice Items</a>
          <a href="/invoice-templates">Account Templates</a>
        </div>
      </div>
    </div>
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

  await pool.query(`CREATE INDEX IF NOT EXISTS jobs_status_idx ON jobs (status);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS jobs_created_at_idx ON jobs (created_at);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS jobs_postcode_idx ON jobs (postcode);`);

  await seedDefaultInvoiceItems();
  await seedDefaultInvoiceTemplates();
}

/* The rest of this file keeps all your current working routes and adds the invoice upgrade.
   Because this response needs to be copied safely, the complete route set continues below. */

app.get("/login", (req, res) => {
  const next = req.query.next || "/";
  const error = req.query.error === "1";
  const options = agentNames.map(name => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join("");

  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Dashboard Login</title>
      <style>
        body { font-family: Arial, sans-serif; background: #111827; color: white; padding: 40px; }
        .login-box { max-width: 440px; margin: 80px auto; background: #1f2937; border-radius: 16px; padding: 30px; border: 1px solid #374151; }
        h1 { margin-top: 0; font-size: 36px; }
        .subtitle { color: #9ca3af; margin-bottom: 25px; }
        select, input, button { width: 100%; box-sizing: border-box; font-size: 17px; padding: 14px; border-radius: 8px; border: 1px solid #374151; margin-bottom: 14px; }
        select, input { background: #111827; color: white; }
        button { background: #2563eb; color: white; border: none; font-weight: bold; cursor: pointer; }
        .error { background: #dc2626; color: white; border-radius: 8px; padding: 12px; margin-bottom: 14px; }
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
    const answeredCalls = recentCalls.filter(call => call.answered_by && agents[call.answered_by]);
    const missedCalls = recentCalls.filter(call => !call.answered_by);
    const reportableCalls = [...answeredCalls, ...missedCalls];

    const missedRate = reportableCalls.length ? Math.round((missedCalls.length / reportableCalls.length) * 100) : 0;

    let missedRateClass = "good";
    if (reportableCalls.length === 0) missedRateClass = "neutral";
    else if (missedRate >= 20) missedRateClass = "bad";
    else if (missedRate >= 10) missedRateClass = "soon";

    const lastReceived = latestResult.rows[0].last_received;
    const lastUpdatedText = lastReceived ? `Last call received: ${formatDateTimeWithSeconds(lastReceived)}` : "No calls received yet";
    const pageUpdatedText = `Page refreshed: ${formatDateTimeWithSeconds(new Date())}`;

    const agentStats = {};
    Object.entries(agents).forEach(([ext, name]) => {
      agentStats[ext] = { ext, name, answered: 0, totalDuration: 0, lastCallTime: null, status: "No active call" };
    });

    answeredCalls.forEach(call => {
      const ext = call.answered_by;
      if (!agents[ext]) return;
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
        <title>Keys247 Call Wallboard</title>
        <meta http-equiv="refresh" content="5">
        <style>
          ${sharedStyles()}
          .updated { color: #d1d5db; font-size: 16px; margin-bottom: 30px; }
          .cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin-bottom: 40px; }
          .card { background: #1f2937; border-radius: 14px; padding: 25px; border: 2px solid transparent; }
          .card.good { border-color: #16a34a; }
          .card.soon { border-color: #f59e0b; }
          .card.bad { border-color: #dc2626; }
          .card.neutral { border-color: #374151; }
          .label { color: #9ca3af; font-size: 16px; }
          .value { font-size: 42px; font-weight: bold; margin-top: 10px; }
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
          <div class="card"><div class="label">Total Calls</div><div class="value">${reportableCalls.length}</div></div>
          <div class="card"><div class="label">Answered</div><div class="value">${answeredCalls.length}</div></div>
          <div class="card"><div class="label">Missed</div><div class="value">${missedCalls.length}</div></div>
          <div class="card ${missedRateClass}"><div class="label">Miss Rate</div><div class="value ${missedRateClass}">${missedRate}%</div></div>
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

app.get("/reports", async (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head><title>Reports</title><style>${sharedStyles()}</style></head>
    <body>
      ${nav(req)}
      <h1>Reports</h1>
      <div class="subtitle">Reports are still available. Use CSV downloads below.</div>
      <div class="panel">
        <a href="/reports/invoices.csv">Download invoices CSV</a>
        <a href="/reports/calls.csv">Download calls CSV</a>
      </div>
    </body>
    </html>
  `);
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

    const header = ["Call Time", "From", "To", "Answered By Extension", "Answered By Agent", "Answer Type", "Duration Seconds", "Call Result"];
    const lines = [header.map(csvValue).join(",")];

    result.rows.forEach(call => {
      const agent = agents[call.answered_by] || "";
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

    if (search) {
      params.push(`%${search}%`);
      where.push(`(
        COALESCE(j.job_number, '') ILIKE $${params.length}
        OR COALESCE(j.customer_name, '') ILIKE $${params.length}
        OR COALESCE(j.customer_phone, '') ILIKE $${params.length}
        OR COALESCE(j.postcode, '') ILIKE $${params.length}
        OR COALESCE(j.address_line_1, '') ILIKE $${params.length}
      )`);
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const jobsResult = await pool.query(`
      SELECT j.*, t.name AS technician_name
      FROM jobs j
      LEFT JOIN technicians t ON t.id = j.assigned_technician_id
      ${whereSql}
      ORDER BY j.created_at DESC
      LIMIT 300
    `, params);

    const countsResult = await pool.query(`SELECT status, COUNT(*)::int AS count FROM jobs GROUP BY status`);
    const counts = Object.fromEntries(countsResult.rows.map(row => [row.status || "open", row.count]));
    const activeCount = activeJobStatuses.reduce((sum, status) => sum + Number(counts[status] || 0), 0);

    const statusFilterOptions = [
      { value: "active", label: `Active jobs (${activeCount})` },
      { value: "all", label: "All jobs" },
      ...jobStatuses.map(item => ({ value: item.value, label: `${item.label} (${counts[item.value] || 0})` }))
    ];

    const rows = jobsResult.rows.map(job => `
      <tr>
        <td>
          <div class="job-card-title"><a href="/jobs/${job.id}/edit">${escapeHtml(job.job_number || jobNumber(job.id))}</a></div>
          <div class="job-card-sub">Created ${formatDateTime(job.created_at)}<br>By ${escapeHtml(job.dispatcher_name || "Unknown")}</div>
        </td>
        <td>
          <strong>${escapeHtml(job.customer_name || "—")}</strong>
          <div class="job-card-sub">${escapeHtml(job.customer_phone || "")}</div>
        </td>
        <td>${jobAddressBlock(job) || "—"}</td>
        <td>
          <strong>${escapeHtml(job.job_type || "—")}</strong>
          <div class="job-card-sub">${escapeHtml(job.urgency || "Normal")}${job.starting_price !== null && job.starting_price !== undefined ? ` · Start ${money(job.starting_price)}` : (job.quoted_price !== null && job.quoted_price !== undefined ? ` · Quoted ${money(job.quoted_price)}` : "")}</div>
        </td>
        <td>${escapeHtml(job.technician_name || "Unassigned")}</td>
        <td><span class="pill ${jobStatusClass(job.status)}">${escapeHtml(jobStatusLabel(job.status))}</span></td>
        <td>
          <div class="actions">
            <a href="/jobs/${job.id}/edit">Open / Edit</a>
            <a href="/jobs/${job.id}/summary">Technician summary</a>
            <a href="/jobs/${job.id}/close">Close job</a>
          </div>
        </td>
      </tr>
    `).join("");

    res.send(`
      <!DOCTYPE html>
      <html>
      <head><title>Jobs</title><style>${sharedStyles()}</style></head>
      <body>
        ${nav(req)}
        <h1>Jobs</h1>
        <div class="subtitle">Live job booking board. Open, assign, complete, close and report on jobs.</div>

        <div class="grid-3">
          <div class="panel"><div class="muted">Active jobs</div><div class="big-total">${activeCount}</div></div>
          <div class="panel"><div class="muted">Awaiting payment</div><div class="big-total">${counts.awaiting_payment || 0}</div></div>
          <div class="panel"><div class="muted">Completed today/overall</div><div class="big-total">${counts.completed || 0}</div></div>
        </div>

        <div class="panel">
          <form method="GET" action="/jobs" class="job-grid-3">
            <select name="status">${optionList(statusFilterOptions, selectedStatus || "active")}</select>
            <input name="search" value="${escapeHtml(search)}" placeholder="Search job number, customer, phone, postcode">
            <button type="submit">Filter jobs</button>
          </form>
          <br>
          <a class="button" href="/jobs/new">+ New job booking</a>
        </div>

        <table>
          <tr>
            <th>Job</th><th>Customer</th><th>Address</th><th>Job type</th><th>Technician</th><th>Status</th><th>Actions</th>
          </tr>
          ${rows || `<tr><td colspan="7" class="muted">No jobs found.</td></tr>`}
        </table>
      </body>
      </html>
    `);
  } catch (error) {
    console.error("Jobs page error:", error);
    res.status(500).send("Jobs page error");
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
      "Locksmith",
      "Lockout",
      "Lock change",
      "Lock repair",
      "Fresh installation",
      "Boarding up",
      "Safe",
      "Account job",
      "Other"
    ];

    const campaignOptions = [
      "Unknown",
      "Google",
      "Google Ads",
      "Organic",
      "Repeat customer",
      "Account customer",
      "Referral",
      "Emergency callout",
      "Other"
    ];

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
    const jobResult = await pool.query(`SELECT * FROM jobs WHERE id = $1`, [id]);
    if (!jobResult.rows.length) return res.status(404).send("Job not found");
    const job = jobResult.rows[0];
    const technicians = (await pool.query(`SELECT id, name, status FROM technicians WHERE active = TRUE ORDER BY name ASC`)).rows;
    const templates = (await pool.query(`SELECT id, template_name FROM invoice_templates WHERE active = TRUE ORDER BY sort_order ASC, template_name ASC`)).rows;

    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Edit Job</title>
        <style>${sharedStyles()} label { color:#d1d5db; font-size:13px; font-weight:bold; margin-bottom:5px; display:block; } .field input,.field select,.field textarea{width:100%;box-sizing:border-box;}</style>
      </head>
      <body>
        ${nav(req)}
        <h1>${escapeHtml(job.job_number || jobNumber(job.id))}</h1>
        <div class="subtitle">Created ${formatDateTime(job.created_at)} by ${escapeHtml(job.dispatcher_name || "Unknown")} · Last updated ${formatDateTime(job.updated_at)}</div>

        <div class="panel">
          <span class="pill ${jobStatusClass(job.status)}">${escapeHtml(jobStatusLabel(job.status))}</span>
          <a href="/jobs/${job.id}/summary" style="margin-left:15px;">Technician summary</a>
          <a href="/jobs/${job.id}/close" style="margin-left:15px;">Close job / payment details</a>
          <a href="/jobs" style="margin-left:15px;">Back to jobs</a>
        </div>

        <form method="POST" action="/jobs/${job.id}/update">
          <div class="panel">
            <h2>Customer</h2>
            <div class="job-grid">
              <div class="field"><label>Customer name</label><input name="customer_name" value="${escapeHtml(job.customer_name)}" required></div>
              <div class="field"><label>Customer phone</label><input name="customer_phone" value="${escapeHtml(job.customer_phone)}" required></div>
              <div class="field"><label>Alternative phone</label><input name="customer_alt_phone" value="${escapeHtml(job.customer_alt_phone)}"></div>
              <div class="field"><label>Email</label><input name="customer_email" value="${escapeHtml(job.customer_email)}"></div>
            </div>
          </div>

          <div class="panel">
            <h2>Address</h2>
            <div class="job-grid">
              <div class="field"><label>Address line 1</label><input name="address_line_1" value="${escapeHtml(job.address_line_1)}" required></div>
              <div class="field"><label>Address line 2</label><input name="address_line_2" value="${escapeHtml(job.address_line_2)}"></div>
              <div class="field"><label>Address line 3</label><input name="address_line_3" value="${escapeHtml(job.address_line_3)}"></div>
              <div class="field"><label>Town</label><input name="town" value="${escapeHtml(job.town)}"></div>
              <div class="field"><label>County</label><input name="county" value="${escapeHtml(job.county)}"></div>
              <div class="field"><label>Postcode</label><input name="postcode" value="${escapeHtml(job.postcode)}" required></div>
            </div>
          </div>

          <div class="panel">
            <h2>Job details</h2>
            <div class="job-grid">
              <div class="field"><label>Job type</label><select name="job_type">${optionList(jobTypes, job.job_type)}</select></div>
              <div class="field"><label>Urgency</label><select name="urgency">${optionList(jobUrgencies, job.urgency)}</select></div>
              <div class="field"><label>Source / campaign</label><input name="source_campaign" value="${escapeHtml(job.source_campaign)}"></div>
              <div class="field"><label>Starting price</label><input name="starting_price" value="${job.starting_price !== null && job.starting_price !== undefined ? Number(job.starting_price).toFixed(2) : ""}"></div>
              <div class="field"><label>Call out agreed</label><input name="call_out_agreed" value="${job.call_out_agreed !== null && job.call_out_agreed !== undefined ? Number(job.call_out_agreed).toFixed(2) : ""}"></div>
              <div class="field"><label>Start price of locks</label><input name="start_price_locks" value="${job.start_price_locks !== null && job.start_price_locks !== undefined ? Number(job.start_price_locks).toFixed(2) : ""}"></div>
              <div class="field"><label>Quoted / overall price notes</label><input name="quoted_price" value="${job.quoted_price !== null && job.quoted_price !== undefined ? Number(job.quoted_price).toFixed(2) : ""}"></div>
              <div class="field"><label>Offsite payment?</label><select name="offsite_payment"><option value="false" ${!job.offsite_payment ? "selected" : ""}>No</option><option value="true" ${job.offsite_payment ? "selected" : ""}>Yes</option></select></div>
              <div class="field"><label>Bill payer name</label><input name="bill_payer_name" value="${escapeHtml(job.bill_payer_name)}"></div>
              <div class="field"><label>Bill payer telephone</label><input name="bill_payer_phone" value="${escapeHtml(job.bill_payer_phone)}"></div>
              <div class="field"><label>Expected payment method</label><select name="expected_payment_method">${optionList(jobPaymentMethods, job.expected_payment_method)}</select></div>
              <div class="field"><label>Account job?</label><select name="account_job"><option value="false" ${!job.account_job ? "selected" : ""}>No</option><option value="true" ${job.account_job ? "selected" : ""}>Yes</option></select></div>
              <div class="field"><label>Account template</label><select name="account_template_id"><option value="">None</option>${accountTemplateOptions(templates, job.account_template_id)}</select></div>
              <div class="field"><label>Assigned technician</label><select name="assigned_technician_id"><option value="">Unassigned</option>${technicianOptions(technicians, job.assigned_technician_id)}</select></div>
              <div class="field"><label>ETA</label><input name="eta" value="${escapeHtml(job.eta)}"></div>
              <div class="field"><label>Status</label><select name="status">${jobStatusOptions(job.status)}</select></div>
            </div>
            <br>
            <label>Job description</label><textarea name="job_description" rows="4">${escapeHtml(job.job_description)}</textarea>
            <br><br>
            <label>Dispatcher notes</label><textarea name="dispatcher_notes" rows="3">${escapeHtml(job.dispatcher_notes)}</textarea>
          </div>

          <button type="submit">Save job</button>
          <a href="/jobs" style="margin-left:12px;">Cancel</a>
        </form>
      </body>
      </html>
    `);
  } catch (error) {
    console.error("Edit job page error:", error);
    res.status(500).send("Edit job page error");
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

app.get("/address-lookup-test", async (req, res) => {
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
          <style>
            body { font-family: Arial, sans-serif; background: #111827; color: white; padding: 30px; }
            .box { max-width: 520px; margin: 60px auto; background: #1f2937; border-radius: 16px; padding: 28px; border: 1px solid #374151; }
          </style>
        </head>
        <body>
          <div class="box">
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

    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Technician Check-In</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body {
            font-family: Arial, sans-serif;
            background: #111827;
            color: white;
            padding: 18px;
            margin: 0;
          }
          .wrap { max-width: 560px; margin: 0 auto; }
          .card {
            background: #1f2937;
            border: 1px solid #374151;
            border-radius: 18px;
            padding: 22px;
            margin-bottom: 18px;
          }
          h1 { font-size: 32px; margin: 0 0 6px; }
          h2 { margin-top: 0; }
          .subtitle { color: #9ca3af; margin-bottom: 18px; line-height: 1.4; }
          .status-pill {
            display: inline-block;
            padding: 8px 12px;
            border-radius: 999px;
            font-weight: bold;
            font-size: 14px;
            background: #2563eb;
            color: white;
            margin-bottom: 12px;
          }
          input, select, textarea, button {
            width: 100%;
            box-sizing: border-box;
            font-size: 18px;
            padding: 14px;
            border-radius: 12px;
            border: 1px solid #374151;
            margin-bottom: 12px;
          }
          input, select, textarea {
            background: #111827;
            color: white;
          }
          textarea { min-height: 90px; }
          button {
            border: none;
            color: white;
            font-weight: bold;
            cursor: pointer;
          }
          .big-button {
            font-size: 20px;
            padding: 18px;
            margin-bottom: 14px;
          }
          .available { background: #16a34a; }
          .job { background: #2563eb; }
          .soon { background: #f59e0b; color: black; }
          .off { background: #6b7280; }
          .manual { background: #374151; }
          .message {
            display: none;
            padding: 14px;
            border-radius: 12px;
            margin-bottom: 16px;
            line-height: 1.4;
          }
          .message.good { background: #14532d; display: block; }
          .message.bad { background: #7f1d1d; display: block; }
          .help { color: #9ca3af; font-size: 14px; line-height: 1.45; }
          .last { color: #d1d5db; line-height: 1.5; font-size: 15px; }
          .small { font-size: 13px; color: #9ca3af; }
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
          <div class="card">
            <h1>${escapeHtml(tech.name)}</h1>
            <div class="subtitle">Technician check-in</div>
            <div class="status-pill">${escapeHtml(tech.status || "No status")}</div>
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
            <select id="status">${statusOptions}</select>
            <input id="current_postcode" value="${escapeHtml(tech.current_postcode || "")}" placeholder="Current postcode e.g. W3 7AR">
            <input id="available_from" value="${escapeHtml(tech.available_from || "")}" placeholder="Available from e.g. 14:30 / 30 mins">
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
            <a href="/tech-checkin/${escapeHtml(tech.checkin_token || "")}" target="_blank">Check-in link</a>
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
