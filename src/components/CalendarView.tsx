import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Calendar as CalendarIcon, ChevronRight, ChevronLeft, Clock, Users, Gavel, CheckCircle2, AlertCircle, Plus, Search, Filter, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Session, ExpertSession, Task, Judgment, Case, UserProfile } from '../types';
import { cn } from '../lib/utils';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  isSameMonth, 
  isSameDay, 
  addMonths, 
  subMonths,
  isToday,
  parseISO
} from 'date-fns';
import { ar } from 'date-fns/locale';

type CalendarEvent = {
  id: string;
  type: 'session' | 'expert' | 'task' | 'deadline';
  title: string;
  date: Date;
  status?: string;
  caseId?: string;
  caseNumber?: string;
};

interface CalendarViewProps {
  user: UserProfile;
}

export default function CalendarView({ user }: CalendarViewProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cq = query(collection(db, 'cases'));
    if (user.role === 'client') {
      cq = query(collection(db, 'cases'), where('clientId', '==', user.uid));
    }

    const unsubCases = onSnapshot(cq, (snapshot) => {
      setCases(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Case)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'cases'));

    return () => unsubCases();
  }, [user.uid, user.role]);

  useEffect(() => {
    if (cases.length === 0 && user.role === 'client') {
      setEvents([]);
      setLoading(false);
      return;
    }

    const unsubSessions = onSnapshot(collection(db, 'sessions'), (snapshot) => {
      const sessionEvents = snapshot.docs
        .map(doc => {
          const data = doc.data() as Session;
          const caseInfo = cases.find(c => c.id === data.caseId);
          if (user.role === 'client' && !caseInfo) return null;
          const event: CalendarEvent = {
            id: doc.id,
            type: 'session',
            title: `جلسة: ${caseInfo?.caseNumber || '---'}`,
            date: parseISO(data.date),
            caseId: data.caseId,
            caseNumber: caseInfo?.caseNumber
          };
          return event;
        })
        .filter((e): e is CalendarEvent => e !== null);
      updateEvents('session', sessionEvents);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'sessions'));

    const unsubExperts = onSnapshot(collection(db, 'expertSessions'), (snapshot) => {
      const expertEvents = snapshot.docs
        .map(doc => {
          const data = doc.data() as ExpertSession;
          const caseInfo = cases.find(c => c.id === data.caseId);
          if (user.role === 'client' && !caseInfo) return null;
          const event: CalendarEvent = {
            id: doc.id,
            type: 'expert',
            title: `خبير: ${data.expertName}`,
            date: parseISO(data.date),
            status: data.status,
            caseId: data.caseId,
            caseNumber: caseInfo?.caseNumber
          };
          return event;
        })
        .filter((e): e is CalendarEvent => e !== null);
      updateEvents('expert', expertEvents);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'expertSessions'));

    const unsubTasks = onSnapshot(collection(db, 'tasks'), (snapshot) => {
      if (user.role === 'client') {
        updateEvents('task', []);
        return;
      }
      const taskEvents: CalendarEvent[] = snapshot.docs.map(doc => {
        const data = doc.data() as Task;
        return {
          id: doc.id,
          type: 'task',
          title: `مهمة: ${data.title}`,
          date: parseISO(data.dueDate),
          status: data.status
        };
      });
      updateEvents('task', taskEvents);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'tasks'));

    const unsubJudgments = onSnapshot(collection(db, 'judgments'), (snapshot) => {
      const deadlineEvents = snapshot.docs
        .filter(doc => doc.data().appealDeadline)
        .map(doc => {
          const data = doc.data() as Judgment;
          const caseInfo = cases.find(c => c.id === data.caseId);
          if (user.role === 'client' && !caseInfo) return null;
          const event: CalendarEvent = {
            id: doc.id,
            type: 'deadline',
            title: `موعد استئناف: ${caseInfo?.caseNumber || '---'}`,
            date: parseISO(data.appealDeadline),
            caseId: data.caseId,
            caseNumber: caseInfo?.caseNumber
          };
          return event;
        })
        .filter((e): e is CalendarEvent => e !== null);
      updateEvents('deadline', deadlineEvents);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'judgments'));

    return () => {
      unsubSessions();
      unsubExperts();
      unsubTasks();
      unsubJudgments();
    };
  }, [cases, user.role]);

  const updateEvents = (type: string, newEvents: CalendarEvent[]) => {
    setEvents(prev => {
      const filtered = prev.filter(e => e.type !== type);
      return [...filtered, ...newEvents];
    });
    setLoading(false);
  };

  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);

  const calendarDays = eachDayOfInterval({
    start: startDate,
    end: endDate,
  });

  const getEventsForDay = (day: Date) => {
    return events.filter(event => {
      const isSame = isSameDay(event.date, day);
      if (!isSame) return false;
      // If client, only show events for their cases
      if (user.role === 'client') {
        if (event.type === 'task') return false; // Tasks are internal
        return cases.some(c => c.id === event.caseId);
      }
      return true;
    });
  };

  const selectedDayEvents = getEventsForDay(selectedDate);

  const eventTypeStyles = {
    session: "bg-indigo-50 text-indigo-700 border-indigo-100",
    expert: "bg-amber-50 text-amber-700 border-amber-100",
    task: "bg-emerald-50 text-emerald-700 border-emerald-100",
    deadline: "bg-red-50 text-red-700 border-red-100"
  };

  const eventTypeIcons = {
    session: Gavel,
    expert: Users,
    task: CheckCircle2,
    deadline: AlertCircle
  };

  return (
    <div className="space-y-6 rtl pb-20" dir="rtl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 mb-1">التقويم القانوني</h1>
          <p className="text-slate-500 font-medium">عرض شامل لجميع الجلسات، المواعيد، والمهام.</p>
        </div>
        <div className="flex items-center gap-2 bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
          <button onClick={prevMonth} className="p-2 hover:bg-slate-50 rounded-lg transition-all">
            <ChevronRight className="w-5 h-5 text-slate-600" />
          </button>
          <span className="px-4 font-black text-slate-900 min-w-[140px] text-center">
            {format(currentMonth, 'MMMM yyyy', { locale: ar })}
          </span>
          <button onClick={nextMonth} className="p-2 hover:bg-slate-50 rounded-lg transition-all">
            <ChevronLeft className="w-5 h-5 text-slate-600" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Calendar Grid */}
        <div className="lg:col-span-3 bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="grid grid-cols-7 border-b border-slate-100">
            {['أحد', 'اثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'].map((day) => (
              <div key={day} className="p-4 text-center text-xs font-black text-slate-400 uppercase tracking-widest">
                {day}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {calendarDays.map((day, idx) => {
              const dayEvents = getEventsForDay(day);
              const isSelected = isSameDay(day, selectedDate);
              const isCurrentMonth = isSameMonth(day, monthStart);
              const isTodayDay = isToday(day);

              return (
                <div
                  key={idx}
                  onClick={() => setSelectedDate(day)}
                  className={cn(
                    "min-h-[120px] p-2 border-b border-l border-slate-50 cursor-pointer transition-all hover:bg-slate-50/50 group relative",
                    !isCurrentMonth && "bg-slate-50/30",
                    isSelected && "bg-indigo-50/30 ring-1 ring-inset ring-indigo-100"
                  )}
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className={cn(
                      "w-7 h-7 flex items-center justify-center rounded-lg text-sm font-black transition-all",
                      isTodayDay ? "bg-indigo-600 text-white shadow-lg shadow-indigo-100" :
                      isSelected ? "text-indigo-600" :
                      isCurrentMonth ? "text-slate-900" : "text-slate-300"
                    )}>
                      {format(day, 'd')}
                    </span>
                    {dayEvents.length > 0 && (
                      <span className="text-[10px] font-black text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-md">
                        {dayEvents.length}
                      </span>
                    )}
                  </div>
                  
                  <div className="space-y-1 overflow-hidden">
                    {dayEvents.slice(0, 3).map((event) => {
                      const Icon = eventTypeIcons[event.type];
                      return (
                        <div
                          key={event.id}
                          className={cn(
                            "px-2 py-1 rounded-md text-[9px] font-black border truncate flex items-center gap-1",
                            eventTypeStyles[event.type]
                          )}
                        >
                          <Icon className="w-2.5 h-2.5 shrink-0" />
                          {event.title}
                        </div>
                      );
                    })}
                    {dayEvents.length > 3 && (
                      <div className="text-[8px] font-black text-slate-400 pr-2">
                        + {dayEvents.length - 3} المزيد
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Day Details Sidebar */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
            <h2 className="text-lg font-black text-slate-900 mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-indigo-600" />
              أحداث {format(selectedDate, 'd MMMM', { locale: ar })}
            </h2>
            
            <div className="space-y-4">
              {selectedDayEvents.length > 0 ? (
                selectedDayEvents.map((event) => {
                  const Icon = eventTypeIcons[event.type];
                  return (
                    <motion.div
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      key={event.id}
                      className={cn(
                        "p-4 rounded-2xl border-2 flex items-start gap-3 transition-all hover:scale-[1.02]",
                        eventTypeStyles[event.type]
                      )}
                    >
                      <div className="p-2 rounded-xl bg-white/50">
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-black truncate">{event.title}</h4>
                        {event.caseNumber && (
                          <p className="text-[10px] font-bold opacity-70 mt-0.5">
                            رقم القضية: {event.caseNumber}
                          </p>
                        )}
                        {event.status && (
                          <span className="inline-block mt-2 px-2 py-0.5 rounded-lg bg-white/50 text-[9px] font-black uppercase">
                            {event.status}
                          </span>
                        )}
                      </div>
                    </motion.div>
                  );
                })
              ) : (
                <div className="text-center py-12 px-4">
                  <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CalendarIcon className="w-8 h-8 text-slate-200" />
                  </div>
                  <p className="text-slate-400 font-bold text-sm">لا توجد أحداث مسجلة لهذا اليوم</p>
                </div>
              )}
            </div>
          </div>

          {/* Legend */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">دليل الألوان</h3>
            <div className="space-y-3">
              {[
                { label: 'جلسات المحاكم', type: 'session' },
                { label: 'جلسات الخبراء', type: 'expert' },
                { label: 'المهام الإدارية', type: 'task' },
                { label: 'مواعيد الاستئناف', type: 'deadline' },
              ].map((item) => (
                <div key={item.type} className="flex items-center gap-3">
                  <div className={cn("w-3 h-3 rounded-full border", eventTypeStyles[item.type as keyof typeof eventTypeStyles].split(' ')[0])}></div>
                  <span className="text-xs font-bold text-slate-600">{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
