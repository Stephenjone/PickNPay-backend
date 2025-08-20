const jwt = require("jsonwebtoken");
const cors = require("cors");

// CORS middleware setup (ensure it's used in your main app file)
const corsOptions = {
  origin: "http://localhost:3000",
  credentials: true,
};
const applyCors = cors(corsOptions);

// Token verification middleware
const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Access denied. No token provided." });
  }

  const token = authHeader.split(" ")[1];

  try {
    const secret = process.env.JWT_SECRET || "your-default-jwt-secret";
    const decoded = jwt.verify(token, secret);
    req.user = decoded; // attach decoded user info
    next();
  } catch (err) {
    console.error("JWT verification failed:", err.message);
    res.status(401).json({ error: "Invalid or expired token." });
  }
};

// Export both CORS and token middleware if needed
module.exports = {
  verifyToken,
  applyCors,
};
