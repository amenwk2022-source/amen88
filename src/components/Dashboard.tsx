import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, limit, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
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
  FileText
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
import { Case, Session } from '../types';

const COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444'];

export default function Dashboard() {
  const [stats, setStats] = useState({
    totalCases: 0,
    activeCases: 0,
    wonCases: 0,
    totalClients: 0,
  });
  const [upcomingSessions, setUpcomingSessions] = useState<Session[]>([]);
  const [omittedSessions, setOmittedSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Real-time listener for cases
    const casesUnsub = onSnapshot(collection(db, 'cases'), (snapshot) => {
      const cases = snapshot.docs.map(doc => doc.data() as Case);
      setStats({
        totalCases: cases.length,
        activeCases: cases.filter(c => c.status === 'active').length,
        wonCases: cases.filter(c => c.status === 'archive').length, // Assuming archive = finished
        totalClients: new Set(cases.map(c => c.clientId)).size,
      });
    });

    // Real-time listener for upcoming sessions
    const today = new Date().toISOString().split('T')[0];
    const sessionsQuery = query(
      collection(db, 'sessions'),
      where('date', '>=', today),
      orderBy('date', 'asc'),
      limit(5)
    );
    const sessionsUnsub = onSnapshot(sessionsQuery, (snapshot) => {
      setUpcomingSessions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Session)));
    });

    // Anti-Omission: Sessions with date < today and no decision
    const omittedQuery = query(
      collection(db, 'sessions'),
      where('date', '<', today),
      where('decision', '==', ''), // Assuming empty string means no decision
      limit(10)
    );
    const omittedUnsub = onSnapshot(omittedQuery, (snapshot) => {
      setOmittedSessions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Session)));
      setLoading(false);
    });

    return () => {
      casesUnsub();
      sessionsUnsub();
      omittedUnsub();
    };
  }, []);

  const chartData = [
    { name: 'يناير', cases: 40 },
    { name: 'فبراير', cases: 30 },
    { name: 'مارس', cases: 20 },
    { name: 'أبريل', cases: 27 },
    { name: 'مايو', cases: 18 },
    { name: 'يونيو', cases: 23 },
  ];

  const pieData = [
    { name: 'تحت الرفع', value: 15 },
    { name: 'متداولة', value: 45 },
    { name: 'تنفيذ', value: 25 },
    { name: 'أرشيف', value: 15 },
  ];

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
          <button className="px-4 py-2 bg-red-600 text-white rounded-xl font-bold text-sm hover:bg-red-700 transition-all shadow-md shadow-red-100">
            تحديث الآن
          </button>
        </motion.div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'إجمالي القضايا', value: stats.totalCases, icon: Briefcase, color: 'indigo', trend: '+12%' },
          { label: 'قضايا متداولة', value: stats.activeCases, icon: Scale, color: 'amber', trend: '+5%' },
          { label: 'قضايا منتهية', value: stats.wonCases, icon: CheckCircle2, color: 'emerald', trend: '+8%' },
          { label: 'إجمالي الموكلين', value: stats.totalClients, icon: Users, color: 'blue', trend: '+15%' },
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
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
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
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
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

      {/* Bottom Section: Upcoming Sessions & Recent Docs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
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
                  <span className="text-[10px] font-black text-indigo-600 uppercase tracking-tighter">أبريل</span>
                  <span className="text-xl font-black text-slate-900 leading-none">{new Date(session.date).getDate()}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-bold text-slate-900 truncate">قضية رقم {session.caseId.slice(0, 8)}</h4>
                  <p className="text-xs text-slate-500 font-medium truncate">المحكمة الكلية - الدائرة 15</p>
                </div>
                <div className="text-right">
                  <span className="inline-block px-2 py-1 bg-indigo-100 text-indigo-700 text-[10px] font-bold rounded-lg mb-1">جلسة مرافعة</span>
                  <p className="text-[10px] text-slate-400 font-bold">09:00 ص</p>
                </div>
              </div>
            )) : (
              <div className="text-center py-8 text-slate-400 font-medium">لا توجد جلسات قادمة</div>
            )}
          </div>
        </div>

        {/* Recent Documents */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-600" />
              آخر المستندات المضافة
            </h3>
            <button className="text-indigo-600 text-sm font-bold hover:underline">المكتبة</button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((_, i) => (
              <div key={i} className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex items-center gap-3 group cursor-pointer hover:bg-white hover:shadow-md transition-all">
                <div className="p-2 bg-white rounded-lg border border-slate-200 group-hover:bg-indigo-50 group-hover:border-indigo-200 transition-all">
                  <FileText className="w-5 h-5 text-slate-400 group-hover:text-indigo-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-900 truncate">صحيفة دعوى.pdf</p>
                  <p className="text-[10px] text-slate-400 font-medium">منذ ساعتين</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
