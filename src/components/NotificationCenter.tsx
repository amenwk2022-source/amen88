import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, orderBy, limit, updateDoc, doc, getDocs, addDoc, getDoc, deleteDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { AppNotification, Case, Session, ExpertSession, Task, Judgment, UserNotificationSettings, Installment } from '../types';
import { Bell, X, Check, Calendar, Users, Briefcase, AlertCircle, Clock, CheckCircle2, MessageSquare, FileText, Settings as SettingsIcon, Trash2 } from 'lucide-react';
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

  const [showArchived, setShowArchived] = useState(false);

  useEffect(() => {
    if (!user) return;

    let q = query(
      collection(db, 'notifications'),
      where('userId', '==', user.uid),
      orderBy('date', 'desc'),
      limit(20)
    );

    if (!showArchived) {
      q = query(
        collection(db, 'notifications'),
        where('userId', '==', user.uid),
        where('isRead', '==', false),
        orderBy('date', 'desc'),
        limit(20)
      );
    }

    const unsub = onSnapshot(q, (snapshot) => {
      const fetchedNotifications = snapshot.docs.map(doc => {
        const data = doc.data();
        let date: Date | null = null;
        try {
          if (data.date) {
            date = typeof data.date === 'string' ? parseISO(data.date) : new Date(data.date);
            if (isNaN(date.getTime())) throw new Error('Invalid date');
          }
        } catch (e) {
          console.error('NotificationCenter: Error parsing notification date:', data.date, e);
        }
        return { 
          id: doc.id, 
          ...data, 
          date: date?.toISOString() || new Date().toISOString() 
        } as AppNotification;
      });
      setNotifications(fetchedNotifications);
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

  const deleteNotification = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await deleteDoc(doc(db, 'notifications', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'notifications');
    }
  };

  const getIcon = (type: AppNotification['type']) => {
    switch (type) {
      case 'session': return <Calendar className="w-4 h-4" />;
      case 'expert': return <Users className="w-4 h-4" />;
      case 'deadline': return <AlertCircle className="w-4 h-4" />;
      case 'task': return <CheckCircle2 className="w-4 h-4" />;
      case 'note': return <FileText className="w-4 h-4" />;
      case 'consultation': return <MessageSquare className="w-4 h-4" />;
      default: return <Bell className="w-4 h-4" />;
    }
  };

  const getColor = (type: AppNotification['type']) => {
    switch (type) {
      case 'session': return 'text-indigo-600 bg-indigo-50';
      case 'expert': return 'text-amber-600 bg-amber-50';
      case 'deadline': return 'text-red-600 bg-red-50';
      case 'task': return 'text-emerald-600 bg-emerald-50';
      case 'note': return 'text-blue-600 bg-blue-50';
      case 'consultation': return 'text-purple-600 bg-purple-50';
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
      case 'note':
        if (notif.relatedId) {
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
      case 'consultation':
        navigate('/consultations');
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
                  <span className="bg-red-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full animate-pulse">
                    {notifications.filter(n => !n.isRead).length}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    onClose();
                    navigate('/settings');
                  }}
                  className="p-2 hover:bg-white rounded-xl transition-all text-slate-400 hover:text-indigo-600"
                  title="إعدادات التنبيهات"
                >
                  <SettingsIcon className="w-4 h-4" />
                </button>
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
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="text-sm font-black text-slate-900 mb-1 leading-tight">{notif.title}</h4>
                          <button
                            onClick={(e) => deleteNotification(e, notif.id)}
                            className="p-1 text-slate-300 hover:text-red-500 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <p className="text-xs text-slate-500 font-medium mb-2 line-clamp-2">{notif.message}</p>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {format(new Date(notif.date), 'hh:mm a', { locale: arSA })}
                          </span>
                          {!notif.isRead && (
                            <span className="text-[10px] font-black text-indigo-600">
                              جديد
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))
              )}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 text-center">
              <button 
                onClick={() => setShowArchived(!showArchived)}
                className="text-xs font-black text-slate-500 hover:text-indigo-600 transition-all"
              >
                {showArchived ? 'عرض التنبيهات غير المقروءة فقط' : 'عرض جميع التنبيهات المؤرشفة'}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// Helper function to create a single notification with settings check
export async function createNotification(userId: string, notif: Omit<AppNotification, 'id' | 'isRead' | 'date' | 'userId'>) {
  try {
    // 1. Get user settings
    const settingsSnap = await getDoc(doc(db, 'notificationSettings', userId));
    const settings = settingsSnap.exists() ? settingsSnap.data() as UserNotificationSettings : null;

    // 2. Check if this type is enabled
    if (settings && !settings.types[notif.type as keyof typeof settings.types]) {
      return; // Type disabled by user
    }

    // 3. Check for duplicates (same type and relatedId for this user in the last 24h)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    const existing = await getDocs(query(
      collection(db, 'notifications'),
      where('userId', '==', userId),
      where('type', '==', notif.type),
      where('relatedId', '==', notif.relatedId || ''),
      where('date', '>=', yesterday.toISOString())
    ));

    if (!existing.empty) return;

    // 4. Create notification
    await addDoc(collection(db, 'notifications'), {
      ...notif,
      userId,
      isRead: false,
      date: new Date().toISOString()
    });

    // 5. Trigger browser notification if enabled
    if (settings?.browserNotifications && Notification.permission === 'granted') {
      new Notification(notif.title, {
        body: notif.message,
        icon: '/logo192.png' // Fallback icon
      });
    }
  } catch (err) {
    console.error('Error creating notification:', err);
  }
}

