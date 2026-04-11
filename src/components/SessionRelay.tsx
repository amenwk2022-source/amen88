import React, { useState, useEffect, useRef } from 'react';
import { collection, addDoc, onSnapshot, query, orderBy, doc, updateDoc, where, getDoc, deleteDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useNavigate } from 'react-router-dom';
import { CalendarClock, ArrowRightLeft, AlertCircle, CheckCircle2, Clock, Search, Filter, Download, MessageSquare, Save, X, Scale, FileText, ImageIcon, Trash2, Printer, CalendarDays, CheckCircle, XCircle, Plus, Edit2, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Session, Case, UserProfile, ExpertSession } from '../types';
import { cn } from '../lib/utils';
import { format, isPast, isToday, isFuture, addDays } from 'date-fns';
import { arSA } from 'date-fns/locale';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

interface SessionRelayProps {
  user: UserProfile;
}

export default function SessionRelay({ user }: SessionRelayProps) {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [expertSessions, setExpertSessions] = useState<ExpertSession[]>([]);
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'today' | 'upcoming' | 'omitted' | 'search'>('today');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedCourt, setSelectedCourt] = useState('ALL');
  const [editingSession, setEditingSession] = useState<Session | null>(null);
  const [decision, setDecision] = useState('');
  const [nextDate, setNextDate] = useState('');
  const [isJudgment, setIsJudgment] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isAddSessionModalOpen, setIsAddSessionModalOpen] = useState(false);
  const [isEditSessionModalOpen, setIsEditSessionModalOpen] = useState(false);
  const [selectedCaseId, setSelectedCaseId] = useState<string>('');
  const [editDate, setEditDate] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isRelaying, setIsRelaying] = useState(false);
  const [success, setSuccess] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  const [isDecisionModalOpen, setIsDecisionModalOpen] = useState(false);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);

  useEffect(() => {
    let cq = query(collection(db, 'cases'), orderBy('createdAt', 'desc'));

    if (user.role === 'client') {
      cq = query(collection(db, 'cases'), where('clientId', '==', user.uid));
    }

    const unsub = onSnapshot(collection(db, 'sessions'), (snapshot) => {
      setSessions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Session)));
      setLoading(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'sessions');
      setLoading(false);
    });

    const casesUnsub = onSnapshot(cq, (snapshot) => {
      setCases(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Case)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'cases'));

    const expertUnsub = onSnapshot(collection(db, 'expertSessions'), (snapshot) => {
      setExpertSessions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ExpertSession)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'expertSessions'));

    return () => {
      unsub();
      casesUnsub();
      expertUnsub();
    };
  }, [user.uid, user.role]);

  const handleRelay = async () => {
    if (user.role === 'client') return;
    if (!selectedSession || !decision) {
      setError('يرجى إدخال القرار');
      return;
    }

    if (!isJudgment && !nextDate) {
      setError('يرجى إدخال تاريخ الجلسة القادمة أو تحديد أنها جلسة حكم');
      return;
    }

    try {
      setError(null);
      setIsRelaying(true);
      
      // 1. Update current session with decision
      await updateDoc(doc(db, 'sessions', selectedSession.id), {
        decision,
        nextDate: isJudgment ? '' : nextDate,
        updatedAt: new Date().toISOString()
      });

      // 2. If not judgment, create new session for the next date (Relay)
      if (!isJudgment) {
        await addDoc(collection(db, 'sessions'), {
          caseId: selectedSession.caseId,
          date: nextDate,
          decision: '',
          nextDate: '',
          lawyerId: selectedSession.lawyerId || '',
          createdAt: new Date().toISOString()
        });
      } else {
        // If judgment, update case status
        const caseRef = doc(db, 'cases', selectedSession.caseId);
        await updateDoc(caseRef, {
          status: 'judgment',
          updatedAt: new Date().toISOString()
        });
      }

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
      setIsDecisionModalOpen(false);
      setSelectedSession(null);
      setDecision('');
      setNextDate('');
      setIsJudgment(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'sessions');
    } finally {
      setIsRelaying(false);
    }
  };

  const handleAddSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCaseId || !nextDate) {
      setError('يرجى اختيار القضية وتاريخ الجلسة');
      return;
    }

    try {
      setIsRelaying(true);
      await addDoc(collection(db, 'sessions'), {
        caseId: selectedCaseId,
        date: nextDate,
        decision: '',
        nextDate: '',
        lawyerId: user.uid,
        createdAt: new Date().toISOString()
      });
      setIsAddSessionModalOpen(false);
      setSelectedCaseId('');
      setNextDate('');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'sessions');
    } finally {
      setIsRelaying(false);
    }
  };

  const handleEditSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSession || !editDate) return;

    try {
      setIsRelaying(true);
      await updateDoc(doc(db, 'sessions', selectedSession.id), {
        date: editDate,
        updatedAt: new Date().toISOString()
      });
      setIsEditSessionModalOpen(false);
      setSelectedSession(null);
      setEditDate('');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'sessions');
    } finally {
      setIsRelaying(false);
    }
  };

  const handleDeleteSession = async (id: string) => {
    if (user.role === 'client') return;
    if (!window.confirm('هل أنت متأكد من حذف هذه الجلسة؟')) return;
    try {
      await deleteDoc(doc(db, 'sessions', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'sessions');
    }
  };

  const handleMoveToJudgment = async (session: Session) => {
    if (user.role === 'client') return;
    if (!session.caseId) return;
    
    try {
      setIsRelaying(true);
      const caseRef = doc(db, 'cases', session.caseId);
      await updateDoc(caseRef, {
        status: 'archive',
        updatedAt: new Date().toISOString()
      });
      
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'cases');
    } finally {
      setIsRelaying(false);
    }
  };

  const exportAsImage = async () => {
    if (!exportRef.current) return;
    try {
      setIsExporting(true);
      const canvas = await html2canvas(exportRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        onclone: (clonedDoc) => {
          // Robust fix for oklch error: Remove all stylesheets that might contain oklch
          // and replace with a simple style for the export area
          const styleSheets = Array.from(clonedDoc.styleSheets);
          for (const sheet of styleSheets) {
            try {
              const rules = Array.from(sheet.cssRules);
              for (let i = rules.length - 1; i >= 0; i--) {
                if (rules[i].cssText.includes('oklch')) {
                  sheet.deleteRule(i);
                }
              }
            } catch (e) {
              // Some sheets might be cross-origin or inaccessible, just remove them
              if (sheet.ownerNode && sheet.ownerNode.parentNode) {
                sheet.ownerNode.parentNode.removeChild(sheet.ownerNode);
              }
            }
          }
          
          // Ensure the export area itself is visible and has correct styles
          const exportEl = clonedDoc.getElementById('export-area');
          if (exportEl) {
            exportEl.style.position = 'static';
            exportEl.style.left = '0';
            exportEl.style.display = 'block';
          }
        }
      });
      const link = document.createElement('a');
      link.download = `رول_جلسات_${format(displayDate, 'yyyy-MM-dd')}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      setIsExporting(false);
    }
  };

  const exportAsPDF = async () => {
    if (!exportRef.current) return;
    try {
      setIsExporting(true);
      const canvas = await html2canvas(exportRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        onclone: (clonedDoc) => {
          // Robust fix for oklch error: Remove all stylesheets that might contain oklch
          const styleSheets = Array.from(clonedDoc.styleSheets);
          for (const sheet of styleSheets) {
            try {
              const rules = Array.from(sheet.cssRules);
              for (let i = rules.length - 1; i >= 0; i--) {
                if (rules[i].cssText.includes('oklch')) {
                  sheet.deleteRule(i);
                }
              }
            } catch (e) {
              if (sheet.ownerNode && sheet.ownerNode.parentNode) {
                sheet.ownerNode.parentNode.removeChild(sheet.ownerNode);
              }
            }
          }
          
          const exportEl = clonedDoc.getElementById('export-area');
          if (exportEl) {
            exportEl.style.position = 'static';
            exportEl.style.left = '0';
            exportEl.style.display = 'block';
          }
        }
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`رول_جلسات_${format(displayDate, 'yyyy-MM-dd')}.pdf`);
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      setIsExporting(false);
    }
  };

  const now = new Date();
  const day = now.getDay();
  let effectiveToday = now;
  
  // Friday (5) and Saturday (6) are holidays, show Sunday (0)
  if (day === 5) effectiveToday = addDays(now, 2);
  else if (day === 6) effectiveToday = addDays(now, 1);
  
  const todayStr = effectiveToday.toISOString().split('T')[0];
  const realTodayStr = now.toISOString().split('T')[0];
  
  const allSessionsWithCase = sessions
    .map(s => ({
      ...s,
      caseInfo: cases.find(c => c.id === s.caseId)
    }))
    .filter(s => s.caseInfo); // Only keep sessions with case info (important for client role)

  const filteredSessions = allSessionsWithCase.filter(s => {
    const sDate = s.date.split('T')[0];
    const courtMatch = selectedCourt === 'ALL' || s.caseInfo?.court === selectedCourt;
    
    if (activeTab === 'today') return sDate === todayStr && courtMatch;
    if (activeTab === 'upcoming') return sDate > todayStr && courtMatch;
    if (activeTab === 'omitted') {
      return sDate < realTodayStr && !s.decision && s.caseInfo?.status === 'active' && courtMatch;
    }
    if (activeTab === 'search') return sDate === selectedDate && courtMatch;
    return courtMatch;
  });

  const courts = ['ALL', ...new Set(cases.map(c => c.court).filter(Boolean))];

  const displayDate = activeTab === 'search' ? new Date(selectedDate) : effectiveToday;
  const displayDateStr = displayDate.toISOString().split('T')[0];

  const filteredExpertSessions = expertSessions
    .map(s => ({
      ...s,
      caseInfo: cases.find(c => c.id === s.caseId)
    }))
    .filter(s => {
      const sDate = s.date.split('T')[0];
      const courtMatch = selectedCourt === 'ALL' || s.caseInfo?.court === selectedCourt;
      return sDate === displayDateStr && s.caseInfo && courtMatch;
    });

  const stats = {
    today: sessions.filter(s => s.date.split('T')[0] === todayStr).length,
    upcoming: sessions.filter(s => s.date.split('T')[0] > todayStr).length,
    omitted: allSessionsWithCase.filter(s => s.date.split('T')[0] < realTodayStr && !s.decision && s.caseInfo?.status === 'active').length,
  };

  const formatDate = (date: Date) => {
    return format(date, 'EEEE, dd MMMM yyyy', { locale: arSA });
  };

  return (
    <div className="space-y-6 rtl pb-20" dir="rtl">
      {/* Quick Stats Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 print:hidden">
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-indigo-100 text-indigo-600 rounded-2xl">
            <CalendarDays className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-black text-slate-400 uppercase">جلسات اليوم</p>
            <p className="text-2xl font-black text-slate-900">{stats.today}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-emerald-100 text-emerald-600 rounded-2xl">
            <CalendarClock className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-black text-slate-400 uppercase">الجلسات القادمة</p>
            <p className="text-2xl font-black text-slate-900">{stats.upcoming}</p>
          </div>
        </div>
        <div className={cn(
          "p-6 rounded-3xl border shadow-sm flex items-center gap-4 transition-all",
          stats.omitted > 0 ? "bg-red-50 border-red-100" : "bg-white border-slate-200"
        )}>
          <div className={cn(
            "p-3 rounded-2xl",
            stats.omitted > 0 ? "bg-red-100 text-red-600" : "bg-slate-100 text-slate-400"
          )}>
            <AlertCircle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-black text-slate-400 uppercase">جلسات لم يتم ترحيلها</p>
            <p className={cn("text-2xl font-black", stats.omitted > 0 ? "text-red-600" : "text-slate-900")}>
              {stats.omitted}
            </p>
          </div>
          {stats.omitted > 0 && (
            <button 
              onClick={() => setActiveTab('omitted')}
              className="mr-auto text-xs font-black text-red-600 underline"
            >
              عرض الكل
            </button>
          )}
        </div>
      </div>

      {/* Success Message */}
      <AnimatePresence>
        {success && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-emerald-600 text-white px-6 py-3 rounded-2xl shadow-2xl z-50 flex items-center gap-3 font-bold"
          >
            <CheckCircle2 className="w-5 h-5" />
            تم ترحيل الجلسة بنجاح!
          </motion.div>
        )}
      </AnimatePresence>

      {/* Legal Header & Controls */}
      <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6 relative overflow-hidden print:hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-indigo-600" />
        
        <div className="flex flex-col md:flex-row justify-between items-end md:items-center gap-4">
          <div className="text-right">
            <h2 className="text-2xl font-black text-slate-900 flex items-center gap-2">
              <CalendarDays className="w-8 h-8 text-indigo-600" />
              رول الجلسات اليومي
            </h2>
            <p className="text-slate-500 font-bold">إدارة الجلسات اليومية وطباعة الرول للمحامين</p>
          </div>
          
          <div className="flex flex-wrap gap-3 items-center">
            <div className="flex items-center gap-2 bg-slate-50 px-4 py-2 rounded-xl border border-slate-100">
              <Search className="w-4 h-4 text-slate-400" />
              <input 
                type="date" 
                className="bg-transparent border-none text-sm font-bold text-slate-700 outline-none"
                value={selectedDate}
                onChange={(e) => {
                  setSelectedDate(e.target.value);
                  setActiveTab('search');
                }}
              />
            </div>

            <select 
              className="bg-white border border-slate-200 text-slate-700 py-2 px-4 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-indigo-600 shadow-sm"
              value={selectedCourt}
              onChange={(e) => setSelectedCourt(e.target.value)}
            >
              <option value="ALL">جميع المحاكم</option>
              {courts.filter(c => c !== 'ALL').map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>

            <div className="flex gap-2">
              <button 
                onClick={() => setIsAddSessionModalOpen(true)}
                className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-xl font-bold text-sm hover:bg-emerald-700 transition-all shadow-sm"
              >
                <Plus className="w-4 h-4" />
                <span>إضافة جلسة</span>
              </button>
              <button 
                onClick={() => window.print()}
                className="flex items-center gap-2 bg-slate-800 text-white px-4 py-2 rounded-xl font-bold text-sm hover:bg-slate-900 transition-all shadow-sm"
              >
                <Printer className="w-4 h-4" />
                <span>طباعة الرول</span>
              </button>
              <button 
                onClick={exportAsPDF}
                disabled={isExporting}
                className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl font-bold text-sm hover:bg-indigo-700 transition-all shadow-sm disabled:opacity-50"
              >
                <FileText className="w-4 h-4" />
                تصدير PDF
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs - Hidden on Print */}
      <div className="flex items-center gap-4 border-b border-slate-200 print:hidden">
        {[
          { id: 'today', label: 'رول اليوم', icon: Clock, count: sessions.filter(s => s.date.split('T')[0] === todayStr).length },
          { id: 'upcoming', label: 'الجلسات القادمة', icon: CalendarClock, count: sessions.filter(s => s.date.split('T')[0] > todayStr).length },
          { id: 'omitted', label: 'كاشف السهو', icon: AlertCircle, count: stats.omitted, color: 'red' },
          { id: 'search', label: 'بحث بالتاريخ', icon: Search, count: 0 },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          if (tab.id === 'search' && activeTab !== 'search') return null;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                "flex items-center gap-2 px-6 py-4 font-bold text-sm transition-all border-b-2 -mb-px relative",
                isActive 
                  ? (tab.color === 'red' ? "border-red-600 text-red-600" : "border-indigo-600 text-indigo-600")
                  : "border-transparent text-slate-500 hover:text-slate-900"
              )}
            >
              <Icon className="w-5 h-5" />
              {tab.label}
              {tab.count > 0 && (
                <span className={cn(
                  "px-2 py-0.5 rounded-full text-[10px] font-black",
                  tab.color === 'red' ? "bg-red-100 text-red-600" : "bg-indigo-100 text-indigo-600"
                )}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Holiday Banner */}
      {(now.getDay() === 5 || now.getDay() === 6) && activeTab === 'today' && (
        <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 flex items-center gap-3 mb-6 print:hidden">
          <div className="p-2 bg-amber-100 rounded-lg text-amber-600">
            <CalendarDays className="w-5 h-5" />
          </div>
          <div>
            <p className="text-sm font-black text-amber-900">اليوم عطلة رسمية (الجمعة/السبت)</p>
            <p className="text-xs font-bold text-amber-600">يتم عرض رول يوم الأحد القادم: {format(effectiveToday, 'dd MMMM yyyy', { locale: arSA })}</p>
          </div>
        </div>
      )}

      {/* Sessions List - Formal Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden print:border-none print:rounded-none print:shadow-none">
        
        {/* Print Header */}
        <div className="hidden print:block p-10 border-b-4 border-slate-900 text-center bg-white">
          <div className="flex justify-between items-center mb-10">
             <div className="text-right">
                <h2 className="font-black text-3xl text-slate-900 mb-2">مكتب المحامي محمد امين علي الصايغ</h2>
                <p className="text-lg text-slate-600 font-bold">للمحاماة والاستشارات القانونية</p>
                <p className="text-xs text-slate-400 mt-2">دولة الكويت - برج التجارية - الدور 25</p>
             </div>
             <div className="text-left flex flex-col items-end">
                <div className="bg-slate-900 text-white p-5 rounded-2xl mb-4 shadow-lg">
                  <Scale className="w-10 h-10" />
                </div>
                <p className="font-black text-slate-900 text-lg">التاريخ: {new Date().toLocaleDateString('ar-EG')}</p>
             </div>
          </div>
          
          <div className="mb-10">
            <h1 className="text-4xl font-black bg-slate-100 inline-block px-16 py-5 border-4 border-slate-900 rounded-3xl shadow-sm">
              رول جلسات: {formatDate(displayDate)}
            </h1>
          </div>
          
          {selectedCourt !== 'ALL' && (
            <div className="flex justify-center mb-6">
              <span className="bg-white text-slate-900 px-8 py-3 rounded-2xl border-2 border-slate-900 font-black text-xl">
                المحكمة: {selectedCourt}
              </span>
            </div>
          )}
        </div>

        <div className="overflow-x-auto print:overflow-visible">
          <table className="w-full text-right border-collapse print:border-2 print:border-slate-900">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 print:bg-slate-100 print:border-b-2 print:border-slate-900">
                <th className="p-4 text-xs font-black text-slate-500 uppercase tracking-widest border-l border-slate-200 w-12 text-center print:text-slate-900 print:border-l-2 print:border-slate-900 print:text-sm">#</th>
                <th className="p-4 text-xs font-black text-slate-500 uppercase tracking-widest border-l border-slate-200 print:text-slate-900 print:border-l-2 print:border-slate-900 print:text-sm">المحكمة</th>
                <th className="p-4 text-xs font-black text-slate-500 uppercase tracking-widest border-l border-slate-200 print:text-slate-900 print:border-l-2 print:border-slate-900 print:text-sm">الدائرة</th>
                <th className="p-4 text-xs font-black text-slate-500 uppercase tracking-widest border-l border-slate-200 print:text-slate-900 print:border-l-2 print:border-slate-900 print:text-sm">رقم القضية</th>
                <th className="p-4 text-xs font-black text-slate-500 uppercase tracking-widest border-l border-slate-200 print:text-slate-900 print:border-l-2 print:border-slate-900 print:text-sm">الموكل</th>
                <th className="p-4 text-xs font-black text-slate-500 uppercase tracking-widest border-l border-slate-200 print:text-slate-900 print:border-l-2 print:border-slate-900 print:text-sm">الخصم</th>
                <th className="p-4 text-xs font-black text-slate-500 uppercase tracking-widest print:text-slate-900 print:text-sm">القرار</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 print:divide-y-2 print:divide-slate-900">
              {filteredSessions.length > 0 ? (
                filteredSessions.map((session, index) => (
                  <motion.tr
                    layout
                    key={session.id}
                    className={cn(
                      "transition-all hover:bg-slate-50 print:hover:bg-transparent",
                      session.decision ? "bg-emerald-50/30 print:bg-transparent" : ""
                    )}
                  >
                    <td className="p-4 text-sm font-black text-slate-400 text-center border-l border-slate-100 print:text-slate-900 print:border-l-2 print:border-slate-900 print:text-base">
                      {index + 1}
                    </td>
                    <td className="p-4 border-l border-slate-100 print:border-l-2 print:border-slate-900">
                      <span className="text-sm font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-lg border border-indigo-100 print:bg-transparent print:border-none print:text-slate-900 print:text-base">
                        {session.caseInfo?.court || '---'}
                      </span>
                    </td>
                    <td className="p-4 border-l border-slate-100 print:border-l-2 print:border-slate-900">
                      <span className="text-sm font-bold text-slate-700 print:text-slate-900 print:text-base">
                        {session.caseInfo?.circuit || '---'}
                      </span>
                    </td>
                    <td className="p-4 border-l border-slate-100 print:border-l-2 print:border-slate-900">
                      <span className="text-sm font-black text-slate-900 print:text-base">
                        {session.caseInfo?.caseNumber || '---'} / {session.caseInfo?.year || '----'}
                      </span>
                    </td>
                    <td className="p-4 border-l border-slate-100 print:border-l-2 print:border-slate-900">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-slate-700 print:text-slate-900 print:text-base">{session.caseInfo?.clientName || '---'}</span>
                        {session.caseInfo?.clientPosition && (
                          <span className="text-[10px] font-black text-indigo-600 print:text-slate-500">
                            ({session.caseInfo.clientPosition === 'plaintiff' ? 'مدعي' : 
                               session.caseInfo.clientPosition === 'defendant' ? 'مدعى عليه' :
                               session.caseInfo.clientPosition === 'appellant' ? 'مستأنف' : 'مستأنف ضده'})
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-4 border-l border-slate-100 print:border-l-2 print:border-slate-900">
                      <span className="text-sm font-bold text-slate-700 print:text-slate-900 print:text-base">{session.caseInfo?.opponent || '---'}</span>
                    </td>
                    <td className="p-4 print:text-base">
                      <div className="flex flex-col gap-2">
                        {session.decision ? (
                          <div className="flex items-start gap-3">
                            <CheckCircle className="hidden print:block w-5 h-5 text-slate-900 shrink-0 mt-0.5" />
                            <CheckCircle className="print:hidden w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                            <div>
                              <p className="text-sm font-bold text-emerald-900 print:text-slate-900 leading-relaxed print:text-base">{session.decision}</p>
                              {session.nextDate && (
                                <p className="text-[10px] text-emerald-600 font-black mt-1 print:text-slate-600 print:text-sm">
                                  الجلسة القادمة: {format(new Date(session.nextDate), 'yyyy/MM/dd')}
                                </p>
                              )}
                            </div>
                          </div>
                        ) : (
                          <>
                            <button
                              onClick={() => {
                                setSelectedSession(session);
                                setIsDecisionModalOpen(true);
                                setDecision('');
                                setNextDate('');
                              }}
                              className="flex items-center gap-2 text-indigo-600 font-black text-xs hover:underline bg-indigo-50/50 px-4 py-2 rounded-xl border border-indigo-100/50 print:hidden w-fit"
                            >
                              <ArrowRightLeft className="w-4 h-4" />
                              إثبات القرار
                            </button>
                            <div className="hidden print:block h-16 border-b border-dotted border-slate-400 w-full"></div>
                          </>
                        )}
                        
                        <div className="flex items-center gap-3 mt-1 print:hidden">
                          <button
                            onClick={() => {
                              setSelectedSession(session);
                              setEditDate(session.date.split('T')[0]);
                              setIsEditSessionModalOpen(true);
                            }}
                            className="flex items-center gap-1 text-[10px] font-black text-slate-600 hover:text-slate-800"
                          >
                            <Edit2 className="w-3 h-3" />
                            تعديل
                          </button>
                          <button
                            onClick={() => {
                              setSelectedSession(session);
                              setIsHistoryModalOpen(true);
                            }}
                            className="flex items-center gap-1 text-[10px] font-black text-slate-600 hover:text-slate-800"
                          >
                            <Clock className="w-3 h-3" />
                            السجل
                          </button>
                          <button
                            onClick={() => {
                              if (window.confirm('هل أنت متأكد من تجاهل هذه الجلسة؟')) {
                                updateDoc(doc(db, 'sessions', session.id), {
                                  decision: 'تم التجاوز',
                                  updatedAt: new Date().toISOString()
                                });
                              }
                            }}
                            className="flex items-center gap-1 text-[10px] font-black text-slate-400 hover:text-slate-600"
                          >
                            <XCircle className="w-3 h-3" />
                            تجاهل
                          </button>
                          <button
                            onClick={() => handleMoveToJudgment(session)}
                            className="flex items-center gap-1 text-[10px] font-black text-indigo-600 hover:text-indigo-800"
                          >
                            <Scale className="w-3 h-3" />
                            تحويل لحكم
                          </button>
                          <button
                            onClick={() => handleDeleteSession(session.id)}
                            className="flex items-center gap-1 text-[10px] font-black text-red-600 hover:text-red-800"
                          >
                            <Trash2 className="w-3 h-3" />
                            حذف
                          </button>
                          <button 
                            onClick={() => navigate(`/cases?id=${session.caseId}`)}
                            className="flex items-center gap-1 text-[10px] font-black text-indigo-600 hover:underline"
                          >
                            <ArrowRight className="w-3 h-3" />
                            تفاصيل القضية
                          </button>
                        </div>
                      </div>
                    </td>
                  </motion.tr>
                ))
              ) : (
                filteredExpertSessions.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-20 text-center text-slate-400 font-bold">
                      لا توجد جلسات مسجلة لهذا التاريخ
                    </td>
                  </tr>
                )
              )}

              {/* Expert Sessions Section */}
              {filteredExpertSessions.length > 0 && (
                <>
                  {/* Separator Row - Only visible in print as requested */}
                  <tr className="hidden print:table-row bg-slate-100 print:bg-slate-200 border-y-2 border-slate-900">
                    <td colSpan={7} className="p-8 text-center font-black text-slate-900 text-2xl">
                      رول جلسات الخبراء
                    </td>
                  </tr>
                  
                  {/* Expert Headers - Requested by user, visible in UI and print for clarity */}
                  <tr className="bg-slate-50 border-b border-slate-200 print:bg-slate-100 print:border-slate-900">
                    <th className="p-4 text-xs font-black text-slate-500 uppercase tracking-widest border-l border-slate-200 w-12 text-center print:text-slate-900 print:border-slate-900">#</th>
                    <th className="p-4 text-xs font-black text-slate-500 uppercase tracking-widest border-l border-slate-200 print:text-slate-900 print:border-slate-900">الخبير</th>
                    <th className="p-4 text-xs font-black text-slate-500 uppercase tracking-widest border-l border-slate-200 print:text-slate-900 print:border-slate-900">الساعة / المكان</th>
                    <th className="p-4 text-xs font-black text-slate-500 uppercase tracking-widest border-l border-slate-200 print:text-slate-900 print:border-slate-900">رقم القضية</th>
                    <th className="p-4 text-xs font-black text-slate-500 uppercase tracking-widest border-l border-slate-200 print:text-slate-900 print:border-slate-900">الموكل</th>
                    <th className="p-4 text-xs font-black text-slate-500 uppercase tracking-widest border-l border-slate-200 print:text-slate-900 print:border-slate-900">الخصم</th>
                    <th className="p-4 text-xs font-black text-slate-500 uppercase tracking-widest print:text-slate-900">ملاحظات</th>
                  </tr>

                  {filteredExpertSessions.map((session, index) => (
                    <tr key={session.id} className="transition-all hover:bg-slate-50 print:hover:bg-transparent">
                      <td className="p-4 text-sm font-black text-slate-400 text-center border-l border-slate-100 print:text-slate-900 print:border-slate-900">
                        {index + 1}
                      </td>
                      <td className="p-4 border-l border-slate-100 print:border-slate-900">
                        <span className="text-sm font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-lg border border-emerald-100 print:bg-transparent print:border-none print:text-slate-900">
                          {session.expertName}
                        </span>
                      </td>
                      <td className="p-4 border-l border-slate-100 print:border-slate-900">
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-slate-700 print:text-slate-900">
                            {session.officeLocation || '---'}
                          </span>
                          {session.time && (
                            <span className="text-[10px] font-black text-indigo-600 print:text-slate-500">
                              الساعة: {session.time}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-4 border-l border-slate-100 print:border-slate-900">
                        <span className="text-sm font-black text-slate-900">
                          {session.caseInfo?.caseNumber || '---'}
                        </span>
                      </td>
                      <td className="p-4 border-l border-slate-100 print:border-l-2 print:border-slate-900">
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-slate-700 print:text-slate-900 print:text-base">{session.caseInfo?.clientName || '---'}</span>
                          {session.caseInfo?.clientPosition && (
                            <span className="text-[10px] font-black text-emerald-600 print:text-slate-500">
                              ({session.caseInfo.clientPosition === 'plaintiff' ? 'مدعي' : 
                                 session.caseInfo.clientPosition === 'defendant' ? 'مدعى عليه' :
                                 session.caseInfo.clientPosition === 'appellant' ? 'مستأنف' : 'مستأنف ضده'})
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-4 border-l border-slate-100 print:border-slate-900">
                        <span className="text-sm font-bold text-slate-700 print:text-slate-900">{session.caseInfo?.opponent || '---'}</span>
                      </td>
                      <td className="p-4">
                        <span className="text-xs font-medium text-slate-500 print:text-slate-900 leading-relaxed">
                          {session.notes || '---'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </>
              )}
            </tbody>
          </table>
        </div>

        {/* Print Footer */}
        <div className="hidden print:block p-12 border-t border-slate-900 mt-12">
           <div className="flex justify-between items-end">
              <div className="text-center w-64">
                 <p className="font-black text-lg mb-12 text-slate-900">توقيع المحامي الحاضر</p>
                 <div className="border-b-2 border-slate-900 w-full"></div>
              </div>
              <div className="text-center w-64">
                 <p className="font-black text-lg mb-12 text-slate-900">اعتماد الإدارة</p>
                 <div className="border-b-2 border-slate-900 w-full"></div>
              </div>
           </div>
        </div>
      </div>

      {/* Hidden Exportable Area - Completely free of Tailwind classes to avoid oklch error */}
      <div style={{ position: 'fixed', left: '-9999px', top: 0 }}>
        <div id="export-area" ref={exportRef} style={{ 
          width: '1000px', 
          backgroundColor: '#ffffff', 
          padding: '60px', 
          direction: 'rtl',
          fontFamily: 'Arial, sans-serif'
        }}>
          <div style={{ 
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            borderBottom: '3px solid #000000', 
            paddingBottom: '30px',
            marginBottom: '40px'
          }}>
            <div style={{ textAlign: 'right' }}>
              <h2 style={{ fontSize: '32px', fontWeight: '900', color: '#000000', margin: '0 0 5px 0' }}>
                مكتب المحامي محمد امين علي الصايغ
              </h2>
              <p style={{ fontSize: '18px', fontWeight: '700', color: '#666666', margin: '0' }}>
                للمحاماة والاستشارات القانونية
              </p>
              <p style={{ fontSize: '12px', color: '#999999', margin: '5px 0 0 0' }}>
                دولة الكويت - برج التجارية - الدور 25
              </p>
            </div>
            <div style={{ textAlign: 'left' }}>
              <p style={{ fontSize: '16px', fontWeight: 'bold', color: '#000000', margin: '0 0 5px 0' }}>
                التاريخ: {new Date().toLocaleDateString('ar-EG')}
              </p>
              <p style={{ fontSize: '16px', fontWeight: 'bold', color: '#000000', margin: '0' }}>
                يوم: {format(displayDate, 'EEEE', { locale: arSA })}
              </p>
            </div>
          </div>

          <div style={{ textAlign: 'center', marginBottom: '40px' }}>
            <h1 style={{ 
              fontSize: '36px', 
              fontWeight: '900', 
              color: '#000000', 
              margin: '0',
              display: 'inline-block',
              padding: '15px 40px',
              border: '3px solid #000000',
              borderRadius: '15px',
              backgroundColor: '#f8f9fa'
            }}>
              رول جلسات: {formatDate(displayDate)}
            </h1>
            {selectedCourt !== 'ALL' && (
              <p style={{ fontSize: '20px', fontWeight: '900', color: '#4f46e5', marginTop: '15px' }}>
                المحكمة: {selectedCourt}
              </p>
            )}
          </div>

          <table style={{ 
            width: '100%', 
            borderCollapse: 'collapse', 
            border: '2px solid #000000',
            textAlign: 'right'
          }}>
            <thead>
              <tr style={{ backgroundColor: '#f0f0f0' }}>
                <th style={{ padding: '15px', border: '1px solid #000000', fontSize: '16px', fontWeight: '900', width: '40px', textAlign: 'center' }}>#</th>
                <th style={{ padding: '15px', border: '1px solid #000000', fontSize: '16px', fontWeight: '900' }}>المحكمة</th>
                <th style={{ padding: '15px', border: '1px solid #000000', fontSize: '16px', fontWeight: '900' }}>الدائرة</th>
                <th style={{ padding: '15px', border: '1px solid #000000', fontSize: '16px', fontWeight: '900' }}>رقم القضية</th>
                <th style={{ padding: '15px', border: '1px solid #000000', fontSize: '16px', fontWeight: '900' }}>الموكل</th>
                <th style={{ padding: '15px', border: '1px solid #000000', fontSize: '16px', fontWeight: '900' }}>الخصم</th>
                <th style={{ padding: '15px', border: '1px solid #000000', fontSize: '16px', fontWeight: '900' }}>القرار</th>
              </tr>
            </thead>
            <tbody>
              {filteredSessions.map((session, index) => (
                <tr key={session.id}>
                  <td style={{ padding: '15px', border: '1px solid #000000', fontSize: '14px', fontWeight: 'bold', textAlign: 'center' }}>{index + 1}</td>
                  <td style={{ padding: '15px', border: '1px solid #000000', fontSize: '14px', fontWeight: 'bold' }}>{session.caseInfo?.court || '---'}</td>
                  <td style={{ padding: '15px', border: '1px solid #000000', fontSize: '14px', fontWeight: 'bold' }}>{session.caseInfo?.circuit || '---'}</td>
                  <td style={{ padding: '15px', border: '1px solid #000000', fontSize: '14px', fontWeight: '900' }}>{session.caseInfo?.caseNumber || '---'} / {session.caseInfo?.year || '----'}</td>
                  <td style={{ padding: '15px', border: '1px solid #000000', fontSize: '14px', fontWeight: 'bold' }}>{session.caseInfo?.clientName || '---'}</td>
                  <td style={{ padding: '15px', border: '1px solid #000000', fontSize: '14px', fontWeight: 'bold' }}>{session.caseInfo?.opponent || '---'}</td>
                  <td style={{ padding: '15px', border: '1px solid #000000', fontSize: '14px', fontWeight: 'bold', lineHeight: '1.5' }}>
                    {session.decision || '---'}
                    {session.nextDate && (
                      <div style={{ fontSize: '11px', color: '#666666', marginTop: '5px', fontWeight: '900' }}>
                        الجلسة القادمة: {format(new Date(session.nextDate), 'yyyy/MM/dd')}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          <div style={{ 
            marginTop: '80px', 
            display: 'flex', 
            justifyContent: 'space-between',
            fontSize: '18px',
            fontWeight: '900',
            color: '#000000'
          }}>
            <div style={{ textAlign: 'center', width: '250px' }}>
              <p style={{ marginBottom: '60px' }}>توقيع المحامي الحاضر</p>
              <div style={{ borderBottom: '2px solid #000000' }}></div>
            </div>
            <div style={{ textAlign: 'center', width: '250px' }}>
              <p style={{ marginBottom: '60px' }}>ختم واعتماد المكتب</p>
              <div style={{ borderBottom: '2px solid #000000' }}></div>
            </div>
          </div>
        </div>
      </div>
      {/* Decision Modal */}
      <AnimatePresence>
        {isDecisionModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsDecisionModalOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <h2 className="text-xl font-black text-slate-900">إثبات قرار الجلسة</h2>
                <button onClick={() => setIsDecisionModalOpen(false)} className="p-2 hover:bg-white rounded-xl transition-all">
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>
              <div className="p-8 space-y-6">
                {error && (
                  <div className="p-4 bg-red-50 border border-red-100 text-red-600 text-sm font-bold rounded-xl flex items-center gap-3">
                    <AlertCircle className="w-5 h-5" />
                    {error}
                  </div>
                )}
                
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">القرار أو الإجراء</label>
                  <textarea
                    required
                    rows={3}
                    placeholder="اكتب ما تم في الجلسة..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition-all"
                    value={decision}
                    onChange={(e) => setDecision(e.target.value)}
                  />
                </div>

                <div className="flex items-center gap-3 p-4 bg-indigo-50 rounded-2xl border border-indigo-100">
                  <input
                    type="checkbox"
                    id="isJudgment"
                    className="w-5 h-5 rounded border-indigo-300 text-indigo-600 focus:ring-indigo-500"
                    checked={isJudgment}
                    onChange={(e) => setIsJudgment(e.target.checked)}
                  />
                  <label htmlFor="isJudgment" className="text-sm font-bold text-indigo-900 cursor-pointer">
                    هذه الجلسة هي جلسة حكم (نهائية)
                  </label>
                </div>

                {!isJudgment && (
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">تاريخ الجلسة القادمة</label>
                    <input
                      required
                      type="date"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition-all"
                      value={nextDate}
                      onChange={(e) => setNextDate(e.target.value)}
                    />
                  </div>
                )}

                <div className="pt-4 flex gap-4">
                  <button
                    onClick={handleRelay}
                    disabled={isRelaying}
                    className="flex-1 bg-indigo-600 text-white font-bold py-4 rounded-2xl shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"
                  >
                    {isRelaying ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <Save className="w-5 h-5" />
                    )}
                    حفظ وترحيل
                  </button>
                  <button
                    onClick={() => setIsDecisionModalOpen(false)}
                    className="px-8 bg-slate-100 text-slate-600 font-bold py-4 rounded-2xl hover:bg-slate-200 transition-all"
                  >
                    إلغاء
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Session Modal */}
      <AnimatePresence>
        {isAddSessionModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddSessionModalOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <h2 className="text-xl font-black text-slate-900">إضافة جلسة جديدة</h2>
                <button onClick={() => setIsAddSessionModalOpen(false)} className="p-2 hover:bg-white rounded-xl transition-all">
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>
              <form onSubmit={handleAddSession} className="p-8 space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">اختر القضية</label>
                  <select
                    required
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition-all"
                    value={selectedCaseId}
                    onChange={(e) => setSelectedCaseId(e.target.value)}
                  >
                    <option value="">اختر القضية...</option>
                    {cases.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.caseNumber} / {c.year} - {c.clientName}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">تاريخ الجلسة</label>
                  <input
                    required
                    type="date"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition-all"
                    value={nextDate}
                    onChange={(e) => setNextDate(e.target.value)}
                  />
                </div>

                <div className="pt-4 flex gap-4">
                  <button
                    type="submit"
                    disabled={isRelaying}
                    className="flex-1 bg-indigo-600 text-white font-bold py-4 rounded-2xl shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"
                  >
                    {isRelaying ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <Save className="w-5 h-5" />
                    )}
                    إضافة الجلسة
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsAddSessionModalOpen(false)}
                    className="px-8 bg-slate-100 text-slate-600 font-bold py-4 rounded-2xl hover:bg-slate-200 transition-all"
                  >
                    إلغاء
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Session Modal */}
      <AnimatePresence>
        {isEditSessionModalOpen && selectedSession && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsEditSessionModalOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <h2 className="text-xl font-black text-slate-900">تعديل موعد الجلسة</h2>
                <button onClick={() => setIsEditSessionModalOpen(false)} className="p-2 hover:bg-white rounded-xl transition-all">
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>
              <form onSubmit={handleEditSession} className="p-8 space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">تاريخ الجلسة الجديد</label>
                  <input
                    required
                    type="date"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition-all"
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                  />
                </div>

                <div className="pt-4 flex gap-4">
                  <button
                    type="submit"
                    disabled={isRelaying}
                    className="flex-1 bg-indigo-600 text-white font-bold py-4 rounded-2xl shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"
                  >
                    {isRelaying ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <Save className="w-5 h-5" />
                    )}
                    حفظ التعديل
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditSessionModalOpen(false)}
                    className="px-8 bg-slate-100 text-slate-600 font-bold py-4 rounded-2xl hover:bg-slate-200 transition-all"
                  >
                    إلغاء
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* History Modal */}
      <AnimatePresence>
        {isHistoryModalOpen && selectedSession && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsHistoryModalOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <div>
                  <h2 className="text-xl font-black text-slate-900">سجل جلسات القضية</h2>
                  <p className="text-xs text-slate-500 font-bold mt-1">
                    {selectedSession.caseInfo?.caseNumber} / {selectedSession.caseInfo?.year} - {selectedSession.caseInfo?.clientName}
                  </p>
                </div>
                <button onClick={() => setIsHistoryModalOpen(false)} className="p-2 hover:bg-white rounded-xl transition-all">
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>
              <div className="p-8 overflow-y-auto space-y-6">
                {sessions
                  .filter(s => s.caseId === selectedSession.caseId)
                  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                  .map((s, idx) => (
                    <div key={s.id} className="relative pr-8 border-r-2 border-slate-100 pb-6 last:pb-0">
                      <div className="absolute top-0 -right-[9px] w-4 h-4 rounded-full bg-white border-4 border-indigo-600" />
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-black text-indigo-600">
                          {format(new Date(s.date), 'dd MMMM yyyy', { locale: arSA })}
                        </span>
                        {s.decision ? (
                          <span className="bg-emerald-100 text-emerald-700 text-[10px] font-black px-2 py-1 rounded-lg">
                            تم الإنجاز
                          </span>
                        ) : (
                          user.role !== 'client' && (
                            <button
                              onClick={() => {
                                setSelectedSession(s);
                                setIsDecisionModalOpen(true);
                                setIsHistoryModalOpen(false);
                              }}
                              className="bg-indigo-600 text-white text-[10px] font-black px-3 py-1 rounded-lg hover:bg-indigo-700 transition-all"
                            >
                              إضافة قرار
                            </button>
                          )
                        )}
                      </div>
                      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                        <p className="text-sm text-slate-700 font-bold leading-relaxed">
                          {s.decision || 'بانتظار القرار...'}
                        </p>
                        {s.nextDate && (
                          <p className="text-xs text-slate-400 font-bold mt-2">
                            الجلسة القادمة: {format(new Date(s.nextDate), 'yyyy/MM/dd')}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
