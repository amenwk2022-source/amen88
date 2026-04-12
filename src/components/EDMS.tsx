import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, addDoc, doc, deleteDoc, where } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { FileText, Upload, Search, Filter, MoreVertical, Trash2, Eye, Download, X, Plus, Check, File, FileImage, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Document, Case, UserProfile } from '../types';
import { cn } from '../lib/utils';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

interface EDMSProps {
  user: UserProfile;
}

export default function EDMS({ user }: EDMSProps) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<Document | null>(null);
  const [formData, setFormData] = useState<Partial<Document>>({
    caseId: '',
    title: '',
    fileUrl: ''
  });

  useEffect(() => {
    let cq = query(collection(db, 'cases'), orderBy('createdAt', 'desc'));
    if (user.role === 'client') {
      cq = query(collection(db, 'cases'), where('clientId', '==', user.uid));
    }

    const unsub = onSnapshot(query(collection(db, 'documents'), orderBy('uploadDate', 'desc')), (snapshot) => {
      setDocuments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Document)));
      setLoading(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'documents');
      setLoading(false);
    });

    const casesUnsub = onSnapshot(cq, (snapshot) => {
      setCases(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Case)));
    });

    return () => {
      unsub();
      casesUnsub();
    };
  }, [user.uid, user.role]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (user.role === 'client') return;
    try {
      await addDoc(collection(db, 'documents'), {
        ...formData,
        uploadDate: new Date().toISOString()
      });
      setIsModalOpen(false);
      setFormData({ caseId: '', title: '', fileUrl: '' });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'documents');
    }
  };

  const handleDelete = async (id: string) => {
    if (user.role === 'client') return;
    try {
      await deleteDoc(doc(db, 'documents', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'documents');
    }
  };

  const filteredDocs = documents.filter(d => {
    const caseInfo = cases.find(c => c.id === d.caseId);
    if (!caseInfo) return false; // Filter out docs not belonging to client's cases
    
    return d.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
           caseInfo.caseNumber?.includes(searchTerm);
  });

  const isLawyer = user.role === 'admin' || user.role === 'lawyer';

  return (
    <div className="space-y-6 rtl" dir="rtl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 mb-1">الأرشفة الضوئية (EDMS)</h1>
          <p className="text-slate-500 font-medium">إدارة المستندات، صحف الدعاوى، والأحكام إلكترونياً.</p>
        </div>
        {isLawyer && (
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center justify-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all"
          >
            <Upload className="w-5 h-5" />
            رفع مستند جديد
          </button>
        )}
      </div>

      {/* Search & Filters */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
        <div className="flex-1 flex items-center gap-3 bg-slate-50 px-4 py-2 rounded-xl border border-slate-200">
          <Search className="w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="بحث باسم المستند أو رقم القضية..."
            className="bg-transparent border-none focus:ring-0 text-sm w-full font-medium"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Documents Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filteredDocs.map((docItem) => {
          const caseInfo = cases.find(c => c.id === docItem.caseId);
          return (
            <motion.div
              layout
              key={docItem.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all group relative overflow-hidden"
            >
              <div className="aspect-[4/3] bg-slate-50 rounded-xl mb-4 flex items-center justify-center border border-slate-100 group-hover:bg-indigo-50 transition-all overflow-hidden relative">
                {docItem.fileUrl.match(/\.(jpg|jpeg|png|gif)$/i) ? (
                  <img src={docItem.fileUrl} alt={docItem.title} className="w-full h-full object-cover opacity-50 group-hover:opacity-100 transition-opacity" referrerPolicy="no-referrer" />
                ) : (
                  <FileText className="w-16 h-16 text-slate-200 group-hover:text-indigo-200 transition-all" />
                )}
                <div className="absolute inset-0 bg-indigo-600/0 group-hover:bg-indigo-600/10 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                  <button
                    onClick={() => setPreviewDoc(docItem)}
                    className="p-3 bg-white text-indigo-600 rounded-full shadow-lg hover:scale-110 transition-all"
                  >
                    <Eye className="w-6 h-6" />
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <h3 className="text-sm font-black text-slate-900 truncate">{docItem.title}</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                  قضية: {caseInfo?.caseNumber || '---'}
                </p>
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-50">
                  <span className="text-[10px] text-slate-400 font-medium">
                    {(() => {
                      try {
                        if (!docItem.uploadDate) return '---';
                        const d = new Date(docItem.uploadDate);
                        if (isNaN(d.getTime())) return '---';
                        return format(d, 'yyyy/MM/dd', { locale: ar });
                      } catch (e) {
                        console.error('EDMS: Error parsing uploadDate:', docItem.uploadDate, e);
                        return '---';
                      }
                    })()}
                  </span>
                  <div className="flex items-center gap-1">
                    <button className="p-1.5 hover:bg-slate-100 text-slate-400 rounded-lg transition-all">
                      <Download className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => handleDelete(docItem.id)}
                      className="p-1.5 hover:bg-red-50 text-red-400 rounded-lg transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Upload Modal */}
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
                <h2 className="text-xl font-black text-slate-900">رفع مستند جديد</h2>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-white rounded-xl transition-all">
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="p-8 space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">القضية المرتبطة</label>
                  <select
                    required
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition-all"
                    value={formData.caseId}
                    onChange={(e) => setFormData({ ...formData, caseId: e.target.value })}
                  >
                    <option value="">اختر القضية...</option>
                    {cases.map(c => (
                      <option key={c.id} value={c.id}>{c.caseNumber} - {c.clientName}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">عنوان المستند</label>
                  <input
                    required
                    type="text"
                    placeholder="مثال: صحيفة الدعوى، حكم أول درجة..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition-all"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">رابط الملف (أو رابط تجريبي)</label>
                  <input
                    required
                    type="url"
                    placeholder="https://example.com/file.pdf"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition-all"
                    value={formData.fileUrl}
                    onChange={(e) => setFormData({ ...formData, fileUrl: e.target.value })}
                  />
                  <p className="text-[10px] text-slate-400 font-medium">ملاحظة: في هذه النسخة التجريبية، يرجى إدخال رابط مباشر للملف.</p>
                </div>

                <div className="pt-4 flex gap-4">
                  <button
                    type="submit"
                    className="flex-1 bg-indigo-600 text-white font-bold py-4 rounded-2xl shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"
                  >
                    <Check className="w-5 h-5" />
                    رفع وحفظ
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

      {/* Preview Modal */}
      <AnimatePresence>
        {previewDoc && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setPreviewDoc(null)}
              className="absolute inset-0 bg-slate-900/80 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="relative bg-white w-full max-w-5xl h-[90vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col"
            >
              <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-white sticky top-0 z-10">
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-indigo-50 rounded-xl">
                    <FileText className="w-6 h-6 text-indigo-600" />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-slate-900">{previewDoc.title}</h2>
                    <p className="text-xs text-slate-500 font-bold">
                      قضية: {cases.find(c => c.id === previewDoc.caseId)?.caseNumber || '---'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button className="p-3 hover:bg-slate-100 rounded-xl transition-all text-slate-600">
                    <Download className="w-6 h-6" />
                  </button>
                  <button
                    onClick={() => setPreviewDoc(null)}
                    className="p-3 hover:bg-red-50 rounded-xl transition-all text-red-600"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>
              <div className="flex-1 bg-slate-100 p-8 overflow-auto flex items-center justify-center">
                {previewDoc.fileUrl.match(/\.(jpg|jpeg|png|gif)$/i) ? (
                  <img src={previewDoc.fileUrl} alt={previewDoc.title} className="max-w-full max-h-full shadow-2xl rounded-lg" referrerPolicy="no-referrer" />
                ) : (
                  <iframe
                    src={previewDoc.fileUrl}
                    className="w-full h-full rounded-xl border border-slate-200 bg-white shadow-2xl"
                    title="Document Preview"
                  />
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
