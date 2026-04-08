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
  MessageSquare
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
  const [omittedSessions, setOmittedSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingConsultations, setPendingConsultations] = useState<ConsultationRequest[]>([]);

  useEffect(() => {
    if (user.role === 'client') return;

    // Real-time listener for cases
    const casesUnsub = onSnapshot(collection(db, 'cases'), (snapshot) => {
      const cases = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Case));
      
      // Calculate Pie Chart Data
      const statusCounts = cases.reduce((acc: any, c) => {
        const status = c.status || 'active';
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      }, {});

      const statusLabels: any = {
        'active': 'متداولة',
        'archive': 'أرشيف',
        'judgment': 'حكم قضائي',
        'execution': 'تنفيذ',
        'draft': 'تحت الرفع'
      };

      const newPieData = Object.entries(statusCounts).map(([status, count]) => ({
        name: statusLabels[status] || status,
        value: Math.round(((count as number) / cases.length) * 100)
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

      cases.forEach(c => {
        if (c.createdAt) {
          const date = new Date(c.createdAt);
          const monthIndex = date.getMonth();
          const chartItem = last6Months.find(item => item.monthIndex === monthIndex);
          if (chartItem) chartItem.cases++;
        }
      });
      setChartData(last6Months.map(({ name, cases }) => ({ name, cases })));

      setStats(prev => ({
        ...prev,
        totalCases: cases.length,
        activeCases: cases.filter(c => c.status === 'active').length,
        wonCases: cases.filter(c => c.status === 'archive').length,
        totalClients: new Set(cases.map(c => c.clientId)).size,
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
      setUpcomingSessions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Session)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'sessions'));

    // Anti-Omission
    const omittedQuery = query(
      collection(db, 'sessions'),
      where('date', '<', today),
      where('decision', '==', ''),
      limit(10)
    );
    const omittedUnsub = onSnapshot(omittedQuery, (snapshot) => {
      setOmittedSessions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Session)));
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'sessions');
    });

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

    return () => {
      casesUnsub();
      financeUnsub();
      expertSessionsUnsub();
      judgmentsUnsub();
      notificationsUnsub();
      sessionsUnsub();
      omittedUnsub();
      consultUnsub();
    };
  }, [user.role]);

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

      {/* Anti-Omission Alert */}
      {omittedSessions.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-red-50 border-2 border-red-200 p-4 rounded-2xl flex items-center gap-4 shadow-sm"
        >
          <div className="p-3 bg-red-100 rounded-xl">
            <AlertCircle className="w-6 h-6 text-red-600" />
          </div>
          <div className="flex-1">
            <h3 className="text-red-900 font-bold">تنبيه: كاشف السهو (Anti-Omission)</h3>
            <p className="text-red-700 text-sm font-medium">يوجد {omittedSessions.length} جلسة منتهية لم يتم ترحيل قراراتها بعد. يرجى تحديثها فوراً.</p>
          </div>
          <button 
            onClick={() => navigate('/sessions')}
            className="px-4 py-2 bg-red-600 text-white rounded-xl font-bold text-sm hover:bg-red-700 transition-all shadow-md shadow-red-100"
          >
            تحديث الآن
          </button>
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
            <button className="text-indigo-600 text-sm font-bold hover:underline">عرض الكل</button>
          </div>
          <div className="space-y-4">
            {upcomingSessions.length > 0 ? upcomingSessions.map((session, i) => (
              <div key={i} className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl border border-slate-100 hover:border-indigo-200 transition-all group">
                <div className="flex flex-col items-center justify-center bg-white p-2 rounded-lg border border-slate-200 min-w-[64px] shadow-sm">
                  <span className="text-[10px] font-black text-indigo-600 uppercase tracking-tighter">
                    {format(parseISO(session.date), 'MMMM', { locale: arSA })}
                  </span>
                  <span className="text-xl font-black text-slate-900 leading-none">{format(parseISO(session.date), 'dd')}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-bold text-slate-900 truncate">جلسة مرافعة</h4>
                  <p className="text-xs text-slate-500 font-medium truncate">قضية رقم {session.caseId.slice(0, 8)}</p>
                </div>
              </div>
            )) : (
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
            <button className="text-indigo-600 text-sm font-bold hover:underline">عرض الكل</button>
          </div>
          <div className="space-y-4">
            {upcomingExpertSessions.length > 0 ? upcomingExpertSessions.map((session, i) => (
              <div key={i} className="flex items-center gap-4 p-4 bg-amber-50/50 rounded-xl border border-amber-100 hover:border-amber-200 transition-all group">
                <div className="flex flex-col items-center justify-center bg-white p-2 rounded-lg border border-amber-200 min-w-[64px] shadow-sm">
                  <span className="text-[10px] font-black text-amber-600 uppercase tracking-tighter">
                    {format(parseISO(session.date), 'MMMM', { locale: arSA })}
                  </span>
                  <span className="text-xl font-black text-slate-900 leading-none">{format(parseISO(session.date), 'dd')}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-bold text-slate-900 truncate">{session.expertName}</h4>
                  <p className="text-xs text-slate-500 font-medium truncate">{session.officeLocation}</p>
                </div>
              </div>
            )) : (
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
              const daysLeft = differenceInDays(parseISO(judgment.appealDeadline), new Date());
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
    </div>
  );
}
