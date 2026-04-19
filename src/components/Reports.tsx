import React, { useState, useEffect, useRef } from 'react';
import { collection, onSnapshot, query, orderBy, where, getDoc, doc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { FileText, Download, Printer, Filter, Calendar, Briefcase, Users, TrendingUp, CheckCircle2, AlertCircle, Search, X, Scale } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Case, Client, Session, Finance, UserProfile, SystemSettings } from '../types';
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
  const [sessions, setSessions] = useState<Session[]>([]);
  const [finances, setFinances] = useState<Finance[]>([]);
  const [systemSettings, setSystemSettings] = useState<SystemSettings | null>(null);
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
      const fetchedCases = snapshot.docs.map(doc => {
        const data = doc.data();
        try {
          if (data.createdAt) {
            const d = parseISO(data.createdAt);
            if (isNaN(d.getTime())) throw new Error('Invalid createdAt');
          }
        } catch (e) {
          console.error('Reports: Error parsing case date:', doc.id, e);
        }
        return { id: doc.id, ...data } as Case;
      });
      setCases(fetchedCases);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'cases');
    });
    const unsubClients = onSnapshot(collection(db, 'clients'), (snapshot) => {
      setClients(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client)));
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'clients');
    });
    const unsubSessions = onSnapshot(collection(db, 'sessions'), (snapshot) => {
      setSessions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Session)));
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'sessions');
    });
    const unsubFinance = onSnapshot(collection(db, 'finance'), (snapshot) => {
      const fetchedFinance = snapshot.docs.map(doc => {
        const data = doc.data();
        try {
          if (data.date) {
            const d = parseISO(data.date);
            if (isNaN(d.getTime())) throw new Error('Invalid finance date');
          }
        } catch (e) {
          console.error('Reports: Error parsing finance date:', doc.id, e);
        }
        return { id: doc.id, ...data } as Finance;
      });
      setFinances(fetchedFinance);
      setLoading(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'finance');
      setLoading(false);
    });

    // Load System Settings
    const loadSettings = async () => {
      try {
        const settingsSnap = await getDoc(doc(db, 'settings', 'global'));
        if (settingsSnap.exists()) {
          setSystemSettings(settingsSnap.data() as SystemSettings);
        }
      } catch (err) {
        console.error('Error loading settings:', err);
      }
    };
    loadSettings();

    return () => {
      unsubCases();
      unsubClients();
      unsubSessions();
      unsubFinance();
    };
  }, []);

  const handlePrint = () => {
    const style = document.createElement('style');
    style.innerHTML = `
      @media print {
        body { background: white !important; }
        .print-hidden { display: none !important; }
        .report-container { border: none !important; box-shadow: none !important; padding: 0 !important; }
        table { width: 100% !important; border-collapse: collapse !important; }
        th, td { border: 1px solid #e2e8f0 !important; padding: 12px !important; }
        th { background-color: #f8fafc !important; }
      }
    `;
    document.head.appendChild(style);
    window.print();
    document.head.removeChild(style);
  };

  const handleExportPDF = async () => {
    if (!reportRef.current) return;
    setIsExporting(true);
    try {
      // Temporarily fix oklch colors for html2canvas
      const style = document.createElement('style');
      style.innerHTML = `
        * {
          --tw-ring-color: rgba(59, 130, 246, 0.5) !important;
          --tw-ring-offset-shadow: 0 0 #0000 !important;
          --tw-ring-shadow: 0 0 #0000 !important;
          --tw-shadow: 0 0 #0000 !important;
          --tw-shadow-colored: 0 0 #0000 !important;
        }
      `;
      document.head.appendChild(style);

      const canvas = await html2canvas(reportRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        onclone: (clonedDoc) => {
          // Add a style tag to fix Arabic character fragmentation
          const style = clonedDoc.createElement('style');
          style.innerHTML = `
            * {
              letter-spacing: normal !important;
              letter-spacing: 0 !important;
              text-rendering: auto !important;
              -webkit-font-feature-settings: "kern" 1, "liga" 1, "clig" 1, "calt" 1 !important;
              font-feature-settings: "kern" 1, "liga" 1, "clig" 1, "calt" 1 !important;
            }
          `;
          clonedDoc.head.appendChild(style);

          const el = clonedDoc.getElementById('report-content');
          if (el) {
            el.style.padding = '40px';
            el.style.borderRadius = '0';
            el.style.border = 'none';
          }
        }
      });

      document.head.removeChild(style);

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
      let itemDate: Date | null = null;
      if (item.createdAt) {
        try {
          itemDate = parseISO(item.createdAt);
          if (isNaN(itemDate.getTime())) {
            console.warn('Reports: Invalid date string encountered:', item.createdAt);
            itemDate = null;
          }
        } catch (e) {
          console.error('Reports: Error parsing date:', item.createdAt, e);
          itemDate = null;
        }
      }

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

  const filteredCases = filterData(cases.map(c => {
    const caseSessions = sessions.filter(s => s.caseId === c.id).sort((a, b) => b.date.localeCompare(a.date));
    const lastSession = caseSessions[0];
    return { ...c, lastDecision: lastSession?.decision || '---' };
  }));
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
      <div ref={reportRef} id="report-content" className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm print:shadow-none print:border-none report-container">
        {/* Report Header (Visible in Print) */}
        <div className="hidden print:flex items-center justify-between mb-12 border-b-4 border-slate-900 pb-8">
          <div className="flex items-center gap-6">
            <div className="p-4 bg-slate-900 rounded-2xl shadow-lg">
              <Scale className="w-10 h-10 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-black text-slate-900 tracking-tighter">{systemSettings?.officeName.split(' ')[0] || 'الأمين'}</h1>
              <p className="text-sm font-bold text-slate-500">{systemSettings?.officeName || 'مكتب المحامي محمد امين علي الصايغ'}</p>
              <p className="text-[10px] font-bold text-slate-400 mt-1">{systemSettings?.officeDescription || 'نظام إدارة المكاتب القانونية الذكي'}</p>
            </div>
          </div>
          <div className="text-left">
            <h2 className="text-2xl font-black text-slate-900 mb-1">تقرير {reportType === 'cases' ? 'القضايا' : reportType === 'finance' ? 'المالية' : 'الموكلين'}</h2>
            <div className="flex flex-col items-end gap-1">
              <span className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-lg">رقم التقرير: {Math.floor(Math.random() * 1000000)}</span>
              <span className="text-xs font-bold text-slate-500">تاريخ الإصدار: {format(new Date(), 'yyyy/MM/dd')}</span>
              <span className="text-xs font-bold text-slate-500">وقت الإصدار: {format(new Date(), 'hh:mm a')}</span>
            </div>
          </div>
        </div>

        {/* Summary Stats for Print */}
        <div className="hidden print:grid grid-cols-4 gap-4 mb-8">
          <div className="p-4 border-2 border-slate-100 rounded-2xl text-center">
            <p className="text-[10px] font-black text-slate-400 uppercase mb-1">إجمالي السجلات</p>
            <p className="text-xl font-black text-slate-900">
              {reportType === 'cases' ? filteredCases.length : reportType === 'finance' ? filteredFinances.length : filteredClients.length}
            </p>
          </div>
          {reportType === 'cases' && (
            <>
              <div className="p-4 border-2 border-slate-100 rounded-2xl text-center">
                <p className="text-[10px] font-black text-slate-400 uppercase mb-1">متداولة</p>
                <p className="text-xl font-black text-indigo-600">{filteredCases.filter(c => c.status === 'active').length}</p>
              </div>
              <div className="p-4 border-2 border-slate-100 rounded-2xl text-center">
                <p className="text-[10px] font-black text-slate-400 uppercase mb-1">منتهية</p>
                <p className="text-xl font-black text-emerald-600">{filteredCases.filter(c => c.status === 'archive').length}</p>
              </div>
            </>
          )}
          {reportType === 'finance' && (
            <>
              <div className="p-4 border-2 border-slate-100 rounded-2xl text-center">
                <p className="text-[10px] font-black text-slate-400 uppercase mb-1">إجمالي الأتعاب</p>
                <p className="text-xl font-black text-indigo-600">{filteredFinances.reduce((a, b) => a + b.totalFees, 0).toLocaleString()}</p>
              </div>
              <div className="p-4 border-2 border-slate-100 rounded-2xl text-center">
                <p className="text-[10px] font-black text-slate-400 uppercase mb-1">المحصل</p>
                <p className="text-xl font-black text-emerald-600">{filteredFinances.reduce((a, b) => a + b.receivedAmount, 0).toLocaleString()}</p>
              </div>
            </>
          )}
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
                  <th className="py-4 font-black text-slate-900 text-lg text-right">رقم القضية</th>
                  <th className="py-4 font-black text-slate-900 text-lg text-right">الموكل</th>
                  <th className="py-4 font-black text-slate-900 text-lg text-right">المحكمة</th>
                  <th className="py-4 font-black text-slate-900 text-lg text-right">قرار آخر جلسة</th>
                  <th className="py-4 font-black text-slate-900 text-lg text-right">الحالة</th>
                  <th className="py-4 font-black text-slate-900 text-lg text-right">التاريخ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredCases.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-4 font-black text-slate-900 text-2xl">{c.caseNumber || '---'}</td>
                    <td className="py-4 text-slate-800 font-extrabold text-xl">{c.clientName}</td>
                    <td className="py-4 text-slate-700 font-bold text-lg">{c.court || '---'}</td>
                    <td className="py-4 text-slate-600 font-bold text-lg">{(c as any).lastDecision}</td>
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
                  <th className="py-4 font-black text-slate-900 text-lg text-right">القضية</th>
                  <th className="py-4 font-black text-slate-900 text-lg text-right">إجمالي الأتعاب</th>
                  <th className="py-4 font-black text-slate-900 text-lg text-right">المستلم</th>
                  <th className="py-4 font-black text-slate-900 text-lg text-right">المتبقي</th>
                  <th className="py-4 font-black text-slate-900 text-lg text-right">المصروفات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredFinances.map((f) => {
                  return (
                    <tr key={f.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-4 font-black text-slate-900 text-2xl">{f.caseNumber || '---'}</td>
                      <td className="py-4 text-slate-700 font-bold text-lg">{f.totalFees.toLocaleString()} د.ك</td>
                      <td className="py-4 text-emerald-600 font-bold text-lg">{f.receivedAmount.toLocaleString()} د.ك</td>
                      <td className="py-4 text-red-600 font-bold text-lg">{(f.totalFees - f.receivedAmount).toLocaleString()} د.ك</td>
                      <td className="py-4 text-slate-700 font-bold text-lg">{(f.expenses + f.sundries).toLocaleString()} د.ك</td>
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
                  <th className="py-4 font-black text-slate-900 text-lg text-right">الاسم</th>
                  <th className="py-4 font-black text-slate-900 text-lg text-right">الهاتف</th>
                  <th className="py-4 font-black text-slate-900 text-lg text-right">الرقم المدني</th>
                  <th className="py-4 font-black text-slate-900 text-lg text-right">عدد القضايا</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredClients.map((client) => (
                  <tr key={client.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-4 font-black text-slate-900 text-2xl">{client.name}</td>
                    <td className="py-4 text-slate-700 font-bold text-lg">{client.phone}</td>
                    <td className="py-4 text-slate-700 font-bold text-lg">{client.civilId || '---'}</td>
                    <td className="py-4 font-black text-indigo-600 text-xl">
                      {cases.filter(c => c.clientId === client.id).length}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Report Footer (Visible in Print) */}
        <div className="hidden print:grid grid-cols-2 gap-12 mt-20 pt-12 border-t-2 border-slate-100">
          <div className="text-center space-y-8">
            <p className="font-black text-slate-900">توقيع المسؤول</p>
            <div className="w-48 h-24 border-2 border-dashed border-slate-200 rounded-2xl mx-auto flex items-center justify-center text-[10px] text-slate-300 font-bold">
              التوقيع هنا
            </div>
            <p className="text-xs font-bold text-slate-500">................................................</p>
          </div>
          <div className="text-center space-y-8">
            <p className="font-black text-slate-900">ختم المكتب</p>
            <div className="w-32 h-32 border-4 border-double border-slate-100 rounded-full mx-auto flex items-center justify-center text-[10px] text-slate-200 font-black uppercase rotate-12">
              ختم المكتب الرسمي
            </div>
          </div>
        </div>

        <div className="hidden print:block mt-12 text-center">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            هذا التقرير سري وخاص بـ {systemSettings?.officeName || 'مكتب المحامي محمد امين علي الصايغ'} © {new Date().getFullYear()}
          </p>
          <p className="text-[8px] font-bold text-slate-300 mt-1">تم الإنشاء بواسطة نظام الأمين الذكي</p>
        </div>
      </div>
    </div>
  );
}
