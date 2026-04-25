import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, limit, orderBy, onSnapshot } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useNavigate } from 'react-router-dom';
import {
  Briefcase,
  Users,
  CalendarClock,
  TrendingUp,
  AlertCircle,
  ArrowUpRight,
  ArrowDownRight,
  Scale,
  Clock,
  CheckCircle2,
  FileText,
  Gavel,
  Bell,
  MessageSquare,
  Printer,
  AlertTriangle,
  Zap,
  Activity,
  ClipboardList,
  ChevronLeft
} from 'lucide-react';
import { motion } from 'motion/react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { cn } from '../lib/utils';
import { Case, Session, ExpertSession, Judgment, AppNotification, UserProfile, ConsultationRequest } from '../types';
import { format, parseISO, differenceInDays } from 'date-fns';
import { arSA } from 'date-fns/locale';
import ClientPortal from './ClientPortal';

const COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444'];

interface DashboardProps {
  user: UserProfile;
}

export default function Dashboard({ user }: DashboardProps) {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalCases: 0,
    activeCases: 0,
    wonCases: 0,
    totalClients: 0,
    expertSessions: 0,
    totalRevenue: 0,
    pendingPayments: 0,
  });
  const [chartData, setChartData] = useState<{ name: string; cases: number }[]>([]);
  const [pieData, setPieData] = useState<{ name: string; value: number }[]>([]);
  const [upcomingSessions, setUpcomingSessions] = useState<Session[]>([]);
  const [upcomingExpertSessions, setUpcomingExpertSessions] = useState<ExpertSession[]>([]);
  const [activeDeadlines, setActiveDeadlines] = useState<Judgment[]>([]);
  const [recentNotifications, setRecentNotifications] = useState<AppNotification[]>([]);
  const [cases, setCases] = useState<Case[]>([]);
  const [allSessions, setAllSessions] = useState<Session[]>([]);
  const [allExpertSessions, setAllExpertSessions] = useState<ExpertSession[]>([]);
  const [omittedSessions, setOmittedSessions] = useState<(Session | ExpertSession)[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingConsultations, setPendingConsultations] = useState<ConsultationRequest[]>([]);
  const [urgentActions, setUrgentActions] = useState<{ id: string; title: string; subtitle: string; type: 'missed' | 'deadline' | 'task' | 'finance'; date: string; link: string }[]>([]);
  const [recentActivity, setRecentActivity] = useState<{ id: string; title: string; subtitle: string; date: string; type: 'doc' | 'proc' | 'judg' | 'pay' }[]>([]);

  useEffect(() => {
    if (user.role === 'client') return;

    // Real-time listener for cases
    const casesUnsub = onSnapshot(collection(db, 'cases'), (snapshot) => {
      const fetchedCases = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Case));
      setCases(fetchedCases);
      
      if (fetchedCases.length === 0) {
        setPieData([]);
        setChartData([]);
        return;
      }

      // Calculate Pie Chart Data
      const statusCounts = fetchedCases.reduce((acc: any, c) => {
        const status = c.status || 'active';
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      }, {});

      const statusLabels: any = {
        'pre-filing': 'تحت الرفع',
        'active': 'متداولة',
        'execution': 'تنفيذ',
        'archive': 'أرشيف',
        'judgment': 'حكم قضائي'
      };

      const newPieData = Object.entries(statusCounts).map(([status, count]) => ({
        name: statusLabels[status] || status,
        value: Math.round(((count as number) / fetchedCases.length) * 100)
      }));
      setPieData(newPieData);

      // Calculate Area Chart Data (last 6 months)
      const months = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
      const currentMonth = new Date().getMonth();
      const last6Months = [];
      for (let i = 5; i >= 0; i--) {
        const m = (currentMonth - i + 12) % 12;
        last6Months.push({ name: months[m], cases: 0, monthIndex: m });
      }

      fetchedCases.forEach(c => {
        const dateVal = c.createdAt;
        if (dateVal) {
          let date;
          if (typeof dateVal === 'string') {
            date = new Date(dateVal);
          } else if (dateVal && typeof (dateVal as any).toDate === 'function') {
            date = (dateVal as any).toDate();
          }

          if (date && !isNaN(date.getTime())) {
            const monthIndex = date.getMonth();
            const chartItem = last6Months.find(item => item.monthIndex === monthIndex);
            if (chartItem) chartItem.cases++;
          }
        }
      });
      setChartData(last6Months.map(({ name, cases }) => ({ name, cases })));

      setStats(prev => ({
        ...prev,
        totalCases: fetchedCases.length,
        activeCases: fetchedCases.filter(c => c.status === 'active').length,
        wonCases: fetchedCases.filter(c => c.status === 'archive').length,
        totalClients: new Set(fetchedCases.map(c => c.clientId)).size,
      }));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'cases'));

    // Real-time listener for finance
    const financeUnsub = onSnapshot(collection(db, 'finance'), (snapshot) => {
      const records = snapshot.docs.map(doc => doc.data());
      const totalRevenue = records.reduce((sum, r) => sum + (r.amount || 0), 0);
      setStats(prev => ({ ...prev, totalRevenue }));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'finance'));

    // Expert Sessions count and upcoming
    const today = new Date().toISOString().split('T')[0];
    const expertSessionsUnsub = onSnapshot(collection(db, 'expertSessions'), (snapshot) => {
      const sessions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ExpertSession));
      setStats(prev => ({ ...prev, expertSessions: sessions.length }));
      setUpcomingExpertSessions(
        sessions
          .filter(s => s.date >= today && s.status === 'pending')
          .sort((a, b) => a.date.localeCompare(b.date))
          .slice(0, 3)
      );
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'expertSessions'));

    // Judgments (Deadlines)
    const judgmentsUnsub = onSnapshot(collection(db, 'judgments'), (snapshot) => {
      const judgments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Judgment));
      setActiveDeadlines(
        judgments
          .filter(j => !j.isAppealed)
          .sort((a, b) => a.appealDeadline.localeCompare(b.appealDeadline))
          .slice(0, 3)
      );
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'judgments'));

    // Notifications
    const notificationsUnsub = onSnapshot(
      query(
        collection(db, 'notifications'), 
        where('userId', '==', user.uid),
        orderBy('date', 'desc'), 
        limit(5)
      ),
      (snapshot) => {
        setRecentNotifications(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AppNotification)));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'notifications')
    );

    // Real-time listener for upcoming sessions
    const sessionsQuery = query(
      collection(db, 'sessions'),
      where('date', '>=', today),
      orderBy('date', 'asc'),
      limit(5)
    );
    const sessionsUnsub = onSnapshot(sessionsQuery, (snapshot) => {
      const sessions = snapshot.docs.map(doc => {
        const data = doc.data();
        if (!data.date) console.warn('Dashboard: Session missing date:', doc.id);
        return { id: doc.id, ...data } as Session;
      });
      setUpcomingSessions(sessions);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'sessions'));

    // Anti-Omission: Sessions
    const sessionsUnsubAll = onSnapshot(collection(db, 'sessions'), (snapshot) => {
      const sess = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Session));
      setAllSessions(sess);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'sessions'));

    // Anti-Omission: Expert Sessions
    const expertSessUnsubAll = onSnapshot(collection(db, 'expertSessions'), (snapshot) => {
      const sess = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ExpertSession));
      setAllExpertSessions(sess);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'expertSessions'));

    // Pending Consultations
    const consultUnsub = onSnapshot(
      query(collection(db, 'consultations'), where('status', '==', 'pending'), limit(5)),
      (snapshot) => {
        setPendingConsultations(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ConsultationRequest)));
        setLoading(false);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, 'consultations');
        setLoading(false);
      }
    );

    // Recent Activity Feed Aggregator
    const activityUnsubs = [
      onSnapshot(query(collection(db, 'documents'), orderBy('uploadDate', 'desc'), limit(5)), (snap) => {
        const docs = snap.docs.map(d => ({ id: d.id, title: 'إضافة مستند', subtitle: d.data().title, date: d.data().uploadDate, type: 'doc' as const }));
        setRecentActivity(prev => [...prev.filter(a => a.type !== 'doc'), ...docs].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10));
      }),
      onSnapshot(query(collection(db, 'procedures'), orderBy('date', 'desc'), limit(5)), (snap) => {
        const procs = snap.docs.map(d => ({ id: d.id, title: 'إجراء جديد', subtitle: d.data().type, date: d.data().date, type: 'proc' as const }));
        setRecentActivity(prev => [...prev.filter(a => a.type !== 'proc'), ...procs].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10));
      }),
      onSnapshot(query(collection(db, 'judgments'), orderBy('date', 'desc'), limit(5)), (snap) => {
        const judgs = snap.docs.map(d => ({ id: d.id, title: 'صدور حكم', subtitle: d.data().result, date: d.data().date, type: 'judg' as const }));
        setRecentActivity(prev => [...prev.filter(a => a.type !== 'judg'), ...judgs].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10));
      })
    ];

    return () => {
      casesUnsub();
      financeUnsub();
      expertSessionsUnsub();
      judgmentsUnsub();
      notificationsUnsub();
      sessionsUnsub();
      sessionsUnsubAll();
      expertSessUnsubAll();
      consultUnsub();
      activityUnsubs.forEach(unsub => unsub());
    };
  }, [user.uid, user.role]);

  useEffect(() => {
    if (cases.length === 0) {
      setOmittedSessions([]);
      return;
    }

    const today = new Date().toISOString().split('T')[0];
    
    // Check regular sessions
    const omittedRegular = allSessions.filter(s => {
      const caseItem = cases.find(c => c.id === s.caseId);
      if (!caseItem) return false;
      const sDateStr = s.date?.split('T')[0];
      if (!sDateStr) return false;
      return sDateStr < today && (!s.decision || s.decision === '') && caseItem.status !== 'archive';
    });

    // Check expert sessions
    const omittedExpert = allExpertSessions.filter(s => {
      const caseItem = cases.find(c => c.id === s.caseId);
      if (!caseItem) return false;
      const sDateStr = s.date?.split('T')[0];
      if (!sDateStr) return false;
      const hasDecision = s.decision && s.decision !== '';
      const isPending = s.status === 'pending';
      return sDateStr < today && !hasDecision && isPending && !s.isRelayed && caseItem.status !== 'archive';
    });

    const combinedOmitted = [...omittedRegular, ...omittedExpert];
    
    // Only update if the content actually changed to avoid unnecessary re-renders
    setOmittedSessions(prev => {
      const sliced = combinedOmitted.slice(0, 10);
      if (prev.length === sliced.length && prev.every((v, i) => v.id === sliced[i].id)) {
        return prev;
      }
      return sliced;
    });

    if (combinedOmitted.length > 0) {
      console.log('Dashboard: Omission detection summary:', {
        regular: omittedRegular.length,
        expert: omittedExpert.length,
        total: combinedOmitted.length
      });
    }
  }, [cases, allSessions, allExpertSessions]);

  useEffect(() => {
    // Aggregated Urgent Actions Logic
    const urgent: any[] = [];
    
    // 1. Missed Decisions (from omittedSessions)
    omittedSessions.forEach(s => {
      urgent.push({
        id: `missed-${s.id}`,
        title: 'قرار جلسة مفقود',
        subtitle: `جلسة منتهية لم يتم ترحيل قرارها: ${s.caseId}`,
        type: 'missed',
        date: s.date,
        link: '/sessions?tab=omitted'
      });
    });

    // 2. Critical Deadlines (<= 3 days)
    activeDeadlines.forEach(j => {
      const d = parseISO(j.appealDeadline);
      const days = differenceInDays(d, new Date());
      if (days <= 3 && days >= 0) {
        urgent.push({
          id: `deadline-${j.id}`,
          title: 'موعد استئناف حرج',
          subtitle: `بقي ${days} أيام على انتهاء المدة القانونية`,
          type: 'deadline',
          date: j.appealDeadline,
          link: `/cases?id=${j.caseId}`
        });
      }
    });

    // 3. Pending Critical Consultation
    pendingConsultations.forEach(c => {
      urgent.push({
        id: `consult-${c.id}`,
        title: 'استشارة بانتظار الرد',
        subtitle: `الموكل ${c.clientName} ينتظر الرد على: ${c.subject}`,
        type: 'task',
        date: c.date,
        link: '/consultations'
      });
    });

    const sortedUrgent = urgent.sort((a, b) => a.date.localeCompare(b.date)).slice(0, 5);
    
    setUrgentActions(prev => {
      if (prev.length === sortedUrgent.length && prev.every((v, i) => v.id === sortedUrgent[i].id)) {
        return prev;
      }
      return sortedUrgent;
    });
  }, [omittedSessions, activeDeadlines, pendingConsultations]);

  if (user.role === 'client') {
    return <ClientPortal user={user} />;
  }

  return (
    <div className="space-y-8 rtl" dir="rtl">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-1">مرحباً بك في Loyer OS</h1>
          <p className="text-slate-500 font-medium">نظرة عامة على أداء المكتب القانوني اليوم.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="px-4 py-2 bg-white border border-slate-200 rounded-xl shadow-sm text-sm font-bold text-slate-600 flex items-center gap-2">
            <Clock className="w-4 h-4 text-indigo-600" />
            {new Date().toLocaleDateString('ar-KW', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
        </div>
      </div>

      {/* Urgent Actions / Omission Detector */}
      {urgentActions.length > 0 && (
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-red-50 border-r-4 border-red-500 p-6 rounded-2xl shadow-sm overflow-hidden relative group"
        >
          <div className="absolute top-0 left-0 p-4 opacity-5 group-hover:scale-110 transition-transform">
            <AlertTriangle className="w-24 h-24 text-red-600" />
          </div>
          <div className="relative flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-red-100 rounded-2xl flex items-center justify-center text-red-600 animate-pulse">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-black text-red-900">تنبيه كاشف السهو والإجراءات العاجلة</h3>
                <p className="text-sm font-bold text-red-700/80">لديك {urgentActions.length} إجراءات معلقة تتطلب التدخل الفوري</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              {urgentActions.map((action) => (
                <button
                  key={action.id}
                  onClick={() => navigate(action.link)}
                  className="bg-white border border-red-100 px-4 py-2 rounded-xl text-[10px] font-black text-red-600 hover:bg-red-600 hover:text-white transition-all shadow-sm flex items-center gap-2"
                >
                  <Zap className="w-3 h-3" />
                  {action.title}
                </button>
              ))}
              <button
                onClick={() => navigate('/sessions?tab=omitted')}
                className="bg-red-600 text-white px-6 py-2 rounded-xl text-xs font-black shadow-lg shadow-red-100 hover:bg-red-700 transition-all"
              >
                فتح كاشف السهو
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'إجمالي القضايا', value: stats.totalCases, icon: Briefcase, color: 'indigo', trend: '+12%' },
          { label: 'قضايا متداولة', value: stats.activeCases, icon: Scale, color: 'amber', trend: '+5%' },
          { label: 'إجمالي الموكلين', value: stats.totalClients, icon: Users, color: 'blue', trend: '+15%' },
          { label: 'إجمالي الإيرادات', value: `${stats.totalRevenue.toLocaleString()} د.ك`, icon: TrendingUp, color: 'emerald', trend: '+20%' },
        ].map((stat, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all group"
          >
            <div className="flex items-center justify-between mb-4">
              <div className={cn("p-3 rounded-xl group-hover:scale-110 transition-transform", 
                stat.color === 'indigo' ? "bg-indigo-50 text-indigo-600" :
                stat.color === 'amber' ? "bg-amber-50 text-amber-600" :
                stat.color === 'blue' ? "bg-blue-50 text-blue-600" :
                "bg-emerald-50 text-emerald-600"
              )}>
                <stat.icon className="w-6 h-6" />
              </div>
              <div className="flex items-center gap-1 text-emerald-600 text-xs font-bold bg-emerald-50 px-2 py-1 rounded-lg">
                <ArrowUpRight className="w-3 h-3" />
                {stat.trend}
              </div>
            </div>
            <p className="text-slate-500 text-sm font-bold mb-1">{stat.label}</p>
            <h3 className="text-3xl font-black text-slate-900">{stat.value}</h3>
          </motion.div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'إضافة قضية', icon: Briefcase, color: 'bg-indigo-600', path: '/cases' },
          { label: 'إضافة موكل', icon: Users, color: 'bg-blue-600', path: '/clients' },
          { label: 'تسجيل جلسة', icon: CalendarClock, color: 'bg-amber-600', path: '/sessions' },
          { label: 'إضافة مهمة', icon: CheckCircle2, color: 'bg-purple-600', path: '/tasks' },
        ].map((action, i) => (
          <button
            key={i}
            onClick={() => navigate(action.path)}
            className="flex items-center gap-3 p-4 bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-md hover:border-indigo-200 transition-all group text-right"
          >
            <div className={cn("p-2 rounded-lg text-white group-hover:scale-110 transition-transform", action.color)}>
              <action.icon className="w-5 h-5" />
            </div>
            <span className="font-bold text-slate-700 text-sm">{action.label}</span>
          </button>
        ))}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Chart */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-indigo-600" />
              نمو القضايا (نصف سنوي)
            </h3>
            <select className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1 text-sm font-bold text-slate-600 outline-none">
              <option>2024</option>
              <option>2023</option>
            </select>
          </div>
          <div className="h-80 w-full min-h-[320px]">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={320}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorCases" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12, fontWeight: 600 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12, fontWeight: 600 }} dx={-10} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  itemStyle={{ color: '#4f46e5', fontWeight: 700 }}
                />
                <Area type="monotone" dataKey="cases" stroke="#4f46e5" strokeWidth={3} fillOpacity={1} fill="url(#colorCases)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pie Chart */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="text-lg font-bold text-slate-900 mb-8 flex items-center gap-2">
            <Scale className="w-5 h-5 text-indigo-600" />
            توزيع حالات القضايا
          </h3>
          <div className="h-64 w-full min-h-[256px]">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={256}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 space-y-2">
            {pieData.map((item, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i] }}></div>
                  <span className="text-slate-600 font-medium">{item.name}</span>
                </div>
                <span className="text-slate-900 font-bold">{item.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Section: Upcoming Sessions, Expert Sessions & Deadlines */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Upcoming Sessions */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <CalendarClock className="w-5 h-5 text-indigo-600" />
              الجلسات القادمة
            </h3>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => window.print()}
                className="p-2 hover:bg-slate-100 rounded-lg transition-all text-slate-400 hover:text-indigo-600"
                title="طباعة"
              >
                <Printer className="w-4 h-4" />
              </button>
              <button className="text-indigo-600 text-sm font-bold hover:underline">عرض الكل</button>
            </div>
          </div>
          <div className="space-y-4">
            {upcomingSessions.length > 0 ? upcomingSessions.map((session, i) => {
              let sessionDate: Date | null = null;
              try {
                if (session.date) {
                  sessionDate = parseISO(session.date);
                  if (isNaN(sessionDate.getTime())) throw new Error('Invalid date');
                }
              } catch (e) {
                console.error('Dashboard: Error parsing session date:', session.date, e);
              }

              return (
                <div key={i} className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl border border-slate-100 hover:border-indigo-200 transition-all group">
                  <div className="flex flex-col items-center justify-center bg-white p-2 rounded-lg border border-slate-200 min-w-[64px] shadow-sm">
                    <span className="text-[10px] font-black text-indigo-600 uppercase tracking-tighter">
                      {sessionDate ? format(sessionDate, 'MMMM', { locale: arSA }) : '---'}
                    </span>
                    <span className="text-xl font-black text-slate-900 leading-none">
                      {sessionDate ? format(sessionDate, 'dd') : '--'}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-bold text-slate-900 truncate">جلسة مرافعة</h4>
                    <p className="text-xs text-slate-500 font-medium truncate">قضية رقم {session.caseId.slice(0, 8)}</p>
                  </div>
                </div>
              );
            }) : (
              <div className="text-center py-8 text-slate-400 font-medium">لا توجد جلسات قادمة</div>
            )}
          </div>
        </div>

        {/* Expert Sessions */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Users className="w-5 h-5 text-indigo-600" />
              جلسات الخبراء
            </h3>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => window.print()}
                className="p-2 hover:bg-slate-100 rounded-lg transition-all text-slate-400 hover:text-indigo-600"
                title="طباعة"
              >
                <Printer className="w-4 h-4" />
              </button>
              <button className="text-indigo-600 text-sm font-bold hover:underline">عرض الكل</button>
            </div>
          </div>
          <div className="space-y-4">
            {upcomingExpertSessions.length > 0 ? upcomingExpertSessions.map((session, i) => {
              let sessionDate: Date | null = null;
              try {
                if (session.date) {
                  sessionDate = parseISO(session.date);
                  if (isNaN(sessionDate.getTime())) throw new Error('Invalid date');
                }
              } catch (e) {
                console.error('Dashboard: Error parsing expert session date:', session.date, e);
              }

              return (
                <div key={i} className="flex items-center gap-4 p-4 bg-amber-50/50 rounded-xl border border-amber-100 hover:border-amber-200 transition-all group">
                  <div className="flex flex-col items-center justify-center bg-white p-2 rounded-lg border border-amber-200 min-w-[64px] shadow-sm">
                    <span className="text-[10px] font-black text-amber-600 uppercase tracking-tighter">
                      {sessionDate ? format(sessionDate, 'MMMM', { locale: arSA }) : '---'}
                    </span>
                    <span className="text-xl font-black text-slate-900 leading-none">
                      {sessionDate ? format(sessionDate, 'dd') : '--'}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-bold text-slate-900 truncate">{session.expertName}</h4>
                    <p className="text-xs text-slate-500 font-medium truncate">{session.officeLocation}</p>
                  </div>
                </div>
              );
            }) : (
              <div className="text-center py-8 text-slate-400 font-medium">لا توجد جلسات خبراء</div>
            )}
          </div>
        </div>

        {/* Legal Deadlines */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Gavel className="w-5 h-5 text-indigo-600" />
              مواعيد الاستئناف
            </h3>
            <button className="text-indigo-600 text-sm font-bold hover:underline">عرض الكل</button>
          </div>
          <div className="space-y-4">
            {activeDeadlines.length > 0 ? activeDeadlines.map((judgment, i) => {
              let deadlineDate: Date | null = null;
              try {
                if (judgment.appealDeadline) {
                  deadlineDate = parseISO(judgment.appealDeadline);
                  if (isNaN(deadlineDate.getTime())) throw new Error('Invalid date');
                }
              } catch (e) {
                console.error('Dashboard: Error parsing judgment appealDeadline:', judgment.appealDeadline, e);
              }

              const daysLeft = deadlineDate ? differenceInDays(deadlineDate, new Date()) : 0;
              return (
                <div key={i} className={cn(
                  "p-4 rounded-xl border transition-all flex items-center justify-between",
                  daysLeft <= 5 ? "bg-red-50 border-red-100" : "bg-slate-50 border-slate-100"
                )}>
                  <div className="min-w-0">
                    <h4 className="text-sm font-bold text-slate-900 truncate">موعد استئناف</h4>
                    <p className="text-[10px] text-slate-500 font-bold uppercase">قضية رقم {judgment.caseId.slice(0, 8)}</p>
                  </div>
                  <div className={cn(
                    "px-3 py-1 rounded-lg text-xs font-black",
                    daysLeft <= 5 ? "bg-red-600 text-white" : "bg-slate-200 text-slate-700"
                  )}>
                    {daysLeft} يوم
                  </div>
                </div>
              );
            }) : (
              <div className="text-center py-8 text-slate-400 font-medium">لا توجد مواعيد نشطة</div>
            )}
          </div>
        </div>
      </div>

      {/* Notifications & Recent Docs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Notifications */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Bell className="w-5 h-5 text-indigo-600" />
              آخر التنبيهات
            </h3>
            <button className="text-indigo-600 text-sm font-bold hover:underline">عرض الكل</button>
          </div>
          <div className="space-y-4">
            {recentNotifications.map((notif, i) => (
              <div key={i} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                <div className={cn(
                  "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                  notif.type === 'deadline' ? "bg-red-100 text-red-600" : "bg-indigo-100 text-indigo-600"
                )}>
                  <Bell className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-900 truncate">{notif.title}</p>
                  <p className="text-[10px] text-slate-500 font-medium truncate">{notif.message}</p>
                </div>
              </div>
            ))}
            {recentNotifications.length === 0 && (
              <div className="text-center py-8 text-slate-400 font-medium">لا توجد تنبيهات حديثة</div>
            )}
          </div>
        </div>

        {/* Pending Consultations */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-indigo-600" />
              استشارات بانتظار الرد
            </h3>
            <button 
              onClick={() => navigate('/consultations')}
              className="text-indigo-600 text-sm font-bold hover:underline"
            >
              عرض الكل
            </button>
          </div>
          <div className="space-y-4">
            {pendingConsultations.map((req, i) => (
              <div key={i} className="flex items-center gap-3 p-3 bg-amber-50 rounded-xl border border-amber-100">
                <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center text-amber-600 shadow-sm">
                  <MessageSquare className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-slate-900 truncate">{req.subject}</p>
                  <p className="text-[10px] text-slate-500 font-medium truncate">الموكل: {req.clientName}</p>
                </div>
                <button 
                  onClick={() => navigate('/consultations')}
                  className="text-[10px] font-black text-indigo-600 hover:underline"
                >
                  رد الآن
                </button>
              </div>
            ))}
            {pendingConsultations.length === 0 && (
              <div className="text-center py-8 text-slate-400 font-medium">لا توجد استشارات معلقة</div>
            )}
          </div>
        </div>
      </div>
      {/* Recent Activity Feed */}
      <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between mb-8">
          <h3 className="text-xl font-black text-slate-900 flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600">
              <Activity className="w-6 h-6" />
            </div>
            تتبع النشاط القانوني اللحظي
          </h3>
          <div className="px-4 py-2 bg-emerald-50 text-emerald-600 rounded-full text-xs font-black flex items-center gap-2 animate-pulse">
            <div className="w-2 h-2 bg-emerald-600 rounded-full" />
            تحديث فوري نشط
          </div>
        </div>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {recentActivity.map((activity) => (
              <motion.div
                key={activity.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="p-5 bg-slate-50 rounded-3xl border border-slate-100 flex flex-col items-center text-center gap-3 hover:bg-white hover:border-indigo-100 hover:shadow-xl transition-all group"
              >
                <div className={cn(
                  "w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm",
                  activity.type === 'doc' ? "bg-blue-50 text-blue-600" :
                  activity.type === 'proc' ? "bg-emerald-50 text-emerald-600" :
                  activity.type === 'judg' ? "bg-amber-50 text-amber-600" :
                  "bg-indigo-50 text-indigo-600"
                )}>
                  {activity.type === 'doc' ? <FileText className="w-6 h-6" /> :
                   activity.type === 'proc' ? <ClipboardList className="w-6 h-6" /> :
                   activity.type === 'judg' ? <Gavel className="w-6 h-6" /> :
                   <Activity className="w-6 h-6" />}
                </div>
                <div>
                  <h4 className="text-xs font-black text-slate-900 mb-1 leading-none">{activity.title}</h4>
                  <p className="text-[10px] text-slate-500 font-bold line-clamp-1 h-3">{activity.subtitle}</p>
                </div>
                <div className="text-[9px] font-black text-slate-400 bg-white px-2 py-1 rounded-lg border border-slate-100">
                  {format(new Date(activity.date), 'hh:mm a')}
                </div>
              </motion.div>
            ))}
            {recentActivity.length === 0 && (
              <div className="col-span-full py-12 text-center text-slate-400 font-bold italic">لا توجد حركات مؤخرة</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
