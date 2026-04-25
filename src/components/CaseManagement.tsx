import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { collection, addDoc, onSnapshot, query, orderBy, deleteDoc, doc, updateDoc, where, getDocs } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Plus, Search, Filter, Briefcase, Scale, Gavel, Archive, MoreVertical, Trash2, Edit2, X, Check, ArrowLeftRight, CalendarPlus, FileCheck, DollarSign, Clock, FileText, Eye, CheckCircle2, Printer, Users, AlertTriangle, AlertCircle, Sparkles, Zap, RefreshCw, LayoutGrid, List, MoreHorizontal } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import { Case, CaseStatus, Client, Judgment, UserProfile, SystemSettings } from '../types';
import { cn } from '../lib/utils';
import { addDays, format, parseISO } from 'date-fns';
import { generateCaseSummary } from '../services/geminiService';
import ConfirmModal from './ConfirmModal';
import { createNotification } from './NotificationCenter';

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
  const [caseExpertSessions, setCaseExpertSessions] = useState<any[]>([]);
  const [caseNotes, setCaseNotes] = useState<{ id: string; text: string; date: string; author: string }[]>([]);
  const [caseTasks, setCaseTasks] = useState<any[]>([]);
  const [systemSettings, setSystemSettings] = useState<SystemSettings | null>(null);
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
  const [isExpertHistoryOpen, setIsExpertHistoryOpen] = useState(false);
  const [newNote, setNewNote] = useState('');

  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);

  const [sessionDate, setSessionDate] = useState('');
  const [sessionDecision, setSessionDecision] = useState('');
  const [sessionNextDate, setSessionNextDate] = useState('');
  const [editingSession, setEditingSession] = useState<any | null>(null);
  const caseRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [caseToDelete, setCaseToDelete] = useState<string | null>(null);
  const [isSessionDeleteModalOpen, setIsSessionDeleteModalOpen] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null);
  const [clientSearchTerm, setClientSearchTerm] = useState('');
  const [isClientDropdownOpen, setIsClientDropdownOpen] = useState(false);
  const [conflictWarning, setConflictWarning] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list');
  const clientDropdownRef = useRef<HTMLDivElement>(null);

  const handleEdit = (c: Case) => {
    setEditingCase(c);
    setFormData(c);
    setIsModalOpen(true);
  };

  const handleGenerateSummary = async (caseData: Case) => {
    setIsGeneratingSummary(true);
    setAiSummary(null);
    try {
      const summary = await generateCaseSummary(
        caseData,
        caseSessions,
        caseExpertSessions,
        caseJudgments
      );
      setAiSummary(summary);
    } catch (error) {
      console.error(error);
      setAiSummary("حدث خطأ أثناء توليد الملخص. يرجى مراجعة إعدادات الذكاء الاصطناعي.");
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  useEffect(() => {
    if (formData.opponent && formData.opponent.length > 2) {
      const isConflict = clients.some(c => c.name === formData.opponent) || 
                         cases.some(c => c.clientName === formData.opponent);
      if (isConflict) {
        setConflictWarning(`تحذير تضارب مصالح: الاسم "${formData.opponent}" مسجل لدينا كعميل. يرجى مراجعة الملفات قبل المتابعة.`);
      } else {
        setConflictWarning(null);
      }
    } else {
      setConflictWarning(null);
    }
  }, [formData.opponent, clients, cases]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (clientDropdownRef.current && !clientDropdownRef.current.contains(event.target as Node)) {
        setIsClientDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredClients = clients.filter(c => 
    c.name.toLowerCase().includes(clientSearchTerm.toLowerCase()) ||
    c.phone?.includes(clientSearchTerm)
  );

  const selectedClient = clients.find(c => c.id === formData.clientId);

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
      const expertUnsub = onSnapshot(
        query(collection(db, 'expertSessions'), where('caseId', '==', selectedCaseDetails.id), orderBy('date', 'desc')), 
        (snap) => {
          setCaseExpertSessions(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'expertSessions')
      );

      return () => {
        sessUnsub();
        procUnsub();
        docUnsub();
        finUnsub();
        judgUnsub();
        notesUnsub();
        tasksUnsub();
        expertUnsub();
      };
    }
  }, [selectedCaseDetails]);


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

    const settingsUnsub = onSnapshot(doc(db, 'settings', 'global'), (snapshot) => {
      if (snapshot.exists()) {
        setSystemSettings(snapshot.data() as SystemSettings);
      }
    });

    return () => {
      unsub();
      sessionsUnsub();
      clientsUnsub();
      settingsUnsub();
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
      const noteData = {
        caseId: selectedCaseDetails.id,
        text: newNote,
        date: new Date().toISOString(),
        author: user.name
      };
      await addDoc(collection(db, 'caseNotes'), noteData);
      
      // Notify lawyers/staff about the new note (except the author)
      const usersSnap = await getDocs(query(collection(db, 'users'), where('role', 'in', ['admin', 'lawyer', 'staff'])));
      for (const uDoc of usersSnap.docs) {
        if (uDoc.id !== user.uid) {
          await createNotification(uDoc.id, {
            title: 'ملاحظة جديدة على قضية',
            message: `أضاف ${user.name} ملاحظة جديدة في قضية رقم ${selectedCaseDetails.caseNumber}`,
            type: 'note',
            relatedId: selectedCaseDetails.id,
            link: `/cases?id=${selectedCaseDetails.id}`
          });
        }
      }

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

  const handleDelete = async () => {
    if (user.role === 'client' || !caseToDelete) return;
    try {
      await deleteDoc(doc(db, 'cases', caseToDelete));
      setIsDeleteModalOpen(false);
      setCaseToDelete(null);
    } catch (error) {
      console.error('Error deleting case:', error);
    }
  };

  const handleAddSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (user.role === 'client') return;
    if (!selectedCaseForSession || !sessionDate) return;

    try {
      const sessionDataToSave = {
        caseId: selectedCaseForSession.id,
        date: sessionDate,
        decision: sessionDecision,
        nextDate: sessionNextDate,
        lawyerId: selectedCaseForSession.lawyerId || '',
        updatedAt: new Date().toISOString()
      };

      if (editingSession) {
        await updateDoc(doc(db, 'sessions', editingSession.id), sessionDataToSave);
      } else {
        await addDoc(collection(db, 'sessions'), {
          ...sessionDataToSave,
          createdAt: new Date().toISOString()
        });
      }

      setIsSessionModalOpen(false);
      setSessionDate('');
      setSessionDecision('');
      setSessionNextDate('');
      setSelectedCaseForSession(null);
      setEditingSession(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'sessions');
    }
  };

  const handleEditSession = (session: any) => {
    if (user.role === 'client') return;
    setEditingSession(session);
    setSessionDate(session.date);
    setSessionDecision(session.decision || '');
    setSessionNextDate(session.nextDate || '');
    setSelectedCaseForSession(cases.find(c => c.id === session.caseId) || null);
    setIsSessionModalOpen(true);
  };

  const handleDeleteSession = async () => {
    if (user.role === 'client' || !sessionToDelete) return;
    try {
      await deleteDoc(doc(db, 'sessions', sessionToDelete));
      setIsSessionDeleteModalOpen(false);
      setSessionToDelete(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'sessions');
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
    ...caseJudgments.map(j => ({ ...j, timelineType: 'judgment', timelineDate: j.date })),
    ...caseExpertSessions.map(s => ({ ...s, timelineType: 'expert', timelineDate: s.date }))
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
        
        <div className="flex items-center gap-2 bg-white p-2 rounded-2xl border border-slate-200 shadow-sm">
          <button
            onClick={() => setViewMode('list')}
            className={cn(
              "p-2 rounded-xl transition-all",
              viewMode === 'list' ? "bg-slate-900 text-white shadow-md text-xs font-bold flex items-center gap-1" : "text-slate-400 hover:bg-slate-50"
            )}
            title="عرض القائمة"
          >
            <List className="w-4 h-4" />
            {viewMode === 'list' && <span>قائمة</span>}
          </button>
          <button
            onClick={() => setViewMode('kanban')}
            className={cn(
              "p-2 rounded-xl transition-all",
              viewMode === 'kanban' ? "bg-slate-900 text-white shadow-md text-xs font-bold flex items-center gap-1" : "text-slate-400 hover:bg-slate-50"
            )}
            title="عرض اللوحة"
          >
            <LayoutGrid className="w-4 h-4" />
            {viewMode === 'kanban' && <span>لوحة</span>}
          </button>
        </div>
      </div>

      {/* Cases Content */}
      {viewMode === 'list' ? (
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
                  <h3 className="text-2xl font-black text-slate-900">قضية: {c.caseNumber || 'بدون رقم'} / {c.year || '----'}</h3>
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
                    <span className="text-slate-900 font-extrabold text-lg">
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
                    <span className="text-slate-900 font-extrabold text-lg">{c.opponent || '---'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400">المحكمة:</span>
                    <span className="text-slate-900 font-extrabold text-lg">{c.court || '---'}</span>
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
                      onClick={() => {
                        setCaseToDelete(c.id);
                        setIsDeleteModalOpen(true);
                      }}
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
        {filteredCases.length === 0 && (
          <div className="py-24 text-center bg-white rounded-3xl border-2 border-dashed border-slate-200">
            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Search className="w-8 h-8 text-slate-300" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">لا توجد قضايا تطابق بحثك</h3>
            <p className="text-slate-500 font-medium">جرب تغيير معايير البحث أو إضافة قضية جديدة.</p>
          </div>
        )}
      </div>
      ) : (
        <div className="flex gap-6 h-[calc(100vh-320px)] overflow-x-auto pb-6 scrollbar-hide">
          {(Object.keys(STATUS_MAP) as CaseStatus[]).map((statusKey) => {
            const statusInfo = STATUS_MAP[statusKey];
            const casesInColumn = filteredCases.filter(c => c.status === statusKey);
            return (
              <div key={statusKey} className="flex flex-col w-80 shrink-0 bg-slate-50/50 rounded-[32px] border border-slate-200/60 p-5">
                <div className="flex items-center justify-between mb-6 px-2">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-2.5 h-2.5 rounded-full ring-4 ring-white shadow-sm",
                      statusInfo.color === 'blue' ? "bg-blue-500" :
                      statusInfo.color === 'indigo' ? "bg-indigo-500" :
                      statusInfo.color === 'amber' ? "bg-amber-500" :
                      "bg-emerald-500"
                    )} />
                    <h3 className="font-black text-slate-900 text-sm">{statusInfo.label}</h3>
                    <span className="bg-white px-2.5 py-0.5 rounded-full border border-slate-200 text-[10px] font-black text-slate-500 shadow-sm">
                      {casesInColumn.length}
                    </span>
                  </div>
                  <button className="p-1.5 hover:bg-white rounded-xl transition-all text-slate-400">
                    <MoreHorizontal className="w-4 h-4" />
                  </button>
                </div>
                
                <div className="flex-1 overflow-y-auto space-y-4 pr-1 scrollbar-hide">
                  {casesInColumn.map((c) => (
                    <motion.div
                      key={c.id}
                      layoutId={c.id}
                      whileHover={{ y: -4, boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }}
                      onClick={() => setSelectedCaseDetails(c)}
                      className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm cursor-pointer group hover:border-indigo-200 transition-colors"
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className="px-2.5 py-1 bg-slate-50 text-slate-500 rounded-lg text-[9px] font-black uppercase tracking-wider group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                          {c.caseType}
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                          {isLawyer && (
                            <button 
                              onClick={(e) => { e.stopPropagation(); handleEdit(c); }}
                              className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-indigo-600"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                      <h4 className="font-black text-slate-900 mb-1 group-hover:text-indigo-600 transition-colors truncate">{c.caseNumber}</h4>
                      <p className="text-xs text-slate-500 font-bold truncate mb-5">{c.clientName}</p>
                      
                      <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-slate-100 border-2 border-white flex items-center justify-center text-[10px] font-black text-slate-400">
                            {c.clientName.charAt(0)}
                          </div>
                          {c.tag && (
                            <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-lg">#{c.tag}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-slate-300">
                          {c.autoNumber && <Zap className="w-3.5 h-3.5" />}
                          <FileText className="w-3.5 h-3.5" />
                        </div>
                      </div>
                    </motion.div>
                  ))}
                  {casesInColumn.length === 0 && (
                    <div className="py-16 border-2 border-dashed border-slate-200/50 rounded-2xl flex flex-col items-center justify-center grayscale opacity-30">
                      <Briefcase className="w-8 h-8 text-slate-300 mb-2" />
                      <p className="text-[10px] font-black text-slate-400 uppercase">لا يوجد قضايا</p>
                    </div>
                  )}
                </div>
                
                {statusKey === 'pre-filing' && isLawyer && (
                  <button 
                    onClick={() => {
                      setEditingCase(null);
                      setFormData({ clientId: '', status: 'pre-filing', tag: '' });
                      setIsModalOpen(true);
                    }}
                    className="mt-6 w-full py-3 bg-white border-2 border-dashed border-slate-200 rounded-2xl text-xs font-black text-slate-400 hover:border-indigo-200 hover:text-indigo-600 transition-all flex items-center justify-center gap-2 group shadow-sm active:scale-95"
                  >
                    <Plus className="w-4 h-4 group-hover:rotate-90 transition-transform" />
                    إضافة قضية جديدة
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Print-only Case Details Section */}
      {selectedCaseDetails && (
        <div className="hidden print:block p-12 bg-white text-right" dir="rtl">
          <div className="flex justify-between items-start mb-10 border-b-2 border-slate-900 pb-8">
            <div>
              <h1 className="text-2xl font-black text-slate-900">{systemSettings?.officeName || 'مكتب المحامي محمد امين علي الصايغ'}</h1>
              <p className="text-sm text-slate-500 font-bold">{systemSettings?.officeDescription || 'للمحاماة والاستشارات القانونية'}</p>
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

      {/* Delete Case Confirmation Modal */}
      <ConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setCaseToDelete(null);
        }}
        onConfirm={handleDelete}
        title="حذف القضية"
        message="هل أنت متأكد من حذف هذه القضية؟ لا يمكن التراجع عن هذا الإجراء."
        confirmLabel="حذف"
        cancelLabel="إلغاء"
      />

      {/* Delete Session Confirmation Modal */}
      <ConfirmModal
        isOpen={isSessionDeleteModalOpen}
        onClose={() => {
          setIsSessionDeleteModalOpen(false);
          setSessionToDelete(null);
        }}
        onConfirm={handleDeleteSession}
        title="حذف الجلسة"
        message="هل أنت متأكد من حذف هذه الجلسة؟ لا يمكن التراجع عن هذا الإجراء."
        confirmLabel="حذف"
        cancelLabel="إلغاء"
      />

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
                  <div className="space-y-2 sm:col-span-2 relative" ref={clientDropdownRef}>
                    <label className="text-sm font-bold text-slate-700">الموكل</label>
                    <div className="relative">
                      <div 
                        onClick={() => setIsClientDropdownOpen(!isClientDropdownOpen)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus-within:ring-2 focus-within:ring-indigo-600 cursor-pointer flex items-center justify-between"
                      >
                        <span className={cn(selectedClient ? "text-slate-900" : "text-slate-400")}>
                          {selectedClient ? selectedClient.name : "اختر الموكل..."}
                        </span>
                        <Search className="w-4 h-4 text-slate-400" />
                      </div>

                      <AnimatePresence>
                        {isClientDropdownOpen && (
                          <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="absolute z-50 w-full mt-2 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden"
                          >
                            <div className="p-2 border-b border-slate-100 bg-slate-50">
                              <input
                                autoFocus
                                type="text"
                                placeholder="ابحث باسم الموكل أو رقم الهاتف..."
                                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-600"
                                value={clientSearchTerm}
                                onChange={(e) => setClientSearchTerm(e.target.value)}
                              />
                            </div>
                            <div className="max-h-60 overflow-y-auto">
                              {filteredClients.length > 0 ? (
                                filteredClients.map(client => (
                                  <div
                                    key={client.id}
                                    onClick={() => {
                                      setFormData({ ...formData, clientId: client.id });
                                      setIsClientDropdownOpen(false);
                                      setClientSearchTerm('');
                                    }}
                                    className="px-4 py-3 hover:bg-indigo-50 cursor-pointer transition-all flex items-center justify-between group"
                                  >
                                    <div className="flex flex-col">
                                      <span className="text-sm font-bold text-slate-800 group-hover:text-indigo-600">{client.name}</span>
                                      <span className="text-[10px] text-slate-400 font-medium">{client.phone}</span>
                                    </div>
                                    {formData.clientId === client.id && <Check className="w-4 h-4 text-indigo-600" />}
                                  </div>
                                ))
                              ) : (
                                <div className="px-4 py-8 text-center text-slate-400 text-sm italic">
                                  لم يتم العثور على موكلين
                                </div>
                              )}
                            </div>
                            <div 
                              onClick={() => {
                                navigate('/clients');
                                setIsClientDropdownOpen(false);
                              }}
                              className="p-3 bg-slate-50 border-t border-slate-100 text-center cursor-pointer hover:bg-slate-100 transition-all"
                            >
                              <span className="text-xs font-black text-indigo-600 flex items-center justify-center gap-2">
                                <Plus className="w-3 h-3" />
                                إضافة موكل جديد
                              </span>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
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
                      <option>أسرة حولي</option>
                      <option>أسرة العاصمة</option>
                      <option>أسرة مبارك الكبير</option>
                      <option>أسرة الأحمدي</option>
                      <option>أسرة الجهراء</option>
                      <option>أسرة الفروانية</option>
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
                    <div className="relative">
                      <input
                        type="text"
                        className={cn(
                          "w-full bg-slate-50 border rounded-xl px-4 py-3 text-sm font-medium transition-all outline-none",
                          conflictWarning ? "border-rose-300 ring-2 ring-rose-50" : "border-slate-200 focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
                        )}
                        value={formData.opponent}
                        onChange={(e) => setFormData({ ...formData, opponent: e.target.value })}
                        placeholder="اسم الخصم بالكامل..."
                      />
                      {conflictWarning && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="absolute right-0 -bottom-10 z-10 bg-rose-600 text-white text-[10px] font-black px-3 py-1.5 rounded-lg shadow-lg flex items-center gap-2"
                        >
                          <AlertTriangle className="w-3 h-3" />
                          {conflictWarning}
                        </motion.div>
                      )}
                    </div>
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
                <div>
                  <h2 className="text-xl font-black text-slate-900">
                    {editingSession ? 'تعديل بيانات الجلسة' : 'إضافة جلسة جديدة'}
                  </h2>
                  <p className="text-sm text-slate-500 font-medium">
                    {editingSession ? 'قم بتحديث بيانات الجلسة المسجلة' : 'قم بتعبئة بيانات الجلسة القادمة'}
                  </p>
                </div>
                <button 
                  onClick={() => {
                    setIsSessionModalOpen(false);
                    setEditingSession(null);
                  }} 
                  className="p-2 hover:bg-white rounded-xl transition-all"
                >
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
                    {editingSession ? 'حفظ التعديلات' : 'إضافة الجلسة'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsSessionModalOpen(false);
                      setEditingSession(null);
                    }}
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
              onClick={() => {
                setSelectedCaseDetails(null);
                setAiSummary(null);
              }}
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
                    onClick={() => handleGenerateSummary(selectedCaseDetails)}
                    disabled={isGeneratingSummary}
                    className="flex items-center gap-2 bg-indigo-50 text-indigo-700 px-4 py-2 rounded-xl font-bold text-sm hover:bg-indigo-100 transition-all shadow-sm border border-indigo-100"
                  >
                    <Sparkles className={cn("w-4 h-4", isGeneratingSummary && "animate-pulse")} />
                    <span>{isGeneratingSummary ? 'جاري التحليل...' : 'تحليل ذكي (AI)'}</span>
                  </button>
                  <button 
                    onClick={() => window.print()}
                    className="flex items-center gap-2 bg-slate-100 text-slate-700 px-4 py-2 rounded-xl font-bold text-sm hover:bg-slate-200 transition-all shadow-sm"
                  >
                    <Printer className="w-4 h-4" />
                    <span>طباعة التفاصيل</span>
                  </button>
                  <button onClick={() => {
                    setSelectedCaseDetails(null);
                    setAiSummary(null);
                  }} className="p-2 hover:bg-white rounded-xl transition-all">
                    <X className="w-6 h-6 text-slate-400" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-8 space-y-8">
                {/* AI Summary Section */}
                <AnimatePresence>
                  {aiSummary && (
                    <motion.div
                      initial={{ opacity: 0, y: -20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-indigo-50/50 border border-indigo-100 rounded-[32px] p-8 shadow-sm relative overflow-hidden"
                    >
                      <div className="absolute top-0 right-0 p-8 opacity-5">
                        <Sparkles className="w-32 h-32 text-indigo-600" />
                      </div>
                      <div className="relative">
                        <div className="flex items-center justify-between mb-6">
                          <h3 className="text-lg font-black text-indigo-900 flex items-center gap-2">
                            <Zap className="w-6 h-6" />
                            التحليل القانوني الذكي (AI Analysis)
                          </h3>
                          <button 
                            onClick={() => handleGenerateSummary(selectedCaseDetails)}
                            className="p-2 hover:bg-indigo-100 rounded-xl transition-all text-indigo-600"
                            title="إعادة التوليد"
                          >
                            <RefreshCw className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="prose prose-slate prose-indigo max-w-none prose-sm font-medium leading-relaxed text-slate-700">
                          <Markdown>{aiSummary}</Markdown>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Omission Detector Warning */}
                {(() => {
                  const today = new Date().toISOString().split('T')[0];
                  const omittedReg = caseSessions.filter(s => {
                    const sDate = s.date?.split('T')[0];
                    return sDate && sDate < today && !s.decision;
                  });
                  const omittedExp = caseExpertSessions.filter(s => {
                    const sDate = s.date?.split('T')[0];
                    return sDate && sDate < today && !s.decision && s.status === 'pending' && !s.isRelayed;
                  });
                  const totalOmitted = omittedReg.length + omittedExp.length;

                  if (totalOmitted === 0) return null;

                  return (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="bg-red-50 border border-red-100 rounded-3xl p-6 flex flex-col md:flex-row items-center justify-between gap-6"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-red-100 rounded-2xl flex items-center justify-center text-red-600 animate-pulse">
                          <AlertCircle className="w-6 h-6" />
                        </div>
                        <div>
                          <h4 className="text-lg font-black text-red-900">تنبيه كاشف السهو</h4>
                          <p className="text-sm font-bold text-red-700/80">هناك {totalOmitted} جلسات فائتة لم يتم ترحيل قراراتها لهذه القضية.</p>
                        </div>
                      </div>
                      <button 
                         onClick={() => navigate('/sessions?tab=omitted')}
                         className="px-6 py-2 bg-red-600 text-white rounded-xl text-xs font-black shadow-lg shadow-red-100 hover:bg-red-700 transition-all"
                      >
                        معالجة السهو الآن
                      </button>
                    </motion.div>
                  );
                })()}

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
                            event.timelineType === 'procedure' ? "bg-emerald-600" : 
                            event.timelineType === 'expert' ? "bg-purple-600" : "bg-amber-600"
                          )} />
                          <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{event.timelineDate}</span>
                                {event.timelineType === 'session' && isLawyer && (
                                  <div className="flex items-center gap-1">
                                    <button 
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleEditSession(event);
                                      }}
                                      className="p-1 text-slate-400 hover:text-indigo-600 transition-all"
                                    >
                                      <Edit2 className="w-3 h-3" />
                                    </button>
                                    <button 
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSessionToDelete(event.id);
                                        setIsSessionDeleteModalOpen(true);
                                      }}
                                      className="p-1 text-slate-400 hover:text-red-600 transition-all"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </div>
                                )}
                              </div>
                              <span className={cn(
                                "px-2 py-0.5 rounded-lg text-[10px] font-black uppercase",
                                event.timelineType === 'session' ? "bg-indigo-50 text-indigo-600" : 
                                event.timelineType === 'procedure' ? "bg-emerald-50 text-emerald-600" : 
                                event.timelineType === 'expert' ? "bg-purple-50 text-purple-600" : "bg-amber-50 text-amber-600"
                              )}>
                                {event.timelineType === 'session' ? 'جلسة' : 
                                 event.timelineType === 'procedure' ? 'إجراء' : 
                                 event.timelineType === 'expert' ? 'جلسة خبير' : 'حكم'}
                              </span>
                            </div>
                            <h4 className="text-sm font-bold text-slate-900">
                              {event.timelineType === 'session' ? (event.decision || 'جلسة مرافعة') : 
                               event.timelineType === 'procedure' ? event.type : 
                               event.timelineType === 'expert' ? `جلسة خبير: ${event.expertName}` :
                               `حكم ${event.type === 'initial' ? 'ابتدائي' : event.type === 'appeal' ? 'استئناف' : 'تمييز'}`}
                            </h4>
                            <p className="text-xs text-slate-500 font-medium mt-1">
                              {event.timelineType === 'session' ? (event.decision ? '' : 'بانتظار القرار') : 
                               event.timelineType === 'procedure' ? event.notes : 
                               event.timelineType === 'expert' ? event.decision : event.result}
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

                    {/* Case Notes - Internal Only */}
                    {(user.role === 'admin' || user.role === 'lawyer' || user.role === 'staff') && (
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
                                  <span className="text-[10px] text-slate-400 font-bold">
                                    {note.author} - {(() => {
                                      try {
                                        return format(parseISO(note.date), 'yyyy/MM/dd HH:mm');
                                      } catch (e) {
                                        return '---';
                                      }
                                    })()}
                                  </span>
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
                    )}

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

                    {/* Expert Sessions History (Collapsible) */}
                    <div className="space-y-4">
                      <button 
                        onClick={() => setIsExpertHistoryOpen(!isExpertHistoryOpen)}
                        className="w-full flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:bg-slate-100 transition-all group"
                      >
                        <div className="flex items-center gap-3">
                          <Users className="w-5 h-5 text-indigo-600" />
                          <span className="text-sm font-black text-slate-900">سجل جلسات الخبراء</span>
                          <span className="bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-lg text-[10px] font-black">
                            {caseExpertSessions.length}
                          </span>
                        </div>
                        <motion.div
                          animate={{ rotate: isExpertHistoryOpen ? 180 : 0 }}
                          className="text-slate-400 group-hover:text-indigo-600"
                        >
                          <Plus className="w-4 h-4" />
                        </motion.div>
                      </button>

                      <AnimatePresence>
                        {isExpertHistoryOpen && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden space-y-3"
                          >
                            {caseExpertSessions.map((s) => (
                              <div key={s.id} className="p-4 bg-white border border-slate-100 rounded-2xl shadow-sm space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{s.date}</span>
                                  <span className={cn(
                                    "px-2 py-0.5 rounded-lg text-[10px] font-black uppercase",
                                    s.status === 'attended' ? "bg-emerald-50 text-emerald-600" : 
                                    s.status === 'reserved_for_report' ? "bg-indigo-50 text-indigo-600" : "bg-amber-50 text-amber-600"
                                  )}>
                                    {s.status === 'attended' ? 'تمت' : s.status === 'reserved_for_report' ? 'محجوز للتقرير' : 'قادمة'}
                                  </span>
                                </div>
                                <p className="text-sm font-bold text-slate-900">الخبير: {s.expertName}</p>
                                {s.decision && (
                                  <p className="text-xs text-slate-500 font-medium bg-slate-50 p-2 rounded-lg border border-slate-100">
                                    {s.decision}
                                  </p>
                                )}
                                {s.nextDate && (
                                  <div className="flex items-center gap-2 text-[10px] font-black text-indigo-600">
                                    <CalendarPlus className="w-3 h-3" />
                                    <span>الجلسة القادمة: {s.nextDate}</span>
                                  </div>
                                )}
                              </div>
                            ))}
                            {caseExpertSessions.length === 0 && (
                              <p className="text-center py-4 text-slate-400 text-xs font-bold italic">لا توجد جلسات خبراء مسجلة</p>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
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
                    setIsTagPrintModalOpen(false);
                    // Small delay to allow modal to close and print section to be ready
                    setTimeout(() => {
                      window.print();
                    }, 500);
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

      {/* Print-only Case Details Section */}
      {selectedCaseDetails && (
        <div className="hidden print:block p-12 bg-white text-right" dir="rtl">
          <div className="flex justify-between items-start mb-10 border-b-4 border-slate-900 pb-8">
            <div>
              <h1 className="text-3xl font-black text-slate-900">مكتب المحامي محمد امين علي الصايغ</h1>
              <p className="text-lg text-slate-600 font-bold mt-2">للمحاماة والاستشارات القانونية</p>
              <div className="mt-4 space-y-1 text-sm text-slate-500 font-bold">
                <p>دولة الكويت - برج التجارية - الدور 25</p>
                <p>هاتف: 22222222 - فاكس: 22222223</p>
              </div>
            </div>
            <div className="text-left">
              <div className="bg-slate-900 text-white px-6 py-3 rounded-xl font-black text-xl mb-4">
                تقرير تفاصيل القضية
              </div>
              <p className="font-bold text-slate-900 text-sm">تاريخ التقرير: {new Date().toLocaleDateString('ar-EG')}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-12 mb-12">
            <div className="space-y-6">
              <h3 className="text-xl font-black border-b-2 border-slate-200 pb-2 text-indigo-600">بيانات القضية الأساسية</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                  <p className="text-xs font-black text-slate-400 mb-1">رقم القضية</p>
                  <p className="text-lg font-black text-slate-900">{selectedCaseDetails.caseNumber || '---'}</p>
                </div>
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                  <p className="text-xs font-black text-slate-400 mb-1">الرقم الآلي</p>
                  <p className="text-lg font-black text-indigo-600">{selectedCaseDetails.autoNumber || '---'}</p>
                </div>
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                  <p className="text-xs font-black text-slate-400 mb-1">المحكمة</p>
                  <p className="text-sm font-bold text-slate-900">{selectedCaseDetails.court || '---'}</p>
                </div>
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                  <p className="text-xs font-black text-slate-400 mb-1">الدائرة</p>
                  <p className="text-sm font-bold text-slate-900">{selectedCaseDetails.circuit || '---'}</p>
                </div>
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                  <p className="text-xs font-black text-slate-400 mb-1">السنة</p>
                  <p className="text-sm font-bold text-slate-900">{selectedCaseDetails.year || '---'}</p>
                </div>
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                  <p className="text-xs font-black text-slate-400 mb-1">الحالة</p>
                  <p className="text-sm font-bold text-slate-900">{STATUS_MAP[selectedCaseDetails.status]?.label}</p>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <h3 className="text-xl font-black border-b-2 border-slate-200 pb-2 text-indigo-600">بيانات الأطراف</h3>
              <div className="space-y-4">
                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200">
                  <p className="text-xs font-black text-slate-400 mb-1">الموكل ({selectedCaseDetails.clientPosition ? POSITION_LABELS[selectedCaseDetails.clientPosition] : '---'})</p>
                  <p className="text-xl font-black text-slate-900">{selectedCaseDetails.clientName || '---'}</p>
                </div>
                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200">
                  <p className="text-xs font-black text-slate-400 mb-1">الخصم</p>
                  <p className="text-xl font-black text-slate-900">{selectedCaseDetails.opponent || '---'}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6 mb-12">
            <h3 className="text-xl font-black border-b-2 border-slate-200 pb-2 text-indigo-600">الخط الزمني والقرارات</h3>
            <div className="border-2 border-slate-900 rounded-2xl overflow-hidden">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-slate-100 border-b-2 border-slate-900">
                    <th className="p-4 text-right text-sm font-black border-l border-slate-900 w-32">التاريخ</th>
                    <th className="p-4 text-right text-sm font-black border-l border-slate-900 w-32">النوع</th>
                    <th className="p-4 text-right text-sm font-black">القرار / التفاصيل</th>
                    <th className="p-4 text-right text-sm font-black border-r border-slate-900 w-40">الجلسة القادمة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {timelineEvents.map((event, index) => (
                    <tr key={index} className="page-break-inside-avoid">
                      <td className="p-4 text-sm font-bold border-l border-slate-200">{event.timelineDate}</td>
                      <td className="p-4 text-sm font-black border-l border-slate-200">
                        {event.timelineType === 'session' ? 'جلسة' : 
                         event.timelineType === 'procedure' ? 'إجراء' : 'حكم'}
                      </td>
                      <td className="p-4 text-sm font-medium">
                        <div className="font-black text-slate-900 mb-1">
                          {event.timelineType === 'session' ? (event.decision || 'جلسة مرافعة') : 
                           event.timelineType === 'procedure' ? event.type : `حكم ${event.type}`}
                        </div>
                        <div className="text-slate-600">
                          {event.timelineType === 'session' ? '' : 
                           event.timelineType === 'procedure' ? event.notes : event.result}
                        </div>
                      </td>
                      <td className="p-4 text-sm font-black text-indigo-600 border-r border-slate-200">
                        {event.nextDate || '---'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {caseFinance && (
            <div className="space-y-6 mb-12 page-break-inside-avoid">
              <h3 className="text-xl font-black border-b-2 border-slate-200 pb-2 text-indigo-600">الملخص المالي</h3>
              <div className="grid grid-cols-3 gap-6">
                <div className="bg-slate-900 text-white p-6 rounded-3xl">
                  <p className="text-xs font-black uppercase opacity-60 mb-2">إجمالي الأتعاب</p>
                  <p className="text-2xl font-black">{caseFinance.totalFees?.toLocaleString()} د.ك</p>
                </div>
                <div className="bg-emerald-50 border-2 border-emerald-200 p-6 rounded-3xl">
                  <p className="text-xs font-black text-emerald-600 uppercase mb-2">المسدد</p>
                  <p className="text-2xl font-black text-emerald-700">{caseFinance.receivedAmount?.toLocaleString()} د.ك</p>
                </div>
                <div className="bg-amber-50 border-2 border-amber-200 p-6 rounded-3xl">
                  <p className="text-xs font-black text-amber-600 uppercase mb-2">المتبقي</p>
                  <p className="text-2xl font-black text-amber-700">{(caseFinance.totalFees - caseFinance.receivedAmount)?.toLocaleString()} د.ك</p>
                </div>
              </div>
            </div>
          )}

          <div className="mt-24 flex justify-between items-end">
            <div className="text-center w-72">
              <p className="font-black text-xl mb-20 text-slate-900">توقيع المحامي المسؤول</p>
              <div className="border-b-4 border-slate-900"></div>
            </div>
            <div className="text-center w-72">
              <p className="font-black text-xl mb-20 text-slate-900">ختم واعتماد المكتب</p>
              <div className="border-b-4 border-slate-900"></div>
            </div>
          </div>
        </div>
      )}

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
                <th className="border border-slate-900 p-3 text-right text-sm font-black">تاريخ آخر جلسة</th>
                <th className="border border-slate-900 p-3 text-right text-sm font-black">قرار الجلسة</th>
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
                    <td className="border border-slate-900 p-3 text-sm font-bold">{lastSession?.decision || '---'}</td>
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
