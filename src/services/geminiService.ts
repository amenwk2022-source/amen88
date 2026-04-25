import { GoogleGenAI } from "@google/genai";
import { Case, Session, ExpertSession, Judgment } from "../types";

const ai = new GoogleGenAI({ 
  apiKey: process.env.GEMINI_API_KEY || "" 
});

export async function generateCaseSummary(
  caseData: Case,
  sessions: Session[],
  expertSessions: ExpertSession[],
  judgments: Judgment[]
): Promise<string> {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("Gemini API key is not configured.");
  }

  const prompt = `
    بصفتك مساعد قانوني ذكي، قم بتحليل بيانات القضية التالية وتزويدنا بملخص تنفيذي دقيق واقتراحات للخطوات القادمة.
    البيانات:
    - رقم القضية: ${caseData.caseNumber}
    - النوع: ${caseData.caseType}
    - المحكمة: ${caseData.court}
    - الحالة الحالية: ${caseData.status}
    
    الجلسات السابقة والقادمة:
    ${sessions.map(s => `- تاريخ: ${s.date}, القرار: ${s.decision || 'بانتظار القرار'}`).join('\n')}
    
    جلسات الخبراء:
    ${expertSessions.map(s => `- خبير: ${s.expertName}, التاريخ: ${s.date}`).join('\n')}
    
    الأحكام الصادرة:
    ${judgments.map(j => `- حكم بتاريخ: ${j.date}, النتيجة: ${j.result}`).join('\n')}

    المطلوب:
    1. ملخص سريع لحالة القضية.
    2. تحليل لما تم تحقيقه حتى الآن.
    3. توصيات للخطوات القانونية القادمة (أفكار ذكية).
    4. تنبيه لأي مواعيد حرجة أو ثغرات ملاحظة.
    
    اللغة: العربية الفصحى القانونية.
    التنسيق: Markdown.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    });

    return response.text || "فشل توليد الملخص.";
  } catch (error) {
    console.error("Gemini Error:", error);
    throw new Error("حدث خطأ أثناء الاتصال بالذكاء الاصطناعي.");
  }
}
