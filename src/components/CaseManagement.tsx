import React, { useState, useEffect } from 'react';
import { collection, addDoc, onSnapshot, query, orderBy, deleteDoc, doc, updateDoc, where } from 'firebase/firestore';
import { db } from '../firebase';
import { Plus, Search, Filter, Briefcase, Scale, Gavel, Archive, MoreVertical, Trash2, Edit2, X, Check, ArrowLeftRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Case, CaseStatus, Client } from '../types';
import { cn } from '../lib/utils';

const STATUS_MAP: Record<CaseStatus, { label: string; color: string; icon: any }> = {
  'pre-filing': { label: 'تحت الرفع', color: 'blue', icon: Briefcase },
  'active': { label: 'متداولة', color: 'indigo', icon: Scale },
  'execution': { label: 'تنفيذ', color: 'amber', icon: Gavel },
  'archive': { label: 'أرشيف', color: 'emerald', icon: Archive },
};

export default function CaseManagement() {
  const [cases, setCases] = useState<Case[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<CaseStatus | 'all'>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCase, setEditingCase] = useState<Case | null>(null);
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

  const filteredCases = activeTab === 'all' ? cases : cases.filter(c => c.status === activeTab);

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

      {/* Tabs */}
      <div className="bg-white p-2 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap gap-2">
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

      {/* Cases List */}
      <div className="grid grid-cols-1 gap-4">
        {filteredCases.map((c) => {
          const config = STATUS_MAP[c.status];
          const Icon = config.icon;
          return (
            <motion.div
              layout
              key={c.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all group flex flex-col lg:flex-row lg:items-center gap-6"
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

              <div className="flex items-center gap-3 lg:border-r lg:pr-6 lg:border-slate-100">
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
                <button className="p-3 bg-slate-50 text-slate-600 rounded-xl hover:bg-red-50 hover:text-red-600 transition-all border border-slate-100">
                  <Trash2 className="w-5 h-5" />
                </button>
                <button className="flex items-center gap-2 bg-slate-900 text-white px-6 py-3 rounded-xl font-bold text-sm hover:bg-slate-800 transition-all shadow-lg shadow-slate-100">
                  <ArrowLeftRight className="w-4 h-4" />
                  ترحيل الحالة
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
    </div>
  );
}
