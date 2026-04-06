import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { collection, addDoc, onSnapshot, query, orderBy, deleteDoc, doc, updateDoc, where } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Plus, Search, Filter, Briefcase, Scale, Gavel, Archive, MoreVertical, Trash2, Edit2, X, Check, ArrowLeftRight, CalendarPlus, FileCheck, DollarSign } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Case, CaseStatus, Client, Judgment } from '../types';
import { cn } from '../lib/utils';
import { addDays, format } from 'date-fns';

const STATUS_MAP: Record<CaseStatus, { label: string; color: string; icon: any }> = {
  'pre-filing': { label: 'تحت الرفع', color: 'blue', icon: Briefcase },
  'active': { label: 'متداولة', color: 'indigo', icon: Scale },
  'execution': { label: 'تنفيذ', color: 'amber', icon: Gavel },
  'archive': { label: 'أرشيف', color: 'emerald', icon: Archive },
};

export default function CaseManagement() {
  const [searchParams] = useSearchParams();
  const highlightedId = searchParams.get('id');
  const [cases, setCases] = useState<Case[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<CaseStatus | 'all'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
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
  const [sessionDate, setSessionDate] = useState('');
  const caseRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    if (selectedCaseDetails) {
      const sessUnsub = onSnapshot(query(collection(db, 'sessions'), where('caseId', '==', selectedCaseDetails.id), orderBy('date', 'desc')), (snap) => {
        setCaseSessions(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      });
      const procUnsub = onSnapshot(query(collection(db, 'procedures'), where('caseId', '==', selectedCaseDetails.id), orderBy('date', 'desc')), (snap) => {
        setCaseProcedures(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      });
      const docUnsub = onSnapshot(query(collection(db, 'documents'), where('caseId', '==', selectedCaseDetails.id), orderBy('uploadDate', 'desc')), (snap) => {
        setCaseDocuments(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      });
      const finUnsub = onSnapshot(query(collection(db, 'finance'), where('caseId', '==', selectedCaseDetails.id)), (snap) => {
        if (!snap.empty) setCaseFinance({ id: snap.docs[0].id, ...snap.docs[0].data() });
        else setCaseFinance(null);
      });

      return () => {
        sessUnsub();
        procUnsub();
        docUnsub();
        finUnsub();
      };
    }
  }, [selectedCaseDetails]);

  const [judgmentData, setJudgmentData] = useState<Partial<Judgment>>({
    date: new Date().toISOString().split('T')[0],
    type: 'initial',
    result: '',
    notes: ''
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
    status: 'pre-filing'
  });

  useEffect(() => {
    const q = query(collection(db, 'cases'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snapshot) => {
      setCases(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Case)));
      setLoading(false);
    });

    const clientsUnsub = onSnapshot(collection(db, 'clients'), (snapshot) => {
      setClients(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client)));
    });

    return () => {
      unsub();
      clientsUnsub();
    };
  }, []);

  useEffect(() => {
    if (highlightedId && caseRefs.current[highlightedId]) {
      caseRefs.current[highlightedId]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setActiveTab('all');
    }
  }, [highlightedId, loading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
      setFormData({ clientId: '', status: 'pre-filing' });
    } catch (error) {
      console.error('Error saving case:', error);
    }
  };

  const handleMoveToJudgment = async (id: string) => {
    try {
      await updateDoc(doc(db, 'cases', id), {
        status: 'archive',
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'cases');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('هل أنت متأكد من حذف هذه القضية؟')) return;
    try {
      await deleteDoc(doc(db, 'cases', id));
    } catch (error) {
      console.error('Error deleting case:', error);
    }
  };

  const handleAddSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCaseForSession || !sessionDate) return;

    try {
      await addDoc(collection(db, 'sessions'), {
        caseId: selectedCaseForSession.id,
        date: sessionDate,
        decision: '',
        nextDate: '',
        lawyerId: selectedCaseForSession.lawyerId || '',
        createdAt: new Date().toISOString()
      });
      setIsSessionModalOpen(false);
      setSessionDate('');
      setSelectedCaseForSession(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'sessions');
    }
  };

  const handleAddJudgment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCaseForJudgment || !judgmentData.date || !judgmentData.result) return;

    try {
      const appealDeadline = addDays(new Date(judgmentData.date), 30).toISOString();
      
      await addDoc(collection(db, 'judgments'), {
        caseId: selectedCaseForJudgment.id,
        date: judgmentData.date,
        type: judgmentData.type,
        result: judgmentData.result,
        appealDeadline,
        isAppealed: false,
        notes: judgmentData.notes,
        createdAt: new Date().toISOString()
      });

      // Update case status to archive
      await updateDoc(doc(db, 'cases', selectedCaseForJudgment.id), {
        status: 'archive',
        updatedAt: new Date().toISOString()
      });

      setIsJudgmentModalOpen(false);
      setSelectedCaseForJudgment(null);
      setJudgmentData({ date: new Date().toISOString().split('T')[0], type: 'initial', result: '', notes: '' });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'judgments');
    }
  };

  const filteredCases = cases.filter(c => {
    const matchesTab = activeTab === 'all' || c.status === activeTab;
    const matchesSearch = 
      c.caseNumber?.includes(searchTerm) || 
      c.clientName?.includes(searchTerm) || 
      c.autoNumber?.includes(searchTerm) ||
      c.opponent?.includes(searchTerm);
    return matchesTab && matchesSearch;
  });

  return (
    <div className="space-y-6 rtl" dir="rtl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 mb-1">إدارة القضايا (The Four Pillars)</h1>
          <p className="text-slate-500 font-medium">تتبع دورة حياة القضايا من التجهيز إلى الأرشفة.</p>
        </div>
        <button
          onClick={() => {
            setEditingCase(null);
            setFormData({ clientId: '', status: 'pre-filing' });
            setIsModalOpen(true);
          }}
          className="flex items-center justify-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all"
        >
          <Plus className="w-5 h-5" />
          إضافة قضية جديدة
        </button>
      </div>

      {/* Tabs & Local Search */}
      <div className="flex flex-col lg:flex-row gap-4">
        <div className="flex-1 bg-white p-2 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap gap-2">
          <button
            onClick={() => setActiveTab('all')}
            className={cn(
              "px-6 py-2 rounded-xl text-sm font-bold transition-all",
              activeTab === 'all' ? "bg-slate-900 text-white shadow-md" : "text-slate-500 hover:bg-slate-50"
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
                </div>
                <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm font-medium text-slate-500">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400">الموكل:</span>
                    <span className="text-slate-900 font-bold">{c.clientName}</span>
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
              </div>
            </motion.div>
          );
        })}
      </div>

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

      {/* Add Judgment Modal */}
      <AnimatePresence>
        {isJudgmentModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsJudgmentModalOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <h2 className="text-xl font-black text-slate-900">تسجيل منطوق الحكم</h2>
                <button onClick={() => setIsJudgmentModalOpen(false)} className="p-2 hover:bg-white rounded-xl transition-all">
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>
              <form onSubmit={handleAddJudgment} className="p-8 space-y-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">تاريخ صدور الحكم</label>
                    <input
                      required
                      type="date"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-indigo-600 transition-all"
                      value={judgmentData.date}
                      onChange={(e) => setJudgmentData({ ...judgmentData, date: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">درجة التقاضي</label>
                    <select
                      required
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-indigo-600 transition-all"
                      value={judgmentData.type}
                      onChange={(e) => setJudgmentData({ ...judgmentData, type: e.target.value as any })}
                    >
                      <option value="initial">ابتدائي</option>
                      <option value="appeal">استئناف</option>
                      <option value="cassation">تمييز</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">منطوق الحكم</label>
                    <textarea
                      required
                      rows={3}
                      placeholder="اكتب منطوق الحكم هنا..."
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-indigo-600 transition-all"
                      value={judgmentData.result}
                      onChange={(e) => setJudgmentData({ ...judgmentData, result: e.target.value })}
                    />
                  </div>
                </div>
                <div className="pt-4 flex gap-4">
                  <button
                    type="submit"
                    className="flex-1 bg-indigo-600 text-white font-bold py-4 rounded-2xl shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"
                  >
                    <FileCheck className="w-5 h-5" />
                    حفظ وأرشفة
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsJudgmentModalOpen(false)}
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
                    <p className="text-sm text-slate-500 font-bold">{selectedCaseDetails.clientName}</p>
                  </div>
                </div>
                <button onClick={() => setSelectedCaseDetails(null)} className="p-2 hover:bg-white rounded-xl transition-all">
                  <X className="w-6 h-6 text-slate-400" />
                </button>
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

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Sessions Section */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                      <CalendarPlus className="w-5 h-5 text-indigo-600" />
                      الجلسات السابقة والقادمة
                    </h3>
                    <div className="space-y-3">
                      {caseSessions.map((s, i) => (
                        <div key={i} className="p-4 bg-white border border-slate-100 rounded-2xl shadow-sm flex items-center justify-between">
                          <div>
                            <p className="text-sm font-bold text-slate-900">{s.date}</p>
                            <p className="text-xs text-slate-500 font-medium">{s.decision || 'بانتظار القرار'}</p>
                          </div>
                          {s.nextDate && (
                            <div className="text-left">
                              <p className="text-[10px] font-black text-indigo-600 uppercase">الجلسة القادمة</p>
                              <p className="text-xs font-bold text-slate-900">{s.nextDate}</p>
                            </div>
                          )}
                        </div>
                      ))}
                      {caseSessions.length === 0 && <p className="text-center py-8 text-slate-400 font-bold text-sm">لا توجد جلسات مسجلة</p>}
                    </div>
                  </div>

                  {/* Procedures Section */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                      <Scale className="w-5 h-5 text-indigo-600" />
                      الإجراءات المتخذة
                    </h3>
                    <div className="space-y-3">
                      {caseProcedures.map((p, i) => (
                        <div key={i} className="p-4 bg-white border border-slate-100 rounded-2xl shadow-sm flex items-center gap-3">
                          <div className="p-2 bg-slate-50 rounded-lg">
                            <Check className="w-4 h-4 text-emerald-600" />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-900">{p.type}</p>
                            <p className="text-xs text-slate-500 font-medium">{p.date}</p>
                          </div>
                        </div>
                      ))}
                      {caseProcedures.length === 0 && <p className="text-center py-8 text-slate-400 font-bold text-sm">لا توجد إجراءات مسجلة</p>}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Documents Section */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                      <FileCheck className="w-5 h-5 text-indigo-600" />
                      المستندات المرفقة
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      {caseDocuments.map((d, i) => (
                        <a 
                          key={i} 
                          href={d.fileUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="p-4 bg-slate-50 border border-slate-100 rounded-2xl hover:border-indigo-200 transition-all group"
                        >
                          <FileCheck className="w-8 h-8 text-indigo-600 mb-2 group-hover:scale-110 transition-transform" />
                          <p className="text-xs font-bold text-slate-900 truncate">{d.title}</p>
                          <p className="text-[10px] text-slate-400">{d.uploadDate}</p>
                        </a>
                      ))}
                      {caseDocuments.length === 0 && <div className="col-span-2 text-center py-8 text-slate-400 font-bold text-sm">لا توجد مستندات</div>}
                    </div>
                  </div>

                  {/* Finance Summary */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                      <DollarSign className="w-5 h-5 text-indigo-600" />
                      الموقف المالي
                    </h3>
                    {caseFinance ? (
                      <div className="bg-indigo-600 p-6 rounded-3xl text-white shadow-xl shadow-indigo-100">
                        <div className="grid grid-cols-2 gap-6">
                          <div>
                            <p className="text-indigo-200 text-[10px] font-black uppercase mb-1">إجمالي الأتعاب</p>
                            <p className="text-xl font-black">{caseFinance.totalFees.toLocaleString()} د.ك</p>
                          </div>
                          <div>
                            <p className="text-indigo-200 text-[10px] font-black uppercase mb-1">المبلغ المستلم</p>
                            <p className="text-xl font-black">{caseFinance.receivedAmount.toLocaleString()} د.ك</p>
                          </div>
                          <div className="col-span-2 pt-4 border-t border-indigo-500/50">
                            <div className="flex items-center justify-between">
                              <p className="text-indigo-200 text-[10px] font-black uppercase">المتبقي</p>
                              <p className="text-2xl font-black">{(caseFinance.totalFees - caseFinance.receivedAmount).toLocaleString()} د.ك</p>
                            </div>
                            <div className="mt-2 h-2 bg-indigo-900/30 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-white rounded-full" 
                                style={{ width: `${(caseFinance.receivedAmount / caseFinance.totalFees) * 100}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="p-8 bg-slate-50 border border-slate-100 rounded-3xl text-center">
                        <p className="text-slate-400 font-bold text-sm">لا يوجد سجل مالي لهذه القضية</p>
                      </div>
                    )}
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
