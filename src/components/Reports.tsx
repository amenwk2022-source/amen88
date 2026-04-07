import React, { useState, useEffect, useRef } from 'react';
import { collection, onSnapshot, query, orderBy, where } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { FileText, Download, Printer, Filter, Calendar, Briefcase, Users, TrendingUp, CheckCircle2, AlertCircle, Search, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Case, Client, Session, Finance, UserProfile } from '../types';
import { cn } from '../lib/utils';
import { format, isWithinInterval, parseISO, startOfDay, endOfDay } from 'date-fns';
import { arSA } from 'date-fns/locale';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

interface ReportsProps {
  user: UserProfile;
}

export default function Reports({ user }: ReportsProps) {
  const [cases, setCases] = useState<Case[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [finances, setFinances] = useState<Finance[]>([]);
  const [loading, setLoading] = useState(true);
  const [reportType, setReportType] = useState<'cases' | 'finance' | 'clients'>('cases');
  const [isExporting, setIsExporting] = useState(false);
  
  // Filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user.role === 'client') return;

    const unsubCases = onSnapshot(collection(db, 'cases'), (snapshot) => {
      setCases(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Case)));
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'cases');
    });
    const unsubClients = onSnapshot(collection(db, 'clients'), (snapshot) => {
      setClients(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client)));
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'clients');
    });
    const unsubFinance = onSnapshot(collection(db, 'finance'), (snapshot) => {
      setFinances(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Finance)));
      setLoading(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'finance');
      setLoading(false);
    });

    return () => {
      unsubCases();
      unsubClients();
      unsubFinance();
    };
  }, []);

  const handlePrint = () => {
    window.print();
  };

  const handleExportPDF = async () => {
    if (!reportRef.current) return;
    setIsExporting(true);
    try {
      const canvas = await html2canvas(reportRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`LoyerOS_Report_${reportType}_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    } catch (err) {
      console.error('PDF Export Error:', err);
    } finally {
      setIsExporting(false);
    }
  };

  const filterData = (data: any[]) => {
    return data.filter(item => {
      const itemDate = item.createdAt ? parseISO(item.createdAt) : null;
      const matchesDate = (!startDate || !itemDate || itemDate >= startOfDay(parseISO(startDate))) &&
                          (!endDate || !itemDate || itemDate <= endOfDay(parseISO(endDate)));
      
      const searchStr = searchQuery.toLowerCase();
      const matchesSearch = !searchQuery || 
                           (item.caseNumber?.toLowerCase().includes(searchStr)) ||
                           (item.clientName?.toLowerCase().includes(searchStr)) ||
                           (item.name?.toLowerCase().includes(searchStr)) ||
                           (item.phone?.toLowerCase().includes(searchStr));

      return matchesDate && matchesSearch;
    });
  };

  const filteredCases = filterData(cases);
  const filteredFinances = filterData(finances.map(f => {
    const c = cases.find(caseItem => caseItem.id === f.caseId);
    return { ...f, createdAt: c?.createdAt, clientName: c?.clientName, caseNumber: c?.caseNumber };
  }));
  const filteredClients = filterData(clients.map(c => ({ ...c, createdAt: new Date().toISOString() }))); // Clients don't have createdAt yet, using fallback

  return (
    <div className="space-y-8 rtl print:p-0" dir="rtl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-black text-slate-900 mb-1">التقارير والإحصائيات</h1>
          <p className="text-slate-500 font-medium">إصدار تقارير حالة القضايا والتدفق المالي للمكتب.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-all border shadow-sm",
              showFilters ? "bg-indigo-50 border-indigo-200 text-indigo-600" : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
            )}
          >
            <Filter className="w-4 h-4" />
            تصفية
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-xl font-bold text-sm hover:bg-slate-50 transition-all shadow-sm"
          >
            <Printer className="w-4 h-4" />
            طباعة
          </button>
          <button 
            onClick={handleExportPDF}
            disabled={isExporting}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl font-bold text-sm hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 disabled:opacity-50"
          >
            {isExporting ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            تصدير PDF
          </button>
        </div>
      </div>

      {/* Filters Panel */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden print:hidden"
          >
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-500 uppercase">بحث</label>
                <div className="relative">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="رقم القضية، الموكل..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-10 pl-4 py-2 text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-600 transition-all"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-500 uppercase">من تاريخ</label>
                <input
                  type="date"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-600 transition-all"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-500 uppercase">إلى تاريخ</label>
                <input
                  type="date"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-600 transition-all"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
              {(startDate || endDate || searchQuery) && (
                <div className="md:col-span-3 flex justify-end">
                  <button
                    onClick={() => {
                      setStartDate('');
                      setEndDate('');
                      setSearchQuery('');
                    }}
                    className="text-xs font-black text-red-600 flex items-center gap-1 hover:underline"
                  >
                    <X className="w-3 h-3" />
                    مسح التصفية
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Report Type Selector */}
      <div className="flex items-center gap-4 border-b border-slate-200 print:hidden">
        {[
          { id: 'cases', label: 'تقرير القضايا', icon: Briefcase },
          { id: 'finance', label: 'تقرير المالية', icon: TrendingUp },
          { id: 'clients', label: 'تقرير الموكلين', icon: Users },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = reportType === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setReportType(tab.id as any)}
              className={cn(
                "flex items-center gap-2 px-6 py-4 font-bold text-sm transition-all border-b-2 -mb-px",
                isActive ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-500 hover:text-slate-900"
              )}
            >
              <Icon className="w-5 h-5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Report Content */}
      <div ref={reportRef} className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm print:shadow-none print:border-none">
        {/* Report Header (Visible in Print) */}
        <div className="hidden print:flex items-center justify-between mb-12 border-b-2 border-slate-900 pb-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-slate-900 rounded-xl">
              <FileText className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900">Loyer OS</h1>
              <p className="text-sm font-bold text-slate-500">نظام إدارة المكاتب القانونية</p>
            </div>
          </div>
          <div className="text-left">
            <h2 className="text-xl font-black text-slate-900">تقرير حالة {reportType === 'cases' ? 'القضايا' : reportType === 'finance' ? 'المالية' : 'الموكلين'}</h2>
            <p className="text-sm font-bold text-slate-500">تاريخ الإصدار: {format(new Date(), 'yyyy/MM/dd')}</p>
          </div>
        </div>

        {reportType === 'cases' && (
          <div className="space-y-8">
            <div className="grid grid-cols-3 gap-6">
              <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 text-center">
                <p className="text-slate-500 text-xs font-bold mb-1 uppercase tracking-widest">إجمالي القضايا</p>
                <h3 className="text-3xl font-black text-slate-900">{filteredCases.length}</h3>
              </div>
              <div className="p-6 bg-indigo-50 rounded-2xl border border-indigo-100 text-center">
                <p className="text-indigo-600 text-xs font-bold mb-1 uppercase tracking-widest">قضايا متداولة</p>
                <h3 className="text-3xl font-black text-indigo-900">{filteredCases.filter(c => c.status === 'active').length}</h3>
              </div>
              <div className="p-6 bg-emerald-50 rounded-2xl border border-emerald-100 text-center">
                <p className="text-emerald-600 text-xs font-bold mb-1 uppercase tracking-widest">قضايا منتهية</p>
                <h3 className="text-3xl font-black text-emerald-900">{filteredCases.filter(c => c.status === 'archive').length}</h3>
              </div>
            </div>

            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="border-b-2 border-slate-100">
                  <th className="py-4 font-black text-slate-900">رقم القضية</th>
                  <th className="py-4 font-black text-slate-900">الموكل</th>
                  <th className="py-4 font-black text-slate-900">المحكمة</th>
                  <th className="py-4 font-black text-slate-900">الحالة</th>
                  <th className="py-4 font-black text-slate-900">التاريخ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredCases.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-4 font-bold text-slate-900">{c.caseNumber || '---'}</td>
                    <td className="py-4 text-slate-600 font-medium">{c.clientName}</td>
                    <td className="py-4 text-slate-600 font-medium">{c.court || '---'}</td>
                    <td className="py-4">
                      <span className={cn(
                        "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
                        c.status === 'active' ? "bg-indigo-100 text-indigo-600" :
                        c.status === 'archive' ? "bg-emerald-100 text-emerald-600" :
                        "bg-slate-100 text-slate-600"
                      )}>
                        {c.status}
                      </span>
                    </td>
                    <td className="py-4 text-slate-400 text-xs font-bold">{c.createdAt ? format(new Date(c.createdAt), 'yyyy/MM/dd') : '---'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {reportType === 'finance' && (
          <div className="space-y-8">
            <div className="grid grid-cols-3 gap-6">
              <div className="p-6 bg-indigo-50 rounded-2xl border border-indigo-100 text-center">
                <p className="text-indigo-600 text-xs font-bold mb-1 uppercase tracking-widest">إجمالي الأتعاب</p>
                <h3 className="text-3xl font-black text-indigo-900">{filteredFinances.reduce((a, b) => a + b.totalFees, 0).toLocaleString()} د.ك</h3>
              </div>
              <div className="p-6 bg-emerald-50 rounded-2xl border border-emerald-100 text-center">
                <p className="text-emerald-600 text-xs font-bold mb-1 uppercase tracking-widest">المبالغ المستلمة</p>
                <h3 className="text-3xl font-black text-emerald-900">{filteredFinances.reduce((a, b) => a + b.receivedAmount, 0).toLocaleString()} د.ك</h3>
              </div>
              <div className="p-6 bg-red-50 rounded-2xl border border-red-100 text-center">
                <p className="text-red-600 text-xs font-bold mb-1 uppercase tracking-widest">المصروفات</p>
                <h3 className="text-3xl font-black text-red-900">{filteredFinances.reduce((a, b) => a + b.expenses + b.sundries, 0).toLocaleString()} د.ك</h3>
              </div>
            </div>

            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="border-b-2 border-slate-100">
                  <th className="py-4 font-black text-slate-900">القضية</th>
                  <th className="py-4 font-black text-slate-900">إجمالي الأتعاب</th>
                  <th className="py-4 font-black text-slate-900">المستلم</th>
                  <th className="py-4 font-black text-slate-900">المتبقي</th>
                  <th className="py-4 font-black text-slate-900">المصروفات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredFinances.map((f) => {
                  return (
                    <tr key={f.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-4 font-bold text-slate-900">{f.caseNumber || '---'}</td>
                      <td className="py-4 text-slate-600 font-medium">{f.totalFees.toLocaleString()} د.ك</td>
                      <td className="py-4 text-emerald-600 font-bold">{f.receivedAmount.toLocaleString()} د.ك</td>
                      <td className="py-4 text-red-600 font-bold">{(f.totalFees - f.receivedAmount).toLocaleString()} د.ك</td>
                      <td className="py-4 text-slate-600 font-medium">{(f.expenses + f.sundries).toLocaleString()} د.ك</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {reportType === 'clients' && (
          <div className="space-y-8">
            <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 text-center max-w-xs mx-auto">
              <p className="text-slate-500 text-xs font-bold mb-1 uppercase tracking-widest">إجمالي الموكلين</p>
              <h3 className="text-3xl font-black text-slate-900">{filteredClients.length}</h3>
            </div>

            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="border-b-2 border-slate-100">
                  <th className="py-4 font-black text-slate-900">الاسم</th>
                  <th className="py-4 font-black text-slate-900">الهاتف</th>
                  <th className="py-4 font-black text-slate-900">الرقم المدني</th>
                  <th className="py-4 font-black text-slate-900">عدد القضايا</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredClients.map((client) => (
                  <tr key={client.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-4 font-bold text-slate-900">{client.name}</td>
                    <td className="py-4 text-slate-600 font-medium">{client.phone}</td>
                    <td className="py-4 text-slate-600 font-medium">{client.civilId || '---'}</td>
                    <td className="py-4 font-black text-indigo-600">
                      {cases.filter(c => c.clientId === client.id).length}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Report Footer (Visible in Print) */}
        <div className="hidden print:block mt-12 pt-6 border-t border-slate-200 text-center text-xs text-slate-400 font-bold">
          هذا التقرير تم إنشاؤه آلياً بواسطة نظام Loyer OS لإدارة المكاتب القانونية.
        </div>
      </div>
    </div>
  );
}
