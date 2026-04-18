import React, { useState, useEffect, useRef } from 'react';
import { collection, addDoc, onSnapshot, query, orderBy, doc, updateDoc, where, getDoc, deleteDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useNavigate, useLocation } from 'react-router-dom';
import { CalendarClock, ArrowRightLeft, AlertCircle, CheckCircle2, Clock, Search, Filter, Download, MessageSquare, Save, X, Scale, FileText, ImageIcon, Trash2, Printer, CalendarDays, CheckCircle, XCircle, Plus, Edit2, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Session, Case, UserProfile, ExpertSession, SystemSettings } from '../types';
import { cn } from '../lib/utils';
import { format, isPast, isToday, isFuture, addDays } from 'date-fns';
import { arSA } from 'date-fns/locale';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import ConfirmModal from './ConfirmModal';

interface SessionRelayProps {
  user: UserProfile;
}

export default function SessionRelay({ user }: SessionRelayProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [expertSessions, setExpertSessions] = useState<ExpertSession[]>([]);
  const [cases, setCases] = useState<Case[]>([]);
  const [systemSettings, setSystemSettings] = useState<SystemSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'today' | 'upcoming' | 'omitted' | 'search'>('today');

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tab = params.get('tab');
    if (tab === 'omitted' || tab === 'today' || tab === 'upcoming' || tab === 'search') {
      setActiveTab(tab as any);
    }
  }, [location.search]);

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

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [sessionToDeleteId, setSessionToDeleteId] = useState<string | null>(null);
  const [isOmitModalOpen, setIsOmitModalOpen] = useState(false);
  const [sessionToOmitId, setSessionToOmitId] = useState<string | null>(null);

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

    // Load System Settings
    const loadSettings = async () => {
      try {
        const settingsSnap = await getDoc(doc(db, 'settings', 'global'));
        if (settingsSnap.exists()) {
          setSystemSettings(settingsSnap.data() as SystemSettings);
        }
      } catch (err) {
        console.error('Error loading settings:', err);
      }
    };
    loadSettings();

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

  const handleDeleteSession = async () => {
    if (user.role === 'client' || !sessionToDeleteId) return;
    try {
      await deleteDoc(doc(db, 'sessions', sessionToDeleteId));
      setIsDeleteModalOpen(false);
      setSessionToDeleteId(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'sessions');
    }
  };

  const handleOmitSession = async () => {
    if (!sessionToOmitId) return;
    try {
      await updateDoc(doc(db, 'sessions', sessionToOmitId), {
        decision: 'تم التجاوز',
        updatedAt: new Date().toISOString()
      });
      setIsOmitModalOpen(false);
      setSessionToOmitId(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'sessions');
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
          // Add a style tag to fix Arabic character fragmentation
          const style = clonedDoc.createElement('style');
          style.innerHTML = `
            * {
              letter-spacing: normal !important;
              letter-spacing: 0 !important;
              text-rendering: auto !important;
              -webkit-font-feature-settings: "kern" 1, "liga" 1, "clig" 1, "calt" 1 !important;
              font-feature-settings: "kern" 1, "liga" 1, "clig" 1, "calt" 1 !important;
            }
          `;
          clonedDoc.head.appendChild(style);

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
          // Add a style tag to fix Arabic character fragmentation
          const style = clonedDoc.createElement('style');
          style.innerHTML = `
            * {
              letter-spacing: normal !important;
              letter-spacing: 0 !important;
              text-rendering: auto !important;
              -webkit-font-feature-settings: "kern" 1, "liga" 1, "clig" 1, "calt" 1 !important;
              font-feature-settings: "kern" 1, "liga" 1, "clig" 1, "calt" 1 !important;
            }
          `;
          clonedDoc.head.appendChild(style);

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
    if (!s.date) {
      console.warn('SessionRelay: Missing date for session:', s.id);
      return false;
    }
    const sDate = s.date.split('T')[0];
    const courtMatch = selectedCourt === 'ALL' || s.caseInfo?.court === selectedCourt;
    
    if (activeTab === 'today') return sDate === todayStr && courtMatch;
    if (activeTab === 'upcoming') return sDate > todayStr && courtMatch;
    if (activeTab === 'omitted') {
      const isOmittedRegular = sDate < realTodayStr && !s.decision && s.caseInfo?.status === 'active' && courtMatch;
      return isOmittedRegular;
    }
    if (activeTab === 'search') return sDate === selectedDate && courtMatch;
    return courtMatch;
  });

  const omittedExpertSessions = expertSessions
    .map(s => ({
      ...s,
      caseInfo: cases.find(c => c.id === s.caseId)
    }))
    .filter(s => {
      if (!s.date || !s.caseInfo) return false;
      const sDate = s.date.split('T')[0];
      const courtMatch = selectedCourt === 'ALL' || s.caseInfo?.court === selectedCourt;
      const isOmittedExpert = sDate < realTodayStr && s.status === 'pending' && (!s.decision || s.decision === '') && s.caseInfo?.status === 'active' && courtMatch;
      return isOmittedExpert;
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
      if (!s.date) {
        console.warn('SessionRelay: Missing date for expert session:', s.id);
        return false;
      }
      const sDate = s.date.split('T')[0];
      const courtMatch = selectedCourt === 'ALL' || s.caseInfo?.court === selectedCourt;
      const isActive = s.status === 'pending' || s.status === 'postponed';
      return sDate === displayDateStr && s.caseInfo && courtMatch && isActive;
    });

  const stats = {
    today: sessions.filter(s => {
      if (!s.date) return false;
      return s.date.split('T')[0] === todayStr;
    }).length,
    upcoming: sessions.filter(s => {
      if (!s.date) return false;
      return s.date.split('T')[0] > todayStr;
    }).length,
    omitted: allSessionsWithCase.filter(s => {
      if (!s.date) return false;
      return s.date.split('T')[0] < realTodayStr && !s.decision && s.caseInfo?.status === 'active';
    }).length + expertSessions.filter(s => {
      if (!s.date) return false;
      const caseItem = cases.find(c => c.id === s.caseId);
      return s.date.split('T')[0] < realTodayStr && s.status === 'pending' && (!s.decision || s.decision === '') && caseItem?.status === 'active';
    }).length,
  };

    const safeFormat = (dateStr: string | undefined, formatStr: string) => {
      if (!dateStr) return '---';
      try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return '---';
        return format(d, formatStr, { locale: arSA });
      } catch (e) {
        return '---';
      }
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
        
        {/* Print Header - Professional Redesign */}
        <div className="hidden print:block bg-white">
          <div className="p-10 border-b-8 border-slate-900">
            <div className="flex justify-between items-start mb-12">
              <div className="text-right space-y-2">
                <h2 className="font-black text-4xl text-slate-900 tracking-tight">{systemSettings?.officeName || 'مكتب المحامي محمد امين علي الصايغ'}</h2>
                <p className="text-xl text-slate-600 font-bold">{systemSettings?.officeDescription || 'للمحاماة والاستشارات القانونية والتحكيم'}</p>
                <div className="flex flex-col text-sm text-slate-500 font-bold mt-4 space-y-1">
                  <span>{systemSettings?.officeAddress || 'دولة الكويت - مدينة الكويت'}</span>
                  {systemSettings?.officeAddress && <span>{systemSettings.officeAddress.includes('برج') ? '' : 'برج التجارية - الدور 25'}</span>}
                  <span>هاتف: {systemSettings?.officePhone || '22200000'} {systemSettings?.officeFax ? `- فاكس: ${systemSettings.officeFax}` : ''}</span>
                </div>
              </div>
              <div className="flex flex-col items-end">
                <div className="w-24 h-24 bg-slate-900 rounded-3xl flex items-center justify-center shadow-xl mb-4 rotate-3">
                  <Scale className="w-12 h-12 text-white -rotate-3" />
                </div>
                <div className="text-left space-y-1">
                  <p className="font-black text-slate-900 text-lg">رقم التقرير: #ROLL-{format(displayDate, 'yyyyMMdd')}</p>
                  <p className="font-bold text-slate-500 text-sm">تاريخ الطباعة: {format(new Date(), 'yyyy/MM/dd HH:mm')}</p>
                </div>
              </div>
            </div>

            <div className="text-center relative py-8">
              <div className="absolute inset-0 flex items-center" aria-hidden="true">
                <div className="w-full border-t-2 border-slate-200"></div>
              </div>
              <div className="relative flex justify-center">
                <span className="bg-white px-10 text-5xl font-black text-slate-900 tracking-tighter uppercase">
                  رول الجلسات اليومي
                </span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-6 mt-10">
              <div className="bg-slate-50 p-6 rounded-2xl border-2 border-slate-100 text-center">
                <p className="text-xs font-black text-slate-400 uppercase mb-2">تاريخ الرول</p>
                <p className="text-xl font-black text-slate-900">{safeFormat(displayDate.toISOString(), 'EEEE, dd MMMM yyyy')}</p>
              </div>
              <div className="bg-slate-50 p-6 rounded-2xl border-2 border-slate-100 text-center">
                <p className="text-xs font-black text-slate-400 uppercase mb-2">إجمالي الجلسات</p>
                <p className="text-xl font-black text-slate-900">{filteredSessions.length + filteredExpertSessions.length}</p>
              </div>
              <div className="bg-slate-50 p-6 rounded-2xl border-2 border-slate-100 text-center">
                <p className="text-xs font-black text-slate-400 uppercase mb-2">المحكمة المختصة</p>
                <p className="text-xl font-black text-slate-900">{selectedCourt === 'ALL' ? 'جميع المحاكم' : selectedCourt}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto print:overflow-visible print:px-10 print:py-8">
          <table className="w-full text-right border-collapse print:border-t-0">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 print:bg-slate-900 print:text-white">
                <th className="p-4 text-xs font-black text-slate-500 uppercase tracking-widest border-l border-slate-200 w-12 text-center print:text-white print:border-slate-700 print:text-sm">#</th>
                <th className="p-4 text-xs font-black text-slate-500 uppercase tracking-widest border-l border-slate-200 print:text-white print:border-slate-700 print:text-sm">المحكمة</th>
                <th className="p-4 text-xs font-black text-slate-500 uppercase tracking-widest border-l border-slate-200 print:text-white print:border-slate-700 print:text-sm">الدائرة</th>
                <th className="p-4 text-xs font-black text-slate-500 uppercase tracking-widest border-l border-slate-200 print:text-white print:border-slate-700 print:text-sm">رقم القضية</th>
                <th className="p-4 text-xs font-black text-slate-500 uppercase tracking-widest border-l border-slate-200 print:text-white print:border-slate-700 print:text-sm">الموكل</th>
                <th className="p-4 text-xs font-black text-slate-500 uppercase tracking-widest border-l border-slate-200 print:text-white print:border-slate-700 print:text-sm">الخصم</th>
                {activeTab === 'omitted' && <th className="p-4 text-xs font-black text-slate-500 uppercase tracking-widest border-l border-slate-200 print:text-white print:border-slate-700 print:text-sm">تاريخ الجلسة الأصلية</th>}
                <th className="p-4 text-xs font-black text-slate-500 uppercase tracking-widest print:text-white print:text-sm">القرار / الإجراء</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 print:divide-y-0">
              {filteredSessions.length > 0 ? (
                filteredSessions.map((session, index) => (
                  <motion.tr
                    layout
                    key={session.id}
                    className={cn(
                      "transition-all hover:bg-slate-50 print:hover:bg-transparent print:border-b print:border-slate-200",
                      session.decision ? "bg-emerald-50/30 print:bg-transparent" : ""
                    )}
                  >
                    <td className="p-4 text-sm font-black text-slate-400 text-center border-l border-slate-100 print:text-slate-900 print:border-slate-200 print:text-base">
                      {index + 1}
                    </td>
                    <td className="p-4 border-l border-slate-100 print:border-slate-200">
                      <span className="text-sm font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-lg border border-indigo-100 print:bg-transparent print:border-none print:text-slate-900 print:text-base print:font-black whitespace-nowrap">
                        {session.caseInfo?.court || '---'}
                      </span>
                    </td>
                    <td className="p-4 border-l border-slate-100 print:border-slate-200">
                      <span className="text-[10px] font-black text-slate-400 print:text-slate-500 print:text-sm shrink-0 whitespace-nowrap">
                        {session.caseInfo?.circuit || '---'}
                      </span>
                    </td>
                    <td className="p-4 border-l border-slate-100 print:border-slate-200">
                      <span className="text-sm font-black text-slate-900 print:text-base">
                        {session.caseInfo?.caseNumber || '---'}
                        <span className="text-slate-400 mx-1">/</span>
                        {session.caseInfo?.year || '----'}
                      </span>
                    </td>
                    <td className="p-4 border-l border-slate-100 print:border-slate-200">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-slate-700 print:text-slate-900 print:text-base print:font-black">{session.caseInfo?.clientName || '---'}</span>
                        {session.caseInfo?.clientPosition && (
                          <span className="text-[10px] font-black text-indigo-600 print:text-slate-500 print:text-xs">
                            ({session.caseInfo.clientPosition === 'plaintiff' ? 'مدعي' : 
                               session.caseInfo.clientPosition === 'defendant' ? 'مدعى عليه' :
                               session.caseInfo.clientPosition === 'appellant' ? 'مستأنف' : 'مستأنف ضده'})
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-4 border-l border-slate-100 print:border-slate-200">
                      <span className="text-sm font-bold text-slate-700 print:text-slate-900 print:text-base">{session.caseInfo?.opponent || '---'}</span>
                    </td>
                    {activeTab === 'omitted' && (
                      <td className="p-4 border-l border-slate-100 print:border-slate-200">
                        <span className="text-sm font-black text-red-600">---</span>
                      </td>
                    )}
                    <td className="p-4 print:text-base">
                      <div className="flex flex-col gap-2">
                        {session.decision ? (
                          <div className="flex items-start gap-3">
                            <CheckCircle className="hidden print:block w-5 h-5 text-slate-900 shrink-0 mt-0.5" />
                            <CheckCircle className="print:hidden w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                            <div>
                              <p className="text-sm font-bold text-emerald-900 print:text-slate-900 leading-relaxed print:text-base print:font-bold">{session.decision}</p>
                              {session.nextDate && (
                                <p className="text-[10px] text-emerald-600 font-black mt-1 print:text-slate-600 print:text-sm">
                                  الجلسة القادمة: {safeFormat(session.nextDate, 'yyyy/MM/dd')}
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
                            <div className="hidden print:block h-12 border-b-2 border-dashed border-slate-200 w-full"></div>
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
                              setSessionToOmitId(session.id);
                              setIsOmitModalOpen(true);
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
                            onClick={() => {
                              setSessionToDeleteId(session.id);
                              setIsDeleteModalOpen(true);
                            }}
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
                    <td colSpan={8} className="p-20 text-center text-slate-400 font-bold">
                      لا توجد جلسات مسجلة لهذا التاريخ
                    </td>
                  </tr>
                )
              )}

              {/* Expert Sessions Section */}
              {(filteredExpertSessions.length > 0 || (activeTab === 'omitted' && omittedExpertSessions.length > 0)) && (
                <>
                  <tr className="hidden print:table-row">
                    <td colSpan={activeTab === 'omitted' ? 8 : 7} className="p-0">
                      <div className="bg-slate-900 text-white p-6 text-center font-black text-2xl tracking-widest uppercase mt-12">
                        {activeTab === 'omitted' ? 'جلسات الخبراء المنسية' : 'رول جلسات الخبراء'}
                      </div>
                    </td>
                  </tr>
                  
                  <tr className="bg-slate-50 border-b border-slate-200 print:bg-slate-100 print:border-b-2 print:border-slate-900">
                    <th className="p-4 text-xs font-black text-slate-500 uppercase tracking-widest border-l border-slate-200 w-12 text-center print:text-slate-900 print:border-slate-900 print:text-sm">#</th>
                    <th className="p-4 text-xs font-black text-slate-500 uppercase tracking-widest border-l border-slate-200 print:text-slate-900 print:border-slate-900 print:text-sm">الخبير</th>
                    <th className="p-4 text-xs font-black text-slate-500 uppercase tracking-widest border-l border-slate-200 print:text-slate-900 print:border-slate-900 print:text-sm">المكان</th>
                    <th className="p-4 text-xs font-black text-slate-500 uppercase tracking-widest border-l border-slate-200 print:text-slate-900 print:border-slate-900 print:text-sm">رقم القضية</th>
                    <th className="p-4 text-xs font-black text-slate-500 uppercase tracking-widest border-l border-slate-200 print:text-slate-900 print:border-slate-900 print:text-sm">الموكل</th>
                    <th className="p-4 text-xs font-black text-slate-500 uppercase tracking-widest border-l border-slate-200 print:text-slate-900 print:border-slate-900 print:text-sm">الخصم</th>
                    {activeTab === 'omitted' && <th className="p-4 text-xs font-black text-slate-500 uppercase tracking-widest border-l border-slate-200 print:text-slate-900 print:border-slate-900 print:text-sm">تاريخ الجلسة</th>}
                    <th className="p-4 text-xs font-black text-slate-500 uppercase tracking-widest print:text-slate-900 print:text-sm">ملاحظات الخبير</th>
                  </tr>

                  {(activeTab === 'omitted' ? omittedExpertSessions : filteredExpertSessions).map((session, index) => (
                    <tr key={session.id} className={cn("transition-all hover:bg-slate-50 print:hover:bg-transparent", activeTab === 'omitted' ? "bg-amber-50/20" : "")}>
                      <td className="p-4 text-sm font-black text-slate-400 text-center border-l border-slate-100 print:text-slate-900 print:border-slate-900">
                        {index + 1}
                      </td>
                      <td className="p-4 border-l border-slate-100 print:border-slate-200">
                        <span className="text-sm font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-lg border border-emerald-100 print:bg-transparent print:border-none print:text-slate-900 print:text-base print:font-black whitespace-nowrap">
                          {session.expertName}
                        </span>
                      </td>
                      <td className="p-4 border-l border-slate-100 print:border-slate-200">
                        <span className="text-[10px] font-black text-slate-400 print:text-slate-500 print:text-sm shrink-0 whitespace-nowrap">
                          {session.officeLocation || '---'} {session.time ? `- الساعة: ${session.time}` : ''}
                        </span>
                      </td>
                      <td className="p-4 border-l border-slate-100 print:border-slate-200">
                        <span className="text-sm font-black text-slate-900 print:text-base">
                          {session.caseInfo?.caseNumber || '---'}
                        </span>
                      </td>
                      <td className="p-4 border-l border-slate-100 print:border-slate-200">
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-slate-700 print:text-slate-900 print:text-base print:font-black">{session.caseInfo?.clientName || '---'}</span>
                          {session.caseInfo?.clientPosition && (
                            <span className="text-[10px] font-black text-emerald-600 print:text-slate-500 print:text-xs">
                              ({session.caseInfo.clientPosition === 'plaintiff' ? 'مدعي' : 
                                 session.caseInfo.clientPosition === 'defendant' ? 'مدعى عليه' :
                                 session.caseInfo.clientPosition === 'appellant' ? 'مستأنف' : 'مستأنف ضده'})
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-4 border-l border-slate-100 print:border-slate-200">
                        <span className="text-sm font-bold text-slate-700 print:text-slate-900 print:text-base">{session.caseInfo?.opponent || '---'}</span>
                      </td>
                      {activeTab === 'omitted' && (
                        <td className="p-4 border-l border-slate-100 print:border-slate-200">
                          <span className="text-sm font-black text-red-600">{safeFormat(session.date, 'yyyy/MM/dd')}</span>
                        </td>
                      )}
                      <td className="p-4 print:text-base">
                        <div className="flex flex-col gap-2">
                          {activeTab === 'omitted' ? (
                            <button 
                              onClick={() => navigate(`/expert-sessions?id=${session.id}`)}
                              className="text-xs font-black text-indigo-600 hover:underline bg-white px-3 py-1 rounded-lg border border-slate-200 shadow-sm w-fit"
                            >
                              إثبات قرار الخبير
                            </button>
                          ) : (
                            <div className="hidden print:block h-12 border-b-2 border-dashed border-slate-200 w-full"></div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </>
              )}
            </tbody>
          </table>
        </div>

        {/* Print Footer */}
        <div className="hidden print:block mt-20 p-10 border-t-2 border-slate-100">
          <div className="grid grid-cols-2 gap-20">
            <div className="text-center space-y-8">
              <p className="font-black text-slate-900 text-lg">توقيع المحامي الحاضر</p>
              <div className="h-24 border-2 border-dashed border-slate-200 rounded-3xl"></div>
            </div>
            <div className="text-center space-y-8">
              <p className="font-black text-slate-900 text-lg">ختم المكتب</p>
              <div className="h-24 border-2 border-dashed border-slate-200 rounded-3xl"></div>
            </div>
          </div>
          <div className="mt-20 text-center">
            <p className="text-xs text-slate-400 font-bold">
              هذا التقرير تم إنشاؤه آلياً بواسطة نظام Loyer OS لإدارة المكاتب القانونية.
              <br />
              جميع الحقوق محفوظة © {new Date().getFullYear()} {systemSettings?.officeName || 'مكتب المحامي محمد امين علي الصايغ'}.
            </p>
          </div>
        </div>
      </div>

      {/* Hidden Exportable Area - Completely free of Tailwind classes to avoid oklch error */}
      <div style={{ position: 'fixed', left: '-9999px', top: 0 }}>
        <div id="export-area" ref={exportRef} style={{ 
          width: '1200px', 
          backgroundColor: '#ffffff', 
          padding: '100px 80px', 
          direction: 'rtl',
          fontFamily: '"Amiri", "Traditional Arabic", "Arial", sans-serif',
          color: '#0f172a',
          position: 'relative'
        }}>
          {/* Decorative Classic Border */}
          <div style={{
            position: 'absolute',
            top: '40px',
            bottom: '40px',
            left: '40px',
            right: '40px',
            border: '4px double #1e293b',
            pointerEvents: 'none',
            opacity: 0.15
          }}></div>

          <div style={{ 
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            borderBottom: '2px solid #0f172a', 
            paddingBottom: '30px',
            marginBottom: '40px',
            position: 'relative'
          }}>
            <div style={{ textAlign: 'right', flex: 1 }}>
              <h2 style={{ fontSize: '38px', fontWeight: '900', color: '#0f172a', margin: '0 0 10px 0', lineHeight: '1.2' }}>
                {systemSettings?.officeName || 'مكتب المحامي محمد امين علي الصايغ'}
              </h2>
              <p style={{ fontSize: '22px', fontWeight: '700', color: '#475569', margin: '0 0 20px 0' }}>
                {systemSettings?.officeDescription || 'للمحاماة والاستشارات القانونية والتحكيم'}
              </p>
              <div style={{ fontSize: '15px', color: '#64748b', lineHeight: '1.8', fontWeight: '600' }}>
                <p style={{ margin: '0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ color: '#0f172a' }}>العنوان:</span> {systemSettings?.officeAddress || 'دولة الكويت - مدينة الكويت - المرقاب'}
                </p>
                <p style={{ margin: '0', display: 'flex', alignItems: 'center', gap: '15px' }}>
                  <span><span style={{ color: '#0f172a' }}>هاتف:</span> {systemSettings?.officePhone || '22200000'}</span>
                  {systemSettings?.officeFax && <span><span style={{ color: '#0f172a' }}>فاكس:</span> {systemSettings.officeFax}</span>}
                </p>
              </div>
            </div>

            <div style={{ textAlign: 'center', flex: 0.5, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ 
                width: '100px', 
                height: '100px', 
                backgroundColor: '#ffffff', 
                border: '3px solid #0f172a',
                borderRadius: '30px', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                marginBottom: '15px',
                boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)'
              }}>
                <Scale style={{ width: '50px', height: '50px', color: '#0f172a' }} />
              </div>
              <div style={{ fontSize: '12px', fontWeight: '800', color: '#94a3b8', letterSpacing: '2px' }}>
                LOVER OS LEGAL
              </div>
            </div>

            <div style={{ textAlign: 'left', flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
              <div style={{ backgroundColor: '#f8fafc', padding: '20px', borderRadius: '15px', border: '1px solid #e2e8f0' }}>
                <table style={{ borderCollapse: 'collapse', border: 'none' }}>
                  <tbody>
                    <tr>
                      <td style={{ fontWeight: '900', color: '#64748b', fontSize: '16px', padding: '4px 0', textAlign: 'right' }}>تاريخ التقرير:</td>
                      <td style={{ fontWeight: '900', color: '#0f172a', fontSize: '18px', padding: '4px 15px 4px 0', textAlign: 'left' }}>{format(displayDate, 'yyyy/MM/dd')}</td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: '900', color: '#64748b', fontSize: '16px', padding: '4px 0', textAlign: 'right' }}>اليوم:</td>
                      <td style={{ fontWeight: '900', color: '#0f172a', fontSize: '18px', padding: '4px 15px 4px 0', textAlign: 'left' }}>{format(displayDate, 'EEEE', { locale: arSA })}</td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: '900', color: '#64748b', fontSize: '16px', padding: '4px 0', textAlign: 'right' }}>رقم الرول:</td>
                      <td style={{ fontWeight: '900', color: '#0f172a', fontSize: '18px', padding: '4px 15px 4px 0', textAlign: 'left' }}>#{format(displayDate, 'yyyyMMdd')}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div style={{ textAlign: 'center', marginBottom: '60px' }}>
            <h1 style={{ 
              fontSize: '56px', 
              fontWeight: '950', 
              color: '#0f172a', 
              margin: '0',
              textDecoration: 'underline',
              textDecorationThickness: '6px',
              textUnderlineOffset: '12px'
            }}>
              رول الجلسات اليومي لليوم {format(displayDate, 'EEEE', { locale: arSA })} الموافق {format(displayDate, 'yyyy/MM/dd')}
            </h1>
            <p style={{ fontSize: '24px', fontWeight: '800', color: '#4f46e5', marginTop: '25px', opacity: 0.8 }}>
              كشف تفصيلي بجلسات القضايا المنظورة أمام المحاكم
            </p>
          </div>

          {/* Sub Header for Court if filtered */}
          {selectedCourt !== 'ALL' && (
            <div style={{ 
              backgroundColor: '#0f172a', 
              color: '#ffffff', 
              padding: '12px 30px', 
              borderRadius: '10px', 
              display: 'inline-block',
              marginBottom: '30px',
              fontSize: '18px',
              fontWeight: '900'
            }}>
              محكمة: {selectedCourt}
            </div>
          )}

          {/* Sessions Table */}
          <table style={{ 
            width: '100%', 
            borderCollapse: 'separate', 
            borderSpacing: '0',
            textAlign: 'right',
            marginBottom: '50px',
            border: '2px solid #0f172a',
            borderRadius: '16px',
            overflow: 'hidden'
          }}>
            <thead>
              <tr style={{ backgroundColor: '#0f172a' }}>
                <th style={{ padding: '25px 15px', color: '#ffffff', fontSize: '18px', fontWeight: '900', width: '60px', textAlign: 'center' }}>م</th>
                <th style={{ padding: '25px 15px', color: '#ffffff', fontSize: '18px', fontWeight: '900', width: '180px' }}>المحكمة</th>
                <th style={{ padding: '25px 15px', color: '#ffffff', fontSize: '18px', fontWeight: '900', width: '120px' }}>الدائرة</th>
                <th style={{ padding: '25px 15px', color: '#ffffff', fontSize: '18px', fontWeight: '900', width: '150px' }}>رقم القضية</th>
                <th style={{ padding: '25px 15px', color: '#ffffff', fontSize: '18px', fontWeight: '900', width: '220px' }}>الموكل</th>
                <th style={{ padding: '25px 15px', color: '#ffffff', fontSize: '18px', fontWeight: '900', width: '220px' }}>الخصم</th>
                <th style={{ padding: '25px 15px', color: '#ffffff', fontSize: '18px', fontWeight: '900' }}>القرار المتخذ</th>
              </tr>
            </thead>
            <tbody>
              {filteredSessions.map((session, index) => (
                <tr key={session.id} style={{ backgroundColor: index % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                  <td style={{ padding: '25px 15px', borderBottom: '1px solid #e2e8f0', fontSize: '17px', fontWeight: '900', textAlign: 'center', color: '#94a3b8' }}>{index + 1}</td>
                  <td style={{ padding: '25px 15px', borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>
                    <span style={{ fontSize: '23px', fontWeight: '900', color: '#4f46e5' }}>{session.caseInfo?.court || '---'}</span>
                  </td>
                  <td style={{ padding: '25px 15px', borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>
                    <span style={{ fontSize: '20px', fontWeight: '800', color: '#64748b' }}>{session.caseInfo?.circuit || '---'}</span>
                  </td>
                  <td style={{ padding: '25px 15px', borderBottom: '1px solid #e2e8f0', fontSize: '26px', fontWeight: '950', color: '#0f172a' }}>
                    {session.caseInfo?.caseNumber || '---'} / {session.caseInfo?.year || '----'}
                  </td>
                  <td style={{ padding: '25px 15px', borderBottom: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '24px', fontWeight: '900', color: '#0f172a' }}>{session.caseInfo?.clientName || '---'}</div>
                    {session.caseInfo?.clientPosition && (
                      <div style={{ fontSize: '16px', fontWeight: '800', color: '#4f46e5', marginTop: '6px' }}>
                        ({session.caseInfo.clientPosition === 'plaintiff' ? 'مدعي' : 
                          session.caseInfo.clientPosition === 'defendant' ? 'مدعى عليه' :
                          session.caseInfo.clientPosition === 'appellant' ? 'مستأنف' : 'مستأنف ضده'})
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '25px 15px', borderBottom: '1px solid #e2e8f0', fontSize: '22px', fontWeight: '800', color: '#475569' }}>{session.caseInfo?.opponent || '---'}</td>
                  <td style={{ padding: '25px 15px', borderBottom: '1px solid #e2e8f0' }}>
                    {session.decision ? (
                      <div style={{ fontSize: '22px', fontWeight: '800', color: '#065f46', lineHeight: '1.6' }}>
                        {session.decision}
                        {session.nextDate && (
                          <div style={{ fontSize: '16px', color: '#4f46e5', marginTop: '10px', fontWeight: '900', backgroundColor: '#eef2ff', display: 'inline-block', padding: '4px 12px', borderRadius: '6px' }}>
                            الجلسة القادمة: {format(new Date(session.nextDate), 'yyyy/MM/dd')}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div style={{ height: '50px', borderBottom: '1px dashed #cbd5e1', width: '100%' }}></div>
                    )}
                  </td>
                </tr>
              ))}
              {filteredSessions.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ padding: '60px', textAlign: 'center', color: '#94a3b8', fontSize: '18px', fontWeight: '800' }}>
                    لا توجد جلسات مسجلة لهذا اليوم
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {/* Expert Sessions in Export */}
          {filteredExpertSessions.length > 0 && (
            <div style={{ marginTop: '60px', position: 'relative' }}>
              <div style={{ 
                backgroundColor: '#0f172a', 
                color: '#ffffff', 
                padding: '20px', 
                textAlign: 'center', 
                fontSize: '24px', 
                fontWeight: '950', 
                borderRadius: '16px 16px 0 0'
              }}>
                رول جلسات الخبراء
              </div>
              <table style={{ 
                width: '100%', 
                borderCollapse: 'separate', 
                borderSpacing: '0',
                textAlign: 'right',
                border: '2px solid #0f172a',
                borderTop: 'none',
                borderRadius: '0 0 16px 16px',
                overflow: 'hidden'
              }}>
                <thead>
                  <tr style={{ backgroundColor: '#0f172a' }}>
                    <th style={{ padding: '20px 15px', borderBottom: '2px solid #0f172a', fontSize: '17px', fontWeight: '900', width: '60px', textAlign: 'center', color: '#ffffff' }}>م</th>
                    <th style={{ padding: '25px 15px', color: '#ffffff', fontSize: '18px', fontWeight: '900', width: '150px' }}>الخبير</th>
                    <th style={{ padding: '25px 15px', color: '#ffffff', fontSize: '18px', fontWeight: '900', width: '130px' }}>المكان</th>
                    <th style={{ padding: '20px 15px', borderBottom: '2px solid #0f172a', fontSize: '17px', fontWeight: '900', color: '#ffffff' }}>رقم القضية</th>
                    <th style={{ padding: '20px 15px', borderBottom: '2px solid #0f172a', fontSize: '17px', fontWeight: '900', color: '#ffffff' }}>الموكل</th>
                    <th style={{ padding: '20px 15px', borderBottom: '2px solid #0f172a', fontSize: '17px', fontWeight: '900', color: '#ffffff' }}>الخصم</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredExpertSessions.map((session, index) => (
                    <tr key={session.id}>
                      <td style={{ padding: '20px 15px', borderBottom: '1px solid #f1f5f9', fontSize: '17px', fontWeight: '900', textAlign: 'center', color: '#94a3b8' }}>{index + 1}</td>
                      <td style={{ padding: '20px 15px', borderBottom: '1px solid #f1f5f9', whiteSpace: 'nowrap' }}>
                        <span style={{ fontSize: '23px', fontWeight: '950', color: '#059669' }}>{session.expertName}</span>
                      </td>
                      <td style={{ padding: '20px 15px', borderBottom: '1px solid #f1f5f9', whiteSpace: 'nowrap' }}>
                        <span style={{ fontSize: '20px', fontWeight: '800', color: '#94a3b8' }}>{session.officeLocation || '---'}</span>
                      </td>
                      <td style={{ padding: '20px 15px', borderBottom: '1px solid #f1f5f9', fontSize: '26px', fontWeight: '950' }}>{session.caseInfo?.caseNumber || '---'}</td>
                      <td style={{ padding: '20px 15px', borderBottom: '1px solid #f1f5f9', fontSize: '24px', fontWeight: '900' }}>{session.caseInfo?.clientName || '---'}</td>
                      <td style={{ padding: '20px 15px', borderBottom: '1px solid #f1f5f9', fontSize: '22px', fontWeight: '800' }}>{session.caseInfo?.opponent || '---'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          
          {/* Professional Footer Signatures */}
          <div style={{ 
            marginTop: '120px', 
            display: 'flex', 
            justifyContent: 'space-between',
            alignItems: 'flex-start'
          }}>
            <div style={{ textAlign: 'center', width: '350px' }}>
              <p style={{ fontSize: '20px', fontWeight: '950', color: '#0f172a', marginBottom: '80px' }}>توقيع المحامي الحاضر</p>
              <div style={{ borderBottom: '3px solid #0f172a', width: '250px', margin: '0 auto' }}></div>
              <p style={{ fontSize: '12px', color: '#94a3b8', marginTop: '10px' }}>Signature of attending lawyer</p>
            </div>
            
            <div style={{ textAlign: 'center', width: '350px', position: 'relative' }}>
              {/* Decorative Stamp Area */}
              <div style={{
                position: 'absolute',
                top: '60px',
                left: '50%',
                transform: 'translateX(-50%) rotate(-15deg)',
                width: '180px',
                height: '180px',
                border: '6px double rgba(15, 23, 42, 0.05)',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 0
              }}>
                <div style={{ fontSize: '10px', fontWeight: '900', color: 'rgba(15, 23, 42, 0.05)', textAlign: 'center' }}>
                  ختم المكتب الرسمي<br />AUTHENTIFIED STAMP
                </div>
              </div>
              
              <p style={{ fontSize: '20px', fontWeight: '950', color: '#0f172a', marginBottom: '80px', position: 'relative', zIndex: 1 }}>ختم واعتماد المكتب</p>
              <div style={{ borderBottom: '3px solid #0f172a', width: '250px', margin: '0 auto', position: 'relative', zIndex: 1 }}></div>
              <p style={{ fontSize: '12px', color: '#94a3b8', marginTop: '10px', position: 'relative', zIndex: 1 }}>Official Office Stamp</p>
            </div>
          </div>

          <div style={{ marginTop: '150px', textAlign: 'center', borderTop: '2px solid #f1f5f9', paddingTop: '30px' }}>
            <p style={{ fontSize: '12px', color: '#64748b', fontWeight: '800', margin: '0' }}>
              صدر هذا المستند من خلال المنظومة القانونية المتكاملة Loyer OS لإدارة المكاتب
            </p>
            <p style={{ fontSize: '12px', color: '#94a3b8', fontWeight: '900', margin: '8px 0 0 0', textTransform: 'uppercase' }}>
              All Rights Reserved © {new Date().getFullYear()} {systemSettings?.officeName || 'Lawyer Office Management System'}
            </p>
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
                          {safeFormat(s.date, 'dd MMMM yyyy')}
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
                            الجلسة القادمة: {safeFormat(s.nextDate, 'yyyy/MM/dd')}
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
      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setSessionToDeleteId(null);
        }}
        onConfirm={handleDeleteSession}
        title="حذف الجلسة"
        message="هل أنت متأكد من حذف هذه الجلسة؟ لا يمكن التراجع عن هذا الإجراء."
        confirmLabel="حذف"
        cancelLabel="إلغاء"
      />

      {/* Omit Confirmation Modal */}
      <ConfirmModal
        isOpen={isOmitModalOpen}
        onClose={() => {
          setIsOmitModalOpen(false);
          setSessionToOmitId(null);
        }}
        onConfirm={handleOmitSession}
        title="تجاهل الجلسة"
        message="هل أنت متأكد من تجاهل هذه الجلسة؟ سيتم تسجيلها كـ 'تم التجاوز'."
        confirmLabel="تجاهل"
        cancelLabel="إلغاء"
        variant="warning"
      />
    </div>
  );
}
