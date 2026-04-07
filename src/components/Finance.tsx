import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, doc, updateDoc, addDoc, where } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { DollarSign, TrendingUp, TrendingDown, CreditCard, PieChart, ArrowUpRight, ArrowDownRight, Plus, Search, Filter, Download, FileText, Check, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Finance, Case, UserProfile } from '../types';
import { cn } from '../lib/utils';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface FinanceManagementProps {
  user: UserProfile;
}

export default function FinanceManagement({ user }: FinanceManagementProps) {
  const [finances, setFinances] = useState<Finance[]>([]);
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingFinance, setEditingFinance] = useState<Finance | null>(null);
  const [formData, setFormData] = useState<Partial<Finance>>({
    caseId: '',
    totalFees: 0,
    receivedAmount: 0,
    expenses: 0,
    sundries: 0
  });

  useEffect(() => {
    let cq = query(collection(db, 'cases'), orderBy('createdAt', 'desc'));
    if (user.role === 'client') {
      cq = query(collection(db, 'cases'), where('clientId', '==', user.uid));
    }

    const unsub = onSnapshot(collection(db, 'finance'), (snapshot) => {
      setFinances(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Finance)));
      setLoading(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'finance');
      setLoading(false);
    });

    const casesUnsub = onSnapshot(cq, (snapshot) => {
      setCases(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Case)));
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'cases');
    });

    return () => {
      unsub();
      casesUnsub();
    };
  }, [user.uid, user.role]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (user.role === 'client') return;
    try {
      if (editingFinance) {
        await updateDoc(doc(db, 'finance', editingFinance.id), formData);
      } else {
        await addDoc(collection(db, 'finance'), {
          ...formData,
          createdAt: new Date().toISOString()
        });
      }
      setIsModalOpen(false);
      setEditingFinance(null);
      setFormData({ caseId: '', totalFees: 0, receivedAmount: 0, expenses: 0, sundries: 0 });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'finance');
    }
  };

  const clientFinances = finances.filter(f => cases.some(c => c.id === f.caseId));

  const totalFees = clientFinances.reduce((acc, f) => acc + (f.totalFees || 0), 0);
  const totalReceived = clientFinances.reduce((acc, f) => acc + (f.receivedAmount || 0), 0);
  const totalExpenses = clientFinances.reduce((acc, f) => acc + (f.expenses || 0) + (f.sundries || 0), 0);
  const netProfit = totalReceived - totalExpenses;

  const chartData = clientFinances.slice(0, 6).map(f => ({
    name: cases.find(c => c.id === f.caseId)?.caseNumber || '---',
    fees: f.totalFees,
    received: f.receivedAmount
  }));

  const isLawyer = user.role === 'admin' || user.role === 'lawyer';

  return (
    <div className="space-y-8 rtl" dir="rtl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 mb-1">الإدارة المالية للمكتب</h1>
          <p className="text-slate-500 font-medium">متابعة الأتعاب، الدفعات، والمصروفات القضائية.</p>
        </div>
        {isLawyer && (
          <button
            onClick={() => {
              setEditingFinance(null);
              setFormData({ caseId: '', totalFees: 0, receivedAmount: 0, expenses: 0, sundries: 0 });
              setIsModalOpen(true);
            }}
            className="flex items-center justify-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all"
          >
            <Plus className="w-5 h-5" />
            إضافة سجل مالي
          </button>
        )}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'إجمالي الأتعاب', value: totalFees, icon: DollarSign, color: 'indigo', trend: '+12%' },
          { label: 'المبالغ المستلمة', value: totalReceived, icon: TrendingUp, color: 'emerald', trend: '+5%' },
          { label: 'إجمالي المصروفات', value: totalExpenses, icon: TrendingDown, color: 'red', trend: '+8%' },
          { label: 'صافي الربح', value: netProfit, icon: PieChart, color: 'amber', trend: '+15%' },
        ].map((stat, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all group"
          >
            <div className="flex items-center justify-between mb-4">
              <div className={cn("p-3 rounded-xl group-hover:scale-110 transition-transform", `bg-${stat.color}-50 text-${stat.color}-600`)}>
                <stat.icon className="w-6 h-6" />
              </div>
              <div className={cn("flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-lg", stat.color === 'red' ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-600")}>
                {stat.color === 'red' ? <ArrowDownRight className="w-3 h-3" /> : <ArrowUpRight className="w-3 h-3" />}
                {stat.trend}
              </div>
            </div>
            <p className="text-slate-500 text-sm font-bold mb-1">{stat.label}</p>
            <h3 className="text-2xl font-black text-slate-900">{stat.value.toLocaleString()} د.ك</h3>
          </motion.div>
        ))}
      </div>

      {/* Chart & Recent Transactions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="text-lg font-bold text-slate-900 mb-8 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-indigo-600" />
            تحليل التدفق المالي (آخر 6 قضايا)
          </h3>
          <div className="h-80 w-full min-h-[320px]">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={320}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12, fontWeight: 600 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12, fontWeight: 600 }} dx={-10} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="fees" fill="#4f46e5" radius={[4, 4, 0, 0]} name="الأتعاب" />
                <Bar dataKey="received" fill="#10b981" radius={[4, 4, 0, 0]} name="المستلم" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-600" />
            آخر السجلات المالية
          </h3>
          <div className="space-y-4">
            {finances.slice(0, 5).map((f, i) => {
              const c = cases.find(caseItem => caseItem.id === f.caseId);
              return (
                <div key={i} className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl border border-slate-100 hover:border-indigo-200 transition-all group">
                  <div className="p-3 bg-white rounded-xl border border-slate-200 group-hover:bg-indigo-50 group-hover:border-indigo-200 transition-all">
                    <DollarSign className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-bold text-slate-900 truncate">قضية: {c?.caseNumber || '---'}</h4>
                    <p className="text-xs text-slate-500 font-medium truncate">{c?.clientName}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black text-slate-900">{f.receivedAmount.toLocaleString()} د.ك</p>
                    <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-widest">دفعة مستلمة</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
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
                  {editingFinance ? 'تعديل السجل المالي' : 'إضافة سجل مالي جديد'}
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
                    <label className="text-sm font-bold text-slate-700">إجمالي الأتعاب</label>
                    <input
                      type="number"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition-all"
                      value={formData.totalFees}
                      onChange={(e) => setFormData({ ...formData, totalFees: Number(e.target.value) })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">المبلغ المستلم</label>
                    <input
                      type="number"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition-all"
                      value={formData.receivedAmount}
                      onChange={(e) => setFormData({ ...formData, receivedAmount: Number(e.target.value) })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">المصروفات القضائية</label>
                    <input
                      type="number"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition-all"
                      value={formData.expenses}
                      onChange={(e) => setFormData({ ...formData, expenses: Number(e.target.value) })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">النثريات</label>
                    <input
                      type="number"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition-all"
                      value={formData.sundries}
                      onChange={(e) => setFormData({ ...formData, sundries: Number(e.target.value) })}
                    />
                  </div>
                </div>

                <div className="pt-4 flex gap-4">
                  <button
                    type="submit"
                    className="flex-1 bg-indigo-600 text-white font-bold py-4 rounded-2xl shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"
                  >
                    <Check className="w-5 h-5" />
                    {editingFinance ? 'حفظ التعديلات' : 'إضافة السجل'}
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
