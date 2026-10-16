import express from "express";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

dotenv.config();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json({ limit: "2mb" }));
app.use(express.static(path.join(__dirname, "public")));

const PORT = Number(process.env.PORT || 3000);
const DEFAULT_MODEL = process.env.OPENROUTER_DEFAULT_MODEL || "";

app.get("/api/health", (_req, res) => res.json({ ok: true, service: "zaim-ai-agent", defaultModel: DEFAULT_MODEL }));

app.post("/api/chat", async (req, res) => {
  try {
    const { messages, model, systemPrompt } = req.body || {};
    const headerKey = req.get("x-openrouter-key");
    const apiKey = process.env.OPENROUTER_API_KEY || headerKey;
    const selectedModel = String(model || DEFAULT_MODEL).trim();

    if (!apiKey) return res.status(400).json({ error: "أضف مفتاح OpenRouter من الإعدادات." });
    if (!selectedModel) return res.status(400).json({ error: "اكتب اسم نموذج OpenRouter في الإعدادات." });
    if (!Array.isArray(messages) || messages.length === 0) return res.status(400).json({ error: "لا توجد رسائل لإرسالها." });
    if (messages.length > 60) return res.status(413).json({ error: "المحادثة طويلة جدًا؛ ابدأ محادثة جديدة." });

    const safeMessages = messages.map((m) => ({
      role: ["user", "assistant"].includes(m?.role) ? m.role : "user",
      content: String(m?.content ?? "").slice(0, 30000)
    }));

    const system = String(systemPrompt || "أنت ZAIM AI Agent، مساعد برمجي عربي. كن صريحًا بشأن ما تستطيع تنفيذه فعليًا، ولا تدّعِ تشغيل ملفات أو أدوات لم تُشغّل.").slice(0, 8000);
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": `http://localhost:${PORT}`,
        "X-Title": "ZAIM AI Agent"
      },
      body: JSON.stringify({
        model: selectedModel,
        messages: [{ role: "system", content: system }, ...safeMessages],
        temperature: 0.2
      }),
      signal: AbortSignal.timeout(90000)
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return res.status(response.status).json({ error: data?.error?.message || "فشل الاتصال بـ OpenRouter." });
    }
    const answer = data?.choices?.[0]?.message?.content;
    if (!answer) return res.status(502).json({ error: "لم يُرجع النموذج إجابة نصية." });
    res.json({ answer, model: data?.model || selectedModel, usage: data?.usage || null });
  } catch (err) {
    res.status(500).json({ error: err?.name === "TimeoutError" ? "انتهت مهلة الاتصال بالنموذج." : "حدث خطأ أثناء الاتصال بالخدمة." });
  }
});

app.listen(PORT, "127.0.0.1", () => {
  console.log(`ZAIM AI Agent running at http://localhost:${PORT}`);
});
