import { GoogleGenAI } from "@google/genai";
import { Case, Session, ExpertSession, Judgment } from "../types";

const ai = new GoogleGenAI({ 
  apiKey: process.env.GEMINI_API_KEY || "" 
});

const MODEL_NAME = "gemini-3.7-flash";

/**
 * Generate comprehensive AI summary and legal strategy for a case
 */
export async function generateCaseSummary(
  caseData: Case,
  sessions: Session[],
  expertSessions: ExpertSession[],
  judgments: Judgment[]
): Promise<string> {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("مفتاح الذكاء الاصطناعي غير متوفر حالياً.");
  }

  const prompt = `
    أنت مستشار ومساعد قانوني ذكي متخصص في القانون الكويتي والأنظمة القضائية الخليجية.
    قم بتحليل ملف القضية القانونية التالية بعناية، وقدم ملخصاً تنفيذياً وتحليلاً استراتيجياً للمحامي المسؤول:

    بيانات القضية الأساسية:
    - رقم القضية: ${caseData.caseNumber} / ${caseData.year || ''}
    - المحكمة والدائرة: ${caseData.court} - ${caseData.circuit || 'غير محدد'}
    - الموكل: ${caseData.clientName} (${(caseData.clientPosition || caseData.clientRole) === 'plaintiff' ? 'المدعي' : (caseData.clientPosition || caseData.clientRole) === 'defendant' ? 'المدعى عليه' : 'طرف'})
    - الخصم: ${caseData.opponent || 'غير محدد'}
    - نوع الدعوى: ${caseData.caseType || 'عام'}
    - موضوع القضية وطلباتها: ${caseData.subject || 'غير محدد'}
    - الحالة الحالية: ${caseData.status}
    
    سجل الجلسات القضائية:
    ${sessions.length > 0 ? sessions.map(s => `- تاريخ: ${s.date}, القرار: ${s.decision || 'بانتظار القرار'}`).join('\n') : 'لا توجد جلسات مسجلة بعد'}
    
    سجل جلسات إدارة الخبراء:
    ${expertSessions.length > 0 ? expertSessions.map(s => `- الخبير: ${s.expertName}, التاريخ: ${s.date}, الحالة: ${s.status}, القرار: ${s.decision || 'قيد المتابعة'}`).join('\n') : 'لا توجد جلسات خبراء'}
    
    الأحكام القضائية الصادرة:
    ${judgments.length > 0 ? judgments.map(j => `- حكم بتاريخ: ${j.date}, النتيجة: ${j.result}, المنطوق: ${j.details || j.notes || '---'}`).join('\n') : 'لم يصدر حكم بعد'}

    المطلوب في التقرير:
    1. 📋 **ملخص تنفيذي موجز** لمسار النزاع ومركزه القانوني الحالي.
    2. ⚖️ **تقييم الموقف القانوني** للموكل ونقاط القوة والفرص.
    3. 💡 **التوصيات والإجراءات القادمة** (الدفوع المقترحة، المستندات المطلوب تجهيزها، أو الدفوع أمام الخبير).
    4. ⚠️ **تنبيه المواعيد والمخاطر** (أي ثغرات شكلية أو مواعيد سقوط أو طعن).

    الصياغة: لغة قانونية عربية رصينة ومباشرة بتنسيق Markdown مع عناوين واضحة ونقاط محددة.
  `;

  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
    });

    return response.text || "لم يتم استلام رد من النموذج.";
  } catch (error) {
    console.error("Gemini Error:", error);
    throw new Error("حدث خطأ أثناء استدعاء المساعد الذكي.");
  }
}

export interface LegalDraftRequest {
  documentType: 'defense_memo' | 'reply_memo' | 'plaint' | 'appeal' | 'cassation' | 'notice' | 'urgent_request';
  courtName?: string;
  circuitName?: string;
  caseNumber?: string;
  clientName?: string;
  clientRole?: string;
  opponentName?: string;
  opponentRole?: string;
  facts: string;
  legalGrounds?: string;
  requests: string;
  jurisdiction?: string;
  specificLawReferences?: string;
}

/**
 * Draft professional legal briefs and court documents
 */
