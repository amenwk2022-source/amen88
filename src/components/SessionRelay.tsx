import React, { useState, useEffect } from 'react';
import { collection, addDoc, onSnapshot, query, orderBy, doc, updateDoc, where } from 'firebase/firestore';
import { db } from '../firebase';
import { CalendarClock, ArrowRightLeft, AlertCircle, CheckCircle2, Clock, Search, Filter, Download, MessageSquare, Save, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Session, Case } from '../types';
import { cn } from '../lib/utils';
import { format, isPast, isToday, isFuture } from 'date-fns';
import { ar } from 'date-fns/locale';

export default function SessionRelay() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'today' | 'upcoming' | 'omitted'>('today');
  const [editingSession, setEditingSession] = useState<Session | null>(null);
  const [decision, setDecision] = useState('');
  const [nextDate, setNextDate] = useState('');

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'sessions'), (snapshot) => {
      setSessions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Session)));
      setLoading(false);
    });

    const casesUnsub = onSnapshot(collection(db, 'cases'), (snapshot) => {
      setCases(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Case)));
    });

    return () => {
      unsub();
      casesUnsub();
    };
  }, []);

  const handleRelay = async (session: Session) => {
    if (!decision || !nextDate) {
      alert('يرجى إدخال القرار وتاريخ الجلسة القادمة');
      return;
    }

    try {
      // 1. Update current session with decision
      await updateDoc(doc(db, 'sessions', session.id), {
        decision,
        nextDate,
        updatedAt: new Date().toISOString()
      });

      // 2. Create new session for the next date (Relay)
      await addDoc(collection(db, 'sessions'), {
        caseId: session.caseId,
        date: nextDate,
        decision: '',
        nextDate: '',
        lawyerId: session.lawyerId,
        createdAt: new Date().toISOString()
      });

      setEditingSession(null);
      setDecision('');
      setNextDate('');
    } catch (error) {
      console.error('Error relaying session:', error);
    }
  };

  const todayStr = new Date().toISOString().split('T')[0];
  
  const filteredSessions = sessions.filter(s => {
    const sDate = s.date.split('T')[0];
    if (activeTab === 'today') return sDate === todayStr;
    if (activeTab === 'upcoming') return sDate > todayStr;
    if (activeTab === 'omitted') return sDate < todayStr && !s.decision;
    return true;
  }).map(s => ({
    ...s,
    caseInfo: cases.find(c => c.id === s.caseId)
  }));

  return (
    <div className="space-y-6 rtl" dir="rtl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 mb-1">محرك ترحيل الجلسات (Relay & Tracking)</h1>
          <p className="text-slate-500 font-medium">إدارة رول الجلسات اليومي وترحيل القرارات آلياً.</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-xl font-bold text-sm hover:bg-slate-50 transition-all shadow-sm">
            <Download className="w-4 h-4" />
            تصدير الرول (PDF)
          </button>
          <button className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-xl font-bold text-sm hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100">
            <MessageSquare className="w-4 h-4" />
            إرسال عبر WhatsApp
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-4 border-b border-slate-200">
        {[
          { id: 'today', label: 'رول اليوم', icon: Clock, count: sessions.filter(s => s.date.split('T')[0] === todayStr).length },
          { id: 'upcoming', label: 'الجلسات القادمة', icon: CalendarClock, count: sessions.filter(s => s.date.split('T')[0] > todayStr).length },
          { id: 'omitted', label: 'كاشف السهو', icon: AlertCircle, count: sessions.filter(s => s.date.split('T')[0] < todayStr && !s.decision).length, color: 'red' },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                "flex items-center gap-2 px-6 py-4 font-bold text-sm transition-all border-b-2 -mb-px relative",
                isActive 
                  ? (tab.color === 'red' ? "border-red-600 text-red-600" : "border-indigo-600 text-indigo-600")
                  : "border-transparent text-slate-500 hover:text-slate-900"
              )}
            >
              <Icon className="w-5 h-5" />
              {tab.label}
              {tab.count > 0 && (
                <span className={cn(
                  "px-2 py-0.5 rounded-full text-[10px] font-black",
                  tab.color === 'red' ? "bg-red-100 text-red-600" : "bg-indigo-100 text-indigo-600"
                )}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Sessions List */}
      <div className="space-y-4">
        {filteredSessions.length > 0 ? filteredSessions.map((session) => (
          <motion.div
            layout
            key={session.id}
            className={cn(
              "bg-white p-6 rounded-2xl border transition-all",
              session.decision ? "border-slate-200 opacity-75" : "border-indigo-200 shadow-md shadow-indigo-50"
            )}
          >
            <div className="flex flex-col lg:flex-row lg:items-center gap-6">
              <div className="flex flex-col items-center justify-center bg-slate-50 p-4 rounded-2xl border border-slate-100 min-w-[120px]">
                <span className="text-xs font-black text-indigo-600 uppercase tracking-widest mb-1">
                  {format(new Date(session.date), 'MMMM', { locale: ar })}
                </span>
                <span className="text-3xl font-black text-slate-900 leading-none">{format(new Date(session.date), 'dd')}</span>
                <span className="text-[10px] font-bold text-slate-400 mt-1">{format(new Date(session.date), 'EEEE', { locale: ar })}</span>
              </div>

              <div className="flex-1 space-y-3">
                <div className="flex items-center gap-3">
                  <h3 className="text-lg font-black text-slate-900">
                    قضية: {session.caseInfo?.caseNumber || '---'} / {session.caseInfo?.year || '----'}
                  </h3>
                  <span className="px-2 py-1 bg-indigo-50 text-indigo-600 text-[10px] font-bold rounded-lg border border-indigo-100">
                    {session.caseInfo?.court || 'المحكمة غير محددة'}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400 font-bold">الموكل:</span>
                    <span className="text-slate-900 font-bold">{session.caseInfo?.clientName}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400 font-bold">الخصم:</span>
                    <span className="text-slate-900 font-bold">{session.caseInfo?.opponent || '---'}</span>
                  </div>
                </div>

                {session.decision ? (
                  <div className="mt-4 p-4 bg-emerald-50 rounded-xl border border-emerald-100 flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-bold text-emerald-900">القرار: {session.decision}</p>
                      {session.nextDate && (
                        <p className="text-xs text-emerald-700 font-medium mt-1">تاريخ الجلسة القادمة: {format(new Date(session.nextDate), 'yyyy/MM/dd')}</p>
                      )}
                    </div>
                  </div>
                ) : (
                  editingSession?.id === session.id ? (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-4 p-6 bg-indigo-50 rounded-2xl border border-indigo-200 space-y-4"
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-xs font-black text-indigo-900">قرار الجلسة</label>
                          <input
                            type="text"
                            placeholder="أدخل القرار المتخذ..."
                            className="w-full bg-white border border-indigo-200 rounded-xl px-4 py-2 text-sm font-medium focus:ring-2 focus:ring-indigo-600 outline-none"
                            value={decision}
                            onChange={(e) => setDecision(e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-black text-indigo-900">تاريخ الجلسة القادمة</label>
                          <input
                            type="date"
                            className="w-full bg-white border border-indigo-200 rounded-xl px-4 py-2 text-sm font-medium focus:ring-2 focus:ring-indigo-600 outline-none"
                            value={nextDate}
                            onChange={(e) => setNextDate(e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <button
                          onClick={() => handleRelay(session)}
                          className="flex-1 bg-indigo-600 text-white font-bold py-2 rounded-xl shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"
                        >
                          <Save className="w-4 h-4" />
                          حفظ وترحيل
                        </button>
                        <button
                          onClick={() => setEditingSession(null)}
                          className="px-6 bg-white text-slate-600 font-bold py-2 rounded-xl border border-indigo-200 hover:bg-slate-50 transition-all"
                        >
                          إلغاء
                        </button>
                      </div>
                    </motion.div>
                  ) : (
                    <button
                      onClick={() => {
                        setEditingSession(session);
                        setDecision('');
                        setNextDate('');
                      }}
                      className="mt-4 flex items-center gap-2 text-indigo-600 font-black text-sm hover:underline"
                    >
                      <ArrowRightLeft className="w-4 h-4" />
                      إدخال القرار وترحيل الجلسة
                    </button>
                  )
                )}
              </div>

              <div className="lg:border-r lg:pr-6 lg:border-slate-100 flex flex-col items-center justify-center gap-2">
                <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 border border-slate-200">
                  <Clock className="w-6 h-6" />
                </div>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">09:00 ص</span>
              </div>
            </div>
          </motion.div>
        )) : (
          <div className="text-center py-20 bg-white rounded-3xl border-2 border-dashed border-slate-200">
            <CalendarClock className="w-16 h-16 text-slate-200 mx-auto mb-4" />
            <h3 className="text-xl font-black text-slate-400">لا توجد جلسات في هذا الرول</h3>
            <p className="text-slate-300 font-medium">يمكنك إضافة جلسات جديدة من خلال صفحة إدارة القضايا.</p>
          </div>
        )}
      </div>
    </div>
  );
}
