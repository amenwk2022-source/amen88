import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { 
  Briefcase, 
  CalendarClock, 
  FileText, 
  Scale, 
  Clock, 
  CheckCircle2,
  Users,
  Bell
} from 'lucide-react';
import { motion } from 'motion/react';
import { Case, Session, ExpertSession, UserProfile } from '../types';
import { format, parseISO } from 'date-fns';
import { arSA } from 'date-fns/locale';
import { cn } from '../lib/utils';

interface ClientPortalProps {
  user: UserProfile;
}

export default function ClientPortal({ user }: ClientPortalProps) {
  const [cases, setCases] = useState<Case[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [expertSessions, setExpertSessions] = useState<ExpertSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Listen for client's cases
    const casesQuery = query(
      collection(db, 'cases'),
      where('clientId', '==', user.uid)
    );
    
    const unsubCases = onSnapshot(casesQuery, (snapshot) => {
      const clientCases = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Case));
      setCases(clientCases);
      
      if (clientCases.length > 0) {
        const caseIds = clientCases.map(c => c.id);
        
        // Listen for sessions related to these cases
        const sessionsQuery = query(
          collection(db, 'sessions'),
          where('caseId', 'in', caseIds.slice(0, 10)), // Firestore 'in' limit
          orderBy('date', 'asc')
        );
        
        const unsubSessions = onSnapshot(sessionsQuery, (sessSnap) => {
          setSessions(sessSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Session)));
        });

        // Listen for expert sessions
        const expertQuery = query(
          collection(db, 'expertSessions'),
          where('caseId', 'in', caseIds.slice(0, 10)),
          orderBy('date', 'asc')
        );

        const unsubExpert = onSnapshot(expertQuery, (expSnap) => {
          setExpertSessions(expSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ExpertSession)));
        });

        setLoading(false);
        return () => {
          unsubSessions();
          unsubExpert();
        };
      } else {
        setLoading(false);
      }
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'cases');
      setLoading(false);
    });

    return () => unsubCases();
  }, [user.uid]);

  const activeCases = cases.filter(c => c.status === 'active').length;
  const today = new Date().toISOString().split('T')[0];
  const upcomingSessions = sessions.filter(s => s.date >= today);
  const upcomingExpert = expertSessions.filter(s => s.date >= today);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 rtl" dir="rtl">
      <div className="bg-gradient-to-r from-indigo-600 to-indigo-800 p-8 rounded-3xl text-white shadow-xl">
        <h1 className="text-3xl font-black mb-2">مرحباً بك، {user.name}</h1>
        <p className="text-indigo-100 font-medium">بوابة الموكل الإلكترونية - تابع قضاياك وجلساتك بكل سهولة.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
              <Briefcase className="w-6 h-6" />
            </div>
            <div>
              <p className="text-slate-500 text-sm font-bold">إجمالي القضايا</p>
              <h3 className="text-2xl font-black text-slate-900">{cases.length}</h3>
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
              <Scale className="w-6 h-6" />
            </div>
            <div>
              <p className="text-slate-500 text-sm font-bold">قضايا متداولة</p>
              <h3 className="text-2xl font-black text-slate-900">{activeCases}</h3>
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <p className="text-slate-500 text-sm font-bold">قضايا منتهية</p>
              <h3 className="text-2xl font-black text-slate-900">{cases.length - activeCases}</h3>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Upcoming Sessions */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
            <CalendarClock className="w-5 h-5 text-indigo-600" />
            الجلسات القادمة
          </h3>
          <div className="space-y-4">
            {upcomingSessions.length > 0 ? upcomingSessions.map((session, i) => (
              <div key={i} className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
                <div className="flex flex-col items-center justify-center bg-white p-2 rounded-lg border border-slate-200 min-w-[64px]">
                  <span className="text-[10px] font-black text-indigo-600 uppercase">
                    {format(parseISO(session.date), 'MMMM', { locale: arSA })}
                  </span>
                  <span className="text-xl font-black text-slate-900">{format(parseISO(session.date), 'dd')}</span>
                </div>
                <div className="flex-1">
                  <h4 className="text-sm font-bold text-slate-900">جلسة مرافعة</h4>
                  <p className="text-xs text-slate-500">قضية رقم: {cases.find(c => c.id === session.caseId)?.caseNumber || '---'}</p>
                </div>
              </div>
            )) : (
              <p className="text-center py-8 text-slate-400 font-medium">لا توجد جلسات قادمة</p>
            )}
          </div>
        </div>

        {/* Expert Sessions */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-600" />
            جلسات الخبراء
          </h3>
          <div className="space-y-4">
            {upcomingExpert.length > 0 ? upcomingExpert.map((session, i) => (
              <div key={i} className="flex items-center gap-4 p-4 bg-amber-50/50 rounded-xl border border-amber-100">
                <div className="flex flex-col items-center justify-center bg-white p-2 rounded-lg border border-amber-200 min-w-[64px]">
                  <span className="text-[10px] font-black text-amber-600 uppercase">
                    {format(parseISO(session.date), 'MMMM', { locale: arSA })}
                  </span>
                  <span className="text-xl font-black text-slate-900">{format(parseISO(session.date), 'dd')}</span>
                </div>
                <div className="flex-1">
                  <h4 className="text-sm font-bold text-slate-900">{session.expertName}</h4>
                  <p className="text-xs text-slate-500">{session.officeLocation}</p>
                </div>
              </div>
            )) : (
              <p className="text-center py-8 text-slate-400 font-medium">لا توجد جلسات خبراء قادمة</p>
            )}
          </div>
        </div>
      </div>

      {/* Cases List */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
          <Briefcase className="w-5 h-5 text-indigo-600" />
          قائمة القضايا
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-right">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="pb-4 font-bold text-slate-500 text-sm">رقم القضية</th>
                <th className="pb-4 font-bold text-slate-500 text-sm">المحكمة</th>
                <th className="pb-4 font-bold text-slate-500 text-sm">الخصم</th>
                <th className="pb-4 font-bold text-slate-500 text-sm">الحالة</th>
                <th className="pb-4 font-bold text-slate-500 text-sm">الرقم الآلي</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {cases.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50 transition-all group">
                  <td className="py-4 font-bold text-slate-900">{c.caseNumber}</td>
                  <td className="py-4 text-slate-600 text-sm">{c.court}</td>
                  <td className="py-4 text-slate-600 text-sm">{c.opponent}</td>
                  <td className="py-4">
                    <span className={cn(
                      "px-3 py-1 rounded-full text-xs font-bold",
                      c.status === 'active' ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
                    )}>
                      {c.status === 'active' ? 'متداولة' : 'منتهية'}
                    </span>
                  </td>
                  <td className="py-4 font-mono text-xs text-slate-400">{c.autoNumber}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
