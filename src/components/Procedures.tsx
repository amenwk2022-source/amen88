import React, { useState, useEffect } from 'react';
import { collection, addDoc, onSnapshot, query, orderBy, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Plus, Search, ClipboardList, Clock, User, MessageSquare, Trash2, Edit2, X, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Procedure, Case, UserProfile } from '../types';
import { cn } from '../lib/utils';
import { format } from 'date-fns';
import { arSA } from 'date-fns/locale';

interface ProcedureProps {
  user: UserProfile | null;
}

export default function ProcedureManagement({ user }: ProcedureProps) {
  const [procedures, setProcedures] = useState<Procedure[]>([]);
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [autoNumberSearch, setAutoNumberSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProcedure, setEditingProcedure] = useState<Procedure | null>(null);
  const [formData, setFormData] = useState<Partial<Procedure>>({
    caseId: '',
    type: '',
    notes: '',
    date: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    const q = query(collection(db, 'procedures'), orderBy('date', 'desc'));
    const unsub = onSnapshot(q, (snapshot) => {
      setProcedures(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Procedure)));
      setLoading(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'procedures');
      setLoading(false);
    });

    const casesUnsub = onSnapshot(collection(db, 'cases'), (snapshot) => {
      setCases(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Case)));
    });

    return () => {
      unsub();
      casesUnsub();
    };
  }, []);

  const handleAutoNumberSearch = () => {
    const foundCase = cases.find(c => c.autoNumber === autoNumberSearch);
    if (foundCase) {
      setFormData({
        caseId: foundCase.id,
        type: 'إجراء تنفيذ',
        notes: `بدء إجراءات التنفيذ للرقم الآلي: ${foundCase.autoNumber}`,
        date: new Date().toISOString().split('T')[0]
      });
      setIsModalOpen(true);
      setAutoNumberSearch('');
    } else {
      alert('لم يتم العثور على قضية بهذا الرقم الآلي');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const data = {
        ...formData,
        staffId: user?.uid || 'unknown',
        updatedAt: new Date().toISOString()
      };

      if (editingProcedure) {
        await updateDoc(doc(db, 'procedures', editingProcedure.id), data);
      } else {
        await addDoc(collection(db, 'procedures'), {
          ...data,
          createdAt: new Date().toISOString()
        });
      }
      setIsModalOpen(false);
      setEditingProcedure(null);
      setFormData({ caseId: '', type: '', notes: '', date: new Date().toISOString().split('T')[0] });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'procedures');
    }
  };

  const filteredProcedures = procedures.filter(p => {
    const c = cases.find(caseItem => caseItem.id === p.caseId);
    return (
      p.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c?.caseNumber?.includes(searchTerm) ||
      c?.clientName?.includes(searchTerm) ||
      c?.autoNumber?.includes(searchTerm)
    );
  });

  return (
    <div className="space-y-6 rtl" dir="rtl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 mb-1">إدارة الإجراءات الإدارية</h1>
          <p className="text-slate-500 font-medium">توثيق ومتابعة كافة الإجراءات المتخذة في القضايا.</p>
        </div>
        <div className="flex gap-2">
          <div className="relative flex items-center">
            <input
              type="text"
              placeholder="بحث بالرقم الآلي للتنفيذ..."
              className="bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-indigo-600 outline-none w-64 shadow-sm"
              value={autoNumberSearch}
              onChange={(e) => setAutoNumberSearch(e.target.value)}
            />
            <button 
              onClick={handleAutoNumberSearch}
              className="absolute left-2 bg-indigo-600 text-white p-1.5 rounded-lg hover:bg-indigo-700 transition-all"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <button
            onClick={() => {
              setEditingProcedure(null);
              setFormData({ caseId: '', type: '', notes: '', date: new Date().toISOString().split('T')[0] });
              setIsModalOpen(true);
            }}
            className="flex items-center justify-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all"
          >
            <Plus className="w-5 h-5" />
            إضافة إجراء جديد
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3 bg-slate-50 px-4 py-2 rounded-xl border border-slate-200">
          <Search className="w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="بحث بنوع الإجراء، رقم القضية، أو اسم الموكل..."
            className="bg-transparent border-none focus:ring-0 text-sm w-full font-medium"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Procedures Timeline */}
      <div className="space-y-4 relative before:absolute before:inset-y-0 before:right-8 before:w-0.5 before:bg-slate-200">
        {filteredProcedures.map((p, i) => {
          const c = cases.find(caseItem => caseItem.id === p.caseId);
          return (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="relative pr-16"
            >
              <div className="absolute right-6 top-6 w-4 h-4 rounded-full bg-indigo-600 border-4 border-white shadow-sm z-10"></div>
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all flex flex-col md:flex-row md:items-center gap-6">
                <div className="flex-1 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-indigo-50 rounded-lg">
                        <ClipboardList className="w-5 h-5 text-indigo-600" />
                      </div>
                      <h3 className="text-lg font-black text-slate-900">{p.type}</h3>
                    </div>
                    <span className="text-xs font-bold text-slate-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {format(new Date(p.date), 'yyyy/MM/dd')}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400 font-bold">القضية:</span>
                      <span className="text-slate-900 font-bold">{c?.caseNumber || '---'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400 font-bold">الموكل:</span>
                      <span className="text-slate-900 font-bold">{c?.clientName || '---'}</span>
                    </div>
                  </div>

                  {p.notes && (
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-sm text-slate-600 italic flex items-start gap-2">
                      <MessageSquare className="w-4 h-4 shrink-0 mt-0.5 text-slate-400" />
                      {p.notes}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 md:border-r md:pr-6 md:border-slate-100">
                  <button
                    onClick={() => {
                      setEditingProcedure(p);
                      setFormData(p);
                      setIsModalOpen(true);
                    }}
                    className="p-2 hover:bg-indigo-50 text-indigo-600 rounded-lg transition-all"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button className="p-2 hover:bg-red-50 text-red-600 rounded-lg transition-all">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
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
              className="relative bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <h2 className="text-xl font-black text-slate-900">
                  {editingProcedure ? 'تعديل الإجراء' : 'إضافة إجراء جديد'}
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

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">نوع الإجراء</label>
                  <input
                    required
                    type="text"
                    placeholder="مثال: تقديم طلب، استلام حكم، إعلان..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition-all"
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">التاريخ</label>
                  <input
                    required
                    type="date"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition-all"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">ملاحظات</label>
                  <textarea
                    rows={3}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition-all"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  />
                </div>

                <div className="pt-4 flex gap-4">
                  <button
                    type="submit"
                    className="flex-1 bg-indigo-600 text-white font-bold py-4 rounded-2xl shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"
                  >
                    <Check className="w-5 h-5" />
                    حفظ الإجراء
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
