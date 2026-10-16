import express from "express";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import readline from "node:readline";

const app = express();
app.use(express.json({ limit: "1mb" }));
const HOST = "127.0.0.1";
const PORT = Number(process.env.LOCAL_AGENT_PORT || 3210);
const ROOT = path.resolve(process.env.ZAIM_WORKSPACE || "./workspace");
await fs.mkdir(ROOT, { recursive: true });

let token = process.env.ZAIM_LOCAL_AGENT_TOKEN;
if (!token) {
  token = crypto.randomBytes(24).toString("hex");
  console.log("\nZAIM local agent token (copy into the app settings; keep private):");
  console.log(token, "\n");
}

const withinRoot = (relativePath = ".") => {
  const target = path.resolve(ROOT, String(relativePath));
  if (target !== ROOT && !target.startsWith(ROOT + path.sep)) throw new Error("المسار خارج مساحة العمل المسموح بها.");
  return target;
};

app.use((req, res, next) => {
  if (req.path === "/health") return next();
  if (req.get("authorization") !== `Bearer ${token}`) return res.status(401).json({ error: "رمز الوصول غير صحيح." });
  next();
});

app.get("/health", (_req, res) => res.json({ ok: true, workspace: ROOT }));
app.get("/api/files", async (req, res) => {
  try {
    const dir = withinRoot(req.query.path || ".");
    const entries = await fs.readdir(dir, { withFileTypes: true });
    res.json({ path: path.relative(ROOT, dir), entries: entries.map(e => ({ name: e.name, type: e.isDirectory() ? "directory" : "file" })) });
  } catch (e) { res.status(400).json({ error: e.message }); }
});
app.get("/api/file", async (req, res) => {
  try {
    const file = withinRoot(req.query.path);
    const stat = await fs.stat(file);
    if (!stat.isFile() || stat.size > 200_000) return res.status(400).json({ error: "يسمح بقراءة الملفات النصية حتى 200KB فقط." });
    res.json({ path: path.relative(ROOT, file), content: await fs.readFile(file, "utf8") });
  } catch (e) { res.status(400).json({ error: e.message }); }
});
app.post("/api/file", async (req, res) => {
  try {
    const { path: relativePath, content, approved } = req.body || {};
    if (approved !== true) return res.status(403).json({ error: "يتطلب حفظ الملف موافقة صريحة من المستخدم." });
    const file = withinRoot(relativePath);
    const text = String(content ?? "");
    if (text.length > 200_000) return res.status(413).json({ error: "الملف أكبر من الحد المسموح." });
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, text, "utf8");
    res.json({ ok: true, path: path.relative(ROOT, file) });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// Deliberately conservative command allowlist. No arbitrary shell strings.
const ALLOWED = new Set(["node", "npm", "git", "java", "javac", "gradle", "gradlew", "python", "python3"]);
app.post("/api/run", async (req, res) => {
  const { command, args = [], cwd = ".", approved = false } = req.body || {};
  if (approved !== true) return res.status(403).json({ error: "يتطلب تشغيل الأوامر موافقة صريحة من المستخدم." });
  if (!ALLOWED.has(command) || !Array.isArray(args) || args.length > 30 || args.some(a => typeof a !== "string" || a.length > 500)) {
    return res.status(400).json({ error: "الأمر غير مسموح أو الوسائط غير صالحة." });
  }
  let dir;
  try { dir = withinRoot(cwd); } catch (e) { return res.status(400).json({ error: e.message }); }
  const child = spawn(command, args, { cwd: dir, shell: false, windowsHide: true, timeout: 60000 });
  let stdout = "", stderr = "";
  child.stdout.on("data", d => { stdout += d.toString(); if (stdout.length > 50000) child.kill(); });
  child.stderr.on("data", d => { stderr += d.toString(); if (stderr.length > 50000) child.kill(); });
  const killTimer = setTimeout(() => child.kill("SIGTERM"), 60000);
  child.on("close", code => {
    clearTimeout(killTimer);
    res.json({ code, stdout: stdout.slice(-50000), stderr: stderr.slice(-50000) });
  });
  child.on("error", e => { clearTimeout(killTimer); if (!res.headersSent) res.status(500).json({ error: e.message }); });
});

app.listen(PORT, HOST, () => console.log(`ZAIM local agent listening on http://${HOST}:${PORT}\nWorkspace: ${ROOT}`));