// Helper function to generate notifications (can be called from App.tsx or Layout.tsx)
export async function generateNotifications(userId: string, role: string) {
  const today = startOfDay(new Date());
  const inTwoDays = endOfDay(addDays(today, 2));

  try {
    // Get user settings first to avoid unnecessary work
    const settingsSnap = await getDoc(doc(db, 'notificationSettings', userId));
    const settings = settingsSnap.exists() ? settingsSnap.data() as UserNotificationSettings : null;

    // Get user's cases if client, otherwise all cases (or relevant ones)
    let userCaseIds: string[] = [];
    if (role === 'client') {
      const casesSnap = await getDocs(query(collection(db, 'cases'), where('clientId', '==', userId)));
      userCaseIds = casesSnap.docs.map(d => d.id);
      if (userCaseIds.length === 0) return; // No cases, no notifications
    }

    // 1. Check for upcoming sessions
    if (!settings || settings.types.session) {
      const sessionsSnap = await getDocs(collection(db, 'sessions'));
      const sessions = sessionsSnap.docs
        .map(d => ({ id: d.id, ...d.data() } as Session))
        .filter(s => role !== 'client' || userCaseIds.includes(s.caseId));
      
      for (const session of sessions) {
        if (!session.date) continue;
        let sessionDate: Date;
        try {
          sessionDate = parseISO(session.date);
          if (isNaN(sessionDate.getTime())) throw new Error('Invalid date');
        } catch (e) { continue; }

        if (isWithinInterval(sessionDate, { start: today, end: inTwoDays })) {
          await createNotification(userId, {
            title: 'جلسة قادمة قريباً',
            message: `لديك جلسة في قضية رقم ${session.caseId} بتاريخ ${format(sessionDate, 'dd MMMM', { locale: arSA })}`,
            type: 'session',
            relatedId: session.caseId,
            link: `/cases?id=${session.caseId}`
          });
        }
      }
    }

    // 2. Check for upcoming expert sessions
    if (!settings || settings.types.expert) {
      const expertSnap = await getDocs(collection(db, 'expertSessions'));
      const expertSessions = expertSnap.docs
        .map(d => ({ id: d.id, ...d.data() } as ExpertSession))
        .filter(s => role !== 'client' || userCaseIds.includes(s.caseId));

      for (const session of expertSessions) {
        if (!session.date) continue;
        let sessionDate: Date;
        try {
          sessionDate = parseISO(session.date);
          if (isNaN(sessionDate.getTime())) throw new Error('Invalid date');
        } catch (e) { continue; }

        if (isWithinInterval(sessionDate, { start: today, end: inTwoDays })) {
          await createNotification(userId, {
            title: 'موعد خبير قادم',
            message: `موعد مع الخبير ${session.expertName} بتاريخ ${format(sessionDate, 'dd MMMM', { locale: arSA })}`,
            type: 'expert',
            relatedId: session.id,
            link: '/expert-sessions'
          });
        }
      }
    }

    // 3. Check for tasks assigned to user
    if (role !== 'client' && (!settings || settings.types.task)) {
      const tasksSnap = await getDocs(query(collection(db, 'tasks'), where('assignedTo', '==', userId), where('status', '!=', 'completed')));
      const tasks = tasksSnap.docs.map(d => ({ id: d.id, ...d.data() } as Task));

      for (const task of tasks) {
        if (!task.dueDate) continue;
        let dueDate: Date;
        try {
          dueDate = parseISO(task.dueDate);
          if (isNaN(dueDate.getTime())) throw new Error('Invalid date');
        } catch (e) { continue; }

        if (isWithinInterval(dueDate, { start: today, end: inTwoDays })) {
          await createNotification(userId, {
            title: 'موعد نهائي لمهمة',
            message: `المهمة "${task.title}" تنتهي قريباً بتاريخ ${format(dueDate, 'dd MMMM', { locale: arSA })}`,
            type: 'task',
            relatedId: task.id,
            link: '/tasks'
          });
        }
      }
    }

    // 4. Check for legal deadlines
    if (!settings || settings.types.deadline) {
      const judgmentsSnap = await getDocs(collection(db, 'judgments'));
      const judgments = judgmentsSnap.docs
        .map(d => ({ id: d.id, ...d.data() } as Judgment))
        .filter(j => role !== 'client' || userCaseIds.includes(j.caseId));

      for (const judgment of judgments) {
        if (judgment.isAppealed || !judgment.appealDeadline) continue;
        let deadlineDate: Date;
        try {
          deadlineDate = parseISO(judgment.appealDeadline);
          if (isNaN(deadlineDate.getTime())) throw new Error('Invalid date');
        } catch (e) { continue; }
        
        const daysLeft = differenceInDays(deadlineDate, new Date());

        if (daysLeft <= 7 && daysLeft >= 0) {
          await createNotification(userId, {
            title: 'اقتراب موعد الاستئناف',
            message: `بقي ${daysLeft} أيام على انتهاء مدة الاستئناف في قضية رقم ${judgment.caseId}`,
            type: 'deadline',
            relatedId: judgment.caseId,
            link: `/cases?id=${judgment.caseId}`
          });
        }
      }
    }

    // 5. Check for financial overdue installments
    if (role !== 'client' && (!settings || settings.types.finance)) {
      try {
        const installmentsSnap = await getDocs(query(collection(db, 'installments'), where('status', '==', 'pending')));
        const installments = installmentsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Installment));

        for (const inst of installments) {
          if (!inst.dueDate) continue;
          let dueDate: Date;
          try {
            dueDate = parseISO(inst.dueDate);
            if (isNaN(dueDate.getTime())) throw new Error('Invalid date');
          } catch (e) { continue; }

          const daysOverdue = differenceInDays(new Date(), dueDate);
          if (daysOverdue > 0) {
            await createNotification(userId, {
              title: 'قسط مالي متأخر',
              message: `يوجد قسط متأخر بمبلغ ${inst.amount} د.ك في قضية رقم ${inst.caseId}`,
              type: 'finance',
              relatedId: inst.id,
              link: '/finance'
            });
          }
        }
      } catch (e) {
        console.error('NotificationCenter: Error check financial installments:', e);
      }
    }

  } catch (err) {
    console.error('Error generating notifications:', err);
  }
}
