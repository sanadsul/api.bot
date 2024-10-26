import express from "express";
import dotenv from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";
import helmet from "helmet";
import compression from "compression";

dotenv.config();

const app = express();

app.use(express.json());
app.use(helmet({ contentSecurityPolicy: false })); // تبسيط إعدادات Helmet لتقليل التحميل
app.use(compression()); // ضغط الاستجابات

// إعداد CORS مع تبسيط الإعدادات
app.use((req, res, next) => {
  res.setHeader(
    "Access-Control-Allow-Origin",
    "https://fast-bot-ashy.vercel.app"
  );
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Connection", "keep-alive"); // تفعيل Keep-Alive للطلبات المتكررة
  next();
});

app.use((req, res, next) => {
  const allowedOrigin = "https://fast-bot-ashy.vercel.app"; // Frontend domain
  const requestOrigin = req.get("Origin");

  if (requestOrigin !== allowedOrigin) {
    return res.status(503).end();
  }

  next(); // Allow the request to proceed if it comes from the frontend
});

let conversationContext = []; // مصفوفة لتخزين آخر 5 رسائل
const cache = new Map(); // ذاكرة مؤقتة لنتائج الردود المتكررة

app.post("/api/ask-ai", async (req, res) => {
  const { question } = req.body;

  if (!question) {
    return res.status(400).json({ error: "يجب توفير السؤال" });
  }

  // التحقق من ذاكرة التخزين المؤقت للحصول على الرد إذا كان موجودًا
  if (cache.has(question)) {
    return res.json({ response: cache.get(question) });
  }

  try {
    const apiKey = process.env.GOOGLE_API_KEY;
    const genAI = new GoogleGenerativeAI(apiKey);

    // إضافة السؤال الحالي إلى المحادثة والاقتصار على آخر 5 رسائل
    conversationContext.push(`User: ${question}\nAI:`);
    if (conversationContext.length > 5) {
      conversationContext.shift(); // إزالة أول عنصر إذا تجاوزت المصفوفة 5 عناصر
    }

    const conversationText = conversationContext.join("\n"); // تحويل المصفوفة إلى نص

    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
      generationConfig: {
        candidateCount: 1,
        temperature: 0.2,
      },
    });

    const result = await model.generateContent(conversationText);

    if (result.status === 492) {
      return res
        .status(400)
        .json({ error: "خطأ 492: الطلب كبير جدًا ولا يمكن معالجته." });
    }

    if (result.response.candidates[0].safety === "BLOCKED") {
      return res.json({ response: "عذرًا، لا يمكنني الرد على هذا السؤال." });
    }

    let botResponse = result.response.text();
    botResponse = botResponse.replace(/بواسطة جوجل/g, "بواسطة سند سليمان");
    botResponse = botResponse.replace(/جوجل/g, "سند سليمان");
    botResponse = botResponse.replace(
      /trained by Google/g,
      "trained by SanadSuliman"
    );

    conversationContext[conversationContext.length - 1] += ` ${botResponse}`;

    // تخزين الرد في الذاكرة المؤقتة
    cache.set(question, botResponse);
    res.json({ response: botResponse });
  } catch (error) {
    console.error("خطأ في توليد الرد:", error);

    if (error.status === 429) {
      return res
        .status(429)
        .json({ error: "تم تجاوز الحد الأقصى للطلبات، يرجى المحاولة لاحقًا." });
    }

    res.status(500).json({ error: "خطأ في السيرفر" });
  }
});

const PORT = process.env.PORT || 5005;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
