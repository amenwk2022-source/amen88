import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, orderBy, updateDoc, doc, addDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { ConsultationRequest, UserProfile } from '../types';
import { MessageSquare, Send, CheckCircle2, Clock, User, X, Search, Filter } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format, parseISO } from 'date-fns';
import { arSA } from 'date-fns/locale';
import { cn } from '../lib/utils';

interface ConsultationsProps {
  user: UserProfile;
}

export default function Consultations({ user }: ConsultationsProps) {
  const [requests, setRequests] = useState<ConsultationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<ConsultationRequest | null>(null);
  const [reply, setReply] = useState('');
  const [isReplying, setIsReplying] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'replied' | 'closed'>('all');

  useEffect(() => {
    const q = query(collection(db, 'consultations'), orderBy('date', 'desc'));
    const unsub = onSnapshot(q, (snapshot) => {
      setRequests(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ConsultationRequest)));
      setLoading(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'consultations');
      setLoading(false);
    });
    return unsub;
  }, []);

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRequest || !reply) return;
    setIsReplying(true);
    try {
      await updateDoc(doc(db, 'consultations', selectedRequest.id), {
        reply,
        status: 'replied'
      });
      
      // Notify client
      await addDoc(collection(db, 'notifications'), {
        userId: selectedRequest.clientId,
        title: 'تم الرد على استشارتك',
        message: `قام المكتب بالرد على استشارتك بخصوص: ${selectedRequest.subject}`,
        type: 'system',
        date: new Date().toISOString(),
        isRead: false
      });

      setReply('');
      setSelectedRequest(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'consultations');
    } finally {
      setIsReplying(false);
    }
  };

  const filteredRequests = requests.filter(req => {
    const matchesSearch = req.clientName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         req.subject.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = filterStatus === 'all' || req.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 rtl" dir="rtl">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 mb-2">طلبات الاستشارة</h1>
          <p className="text-slate-500 font-medium">إدارة الردود على استفسارات الموكلين.</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex-1 relative">
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="بحث بالاسم أو الموضوع..."
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-12 pl-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-600 transition-all"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0">
          {(['all', 'pending', 'replied', 'closed'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={cn(
                "px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap",
                filterStatus === status ? "bg-indigo-600 text-white shadow-lg shadow-indigo-100" : "bg-slate-50 text-slate-500 hover:bg-slate-100"
              )}
            >
              {status === 'all' ? 'الكل' : status === 'pending' ? 'بانتظار الرد' : status === 'replied' ? 'تم الرد' : 'مغلق'}
            </button>
          ))}
        </div>
      </div>

      {/* Requests Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredRequests.map((req) => (
          <motion.div
            layout
            key={req.id}
            className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-all flex flex-col"
          >
            <div className="flex items-center justify-between mb-4">
              <span className={cn(
                "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
                req.status === 'pending' ? "bg-amber-100 text-amber-700" : 
                req.status === 'replied' ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-700"
              )}>
                {req.status === 'pending' ? 'بانتظار الرد' : req.status === 'replied' ? 'تم الرد' : 'مغلق'}
              </span>
              <span className="text-[10px] text-slate-400 font-bold uppercase">
                {(() => {
                  try {
                    if (!req.date) return '---';
                    const d = parseISO(req.date);
                    if (isNaN(d.getTime())) return '---';
                    return format(d, 'dd MMMM yyyy', { locale: arSA });
                  } catch (e) {
                    console.error('Consultations: Error parsing date:', req.date, e);
                    return '---';
                  }
                })()}
              </span>
            </div>
            
            <h3 className="text-lg font-black text-slate-900 mb-2 line-clamp-1">{req.subject}</h3>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-600">
                <User className="w-3 h-3" />
              </div>
              <span className="text-xs font-bold text-slate-500">{req.clientName}</span>
            </div>
            
            <p className="text-sm text-slate-600 line-clamp-3 mb-6 flex-1">{req.description}</p>
            
            <button
              onClick={() => setSelectedRequest(req)}
              className="w-full py-3 bg-slate-50 text-indigo-600 rounded-xl font-bold text-sm hover:bg-indigo-50 transition-all flex items-center justify-center gap-2"
            >
              <MessageSquare className="w-4 h-4" />
              {req.status === 'pending' ? 'الرد على الاستشارة' : 'عرض التفاصيل'}
            </button>
          </motion.div>
        ))}
      </div>

      {/* Reply Modal */}
      <AnimatePresence>
        {selectedRequest && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedRequest(null)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-indigo-600 rounded-2xl text-white shadow-lg shadow-indigo-100">
                    <MessageSquare className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-slate-900">الرد على الاستشارة</h2>
                    <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">الموكل: {selectedRequest.clientName}</p>
                  </div>
                </div>
                <button onClick={() => setSelectedRequest(null)} className="p-2 hover:bg-white rounded-xl transition-all">
                  <X className="w-6 h-6 text-slate-400" />
                </button>
              </div>

              <div className="p-8 space-y-6">
                <div className="space-y-2">
                  <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest">الموضوع: {selectedRequest.subject}</h4>
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <p className="text-sm text-slate-600 leading-relaxed">{selectedRequest.description}</p>
                  </div>
                </div>

                {selectedRequest.status === 'replied' ? (
                  <div className="space-y-2">
                    <h4 className="text-sm font-black text-indigo-600 uppercase tracking-widest">الرد السابق:</h4>
                    <div className="bg-indigo-50 p-4 rounded-2xl border border-indigo-100">
                      <p className="text-sm text-indigo-900 font-medium">{selectedRequest.reply}</p>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleReply} className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-xs font-black text-slate-500 uppercase">اكتب ردك هنا</label>
                      <textarea
                        required
                        rows={6}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-indigo-600 outline-none transition-all resize-none"
                        placeholder="أدخل الرد القانوني المناسب..."
                        value={reply}
                        onChange={(e) => setReply(e.target.value)}
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={isReplying}
                      className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white py-4 rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 disabled:opacity-50"
                    >
                      {isReplying ? (
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <>
                          <Send className="w-4 h-4" />
                          إرسال الرد
                        </>
                      )}
                    </button>
                  </form>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
