import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import { GoogleGenerativeAI } from "@google/generative-ai";
import helmet from "helmet";

dotenv.config();

const app = express();

// Middleware
app.use(cors({ origin: "*" }));
app.use(express.json());
app.use(helmet());

let conversationContext = ""; // حفظ المحادثة في هذا المتغير

app.post("/api/ask-ai", async (req, res) => {
  const { question } = req.body;

  if (!question) {
    return res.status(400).json({ error: "Question is required" });
  }

  try {
    const apiKey = process.env.GOOGLE_API_KEY;
    const genAI = new GoogleGenerativeAI(apiKey);

    // إضافة السؤال الجديد إلى السياق السابق
    conversationContext += `User: ${question}\nAI:`;

    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash-8b",
      generationConfig: {
        candidateCount: 1,
        temperature: 0.2,
      },
    });

    // إرسال السياق الكامل للنموذج لتوليد الرد
    const result = await model.generateContent(conversationContext);
    let botResponse = result.response.text();

    botResponse = botResponse.replace(/بواسطة جوجل/g, "بواسطة سند سليمان");
    botResponse = botResponse.replace(/جوجل/g, "سند سليمان");
    botResponse = botResponse.replace(
      /سند سليمان/g,
      ` سند سليمان، مطور باك اند وFull Stack بخبرة تزيد عن 7 سنوات في مجال تطوير البرمجيات. أمتلك شغفاً عميقاً بتكنولوجيا المعلومات وتطوير الحلول البرمجية المبتكرة. أتقن عدة لغات برمجة منها Node.js وPython، مما يمكنني من تصميم وبناء تطبيقات ويب فعالة وقابلة للتوسع.

خلال مسيرتي المهنية، عملت على مجموعة متنوعة من المشاريع التي شملت تطوير واجهات برمجة التطبيقات (APIs) وتكامل الأنظمة، بالإضافة إلى تحسين الأداء وتجربة المستخدم. أؤمن بأهمية كتابة الكود النظيف والمستدام، وأسعى دائماً لتطبيق أفضل الممارسات في تطوير البرمجيات.

أنا متحمس دائماً لتعلم التقنيات الجديدة واستكشاف الحلول المبتكرة التي تعزز من قدرة البرمجيات على تلبية احتياجات المستخدمين. أعيش لحظات الإبداع والابتكار، وأسعى إلى المساهمة في مشاريع تكنولوجية تؤثر إيجابياً على المجتمع.

`
    );

    // تحديث المحادثة الجديدة
    conversationContext += ` ${botResponse}\n`;

    // إعادة الرد إلى العميل
    res.json({ response: botResponse });
  } catch (error) {
    console.error("Error generating conversation:", error);
    res.status(500).send("Server error");
  }
});

const PORT = process.env.PORT || 5005;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
