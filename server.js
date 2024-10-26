import Fastify from "fastify";
import dotenv from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";
import fastifyCors from "fastify-cors";

dotenv.config();

const app = Fastify();

// إضافة إعدادات CORS يدوياً
app.addHook("onRequest", (request, reply, done) => {
  const allowedOrigin = "http://localhost:5173";
  const requestOrigin = request.headers.origin;

  if (requestOrigin === allowedOrigin) {
    reply.header("Access-Control-Allow-Origin", allowedOrigin);
    reply.header(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, DELETE, OPTIONS"
    );
    reply.header("Access-Control-Allow-Headers", "Content-Type");
    done();
  } else {
    return reply.status(503).send();
  }
});

// معالجة طلبات OPTIONS (Preflight) للتأكد من نجاح CORS
app.options("/*", (request, reply) => {
  reply
    .header("Access-Control-Allow-Origin", "http://localhost:5173")
    .header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
    .header("Access-Control-Allow-Headers", "Content-Type")
    .status(200)
    .send();
});

let conversationContext = ""; // حفظ المحادثة في هذا المتغير

app.post("/api/ask-ai", async (request, reply) => {
  const { question } = request.body;

  if (!question) {
    return reply.status(400).send({ error: "يجب توفير السؤال" });
  }

  try {
    const apiKey = process.env.GOOGLE_API_KEY;
    const genAI = new GoogleGenerativeAI(apiKey);

    conversationContext += `User: ${question}\nAI:`;

    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
      generationConfig: {
        candidateCount: 1,
        temperature: 0.2,
      },
    });

    const result = await model.generateContent(conversationContext);

    if (result.status === 492) {
      console.warn("خطأ 492: الطلب كبير جدًا ولا يمكن معالجته.");
      return reply
        .status(400)
        .send({ error: "خطأ 492: الطلب كبير جدًا ولا يمكن معالجته." });
    }

    if (result.response.candidates[0].safety === "BLOCKED") {
      console.warn("تم حظر الرد لأسباب تتعلق بالسلامة:", question);
      return reply.send({ response: "عذرًا، لا يمكنني الرد على هذا السؤال." });
    }

    let botResponse = result.response.text();
    botResponse = botResponse.replace(/بواسطة جوجل/g, "بواسطة سند سليمان");
    botResponse = botResponse.replace(/جوجل/g, "سند سليمان");
    botResponse = botResponse.replace(
      /trained by Google/g,
      "trained by SanadSuliman"
    );

    conversationContext += ` ${botResponse}\n`;
    console.log(botResponse);
    reply.send({ response: botResponse });
  } catch (error) {
    console.error("خطأ في توليد الرد:", error);

    if (error.status === 429) {
      return reply
        .status(429)
        .send({ error: "تم تجاوز الحد الأقصى للطلبات، يرجى المحاولة لاحقًا." });
    }

    reply.status(500).send({ error: "خطأ في السيرفر" });
  }
});

const PORT = process.env.PORT || 5005;

app.listen({ port: PORT }, (err, address) => {
  if (err) {
    console.error("خطأ في بدء الخادم:", err);
    process.exit(1);
  }
  console.log(`Server running on ${address}`);
});