export async function draftLegalDocument(request: LegalDraftRequest): Promise<string> {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("مفتاح الذكاء الاصطناعي غير متوفر.");
  }

  const docTypeTitles: Record<string, string> = {
    defense_memo: 'مذكرة بدفاع / رد موضوعي وشكلي',
    reply_memo: 'مذكرة تعقيبية ورد على مذكرة الخصم',
    plaint: 'صحيفة افتتاح دعوى',
    appeal: 'صحيفة استئناف حكم قضائي',
    cassation: 'صحيفة طعن بالتمييز (أسباب الطعن)',
    notice: 'إنذار رسمي على يد محضر',
    urgent_request: 'طلب عارض / استعجال / تصريح مستندات'
  };

  const prompt = `
    أنت محامٍ كويتي ومستشار قانوني أول ذو خبرة عريقة في الترافع أمام المحاكم الكويتية (الكلية، الاستئناف، والتمييز).
    المطلوب: صياغة مسودة وثيقة قانونية رفيعة المستوى متوافقة مع أصول وقواعد المرافعات والقوانين الموضوعية بدولة الكويت.

    بيانات الوثيقة المطلوبة:
    - نوع الوثيقة: ${docTypeTitles[request.documentType] || request.documentType}
    - المحكمة المختصة: ${request.courtName || 'محكمة الكويت الكلية'}
    - الدائرة: ${request.circuitName || 'الدائرة المدنية / التجارية'}
    - رقم الدعوى: ${request.caseNumber || '[يحدد لاحقاً]'}
    - الطرف الأول (الموكل): ${request.clientName || '[اسم الموكل]'} (${request.clientRole || 'المدعي/المستأنف'})
    - الطرف الثاني (الخصم): ${request.opponentName || '[اسم الخصم]'} (${request.opponentRole || 'المدعى عليه/المستأنف ضده'})
    
    وقائع النزاع وتفاصيله:
    ${request.facts}

    الدفوع والأسانيد القانونية المقترحة:
    ${request.legalGrounds || 'يرجى استنباط وتأسيس الدفوع القانونية والموضوعية الملائمة وفقاً للقانون الكويتي وأحكام محكمة التمييز الكويتية.'}

    الطلبات الختامية:
    ${request.requests || 'يرجى صياغة الطلبات الأصلية والاحتياطية بصورة قانونية جازمة.'}

    الملاحظات والأنظمة المرجعية:
    ${request.specificLawReferences || 'قانون المرافعات المدنية والتجارية الكويتي، القانون المدني، أو القوانين ذات الصلة حسب موضوع الدعوى.'}

    هيكل الصياغة المطلوب:
    1. ديباجة رسمية معتمدة (أمام محكمة...، الدائرة...، الجلسة المحددة...).
    2. بيان أطراف النزاع وصفاتهم.
    3. عرض الوقائع بإيجاز وترتيب زمني محكم.
    4. الدفاع والأسانيد القانونية (تأصيل الدفوع الشكلية أولاً إن وجدت، ثم الدفوع الموضوعية، مع الاستشهاد بنصوص المواد القانونية الكويتية ومبادئ محكمة التمييز المستقرة).
    5. بناء الدليل والرد على مزاعم الخصم المحتملة.
    6. الطلبات الختامية المصاغة بدقة (أصلياً، واحتياطياً).
    7. التذييل وتوقيع وكيل الطرف (مكتب المحامي).

    التنسيق: صياغة جاهزة للطباعة بصيغة Markdown منسقة بفواصل واضحة وعناوين بارزة.
  `;

  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
    });

    return response.text || "فشلت عملية صياغة المستند.";
  } catch (error) {
    console.error("Legal Draft Error:", error);
    throw new Error("حدث خطأ أثناء صياغة المذكرة القانونية.");
  }
}

/**
 * Analyze court judgments, extract ratio decidendi, operative judgment, and appeal routes
 */
