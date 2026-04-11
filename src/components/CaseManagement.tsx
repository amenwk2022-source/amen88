import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { collection, addDoc, onSnapshot, query, orderBy, deleteDoc, doc, updateDoc, where } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Plus, Search, Filter, Briefcase, Scale, Gavel, Archive, MoreVertical, Trash2, Edit2, X, Check, ArrowLeftRight, CalendarPlus, FileCheck, DollarSign, Clock, FileText, Eye, CheckCircle2, Printer } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Case, CaseStatus, Client, Judgment, UserProfile } from '../types';
import { cn } from '../lib/utils';
import { addDays, format, parseISO } from 'date-fns';

const STATUS_MAP: Record<CaseStatus, { label: string; color: string; icon: any }> = {
  'pre-filing': { label: 'تحت الرفع', color: 'blue', icon: Briefcase },
  'active': { label: 'متداولة', color: 'indigo', icon: Scale },
  'execution': { label: 'تنفيذ', color: 'amber', icon: Gavel },
  'archive': { label: 'أرشيف', color: 'emerald', icon: Archive },
  'judgment': { label: 'حكم قضائي', color: 'amber', icon: Gavel },
};

const POSITION_LABELS: Record<string, string> = {
  plaintiff: 'مدعي',
  defendant: 'مدعى عليه',
  appellant: 'مستأنف',
  appellee: 'مستأنف ضده'
};

interface CaseManagementProps {
  user: UserProfile;
}

