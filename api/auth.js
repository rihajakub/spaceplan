const { createToken, validPassword, validToken } = require("../lib/auth");

module.exports = async (req, res) => {
  try {
    if (req.method === "POST") {
      if (!validPassword(req.body?.password)) {
        return res.status(401).json({ error: "Nesprávné heslo." });
      }
      return res.status(200).json({ token: createToken() });
    }

    if (req.method === "GET") {
      const authorization = String(req.headers.authorization || "");
      const token = authorization.startsWith("Bearer ")
        ? authorization.slice(7)
        : "";
      if (!token || !validToken(token)) {
        return res.status(401).json({ error: "Přístup vyžaduje heslo." });
      }
      return res.status(200).json({ authenticated: true });
    }

    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Nepodporovaná metoda." });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Přihlášení se nepodařilo." });
  }
};
