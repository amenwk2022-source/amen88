import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, orderBy, limit, updateDoc, doc, getDocs, addDoc, getDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { AppNotification, Case, Session, ExpertSession, Task, Judgment } from '../types';
import { Bell, X, Check, Calendar, Users, Briefcase, AlertCircle, Clock, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format, isWithinInterval, addDays, startOfDay, endOfDay, parseISO, differenceInDays } from 'date-fns';
import { arSA } from 'date-fns/locale';
import { cn } from '../lib/utils';
import { useNavigate } from 'react-router-dom';

interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
  user: any;
}

export default function NotificationCenter({ isOpen, onClose, user }: NotificationCenterProps) {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    // Only show notifications relevant to the user's role
    // For clients, only show notifications related to their cases
      const q = query(
        collection(db, 'notifications'),
        where('userId', '==', user.uid),
        orderBy('date', 'desc'),
        limit(20)
      );

    const unsub = onSnapshot(q, (snapshot) => {
      setNotifications(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AppNotification)));
      setLoading(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'notifications');
    });

    return unsub;
  }, [user]);

  const markAsRead = async (id: string) => {
    try {
      await updateDoc(doc(db, 'notifications', id), { isRead: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'notifications');
    }
  };

  const markAllAsRead = async () => {
    try {
      const unread = notifications.filter(n => !n.isRead);
      for (const n of unread) {
        await updateDoc(doc(db, 'notifications', n.id), { isRead: true });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'notifications');
    }
  };

  const getIcon = (type: AppNotification['type']) => {
    switch (type) {
      case 'session': return <Calendar className="w-4 h-4" />;
      case 'expert': return <Users className="w-4 h-4" />;
      case 'deadline': return <AlertCircle className="w-4 h-4" />;
      case 'task': return <CheckCircle2 className="w-4 h-4" />;
      default: return <Bell className="w-4 h-4" />;
    }
  };

  const getColor = (type: AppNotification['type']) => {
    switch (type) {
      case 'session': return 'text-indigo-600 bg-indigo-50';
      case 'expert': return 'text-amber-600 bg-amber-50';
      case 'deadline': return 'text-red-600 bg-red-50';
      case 'task': return 'text-emerald-600 bg-emerald-50';
      default: return 'text-slate-600 bg-slate-50';
    }
  };

  const handleNotificationClick = async (notif: AppNotification) => {
    await markAsRead(notif.id);
    onClose();

    if (notif.link) {
      navigate(notif.link);
      return;
    }

    // Default navigation based on type
    switch (notif.type) {
      case 'session':
      case 'deadline':
        if (notif.relatedId) {
          // If it's a session or judgment, we might need to find the caseId
          // For simplicity, we can navigate to cases or a specific case if we store caseId in metadata
          navigate(`/cases?id=${notif.relatedId}`);
        } else {
          navigate('/cases');
        }
        break;
      case 'expert':
        navigate('/expert-sessions');
        break;
      case 'task':
        navigate('/tasks');
        break;
      default:
        break;
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/20 backdrop-blur-[2px] z-[60]"
          />
          <motion.div
            initial={{ opacity: 0, x: 20, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 20, scale: 0.95 }}
            className="fixed top-20 left-4 md:left-8 w-full max-w-sm bg-white rounded-3xl shadow-2xl border border-slate-100 z-[70] overflow-hidden flex flex-col max-h-[80vh]"
          >
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-indigo-600" />
                <h2 className="text-lg font-black text-slate-900">التنبيهات</h2>
                {notifications.filter(n => !n.isRead).length > 0 && (
                  <span className="bg-red-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full">
                    {notifications.filter(n => !n.isRead).length}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={markAllAsRead}
                  className="text-[10px] font-black text-indigo-600 hover:bg-indigo-50 px-2 py-1 rounded-lg transition-all"
                >
                  تحديد الكل كمقروء
                </button>
                <button onClick={onClose} className="p-2 hover:bg-white rounded-xl transition-all">
                  <X className="w-4 h-4 text-slate-400" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {notifications.length === 0 ? (
                <div className="py-12 text-center">
                  <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Bell className="w-8 h-8 text-slate-200" />
                  </div>
                  <p className="text-slate-400 font-bold text-sm">لا توجد تنبيهات حالياً</p>
                </div>
              ) : (
                notifications.map((notif) => (
                  <motion.div
                    layout
                    key={notif.id}
                    onClick={() => handleNotificationClick(notif)}
                    className={cn(
                      "p-4 rounded-2xl border transition-all cursor-pointer relative group",
                      notif.isRead ? "bg-white border-slate-100 opacity-60" : "bg-white border-indigo-100 shadow-sm ring-1 ring-indigo-50"
                    )}
                  >
                    {!notif.isRead && (
                      <span className="absolute top-4 right-4 w-2 h-2 bg-indigo-600 rounded-full" />
                    )}
                    <div className="flex gap-4">
                      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", getColor(notif.type))}>
                        {getIcon(notif.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-black text-slate-900 mb-1 leading-tight">{notif.title}</h4>
                        <p className="text-xs text-slate-500 font-medium mb-2 line-clamp-2">{notif.message}</p>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {format(new Date(notif.date), 'hh:mm a', { locale: arSA })}
                          </span>
                          {!notif.isRead && (
                            <button className="text-[10px] font-black text-indigo-600 opacity-0 group-hover:opacity-100 transition-all">
                              إخفاء
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))
              )}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 text-center">
              <button className="text-xs font-black text-slate-500 hover:text-indigo-600 transition-all">
                عرض جميع التنبيهات المؤرشفة
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// Helper function to generate notifications (can be called from App.tsx or Layout.tsx)
export async function generateNotifications(userId: string, role: string) {
  const today = startOfDay(new Date());
  const inTwoDays = endOfDay(addDays(today, 2));

  try {
    // Get user's cases if client, otherwise all cases (or relevant ones)
    let userCaseIds: string[] = [];
    if (role === 'client') {
      const casesSnap = await getDocs(query(collection(db, 'cases'), where('clientId', '==', userId)));
      userCaseIds = casesSnap.docs.map(d => d.id);
      if (userCaseIds.length === 0) return; // No cases, no notifications
    }

    // 1. Check for upcoming sessions
    let sessionsQuery = query(collection(db, 'sessions'));
    const sessionsSnap = await getDocs(sessionsQuery);
    const sessions = sessionsSnap.docs
      .map(d => ({ id: d.id, ...d.data() } as Session))
      .filter(s => role !== 'client' || userCaseIds.includes(s.caseId));
    
    for (const session of sessions) {
      if (!session.date) {
        console.warn('NotificationCenter: Session missing date:', session.id);
        continue;
      }
      let sessionDate: Date;
      try {
        sessionDate = parseISO(session.date);
        if (isNaN(sessionDate.getTime())) throw new Error('Invalid date');
      } catch (e) {
        console.error('NotificationCenter: Error parsing session date:', session.date, e);
        continue;
      }

      if (isWithinInterval(sessionDate, { start: today, end: inTwoDays })) {
        // Check if already notified
        const existing = await getDocs(query(
          collection(db, 'notifications'), 
          where('relatedId', '==', session.id), 
          where('userId', '==', userId),
          where('type', '==', 'session')
        ));
        
        if (existing.empty) {
          await addDoc(collection(db, 'notifications'), {
            userId,
            title: 'جلسة قادمة قريباً',
            message: `لديك جلسة في قضية رقم ${session.caseId} بتاريخ ${format(sessionDate, 'dd MMMM', { locale: arSA })}`,
            type: 'session',
            relatedId: session.caseId, // Use caseId for navigation
            isRead: false,
            date: new Date().toISOString(),
            link: `/cases?id=${session.caseId}`
          });
        }
      }
    }

    // 2. Check for upcoming expert sessions
    const expertSnap = await getDocs(collection(db, 'expertSessions'));
    const expertSessions = expertSnap.docs
      .map(d => ({ id: d.id, ...d.data() } as ExpertSession))
      .filter(s => role !== 'client' || userCaseIds.includes(s.caseId));

    for (const session of expertSessions) {
      if (!session.date) {
        console.warn('NotificationCenter: Expert session missing date:', session.id);
        continue;
      }
      let sessionDate: Date;
      try {
        sessionDate = parseISO(session.date);
        if (isNaN(sessionDate.getTime())) throw new Error('Invalid date');
      } catch (e) {
        console.error('NotificationCenter: Error parsing expert session date:', session.date, e);
        continue;
      }

      if (isWithinInterval(sessionDate, { start: today, end: inTwoDays })) {
        const existing = await getDocs(query(
          collection(db, 'notifications'), 
          where('relatedId', '==', session.id), 
          where('userId', '==', userId),
          where('type', '==', 'expert')
        ));
        
        if (existing.empty) {
          await addDoc(collection(db, 'notifications'), {
            userId,
            title: 'موعد خبير قادم',
            message: `موعد مع الخبير ${session.expertName} بتاريخ ${format(sessionDate, 'dd MMMM', { locale: arSA })}`,
            type: 'expert',
            relatedId: session.id,
            isRead: false,
            date: new Date().toISOString(),
            link: '/expert-sessions'
          });
        }
      }
    }

    // 3. Check for tasks assigned to user (Internal only)
    if (role !== 'client') {
      const tasksSnap = await getDocs(query(collection(db, 'tasks'), where('assignedTo', '==', userId), where('status', '!=', 'completed')));
      const tasks = tasksSnap.docs.map(d => ({ id: d.id, ...d.data() } as Task));

      for (const task of tasks) {
        if (!task.dueDate) {
          console.warn('NotificationCenter: Task missing dueDate:', task.id);
          continue;
        }
        let dueDate: Date;
        try {
          dueDate = parseISO(task.dueDate);
          if (isNaN(dueDate.getTime())) throw new Error('Invalid date');
        } catch (e) {
          console.error('NotificationCenter: Error parsing task dueDate:', task.dueDate, e);
          continue;
        }

        if (isWithinInterval(dueDate, { start: today, end: inTwoDays })) {
          const existing = await getDocs(query(
            collection(db, 'notifications'), 
            where('relatedId', '==', task.id), 
            where('userId', '==', userId),
            where('type', '==', 'task')
          ));
          
          if (existing.empty) {
            await addDoc(collection(db, 'notifications'), {
              userId,
              title: 'موعد نهائي لمهمة',
              message: `المهمة "${task.title}" تنتهي قريباً بتاريخ ${format(dueDate, 'dd MMMM', { locale: arSA })}`,
              type: 'task',
              relatedId: task.id,
              isRead: false,
              date: new Date().toISOString(),
              link: '/tasks'
            });
          }
        }
      }
    }

    // 4. Check for legal deadlines (Judgments)
    const judgmentsSnap = await getDocs(collection(db, 'judgments'));
    const judgments = judgmentsSnap.docs
      .map(d => ({ id: d.id, ...d.data() } as Judgment))
      .filter(j => role !== 'client' || userCaseIds.includes(j.caseId));

    for (const judgment of judgments) {
      if (judgment.isAppealed) continue;
      
      if (!judgment.appealDeadline) {
        console.warn('NotificationCenter: Judgment missing appealDeadline:', judgment.id);
        continue;
      }
      let deadlineDate: Date;
      try {
        deadlineDate = parseISO(judgment.appealDeadline);
        if (isNaN(deadlineDate.getTime())) throw new Error('Invalid date');
      } catch (e) {
        console.error('NotificationCenter: Error parsing judgment appealDeadline:', judgment.appealDeadline, e);
        continue;
      }
      
      const daysLeft = differenceInDays(deadlineDate, new Date());

      // Notify if deadline is within 7 days
      if (daysLeft <= 7 && daysLeft >= 0) {
        const existing = await getDocs(query(
          collection(db, 'notifications'), 
          where('relatedId', '==', judgment.id), 
          where('userId', '==', userId),
          where('type', '==', 'deadline')
        ));
        
        if (existing.empty) {
          await addDoc(collection(db, 'notifications'), {
            userId,
            title: 'اقتراب موعد الاستئناف',
            message: `بقي ${daysLeft} أيام على انتهاء مدة الاستئناف في قضية رقم ${judgment.caseId}`,
            type: 'deadline',
            relatedId: judgment.caseId,
            isRead: false,
            date: new Date().toISOString(),
            link: `/cases?id=${judgment.caseId}`
          });
        }
      }
    }

  } catch (err) {
    console.error('Error generating notifications:', err);
  }
}
