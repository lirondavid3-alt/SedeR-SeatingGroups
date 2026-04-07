import express from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// Simple logging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

const distPath = path.resolve(process.cwd(), "dist");

// Serve static files from dist
app.use(express.static(distPath));

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

// Catch-all to serve index.html for SPA (Express 5 uses *all for better matching)
app.get("*all", (req, res) => {
  const indexPath = path.join(distPath, "index.html");
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send("index.html not found in dist. Please run build.");
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server is live at http://0.0.0.0:${PORT}`);
});
