import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, orderBy, onSnapshot, addDoc } from 'firebase/firestore';
import {
  Sparkles,
  FileText,
  Gavel,
  BookOpen,
  Copy,
  Check,
  Download,
  Printer,
  RefreshCw,
  Send,
  Scale,
  Calendar,
  AlertTriangle,
  FolderPlus,
  Zap,
  FileSearch,
  CheckCircle2,
  HelpCircle
} from 'lucide-react';
import { Case, UserProfile } from '../types';
import { draftLegalDocument, analyzeJudgmentText, extractCaseDetailsFromText, LegalDraftRequest } from '../services/geminiService';
import toast from 'react-hot-toast';
import ReactMarkdown from 'react-markdown';

interface AILegalAssistantProps {
  user: UserProfile;
}

export default function AILegalAssistant({ user }: AILegalAssistantProps) {
  const [activeTab, setActiveTab] = useState<'draft' | 'analyzer' | 'extractor' | 'advisor'>('draft');
  const [cases, setCases] = useState<Case[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState<string>('');

  // Drafting State
  const [draftType, setDraftType] = useState<LegalDraftRequest['documentType']>('defense_memo');
  const [courtName, setCourtName] = useState('محكمة الكويت الكلية');
  const [circuitName, setCircuitName] = useState('الدائرة المدنية والتجارية');
  const [caseNumber, setCaseNumber] = useState('');
  const [clientName, setClientName] = useState('');
  const [clientRole, setClientRole] = useState('المدعى عليه');
  const [opponentName, setOpponentName] = useState('');
  const [opponentRole, setOpponentRole] = useState('المدعي');
  const [facts, setFacts] = useState('');
  const [legalGrounds, setLegalGrounds] = useState('');
  const [requests, setRequests] = useState('');
  const [isGeneratingDraft, setIsGeneratingDraft] = useState(false);
  const [generatedDraft, setGeneratedDraft] = useState<string>('');
  const [copiedDraft, setCopiedDraft] = useState(false);

  // Judgment Analyzer State
  const [judgmentInput, setJudgmentInput] = useState('');
  const [isAnalyzingJudgment, setIsAnalyzingJudgment] = useState(false);
  const [judgmentResult, setJudgmentResult] = useState<{
    operativeSummary: string;
    keyReasoning: string[];
    strengths: string[];
    weaknesses: string[];
    appealDeadlineDays: number;
    appealGroundsSuggestions: string[];
    rawAnalysis: string;
  } | null>(null);

  // Document Extractor State
  const [rawCourtText, setRawCourtText] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractedData, setExtractedData] = useState<any>(null);

  // Legal Advisor State
  const [legalQuestion, setLegalQuestion] = useState('');
  const [lawBranch, setLawBranch] = useState('مدني وتجاري');
  const [isAdvising, setIsAdvising] = useState(false);
  const [advisorResponse, setAdvisorResponse] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'cases'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Case));
      setCases(docs);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'cases'));

    return () => unsub();
  }, []);

  const handleCaseSelect = (id: string) => {
    setSelectedCaseId(id);
    if (!id) return;
    const selected = cases.find(c => c.id === id);
    if (selected) {
      setCaseNumber(`${selected.caseNumber || ''} / ${selected.year || ''}`);
      setCourtName(selected.court || 'محكمة الكويت الكلية');
      setCircuitName(selected.circuit || 'الدائرة المدنية');
      setClientName(selected.clientName || '');
      setOpponentName(selected.opponent || '');
      const role = selected.clientPosition || selected.clientRole;
      setClientRole(role === 'plaintiff' ? 'المدعي' : role === 'defendant' ? 'المدعى عليه' : 'الموكل');
      setOpponentRole(role === 'plaintiff' ? 'المدعى عليه' : role === 'defendant' ? 'المدعي' : 'الخصم');
      if (selected.subject && !facts) {
        setFacts(`موضوع الدعوى: ${selected.subject}`);
      }
    }
  };

  const handleGenerateDraft = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!facts.trim()) {
      toast.error('يرجى كتابة وقائع الدعوى والنزاع أولاً');
      return;
    }

    try {
      setIsGeneratingDraft(true);
      const result = await draftLegalDocument({
        documentType: draftType,
        courtName,
        circuitName,
        caseNumber,
        clientName,
        clientRole,
        opponentName,
        opponentRole,
        facts,
        legalGrounds,
        requests,
      });
      setGeneratedDraft(result);
      toast.success('تمت صياغة المذكرة القانونية بنجاح!');
    } catch (err: any) {
      toast.error(err?.message || 'تعذر صياغة المذكرة.');
    } finally {
      setIsGeneratingDraft(false);
    }
  };

  const handleAnalyzeJudgment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!judgmentInput.trim()) {
      toast.error('يرجى لصق نص أو منطوق الحكم أولاً');
      return;
    }

    try {
      setIsAnalyzingJudgment(true);
      const result = await analyzeJudgmentText(judgmentInput);
      setJudgmentResult(result);
      toast.success('تم تحليل الحكم واستخراج الأسباب ومواعيد الطعن!');
    } catch (err: any) {
      toast.error(err?.message || 'فشل تحليل الحكم.');
    } finally {
      setIsAnalyzingJudgment(false);
    }
  };

  const handleExtractDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rawCourtText.trim()) {
      toast.error('يرجى لصق نص الصحيفة أو الإعلان');
      return;
    }

    try {
      setIsExtracting(true);
      const res = await extractCaseDetailsFromText(rawCourtText);
      setExtractedData(res);
      toast.success('تم استخراج البيانات القانونية بنجاح!');
    } catch (err: any) {
      toast.error('تعذر استخراج البيانات.');
    } finally {
      setIsExtracting(false);
    }
  };

  const handleSaveToDeadlines = async () => {
    if (!judgmentResult) return;
    try {
      const today = new Date();
      const deadlineDate = new Date();
      deadlineDate.setDate(today.getDate() + (judgmentResult.appealDeadlineDays || 30));

      await addDoc(collection(db, 'deadlines'), {
        title: `ميعاد طعن / استئناف حكم قضائي (${judgmentResult.appealDeadlineDays} يوم)`,
        caseNumber: caseNumber || 'قضية حديثة',
        court: courtName || 'محكمة الاستئناف',
        type: 'appeal',
        dueDate: deadlineDate.toISOString().split('T')[0],
        description: `أسباب الطعن المقترحة: ${judgmentResult.appealGroundsSuggestions.join(' - ')}`,
        status: 'pending',
        createdAt: new Date().toISOString(),
        createdBy: user.uid
      });

      toast.success('تمت إضافة ميعاد الطعن إلى قسم المواعيد القانونية بنجاح!');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'deadlines');
    }
  };

  const handleSaveDraftAsDocument = async () => {
    if (!generatedDraft || !selectedCaseId) {
      toast.error('يرجى اختيار قضية أولاً لحفظ المذكرة في ملفاتها');
      return;
    }

    try {
      await addDoc(collection(db, 'documents'), {
        caseId: selectedCaseId,
        title: `مسودة مذكرة: ${draftType === 'defense_memo' ? 'دفاع' : draftType === 'appeal' ? 'استئناف' : 'قانونية'} - ${new Date().toLocaleDateString('ar-KW')}`,
        type: 'legal_draft',
        content: generatedDraft,
        createdAt: new Date().toISOString(),
        uploadedBy: user.name,
        size: generatedDraft.length,
        notes: 'تمت صياغتها بواسطة مساعد الأمين الذكي'
      });

      toast.success('تم حفظ مسودة المذكرة في أرشيف القضية بنجاح!');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'documents');
    }
  };

  const handleCopyDraft = () => {
    if (!generatedDraft) return;
    navigator.clipboard.writeText(generatedDraft);
    setCopiedDraft(true);
    toast.success('تم نسخ نص المذكرة إلى الحافظة!');
    setTimeout(() => setCopiedDraft(false), 2000);
  };

  const handlePrintDraft = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`
      <html dir="rtl">
        <head>
          <title>صياغة قانونية - ${courtName}</title>
          <style>
            body { font-family: system-ui, -apple-system, sans-serif; padding: 40px; line-height: 1.8; color: #1e293b; }
            h1, h2, h3 { color: #0f172a; margin-top: 24px; margin-bottom: 12px; }
            p { margin-bottom: 16px; text-align: justify; }
            .header { text-align: center; border-bottom: 2px solid #334155; padding-bottom: 20px; margin-bottom: 30px; }
            .footer { margin-top: 50px; text-align: left; }
          </style>
        </head>
        <body>
          <div class="header">
            <h2>دولة الكويت - قصر العدل</h2>
            <h3>${courtName} - ${circuitName}</h3>
          </div>
          <div style="white-space: pre-wrap;">${generatedDraft}</div>
          <div class="footer">
            <p><strong>وكيل الطرف:</strong> مكتب المحامي</p>
          </div>
          <script>window.print();</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header Banner */}
      <div className="bg-slate-900 rounded-3xl p-6 lg:p-8 text-white relative overflow-hidden shadow-xl border border-slate-800">
        <div className="absolute top-0 left-0 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-80 h-80 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-500/20 border border-indigo-500/30 rounded-full text-indigo-300 text-xs font-bold">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
              <span>مساعد الذكاء الاصطناعي القانوني الكويتي</span>
            </div>
            <h1 className="text-2xl lg:text-3xl font-black tracking-tight text-white">المستشار وصائغ المذكرات الذكي</h1>
            <p className="text-slate-300 text-sm max-w-2xl font-medium leading-relaxed">
              صياغة مذكرات الدفاع وصحائف الدعاوى والطعون، تحليل الأحكام واستخراج منطوقها ومواعيد الاستئناف، واستنباط الدفوع وفق القانون الكويتي.
            </p>
          </div>

          <div className="flex items-center gap-2 bg-slate-800/80 p-1.5 rounded-2xl border border-slate-700/60 shrink-0">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-md">
              <Scale className="w-5 h-5" />
            </div>
            <div className="px-2">
              <p className="text-xs font-bold text-slate-300">نظام الصياغة</p>
              <p className="text-xs font-black text-emerald-400">جاهز ومفعل ⚡</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 overflow-x-auto pb-2">
        {[
          { id: 'draft', label: 'صياغة المذكرات والصحف', icon: FileText },
          { id: 'analyzer', label: 'تحليل وتفكيك الأحكام', icon: Gavel },
          { id: 'extractor', label: 'استخراج بيانات الصحف (OCR)', icon: FileSearch },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-xs font-black transition-all whitespace-nowrap ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-100'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* TAB 1: DRAFTING STUDIO */}
      {activeTab === 'draft' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Controls & Inputs (5 Cols) */}
          <div className="lg:col-span-5 bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <h3 className="font-black text-slate-900 text-base flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-600" />
                بيانات وإعدادات الصياغة
              </h3>
            </div>

            <form onSubmit={handleGenerateDraft} className="space-y-4">
              {/* Quick Case Select */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">استيراد بيانات من قضية مسجلة (اختياري)</label>
                <select
                  value={selectedCaseId}
                  onChange={(e) => handleCaseSelect(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                >
                  <option value="">-- اختر قضية لاستيراد بياناتها تلقائياً --</option>
                  {cases.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.caseNumber}/{c.year} - {c.clientName} ضد {c.opponent || 'الخصم'}
                    </option>
                  ))}
                </select>
              </div>

              {/* Document Type */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">نوع الوثيقة القانونية</label>
                <select
                  value={draftType}
                  onChange={(e) => setDraftType(e.target.value as any)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                >
                  <option value="defense_memo">مذكرة بدفاع / رد موضوعي وشكلي</option>
                  <option value="reply_memo">مذكرة تعقيبية ورد على دفاع الخصم</option>
                  <option value="plaint">صحيفة افتتاح دعوى</option>
                  <option value="appeal">صحيفة استئناف حكم قضائي</option>
                  <option value="cassation">صحيفة طعن بالتمييز (أسباب الطعن)</option>
                  <option value="notice">إنذار رسمي على يد محضر</option>
                  <option value="urgent_request">طلب عارض / استعجال / تصريح مستندات</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">المحكمة</label>
                  <input
                    type="text"
                    value={courtName}
                    onChange={(e) => setCourtName(e.target.value)}
                    placeholder="مثال: محكمة الكويت الكلية"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">الدائرة</label>
                  <input
                    type="text"
                    value={circuitName}
                    onChange={(e) => setCircuitName(e.target.value)}
                    placeholder="مثال: مدني كلي / تجاري"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">اسم الموكل</label>
                  <input
                    type="text"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    placeholder="اسم الموكل"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">صفة الموكل</label>
                  <input
                    type="text"
                    value={clientRole}
                    onChange={(e) => setClientRole(e.target.value)}
                    placeholder="المدعي / المدعى عليه / المستأنف"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">اسم الخصم</label>
                  <input
                    type="text"
                    value={opponentName}
                    onChange={(e) => setOpponentName(e.target.value)}
                    placeholder="اسم الخصم"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">رقم الدعوى</label>
                  <input
                    type="text"
                    value={caseNumber}
                    onChange={(e) => setCaseNumber(e.target.value)}
                    placeholder="مثال: 1234/2026 مدني"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  وقائع النزاع وتفاصيل الموضوع <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={4}
                  value={facts}
                  onChange={(e) => setFacts(e.target.value)}
                  placeholder="اكتب تسلسل الوقائع بإيجاز، مثل: إبرام عقد مقاولة، امتناع الخصم عن السداد، تسليم الأعمال، الإنذار..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  الدفوع والأسانيد القانونية (اختياري)
                </label>
                <textarea
                  rows={2}
                  value={legalGrounds}
                  onChange={(e) => setLegalGrounds(e.target.value)}
                  placeholder="مثال: الدفع بالتقادم، الدفع بعدم قبول الدعوى لرفعها من غير ذي صفة، المادة 209 مدني..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  الطلبات الختامية (اختياري)
                </label>
                <input
                  type="text"
                  value={requests}
                  onChange={(e) => setRequests(e.target.value)}
                  placeholder="مثال: أصلياً برفض الدعوى، واحتياطياً بإحالتها لإدارة الخبراء..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={isGeneratingDraft}
                className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-sm transition-all shadow-md shadow-indigo-100 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isGeneratingDraft ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    جاري الصياغة والتأصيل القانوني...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    توليد المذكرة بالصياغة القانونية
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Generated Document Output (7 Cols) */}
          <div className="lg:col-span-7 bg-white rounded-3xl p-6 border border-slate-200 shadow-sm flex flex-col min-h-[500px]">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
              <div>
                <h3 className="font-black text-slate-900 text-base">مسودة الوثيقة القانونية المنجزة</h3>
                <p className="text-xs font-bold text-slate-400">صياغة قانونية متكاملة وفق أحكام القضاء الكويتي</p>
              </div>

              {generatedDraft && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopyDraft}
                    className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
                    title="نسخ النص"
                  >
                    {copiedDraft ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                    نسخ
                  </button>
                  <button
                    onClick={handlePrintDraft}
                    className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
                    title="طباعة"
                  >
                    <Printer className="w-4 h-4" />
                    طباعة
                  </button>
                  {selectedCaseId && (
                    <button
                      onClick={handleSaveDraftAsDocument}
                      className="px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
                    >
                      <FolderPlus className="w-4 h-4" />
                      حفظ في ملف القضية
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="flex-1 bg-slate-50 rounded-2xl p-6 border border-slate-200/80 overflow-y-auto max-h-[600px] select-text">
              {generatedDraft ? (
                <div className="prose prose-slate max-w-none text-right font-sans text-sm leading-relaxed" dir="rtl">
                  <ReactMarkdown>{generatedDraft}</ReactMarkdown>
                </div>
              ) : (
                <div className="h-full min-h-[300px] flex flex-col items-center justify-center text-slate-400 gap-3 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-400 border border-indigo-100">
                    <FileText className="w-7 h-7" />
                  </div>
                  <div>
                    <p className="font-black text-slate-700 text-sm">المسودة فارغة حالياً</p>
                    <p className="text-xs text-slate-400 max-w-xs mt-1">
                      قم بتعبئة وقائع النزاع والبيانات على اليمين ثم اضغط "توليد المذكرة" لإنشاء صيغة قضائية احترافية.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: JUDGMENT ANALYZER */}
      {activeTab === 'analyzer' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="font-black text-slate-900 text-base flex items-center gap-2">
                <Gavel className="w-5 h-5 text-indigo-600" />
                تحليل وتفكيك أسباب الحكم القضائي
              </h3>
              <p className="text-xs font-bold text-slate-400 mt-1">
                الصق نص أو حيثيات الحكم لاستخراج المنطوق، أسباب القضاء، مواعيد الطعن، وأوجه النعي المقترحة.
              </p>
            </div>

            <form onSubmit={handleAnalyzeJudgment} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">نص أو حيثيات ومنطوق الحكم القضائي</label>
                <textarea
                  rows={9}
                  value={judgmentInput}
                  onChange={(e) => setJudgmentInput(e.target.value)}
                  placeholder="حكمت المحكمة حضورياً / بمثابة الحضوري في مادة تجارية... برفض الدعوى وإلزام المدعي بالمصروفات وأسست قضاءها على عدم تقديم أصل المستند..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={isAnalyzingJudgment}
                className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-sm transition-all shadow-md shadow-indigo-100 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isAnalyzingJudgment ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    جاري تفكيك وتحليل الحكم...
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4" />
                    بدء التحليل واستخراج مواعيد الطعن
                  </>
                )}
              </button>
            </form>
          </div>

          <div className="lg:col-span-7 bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-black text-slate-900 text-base">تقرير فحص الحكم ومواعيد الطعن</h3>
              {judgmentResult && (
                <button
                  onClick={handleSaveToDeadlines}
                  className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-black transition-all flex items-center gap-1.5"
                >
                  <Calendar className="w-4 h-4" />
                  إضافة لمواعيد الطعن
                </button>
              )}
            </div>

            {judgmentResult ? (
              <div className="space-y-4 max-h-[600px] overflow-y-auto pr-1">
                {/* Operative Summary */}
                <div className="p-4 bg-slate-900 text-white rounded-2xl border border-slate-800">
                  <div className="flex items-center gap-2 text-indigo-300 text-xs font-bold mb-1">
                    <Gavel className="w-4 h-4" />
                    منطوق الحكم المستخلص
                  </div>
                  <p className="text-sm font-bold leading-relaxed">{judgmentResult.operativeSummary}</p>
                </div>

                {/* Key Reasoning */}
                <div className="p-4 bg-amber-50/70 border border-amber-200/80 rounded-2xl space-y-2">
                  <h4 className="text-xs font-black text-amber-900 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    الأسباب والركائز الجوهرية للحكم:
                  </h4>
                  <ul className="list-disc list-inside space-y-1 text-xs font-bold text-amber-950">
                    {judgmentResult.keyReasoning.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </div>

                {/* Appeal Suggestions & Deadline */}
                <div className="p-4 bg-indigo-50 border border-indigo-200/80 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black text-indigo-950 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-indigo-600" />
                      أوجه الطعن المقترحة (للاستئناف أو التمييز):
                    </h4>
                    <span className="px-2.5 py-1 bg-indigo-600 text-white rounded-lg text-[10px] font-black">
                      ميعاد الطعن: {judgmentResult.appealDeadlineDays} يوم
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {judgmentResult.appealGroundsSuggestions.map((g, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs font-bold text-indigo-900">
                        <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                        <span>{g}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Detailed Analysis Markdown */}
                {judgmentResult.rawAnalysis && (
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium text-slate-700 leading-relaxed">
                    <ReactMarkdown>{judgmentResult.rawAnalysis}</ReactMarkdown>
                  </div>
                )}
              </div>
            ) : (
              <div className="h-64 flex flex-col items-center justify-center text-slate-400 gap-2 text-center">
                <Gavel className="w-10 h-10 text-slate-300" />
                <p className="font-bold text-xs">بانتظار إدخال منطوق أو أسباب الحكم لإجراء التحليل القانوني</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: DOCUMENT OCR & DATA EXTRACTOR */}
      {activeTab === 'extractor' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-6 bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
            <div>
              <h3 className="font-black text-slate-900 text-base flex items-center gap-2">
                <FileSearch className="w-5 h-5 text-indigo-600" />
                استخراج بيانات الصحف والإعلانات القضائية
              </h3>
              <p className="text-xs font-bold text-slate-400 mt-1">
                انسخ النص من ملف PDF أو الصحيفة أو الإعلان القضائي، وسيقوم الذكاء الاصطناعي باستخراج رقم الدعوى والأطراف والجلسة تلقائياً.
              </p>
            </div>

            <form onSubmit={handleExtractDetails} className="space-y-4">
              <textarea
                rows={10}
                value={rawCourtText}
                onChange={(e) => setRawCourtText(e.target.value)}
                placeholder="إعلان صحيفة دعوى: بناء على طلب السيد/ ... ومحله المختار مكتب المحامي... أعلنت أنا مندوب الإعلان بمحكمة الفروانية السيد/ ... لحضور جلسة يوم الأحد الموافق 2026/09/15 أمام الدائرة المدنية رقم 4..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                required
              />

              <button
                type="submit"
                disabled={isExtracting}
                className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-sm transition-all shadow-md shadow-indigo-100 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isExtracting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    جاري استخراج وتحليل البيانات...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    استخراج البيانات المنظمة
                  </>
                )}
              </button>
            </form>
          </div>

          <div className="lg:col-span-6 bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
            <h3 className="font-black text-slate-900 text-base border-b border-slate-100 pb-3">
              البيانات المستخرجة الجاهزة للتسجيل
            </h3>

            {extractedData ? (
              <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-white rounded-xl border border-slate-200">
                    <p className="text-[10px] font-bold text-slate-400">رقم القضية والسنة</p>
                    <p className="text-xs font-black text-slate-900 mt-0.5">{extractedData.caseNumber || '---'} / {extractedData.year || '---'}</p>
                  </div>
                  <div className="p-3 bg-white rounded-xl border border-slate-200">
                    <p className="text-[10px] font-bold text-slate-400">نوع الدعوى</p>
                    <p className="text-xs font-black text-indigo-600 mt-0.5">{extractedData.caseType || 'عام'}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-white rounded-xl border border-slate-200">
                    <p className="text-[10px] font-bold text-slate-400">المحكمة</p>
                    <p className="text-xs font-black text-slate-900 mt-0.5">{extractedData.court || '---'}</p>
                  </div>
                  <div className="p-3 bg-white rounded-xl border border-slate-200">
                    <p className="text-[10px] font-bold text-slate-400">الدائرة</p>
                    <p className="text-xs font-black text-slate-900 mt-0.5">{extractedData.circuit || '---'}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-white rounded-xl border border-slate-200">
                    <p className="text-[10px] font-bold text-slate-400">المدعي / الطالب</p>
                    <p className="text-xs font-black text-emerald-700 mt-0.5">{extractedData.clientName || '---'}</p>
                  </div>
                  <div className="p-3 bg-white rounded-xl border border-slate-200">
                    <p className="text-[10px] font-bold text-slate-400">المدعى عليه / الخصم</p>
                    <p className="text-xs font-black text-red-700 mt-0.5">{extractedData.opponentName || '---'}</p>
                  </div>
                </div>

                {extractedData.sessionDate && (
                  <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-bold text-indigo-700">تاريخ الجلسة المحددة</p>
                      <p className="text-xs font-black text-indigo-950 mt-0.5">{extractedData.sessionDate}</p>
                    </div>
                    <Calendar className="w-5 h-5 text-indigo-600" />
                  </div>
                )}

                {extractedData.subject && (
                  <div className="p-3 bg-white rounded-xl border border-slate-200">
                    <p className="text-[10px] font-bold text-slate-400">موضوع وطلبات الدعوى</p>
                    <p className="text-xs font-bold text-slate-800 mt-0.5">{extractedData.subject}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="h-64 flex flex-col items-center justify-center text-slate-400 gap-2 text-center">
                <FileSearch className="w-10 h-10 text-slate-300" />
                <p className="font-bold text-xs">الصق نص الصحيفة واضغط استخراج لتحويلها لحقول منظمة</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
