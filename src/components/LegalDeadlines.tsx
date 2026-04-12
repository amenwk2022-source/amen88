import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where, orderBy, addDoc, doc, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Judgment, Case, AppNotification, UserProfile } from '../types';
import { useNavigate } from 'react-router-dom';
import { Gavel, Calendar, Clock, AlertTriangle, CheckCircle2, Bell, ExternalLink, ArrowRight } from 'lucide-react';
import { format, differenceInDays, parseISO, addDays } from 'date-fns';
import { arSA } from 'date-fns/locale';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

interface LegalDeadlinesProps {
  user: UserProfile;
}

export default function LegalDeadlines({ user }: LegalDeadlinesProps) {
  const navigate = useNavigate();
  const [judgments, setJudgments] = useState<Judgment[]>([]);
  const [cases, setCases] = useState<Case[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cq = query(collection(db, 'cases'), orderBy('createdAt', 'desc'));
    if (user.role === 'client') {
      cq = query(collection(db, 'cases'), where('clientId', '==', user.uid));
    }

    const unsubJudgments = onSnapshot(collection(db, 'judgments'), (snapshot) => {
      setJudgments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Judgment)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'judgments'));

    const unsubCases = onSnapshot(cq, (snapshot) => {
      setCases(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Case)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'cases'));

    const unsubNotifications = onSnapshot(
      query(
        collection(db, 'notifications'), 
        where('userId', '==', user.uid),
        orderBy('date', 'desc')
      ), 
      (snapshot) => {
        setNotifications(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AppNotification)));
        setLoading(false);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, 'notifications');
        setLoading(false);
      }
    );

    return () => {
      unsubJudgments();
      unsubCases();
      unsubNotifications();
    };
  }, [user.uid, user.role]);

  const getJudgmentCase = (caseId: string) => cases.find(c => c.id === caseId);

  return (
    <div className="space-y-8 rtl pb-20" dir="rtl">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 flex items-center gap-3">
            <Gavel className="w-8 h-8 text-indigo-600" />
            المواعيد القانونية والتنبيهات
          </h1>
          <p className="text-slate-500 font-bold mt-1">متابعة مدد الاستئناف والطعن والمواعيد الحرجة</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Deadlines List */}
        <div className="lg:col-span-2 space-y-6">
          <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <Clock className="w-5 h-5 text-indigo-600" />
            مدد الاستئناف النشطة
          </h2>
          
          <div className="grid gap-4">
            {judgments.filter(j => !j.isAppealed && cases.some(c => c.id === j.caseId)).map((judgment) => {
              const c = getJudgmentCase(judgment.caseId);
              let deadlineDate: Date | null = null;
              let judgmentDate: Date | null = null;
              
              try {
                if (judgment.appealDeadline) {
                  deadlineDate = parseISO(judgment.appealDeadline);
                  if (isNaN(deadlineDate.getTime())) throw new Error('Invalid deadline');
                }
                if (judgment.date) {
                  judgmentDate = parseISO(judgment.date);
                  if (isNaN(judgmentDate.getTime())) throw new Error('Invalid judgment date');
                }
              } catch (e) {
                console.error('LegalDeadlines: Error parsing judgment dates:', { id: judgment.id, deadline: judgment.appealDeadline, date: judgment.date }, e);
              }

              const daysLeft = deadlineDate ? differenceInDays(deadlineDate, new Date()) : 0;
              const isCritical = daysLeft <= 5;

              return (
                <motion.div
                  layout
                  key={judgment.id}
                  className={cn(
                    "bg-white p-6 rounded-3xl border-2 transition-all",
                    isCritical ? "border-red-100 bg-red-50/30" : "border-slate-100"
                  )}
                >
                  <div className="flex justify-between items-start">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          "px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider",
                          judgment.type === 'initial' ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"
                        )}>
                          حكم {judgment.type === 'initial' ? 'ابتدائي' : 'استئناف'}
                        </span>
                        <h3 className="font-black text-slate-900">قضية رقم: {c?.caseNumber}</h3>
                      </div>
                      <p className="text-sm font-bold text-slate-500">{c?.court} - {c?.circuit}</p>
                      <div className="flex items-center gap-4 mt-4">
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
                          <Calendar className="w-4 h-4 text-slate-400" />
                          تاريخ الحكم: {judgmentDate ? format(judgmentDate, 'yyyy/MM/dd') : '---'}
                        </div>
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
                          <AlertTriangle className={cn("w-4 h-4", isCritical ? "text-red-500" : "text-amber-500")} />
                          آخر موعد: {deadlineDate ? format(deadlineDate, 'yyyy/MM/dd') : '---'}
                        </div>
                      </div>
                    </div>

                    <div className="text-left flex flex-col items-end gap-4">
                      <div className={cn(
                        "w-20 h-20 rounded-2xl flex flex-col items-center justify-center border-2",
                        isCritical ? "bg-red-600 border-red-700 text-white shadow-lg shadow-red-100" : "bg-white border-slate-100 text-slate-900"
                      )}>
                        <span className="text-2xl font-black">{daysLeft < 0 ? 0 : daysLeft}</span>
                        <span className="text-[10px] font-bold uppercase">يوم متبقي</span>
                      </div>
                      <button 
                        onClick={() => navigate(`/cases?id=${judgment.caseId}`)}
                        className="text-indigo-600 text-[10px] font-black hover:underline flex items-center gap-1"
                      >
                        تفاصيل القضية
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })}

            {judgments.filter(j => !j.isAppealed && cases.some(c => c.id === j.caseId)).length === 0 && (
              <div className="text-center py-12 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
                <CheckCircle2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-400 font-bold">لا توجد مدد استئناف نشطة حالياً</p>
              </div>
            )}
          </div>
        </div>

        {/* Notifications Sidebar */}
        <div className="space-y-6">
          <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <Bell className="w-5 h-5 text-indigo-600" />
            آخر التنبيهات
          </h2>

          <div className="space-y-4">
            {notifications.map((notif) => (
              <div 
                key={notif.id}
                className={cn(
                  "p-4 rounded-2xl border transition-all",
                  notif.isRead ? "bg-white border-slate-100 opacity-60" : "bg-indigo-50/50 border-indigo-100 shadow-sm"
                )}
              >
                <div className="flex gap-3">
                  <div className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                    notif.type === 'deadline' ? "bg-red-100 text-red-600" : "bg-indigo-100 text-indigo-600"
                  )}>
                    <Bell className="w-5 h-5" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-sm font-black text-slate-900">{notif.title}</h4>
                    <p className="text-xs font-bold text-slate-600 leading-relaxed">{notif.message}</p>
                    <p className="text-[10px] text-slate-400 font-bold mt-2">
                      {(() => {
                        try {
                          if (!notif.date) return '---';
                          const d = parseISO(notif.date);
                          if (isNaN(d.getTime())) return '---';
                          return format(d, 'yyyy/MM/dd HH:mm');
                        } catch (e) {
                          console.error('LegalDeadlines: Error parsing notification date:', notif.date, e);
                          return '---';
                        }
                      })()}
                    </p>
                  </div>
                </div>
              </div>
            ))}

            {notifications.length === 0 && (
              <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                <p className="text-slate-400 text-sm font-bold">لا توجد تنبيهات جديدة</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
