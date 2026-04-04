import React, { useState, useEffect } from 'react';
import { collection, addDoc, onSnapshot, query, orderBy, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Plus, Search, MoreVertical, Phone, CreditCard, MapPin, FileText, Trash2, Edit2, X, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Client } from '../types';
import { cn } from '../lib/utils';

export default function ClientManagement() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [formData, setFormData] = useState<Partial<Client>>({
    name: '',
    phone: '',
    civilId: '',
    address: '',
    poaNumber: ''
  });

  useEffect(() => {
    const q = query(collection(db, 'clients'), orderBy('name', 'asc'));
    const unsub = onSnapshot(q, (snapshot) => {
      setClients(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client)));
      setLoading(false);
    });
    return unsub;
  }, []);

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
    if (window.confirm('هل أنت متأكد من حذف هذا الموكل؟')) {
      await deleteDoc(doc(db, 'clients', id));
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
              <button className="text-indigo-600 text-xs font-black hover:underline flex items-center gap-1">
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
    </div>
  );
}
