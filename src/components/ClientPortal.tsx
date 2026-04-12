import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, orderBy, doc, getDoc, addDoc, getDocs } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { 
  Briefcase, 
  CalendarClock, 
  FileText, 
  Scale, 
  Clock, 
  CheckCircle2,
  Users,
  Bell,
  DollarSign,
  TrendingUp,
  Download,
  Eye,
  X,
  Gavel,
  ClipboardList,
  AlertCircle,
  ChevronLeft,
  MessageSquare,
  Plus,
  Send
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Case, Session, ExpertSession, UserProfile, Document, Finance, Procedure, Judgment, ConsultationRequest } from '../types';
import { format, parseISO } from 'date-fns';
import { arSA } from 'date-fns/locale';
import { cn } from '../lib/utils';

interface ClientPortalProps {
  user: UserProfile;
}

export default function ClientPortal({ user }: ClientPortalProps) {
  const [cases, setCases] = useState<Case[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [expertSessions, setExpertSessions] = useState<ExpertSession[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [finances, setFinances] = useState<Finance[]>([]);
  const [procedures, setProcedures] = useState<Procedure[]>([]);
  const [judgments, setJudgments] = useState<Judgment[]>([]);
  const [consultations, setConsultations] = useState<ConsultationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCase, setSelectedCase] = useState<Case | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'cases' | 'documents' | 'finance' | 'consultation'>('overview');
  const [isRequesting, setIsRequesting] = useState(false);
  const [newRequest, setNewRequest] = useState({ subject: '', description: '' });

  useEffect(() => {
    // Listen for client's cases
    const casesQuery = query(
      collection(db, 'cases'),
      where('clientId', '==', user.uid)
    );
    
    const unsubCases = onSnapshot(casesQuery, (snapshot) => {
      const clientCases = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Case));
      setCases(clientCases);
      
      // Listen for consultations
      const consultQuery = query(
        collection(db, 'consultations'),
        where('clientId', '==', user.uid),
        orderBy('date', 'desc')
      );
      const unsubConsult = onSnapshot(consultQuery, (snap) => {
        setConsultations(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ConsultationRequest)));
      });

      if (clientCases.length > 0) {
        const caseIds = clientCases.map(c => c.id);
        
        // Listen for sessions related to these cases
        const sessionsQuery = query(
          collection(db, 'sessions'),
          where('caseId', 'in', caseIds.slice(0, 10)),
          orderBy('date', 'asc')
        );
        const unsubSessions = onSnapshot(sessionsQuery, (sessSnap) => {
          setSessions(sessSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Session)));
        });

        // Listen for expert sessions
        const expertQuery = query(
          collection(db, 'expertSessions'),
          where('caseId', 'in', caseIds.slice(0, 10)),
          orderBy('date', 'asc')
        );
        const unsubExpert = onSnapshot(expertQuery, (expSnap) => {
          setExpertSessions(expSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ExpertSession)));
        });

        // Listen for documents
        const docsQuery = query(
          collection(db, 'documents'),
          where('caseId', 'in', caseIds.slice(0, 10)),
          orderBy('uploadDate', 'desc')
        );
        const unsubDocs = onSnapshot(docsQuery, (docsSnap) => {
          setDocuments(docsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Document)));
        });

        // Listen for finances
        const financeQuery = query(
          collection(db, 'finance'),
          where('caseId', 'in', caseIds.slice(0, 10))
        );
        const unsubFinance = onSnapshot(financeQuery, (finSnap) => {
          setFinances(finSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Finance)));
        });

        // Listen for procedures
        const procQuery = query(
          collection(db, 'procedures'),
          where('caseId', 'in', caseIds.slice(0, 10)),
          orderBy('date', 'desc')
        );
        const unsubProc = onSnapshot(procQuery, (procSnap) => {
          setProcedures(procSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Procedure)));
        });

        // Listen for judgments
        const judgmentQuery = query(
          collection(db, 'judgments'),
          where('caseId', 'in', caseIds.slice(0, 10)),
          orderBy('date', 'desc')
        );
        const unsubJudgment = onSnapshot(judgmentQuery, (judgSnap) => {
          setJudgments(judgSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Judgment)));
        });

        setLoading(false);
        return () => {
          unsubSessions();
          unsubExpert();
          unsubDocs();
          unsubFinance();
          unsubProc();
          unsubJudgment();
        };
      } else {
        setLoading(false);
      }
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'cases');
      setLoading(false);
    });

    return () => unsubCases();
  }, [user.uid]);

  const activeCasesCount = cases.filter(c => c.status === 'active').length;
  const today = new Date().toISOString().split('T')[0];
  const upcomingSessions = sessions.filter(s => s.date >= today);
  const upcomingExpert = expertSessions.filter(s => s.date >= today);

  const totalFees = finances.reduce((sum, f) => sum + (f.totalFees || 0), 0);
  const totalReceived = finances.reduce((sum, f) => sum + (f.receivedAmount || 0), 0);
  const totalRemaining = totalFees - totalReceived;

  const handleRequestConsultation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRequest.subject || !newRequest.description) return;
    setIsRequesting(true);
    try {
      await addDoc(collection(db, 'consultations'), {
        clientId: user.uid,
        clientName: user.name,
        subject: newRequest.subject,
        description: newRequest.description,
        status: 'pending',
        date: new Date().toISOString()
      });
      setNewRequest({ subject: '', description: '' });
      // Notify lawyers/admins
      const lawyersSnap = await getDocs(query(collection(db, 'users'), where('role', 'in', ['admin', 'lawyer'])));
      for (const lawyer of lawyersSnap.docs) {
        await addDoc(collection(db, 'notifications'), {
          userId: lawyer.id,
          title: 'طلب استشارة جديد',
          message: `الموكل ${user.name} طلب استشارة بخصوص: ${newRequest.subject}`,
          type: 'system',
          date: new Date().toISOString(),
          isRead: false
        });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'consultations');
    } finally {
      setIsRequesting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const renderTimeline = (caseId: string) => {
    const caseSessions = sessions.filter(s => s.caseId === caseId);
    const caseProcedures = procedures.filter(p => p.caseId === caseId);
    const caseJudgments = judgments.filter(j => j.caseId === caseId);

    const timelineEvents = [
      ...caseSessions.map(s => ({ date: s.date, type: 'session', data: s })),
      ...caseProcedures.map(p => ({ date: p.date, type: 'procedure', data: p })),
      ...caseJudgments.map(j => ({ date: j.date, type: 'judgment', data: j })),
    ].sort((a, b) => b.date.localeCompare(a.date));

    return (
      <div className="space-y-6 relative before:absolute before:right-4 before:top-0 before:bottom-0 before:w-0.5 before:bg-slate-100">
        {timelineEvents.map((event, idx) => (
          <div key={idx} className="relative pr-12">
            <div className={cn(
              "absolute right-0 top-0 w-8 h-8 rounded-full flex items-center justify-center shadow-sm z-10",
              event.type === 'session' ? "bg-indigo-100 text-indigo-600" :
              event.type === 'procedure' ? "bg-emerald-100 text-emerald-600" : "bg-amber-100 text-amber-600"
            )}>
              {event.type === 'session' ? <CalendarClock className="w-4 h-4" /> :
               event.type === 'procedure' ? <ClipboardList className="w-4 h-4" /> : <Gavel className="w-4 h-4" />}
            </div>
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    {(() => {
                      try {
                        if (!event.date) return '---';
                        const d = parseISO(event.date);
                        if (isNaN(d.getTime())) return '---';
                        return format(d, 'dd MMMM yyyy', { locale: arSA });
                      } catch (e) {
                        console.error('ClientPortal: Error parsing timeline event date:', event.date, e);
                        return '---';
                      }
                    })()}
                  </span>
                  <span className={cn(
                    "px-2 py-0.5 rounded-lg text-[10px] font-black uppercase",
                    event.type === 'session' ? "bg-indigo-600 text-white" :
                    event.type === 'procedure' ? "bg-emerald-600 text-white" : "bg-amber-600 text-white"
                  )}>
                    {event.type === 'session' ? 'جلسة' : event.type === 'procedure' ? 'إجراء' : 'حكم'}
                  </span>
                </div>
              {event.type === 'session' && (
                <div>
                  <p className="text-sm font-bold text-slate-900">{(event.data as Session).decision || 'بانتظار القرار'}</p>
                  {(event.data as Session).notes && <p className="text-xs text-slate-500 mt-1">{(event.data as Session).notes}</p>}
                </div>
              )}
              {event.type === 'procedure' && (
                <div>
                  <p className="text-sm font-bold text-slate-900">{(event.data as Procedure).type}</p>
                  {(event.data as Procedure).notes && <p className="text-xs text-slate-500 mt-1">{(event.data as Procedure).notes}</p>}
                </div>
              )}
              {event.type === 'judgment' && (
                <div>
                  <p className="text-sm font-bold text-slate-900">{(event.data as Judgment).result}</p>
                  <p className="text-xs text-slate-500 mt-1">نوع الحكم: {(event.data as Judgment).type === 'initial' ? 'ابتدائي' : (event.data as Judgment).type === 'appeal' ? 'استئناف' : 'تمييز'}</p>
                </div>
              )}
            </div>
          </div>
        ))}
        {timelineEvents.length === 0 && (
          <div className="text-center py-12 text-slate-400 font-bold">لا توجد أحداث مسجلة لهذه القضية</div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-8 rtl" dir="rtl">
      <div className="bg-gradient-to-r from-indigo-600 to-indigo-800 p-8 rounded-3xl text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10">
          <h1 className="text-3xl font-black mb-2">مرحباً بك، {user.name}</h1>
          <p className="text-indigo-100 font-medium">بوابة الموكل الإلكترونية - تابع قضاياك وجلساتك بكل سهولة.</p>
        </div>
        <Scale className="absolute -bottom-8 -left-8 w-64 h-64 text-white/10 rotate-12" />
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 bg-white p-2 rounded-2xl border border-slate-200 shadow-sm overflow-x-auto">
        {[
          { id: 'overview', label: 'نظرة عامة', icon: TrendingUp },
          { id: 'cases', label: 'قضاياي', icon: Briefcase },
          { id: 'documents', label: 'مستنداتي', icon: FileText },
          { id: 'finance', label: 'المالية', icon: DollarSign },
          { id: 'consultation', label: 'الاستشارات', icon: MessageSquare },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={cn(
              "flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm transition-all whitespace-nowrap",
              activeTab === tab.id ? "bg-indigo-600 text-white shadow-lg shadow-indigo-100" : "text-slate-500 hover:bg-slate-50"
            )}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'overview' && (
          <motion.div
            key="overview"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-8"
          >
            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-4 mb-4">
                  <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
                    <Briefcase className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-slate-500 text-sm font-bold">إجمالي القضايا</p>
                    <h3 className="text-2xl font-black text-slate-900">{cases.length}</h3>
                  </div>
                </div>
              </div>
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-4 mb-4">
                  <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
                    <Scale className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-slate-500 text-sm font-bold">قضايا متداولة</p>
                    <h3 className="text-2xl font-black text-slate-900">{activeCasesCount}</h3>
                  </div>
                </div>
              </div>
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-4 mb-4">
                  <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-slate-500 text-sm font-bold">قضايا منتهية</p>
                    <h3 className="text-2xl font-black text-slate-900">{cases.length - activeCasesCount}</h3>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Upcoming Sessions */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                  <CalendarClock className="w-5 h-5 text-indigo-600" />
                  الجلسات القادمة
                </h3>
                <div className="space-y-4">
                  {upcomingSessions.length > 0 ? upcomingSessions.map((session, i) => (
                    <div key={i} className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
                      <div className="flex flex-col items-center justify-center bg-white p-2 rounded-lg border border-slate-200 min-w-[64px]">
                        <span className="text-[10px] font-black text-indigo-600 uppercase">
                          {(() => {
                            try {
                              if (!session.date) return '---';
                              const d = parseISO(session.date);
                              if (isNaN(d.getTime())) return '---';
                              return format(d, 'MMMM', { locale: arSA });
                            } catch (e) {
                              console.error('ClientPortal: Error parsing session date (month):', session.date, e);
                              return '---';
                            }
                          })()}
                        </span>
                        <span className="text-xl font-black text-slate-900">
                          {(() => {
                            try {
                              if (!session.date) return '--';
                              const d = parseISO(session.date);
                              if (isNaN(d.getTime())) return '--';
                              return format(d, 'dd');
                            } catch (e) {
                              console.error('ClientPortal: Error parsing session date (day):', session.date, e);
                              return '--';
                            }
                          })()}
                        </span>
                      </div>
                      <div className="flex-1">
                        <h4 className="text-sm font-bold text-slate-900">جلسة مرافعة</h4>
                        <p className="text-xs text-slate-500">قضية رقم: {cases.find(c => c.id === session.caseId)?.caseNumber || '---'}</p>
                      </div>
                    </div>
                  )) : (
                    <p className="text-center py-8 text-slate-400 font-medium">لا توجد جلسات قادمة</p>
                  )}
                </div>
              </div>

              {/* Expert Sessions */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                  <Users className="w-5 h-5 text-indigo-600" />
                  جلسات الخبراء
                </h3>
                <div className="space-y-4">
                  {upcomingExpert.length > 0 ? upcomingExpert.map((session, i) => (
                    <div key={i} className="flex items-center gap-4 p-4 bg-amber-50/50 rounded-xl border border-amber-100">
                      <div className="flex flex-col items-center justify-center bg-white p-2 rounded-lg border border-amber-200 min-w-[64px]">
                        <span className="text-[10px] font-black text-amber-600 uppercase">
                          {(() => {
                            try {
                              if (!session.date) return '---';
                              const d = parseISO(session.date);
                              if (isNaN(d.getTime())) return '---';
                              return format(d, 'MMMM', { locale: arSA });
                            } catch (e) {
                              console.error('ClientPortal: Error parsing expert session date (month):', session.date, e);
                              return '---';
                            }
                          })()}
                        </span>
                        <span className="text-xl font-black text-slate-900">
                          {(() => {
                            try {
                              if (!session.date) return '--';
                              const d = parseISO(session.date);
                              if (isNaN(d.getTime())) return '--';
                              return format(d, 'dd');
                            } catch (e) {
                              console.error('ClientPortal: Error parsing expert session date (day):', session.date, e);
                              return '--';
                            }
                          })()}
                        </span>
                      </div>
                      <div className="flex-1">
                        <h4 className="text-sm font-bold text-slate-900">{session.expertName}</h4>
                        <p className="text-xs text-slate-500">{session.officeLocation}</p>
                      </div>
                    </div>
                  )) : (
                    <p className="text-center py-8 text-slate-400 font-medium">لا توجد جلسات خبراء قادمة</p>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'cases' && (
          <motion.div
            key="cases"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm"
          >
            <div className="overflow-x-auto">
              <table className="w-full text-right">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="pb-4 font-bold text-slate-500 text-sm">رقم القضية</th>
                    <th className="pb-4 font-bold text-slate-500 text-sm">المحكمة</th>
                    <th className="pb-4 font-bold text-slate-500 text-sm">الخصم</th>
                    <th className="pb-4 font-bold text-slate-500 text-sm">الحالة</th>
                    <th className="pb-4 font-bold text-slate-500 text-sm">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {cases.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50 transition-all group">
                      <td className="py-4 font-bold text-slate-900">{c.caseNumber}</td>
                      <td className="py-4 text-slate-600 text-sm">{c.court}</td>
                      <td className="py-4 text-slate-600 text-sm">{c.opponent}</td>
                      <td className="py-4">
                        <span className={cn(
                          "px-3 py-1 rounded-full text-xs font-bold",
                          c.status === 'active' ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
                        )}>
                          {c.status === 'active' ? 'متداولة' : 'منتهية'}
                        </span>
                      </td>
                      <td className="py-4">
                        <button
                          onClick={() => setSelectedCase(c)}
                          className="flex items-center gap-2 text-indigo-600 font-bold text-xs hover:bg-indigo-50 px-3 py-2 rounded-xl transition-all"
                        >
                          <Eye className="w-4 h-4" />
                          عرض التفاصيل
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}

        {activeTab === 'documents' && (
          <motion.div
            key="documents"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
          >
            {documents.map((docItem) => (
              <div key={docItem.id} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all group">
                <div className="aspect-[4/3] bg-slate-50 rounded-xl mb-4 flex items-center justify-center border border-slate-100 group-hover:bg-indigo-50 transition-all">
                  <FileText className="w-12 h-12 text-slate-200 group-hover:text-indigo-200 transition-all" />
                </div>
                <h4 className="text-sm font-black text-slate-900 truncate mb-1">{docItem.title}</h4>
                <p className="text-[10px] text-slate-400 font-bold uppercase mb-3">قضية: {cases.find(c => c.id === docItem.caseId)?.caseNumber}</p>
                <div className="flex items-center justify-between pt-3 border-t border-slate-50">
                  <span className="text-[10px] text-slate-400 font-medium">{format(new Date(docItem.uploadDate), 'yyyy/MM/dd')}</span>
                  <a
                    href={docItem.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 hover:bg-indigo-50 text-indigo-600 rounded-lg transition-all"
                  >
                    <Download className="w-4 h-4" />
                  </a>
                </div>
              </div>
            ))}
            {documents.length === 0 && (
              <div className="col-span-full py-20 text-center bg-white rounded-3xl border border-slate-200">
                <FileText className="w-16 h-16 text-slate-100 mx-auto mb-4" />
                <p className="text-slate-400 font-bold">لا توجد مستندات مرفوعة حالياً</p>
              </div>
            )}
          </motion.div>
        )}

        {activeTab === 'finance' && (
          <motion.div
            key="finance"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-8"
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <p className="text-slate-500 text-xs font-bold mb-1 uppercase tracking-widest">إجمالي الأتعاب</p>
                <h3 className="text-2xl font-black text-slate-900">{totalFees.toLocaleString()} د.ك</h3>
              </div>
              <div className="bg-emerald-50 p-6 rounded-2xl border border-emerald-100 shadow-sm">
                <p className="text-emerald-600 text-xs font-bold mb-1 uppercase tracking-widest">المبالغ المسددة</p>
                <h3 className="text-2xl font-black text-emerald-900">{totalReceived.toLocaleString()} د.ك</h3>
              </div>
              <div className="bg-red-50 p-6 rounded-2xl border border-red-100 shadow-sm">
                <p className="text-red-600 text-xs font-bold mb-1 uppercase tracking-widest">المتبقي</p>
                <h3 className="text-2xl font-black text-red-900">{totalRemaining.toLocaleString()} د.ك</h3>
              </div>
            </div>

            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
              <h3 className="text-lg font-bold text-slate-900 mb-6">تفاصيل الدفعات لكل قضية</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-right">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="pb-4 font-bold text-slate-500 text-sm">رقم القضية</th>
                      <th className="pb-4 font-bold text-slate-500 text-sm">إجمالي الأتعاب</th>
                      <th className="pb-4 font-bold text-slate-500 text-sm">المسدد</th>
                      <th className="pb-4 font-bold text-slate-500 text-sm">المتبقي</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {finances.map((f) => (
                      <tr key={f.id}>
                        <td className="py-4 font-bold text-slate-900">{cases.find(c => c.id === f.caseId)?.caseNumber}</td>
                        <td className="py-4 text-slate-600 font-medium">{f.totalFees.toLocaleString()} د.ك</td>
                        <td className="py-4 text-emerald-600 font-bold">{f.receivedAmount.toLocaleString()} د.ك</td>
                        <td className="py-4 text-red-600 font-bold">{(f.totalFees - f.receivedAmount).toLocaleString()} د.ك</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'consultation' && (
          <motion.div
            key="consultation"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="grid grid-cols-1 lg:grid-cols-3 gap-8"
          >
            {/* Request Form */}
            <div className="lg:col-span-1 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm h-fit">
              <h3 className="text-lg font-black text-slate-900 mb-6 flex items-center gap-2">
                <Plus className="w-5 h-5 text-indigo-600" />
                طلب استشارة جديدة
              </h3>
              <form onSubmit={handleRequestConsultation} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-500 uppercase">الموضوع</label>
                  <input
                    type="text"
                    required
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-indigo-600 outline-none transition-all"
                    placeholder="مثال: استفسار عن قضية مدنية"
                    value={newRequest.subject}
                    onChange={(e) => setNewRequest({ ...newRequest, subject: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-500 uppercase">التفاصيل</label>
                  <textarea
                    required
                    rows={4}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-indigo-600 outline-none transition-all resize-none"
                    placeholder="اشرح تفاصيل استفسارك هنا..."
                    value={newRequest.description}
                    onChange={(e) => setNewRequest({ ...newRequest, description: e.target.value })}
                  />
                </div>
                <button
                  type="submit"
                  disabled={isRequesting}
                  className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white py-4 rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 disabled:opacity-50"
                >
                  {isRequesting ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      إرسال الطلب
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* Previous Requests */}
            <div className="lg:col-span-2 space-y-4">
              <h3 className="text-lg font-black text-slate-900 mb-2">طلباتي السابقة</h3>
              {consultations.map((req) => (
                <div key={req.id} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center",
                        req.status === 'pending' ? "bg-amber-50 text-amber-600" : "bg-emerald-50 text-emerald-600"
                      )}>
                        <MessageSquare className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-black text-slate-900">{req.subject}</h4>
                        <p className="text-[10px] text-slate-400 font-bold uppercase">
                          {(() => {
                            try {
                              if (!req.date) return '---';
                              const d = parseISO(req.date);
                              if (isNaN(d.getTime())) return '---';
                              return format(d, 'dd MMMM yyyy', { locale: arSA });
                            } catch (e) {
                              console.error('ClientPortal: Error parsing consultation date:', req.date, e);
                              return '---';
                            }
                          })()}
                        </p>
                      </div>
                    </div>
                    <span className={cn(
                      "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
                      req.status === 'pending' ? "bg-amber-100 text-amber-700" : 
                      req.status === 'replied' ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-700"
                    )}>
                      {req.status === 'pending' ? 'قيد الانتظار' : req.status === 'replied' ? 'تم الرد' : 'مغلق'}
                    </span>
                  </div>
                  <p className="text-sm text-slate-600 leading-relaxed">{req.description}</p>
                  {req.reply && (
                    <div className="bg-indigo-50 p-4 rounded-2xl border border-indigo-100 mt-4">
                      <p className="text-[10px] font-black text-indigo-600 uppercase mb-2">رد المكتب:</p>
                      <p className="text-sm text-indigo-900 font-medium">{req.reply}</p>
                    </div>
                  )}
                </div>
              ))}
              {consultations.length === 0 && (
                <div className="text-center py-20 bg-white rounded-3xl border border-slate-200">
                  <MessageSquare className="w-16 h-16 text-slate-100 mx-auto mb-4" />
                  <p className="text-slate-400 font-bold">لا توجد طلبات استشارة سابقة</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Case Details Modal */}
      <AnimatePresence>
        {selectedCase && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedCase(null)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white w-full max-w-4xl max-h-[90vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-indigo-600 rounded-2xl text-white shadow-lg shadow-indigo-100">
                    <Briefcase className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-slate-900">تفاصيل القضية: {selectedCase.caseNumber}</h2>
                    <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">{selectedCase.court} - {selectedCase.circuit}</p>
                  </div>
                </div>
                <button onClick={() => setSelectedCase(null)} className="p-2 hover:bg-white rounded-xl transition-all">
                  <X className="w-6 h-6 text-slate-400" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  {/* Info Sidebar */}
                  <div className="space-y-6">
                    <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 space-y-4">
                      <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest border-b border-slate-200 pb-2">معلومات عامة</h3>
                      <div className="space-y-3">
                        <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase">الخصم</p>
                          <p className="text-sm font-bold text-slate-900">{selectedCase.opponent}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase">نوع القضية</p>
                          <p className="text-sm font-bold text-slate-900">{selectedCase.caseType}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase">الرقم الآلي</p>
                          <p className="text-sm font-mono font-bold text-indigo-600">{selectedCase.autoNumber || '---'}</p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-indigo-50 p-6 rounded-2xl border border-indigo-100">
                      <h3 className="text-sm font-black text-indigo-900 uppercase tracking-widest mb-4">الحالة الحالية</h3>
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-white rounded-xl text-indigo-600 shadow-sm">
                          <AlertCircle className="w-5 h-5" />
                        </div>
                        <span className="text-lg font-black text-indigo-900">
                          {selectedCase.status === 'active' ? 'متداولة' : 'منتهية'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Timeline */}
                  <div className="md:col-span-2">
                    <h3 className="text-lg font-black text-slate-900 mb-6 flex items-center gap-2">
                      <Clock className="w-5 h-5 text-indigo-600" />
                      الجدول الزمني للقضية
                    </h3>
                    {renderTimeline(selectedCase.id)}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