export default function CaseManagement({ user }: CaseManagementProps) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const highlightedId = searchParams.get('id');
  const [cases, setCases] = useState<Case[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<CaseStatus | 'all'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTag, setSelectedTag] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isTagPrintModalOpen, setIsTagPrintModalOpen] = useState(false);
  const [selectedTagForPrint, setSelectedTagForPrint] = useState<string>('');
  const [allSessions, setAllSessions] = useState<any[]>([]);
  const [editingCase, setEditingCase] = useState<Case | null>(null);
  const [isSessionModalOpen, setIsSessionModalOpen] = useState(false);
  const [isJudgmentModalOpen, setIsJudgmentModalOpen] = useState(false);
  const [selectedCaseForSession, setSelectedCaseForSession] = useState<Case | null>(null);
  const [selectedCaseForJudgment, setSelectedCaseForJudgment] = useState<Case | null>(null);
  const [selectedCaseDetails, setSelectedCaseDetails] = useState<Case | null>(null);
  const [caseSessions, setCaseSessions] = useState<any[]>([]);
  const [caseProcedures, setCaseProcedures] = useState<any[]>([]);
  const [caseDocuments, setCaseDocuments] = useState<any[]>([]);
  const [caseFinance, setCaseFinance] = useState<any | null>(null);
  const [caseJudgments, setCaseJudgments] = useState<Judgment[]>([]);
  const [caseNotes, setCaseNotes] = useState<{ id: string; text: string; date: string; author: string }[]>([]);
  const [caseTasks, setCaseTasks] = useState<any[]>([]);
  const [newNote, setNewNote] = useState('');
  const [sessionDate, setSessionDate] = useState('');
  const [sessionDecision, setSessionDecision] = useState('');
  const [sessionNextDate, setSessionNextDate] = useState('');
  const caseRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    if (selectedCaseDetails) {
      const sessUnsub = onSnapshot(
        query(collection(db, 'sessions'), where('caseId', '==', selectedCaseDetails.id), orderBy('date', 'desc')), 
        (snap) => {
          setCaseSessions(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'sessions')
      );
      const procUnsub = onSnapshot(
        query(collection(db, 'procedures'), where('caseId', '==', selectedCaseDetails.id), orderBy('date', 'desc')), 
        (snap) => {
          setCaseProcedures(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'procedures')
      );
      const docUnsub = onSnapshot(
        query(collection(db, 'documents'), where('caseId', '==', selectedCaseDetails.id), orderBy('uploadDate', 'desc')), 
        (snap) => {
          setCaseDocuments(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'documents')
      );
      const finUnsub = onSnapshot(
        query(collection(db, 'finance'), where('caseId', '==', selectedCaseDetails.id)), 
        (snap) => {
          if (!snap.empty) setCaseFinance({ id: snap.docs[0].id, ...snap.docs[0].data() });
          else setCaseFinance(null);
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'finance')
      );
      const judgUnsub = onSnapshot(
        query(collection(db, 'judgments'), where('caseId', '==', selectedCaseDetails.id), orderBy('date', 'desc')), 
        (snap) => {
          setCaseJudgments(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Judgment)));
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'judgments')
      );
      const notesUnsub = onSnapshot(
        query(collection(db, 'caseNotes'), where('caseId', '==', selectedCaseDetails.id), orderBy('date', 'desc')), 
        (snap) => {
          setCaseNotes(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any)));
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'caseNotes')
      );
      const tasksUnsub = onSnapshot(
        query(collection(db, 'tasks'), where('caseId', '==', selectedCaseDetails.id)), 
        (snap) => {
          setCaseTasks(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'tasks')
      );

      return () => {
        sessUnsub();
        procUnsub();
        docUnsub();
        finUnsub();
        judgUnsub();
        notesUnsub();
        tasksUnsub();
      };
    }
  }, [selectedCaseDetails]);

  const [judgmentData, setJudgmentData] = useState<Partial<Judgment>>({
    date: new Date().toISOString().split('T')[0],
    type: 'initial',
    result: '',
    notes: '',
    appealDeadline: '',
    appealStatus: 'pending',
    isAppealed: false
  });
  const [formData, setFormData] = useState<Partial<Case>>({
    clientId: '',
    caseNumber: '',
    year: '',
    court: '',
    circuit: '',
    autoNumber: '',
    opponent: '',
    caseType: '',
    status: 'pre-filing',
    clientPosition: 'plaintiff'
  });

  useEffect(() => {
    let q = query(collection(db, 'cases'), orderBy('createdAt', 'desc'));
    
    // If client, only show their cases
    if (user.role === 'client') {
      q = query(collection(db, 'cases'), where('clientId', '==', user.uid), orderBy('createdAt', 'desc'));
    }

    const unsub = onSnapshot(q, (snapshot) => {
      setCases(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Case)));
      setLoading(false);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'cases'));

    const sessionsUnsub = onSnapshot(collection(db, 'sessions'), (snapshot) => {
      setAllSessions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'sessions'));

    const clientsUnsub = onSnapshot(collection(db, 'clients'), (snapshot) => {
      setClients(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'clients'));

    return () => {
      unsub();
      sessionsUnsub();
      clientsUnsub();
    };
  }, [user.uid, user.role]);

  useEffect(() => {
    if (highlightedId && !loading && cases.length > 0) {
      const targetCase = cases.find(c => c.id === highlightedId);
      if (targetCase) {
        setSelectedCaseDetails(targetCase);
        caseRefs.current[highlightedId]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setActiveTab('all');
      }
    }
  }, [highlightedId, loading, cases]);

  const handleAddNote = async () => {
    if (!newNote.trim() || !selectedCaseDetails) return;
    try {
      await addDoc(collection(db, 'caseNotes'), {
        caseId: selectedCaseDetails.id,
        text: newNote,
        date: new Date().toISOString(),
        author: user.name
      });
      setNewNote('');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'caseNotes');
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    try {
      await deleteDoc(doc(db, 'caseNotes', noteId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'caseNotes');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (user.role === 'client') return;
    try {
      const client = clients.find(c => c.id === formData.clientId);
      const data = {
        ...formData,
        clientName: client?.name || '',
        updatedAt: new Date().toISOString()
      };

      if (editingCase) {
        await updateDoc(doc(db, 'cases', editingCase.id), data);
      } else {
        await addDoc(collection(db, 'cases'), {
          ...data,
          createdAt: new Date().toISOString()
        });
      }
      setIsModalOpen(false);
      setEditingCase(null);
      setFormData({ clientId: '', status: 'pre-filing', clientPosition: 'plaintiff' });
    } catch (error) {
      console.error('Error saving case:', error);
    }
  };

  const handleMoveToJudgment = async (id: string) => {
    if (user.role === 'client') return;
    try {
      await updateDoc(doc(db, 'cases', id), {
        status: 'judgment',
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'cases');
    }
  };

  const handleDelete = async (id: string) => {
    if (user.role === 'client') return;
    if (!window.confirm('هل أنت متأكد من حذف هذه القضية؟')) return;
    try {
      await deleteDoc(doc(db, 'cases', id));
    } catch (error) {
      console.error('Error deleting case:', error);
    }
  };

  const handleAddSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (user.role === 'client') return;
    if (!selectedCaseForSession || !sessionDate) return;

    try {
      await addDoc(collection(db, 'sessions'), {
        caseId: selectedCaseForSession.id,
        date: sessionDate,
        decision: sessionDecision,
        nextDate: sessionNextDate,
        lawyerId: selectedCaseForSession.lawyerId || '',
        createdAt: new Date().toISOString()
      });
      setIsSessionModalOpen(false);
      setSessionDate('');
      setSessionDecision('');
      setSessionNextDate('');
      setSelectedCaseForSession(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'sessions');
    }
  };

  const handleAddJudgment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (user.role === 'client') return;
    if (!selectedCaseForJudgment || !judgmentData.date || !judgmentData.result) return;

    try {
      const appealDeadline = addDays(new Date(judgmentData.date), 30).toISOString();
      
      await addDoc(collection(db, 'judgments'), {
        caseId: selectedCaseForJudgment.id,
        date: judgmentData.date,
        type: judgmentData.type,
        result: judgmentData.result,
        appealDeadline: judgmentData.appealDeadline || appealDeadline,
        appealStatus: judgmentData.appealStatus || 'pending',
        isAppealed: judgmentData.isAppealed || false,
        notes: judgmentData.notes,
        createdAt: new Date().toISOString()
      });

      // Update case status to judgment
      await updateDoc(doc(db, 'cases', selectedCaseForJudgment.id), {
        status: 'judgment',
        updatedAt: new Date().toISOString()
      });

      setIsJudgmentModalOpen(false);
      setSelectedCaseForJudgment(null);
      setJudgmentData({ 
        date: new Date().toISOString().split('T')[0], 
        type: 'initial', 
        result: '', 
        notes: '',
        appealDeadline: '',
        appealStatus: 'pending',
        isAppealed: false
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'judgments');
    }
  };

  const filteredCases = cases.filter(c => {
    const matchesTab = activeTab === 'all' || c.status === activeTab;
    const matchesTag = selectedTag === 'all' || c.tag === selectedTag;
    const matchesSearch = 
      c.caseNumber?.includes(searchTerm) || 
      c.clientName?.includes(searchTerm) || 
      c.autoNumber?.includes(searchTerm) ||
      c.opponent?.includes(searchTerm) ||
      c.tag?.includes(searchTerm);
    return matchesTab && matchesTag && matchesSearch;
  });

  const uniqueTags = Array.from(new Set(cases.map(c => c.tag).filter(Boolean))) as string[];

  const timelineEvents = [
    ...caseSessions.map(s => ({ ...s, timelineType: 'session', timelineDate: s.date })),
    ...caseProcedures.map(p => ({ ...p, timelineType: 'procedure', timelineDate: p.date })),
    ...caseJudgments.map(j => ({ ...j, timelineType: 'judgment', timelineDate: j.date }))
  ].sort((a, b) => b.timelineDate.localeCompare(a.timelineDate));

  const isLawyer = user.role === 'admin' || user.role === 'lawyer';

  return (
    <div className="space-y-6 rtl" dir="rtl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 mb-1">إدارة القضايا (The Four Pillars)</h1>
          <p className="text-slate-500 font-medium">تتبع دورة حياة القضايا من التجهيز إلى الأرشفة.</p>
        </div>
        {isLawyer && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsTagPrintModalOpen(true)}
              className="flex items-center justify-center gap-2 bg-white text-slate-700 px-6 py-3 rounded-xl font-bold shadow-sm border border-slate-200 hover:bg-slate-50 transition-all"
            >
              <Printer className="w-5 h-5" />
              طباعة تقرير التاج
            </button>
            <button
              onClick={() => {
                setEditingCase(null);
                setFormData({ clientId: '', status: 'pre-filing', tag: '' });
                setIsModalOpen(true);
              }}
              className="flex items-center justify-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all"
            >
              <Plus className="w-5 h-5" />
              إضافة قضية جديدة
            </button>
          </div>
        )}
      </div>

      {/* Tabs & Local Search */}
      <div className="flex flex-col lg:flex-row gap-4">
        <div className="flex-1 bg-white p-2 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap gap-2">
          <button
            onClick={() => {
              setActiveTab('all');
              setSelectedTag('all');
            }}
            className={cn(
              "px-6 py-2 rounded-xl text-sm font-bold transition-all",
              activeTab === 'all' && selectedTag === 'all' ? "bg-slate-900 text-white shadow-md" : "text-slate-500 hover:bg-slate-50"
            )}
          >
            الكل
          </button>
          {(Object.keys(STATUS_MAP) as CaseStatus[]).map((status) => {
            const config = STATUS_MAP[status];
            const Icon = config.icon;
            const isActive = activeTab === status;
            return (
              <button
                key={status}
                onClick={() => setActiveTab(status)}
                className={cn(
                  "flex items-center gap-2 px-6 py-2 rounded-xl text-sm font-bold transition-all",
                  isActive
                    ? `bg-${config.color}-600 text-white shadow-md`
                    : `text-slate-500 hover:bg-${config.color}-50 hover:text-${config.color}-600`
                )}
              >
                <Icon className="w-4 h-4" />
                {config.label}
              </button>
            );
          })}
          
          {uniqueTags.length > 0 && (
            <div className="h-8 w-px bg-slate-200 mx-2 self-center"></div>
          )}
          
          {uniqueTags.map(tag => (
            <button
              key={tag}
              onClick={() => setSelectedTag(tag)}
              className={cn(
                "px-4 py-2 rounded-xl text-sm font-bold transition-all",
                selectedTag === tag ? "bg-indigo-600 text-white shadow-md" : "bg-slate-50 text-slate-500 hover:bg-slate-100"
              )}
            >
              #{tag}
            </button>
          ))}
        </div>
        <div className="bg-white px-4 py-2 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3 w-full lg:w-80">
          <Search className="w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="بحث سريع في النتائج..."
            className="bg-transparent border-none focus:ring-0 text-sm w-full font-medium"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Cases List */}
      <div className="grid grid-cols-1 gap-4">
        {filteredCases.map((c) => {
          const config = STATUS_MAP[c.status];
          const Icon = config.icon;
          const isHighlighted = c.id === highlightedId;

          return (
            <motion.div
              layout
              key={c.id}
              ref={(el) => { caseRefs.current[c.id] = el; }}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={() => setSelectedCaseDetails(c)}
              className={cn(
                "bg-white p-6 rounded-2xl border-2 shadow-sm hover:shadow-md transition-all group flex flex-col lg:flex-row lg:items-center gap-6 cursor-pointer",
                isHighlighted ? "border-indigo-600 ring-4 ring-indigo-50" : "border-slate-200"
              )}
            >
              <div className={cn("p-4 rounded-2xl border flex flex-col items-center justify-center min-w-[100px]", `bg-${config.color}-50 border-${config.color}-100 text-${config.color}-600`)}>
                <Icon className="w-8 h-8 mb-2" />
                <span className="text-xs font-black uppercase tracking-tighter">{config.label}</span>
              </div>

              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-3">
                  <h3 className="text-lg font-black text-slate-900">قضية: {c.caseNumber || 'بدون رقم'} / {c.year || '----'}</h3>
                  <span className="px-2 py-1 bg-slate-100 text-slate-500 text-[10px] font-bold rounded-lg border border-slate-200">
                    {c.caseType || 'نوع غير محدد'}
                  </span>
                  {c.tag && (
                    <span className="bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-lg text-[10px] font-black">
                      #{c.tag}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm font-medium text-slate-500">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400">الموكل:</span>
                    <span className="text-slate-900 font-bold">
                      {c.clientName} 
                      {c.clientPosition && (
                        <span className="mr-1 text-[10px] bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 text-slate-500">
                          ({POSITION_LABELS[c.clientPosition]})
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400">الخصم:</span>
                    <span className="text-slate-900 font-bold">{c.opponent || '---'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400">المحكمة:</span>
                    <span className="text-slate-900 font-bold">{c.court || '---'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400">الرقم الآلي:</span>
                    <span className="text-indigo-600 font-black tracking-widest">{c.autoNumber || '---'}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 lg:border-r lg:pr-6 lg:border-slate-100" onClick={(e) => e.stopPropagation()}>
                {isLawyer && (
                  <>
                    <button
                      onClick={() => {
                        setEditingCase(c);
                        setFormData(c);
                        setIsModalOpen(true);
                      }}
                      className="p-3 bg-slate-50 text-slate-600 rounded-xl hover:bg-indigo-50 hover:text-indigo-600 transition-all border border-slate-100"
                    >
                      <Edit2 className="w-5 h-5" />
                    </button>
                    <button 
                      onClick={() => {
                        setSelectedCaseForSession(c);
                        setIsSessionModalOpen(true);
                      }}
                      className="p-3 bg-slate-50 text-indigo-600 rounded-xl hover:bg-indigo-100 transition-all border border-slate-100"
                      title="إضافة جلسة"
                    >
                      <CalendarPlus className="w-5 h-5" />
                    </button>
                    <button 
                      onClick={() => handleDelete(c.id)}
                      className="p-3 bg-slate-50 text-slate-600 rounded-xl hover:bg-red-50 hover:text-red-600 transition-all border border-slate-100"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                    <button 
                      onClick={() => {
                        setSelectedCaseForJudgment(c);
                        setIsJudgmentModalOpen(true);
                      }}
                      className="flex items-center gap-2 bg-slate-900 text-white px-6 py-3 rounded-xl font-bold text-sm hover:bg-slate-800 transition-all shadow-lg shadow-slate-100"
                    >
                      <Gavel className="w-4 h-4" />
                      تحويل لحكم
                    </button>
                  </>
                )}
                {!isLawyer && (
                  <button
                    onClick={() => setSelectedCaseDetails(c)}
                    className="flex items-center gap-2 text-indigo-600 font-bold text-xs hover:bg-indigo-50 px-4 py-2 rounded-xl transition-all"
                  >
                    <Eye className="w-4 h-4" />
                    عرض التفاصيل
                  </button>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Print-only Case Details Section */}
      {selectedCaseDetails && (
        <div className="hidden print:block p-12 bg-white text-right" dir="rtl">
          <div className="flex justify-between items-start mb-10 border-b-2 border-slate-900 pb-8">
            <div>
              <h1 className="text-2xl font-black text-slate-900">مكتب المحامي محمد امين علي الصايغ</h1>
              <p className="text-sm text-slate-500 font-bold">للمحاماة والاستشارات القانونية</p>
            </div>
            <div className="text-left">
              <p className="font-bold text-slate-900">التاريخ: {new Date().toLocaleDateString('ar-EG')}</p>
              <p className="font-bold text-slate-900">رقم الملف: {selectedCaseDetails.caseNumber}</p>
            </div>
          </div>

          <div className="text-center mb-10">
            <h2 className="text-3xl font-black bg-slate-100 inline-block px-12 py-4 rounded-2xl border-2 border-slate-900">
              تقرير تفاصيل القضية
            </h2>
          </div>

          <div className="grid grid-cols-2 gap-8 mb-12">
            <div className="space-y-4">
              <div className="border-b border-slate-200 pb-2">
                <p className="text-xs font-black text-slate-400 uppercase mb-1">الموكل</p>
                <p className="text-lg font-bold text-slate-900">
                  {selectedCaseDetails.clientName}
                  {selectedCaseDetails.clientPosition && (
                    <span className="mr-2 text-sm text-slate-500">({POSITION_LABELS[selectedCaseDetails.clientPosition]})</span>
                  )}
                </p>
              </div>
              <div className="border-b border-slate-200 pb-2">
                <p className="text-xs font-black text-slate-400 uppercase mb-1">الخصم</p>
                <p className="text-lg font-bold text-slate-900">{selectedCaseDetails.opponent || '---'}</p>
              </div>
              <div className="border-b border-slate-200 pb-2">
                <p className="text-xs font-black text-slate-400 uppercase mb-1">المحكمة</p>
                <p className="text-lg font-bold text-slate-900">{selectedCaseDetails.court || '---'}</p>
              </div>
            </div>
            <div className="space-y-4">
              <div className="border-b border-slate-200 pb-2">
                <p className="text-xs font-black text-slate-400 uppercase mb-1">رقم القضية</p>
                <p className="text-lg font-bold text-slate-900">{selectedCaseDetails.caseNumber}</p>
              </div>
              <div className="border-b border-slate-200 pb-2">
                <p className="text-xs font-black text-slate-400 uppercase mb-1">الدائرة</p>
                <p className="text-lg font-bold text-slate-900">{selectedCaseDetails.circuit || '---'}</p>
              </div>
              <div className="border-b border-slate-200 pb-2">
                <p className="text-xs font-black text-slate-400 uppercase mb-1">الحالة</p>
                <p className="text-lg font-bold text-slate-900">{STATUS_MAP[selectedCaseDetails.status]?.label}</p>
              </div>
            </div>
          </div>

          <div className="mb-12">
            <h3 className="text-xl font-black text-slate-900 mb-4 border-r-4 border-indigo-600 pr-4">نوع الدعوى</h3>
            <p className="text-lg text-slate-700 leading-relaxed bg-slate-50 p-6 rounded-2xl border border-slate-100">
              {selectedCaseDetails.caseType || 'لا يوجد نوع مسجل'}
            </p>
          </div>

          <div className="mb-12">
            <h3 className="text-xl font-black text-slate-900 mb-4 border-r-4 border-indigo-600 pr-4">الخط الزمني للجلسات والإجراءات</h3>
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-slate-100">
                  <th className="border border-slate-300 p-3 text-right">التاريخ</th>
                  <th className="border border-slate-300 p-3 text-right">النوع</th>
                  <th className="border border-slate-300 p-3 text-right">القرار / التفاصيل</th>
                </tr>
              </thead>
              <tbody>
                {timelineEvents.map((event: any, i: number) => (
                  <tr key={i}>
                    <td className="border border-slate-300 p-3 text-sm font-bold">{event.timelineDate}</td>
                    <td className="border border-slate-300 p-3 text-sm">{event.timelineType === 'session' ? 'جلسة' : event.timelineType === 'procedure' ? 'إجراء' : 'حكم'}</td>
                    <td className="border border-slate-300 p-3 text-sm">{event.decision || event.description || event.result}</td>
                  </tr>
                ))}
                {timelineEvents.length === 0 && (
                  <tr>
                    <td colSpan={3} className="border border-slate-300 p-8 text-center text-slate-400">لا توجد أحداث مسجلة</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-20 flex justify-between items-end">
            <div className="text-center w-64">
              <p className="font-black text-lg mb-16 text-slate-900">توقيع الموكل</p>
              <div className="border-b-2 border-slate-900"></div>
            </div>
            <div className="text-center w-64">
              <p className="font-black text-lg mb-16 text-slate-900">ختم المكتب</p>
              <div className="border-b-2 border-slate-900"></div>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <h2 className="text-xl font-black text-slate-900">
                  {editingCase ? 'تعديل بيانات القضية' : 'إضافة قضية جديدة'}
                </h2>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-white rounded-xl transition-all">
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="p-8 space-y-6 max-h-[80vh] overflow-y-auto">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-2 sm:col-span-2">
                    <label className="text-sm font-bold text-slate-700">الموكل</label>
                    <select
                      required
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition-all"
                      value={formData.clientId}
                      onChange={(e) => setFormData({ ...formData, clientId: e.target.value })}
                    >
                      <option value="">اختر الموكل...</option>
                      {clients.map(client => (
                        <option key={client.id} value={client.id}>{client.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">رقم القضية</label>
                    <input
                      type="text"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition-all"
                      value={formData.caseNumber}
                      onChange={(e) => setFormData({ ...formData, caseNumber: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">السنة</label>
                    <input
                      type="text"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition-all"
                      value={formData.year}
                      onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">المحكمة</label>
                    <select
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition-all"
                      value={formData.court}
                      onChange={(e) => setFormData({ ...formData, court: e.target.value })}
                    >
                      <option value="">اختر المحكمة...</option>
                      <option>محكمة العاصمة</option>
                      <option>محكمة حولي</option>
                      <option>محكمة الفروانية</option>
                      <option>محكمة الجهراء</option>
                      <option>محكمة الأحمدي</option>
                      <option>محكمة مبارك الكبير</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">الدائرة</label>
                    <input
                      type="text"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition-all"
                      value={formData.circuit}
                      onChange={(e) => setFormData({ ...formData, circuit: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">الرقم الآلي</label>
                    <input
                      type="text"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition-all"
                      value={formData.autoNumber}
                      onChange={(e) => setFormData({ ...formData, autoNumber: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">الخصم</label>
                    <input
                      type="text"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition-all"
                      value={formData.opponent}
                      onChange={(e) => setFormData({ ...formData, opponent: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">التاج (Tag)</label>
                    <input
                      type="text"
                      placeholder="مثال: قضايا_العمال"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition-all"
                      value={formData.tag}
                      onChange={(e) => setFormData({ ...formData, tag: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">نوع القضية</label>
                    <select
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition-all"
                      value={formData.caseType}
                      onChange={(e) => setFormData({ ...formData, caseType: e.target.value })}
                    >
                      <option value="">اختر النوع...</option>
                      <option>مدني</option>
                      <option>تجاري</option>
                      <option>أسرة</option>
                      <option>إيجارات</option>
                      <option>عمالي</option>
                      <option>جنائي</option>
                      <option>استئناف</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">صفة الموكل</label>
                    <select
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition-all"
                      value={formData.clientPosition}
                      onChange={(e) => setFormData({ ...formData, clientPosition: e.target.value as any })}
                    >
                      {formData.caseType === 'استئناف' ? (
                        <>
                          <option value="appellant">مستأنف</option>
                          <option value="appellee">مستأنف ضده</option>
                        </>
                      ) : (
                        <>
                          <option value="plaintiff">مدعي</option>
                          <option value="defendant">مدعى عليه</option>
                        </>
                      )}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">حالة القضية</label>
                    <select
                      required
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition-all"
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value as CaseStatus })}
                    >
                      {Object.entries(STATUS_MAP).map(([key, config]) => (
                        <option key={key} value={key}>{config.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="pt-4 flex gap-4">
                  <button
                    type="submit"
                    className="flex-1 bg-indigo-600 text-white font-bold py-4 rounded-2xl shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"
                  >
                    <Check className="w-5 h-5" />
                    {editingCase ? 'حفظ التعديلات' : 'إضافة القضية'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
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

      {/* Add Session Modal */}
      <AnimatePresence>
        {isSessionModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSessionModalOpen(false)}
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
                <button onClick={() => setIsSessionModalOpen(false)} className="p-2 hover:bg-white rounded-xl transition-all">
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>
              <form onSubmit={handleAddSession} className="p-8 space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">تاريخ الجلسة</label>
                  <input
                    required
                    type="date"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition-all"
                    value={sessionDate}
                    onChange={(e) => setSessionDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">القرار (اختياري)</label>
                  <textarea
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition-all"
                    value={sessionDecision}
                    onChange={(e) => setSessionDecision(e.target.value)}
                    placeholder="أدخل قرار الجلسة إن وجد..."
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">تاريخ الجلسة القادمة (اختياري)</label>
                  <input
                    type="date"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition-all"
                    value={sessionNextDate}
                    onChange={(e) => setSessionNextDate(e.target.value)}
                  />
                </div>
                <div className="pt-4 flex gap-4">
                  <button
                    type="submit"
                    className="flex-1 bg-indigo-600 text-white font-bold py-4 rounded-2xl shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"
                  >
                    <Check className="w-5 h-5" />
                    إضافة الجلسة
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsSessionModalOpen(false)}
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

      {/* Case Details Modal */}
      <AnimatePresence>
        {selectedCaseDetails && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedCaseDetails(null)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white w-full max-w-5xl h-[90vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <div className="flex items-center gap-4">
                  <div className={cn("p-3 rounded-xl bg-indigo-600 text-white shadow-lg shadow-indigo-100")}>
                    <Briefcase className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-slate-900">تفاصيل القضية: {selectedCaseDetails.caseNumber}</h2>
                    <p className="text-sm text-slate-500 font-bold">
                      {selectedCaseDetails.clientName}
                      {selectedCaseDetails.clientPosition && (
                        <span className="mr-2 px-2 py-0.5 bg-slate-100 rounded-lg text-xs">
                          ({POSITION_LABELS[selectedCaseDetails.clientPosition]})
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => window.print()}
                    className="flex items-center gap-2 bg-slate-100 text-slate-700 px-4 py-2 rounded-xl font-bold text-sm hover:bg-slate-200 transition-all shadow-sm"
                  >
                    <Printer className="w-4 h-4" />
                    <span>طباعة التفاصيل</span>
                  </button>
                  <button onClick={() => setSelectedCaseDetails(null)} className="p-2 hover:bg-white rounded-xl transition-all">
                    <X className="w-6 h-6 text-slate-400" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-8 space-y-8">
                {/* Summary Grid */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">المحكمة</p>
                    <p className="text-sm font-bold text-slate-900">{selectedCaseDetails.court || '---'}</p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">الدائرة</p>
                    <p className="text-sm font-bold text-slate-900">{selectedCaseDetails.circuit || '---'}</p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">الرقم الآلي</p>
                    <p className="text-sm font-black text-indigo-600 tracking-widest">{selectedCaseDetails.autoNumber || '---'}</p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">الخصم</p>
                    <p className="text-sm font-bold text-slate-900">{selectedCaseDetails.opponent || '---'}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  {/* Timeline Section */}
                  <div className="lg:col-span-2 space-y-4">
                    <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                      <Clock className="w-5 h-5 text-indigo-600" />
                      الخط الزمني للقضية (Case Timeline)
                    </h3>
                    <div className="relative space-y-6 before:absolute before:inset-y-0 before:right-6 before:w-0.5 before:bg-slate-100">
                      {timelineEvents.map((event, i) => (
                        <div key={i} className="relative pr-12">
                          <div className={cn(
                            "absolute right-4 top-1 w-4 h-4 rounded-full border-4 border-white shadow-sm z-10",
                            event.timelineType === 'session' ? "bg-indigo-600" : 
                            event.timelineType === 'procedure' ? "bg-emerald-600" : "bg-amber-600"
                          )} />
                          <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{event.timelineDate}</span>
                              <span className={cn(
                                "px-2 py-0.5 rounded-lg text-[10px] font-black uppercase",
                                event.timelineType === 'session' ? "bg-indigo-50 text-indigo-600" : 
                                event.timelineType === 'procedure' ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"
                              )}>
                                {event.timelineType === 'session' ? 'جلسة' : 
                                 event.timelineType === 'procedure' ? 'إجراء' : 'حكم'}
                              </span>
                            </div>
                            <h4 className="text-sm font-bold text-slate-900">
                              {event.timelineType === 'session' ? 'جلسة مرافعة' : 
                               event.timelineType === 'procedure' ? event.type : `حكم ${event.type === 'initial' ? 'ابتدائي' : event.type === 'appeal' ? 'استئناف' : 'تمييز'}`}
                            </h4>
                            <p className="text-xs text-slate-500 font-medium mt-1">
                              {event.timelineType === 'session' ? (event.decision || 'بانتظار القرار') : 
                               event.timelineType === 'procedure' ? event.notes : event.result}
                            </p>
                            {event.nextDate && (
                              <div className="mt-3 pt-3 border-t border-slate-50 flex items-center gap-2">
                                <CalendarPlus className="w-3 h-3 text-indigo-600" />
                                <span className="text-[10px] font-bold text-slate-400">الجلسة القادمة:</span>
                                <span className="text-[10px] font-black text-indigo-600">{event.nextDate}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                      {timelineEvents.length === 0 && (
                        <div className="text-center py-12 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
                          <Clock className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                          <p className="text-slate-400 font-bold">لا توجد أحداث مسجلة لهذه القضية</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Documents & Finance Sidebar */}
                  <div className="space-y-8">
                    {/* Documents Section */}
                    <div className="space-y-4">
                      <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                        <FileCheck className="w-5 h-5 text-indigo-600" />
                        المستندات
                      </h3>
                      <div className="grid grid-cols-1 gap-3">
                        {caseDocuments.map((d, i) => (
                          <a 
                            key={i} 
                            href={d.fileUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="p-4 bg-slate-50 border border-slate-100 rounded-2xl hover:border-indigo-200 transition-all group flex items-center gap-3"
                          >
                            <FileText className="w-6 h-6 text-indigo-600 group-hover:scale-110 transition-transform" />
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-slate-900 truncate">{d.title}</p>
                              <p className="text-[10px] text-slate-400">{d.uploadDate}</p>
                            </div>
                          </a>
                        ))}
                        {caseDocuments.length === 0 && <p className="text-center py-8 text-slate-400 font-bold text-xs">لا توجد مستندات</p>}
                      </div>
                    </div>

                    {/* Case Notes */}
                    <div className="space-y-4">
                      <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                        <FileText className="w-5 h-5 text-indigo-600" />
                        ملاحظات داخلية
                      </h3>
                      <div className="space-y-3">
                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder="أضف ملاحظة جديدة..."
                            className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-600 transition-all"
                            value={newNote}
                            onChange={(e) => setNewNote(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && handleAddNote()}
                          />
                          <button
                            onClick={handleAddNote}
                            className="bg-indigo-600 text-white p-2 rounded-xl hover:bg-indigo-700 transition-all shadow-md shadow-indigo-100"
                          >
                            <Plus className="w-5 h-5" />
                          </button>
                        </div>
                        <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                          {caseNotes.map((note) => (
                            <div key={note.id} className="bg-slate-50 p-3 rounded-xl border border-slate-100 group relative">
                              <p className="text-sm text-slate-700 font-medium leading-relaxed">{note.text}</p>
                              <div className="flex items-center justify-between mt-2">
                                <span className="text-[10px] text-slate-400 font-bold">{note.author} - {format(parseISO(note.date), 'yyyy/MM/dd HH:mm')}</span>
                                <button 
                                  onClick={() => handleDeleteNote(note.id)}
                                  className="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-all"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          ))}
                          {caseNotes.length === 0 && (
                            <p className="text-center py-4 text-slate-400 text-xs font-bold italic">لا توجد ملاحظات مسجلة</p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Case Tasks */}
                    <div className="space-y-4">
                      <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                        <CheckCircle2 className="w-5 h-5 text-indigo-600" />
                        المهام المرتبطة
                      </h3>
                      <div className="space-y-2">
                        {caseTasks.map((task) => (
                          <div key={task.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                            <div className="flex items-center gap-3">
                              <div className={cn(
                                "w-2 h-2 rounded-full",
                                task.status === 'completed' ? "bg-emerald-500" : "bg-amber-500"
                              )} />
                              <span className={cn("text-sm font-bold", task.status === 'completed' ? "text-slate-400 line-through" : "text-slate-700")}>
                                {task.title}
                              </span>
                            </div>
                            <span className="text-[10px] font-black text-slate-400 uppercase">{task.status === 'completed' ? 'مكتملة' : 'قيد التنفيذ'}</span>
                          </div>
                        ))}
                        {caseTasks.length === 0 && (
                          <p className="text-center py-4 text-slate-400 text-xs font-bold italic">لا توجد مهام مرتبطة</p>
                        )}
                        <button 
                          onClick={() => navigate('/tasks')}
                          className="w-full py-2 text-xs font-black text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all border border-dashed border-indigo-200"
                        >
                          إدارة المهام
                        </button>
                      </div>
                    </div>

                    {/* Finance Summary */}
                    <div className="space-y-4">
                      <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                        <DollarSign className="w-5 h-5 text-indigo-600" />
                        الملخص المالي
                      </h3>
                      {caseFinance ? (
                        <div className="p-6 bg-indigo-600 rounded-3xl text-white shadow-xl shadow-indigo-100">
                          <div className="space-y-4">
                            <div>
                              <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-1">إجمالي الأتعاب</p>
                              <p className="text-2xl font-black">{caseFinance.totalFees?.toLocaleString()} د.ك</p>
                            </div>
                            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/10">
                              <div>
                                <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-1">المسدد</p>
                                <p className="text-sm font-bold">{caseFinance.receivedAmount?.toLocaleString()} د.ك</p>
                              </div>
                              <div>
                                <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-1">المتبقي</p>
                                <p className="text-sm font-bold text-amber-300">{(caseFinance.totalFees - caseFinance.receivedAmount)?.toLocaleString()} د.ك</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 text-center">
                          <p className="text-slate-400 font-bold text-sm">لا توجد بيانات مالية مسجلة</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Judgment Modal */}
      <AnimatePresence>
        {selectedCaseForJudgment && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-[40px] shadow-2xl w-full max-w-xl overflow-hidden border border-slate-100"
            >
              <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-amber-100 rounded-2xl">
                    <Gavel className="w-6 h-6 text-amber-600" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-slate-900">تسجيل حكم قضائي</h2>
                    <p className="text-xs text-slate-500 font-bold mt-0.5">قضية رقم: {selectedCaseForJudgment.caseNumber}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedCaseForJudgment(null)}
                  className="p-2 hover:bg-white rounded-xl transition-colors shadow-sm"
                >
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              <div className="p-8 space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block pr-1">نوع الحكم</label>
                    <select
                      value={judgmentData.type}
                      onChange={(e) => setJudgmentData({ ...judgmentData, type: e.target.value as any })}
                      className="w-full p-4 bg-slate-50 border-2 border-transparent rounded-2xl focus:border-indigo-500 focus:bg-white transition-all outline-none font-bold text-sm"
                    >
                      <option value="initial">ابتدائي</option>
                      <option value="appeal">استئناف</option>
                      <option value="cassation">تمييز</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block pr-1">تاريخ الحكم</label>
                    <input
                      type="date"
                      value={judgmentData.date}
                      onChange={(e) => setJudgmentData({ ...judgmentData, date: e.target.value })}
                      className="w-full p-4 bg-slate-50 border-2 border-transparent rounded-2xl focus:border-indigo-500 focus:bg-white transition-all outline-none font-bold text-sm"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block pr-1">منطوق الحكم</label>
                  <textarea
                    value={judgmentData.result}
                    onChange={(e) => setJudgmentData({ ...judgmentData, result: e.target.value })}
                    placeholder="اكتب منطوق الحكم هنا بالتفصيل..."
                    className="w-full p-4 bg-slate-50 border-2 border-transparent rounded-2xl focus:border-indigo-500 focus:bg-white transition-all outline-none font-bold text-sm h-32 resize-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block pr-1">آخر موعد للاستئناف</label>
                    <input
                      type="date"
                      value={judgmentData.appealDeadline}
                      onChange={(e) => setJudgmentData({ ...judgmentData, appealDeadline: e.target.value })}
                      className="w-full p-4 bg-slate-50 border-2 border-transparent rounded-2xl focus:border-indigo-500 focus:bg-white transition-all outline-none font-bold text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block pr-1">حالة الاستئناف</label>
                    <select
                      value={judgmentData.appealStatus}
                      onChange={(e) => setJudgmentData({ ...judgmentData, appealStatus: e.target.value as any })}
                      className="w-full p-4 bg-slate-50 border-2 border-transparent rounded-2xl focus:border-indigo-500 focus:bg-white transition-all outline-none font-bold text-sm"
                    >
                      <option value="pending">بانتظار الاستئناف</option>
                      <option value="appealed">تم الاستئناف</option>
                      <option value="final">حكم نهائي</option>
                    </select>
                  </div>
                </div>

                <button
                  onClick={handleAddJudgment}
                  className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black text-sm shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center justify-center gap-3"
                >
                  <Gavel className="w-5 h-5" />
                  حفظ الحكم وإغلاق القضية
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Tag Print Modal */}
      <AnimatePresence>
        {isTagPrintModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <h2 className="text-xl font-black text-slate-900">طباعة تقرير التاج</h2>
                <button onClick={() => setIsTagPrintModalOpen(false)} className="p-2 hover:bg-white rounded-xl transition-all">
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>
              <div className="p-8 space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">اختر التاج</label>
                  <select
                    value={selectedTagForPrint}
                    onChange={(e) => setSelectedTagForPrint(e.target.value)}
                    className="w-full p-4 bg-slate-50 border-2 border-transparent rounded-2xl focus:border-indigo-500 focus:bg-white transition-all outline-none font-bold text-sm"
                  >
                    <option value="">اختر التاج...</option>
                    {uniqueTags.map(tag => (
                      <option key={tag} value={tag}>#{tag}</option>
                    ))}
                  </select>
                </div>
                <button
                  disabled={!selectedTagForPrint}
                  onClick={() => {
                    window.print();
                    setIsTagPrintModalOpen(false);
                  }}
                  className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-sm shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <Printer className="w-5 h-5" />
                  بدء الطباعة
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Print-only Tag Report Section */}
      {selectedTagForPrint && (
        <div className="hidden print:block p-12 bg-white text-right" dir="rtl">
          <div className="flex justify-between items-start mb-10 border-b-2 border-slate-900 pb-8">
            <div>
              <h1 className="text-2xl font-black text-slate-900">مكتب المحامي محمد امين علي الصايغ</h1>
              <p className="text-sm text-slate-500 font-bold">للمحاماة والاستشارات القانونية</p>
              <p className="text-[10px] text-slate-400 mt-1">دولة الكويت - برج التجارية - الدور 25</p>
            </div>
            <div className="text-left">
              <p className="font-bold text-slate-900 text-sm">تاريخ الطباعة: {new Date().toLocaleDateString('ar-EG')}</p>
            </div>
          </div>

          <div className="text-center mb-10">
            <h2 className="text-3xl font-black bg-slate-100 inline-block px-12 py-4 rounded-2xl border-2 border-slate-900">
              تقرير القضايا حسب التاج
            </h2>
            <p className="text-xl font-black mt-4 text-indigo-600">التاج: #{selectedTagForPrint}</p>
          </div>

          <table className="w-full border-collapse border-2 border-slate-900">
            <thead>
              <tr className="bg-slate-100">
                <th className="border border-slate-900 p-3 text-right text-sm font-black">#</th>
                <th className="border border-slate-900 p-3 text-right text-sm font-black">المحكمة</th>
                <th className="border border-slate-900 p-3 text-right text-sm font-black">الرقم الآلي</th>
                <th className="border border-slate-900 p-3 text-right text-sm font-black">الموكل</th>
                <th className="border border-slate-900 p-3 text-right text-sm font-black">الخصم</th>
                <th className="border border-slate-900 p-3 text-right text-sm font-black">آخر جلسة</th>
              </tr>
            </thead>
            <tbody>
              {cases.filter(c => c.tag === selectedTagForPrint).map((c, index) => {
                const lastSession = allSessions
                  .filter(s => s.caseId === c.id)
                  .sort((a, b) => b.date.localeCompare(a.date))[0];
                
                return (
                  <tr key={c.id}>
                    <td className="border border-slate-900 p-3 text-sm font-bold text-center">{index + 1}</td>
                    <td className="border border-slate-900 p-3 text-sm font-bold">{c.court || '---'}</td>
                    <td className="border border-slate-900 p-3 text-sm font-black">{c.autoNumber || '---'}</td>
                    <td className="border border-slate-900 p-3 text-sm font-bold">{c.clientName || '---'}</td>
                    <td className="border border-slate-900 p-3 text-sm font-bold">{c.opponent || '---'}</td>
                    <td className="border border-slate-900 p-3 text-sm font-bold">{lastSession?.date || '---'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="mt-20 flex justify-between items-end">
            <div className="text-center w-64">
              <p className="font-black text-lg mb-16 text-slate-900">توقيع المسؤول</p>
              <div className="border-b-2 border-slate-900"></div>
            </div>
            <div className="text-center w-64">
              <p className="font-black text-lg mb-16 text-slate-900">ختم واعتماد المكتب</p>
              <div className="border-b-2 border-slate-900"></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
