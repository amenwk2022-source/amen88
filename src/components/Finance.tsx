import React, { useState, useEffect, useRef } from 'react';
import { collection, onSnapshot, query, orderBy, doc, updateDoc, addDoc, where } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { DollarSign, TrendingUp, TrendingDown, CreditCard, PieChart, ArrowUpRight, ArrowDownRight, Plus, Search, Filter, Download, FileText, Check, X, Printer, Trash2, Calendar, Receipt, Landmark, Edit2, Scale } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Finance, Case, UserProfile, Payment, Expense, SystemSettings } from '../types';
import { cn } from '../lib/utils';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, AreaChart, Area } from 'recharts';
import { format } from 'date-fns';
import { arSA } from 'date-fns/locale';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

interface FinanceManagementProps {
  user: UserProfile;
}

export default function FinanceManagement({ user }: FinanceManagementProps) {
  const [finances, setFinances] = useState<Finance[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [cases, setCases] = useState<Case[]>([]);
  const [systemSettings, setSystemSettings] = useState<SystemSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'payments' | 'expenses'>('overview');
  
  const [isFinanceModalOpen, setIsFinanceModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);

  const [editingFinance, setEditingFinance] = useState<Finance | null>(null);
  const [selectedReceipt, setSelectedReceipt] = useState<Payment | null>(null);
  
  const [financeFormData, setFinanceFormData] = useState<Partial<Finance>>({
    caseId: '',
    totalFees: 0,
    receivedAmount: 0,
    expenses: 0,
    sundries: 0
  });

  const [paymentFormData, setPaymentFormData] = useState<Partial<Payment>>({
    caseId: '',
    amount: 0,
    date: new Date().toISOString().split('T')[0],
    type: 'cash',
    note: '',
    reference: ''
  });

  const [expenseFormData, setExpenseFormData] = useState<Partial<Expense>>({
    caseId: '',
    amount: 0,
    date: new Date().toISOString().split('T')[0],
    category: 'court_fees',
    description: ''
  });

  const [paymentCaseSearch, setPaymentCaseSearch] = useState('');
  const [expenseCaseSearch, setExpenseCaseSearch] = useState('');

  const receiptRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cq = query(collection(db, 'cases'), orderBy('createdAt', 'desc'));
    if (user.role === 'client') {
      cq = query(collection(db, 'cases'), where('clientId', '==', user.uid));
    }

    const unsubFinance = onSnapshot(collection(db, 'finance'), (snapshot) => {
      setFinances(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Finance)));
      setLoading(false);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'finance'));

    const unsubPayments = onSnapshot(query(collection(db, 'payments'), orderBy('date', 'desc')), (snapshot) => {
      setPayments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Payment)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'payments'));

    const unsubExpenses = onSnapshot(query(collection(db, 'expenses'), orderBy('date', 'desc')), (snapshot) => {
      setExpenses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Expense)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'expenses'));

    const casesUnsub = onSnapshot(cq, (snapshot) => {
      setCases(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Case)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'cases'));

    const settingsUnsub = onSnapshot(doc(db, 'settings', 'global'), (snapshot) => {
      if (snapshot.exists()) {
        setSystemSettings(snapshot.data() as SystemSettings);
      }
    });

    return () => {
      unsubFinance();
      unsubPayments();
      unsubExpenses();
      casesUnsub();
      settingsUnsub();
    };
  }, [user.uid, user.role]);

  const handleFinanceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (user.role === 'client') return;
    try {
      if (editingFinance) {
        await updateDoc(doc(db, 'finance', editingFinance.id), financeFormData);
      } else {
        await addDoc(collection(db, 'finance'), {
          ...financeFormData,
          createdAt: new Date().toISOString()
        });
      }
      setIsFinanceModalOpen(false);
      setEditingFinance(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'finance');
    }
  };

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (user.role === 'client' || !paymentFormData.caseId) return;
    try {
      await addDoc(collection(db, 'payments'), {
        ...paymentFormData,
        receivedBy: user.name,
        createdAt: new Date().toISOString()
      });

      // Also update the total receivedAmount in the finance record for this case
      const financeRecord = finances.find(f => f.caseId === paymentFormData.caseId);
      if (financeRecord) {
        await updateDoc(doc(db, 'finance', financeRecord.id), {
          receivedAmount: (financeRecord.receivedAmount || 0) + (paymentFormData.amount || 0)
        });
      }

      setIsPaymentModalOpen(false);
      setPaymentFormData({ caseId: '', amount: 0, date: new Date().toISOString().split('T')[0], type: 'cash', note: '', reference: '' });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'payments');
    }
  };

  const handleExpenseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (user.role === 'client') return;
    try {
      await addDoc(collection(db, 'expenses'), {
        ...expenseFormData,
        recordedBy: user.name,
        createdAt: new Date().toISOString()
      });

      // If it's linked to a case, update the case expenses
      if (expenseFormData.caseId) {
        const financeRecord = finances.find(f => f.caseId === expenseFormData.caseId);
        if (financeRecord) {
          await updateDoc(doc(db, 'finance', financeRecord.id), {
            expenses: (financeRecord.expenses || 0) + (expenseFormData.amount || 0)
          });
        }
      }

      setIsExpenseModalOpen(false);
      setExpenseFormData({ caseId: '', amount: 0, date: new Date().toISOString().split('T')[0], category: 'court_fees', description: '' });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'expenses');
    }
  };

  const handlePrintReceipt = async () => {
    if (!receiptRef.current) return;
    try {
      const canvas = await html2canvas(receiptRef.current, { scale: 2 });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgWidth = 210;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
      pdf.save(`سند_قبض_${selectedReceipt?.id}.pdf`);
    } catch (error) {
      console.error('Error printing receipt:', error);
    }
  };

  const clientFinances = React.useMemo(() => finances.filter(f => cases.some(c => c.id === f.caseId)), [finances, cases]);

  const totalFees = React.useMemo(() => clientFinances.reduce((acc, f) => acc + (f.totalFees || 0), 0), [clientFinances]);
  const totalReceived = React.useMemo(() => clientFinances.reduce((acc, f) => acc + (f.receivedAmount || 0), 0), [clientFinances]);
  const totalExpenses = React.useMemo(() => clientFinances.reduce((acc, f) => acc + (f.expenses || 0) + (f.sundries || 0), 0), [clientFinances]);
  const netProfit = totalReceived - totalExpenses;

  const chartData = React.useMemo(() => clientFinances.slice(0, 6).map(f => ({
    name: cases.find(c => c.id === f.caseId)?.caseNumber || '---',
    fees: f.totalFees,
    received: f.receivedAmount
  })), [clientFinances, cases]);

  const isLawyer = user.role === 'admin' || user.role === 'lawyer';

  return (
    <div className="space-y-8 rtl pb-20" dir="rtl">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 mb-2">النظام المحاسبي والمالي</h1>
          <p className="text-slate-500 font-bold">إدارة العقود، الدفعات، المصروفات، وإصدار سندات القبض.</p>
        </div>
        {isLawyer && (
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => {
                setPaymentFormData({ ...paymentFormData, date: new Date().toISOString().split('T')[0] });
                setIsPaymentModalOpen(true);
              }}
              className="flex items-center justify-center gap-2 bg-emerald-600 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-emerald-100 hover:bg-emerald-700 transition-all"
            >
              <Receipt className="w-5 h-5" />
              إثبات دفعة
            </button>
            <button
              onClick={() => {
                setExpenseFormData({ ...expenseFormData, date: new Date().toISOString().split('T')[0] });
                setIsExpenseModalOpen(true);
              }}
              className="flex items-center justify-center gap-2 bg-rose-600 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-rose-100 hover:bg-rose-700 transition-all"
            >
              <TrendingDown className="w-5 h-5" />
              تسجيل مصروف
            </button>
            <button
              onClick={() => {
                setEditingFinance(null);
                setFinanceFormData({ caseId: '', totalFees: 0, receivedAmount: 0, expenses: 0, sundries: 0 });
                setIsFinanceModalOpen(true);
              }}
              className="flex items-center justify-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all"
            >
              <Plus className="w-5 h-5" />
              عقد مالي جديد
            </button>
          </div>
        )}
      </div>

      {/* Modern Tabs */}
      <div className="flex gap-2 p-1 bg-slate-100 rounded-2xl w-fit">
        {[
          { id: 'overview', label: 'نظرة عامة', icon: PieChart },
          { id: 'payments', label: 'سجل المقبوضات', icon: DollarSign },
          { id: 'expenses', label: 'سجل المصروفات', icon: TrendingDown },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={cn(
              "flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-black transition-all",
              activeTab === tab.id 
                ? "bg-white text-indigo-600 shadow-sm" 
                : "text-slate-500 hover:bg-white/50"
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
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-8"
          >
            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { label: 'إجمالي العقود', value: totalFees, icon: CreditCard, color: 'indigo' },
                { label: 'المبالغ المحصلة', value: totalReceived, icon: TrendingUp, color: 'emerald' },
                { label: 'المصروفات التشغيلية', value: totalExpenses, icon: TrendingDown, color: 'rose' },
                { label: 'الرصيد الفعلي', value: netProfit, icon: PieChart, color: 'amber' },
              ].map((stat, i) => (
                <div
                  key={i}
                  className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all group"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className={cn("p-4 rounded-2xl group-hover:scale-110 transition-transform", `bg-${stat.color}-50 text-${stat.color}-600`)}>
                      <stat.icon className="w-7 h-7" />
                    </div>
                  </div>
                  <p className="text-slate-500 text-sm font-black mb-1">{stat.label}</p>
                  <h3 className="text-3xl font-black text-slate-900 tabular-nums">
                    {stat.value.toLocaleString()} <span className="text-sm font-bold text-slate-400">د.ك</span>
                  </h3>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
                <h3 className="text-xl font-black text-slate-900 mb-10 flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center">
                    <TrendingUp className="w-6 h-6 text-indigo-600" />
                  </div>
                  تحليل التدفق النقدي للقضايا
                </h3>
                <div className="h-96 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="colorFees" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.1}/>
                          <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorReceived" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12, fontWeight: 700 }} dy={15} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12, fontWeight: 700 }} dx={-15} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#fff', borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                        itemStyle={{ fontWeight: 800 }}
                      />
                      <Area type="monotone" dataKey="fees" stroke="#4f46e5" fillOpacity={1} fill="url(#colorFees)" strokeWidth={4} name="قيمة العقد" />
                      <Area type="monotone" dataKey="received" stroke="#10b981" fillOpacity={1} fill="url(#colorReceived)" strokeWidth={4} name="المحصل فعلياً" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm overflow-hidden relative">
                <h3 className="text-xl font-black text-slate-900 mb-8 flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center">
                    <DollarSign className="w-6 h-6 text-emerald-600" />
                  </div>
                  آخر التحصيلات
                </h3>
                <div className="space-y-4">
                  {payments.slice(0, 6).map((p, i) => {
                    const c = cases.find(caseItem => caseItem.id === p.caseId);
                    return (
                      <motion.div 
                        key={p.id} 
                        initial={{ x: 20, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        transition={{ delay: i * 0.1 }}
                        className="flex items-center gap-4 p-4 bg-slate-50 hover:bg-white rounded-2xl border border-transparent hover:border-emerald-100 hover:shadow-lg hover:shadow-emerald-50/50 transition-all cursor-pointer group"
                        onClick={() => {
                          setSelectedReceipt(p);
                          setIsReceiptModalOpen(true);
                        }}
                      >
                        <div className="w-12 h-12 bg-white rounded-xl border border-slate-100 flex items-center justify-center shadow-sm group-hover:bg-emerald-50 transition-colors">
                          <Receipt className="w-6 h-6 text-emerald-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-black text-slate-900 truncate">{c?.caseNumber || 'قضية غير محددة'}</h4>
                          <p className="text-[10px] text-slate-500 font-bold tracking-wider">{format(new Date(p.date), 'yyyy/MM/dd')}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-black text-emerald-600">{p.amount.toLocaleString()}</p>
                          <p className="text-[9px] text-slate-400 font-bold">د.ك</p>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Main Table for General Contracts */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-8 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-xl font-black text-slate-900">عقود الأتعاب والموقف المالي لكل قضية</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-right">
                  <thead>
                    <tr className="bg-slate-50/50">
                      <th className="px-8 py-5 text-sm font-black text-slate-400">القضية / الموكل</th>
                      <th className="px-8 py-5 text-sm font-black text-slate-400">إجمالي الأتعاب</th>
                      <th className="px-8 py-5 text-sm font-black text-slate-400">المحصل</th>
                      <th className="px-8 py-5 text-sm font-black text-slate-400">المتبقي</th>
                      <th className="px-8 py-5 text-sm font-black text-slate-400">المصروفات</th>
                      <th className="px-8 py-5 text-sm font-black text-slate-400 text-left">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {clientFinances.map((f) => {
                      const c = cases.find(caseItem => caseItem.id === f.caseId);
                      const remaining = f.totalFees - f.receivedAmount;
                      const progress = (f.receivedAmount / f.totalFees) * 100;
                      
                      return (
                        <tr key={f.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-8 py-6">
                            <div className="font-black text-slate-900 text-lg mb-1">{c?.caseNumber || '---'}</div>
                            <div className="text-sm font-bold text-indigo-600">{c?.clientName}</div>
                          </td>
                          <td className="px-8 py-6">
                            <div className="font-black text-slate-900">{f.totalFees.toLocaleString()}</div>
                          </td>
                          <td className="px-8 py-6">
                            <div className="flex flex-col gap-2">
                              <div className="font-black text-emerald-600">{f.receivedAmount.toLocaleString()}</div>
                              <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.min(progress, 100)}%` }} />
                              </div>
                            </div>
                          </td>
                          <td className="px-8 py-6">
                            <div className={cn("font-black", remaining > 0 ? "text-amber-600" : "text-slate-300")}>
                              {remaining.toLocaleString()}
                            </div>
                          </td>
                          <td className="px-8 py-6">
                            <div className="font-black text-rose-600">{f.expenses.toLocaleString()}</div>
                          </td>
                          <td className="px-8 py-6 text-left">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => {
                                  setEditingFinance(f);
                                  setFinanceFormData(f);
                                  setIsFinanceModalOpen(true);
                                }}
                                className="p-3 bg-white border border-slate-200 text-slate-900 rounded-xl hover:bg-slate-50 transition-all font-black text-xs"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'payments' && (
          <motion.div
            key="payments"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            className="space-y-6"
          >
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-8 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-xl font-black text-slate-900 flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600">
                    <Receipt className="w-6 h-6" />
                  </div>
                  سجل المقبوضات حسب التاريخ
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-right">
                  <thead>
                    <tr className="bg-slate-50/50">
                      <th className="px-8 py-5 text-sm font-black text-slate-400">التاريخ</th>
                      <th className="px-8 py-5 text-sm font-black text-slate-400">رقم السند</th>
                      <th className="px-8 py-5 text-sm font-black text-slate-400">القضية</th>
                      <th className="px-8 py-5 text-sm font-black text-slate-400">طريقة الدفع</th>
                      <th className="px-8 py-5 text-sm font-black text-slate-400">المبلغ</th>
                      <th className="px-8 py-5 text-sm font-black text-slate-400 text-left">تحكم</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {payments.map((p) => {
                      const c = cases.find(caseItem => caseItem.id === p.caseId);
                      return (
                        <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-8 py-6 font-bold text-slate-600">{format(new Date(p.date), 'dd MMMM yyyy', { locale: arSA })}</td>
                          <td className="px-8 py-6">
                            <span className="bg-slate-100 px-3 py-1 rounded-lg font-mono font-bold text-xs">#{p.id.slice(-6).toUpperCase()}</span>
                          </td>
                          <td className="px-8 py-6">
                            <div className="font-black text-slate-900">{c?.caseNumber || '---'}</div>
                            <div className="text-xs font-bold text-slate-400">{c?.clientName}</div>
                          </td>
                          <td className="px-8 py-6">
                            <div className="flex items-center gap-2 font-bold text-sm text-slate-600">
                              {p.type === 'cash' ? <DollarSign className="w-4 h-4" /> : p.type === 'transfer' ? <Landmark className="w-4 h-4" /> : <CreditCard className="w-4 h-4" />}
                              {p.type === 'cash' ? 'نقدي' : p.type === 'transfer' ? 'تحويل بنكي' : p.type === 'knet' ? 'كي نت' : 'شيك'}
                            </div>
                          </td>
                          <td className="px-8 py-6">
                            <div className="text-lg font-black text-emerald-600">{p.amount.toLocaleString()} د.ك</div>
                          </td>
                          <td className="px-8 py-6 text-left">
                            <button
                              onClick={() => {
                                setSelectedReceipt(p);
                                setIsReceiptModalOpen(true);
                              }}
                              className="p-3 bg-white border border-slate-200 text-indigo-600 rounded-xl hover:bg-indigo-50 transition-all font-black text-xs inline-flex items-center gap-2"
                            >
                              <Printer className="w-4 h-4" />
                              طباعة سند
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'expenses' && (
          <motion.div
            key="expenses"
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            className="space-y-6"
          >
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-8 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-xl font-black text-slate-900 flex items-center gap-3">
                  <div className="w-10 h-10 bg-rose-50 rounded-xl flex items-center justify-center text-rose-600">
                    <TrendingDown className="w-6 h-6" />
                  </div>
                  سجل المصروفات التشغيلية
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-right">
                  <thead>
                    <tr className="bg-slate-50/50">
                      <th className="px-8 py-5 text-sm font-black text-slate-400">التاريخ</th>
                      <th className="px-8 py-5 text-sm font-black text-slate-400">الفئة</th>
                      <th className="px-8 py-5 text-sm font-black text-slate-400">البيان / القضية</th>
                      <th className="px-8 py-5 text-sm font-black text-slate-400">المبلغ</th>
                      <th className="px-8 py-5 text-sm font-black text-slate-400">بواسطة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {expenses.map((e) => {
                      const c = cases.find(caseItem => caseItem.id === e.caseId);
                      return (
                        <tr key={e.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-8 py-6 font-bold text-slate-600">{format(new Date(e.date), 'dd MMMM yyyy', { locale: arSA })}</td>
                          <td className="px-8 py-6">
                            <span className="bg-rose-50 text-rose-600 px-4 py-1.5 rounded-xl font-black text-xs">
                              {e.category === 'court_fees' ? 'رسوم قضائية' : e.category === 'expert_fees' ? 'أتعاب خبراء' : 'نثريات متنوعة'}
                            </span>
                          </td>
                          <td className="px-8 py-6">
                            <div className="font-bold text-slate-900">{e.description}</div>
                            {c && <div className="text-xs font-bold text-indigo-600 mt-1">مرتبط بقضية: {c.caseNumber}</div>}
                          </td>
                          <td className="px-8 py-6">
                            <div className="text-lg font-black text-rose-600">{e.amount.toLocaleString()} د.ك</div>
                          </td>
                          <td className="px-8 py-6 font-bold text-slate-500 text-sm">{e.recordedBy}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Finance Modal */}
      <AnimatePresence>
        {isFinanceModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsFinanceModalOpen(false)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative bg-white w-full max-w-xl rounded-[40px] shadow-2xl overflow-hidden border border-white/20">
              <div className="p-10 border-b border-slate-100 flex items-center justify-between">
                <h2 className="text-2xl font-black text-slate-900">إبرام عقد مالي</h2>
                <button onClick={() => setIsFinanceModalOpen(false)} className="p-3 hover:bg-slate-100 rounded-2xl transition-all">
                  <X className="w-6 h-6 text-slate-400" />
                </button>
              </div>
              <form onSubmit={handleFinanceSubmit} className="p-10 space-y-8">
                <div className="space-y-3">
                  <label className="text-sm font-black text-slate-700 mr-2">اختيار القضية</label>
                  <select
                    required
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 text-lg font-bold focus:ring-4 focus:ring-indigo-100 focus:border-indigo-600 transition-all outline-none"
                    value={financeFormData.caseId}
                    onChange={(e) => setFinanceFormData({ ...financeFormData, caseId: e.target.value })}
                  >
                    <option value="">اختر القضية المعنية...</option>
                    {cases.map(c => (
                      <option key={c.id} value={c.id}>{c.caseNumber} - {c.clientName}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-8">
                  <div className="space-y-3">
                    <label className="text-sm font-black text-slate-700 mr-2">إجمالي مبلغ الأتعاب</label>
                    <input
                      type="number"
                      required
                      placeholder="0.00"
                      className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 text-2xl font-black focus:ring-4 focus:ring-indigo-100 focus:border-indigo-600 transition-all outline-none"
                      value={financeFormData.totalFees || ''}
                      onChange={(e) => setFinanceFormData({ ...financeFormData, totalFees: Number(e.target.value) })}
                    />
                  </div>
                  <div className="space-y-3 opacity-50 pointer-events-none">
                    <label className="text-sm font-black text-slate-700 mr-2">المسدد مسبقاً</label>
                    <input
                      type="number"
                      className="w-full bg-slate-100 border-2 border-slate-100 rounded-2xl px-6 py-4 text-2xl font-black"
                      value={financeFormData.receivedAmount || 0}
                      readOnly
                    />
                  </div>
                </div>

                <div className="pt-6 flex gap-4">
                  <button type="submit" className="flex-1 bg-indigo-600 text-white font-black py-5 rounded-[24px] shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center justify-center gap-3 text-lg">
                    <Check className="w-6 h-6" />
                    حفظ بيانات العقد المالي
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Payment Modal */}
      <AnimatePresence>
        {isPaymentModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsPaymentModalOpen(false)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative bg-white w-full max-w-xl rounded-[40px] shadow-2xl overflow-hidden border border-white/20">
              <div className="p-10 border-b border-slate-100 bg-emerald-50/50 flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-black text-slate-900 leading-none">إثبات استلام دفعة</h2>
                  <p className="text-emerald-600 font-bold mt-2">توثيق مالي - سند قبض</p>
                </div>
                <button onClick={() => setIsPaymentModalOpen(false)} className="p-3 hover:bg-white rounded-2xl transition-all">
                  <X className="w-6 h-6 text-slate-400" />
                </button>
              </div>
              <form onSubmit={handlePaymentSubmit} className="p-10 space-y-8">
                <div className="space-y-4">
                  <div className="space-y-3">
                    <label className="text-sm font-black text-slate-700 mr-2">البحث عن القضية / الموكل</label>
                    <div className="relative">
                      <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                      <input
                        type="text"
                        placeholder="ابحث بالاسم أو رقم القضية..."
                        className="w-full bg-white border-2 border-slate-100 rounded-2xl pr-12 pl-4 py-4 text-sm font-bold focus:border-emerald-600 transition-all outline-none"
                        value={paymentCaseSearch}
                        onChange={(e) => setPaymentCaseSearch(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="space-y-3">
                    <label className="text-sm font-black text-slate-700 mr-2">اختيار الموكل المستهدف</label>
                    <select
                      required
                      className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 text-lg font-bold focus:ring-4 focus:ring-emerald-100 focus:border-emerald-600 transition-all outline-none"
                      value={paymentFormData.caseId}
                      onChange={(e) => setPaymentFormData({ ...paymentFormData, caseId: e.target.value })}
                    >
                      <option value="">اختر القضية من القائمة...</option>
                      {finances
                        .filter(f => {
                          const c = cases.find(caseItem => caseItem.id === f.caseId);
                          const search = paymentCaseSearch.toLowerCase();
                          return !paymentCaseSearch || 
                                 c?.caseNumber?.toLowerCase().includes(search) || 
                                 c?.clientName?.toLowerCase().includes(search);
                        })
                        .map(f => {
                          const c = cases.find(caseItem => caseItem.id === f.caseId);
                          return <option key={f.id} value={f.caseId}>{c?.caseNumber} - {c?.clientName} (متبقي: {f.totalFees - f.receivedAmount} د.ك)</option>
                        })}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-8">
                  <div className="space-y-3">
                    <label className="text-sm font-black text-slate-700 mr-2">المبلغ المودع</label>
                    <input
                      type="number"
                      required
                      placeholder="0.00"
                      className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 text-3xl font-black text-emerald-600 focus:ring-4 focus:ring-emerald-100 focus:border-emerald-600 transition-all outline-none"
                      value={paymentFormData.amount || ''}
                      onChange={(e) => setPaymentFormData({ ...paymentFormData, amount: Number(e.target.value) })}
                    />
                  </div>
                  <div className="space-y-3">
                    <label className="text-sm font-black text-slate-700 mr-2">تاريخ القبض</label>
                    <input
                      type="date"
                      required
                      className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 text-lg font-bold"
                      value={paymentFormData.date}
                      onChange={(e) => setPaymentFormData({ ...paymentFormData, date: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-sm font-black text-slate-700 mr-2">طريقة الدفع</label>
                  <div className="grid grid-cols-4 gap-4">
                    {[
                      { id: 'cash', label: 'نقدي', icon: DollarSign },
                      { id: 'transfer', label: 'تحويل', icon: Landmark },
                      { id: 'knet', label: 'K-Net', icon: CreditCard },
                      { id: 'check', label: 'شيك', icon: FileText },
                    ].map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setPaymentFormData({...paymentFormData, type: m.id as any})}
                        className={cn(
                          "flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all font-black text-xs",
                          paymentFormData.type === m.id ? "bg-emerald-50 border-emerald-500 text-emerald-700" : "bg-white border-slate-100 text-slate-400 hover:border-slate-200"
                        )}
                      >
                        <m.icon className="w-5 h-5" />
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-sm font-black text-slate-700 mr-2">ملاحظات السند / رقم المرجع</label>
                  <textarea
                    rows={2}
                    placeholder="مثلاً: رقم التحويل البنكي أو ملاحظة إضافية..."
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 text-sm font-bold focus:ring-4 focus:ring-emerald-100 focus:border-emerald-600 transition-all outline-none resize-none"
                    value={paymentFormData.note}
                    onChange={(e) => setPaymentFormData({ ...paymentFormData, note: e.target.value })}
                  />
                </div>

                <button type="submit" className="w-full bg-emerald-600 text-white font-black py-5 rounded-[24px] shadow-xl shadow-emerald-100 hover:bg-emerald-700 transition-all flex items-center justify-center gap-3 text-lg">
                  <Check className="w-6 h-6" />
                  توثيق العملية وإصدار السند
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Expense Modal */}
      <AnimatePresence>
        {isExpenseModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsExpenseModalOpen(false)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative bg-white w-full max-w-xl rounded-[40px] shadow-2xl overflow-hidden border border-white/20">
              <div className="p-10 border-b border-slate-100 bg-rose-50/50 flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-black text-slate-900 leading-none">تسجيل مصروف</h2>
                  <p className="text-rose-600 font-bold mt-2">متابعة التكاليف والمصروفات</p>
                </div>
                <button onClick={() => setIsExpenseModalOpen(false)} className="p-3 hover:bg-white rounded-2xl transition-all">
                  <X className="w-6 h-6 text-slate-400" />
                </button>
              </div>
              <form onSubmit={handleExpenseSubmit} className="p-10 space-y-8">
                <div className="grid grid-cols-2 gap-8">
                  <div className="space-y-3">
                    <label className="text-sm font-black text-slate-700 mr-2">المبلغ المصروف</label>
                    <input
                      type="number"
                      required
                      className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 text-3xl font-black text-rose-600 focus:ring-4 focus:ring-rose-100 focus:border-rose-600 transition-all outline-none"
                      value={expenseFormData.amount || ''}
                      onChange={(e) => setExpenseFormData({ ...expenseFormData, amount: Number(e.target.value) })}
                    />
                  </div>
                  <div className="space-y-3">
                    <label className="text-sm font-black text-slate-700 mr-2">التاريخ</label>
                    <input
                      type="date"
                      required
                      className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 text-lg font-bold"
                      value={expenseFormData.date}
                      onChange={(e) => setExpenseFormData({ ...expenseFormData, date: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-sm font-black text-slate-700 mr-2">تصنيف المصروف</label>
                  <select
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 text-lg font-bold focus:ring-4 focus:ring-rose-100 focus:border-rose-600 transition-all outline-none"
                    value={expenseFormData.category}
                    onChange={(e) => setExpenseFormData({...expenseFormData, category: e.target.value})}
                  >
                    <option value="court_fees">رسوم قضائية</option>
                    <option value="expert_fees">أتعاب خبراء</option>
                    <option value="printing">طباعة وتصوير</option>
                    <option value="transport">انتقالات</option>
                    <option value="other">نثريات متنوعة</option>
                  </select>
                </div>

                <div className="space-y-4">
                  <div className="space-y-3">
                    <label className="text-sm font-black text-slate-700 mr-2">البحث عن قضية مرتبطة (اختياري)</label>
                    <div className="relative">
                      <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                      <input
                        type="text"
                        placeholder="ابحث بالرقم أو اسم الموكل..."
                        className="w-full bg-white border-2 border-slate-100 rounded-2xl pr-12 pl-4 py-4 text-sm font-bold focus:border-rose-600 transition-all outline-none"
                        value={expenseCaseSearch}
                        onChange={(e) => setExpenseCaseSearch(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="space-y-3">
                    <label className="text-sm font-black text-slate-700 mr-2">اختيار ملف القضية</label>
                    <select
                      className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 text-lg font-bold focus:ring-4 focus:ring-rose-100 focus:border-rose-600 transition-all outline-none"
                      value={expenseFormData.caseId}
                      onChange={(e) => setExpenseFormData({ ...expenseFormData, caseId: e.target.value })}
                    >
                      <option value="">بيان عام (غير مرتبط بقضية)</option>
                      {cases
                        .filter(c => {
                          const search = expenseCaseSearch.toLowerCase();
                          return !expenseCaseSearch || 
                                 c?.caseNumber?.toLowerCase().includes(search) || 
                                 c?.clientName?.toLowerCase().includes(search);
                        })
                        .map(c => (
                          <option key={c.id} value={c.id}>{c.caseNumber} - {c.clientName}</option>
                        ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-sm font-black text-slate-700 mr-2">البيان (وصف المصروف)</label>
                  <textarea
                    rows={2}
                    required
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 text-sm font-bold focus:ring-4 focus:ring-rose-100 focus:border-rose-600 transition-all outline-none resize-none"
                    value={expenseFormData.description}
                    onChange={(e) => setExpenseFormData({ ...expenseFormData, description: e.target.value })}
                  />
                </div>

                <button type="submit" className="w-full bg-rose-600 text-white font-black py-5 rounded-[24px] shadow-xl shadow-rose-100 hover:bg-rose-700 transition-all flex items-center justify-center gap-3 text-lg">
                  <Check className="w-6 h-6" />
                  تسجيل المصروف في الحسابات
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Receipt Modal (Printable) */}
      <AnimatePresence>
        {isReceiptModalOpen && selectedReceipt && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsReceiptModalOpen(false)} className="absolute inset-0 bg-slate-900/80 backdrop-blur-md" />
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-white rounded-[40px] shadow-2xl">
              <div className="sticky top-0 z-10 p-6 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <button 
                    onClick={handlePrintReceipt}
                    className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-xl font-black text-sm hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
                  >
                    <Printer className="w-5 h-5" />
                    تحميل بصيغة PDF
                  </button>
                </div>
                <button onClick={() => setIsReceiptModalOpen(false)} className="p-3 hover:bg-white rounded-2xl transition-all">
                  <X className="w-6 h-6 text-slate-400" />
                </button>
              </div>

              <div ref={receiptRef} className="p-16 bg-white relative overflow-hidden text-right" dir="rtl" style={{ minHeight: '800px', fontFamily: 'Inter, sans-serif' }}>
                {/* Branding Border */}
                <div className="absolute top-10 right-10 left-10 bottom-10 border-[6px] border-slate-900/5 pointer-events-none" />
                <div className="absolute top-14 right-14 left-14 bottom-14 border-[1px] border-slate-900/10 pointer-events-none" />
                
                <div className="flex justify-between items-start mb-20 relative">
                  <div className="text-right">
                    <h2 className="text-4xl font-black text-slate-900 mb-2">{systemSettings?.officeName || 'مكتب المحامي محمد امين علي الصايغ'}</h2>
                    <p className="text-xl font-bold text-indigo-600">{systemSettings?.officeDescription || 'للمحاماة والاستشارات القانونية والتحكيم'}</p>
                    <div className="mt-6 text-sm font-bold text-slate-500 space-y-1">
                      <p>هاتف: {systemSettings?.officePhone}</p>
                      <p>العنوان: {systemSettings?.officeAddress}</p>
                    </div>
                  </div>
                  <div className="text-center flex flex-col items-center">
                    <div className="w-24 h-24 bg-slate-900 rounded-[30px] flex items-center justify-center mb-4">
                      <Scale className="w-12 h-12 text-white" />
                    </div>
                    <div className="bg-slate-900 text-white px-6 py-2 rounded-full font-black text-xs tracking-widest uppercase">RECEIPT</div>
                  </div>
                </div>

                <div className="text-center mb-20 relative">
                  <div className="inline-block relative">
                    <h1 className="text-6xl font-black text-slate-900 relative z-10 px-10">سند قبـض مـالي</h1>
                    <div className="absolute bottom-2 left-0 right-0 h-4 bg-indigo-100 -z-0" />
                  </div>
                  <div className="mt-10 flex justify-center gap-20">
                    <div className="text-center">
                      <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">رقم السند</p>
                      <p className="text-2xl font-mono font-black text-slate-900">RC-{selectedReceipt.id.slice(-8).toUpperCase()}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">تاريخ الإصدار</p>
                      <p className="text-2xl font-black text-slate-900">{format(new Date(selectedReceipt.date), 'dd MMMM yyyy', { locale: arSA })}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-12 mb-24 relative">
                  <div className="flex items-baseline gap-6 border-b-2 border-slate-100 pb-4">
                    <span className="text-xl font-black text-slate-400 whitespace-nowrap">استلمنا من السيد /</span>
                    <span className="text-4xl font-black text-slate-900 flex-1 underline decoration-dotted decoration-slate-200 underline-offset-8">
                      {cases.find(c => c.id === selectedReceipt.caseId)?.clientName || '---'}
                    </span>
                  </div>

                  <div className="flex items-baseline gap-6 border-b-2 border-slate-100 pb-4">
                    <span className="text-xl font-black text-slate-400 whitespace-nowrap">مبلغاً وقدره /</span>
                    <span className="text-4xl font-black text-emerald-600 flex-1 underline decoration-dotted decoration-slate-200 underline-offset-8">
                      {selectedReceipt.amount.toLocaleString()} د.ك (فقط لا غير)
                    </span>
                  </div>

                  <div className="flex items-baseline gap-6 border-b-2 border-slate-100 pb-4">
                    <span className="text-xl font-black text-slate-400 whitespace-nowrap">وذلك عن /</span>
                    <span className="text-2xl font-bold text-slate-700 flex-1">
                      أتعاب عن القضية رقم: {cases.find(c => c.id === selectedReceipt.caseId)?.caseNumber || '---'} {selectedReceipt.note && `- ${selectedReceipt.note}`}
                    </span>
                  </div>

                  <div className="flex items-baseline gap-6 border-b-2 border-slate-100 pb-4">
                    <span className="text-xl font-black text-slate-400 whitespace-nowrap">طريقة الدفع /</span>
                    <span className="text-2xl font-black text-indigo-600 flex-1">
                      {selectedReceipt.type === 'cash' ? 'نقدي' : selectedReceipt.type === 'transfer' ? 'تحويل بنكي' : selectedReceipt.type === 'knet' ? 'K-Net' : 'شيك'}
                      {selectedReceipt.reference && ` (رقم المرجع: ${selectedReceipt.reference})`}
                    </span>
                  </div>
                </div>

                <div className="flex justify-between items-end mt-32 relative">
                  <div className="text-center w-64 pt-10 border-t-2 border-slate-900">
                    <p className="font-black text-xl text-slate-900">توقيع المستلم</p>
                    <p className="text-sm font-bold text-slate-400 mt-2">{selectedReceipt.receivedBy}</p>
                  </div>
                  <div className="text-center">
                    <div className="w-32 h-32 border-4 border-slate-100 rounded-full flex items-center justify-center opacity-20 transform -rotate-12">
                      <p className="text-[10px] font-black">OFFICE SEAL</p>
                    </div>
                  </div>
                  <div className="text-center w-64 pt-10 border-t-2 border-slate-900">
                    <p className="font-black text-xl text-slate-900">إمضاء الموكل</p>
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
