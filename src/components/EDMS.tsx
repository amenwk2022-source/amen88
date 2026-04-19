import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, addDoc, doc, deleteDoc, where } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { FileText, Upload, Search, Filter, MoreVertical, Trash2, Eye, Download, X, Plus, Check, File, FileImage, AlertCircle, Bookmark, Folder, Clock, User, Briefcase, FileSignature, Gavel, ClipboardList, ExternalLink, Scale } from 'lucide-react';
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
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [selectedCaseId, setSelectedCaseId] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<Document | null>(null);
  const [formData, setFormData] = useState<Partial<Document>>({
    caseId: '',
    title: '',
    fileUrl: ''
  });

  const categories = [
    { id: 'all', label: 'الكل', icon: Folder },
    { id: 'petition', label: 'صحيفة دعوى', icon: FileText },
    { id: 'poa', label: 'توكيل', icon: FileSignature },
    { id: 'judgment', label: 'حكم قضائي', icon: Gavel },
    { id: 'expert_report', label: 'تقرير خبير', icon: ClipboardList },
    { id: 'evidence', label: 'مستندات ثبوتية', icon: Bookmark },
    { id: 'other', label: 'أخرى', icon: File },
  ];

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
    
    // Filter by case access (for clients)
    if (user.role === 'client' && (!caseInfo || caseInfo.clientId !== user.uid)) return false;
    
    const matchesSearch = d.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         caseInfo?.caseNumber?.includes(searchTerm);
    
    const matchesCategory = activeCategory === 'all' || (d as any).category === activeCategory;
    const matchesCase = selectedCaseId === 'all' || d.caseId === selectedCaseId;
    
    return matchesSearch && matchesCategory && matchesCase;
  });

  const isLawyer = user.role === 'admin' || user.role === 'lawyer';

  return (
    <div className="space-y-8 rtl pb-20" dir="rtl">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 mb-2">الأرشفة الضوئية الرقمية</h1>
          <p className="text-slate-500 font-bold">إدارة الملفات، صحف الدعاوى، والتقارير القانونية إلكترونياً.</p>
        </div>
        {isLawyer && (
          <button
            onClick={() => {
              setFormData({ caseId: '', title: '', fileUrl: '' });
              setIsModalOpen(true);
            }}
            className="flex items-center justify-center gap-2 bg-indigo-600 text-white px-8 py-4 rounded-2xl font-black shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all"
          >
            <Upload className="w-6 h-6" />
            إضافة مستند جديد للملف
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Sidebar Filters */}
        <aside className="space-y-6">
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-6">
            <div>
              <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-4 pr-1">البحث السريع</h3>
              <div className="relative">
                <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  placeholder="ابحث بالعنوان أو رقم القضية..."
                  className="w-full bg-slate-50 border-2 border-transparent focus:border-indigo-600 focus:bg-white rounded-2xl pr-12 pl-4 py-3 text-sm font-bold transition-all outline-none"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            <div>
              <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-4 pr-1">تفريز حسب القضية</h3>
              <select
                className="w-full bg-slate-50 border-2 border-transparent focus:border-indigo-600 focus:bg-white rounded-2xl px-4 py-3 text-sm font-bold transition-all outline-none"
                value={selectedCaseId}
                onChange={(e) => setSelectedCaseId(e.target.value)}
              >
                <option value="all">جميع القضايا والمجلدات</option>
                {cases.map(c => (
                  <option key={c.id} value={c.id}>{c.caseNumber} - {c.clientName}</option>
                ))}
              </select>
            </div>

            <div>
              <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-4 pr-1">تصنيفات الأرشيف</h3>
              <div className="space-y-1">
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setActiveCategory(cat.id)}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all group",
                      activeCategory === cat.id 
                        ? "bg-indigo-600 text-white shadow-lg shadow-indigo-100" 
                        : "text-slate-600 hover:bg-slate-50"
                    )}
                  >
                    <cat.icon className={cn("w-5 h-5 transition-colors", activeCategory === cat.id ? "text-white" : "text-slate-400 group-hover:text-indigo-600")} />
                    {cat.label}
                    {activeCategory === cat.id && (
                      <div className="mr-auto w-1.5 h-1.5 bg-white rounded-full" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="lg:col-span-3 space-y-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-dashed border-slate-300">
              <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4" />
              <p className="text-slate-500 font-bold">جاري تحميل الأرشيف...</p>
            </div>
          ) : filteredDocs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-dashed border-slate-300">
              <div className="p-6 bg-slate-50 rounded-full mb-6">
                <FileText className="w-12 h-12 text-slate-300" />
              </div>
              <h3 className="text-xl font-black text-slate-900 mb-2">لم يتم العثور على مستندات</h3>
              <p className="text-slate-500 font-bold">لا توجد ملفات تطابق معايير البحث الحالية.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              <AnimatePresence mode="popLayout">
                {filteredDocs.map((docItem, idx) => {
                  const caseInfo = cases.find(c => c.id === docItem.caseId);
                  const isImage = docItem.fileUrl.match(/\.(jpeg|jpg|gif|png)$/i);
                  const CategoryIcon = categories.find(c => c.id === (docItem as any).category)?.icon || FileText;
                  
                  return (
                    <motion.div
                      key={docItem.id}
                      layout
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={{ delay: idx * 0.05 }}
                      className="group bg-white rounded-3xl border border-slate-200 shadow-sm hover:shadow-xl hover:shadow-indigo-50 transition-all overflow-hidden"
                    >
                      {/* Document Preview Placeholder */}
                      <div className="aspect-video bg-slate-100 flex items-center justify-center relative overflow-hidden group-hover:bg-slate-50 transition-colors">
                        {isImage ? (
                          <img src={docItem.fileUrl} alt={docItem.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" referrerPolicy="no-referrer" />
                        ) : (
                          <div className="flex flex-col items-center text-slate-400 group-hover:text-indigo-400 transition-colors">
                            <File className="w-12 h-12 mb-2" />
                            <span className="text-[10px] font-black uppercase tracking-widest">{docItem.fileUrl.split('.').pop() || 'DOC'}</span>
                          </div>
                        )}
                        <div className="absolute top-4 right-4 bg-white/90 backdrop-blur px-3 py-1 rounded-lg text-[10px] font-black shadow-sm text-slate-900 border border-white">
                          {docItem.uploadDate ? format(new Date(docItem.uploadDate), 'yyyy/MM/dd') : '---'}
                        </div>
                        <div className="absolute inset-0 bg-indigo-600/0 group-hover:bg-indigo-600/10 transition-colors pointer-events-none" />
                      </div>

                      <div className="p-6">
                        <div className="flex items-start justify-between gap-4 mb-3">
                          <div className="flex-1 min-w-0">
                            <h4 className="text-lg font-black text-slate-900 mb-1 truncate line-clamp-1 group-hover:text-indigo-600 transition-colors" title={docItem.title}>
                              {docItem.title}
                            </h4>
                            <div className="flex items-center gap-2">
                              <span className="p-1 px-2 rounded-md bg-indigo-50 text-indigo-600 font-black text-[9px] flex items-center gap-1">
                                <CategoryIcon className="w-3 h-3" />
                                {categories.find(c => c.id === (docItem as any).category)?.label || 'غير مصنف'}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 group-hover:bg-white group-hover:border-indigo-100 transition-all">
                            <div className="flex items-center gap-2 mb-1">
                              <Scale className="w-3.5 h-3.5 text-slate-400" />
                              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">رقم القضية</span>
                            </div>
                            <div className="text-sm font-black text-slate-700 truncate">{caseInfo?.caseNumber || '---'}</div>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setPreviewDoc(docItem)}
                              className="flex-1 flex items-center justify-center gap-2 bg-indigo-50 text-indigo-600 py-3 rounded-xl font-black text-xs hover:bg-indigo-600 hover:text-white transition-all transform active:scale-95"
                            >
                              <Eye className="w-4 h-4" />
                              عرض
                            </button>
                            <a
                              href={docItem.fileUrl}
                              download
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-3 bg-slate-50 text-slate-600 rounded-xl hover:bg-emerald-50 hover:text-emerald-600 transition-all transform active:scale-95"
                            >
                              <Download className="w-4 h-4" />
                            </a>
                            {isLawyer && (
                              <button
                                onClick={() => {
                                  if (confirm('هل أنت متأكد من حذف هذا المستند؟')) {
                                    handleDelete(docItem.id);
                                  }
                                }}
                                className="p-3 bg-slate-50 text-slate-600 rounded-xl hover:bg-rose-50 hover:text-rose-600 transition-all transform active:scale-95"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </main>
      </div>

      {/* Upload Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsModalOpen(false)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white w-full max-w-xl rounded-[40px] shadow-2xl overflow-hidden border border-white/20"
            >
              <div className="p-10 border-b border-slate-100 flex items-center justify-between">
                <h2 className="text-2xl font-black text-slate-900">أرشفة مستند جديد</h2>
                <button onClick={() => setIsModalOpen(false)} className="p-3 hover:bg-slate-100 rounded-2xl transition-all">
                  <X className="w-6 h-6 text-slate-400" />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="p-10 space-y-8">
                <div className="space-y-3">
                  <label className="text-sm font-black text-slate-700 mr-2">اختيار القضية</label>
                  <select
                    required
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 text-lg font-bold focus:ring-4 focus:ring-indigo-100 focus:border-indigo-600 transition-all outline-none"
                    value={formData.caseId}
                    onChange={(e) => setFormData({ ...formData, caseId: e.target.value })}
                  >
                    <option value="">اختر القضية المرتبطة...</option>
                    {cases.map(c => (
                      <option key={c.id} value={c.id}>{c.caseNumber} - {c.clientName}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-3">
                  <label className="text-sm font-black text-slate-700 mr-2">عنوان المستند</label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: صحيفة استئناف الحكم رقم 123..."
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 text-lg font-bold focus:ring-4 focus:ring-indigo-100 focus:border-indigo-600 transition-all outline-none"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  />
                </div>

                <div className="space-y-3">
                  <label className="text-sm font-black text-slate-700 mr-2">تصنيف المستند</label>
                  <select
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 text-lg font-bold focus:ring-4 focus:ring-indigo-100 focus:border-indigo-600 transition-all outline-none"
                    value={(formData as any).category || 'petition'}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value } as any)}
                  >
                    {categories.filter(c => c.id !== 'all').map(c => (
                      <option key={c.id} value={c.id}>{c.label}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-3">
                  <label className="text-sm font-black text-slate-700 mr-2">رابط المستند (URL)</label>
                  <div className="relative">
                    <input
                      type="url"
                      required
                      placeholder="https://example.com/file.pdf"
                      className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 text-lg font-bold focus:ring-4 focus:ring-indigo-100 focus:border-indigo-600 transition-all outline-none"
                      value={formData.fileUrl}
                      onChange={(e) => setFormData({ ...formData, fileUrl: e.target.value })}
                    />
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 p-2 bg-indigo-50 rounded-lg">
                      <File className="w-5 h-5 text-indigo-600" />
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-400 font-bold px-4">ملاحظة: في هذه النسخة التجريبية، يرجى تقديم رابط مباشر للمستند.</p>
                </div>

                <button type="submit" className="w-full bg-indigo-600 text-white font-black py-5 rounded-[24px] shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center justify-center gap-3 text-lg">
                  <Check className="w-6 h-6" />
                  إرسال المستند للأرشيف
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Preview Modal */}
      <AnimatePresence>
        {previewDoc && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setPreviewDoc(null)} className="absolute inset-0 bg-slate-900/90 backdrop-blur-xl" />
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="relative w-full max-w-6xl h-[90vh] bg-white rounded-[40px] shadow-2xl overflow-hidden flex flex-col"
            >
              <div className="p-8 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-black text-slate-900">{previewDoc.title}</h2>
                  <p className="text-indigo-600 font-bold">معاينة المستند الرقمي</p>
                </div>
                <div className="flex items-center gap-4">
                  <a href={previewDoc.fileUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 bg-slate-100 text-slate-900 px-6 py-3 rounded-2xl font-black text-sm hover:bg-slate-200 transition-all">
                    <ExternalLink className="w-5 h-5" />
                    فتح في نافذة جديدة
                  </a>
                  <button onClick={() => setPreviewDoc(null)} className="p-3 hover:bg-slate-100 rounded-2xl transition-all">
                    <X className="w-7 h-7 text-slate-400" />
                  </button>
                </div>
              </div>
              <div className="flex-1 bg-slate-50 p-10 overflow-hidden relative">
                {previewDoc.fileUrl.match(/\.(jpeg|jpg|gif|png)$/i) ? (
                  <div className="w-full h-full flex items-center justify-center">
                    <img src={previewDoc.fileUrl} alt={previewDoc.title} className="max-w-full max-h-full object-contain rounded-xl shadow-2xl" referrerPolicy="no-referrer" />
                  </div>
                ) : (
                  <iframe
                    src={`https://docs.google.com/viewer?url=${encodeURIComponent(previewDoc.fileUrl)}&embedded=true`}
                    className="w-full h-full rounded-xl border-0 shadow-2xl bg-white"
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
