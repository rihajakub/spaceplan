const crypto = require("crypto");

const PASSWORD_HASH =
  "ddef60a3b723c38f65ae7353a664fa0a37562ae45602af2478a2184e31bcedfc";
const TOKEN_MESSAGE = "spaceplan-access-v1";

function secret() {
  const value =
    process.env.SESSION_SECRET ||
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL;
  if (!value) throw new Error("Chybí serverový klíč pro přihlášení.");
  return value;
}

function digest(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

function safeEqual(left, right) {
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function validPassword(password) {
  return safeEqual(digest(password), PASSWORD_HASH);
}

function createToken() {
  return crypto.createHmac("sha256", secret()).update(TOKEN_MESSAGE).digest("hex");
}

function validToken(token) {
  return safeEqual(token, createToken());
}

function requireAccess(req, res) {
  const authorization = String(req.headers.authorization || "");
  const token = authorization.startsWith("Bearer ")
    ? authorization.slice(7)
    : "";
  if (token && validToken(token)) return true;
  res.status(401).json({ error: "Přístup vyžaduje heslo." });
  return false;
}

module.exports = { createToken, requireAccess, validPassword, validToken };
