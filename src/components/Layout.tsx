import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { signOut } from 'firebase/auth';
import { collection, query, where, onSnapshot, orderBy, limit } from 'firebase/firestore';
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
  MessageSquare
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { UserProfile, AppNotification, Case } from '../types';

import NotificationCenter, { generateNotifications } from './NotificationCenter';

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
  const [searchResults, setSearchResults] = useState<{ type: 'case' | 'client' | 'task'; id: string; title: string; subtitle: string; extra?: string }[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const filteredNavItems = navItems.filter(item => 
    !user || item.roles.includes(user.role)
  );

  useEffect(() => {
    if (!user) return;

    // Generate notifications on login
    generateNotifications(user.uid, user.role);

    const unsubNotifs = onSnapshot(
      query(collection(db, 'notifications'), where('userId', '==', user.uid), where('isRead', '==', false), limit(10)),
      (snapshot) => {
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

    return () => {
      unsubNotifs();
      unsubCases();
      unsubClients();
      unsubTasks();
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
            <span className="text-[10px] font-bold text-slate-500 mt-1">مكتب المحامي محمد امين علي الصايغ</span>
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

        <div className="p-4 border-t border-slate-100">
          <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl mb-4">
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
                    <span className="text-[8px] font-bold text-slate-500">مكتب المحامي محمد امين علي الصايغ</span>
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
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 lg:px-8 sticky top-0 z-30">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 hover:bg-slate-100 rounded-lg"
            >
              <Menu className="w-6 h-6 text-slate-600" />
            </button>
            <div className="hidden md:block relative">
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
              
              {/* Search Results Dropdown */}
              <AnimatePresence>
                {isSearching && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute top-full mt-2 w-full bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden z-50"
                  >
                    <div className="p-2 space-y-1">
                      {searchResults.map((res, i) => (
                        <button
                          key={i}
                          onClick={() => handleResultClick(res)}
                          className="w-full p-3 text-right hover:bg-indigo-50 rounded-xl transition-all flex items-center justify-between group"
                        >
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "w-8 h-8 rounded-lg flex items-center justify-center",
                              res.type === 'case' ? "bg-indigo-100 text-indigo-600" :
                              res.type === 'client' ? "bg-emerald-100 text-emerald-600" : "bg-amber-100 text-amber-600"
                            )}>
                              {res.type === 'case' ? <Briefcase className="w-4 h-4" /> :
                               res.type === 'client' ? <Users className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                            </div>
                            <div>
                              <p className="text-sm font-black text-slate-900 group-hover:text-indigo-600 transition-colors">{res.title}</p>
                              <p className="text-[10px] font-bold text-slate-400">{res.subtitle}</p>
                            </div>
                          </div>
                          <span className="text-[10px] font-black text-slate-500 bg-slate-100 px-2 py-1 rounded-lg">
                            {res.extra}
                          </span>
                        </button>
                      ))}
                      {searchResults.length === 0 && (
                        <div className="p-8 text-center text-slate-400 font-bold text-sm">
                          لا توجد نتائج بحث
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          <div className="flex items-center gap-3 lg:gap-6">
            <button
              onClick={() => setNotifCenterOpen(true)}
              className="relative p-2 text-slate-500 hover:bg-slate-100 rounded-xl transition-all"
            >
              <Bell className="w-6 h-6" />
              {unreadCount > 0 && (
                <span className="absolute top-2 right-2 w-4 h-4 bg-red-500 text-white text-[10px] font-black rounded-full border-2 border-white flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </button>
            <div className="h-8 w-px bg-slate-200 hidden sm:block"></div>
            <div className="flex items-center gap-3">
              <div className="hidden sm:block text-left">
                <p className="text-sm font-bold text-slate-900 leading-none mb-1">{user?.name}</p>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider text-right">{user?.role}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold shadow-md shadow-indigo-100">
                {user?.name?.[0] || 'U'}
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="p-4 lg:p-8 overflow-y-auto">
          {children}
        </div>

        <NotificationCenter
          isOpen={notifCenterOpen}
          onClose={() => setNotifCenterOpen(false)}
          user={user}
        />
      </main>
    </div>
  );
}
