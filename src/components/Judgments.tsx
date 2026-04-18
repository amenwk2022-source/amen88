import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, addDoc, doc, updateDoc, deleteDoc, where } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useNavigate } from 'react-router-dom';
import { Scale, Calendar, AlertCircle, CheckCircle2, Plus, Search, Filter, Trash2, Edit2, X, Check, ArrowRight, Gavel } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Judgment, Case, UserProfile } from '../types';
import { cn } from '../lib/utils';
import { format, isPast, parseISO, addDays } from 'date-fns';
import { ar } from 'date-fns/locale';
import ConfirmModal from './ConfirmModal';

interface JudgmentsProps {
  user: UserProfile;
}

export default function Judgments({ user }: JudgmentsProps) {
  const navigate = useNavigate();
  const [judgments, setJudgments] = useState<Judgment[]>([]);
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingJudgment, setEditingJudgment] = useState<Judgment | null>(null);
  const [formData, setFormData] = useState<Partial<Judgment>>({
    caseId: '',
    date: new Date().toISOString().split('T')[0],
    type: 'initial',
    result: '',
    appealDeadline: '',
    appealStatus: 'pending',
    isAppealed: false,
    notes: ''
  });

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [judgmentToDelete, setJudgmentToDelete] = useState<string | null>(null);

  useEffect(() => {
    let cq = query(collection(db, 'cases'), orderBy('createdAt', 'desc'));
    if (user.role === 'client') {
      cq = query(collection(db, 'cases'), where('clientId', '==', user.uid));
    }

    const unsub = onSnapshot(query(collection(db, 'judgments'), orderBy('date', 'desc')), (snapshot) => {
      const fetchedJudgments = snapshot.docs.map(doc => {
        const data = doc.data();
        try {
          if (data.date) {
            const d = parseISO(data.date);
            if (isNaN(d.getTime())) throw new Error('Invalid date');
          }
          if (data.appealDeadline) {
            const d = parseISO(data.appealDeadline);
            if (isNaN(d.getTime())) throw new Error('Invalid deadline');
          }
        } catch (e) {
          console.error('Judgments: Error parsing date for judgment:', doc.id, e);
        }
        return { id: doc.id, ...data } as Judgment;
      });
      setJudgments(fetchedJudgments);
      setLoading(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'judgments');
      setLoading(false);
    });

    const casesUnsub = onSnapshot(cq, (snapshot) => {
      setCases(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Case)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'cases'));

    return () => {
      unsub();
      casesUnsub();
    };
  }, [user.uid, user.role]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (user.role === 'client') return;
    try {
      if (editingJudgment) {
        await updateDoc(doc(db, 'judgments', editingJudgment.id), formData);
      } else {
        await addDoc(collection(db, 'judgments'), {
          ...formData,
          createdAt: new Date().toISOString()
        });
      }
      setIsModalOpen(false);
      setEditingJudgment(null);
      setFormData({ 
        caseId: '', 
        date: new Date().toISOString().split('T')[0], 
        type: 'initial', 
        result: '', 
        appealDeadline: '', 
        appealStatus: 'pending',
        isAppealed: false, 
        notes: '' 
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'judgments');
    }
  };

  const handleDelete = async () => {
    if (!judgmentToDelete) return;
    try {
      await deleteDoc(doc(db, 'judgments', judgmentToDelete));
      setIsDeleteModalOpen(false);
      setJudgmentToDelete(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'judgments');
    }
  };

  const isLawyer = user.role === 'admin' || user.role === 'lawyer';

  const filteredJudgments = judgments.filter(j => {
    const caseInfo = cases.find(c => c.id === j.caseId);
    if (!caseInfo) return false;
    return j.result.toLowerCase().includes(searchTerm.toLowerCase()) ||
           caseInfo?.caseNumber?.includes(searchTerm) ||
           caseInfo?.clientName?.toLowerCase().includes(searchTerm.toLowerCase());
  });

  return (
    <div className="space-y-6 rtl" dir="rtl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 mb-1">سجل الأحكام والقرارات</h1>
          <p className="text-slate-500 font-medium">توثيق الأحكام الصادرة ومتابعة مواعيد الاستئناف.</p>
        </div>
        {isLawyer && (
          <button
            onClick={() => {
              setEditingJudgment(null);
              setFormData({ 
                caseId: '', 
                date: new Date().toISOString().split('T')[0], 
                type: 'initial', 
                result: '', 
                appealDeadline: '', 
                appealStatus: 'pending',
                isAppealed: false, 
                notes: '' 
              });
              setIsModalOpen(true);
            }}
            className="flex items-center justify-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all"
          >
            <Plus className="w-5 h-5" />
            إضافة حكم جديد
          </button>
        )}
      </div>

      {/* Search & Filters */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
        <div className="flex-1 flex items-center gap-3 bg-slate-50 px-4 py-2 rounded-xl border border-slate-200">
          <Search className="w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="بحث في الأحكام، أرقام القضايا، أو الموكلين..."
            className="bg-transparent border-none focus:ring-0 text-sm w-full font-medium"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Judgments Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredJudgments.map((judgment) => {
          const caseInfo = cases.find(c => c.id === judgment.caseId);
          let deadlineDate: Date | null = null;
          try {
            if (judgment.appealDeadline) {
              deadlineDate = parseISO(judgment.appealDeadline);
              if (isNaN(deadlineDate.getTime())) throw new Error('Invalid appealDeadline');
            }
          } catch (e) {
            console.error('Judgments: Error parsing appealDeadline:', judgment.appealDeadline, e);
          }
          const isDeadlinePassed = deadlineDate ? isPast(deadlineDate) : false;

          return (
            <motion.div
              layout
              key={judgment.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all group relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-1 h-full bg-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 border border-indigo-100">
                    <Gavel className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-slate-900">
                      {judgment.type === 'initial' ? 'حكم أول درجة' : judgment.type === 'appeal' ? 'حكم الاستئناف' : 'حكم التمييز'}
                    </h3>
                    <p className="text-sm text-slate-500 font-bold uppercase tracking-widest mt-1">
                      قضية: <span className="text-indigo-600 font-black">{caseInfo?.caseNumber || '---'}</span>
                    </p>
                  </div>
                </div>
                {isLawyer && (
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => {
                        setEditingJudgment(judgment);
                        setFormData(judgment);
                        setIsModalOpen(true);
                      }}
                      className="p-2 hover:bg-indigo-50 text-indigo-600 rounded-lg transition-all"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        setJudgmentToDelete(judgment.id);
                        setIsDeleteModalOpen(true);
                      }}
                      className="p-2 hover:bg-red-50 text-red-600 rounded-lg transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              <div className="p-5 bg-slate-50 rounded-xl border border-slate-100 mb-4">
                <p className="text-base font-bold text-slate-800 leading-relaxed">{judgment.result}</p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-slate-400">تاريخ الحكم:</span>
                  <span className="text-slate-700">
                    {(() => {
                      try {
                        if (!judgment.date) return '---';
                        const d = parseISO(judgment.date);
                        if (isNaN(d.getTime())) return '---';
                        return format(d, 'yyyy/MM/dd');
                      } catch (e) {
                        console.error('Judgments: Error parsing judgment date:', judgment.date, e);
                        return '---';
                      }
                    })()}
                  </span>
                </div>
                
                {judgment.appealDeadline && (
                  <div className={cn(
                    "flex items-center justify-between p-2 rounded-lg text-xs font-black",
                    judgment.isAppealed ? "bg-emerald-50 text-emerald-600" :
                    isDeadlinePassed ? "bg-red-50 text-red-600" : "bg-amber-50 text-amber-600"
                  )}>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-3 h-3" />
                      <span>آخر موعد للاستئناف:</span>
                    </div>
                    <span>{format(deadlineDate!, 'yyyy/MM/dd')}</span>
                  </div>
                )}

                <div className="flex items-center justify-between pt-3 border-t border-slate-50">
                  <div className="flex items-center gap-2">
                    {judgment.appealStatus === 'appealed' || judgment.isAppealed ? (
                      <span className="flex items-center gap-1 text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg">
                        <CheckCircle2 className="w-3 h-3" />
                        تم الاستئناف
                      </span>
                    ) : judgment.appealStatus === 'final' ? (
                      <span className="flex items-center gap-1 text-[10px] font-black text-indigo-600 bg-indigo-50 px-2 py-1 rounded-lg">
                        <Scale className="w-3 h-3" />
                        حكم نهائي
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[10px] font-black text-slate-400 bg-slate-50 px-2 py-1 rounded-lg">
                        <AlertCircle className="w-3 h-3" />
                        بانتظار الاستئناف
                      </span>
                    )}
                  </div>
                  <button 
                    onClick={() => navigate(`/cases?id=${judgment.caseId}`)}
                    className="text-indigo-600 text-[10px] font-black hover:underline flex items-center gap-1"
                  >
                    تفاصيل القضية
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setJudgmentToDelete(null);
        }}
        onConfirm={handleDelete}
        title="حذف الحكم"
        message="هل أنت متأكد من حذف هذا الحكم؟ لا يمكن التراجع عن هذا الإجراء."
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
              className="relative bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <h2 className="text-xl font-black text-slate-900">
                  {editingJudgment ? 'تعديل بيانات الحكم' : 'إضافة حكم جديد'}
                </h2>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-white rounded-xl transition-all">
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="p-8 space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">القضية</label>
                  <select
                    required
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition-all"
                    value={formData.caseId}
                    onChange={(e) => setFormData({ ...formData, caseId: e.target.value })}
                  >
                    <option value="">اختر القضية...</option>
                    {cases.map(c => (
                      <option key={c.id} value={c.id}>{c.caseNumber} - {c.clientName}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">تاريخ الحكم</label>
                    <input
                      required
                      type="date"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition-all"
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">درجة التقاضي</label>
                    <select
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition-all"
                      value={formData.type}
                      onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                    >
                      <option value="initial">أول درجة</option>
                      <option value="appeal">استئناف</option>
                      <option value="cassation">تمييز / نقض</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">منطوق الحكم</label>
                  <textarea
                    required
                    rows={3}
                    placeholder="اكتب منطوق الحكم هنا..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition-all"
                    value={formData.result}
                    onChange={(e) => setFormData({ ...formData, result: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">آخر موعد للاستئناف</label>
                    <input
                      type="date"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition-all"
                      value={formData.appealDeadline}
                      onChange={(e) => setFormData({ ...formData, appealDeadline: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">حالة الاستئناف</label>
                    <select
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition-all"
                      value={formData.appealStatus}
                      onChange={(e) => setFormData({ ...formData, appealStatus: e.target.value as any, isAppealed: e.target.value === 'appealed' })}
                    >
                      <option value="pending">بانتظار الاستئناف</option>
                      <option value="appealed">تم الاستئناف</option>
                      <option value="final">حكم نهائي</option>
                    </select>
                  </div>
                </div>

                <div className="pt-4 flex gap-4">
                  <button
                    type="submit"
                    className="flex-1 bg-indigo-600 text-white font-bold py-4 rounded-2xl shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"
                  >
                    <Check className="w-5 h-5" />
                    {editingJudgment ? 'حفظ التعديلات' : 'إضافة الحكم'}
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
    </div>
  );
}