export async function analyzeJudgmentText(judgmentText: string): Promise<{
  operativeSummary: string;
  keyReasoning: string[];
  strengths: string[];
  weaknesses: string[];
  appealDeadlineDays: number;
  appealGroundsSuggestions: string[];
  rawAnalysis: string;
}> {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("مفتاح الذكاء الاصطناعي غير متوفر.");
  }

  const prompt = `
    أنت خبير في تدقيق وتحليل الأحكام القضائية الصادرة عن المحاكم الكويتية.
    قم بقراءة نص الحكم القضائي أو ملخصه التالي بدقة، واستخرج تحليلاً تفصيلياً مع تحديد أسباب ومنطوق الحكم:

    نص الحكم القضائي:
    """
    ${judgmentText}
    """

    المطلوب: قدم تحليلاً شاملاً بصيغة JSON حصراً بدون أي كود آخر وفق البنية التالية:
    {
      "operativeSummary": "ملخص واضح ومباشر لمنطوق الحكم وما قضت به المحكمة",
      "keyReasoning": ["السبب الجوهري الأول الذي بنت عليه المحكمة قضاءها", "السبب الثاني", "..."],
      "strengths": ["نقاط القوة لصالحنا في هذا الحكم أو أسبابه"],
      "weaknesses": ["النقاط السلبية أو أوجه القصور التي تضر موقفنا في الحكم"],
      "appealDeadlineDays": 30, // ميعاد الطعن بالاستئناف أو التمييز المعتاد بالأيام وفق القانون الكويتي (مثلاً 30 للاستئناف، 60 للتمييز، 15 للمستعجل)
      "appealGroundsSuggestions": ["أوجه النعي والطعن المقترحة على الحكم (مثل: القصور في التسبيب، الخطأ في تطبيق القانون، الإخلال بحق الدفاع، الفساد في الاستدلال)"],
      "rawAnalysis": "تحليل قانوني تفصيلي وملاحظات عملية للمحامي المكلف بالملف بتنسيق Markdown"
    }
  `;

  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });

    const parsed = JSON.parse(response.text || '{}');
    return {
      operativeSummary: parsed.operativeSummary || 'تم استخراج التحليل بنجاح',
      keyReasoning: parsed.keyReasoning || [],
      strengths: parsed.strengths || [],
      weaknesses: parsed.weaknesses || [],
      appealDeadlineDays: typeof parsed.appealDeadlineDays === 'number' ? parsed.appealDeadlineDays : 30,
      appealGroundsSuggestions: parsed.appealGroundsSuggestions || [],
      rawAnalysis: parsed.rawAnalysis || response.text || ''
    };
  } catch (error) {
    console.error("Judgment Analysis Error:", error);
    // Fallback: regular prompt if JSON mode failed
    try {
      const fallbackResponse = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: `قم بتحليل هذا الحكم القضائي واستخراج المنطوق والأسباب وأوجه الطعن المقترحة:\n${judgmentText}`
      });
      return {
        operativeSummary: 'تحليل الحكم القضائي',
        keyReasoning: ['تحليل أسباب الحكم المرفق'],
        strengths: [],
        weaknesses: [],
        appealDeadlineDays: 30,
        appealGroundsSuggestions: ['القصور في التسبيب والفساد في الاستدلال'],
        rawAnalysis: fallbackResponse.text || ''
      };
    } catch {
      throw new Error("فشل تحليل نص الحكم القضائي.");
    }
  }
}

/**
 * Intelligent OCR / text extractor for court documents & summons
 */
export async function extractCaseDetailsFromText(rawText: string): Promise<{
  caseNumber?: string;
  year?: string;
  court?: string;
  circuit?: string;
  clientName?: string;
  opponentName?: string;
  caseType?: string;
  sessionDate?: string;
  subject?: string;
  extractedNotes?: string;
}> {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("مفتاح الذكاء الاصطناعي غير متوفر.");
  }

  const prompt = `
    قم باستخراج بيانات صحيفة الدعوى أو الإعلان القضائي الكويتي التالي وتحويلها إلى بيانات منظمة:
    """
    ${rawText}
    """

    أرجع النتيجة بصيغة JSON فقط:
    {
      "caseNumber": "رقم القضية إن وجد",
      "year": "السنة القضائية",
      "court": "المحكمة (مثل: محكمة الفروانية الكلية، قصر العدل، محكمة حولي، محكمة الأحمدي، الاستئناف، التمييز)",
      "circuit": "الدائرة إن وجدت",
      "clientName": "اسم المدعي أو الطالب أو الموكل",
      "opponentName": "اسم المدعى عليه أو المعلن إليه أو الخصم",
      "caseType": "نوع القضية (مدني، تجاري، عمالي، أحوال شخصية، إيجارات، جزائي، إداري)",
      "sessionDate": "تاريخ الجلسة المحددة بصيغة YYYY-MM-DD إن وجد",
      "subject": "موضوع الدعوى والطلبات بإيجاز",
      "extractedNotes": "أي ملاحظات إضافية مهمة أو أرقام آلية"
    }
  `;

  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });

    return JSON.parse(response.text || '{}');
  } catch (error) {
    console.error("Extraction error:", error);
    return {};
  }
}
