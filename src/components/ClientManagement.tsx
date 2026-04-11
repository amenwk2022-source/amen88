import React, { useState, useEffect } from 'react';
import { collection, addDoc, onSnapshot, query, orderBy, deleteDoc, doc, updateDoc, where } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Plus, Search, MoreVertical, Phone, CreditCard, MapPin, FileText, Trash2, Edit2, X, Check, Printer, Eye, Scale, Clock, Briefcase } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Client, Case, Session } from '../types';
import { cn } from '../lib/utils';
import { format } from 'date-fns';
import { arSA } from 'date-fns/locale';

export default function ClientManagement() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [selectedClientForCases, setSelectedClientForCases] = useState<Client | null>(null);
  const [isAddCaseModalOpen, setIsAddCaseModalOpen] = useState(false);
  const [clientCases, setClientCases] = useState<Case[]>([]);
  const [allSessions, setAllSessions] = useState<Session[]>([]);
  const [formData, setFormData] = useState<Partial<Client>>({
    name: '',
    phone: '',
    civilId: '',
    address: '',
    poaNumber: ''
  });

  const [caseFormData, setCaseFormData] = useState<Partial<Case>>({
    caseNumber: '',
    year: new Date().getFullYear().toString(),
    court: '',
    circuit: '',
    autoNumber: '',
    opponent: '',
    caseType: '',
    status: 'pre-filing',
    clientPosition: 'plaintiff'
  });

  const handleAddCase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClientForCases) return;
    try {
      await addDoc(collection(db, 'cases'), {
        ...caseFormData,
        clientId: selectedClientForCases.id,
        clientName: selectedClientForCases.name,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      setIsAddCaseModalOpen(false);
      setCaseFormData({
        caseNumber: '',
        year: new Date().getFullYear().toString(),
        court: '',
        circuit: '',
        autoNumber: '',
        opponent: '',
        caseType: '',
        status: 'pre-filing',
        clientPosition: 'plaintiff'
      });
    } catch (error) {
      console.error('Error adding case:', error);
    }
  };

  useEffect(() => {
    const q = query(collection(db, 'clients'), orderBy('name', 'asc'));
    const unsub = onSnapshot(q, (snapshot) => {
      setClients(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client)));
      setLoading(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'clients');
      setLoading(false);
    });

    const unsubSessions = onSnapshot(collection(db, 'sessions'), (snapshot) => {
      setAllSessions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Session)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'sessions'));

    return () => {
      unsub();
      unsubSessions();
    };
  }, []);

  useEffect(() => {
    if (!selectedClientForCases) {
      setClientCases([]);
      return;
    }

    const q = query(collection(db, 'cases'), where('clientId', '==', selectedClientForCases.id));
    const unsub = onSnapshot(q, (snapshot) => {
      setClientCases(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Case)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'cases'));

    return unsub;
  }, [selectedClientForCases]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingClient) {
        await updateDoc(doc(db, 'clients', editingClient.id), formData);
      } else {
        await addDoc(collection(db, 'clients'), {
          ...formData,
          createdAt: new Date().toISOString()
        });
      }
      setIsModalOpen(false);
      setEditingClient(null);
      setFormData({ name: '', phone: '', civilId: '', address: '', poaNumber: '' });
    } catch (error) {
      console.error('Error saving client:', error);
    }
  };

  const handleDelete = async (id: string) => {
    // In a real app, use a custom modal. For now, we'll just delete.
    try {
      await deleteDoc(doc(db, 'clients', id));
    } catch (error) {
      console.error('Error deleting client:', error);
    }
  };

  const filteredClients = clients.filter(c =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.phone.includes(searchTerm) ||
    c.civilId?.includes(searchTerm)
  );

  return (
    <div className="space-y-6 rtl" dir="rtl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 mb-1">إدارة الموكلين</h1>
          <p className="text-slate-500 font-medium">إضافة وتعديل بيانات الموكلين والتوكيلات.</p>
        </div>
        <button
          onClick={() => {
            setEditingClient(null);
            setFormData({ name: '', phone: '', civilId: '', address: '', poaNumber: '' });
            setIsModalOpen(true);
          }}
          className="flex items-center justify-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all"
        >
          <Plus className="w-5 h-5" />
          إضافة موكل جديد
        </button>
      </div>

      {/* Search & Filters */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
        <div className="flex-1 flex items-center gap-3 bg-slate-50 px-4 py-2 rounded-xl border border-slate-200">
          <Search className="w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="بحث بالاسم، الهاتف، أو الرقم المدني..."
            className="bg-transparent border-none focus:ring-0 text-sm w-full font-medium"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Clients Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredClients.map((client) => (
          <motion.div
            layout
            key={client.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all group relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-1 h-full bg-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 font-black text-xl border border-slate-200 group-hover:bg-indigo-600 group-hover:text-white group-hover:border-indigo-600 transition-all">
                  {client.name[0]}
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 group-hover:text-indigo-600 transition-colors">{client.name}</h3>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">موكل دائم</p>
                </div>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => {
                    setEditingClient(client);
                    setFormData(client);
                    setIsModalOpen(true);
                  }}
                  className="p-2 hover:bg-indigo-50 text-indigo-600 rounded-lg transition-all"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(client.id)}
                  className="p-2 hover:bg-red-50 text-red-600 rounded-lg transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-3 text-sm font-medium text-slate-600">
                <Phone className="w-4 h-4 text-slate-400" />
                <span>{client.phone}</span>
              </div>
              <div className="flex items-center gap-3 text-sm font-medium text-slate-600">
                <CreditCard className="w-4 h-4 text-slate-400" />
                <span>الرقم المدني: {client.civilId || 'غير متوفر'}</span>
              </div>
              <div className="flex items-center gap-3 text-sm font-medium text-slate-600">
                <FileText className="w-4 h-4 text-slate-400" />
                <span>رقم الوكالة: {client.poaNumber || 'غير متوفر'}</span>
              </div>
              <div className="flex items-center gap-3 text-sm font-medium text-slate-600">
                <MapPin className="w-4 h-4 text-slate-400" />
                <span className="truncate">{client.address || 'العنوان غير مسجل'}</span>
              </div>
            </div>

            <div className="mt-6 pt-6 border-t border-slate-100 flex items-center justify-between">
              <button 
                onClick={() => setSelectedClientForCases(client)}
                className="text-indigo-600 text-xs font-black hover:underline flex items-center gap-1"
              >
                عرض القضايا
                <Plus className="w-3 h-3" />
              </button>
              <span className="text-[10px] text-slate-300 font-bold">ID: {client.id.slice(0, 8)}</span>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Add/Edit Modal */}
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
                <h2 className="text-xl font-black text-slate-900">
                  {editingClient ? 'تعديل بيانات موكل' : 'إضافة موكل جديد'}
                </h2>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-white rounded-xl transition-all">
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="p-8 space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-2 sm:col-span-2">
                    <label className="text-sm font-bold text-slate-700">الاسم الكامل</label>
                    <input
                      required
                      type="text"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition-all"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">رقم الهاتف</label>
                    <input
                      required
                      type="tel"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition-all"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">الرقم المدني</label>
                    <input
                      type="text"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition-all"
                      value={formData.civilId}
                      onChange={(e) => setFormData({ ...formData, civilId: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">رقم الوكالة</label>
                    <input
                      type="text"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition-all"
                      value={formData.poaNumber}
                      onChange={(e) => setFormData({ ...formData, poaNumber: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <label className="text-sm font-bold text-slate-700">العنوان</label>
                    <textarea
                      rows={3}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition-all"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    />
                  </div>
                </div>
                <div className="pt-4 flex gap-4">
                  <button
                    type="submit"
                    className="flex-1 bg-indigo-600 text-white font-bold py-4 rounded-2xl shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"
                  >
                    <Check className="w-5 h-5" />
                    {editingClient ? 'حفظ التعديلات' : 'إضافة الموكل'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-8 bg-slate-100 text-slate-600 font-bold py-4 rounded-2xl hover:bg-slate-200 transition-all"
                  >
                    إلغاء
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      
      {/* Client Cases Modal */}
      <AnimatePresence>
        {selectedClientForCases && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedClientForCases(null)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white w-full max-w-4xl h-[80vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-indigo-600 rounded-xl text-white shadow-lg">
                    <Briefcase className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-slate-900">قضايا الموكل: {selectedClientForCases.name}</h2>
                    <p className="text-sm text-slate-500 font-bold">إجمالي القضايا: {clientCases.length}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsAddCaseModalOpen(true)}
                    className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl font-bold text-sm hover:bg-indigo-700 transition-all shadow-sm"
                  >
                    <Plus className="w-4 h-4" />
                    <span>إضافة قضية</span>
                  </button>
                  <button 
                    onClick={() => window.print()}
                    className="flex items-center gap-2 bg-white text-slate-700 px-4 py-2 rounded-xl font-bold text-sm hover:bg-slate-50 transition-all border border-slate-200 shadow-sm"
                  >
                    <Printer className="w-4 h-4" />
                    <span>طباعة الكشف</span>
                  </button>
                  <button onClick={() => setSelectedClientForCases(null)} className="p-2 hover:bg-white rounded-xl transition-all">
                    <X className="w-6 h-6 text-slate-400" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                <table className="w-full text-right border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="p-4 text-xs font-black text-slate-500 uppercase tracking-widest">#</th>
                      <th className="p-4 text-xs font-black text-slate-500 uppercase tracking-widest">المحكمة</th>
                      <th className="p-4 text-xs font-black text-slate-500 uppercase tracking-widest">الرقم الآلي</th>
                      <th className="p-4 text-xs font-black text-slate-500 uppercase tracking-widest">الخصم</th>
                      <th className="p-4 text-xs font-black text-slate-500 uppercase tracking-widest">آخر جلسة</th>
                      <th className="p-4 text-xs font-black text-slate-500 uppercase tracking-widest">القرار</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {clientCases.map((c, index) => {
                      const lastSession = allSessions
                        .filter(s => s.caseId === c.id)
                        .sort((a, b) => b.date.localeCompare(a.date))[0];
                      
                      return (
                        <tr key={c.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="p-4 text-sm font-black text-slate-400">{index + 1}</td>
                          <td className="p-4">
                            <span className="text-sm font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-lg">
                              {c.court || '---'}
                            </span>
                          </td>
                          <td className="p-4 text-sm font-black text-slate-900 tracking-widest">{c.autoNumber || '---'}</td>
                          <td className="p-4 text-sm font-bold text-slate-700">{c.opponent || '---'}</td>
                          <td className="p-4 text-sm font-bold text-slate-600">{lastSession?.date || '---'}</td>
                          <td className="p-4">
                            <p className="text-xs font-medium text-slate-500 line-clamp-2">{lastSession?.decision || '---'}</p>
                          </td>
                        </tr>
                      );
                    })}
                    {clientCases.length === 0 && (
                      <tr>
                        <td colSpan={6} className="p-20 text-center text-slate-400 font-bold">لا توجد قضايا مسجلة لهذا الموكل</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Print-only Client Cases Section */}
      {selectedClientForCases && (
        <div className="hidden print:block p-12 bg-white text-right" dir="rtl">
          <div className="flex justify-between items-start mb-10 border-b-2 border-slate-900 pb-8">
            <div>
              <h1 className="text-2xl font-black text-slate-900">مكتب المحامي محمد امين علي الصايغ</h1>
              <p className="text-sm text-slate-500 font-bold">للمحاماة والاستشارات القانونية</p>
              <p className="text-[10px] text-slate-400 mt-1">دولة الكويت - برج التجارية - الدور 25</p>
            </div>
            <div className="text-left">
              <p className="font-bold text-slate-900 text-sm">تاريخ الطباعة: {new Date().toLocaleDateString('ar-EG')}</p>
              <p className="font-bold text-slate-900 text-sm">الوقت: {new Date().toLocaleTimeString('ar-EG')}</p>
            </div>
          </div>

          <div className="text-center mb-10">
            <h2 className="text-3xl font-black bg-slate-100 inline-block px-12 py-4 rounded-2xl border-2 border-slate-900">
              كشف بقضايا الموكل
            </h2>
            <p className="text-xl font-black mt-4 text-indigo-600">الموكل: {selectedClientForCases.name}</p>
          </div>

          <table className="w-full border-collapse border-2 border-slate-900">
            <thead>
              <tr className="bg-slate-100">
                <th className="border border-slate-900 p-3 text-right text-sm font-black">#</th>
                <th className="border border-slate-900 p-3 text-right text-sm font-black">المحكمة</th>
                <th className="border border-slate-900 p-3 text-right text-sm font-black">الرقم الآلي</th>
                <th className="border border-slate-900 p-3 text-right text-sm font-black">الخصم</th>
                <th className="border border-slate-900 p-3 text-right text-sm font-black">آخر جلسة</th>
                <th className="border border-slate-900 p-3 text-right text-sm font-black">القرار</th>
              </tr>
            </thead>
            <tbody>
              {clientCases.map((c, index) => {
                const lastSession = allSessions
                  .filter(s => s.caseId === c.id)
                  .sort((a, b) => b.date.localeCompare(a.date))[0];
                
                return (
                  <tr key={c.id}>
                    <td className="border border-slate-900 p-3 text-sm font-bold text-center">{index + 1}</td>
                    <td className="border border-slate-900 p-3 text-sm font-bold">{c.court || '---'}</td>
                    <td className="border border-slate-900 p-3 text-sm font-black">{c.autoNumber || '---'}</td>
                    <td className="border border-slate-900 p-3 text-sm font-bold">{c.opponent || '---'}</td>
                    <td className="border border-slate-900 p-3 text-sm font-bold">{lastSession?.date || '---'}</td>
                    <td className="border border-slate-900 p-3 text-sm leading-relaxed">{lastSession?.decision || '---'}</td>
                  </tr>
                );
              })}
              {clientCases.length === 0 && (
                <tr>
                  <td colSpan={6} className="border border-slate-900 p-10 text-center font-bold">لا توجد قضايا مسجلة</td>
                </tr>
              )}
            </tbody>
          </table>

          <div className="mt-20 flex justify-between items-end">
            <div className="text-center w-64">
              <p className="font-black text-lg mb-16 text-slate-900">توقيع الموكل</p>
              <div className="border-b-2 border-slate-900"></div>
            </div>
            <div className="text-center w-64">
              <p className="font-black text-lg mb-16 text-slate-900">ختم واعتماد المكتب</p>
              <div className="border-b-2 border-slate-900"></div>
            </div>
          </div>
        </div>
      )}
      {/* Add Case Modal */}
      <AnimatePresence>
        {isAddCaseModalOpen && selectedClientForCases && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddCaseModalOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <h2 className="text-xl font-black text-slate-900">إضافة قضية للموكل: {selectedClientForCases.name}</h2>
                <button onClick={() => setIsAddCaseModalOpen(false)} className="p-2 hover:bg-white rounded-xl transition-all">
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>
              <form onSubmit={handleAddCase} className="p-8 space-y-6 max-h-[80vh] overflow-y-auto">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">رقم القضية</label>
                    <input
                      type="text"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition-all"
                      value={caseFormData.caseNumber}
                      onChange={(e) => setCaseFormData({ ...caseFormData, caseNumber: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">السنة</label>
                    <input
                      type="text"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition-all"
                      value={caseFormData.year}
                      onChange={(e) => setCaseFormData({ ...caseFormData, year: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">المحكمة</label>
                    <select
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition-all"
                      value={caseFormData.court}
                      onChange={(e) => setCaseFormData({ ...caseFormData, court: e.target.value })}
                    >
                      <option value="">اختر المحكمة...</option>
                      <option>محكمة العاصمة</option>
                      <option>محكمة حولي</option>
                      <option>محكمة الفروانية</option>
                      <option>محكمة الجهراء</option>
                      <option>محكمة الأحمدي</option>
                      <option>محكمة مبارك الكبير</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">الدائرة</label>
                    <input
                      type="text"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition-all"
                      value={caseFormData.circuit}
                      onChange={(e) => setCaseFormData({ ...caseFormData, circuit: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">الرقم الآلي</label>
                    <input
                      type="text"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition-all"
                      value={caseFormData.autoNumber}
                      onChange={(e) => setCaseFormData({ ...caseFormData, autoNumber: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">الخصم</label>
                    <input
                      type="text"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition-all"
                      value={caseFormData.opponent}
                      onChange={(e) => setCaseFormData({ ...caseFormData, opponent: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">نوع القضية</label>
                    <select
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition-all"
                      value={caseFormData.caseType}
                      onChange={(e) => setCaseFormData({ ...caseFormData, caseType: e.target.value })}
                    >
                      <option value="">اختر النوع...</option>
                      <option>مدني</option>
                      <option>تجاري</option>
                      <option>أسرة</option>
                      <option>إيجارات</option>
                      <option>عمالي</option>
                      <option>جنائي</option>
                      <option>استئناف</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">صفة الموكل</label>
                    <select
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition-all"
                      value={caseFormData.clientPosition}
                      onChange={(e) => setCaseFormData({ ...caseFormData, clientPosition: e.target.value as any })}
                    >
                      {caseFormData.caseType === 'استئناف' ? (
                        <>
                          <option value="appellant">مستأنف</option>
                          <option value="appellee">مستأنف ضده</option>
                        </>
                      ) : (
                        <>
                          <option value="plaintiff">مدعي</option>
                          <option value="defendant">مدعى عليه</option>
                        </>
                      )}
                    </select>
                  </div>
                </div>
                <div className="pt-4 flex gap-4">
                  <button
                    type="submit"
                    className="flex-1 bg-indigo-600 text-white font-bold py-4 rounded-2xl shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"
                  >
                    <Check className="w-5 h-5" />
                    إضافة القضية
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsAddCaseModalOpen(false)}
                    className="px-8 bg-slate-100 text-slate-600 font-bold py-4 rounded-2xl hover:bg-slate-200 transition-all"
                  >
                    إلغاء
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
