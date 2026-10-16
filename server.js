
import express from "express";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 3000);

const ALLOWED_ORIGINS = [
  "https://zaimx579.github.io"
];

app.disable("x-powered-by");
app.use(express.json({ limit: "1mb" }));

// السماح لموقع GitHub Pages بالاتصال بالخادم
app.use((req, res, next) => {
  const origin = req.headers.origin;

  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }

  res.setHeader("Vary", "Origin");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, OPTIONS"
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, X-OpenRouter-Key"
  );

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  next();
});

// اختبار حالة الخادم
app.get("/", (_req, res) => {
  res.json({
    service: "ZAIM AI Agent",
    status: "online",
    message: "الخادم يعمل"
  });
});

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    service: "zaim-ai-agent"
  });
});

// محادثة الذكاء الاصطناعي
app.post("/api/chat", async (req, res) => {
  try {
    const { messages, model, systemPrompt } = req.body || {};

    // الأفضل إضافة المفتاح إلى Environment Variables في Render.
    // يدعم هذا الكود أيضًا المفتاح المرسل من واجهة التطبيق.
    const apiKey =
      process.env.OPENROUTER_API_KEY ||
      req.get("X-OpenRouter-Key");

    const selectedModel = String(
      model || process.env.OPENROUTER_DEFAULT_MODEL || ""
    ).trim();

    if (!apiKey) {
      return res.status(400).json({
        error: "أضف مفتاح OpenRouter في إعدادات الخادم أو التطبيق."
      });
    }

    if (!selectedModel) {
      return res.status(400).json({
        error: "أدخل معرّف النموذج في إعدادات التطبيق."
      });
    }

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({
        error: "اكتب رسالة أولًا."
      });
    }

    if (messages.length > 60) {
      return res.status(413).json({
        error: "المحادثة طويلة جدًا. ابدأ محادثة جديدة."
      });
    }

    const safeMessages = messages.map((message) => ({
      role: ["user", "assistant"].includes(message?.role)
        ? message.role
        : "user",
      content: String(message?.content ?? "").slice(0, 20000)
    }));

    const system = String(
      systemPrompt ||
      "أنت ZAIM AI Agent، مساعد ذكي يتحدث العربية. " +
      "ساعد المستخدم في البرمجة والتخطيط وحل المشكلات. " +
      "كن واضحًا وصادقًا بشأن قدراتك، ولا تدّعِ تنفيذ مهام لم تنفذها."
    ).slice(0, 6000);

    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://zaimx579.github.io/zaim-ai-agent/",
          "X-Title": "ZAIM AI Agent"
        },
        body: JSON.stringify({
          model: selectedModel,
          messages: [
            { role: "system", content: system },
            ...safeMessages
          ],
          temperature: 0.2
        }),
        signal: AbortSignal.timeout(90000)
      }
    );

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const errorMessage =
        data?.error?.message || "فشل الاتصال بنموذج OpenRouter.";

      return res.status(
        response.status === 429 ? 429 : 502
      ).json({
        error: errorMessage
      });
    }

    const answer = data?.choices?.[0]?.message?.content;

    if (!answer) {
      return res.status(502).json({
        error: "النموذج لم يُرجع إجابة نصية."
      });
    }

    return res.json({
      answer,
      model: data?.model || selectedModel,
      usage: data?.usage || null
    });

  } catch (error) {
    console.error("Chat request failed:", error.message);

    return res.status(500).json({
      error:
        error.name === "TimeoutError"
          ? "انتهت مهلة الاتصال. حاول مرة أخرى."
          : "حدث خطأ أثناء الاتصال بالخادم."
    });
  }
});

// مهم: الاستماع على جميع واجهات الشبكة في Render
app.listen(PORT, "0.0.0.0", () => {
  console.log(`ZAIM AI Agent server listening on port ${PORT}`);
});
