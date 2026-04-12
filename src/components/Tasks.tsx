import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where, orderBy, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { 
  CheckCircle2, 
  Circle, 
  Clock, 
  Plus, 
  Search, 
  Filter, 
  MoreVertical, 
  Trash2, 
  Edit2,
  AlertCircle,
  User,
  Briefcase,
  X,
  Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Task, UserProfile, Case } from '../types';
import { cn } from '../lib/utils';
import { format, parseISO } from 'date-fns';
import { arSA } from 'date-fns/locale';

interface TasksProps {
  user: UserProfile;
}

export default function Tasks({ user }: TasksProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [cases, setCases] = useState<Case[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [caseSearchQuery, setCaseSearchQuery] = useState('');
  const [showCaseDropdown, setShowCaseDropdown] = useState(false);

  const [formData, setFormData] = useState<Partial<Task>>({
    title: '',
    description: '',
    assignedTo: user.uid,
    dueDate: new Date().toISOString().split('T')[0],
    status: 'pending',
    priority: 'medium',
    caseId: ''
  });

  useEffect(() => {
    let cq = query(collection(db, 'cases'), orderBy('createdAt', 'desc'));
    if (user.role === 'client') {
      cq = query(collection(db, 'cases'), where('clientId', '==', user.uid));
    }

    const unsubTasks = onSnapshot(
      query(collection(db, 'tasks'), orderBy('dueDate', 'asc')),
      (snapshot) => {
        setTasks(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task)));
        setLoading(false);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'tasks')
    );

    const unsubCases = onSnapshot(cq, (snapshot) => {
      setCases(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Case)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'cases'));

    const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      setUsers(snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'users'));

    return () => {
      unsubTasks();
      unsubCases();
      unsubUsers();
    };
  }, [user.uid, user.role]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (user.role === 'client') return;
    try {
      if (editingTask) {
        await updateDoc(doc(db, 'tasks', editingTask.id), formData);
      } else {
        await addDoc(collection(db, 'tasks'), {
          ...formData,
          createdAt: new Date().toISOString()
        });
      }
      setIsModalOpen(false);
      setEditingTask(null);
      setCaseSearchQuery('');
      setFormData({
        title: '',
        description: '',
        assignedTo: user.uid,
        dueDate: new Date().toISOString().split('T')[0],
        status: 'pending',
        priority: 'medium',
        caseId: ''
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'tasks');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('هل أنت متأكد من حذف هذه المهمة؟')) return;
    try {
      await deleteDoc(doc(db, 'tasks', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'tasks');
    }
  };

  const toggleStatus = async (task: Task) => {
    const newStatus = task.status === 'completed' ? 'pending' : 'completed';
    try {
      await updateDoc(doc(db, 'tasks', task.id), { status: newStatus });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'tasks');
    }
  };

  const isLawyer = user.role === 'admin' || user.role === 'lawyer';

  const filteredTasks = tasks.filter(t => {
    const matchesSearch = t.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         t.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || t.status === statusFilter;
    const matchesCase = cases.some(c => c.id === t.caseId);
    return matchesSearch && matchesStatus && matchesCase;
  });

  const filteredCasesForSearch = cases.filter(c => 
    c.caseNumber?.toLowerCase().includes(caseSearchQuery.toLowerCase()) || 
    c.clientName?.toLowerCase().includes(caseSearchQuery.toLowerCase()) ||
    c.autoNumber?.toLowerCase().includes(caseSearchQuery.toLowerCase())
  );

  const selectedCase = cases.find(c => c.id === formData.caseId);

  return (
    <div className="space-y-8 rtl" dir="rtl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 mb-1">إدارة المهام الداخلية</h1>
          <p className="text-slate-500 font-medium">تنظيم ومتابعة مهام فريق العمل.</p>
        </div>
        {isLawyer && (
          <button
            onClick={() => {
              setEditingTask(null);
              setCaseSearchQuery('');
              setFormData({
                title: '',
                description: '',
                assignedTo: user.uid,
                dueDate: new Date().toISOString().split('T')[0],
                status: 'pending',
                priority: 'medium',
                caseId: ''
              });
              setIsModalOpen(true);
            }}
            className="flex items-center justify-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all"
          >
            <Plus className="w-5 h-5" />
            إضافة مهمة جديدة
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="بحث في المهام..."
            className="w-full bg-white border border-slate-200 rounded-xl pr-12 pl-4 py-3 text-sm font-medium focus:ring-2 focus:ring-indigo-600 outline-none transition-all"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          {['all', 'pending', 'in-progress', 'completed'].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={cn(
                "px-4 py-2 rounded-xl text-sm font-bold transition-all border",
                statusFilter === status 
                  ? "bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-100" 
                  : "bg-white text-slate-600 border-slate-200 hover:border-indigo-200"
              )}
            >
              {status === 'all' ? 'الكل' : 
               status === 'pending' ? 'قيد الانتظار' : 
               status === 'in-progress' ? 'قيد التنفيذ' : 'مكتملة'}
            </button>
          ))}
        </div>
      </div>

      {/* Tasks Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <AnimatePresence mode="popLayout">
          {filteredTasks.map((task) => {
            const assignedUser = users.find(u => u.uid === task.assignedTo);
            const relatedCase = cases.find(c => c.id === task.caseId);
            const isOverdue = new Date(task.dueDate) < new Date() && task.status !== 'completed';

            return (
              <motion.div
                layout
                key={task.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className={cn(
                  "bg-white p-6 rounded-2xl border transition-all group relative overflow-hidden",
                  task.status === 'completed' ? "border-slate-100 opacity-75" : "border-slate-200 hover:shadow-xl hover:border-indigo-200"
                )}
              >
                {/* Priority Indicator */}
                <div className={cn(
                  "absolute top-0 right-0 w-1 h-full",
                  task.priority === 'high' ? "bg-red-500" : 
                  task.priority === 'medium' ? "bg-amber-500" : "bg-blue-500"
                )} />

                <div className="flex items-start justify-between mb-4">
                  <button 
                    onClick={() => toggleStatus(task)}
                    disabled={!isLawyer}
                    className={cn(
                      "p-2 rounded-xl transition-all",
                      task.status === 'completed' ? "bg-emerald-50 text-emerald-600" : "bg-slate-50 text-slate-400 hover:bg-indigo-50 hover:text-indigo-600",
                      !isLawyer && "cursor-default"
                    )}
                  >
                    {task.status === 'completed' ? <CheckCircle2 className="w-6 h-6" /> : <Circle className="w-6 h-6" />}
                  </button>
                  {isLawyer && (
                    <div className="flex gap-1">
                      <button 
                        onClick={() => {
                          setEditingTask(task);
                          setFormData(task);
                          setCaseSearchQuery('');
                          setIsModalOpen(true);
                        }}
                        className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDelete(task.id)}
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>

                <h3 className={cn(
                  "text-lg font-black mb-2 transition-all",
                  task.status === 'completed' ? "text-slate-400 line-through" : "text-slate-900"
                )}>
                  {task.title}
                </h3>
                
                {task.description && (
                  <p className="text-sm text-slate-500 font-medium mb-4 line-clamp-2">{task.description}</p>
                )}

                <div className="space-y-3 pt-4 border-t border-slate-50">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <div className="flex items-center gap-2 text-slate-500">
                      <Clock className={cn("w-4 h-4", isOverdue ? "text-red-500 animate-pulse" : "text-slate-400")} />
                      <span className={isOverdue ? "text-red-600" : ""}>
                        {(() => {
                          try {
                            if (!task.dueDate) return '---';
                            const d = parseISO(task.dueDate);
                            if (isNaN(d.getTime())) return '---';
                            return format(d, 'dd MMMM yyyy', { locale: arSA });
                          } catch (e) {
                            console.error('Tasks: Error parsing dueDate:', task.dueDate, e);
                            return '---';
                          }
                        })()}
                      </span>
                    </div>
                    <span className={cn(
                      "px-2 py-1 rounded-lg uppercase tracking-tighter",
                      task.priority === 'high' ? "bg-red-50 text-red-600" : 
                      task.priority === 'medium' ? "bg-amber-50 text-amber-600" : "bg-blue-50 text-blue-600"
                    )}>
                      {task.priority === 'high' ? 'عالية' : task.priority === 'medium' ? 'متوسطة' : 'عادية'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-black text-slate-600 border border-slate-200">
                        {assignedUser?.name?.[0] || 'U'}
                      </div>
                      <span className="text-[10px] font-bold text-slate-500">{assignedUser?.name || 'غير معين'}</span>
                    </div>
                    {relatedCase && (
                      <div className="flex items-center gap-1 text-[10px] font-black text-indigo-600 bg-indigo-50 px-2 py-1 rounded-lg">
                        <Briefcase className="w-3 h-3" />
                        {relatedCase.caseNumber}
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setIsModalOpen(false);
                setCaseSearchQuery('');
              }}
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
                  {editingTask ? 'تعديل المهمة' : 'إضافة مهمة جديدة'}
                </h2>
                <button onClick={() => {
                  setIsModalOpen(false);
                  setCaseSearchQuery('');
                }} className="p-2 hover:bg-white rounded-xl transition-all">
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="p-8 space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">عنوان المهمة</label>
                  <input
                    required
                    type="text"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-indigo-600 outline-none transition-all"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">الوصف</label>
                  <textarea
                    rows={3}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-indigo-600 outline-none transition-all"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">تاريخ الاستحقاق</label>
                    <input
                      required
                      type="date"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-indigo-600 outline-none transition-all"
                      value={formData.dueDate}
                      onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">الأولوية</label>
                    <select
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-indigo-600 outline-none transition-all"
                      value={formData.priority}
                      onChange={(e) => setFormData({ ...formData, priority: e.target.value as any })}
                    >
                      <option value="low">عادية</option>
                      <option value="medium">متوسطة</option>
                      <option value="high">عالية</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">إسناد إلى</label>
                    <select
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-indigo-600 outline-none transition-all"
                      value={formData.assignedTo}
                      onChange={(e) => setFormData({ ...formData, assignedTo: e.target.value })}
                    >
                      {users.map(u => (
                        <option key={u.uid} value={u.uid}>{u.name} ({u.role})</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2 relative">
                    <label className="text-sm font-bold text-slate-700">القضية المرتبطة</label>
                    <div className="relative">
                      <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        placeholder="ابحث بالاسم أو الرقم..."
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-10 pl-4 py-3 text-sm font-medium focus:ring-2 focus:ring-indigo-600 outline-none transition-all"
                        value={caseSearchQuery || (selectedCase ? `${selectedCase.caseNumber} - ${selectedCase.clientName}` : '')}
                        onFocus={() => setShowCaseDropdown(true)}
                        onChange={(e) => {
                          setCaseSearchQuery(e.target.value);
                          setShowCaseDropdown(true);
                        }}
                      />
                    </div>
                    
                    {showCaseDropdown && (
                      <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-48 overflow-y-auto">
                        <button
                          type="button"
                          className="w-full text-right px-4 py-2 text-sm hover:bg-slate-50 font-bold text-slate-500 border-b border-slate-50"
                          onClick={() => {
                            setFormData({ ...formData, caseId: '' });
                            setCaseSearchQuery('');
                            setShowCaseDropdown(false);
                          }}
                        >
                          بدون قضية
                        </button>
                        {filteredCasesForSearch.map(c => (
                          <button
                            key={c.id}
                            type="button"
                            className="w-full text-right px-4 py-3 text-sm hover:bg-indigo-50 transition-all border-b border-slate-50 last:border-0"
                            onClick={() => {
                              setFormData({ ...formData, caseId: c.id });
                              setCaseSearchQuery(`${c.caseNumber} - ${c.clientName}`);
                              setShowCaseDropdown(false);
                            }}
                          >
                            <div className="font-black text-slate-900">{c.caseNumber}</div>
                            <div className="text-[10px] text-slate-500">{c.clientName} {c.autoNumber ? `(${c.autoNumber})` : ''}</div>
                          </button>
                        ))}
                        {filteredCasesForSearch.length === 0 && (
                          <div className="p-4 text-center text-xs text-slate-400 font-bold">لا توجد نتائج</div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-4 flex gap-4">
                  <button
                    type="submit"
                    className="flex-1 bg-indigo-600 text-white font-bold py-4 rounded-2xl shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"
                  >
                    <Check className="w-5 h-5" />
                    {editingTask ? 'حفظ التعديلات' : 'إضافة المهمة'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsModalOpen(false);
                      setCaseSearchQuery('');
                    }}
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
