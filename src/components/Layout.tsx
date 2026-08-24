import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { signOut } from 'firebase/auth';
import { collection, query, where, onSnapshot, orderBy, limit, doc, getDoc } from 'firebase/firestore';
import {
  Calendar,
  Gavel,
  LayoutDashboard,
  Users,
  Briefcase,
  CalendarClock,
  FileText,
  DollarSign,
  Settings,
  LogOut,
  Menu,
  X,
  Bell,
  Search,
  Scale,
  ClipboardList,
  TrendingUp,
  CheckCircle2,
  MessageSquare,
  Smartphone,
  Laptop,
  QrCode,
  Wifi,
  Battery,
  Signal,
  ArrowRight,
  RefreshCw,
  Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { UserProfile, AppNotification, Case, SystemSettings } from '../types';

import NotificationCenter, { generateNotifications } from './NotificationCenter';
import toast from 'react-hot-toast';

interface LayoutProps {
  children: React.ReactNode;
  user: UserProfile | null;
}

const navItems = [
  { path: '/', label: 'لوحة التحكم', icon: LayoutDashboard, roles: ['admin', 'lawyer', 'staff', 'client'] },
  { path: '/calendar', label: 'التقويم', icon: Calendar, roles: ['admin', 'lawyer', 'staff'] },
  { path: '/clients', label: 'الموكلين', icon: Users, roles: ['admin', 'lawyer', 'staff'] },
  { path: '/cases', label: 'القضايا', icon: Briefcase, roles: ['admin', 'lawyer', 'staff', 'client'] },
  { path: '/sessions', label: 'رول الجلسات', icon: CalendarClock, roles: ['admin', 'lawyer', 'staff', 'client'] },
  { path: '/expert-sessions', label: 'جلسات الخبراء', icon: Users, roles: ['admin', 'lawyer', 'staff', 'client'] },
  { path: '/judgments', label: 'الأحكام', icon: Gavel, roles: ['admin', 'lawyer', 'staff', 'client'] },
  { path: '/deadlines', label: 'المواعيد القانونية', icon: Bell, roles: ['admin', 'lawyer', 'staff', 'client'] },
  { path: '/procedures', label: 'الإجراءات', icon: ClipboardList, roles: ['admin', 'lawyer', 'staff', 'client'] },
  { path: '/tasks', label: 'المهام', icon: CheckCircle2, roles: ['admin', 'lawyer', 'staff', 'client'] },
  { path: '/documents', label: 'الأرشيف الضوئي', icon: FileText, roles: ['admin', 'lawyer', 'staff', 'client'] },
  { path: '/finance', label: 'المالية', icon: DollarSign, roles: ['admin', 'lawyer', 'client'] },
  { path: '/consultations', label: 'الاستشارات', icon: MessageSquare, roles: ['admin', 'lawyer', 'client'] },
  { path: '/ai-assistant', label: 'المساعد الذكي (المذكرات)', icon: Sparkles, roles: ['admin', 'lawyer', 'staff'] },
  { path: '/reports', label: 'التقارير', icon: TrendingUp, roles: ['admin', 'lawyer'] },
  { path: '/settings', label: 'الإعدادات', icon: Settings, roles: ['admin', 'lawyer', 'staff', 'client'] },
];

export default function Layout({ children, user }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notifCenterOpen, setNotifCenterOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [allCases, setAllCases] = useState<Case[]>([]);
  const [allClients, setAllClients] = useState<any[]>([]);
  const [allTasks, setAllTasks] = useState<any[]>([]);
  const [systemSettings, setSystemSettings] = useState<SystemSettings | null>(null);
  const [searchResults, setSearchResults] = useState<{ type: 'case' | 'client' | 'task'; id: string; title: string; subtitle: string; extra?: string }[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const isInsideIframe = window.self !== window.top;
  const [isMobileSimulated, setIsMobileSimulated] = useState(() => {
    if (isInsideIframe) return false;
    return localStorage.getItem('mobile_simulated') === 'true';
  });
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 1024);
  const [simulatorDevice, setSimulatorDevice] = useState<'ios' | 'android'>('ios');
  const [simulatorTheme, setSimulatorTheme] = useState<'light' | 'dark'>('light');
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setIsDesktop(window.innerWidth >= 1024);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const toggleMobileSimulation = () => {
    const newValue = !isMobileSimulated;
    setIsMobileSimulated(newValue);
    localStorage.setItem('mobile_simulated', String(newValue));
  };

  const getMobileTabItems = (role: string) => {
    if (role === 'client') {
      return [
        { path: '/', label: 'الرئيسية', icon: LayoutDashboard },
        { path: '/cases', label: 'القضايا', icon: Briefcase },
        { path: '/consultations', label: 'الاستشارات', icon: MessageSquare },
        { path: '/finance', label: 'المالية', icon: DollarSign },
      ];
    } else {
      return [
        { path: '/', label: 'الرئيسية', icon: LayoutDashboard },
        { path: '/cases', label: 'القضايا', icon: Briefcase },
        { path: '/sessions', label: 'الجلسات', icon: CalendarClock },
        { path: '/tasks', label: 'المهام', icon: CheckCircle2 },
      ];
    }
  };

  const filteredNavItems = navItems.filter(item => 
    !user || item.roles.includes(user.role)
  );

  useEffect(() => {
    if (!user) return;

    // Generate notifications on login and then every hour
    generateNotifications(user.uid, user.role);
    const interval = setInterval(() => generateNotifications(user.uid, user.role), 3600000);

    const unsubNotifs = onSnapshot(
      query(collection(db, 'notifications'), where('userId', '==', user.uid), where('isRead', '==', false), limit(10)),
      (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            const notif = change.doc.data() as AppNotification;
            const notifDate = new Date(notif.date);
            const now = new Date();
            if (now.getTime() - notifDate.getTime() < 60000) {
              toast((t) => (
                <div className="flex flex-col gap-1 rtl" dir="rtl">
                  <div className="flex items-center justify-between gap-4">
                    <span className="font-black text-slate-900 text-sm">{notif.title}</span>
                    <button onClick={() => toast.dismiss(t.id)} className="text-slate-400 hover:text-slate-600">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                  <p className="text-xs text-slate-500 font-medium">{notif.message}</p>
                </div>
              ), {
                duration: 6000,
                position: 'bottom-left',
                style: {
                  borderRadius: '16px',
                  background: '#fff',
                  color: '#334155',
                  boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                  border: '1px solid #f1f5f9',
                  padding: '12px 16px',
                  minWidth: '300px'
                },
              });
            }
          }
        });
        setNotifications(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AppNotification)));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'notifications')
    );

    const unsubCases = onSnapshot(collection(db, 'cases'), (snapshot) => {
      const cases = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Case));
      if (user?.role === 'client') {
        setAllCases(cases.filter(c => c.clientId === user.uid));
      } else {
        setAllCases(cases);
      }
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'cases'));

    const unsubClients = onSnapshot(collection(db, 'clients'), (snapshot) => {
      setAllClients(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'clients'));

    const unsubTasks = onSnapshot(collection(db, 'tasks'), (snapshot) => {
      setAllTasks(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'tasks'));

    // Load System Settings
    const unsubSettings = onSnapshot(doc(db, 'settings', 'global'), (snapshot) => {
      if (snapshot.exists()) {
        setSystemSettings(snapshot.data() as SystemSettings);
      }
    });

    return () => {
      unsubNotifs();
      unsubCases();
      unsubClients();
      unsubTasks();
      unsubSettings();
      clearInterval(interval);
    };
  }, [user]);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value.toLowerCase();
    setSearchQuery(q);
    if (q.length > 1) {
      const caseResults = allCases
        .filter(c => c.caseNumber?.toLowerCase().includes(q) || c.autoNumber?.toLowerCase().includes(q))
        .map(c => ({ type: 'case' as const, id: c.id, title: `قضية: ${c.caseNumber}`, subtitle: c.clientName || '', extra: c.autoNumber }));

      const clientResults = user?.role !== 'client' 
        ? allClients
            .filter(c => c.name?.toLowerCase().includes(q) || c.phone?.toLowerCase().includes(q))
            .map(c => ({ type: 'client' as const, id: c.id, title: c.name, subtitle: c.phone || '', extra: 'موكل' }))
        : [];

      const taskResults = allTasks
        .filter(t => t.title?.toLowerCase().includes(q))
        .map(t => ({ type: 'task' as const, id: t.id, title: t.title, subtitle: t.status === 'completed' ? 'مكتملة' : 'قيد التنفيذ', extra: 'مهمة' }));

      setSearchResults([...caseResults, ...clientResults, ...taskResults].slice(0, 8));
      setIsSearching(true);
    } else {
      setIsSearching(false);
    }
  };

  const handleResultClick = (result: any) => {
    setIsSearching(false);
    setSearchQuery('');
    if (result.type === 'case') navigate(`/cases?id=${result.id}`);
    else if (result.type === 'client') navigate(`/clients?id=${result.id}`);
    else if (result.type === 'task') navigate(`/tasks?id=${result.id}`);
  };

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/');
  };

  const unreadCount = notifications.length;

  if (isMobileSimulated && isDesktop) {
    return (
      <div className="min-h-screen bg-[#070b13] text-slate-100 flex flex-col lg:flex-row relative overflow-hidden font-sans rtl selection:bg-indigo-500/30" dir="rtl">
        {/* Ambient mesh gradients */}
        <div className="absolute top-[-300px] left-[-300px] w-[600px] h-[600px] bg-indigo-500/10 rounded-full blur-[160px] pointer-events-none" />
        <div className="absolute bottom-[-200px] right-[-200px] w-[500px] h-[500px] bg-emerald-500/5 rounded-full blur-[140px] pointer-events-none" />

        {/* Studio Workspace Dashboard controls */}
        <div className="lg:w-96 shrink-0 p-8 flex flex-col justify-between border-l border-slate-800/80 bg-slate-950/50 relative z-10 overflow-y-auto max-h-screen border-dashed">
          <div>
            <div className="flex items-center gap-3 mb-8 bg-slate-900/60 p-4 rounded-2xl border border-slate-800/60">
              <div className="p-2 bg-indigo-600 rounded-xl shadow-[0_4px_12px_rgba(79,70,229,0.4)]">
                <Scale className="w-5 h-5 text-white" />
              </div>
              <div className="flex flex-col">
                <span className="text-lg font-black text-white tracking-wide">تطبيق الأمين</span>
                <span className="text-[10px] font-bold text-slate-400 mt-0.5">منصة الهاتف الذكي</span>
              </div>
            </div>

            <div className="space-y-6">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-[10px] font-bold text-indigo-400">
                  <Sparkles className="w-3 h-3" />
                  معاينة تفاعلية حية
                </div>
                <h2 className="text-xl font-bold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">نسخة الهاتف المحمول</h2>
                <p className="text-sm text-slate-400 leading-relaxed">
                  هذه محاكاة حية حقيقية لتطبيق الأمين للهواتف الذكية. تم تصميم تطبيق الهاتف لتسهيل متابعة الجلسات والقضايا، إضافة الملاحظات، وإدارة المهام ومطالعة ملفات القضية والتقارير المالية بسرعة فائقة.
                </p>
              </div>

              {/* Real-time statistics block */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3.5 bg-slate-900/40 border border-slate-800/40 rounded-xl">
                  <p className="text-[10px] font-bold text-slate-500">حالة الاتصال</p>
                  <p className="text-xs font-bold text-emerald-400 flex items-center gap-1.5 mt-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    متصل بالشبكة
                  </p>
                </div>
                <div className="p-3.5 bg-slate-900/40 border border-slate-800/40 rounded-xl">
                  <p className="text-[10px] font-bold text-slate-500">الترخيص والمزامنة</p>
                  <p className="text-xs font-bold text-indigo-400 mt-1">Firestore Sync</p>
                </div>
              </div>

              {/* Hardware simulation panel controls */}
              <div className="bg-slate-900/50 p-4 rounded-2xl border border-slate-800/50 space-y-4">
                <span className="text-xs font-black tracking-wide text-indigo-300 uppercase block">تخصيص المحاكي</span>
                
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-slate-400 font-bold block mb-1.5">طراز الهاتف الذكي</label>
                    <div className="grid grid-cols-2 gap-2 p-1 bg-slate-950 rounded-xl border border-slate-850">
                      <button
                        onClick={() => setSimulatorDevice('ios')}
                        className={cn(
                          "py-2 text-[11px] font-bold rounded-lg transition-all",
                          simulatorDevice === 'ios' ? "bg-indigo-600 text-white shadow" : "text-slate-450 hover:text-slate-200"
                        )}
                      >
                        iPhone 16 Pro
                      </button>
                      <button
                        onClick={() => setSimulatorDevice('android')}
                        className={cn(
                          "py-2 text-[11px] font-bold rounded-lg transition-all",
                          simulatorDevice === 'android' ? "bg-indigo-600 text-white shadow" : "text-slate-450 hover:text-slate-200"
                        )}
                      >
                        Galaxy S24 Ultra
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* QR Code generator placeholder for quick phone testing */}
              <div className="p-4 bg-gradient-to-br from-indigo-950/20 to-slate-900/40 border border-indigo-500/10 rounded-2xl flex items-center gap-4">
                <div className="p-2 bg-white rounded-xl shadow shrink-0">
                  <QrCode className="w-14 h-14 text-slate-900" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white mb-1 flex items-center gap-1.5">
                    الفتح على هاتفك الحقيقي
                  </h4>
                  <p className="text-[10px] text-slate-400 leading-normal">
                    امسح الرمز بكاميرا هاتفك لفتح النسخة الهاتفية الفعلية والاستمتاع بالتأثيرات اللمسية.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-slate-800/60">
            <button
              onClick={() => toggleMobileSimulation()}
              className="w-full py-3.5 px-4 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-sm font-bold rounded-xl transition-all shadow-lg flex items-center justify-center gap-2"
            >
              <Laptop className="w-4 h-4" />
              العودة إلى نسخة الحاسب (المتصفح)
            </button>
          </div>
        </div>

        {/* Device frame container viewport */}
        <div className="flex-1 flex flex-col items-center justify-center p-6 bg-slate-950/25 relative">
          <div className="relative">
            {simulatorDevice === 'ios' ? (
              // iOS iPhone 16 Frame
              <div className="relative w-[390px] h-[844px] bg-slate-950 border-[11px] border-slate-800 rounded-[55px] shadow-[0_25px_65px_-12px_rgba(0,0,0,0.95)] flex flex-col overflow-hidden ring-4 ring-indigo-900/10">
                {/* Physical Notch */}
                <div className="absolute top-3 left-1/2 -translate-x-1/2 w-28 h-6 bg-black rounded-full z-50 flex items-center justify-center">
                  <div className="w-2.5 h-2.5 bg-slate-900 rounded-full mr-auto ml-1 border border-slate-800/50"></div>
                </div>

                {/* Simulated Speculative Glass shine */}
                <div className="absolute top-0 right-0 w-1/4 h-full bg-gradient-to-r from-transparent via-white/5 to-transparent skew-x-12 pointer-events-none z-40" />

                {/* iOS Bar */}
                <div className="h-10 bg-white border-b border-slate-100 flex items-center justify-between px-6 shrink-0 relative z-40 text-xs font-black text-slate-800" dir="ltr">
                  <span>9:41</span>
                  <div className="flex items-center gap-1.5">
                    <Signal className="w-3.5 h-3.5 text-slate-800" />
                    <span className="text-[10px] font-black">5G</span>
                    <Wifi className="w-3.5 h-3.5 text-slate-800" />
                    <Battery className="w-4 h-4 text-emerald-600 rotate-90 ml-0.5" />
                  </div>
                </div>

                {/* App container embedded iframe */}
                <div className="flex-1 w-full bg-slate-50 relative overflow-hidden flex flex-col">
                  <iframe
                    src={window.location.protocol + "//" + window.location.host + window.location.pathname + window.location.search}
                    className="w-full h-full border-none select-none overflow-hidden"
                    title="Al-Amin Mobile View"
                  />
                </div>

                {/* iOS bottom handle */}
                <div className="h-5 bg-white shrink-0 flex items-center justify-center relative z-40" dir="ltr">
                  <div className="w-32 h-1 bg-slate-800 rounded-full"></div>
                </div>
              </div>
            ) : (
              // Android Device Frame Samsung Ultra Style
              <div className="relative w-[398px] h-[856px] bg-slate-950 border-[9px] border-slate-750 rounded-[38px] shadow-[0_25px_65px_-12px_rgba(0,0,0,0.95)] flex flex-col overflow-hidden ring-4 ring-emerald-950/10">
                {/* Hole punch camera */}
                <div className="absolute top-3.5 left-1/2 -translate-x-1/2 w-4 h-4 bg-black rounded-full z-50"></div>

                {/* Android status bar */}
                <div className="h-9.5 bg-white border-b border-slate-100 flex items-center justify-between px-6 shrink-0 relative z-40 text-xs font-bold text-slate-750" dir="ltr">
                  <div className="flex items-center gap-1">
                    <Signal className="w-3.5 h-3.5" />
                    <Wifi className="w-3.5 h-3.5" />
                  </div>
                  <span>10:00 ص</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px]">98%</span>
                    <Battery className="w-4 h-4 text-slate-750" />
                  </div>
                </div>

                {/* Main iframe element */}
                <div className="flex-1 w-full bg-slate-50 relative overflow-hidden flex flex-col">
                  <iframe
                    src={window.location.protocol + "//" + window.location.host + window.location.pathname + window.location.search}
                    className="w-full h-full border-none select-none overflow-hidden"
                    title="Al-Amin Mobile View"
                  />
                </div>

                {/* Android navigation keys */}
                <div className="h-8.5 bg-white shrink-0 flex items-center justify-around px-16 relative z-40" dir="rtl">
                  <button className="w-3.5 h-3.5 border-2 border-slate-400 rounded-sm" />
                  <button className="w-4 h-4 border-2 border-slate-400 rounded-full" />
                  <button className="w-2.5 h-2.5 border-r-2 border-b-2 border-slate-400 rotate-45 transform" />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex rtl font-sans" dir="rtl">
      {/* Sidebar for Desktop */}
      <aside className="hidden lg:flex flex-col w-72 bg-white border-l border-slate-200 shadow-sm sticky top-0 h-screen">
        <div className="p-6 flex items-center gap-3 border-b border-slate-100">
          <div className="p-2 bg-indigo-600 rounded-lg shadow-md">
            <Scale className="w-6 h-6 text-white" />
          </div>
          <div className="flex flex-col">
            <span className="text-xl font-black text-slate-900 tracking-tight leading-none">الأمين</span>
            <span className="text-[10px] font-bold text-slate-500 mt-1">{systemSettings?.officeName || 'مكتب المحامي محمد امين علي الصايغ'}</span>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {filteredNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all duration-200",
                  isActive
                    ? "bg-indigo-50 text-indigo-700 shadow-sm"
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                )}
              >
                <Icon className={cn("w-5 h-5", isActive ? "text-indigo-600" : "text-slate-400")} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-100 space-y-3">
          <button
            onClick={toggleMobileSimulation}
            className="w-full flex items-center gap-3 px-4 py-2.5 bg-indigo-50/70 hover:bg-indigo-100/80 border border-indigo-100/50 rounded-xl font-bold text-indigo-700 transition-all text-xs"
          >
            <Smartphone className="w-4.5 h-4.5 text-indigo-600" />
            <span>عرض كتطبيق للهاتف</span>
          </button>

          <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
            <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold border border-indigo-200">
              {user?.name?.[0] || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-slate-900 truncate">{user?.name}</p>
              <p className="text-xs text-slate-500 truncate capitalize">{user?.role}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 text-red-600 font-medium hover:bg-red-50 rounded-xl transition-all"
          >
            <LogOut className="w-5 h-5" />
            تسجيل الخروج
          </button>
        </div>
      </aside>

      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSidebarOpen(false)}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 lg:hidden"
            />
            <motion.aside
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              className="fixed inset-y-0 right-0 w-72 bg-white z-50 lg:hidden flex flex-col shadow-2xl"
            >
              <div className="p-6 flex items-center justify-between border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-600 rounded-lg">
                    <Scale className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-lg font-black text-slate-900">الأمين</span>
                    <span className="text-[8px] font-bold text-slate-500">{systemSettings?.officeName || 'مكتب المحامي محمد امين علي الصايغ'}</span>
                  </div>
                </div>
                <button onClick={() => setSidebarOpen(false)} className="p-2 hover:bg-slate-100 rounded-lg">
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>
              <nav className="flex-1 p-4 space-y-1">
                {filteredNavItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.path;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={() => setSidebarOpen(false)}
                      className={cn(
                        "flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all",
                        isActive ? "bg-indigo-50 text-indigo-700" : "text-slate-500 hover:bg-slate-50"
                      )}
                    >
                      <Icon className="w-5 h-5" />
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
              <div className="p-4 border-t border-slate-100">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-4 py-3 text-red-600 font-medium hover:bg-red-50 rounded-xl transition-all"
                >
                  <LogOut className="w-5 h-5" />
                  تسجيل الخروج
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 lg:px-8 sticky top-0 z-30 select-none">
          {/* Animated Mobile Search Bar Overlay */}
          <AnimatePresence>
            {mobileSearchOpen && (
              <motion.div
                initial={{ opacity: 0, y: -12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.15 }}
                className="absolute inset-0 bg-white flex items-center px-4 gap-4 z-50 shadow-sm"
              >
                <div className="flex items-center gap-2 bg-slate-100 px-3 py-2 rounded-xl border border-slate-200 w-full">
                  <Search className="w-4 h-4 text-slate-400 shrink-0" />
                  <input
                    type="text"
                    placeholder="بحث باسم، رقم قضية أو آلي..."
                    className="bg-transparent border-none focus:ring-0 text-sm w-full placeholder:text-slate-450 font-medium text-right"
                    value={searchQuery}
                    onChange={handleSearch}
                    autoFocus
                  />
                </div>
                <button
                  onClick={() => {
                    setMobileSearchOpen(false);
                    setSearchQuery('');
                    setIsSearching(false);
                  }}
                  className="p-2 text-indigo-650 hover:text-indigo-850 text-xs font-black shrink-0 rtl"
                >
                  إلغاء
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex items-center gap-4 w-full justify-between lg:justify-start">
            <div className="flex items-center gap-3">
              {/* Hamburger menu - visible on desktop/tablet to slide layout, hidden on small screens if tab menu preferred */}
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-2 hover:bg-slate-100 rounded-lg shrink-0"
              >
                <Menu className="w-6 h-6 text-slate-650" />
              </button>

              {/* Mobile Centered Brand Header / Logo */}
              <div className="lg:hidden flex items-center gap-2">
                <div className="p-1 px-1.5 bg-indigo-600 rounded-lg text-white font-bold shadow-md shadow-indigo-100">
                  <Scale className="w-4 h-4 text-white" />
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-black text-slate-900 tracking-tight leading-tight">الأمين</span>
                  <span className="text-[8px] font-black text-slate-450 leading-none">تطبيق القانون</span>
                </div>
              </div>
            </div>

            {/* Desktop-only Search Bar (standard) */}
            <div className="hidden lg:block relative">
              <div className="flex items-center gap-2 bg-slate-100 px-4 py-2 rounded-xl border border-slate-200 w-96">
                <Search className="w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="بحث بالاسم، رقم القضية، أو الرقم الآلي..."
                  className="bg-transparent border-none focus:ring-0 text-sm w-full placeholder:text-slate-400 font-medium"
                  value={searchQuery}
                  onChange={handleSearch}
                />
              </div>
            </div>

            {/* Active search dropdown indicator */}
            <AnimatePresence>
              {isSearching && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="absolute top-full right-4 left-4 lg:right-auto lg:left-0 lg:w-96 mt-2 bg-white rounded-2xl shadow-2xl border border-slate-150 overflow-hidden z-50 max-h-96 overflow-y-auto"
                >
                  <div className="p-2 space-y-1">
                    {searchResults.map((res, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          handleResultClick(res);
                          setMobileSearchOpen(false);
                        }}
                        className="w-full p-3.5 text-right hover:bg-indigo-50/70 rounded-xl transition-all flex items-center justify-between group"
                      >
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-8 h-8 rounded-lg flex items-center justify-center",
                            res.type === 'case' ? "bg-indigo-100 text-indigo-650" :
                            res.type === 'client' ? "bg-emerald-100 text-emerald-650" : "bg-amber-100 text-amber-650"
                          )}>
                            {res.type === 'case' ? <Briefcase className="w-4 h-4" /> :
                             res.type === 'client' ? <Users className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                          </div>
                          <div>
                            <p className="text-sm font-black text-slate-900 group-hover:text-indigo-600 transition-colors">{res.title}</p>
                            <p className="text-[10px] font-bold text-slate-400 mt-0.5">{res.subtitle}</p>
                          </div>
                        </div>
                        <span className="text-[9px] font-black text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                          {res.extra}
                        </span>
                      </button>
                    ))}
                    {searchResults.length === 0 && (
                      <div className="p-8 text-center text-slate-450 font-bold text-xs">
                        لا توجد نتائج بحث مطابقة
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="flex items-center gap-2.5 lg:gap-6 shrink-0">
            {/* Quick Mobile magnifying search glass trigger button */}
            <button
              onClick={() => setMobileSearchOpen(true)}
              className="lg:hidden p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800 rounded-xl transition-all"
              title="بحث سريع"
            >
              <Search className="w-5.5 h-5.5" />
            </button>

            <button
              onClick={() => setNotifCenterOpen(true)}
              className="relative p-2 text-slate-500 hover:bg-slate-100 rounded-xl transition-all"
              title="الإشعارات"
            >
              <Bell className="w-5.5 h-5.5" />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-red-500 text-white text-[9px] font-black rounded-full border-2 border-white flex items-center justify-center animate-pulse">
                  {unreadCount}
                </span>
              )}
            </button>
            <div className="h-7 w-px bg-slate-200 hidden sm:block"></div>
            <div className="flex items-center gap-2.5">
              <div className="hidden sm:block text-right">
                <p className="text-xs font-black text-slate-800 leading-none mb-1">{user?.name}</p>
                <p className="text-[9px] text-slate-450 font-black uppercase tracking-wider">{user?.role === 'admin' ? 'مدير النظام' : user?.role === 'lawyer' ? 'المستشار المحامي' : user?.role === 'staff' ? 'معاون قانوني' : 'الموكل المنسق'}</p>
              </div>
              <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-black shadow-md shadow-indigo-100 border border-indigo-500">
                {user?.name?.[0] || 'U'}
              </div>
            </div>
          </div>
        </header>

        {/* Page Content View with Mobile Safe bottom space */}
        <div className="p-4 lg:p-8 overflow-y-auto pb-28 lg:pb-8 flex-1">
          {children}
        </div>

        {/* Unified Premium bottom navigation bar tab-bar on mobile viewports */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 h-16 bg-white/95 backdrop-blur-md border-t border-slate-200 flex items-center justify-around px-2 z-45 pb-safe shadow-[0_-5px_15px_rgba(0,0,0,0.03)] selection:bg-transparent">
          {getMobileTabItems(user?.role || '').map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex flex-col items-center justify-center flex-1 h-full py-1 text-xs transition-all duration-200 gap-0.5",
                  isActive ? "text-indigo-600 scale-105" : "text-slate-400 hover:text-slate-650"
                )}
              >
                <Icon className={cn("w-5.5 h-5.5 transition-transform duration-150", isActive ? "stroke-[2.5px] text-indigo-600" : "text-slate-400")} />
                <span className="text-[10px] leading-none mt-1 font-bold whitespace-nowrap">{item.label}</span>
              </Link>
            );
          })}
          
          <button
            onClick={() => setSidebarOpen(true)}
            className="flex flex-col items-center justify-center flex-1 h-full py-1 text-xs text-slate-400 hover:text-slate-650 transition-all duration-200 gap-0.5"
          >
            <Menu className="w-5.5 h-5.5 text-slate-400" />
            <span className="text-[10px] leading-none mt-1 font-bold">المزيد</span>
          </button>
        </nav>

        <NotificationCenter
          isOpen={notifCenterOpen}
          onClose={() => setNotifCenterOpen(false)}
          user={user}
        />
      </main>
    </div>
  );
}
