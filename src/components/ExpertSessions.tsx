import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, doc, updateDoc, deleteDoc, query, orderBy, where } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { ExpertSession, Case, UserProfile } from '../types';
import { Users, Calendar, MapPin, Search, Plus, X, Save, Trash2, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import { format, isPast, isToday, isFuture } from 'date-fns';
import { arSA } from 'date-fns/locale';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

interface ExpertSessionsProps {
  user: UserProfile;
}

export default function ExpertSessions({ user }: ExpertSessionsProps) {
  const [expertSessions, setExpertSessions] = useState<ExpertSession[]>([]);
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCase, setSelectedCase] = useState<Case | null>(null);
  const [formData, setFormData] = useState({
    date: '',
    expertName: '',
    officeLocation: '',
    notes: ''
  });

  useEffect(() => {
    let cq = query(collection(db, 'cases'), orderBy('createdAt', 'desc'));
    if (user.role === 'client') {
      cq = query(collection(db, 'cases'), where('clientId', '==', user.uid));
    }

    const unsubSessions = onSnapshot(
      query(collection(db, 'expertSessions'), orderBy('date', 'desc')), 
      (snapshot) => {
        setExpertSessions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ExpertSession)));
        setLoading(false);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, 'expertSessions');
        setLoading(false);
      }
    );

    const unsubCases = onSnapshot(cq, (snapshot) => {
      setCases(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Case)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'cases'));

    return () => {
      unsubSessions();
      unsubCases();
    };
  }, [user.uid, user.role]);

  const handleAddSession = async () => {
    if (user.role === 'client') return;
    if (!selectedCase || !formData.date || !formData.expertName) return;

    try {
      await addDoc(collection(db, 'expertSessions'), {
        caseId: selectedCase.id,
        date: formData.date,
        expertName: formData.expertName,
        officeLocation: formData.officeLocation,
        status: 'pending',
        notes: formData.notes,
        createdAt: new Date().toISOString()
      });
      setIsModalOpen(false);
      setFormData({ date: '', expertName: '', officeLocation: '', notes: '' });
      setSelectedCase(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'expertSessions');
    }
  };

  const updateStatus = async (id: string, status: ExpertSession['status']) => {
    try {
      await updateDoc(doc(db, 'expertSessions', id), { status });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'expertSessions');
    }
  };

  const deleteSession = async (id: string) => {
    if (!window.confirm('هل أنت متأكد من حذف هذه الجلسة؟')) return;
    try {
      await deleteDoc(doc(db, 'expertSessions', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'expertSessions');
    }
  };

  const filteredCases = cases.filter(c => 
    c.caseNumber?.includes(searchTerm) || 
    c.clientName?.includes(searchTerm) ||
    c.autoNumber?.includes(searchTerm)
  );

  const getSessionCase = (caseId: string) => cases.find(c => c.id === caseId);
  const isLawyer = user.role === 'admin' || user.role === 'lawyer';

  return (
    <div className="space-y-8 rtl pb-20" dir="rtl">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 flex items-center gap-3">
            <Users className="w-8 h-8 text-indigo-600" />
            جلسات الخبراء
          </h1>
          <p className="text-slate-500 font-bold mt-1">إدارة مواعيد الخبراء والزيارات الميدانية</p>
        </div>
        {isLawyer && (
          <button
            onClick={() => setIsModalOpen(true)}
            className="bg-indigo-600 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
          >
            <Plus className="w-5 h-5" />
            إضافة جلسة خبير
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {expertSessions.filter(s => cases.some(c => c.id === s.caseId)).map((session) => {
          const c = getSessionCase(session.caseId);
          const sessionDate = new Date(session.date);
          const isPastSession = isPast(sessionDate) && !isToday(sessionDate);

          return (
            <motion.div
              layout
              key={session.id}
              className={cn(
                "bg-white p-6 rounded-3xl border-2 transition-all relative overflow-hidden",
                session.status === 'attended' ? "border-emerald-100 bg-emerald-50/20" : "border-slate-100"
              )}
            >
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-2">
                  <div className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center",
                    session.status === 'attended' ? "bg-emerald-100 text-emerald-600" : "bg-indigo-100 text-indigo-600"
                  )}>
                    <Users className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-900">قضية رقم: {c?.caseNumber}</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{c?.court}</p>
                  </div>
                </div>
                {isLawyer && (
                  <div className="flex gap-1">
                    <button onClick={() => deleteSession(session.id)} className="p-2 text-red-400 hover:bg-red-50 rounded-lg transition-all">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-3 text-sm font-bold text-slate-600">
                  <Calendar className="w-4 h-4 text-slate-400" />
                  {format(sessionDate, 'EEEE, dd MMMM yyyy', { locale: arSA })}
                </div>
                <div className="flex items-center gap-3 text-sm font-bold text-slate-600">
                  <Users className="w-4 h-4 text-slate-400" />
                  الخبير: {session.expertName}
                </div>
                <div className="flex items-center gap-3 text-sm font-bold text-slate-600">
                  <MapPin className="w-4 h-4 text-slate-400" />
                  الموقع: {session.officeLocation}
                </div>
                {session.notes && (
                  <div className="p-3 bg-slate-50 rounded-xl text-xs font-bold text-slate-500 border border-slate-100">
                    {session.notes}
                  </div>
                )}
              </div>

              {isLawyer && (
                <div className="mt-6 pt-6 border-t border-slate-100 flex items-center justify-between">
                  <div className="flex gap-2">
                    <button
                      onClick={() => updateStatus(session.id, 'attended')}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-[10px] font-black transition-all",
                        session.status === 'attended' ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-500 hover:bg-emerald-50 hover:text-emerald-600"
                      )}
                    >
                      تم الحضور
                    </button>
                    <button
                      onClick={() => updateStatus(session.id, 'postponed')}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-[10px] font-black transition-all",
                        session.status === 'postponed' ? "bg-amber-600 text-white" : "bg-slate-100 text-slate-500 hover:bg-amber-50 hover:text-amber-600"
                      )}
                    >
                      تأجيل
                    </button>
                  </div>
                  <div className="flex items-center gap-1">
                    {session.status === 'attended' ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    ) : isPastSession ? (
                      <AlertCircle className="w-4 h-4 text-red-400" />
                    ) : (
                      <Clock className="w-4 h-4 text-indigo-400" />
                    )}
                    <span className={cn(
                      "text-[10px] font-black uppercase",
                      session.status === 'attended' ? "text-emerald-600" : isPastSession ? "text-red-400" : "text-indigo-400"
                    )}>
                      {session.status === 'attended' ? 'تمت' : isPastSession ? 'فائتة' : 'قادمة'}
                    </span>
                  </div>
                </div>
              )}
              {!isLawyer && (
                <div className="mt-6 pt-6 border-t border-slate-100 flex items-center justify-end">
                  <div className="flex items-center gap-1">
                    {session.status === 'attended' ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    ) : isPastSession ? (
                      <AlertCircle className="w-4 h-4 text-red-400" />
                    ) : (
                      <Clock className="w-4 h-4 text-indigo-400" />
                    )}
                    <span className={cn(
                      "text-[10px] font-black uppercase",
                      session.status === 'attended' ? "text-emerald-600" : isPastSession ? "text-red-400" : "text-indigo-400"
                    )}>
                      {session.status === 'attended' ? 'تمت' : isPastSession ? 'فائتة' : 'قادمة'}
                    </span>
                  </div>
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Add Session Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <h2 className="text-xl font-black text-slate-900">إضافة جلسة خبير جديدة</h2>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-white rounded-xl transition-all">
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>
              <div className="p-8 space-y-6">
                <div className="space-y-4">
                  <div className="relative">
                    <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="ابحث برقم القضية أو الرقم الآلي..."
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-12 pl-4 py-3 text-sm font-medium focus:ring-2 focus:ring-indigo-600 transition-all"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>

                  {searchTerm && (
                    <div className="max-h-40 overflow-y-auto border border-slate-100 rounded-xl divide-y divide-slate-50">
                      {filteredCases.map(c => (
                        <button
                          key={c.id}
                          onClick={() => {
                            setSelectedCase(c);
                            setSearchTerm('');
                          }}
                          className="w-full p-3 text-right hover:bg-indigo-50 transition-all flex items-center justify-between"
                        >
                          <div>
                            <p className="text-sm font-black text-slate-900">{c.caseNumber}</p>
                            <p className="text-[10px] font-bold text-slate-400">{c.clientName}</p>
                          </div>
                          <span className="text-[10px] font-black text-indigo-600 bg-indigo-100 px-2 py-1 rounded-lg">
                            {c.autoNumber || 'بدون رقم آلي'}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}

                  {selectedCase && (
                    <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100 flex items-center justify-between">
                      <div>
                        <p className="text-xs font-bold text-indigo-600">القضية المختارة:</p>
                        <p className="text-sm font-black text-slate-900">{selectedCase.caseNumber}</p>
                      </div>
                      <button onClick={() => setSelectedCase(null)} className="p-2 hover:bg-white rounded-lg transition-all text-red-500">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-700">التاريخ</label>
                      <input
                        type="date"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-indigo-600 transition-all"
                        value={formData.date}
                        onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-700">اسم الخبير</label>
                      <input
                        type="text"
                        placeholder="اسم الخبير..."
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-indigo-600 transition-all"
                        value={formData.expertName}
                        onChange={(e) => setFormData({ ...formData, expertName: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">موقع المكتب / الزيارة</label>
                    <input
                      type="text"
                      placeholder="العنوان أو موقع المكتب..."
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-indigo-600 transition-all"
                      value={formData.officeLocation}
                      onChange={(e) => setFormData({ ...formData, officeLocation: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">ملاحظات إضافية</label>
                    <textarea
                      rows={2}
                      placeholder="أي تعليمات أو ملاحظات..."
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-indigo-600 transition-all"
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    />
                  </div>
                </div>

                <div className="pt-4 flex gap-4">
                  <button
                    onClick={handleAddSession}
                    className="flex-1 bg-indigo-600 text-white font-bold py-4 rounded-2xl shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"
                  >
                    <Save className="w-5 h-5" />
                    حفظ الجلسة
                  </button>
                  <button
                    onClick={() => setIsModalOpen(false)}
                    className="px-8 bg-slate-100 text-slate-600 font-bold py-4 rounded-2xl hover:bg-slate-200 transition-all"
                  >
                    إلغاء
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
