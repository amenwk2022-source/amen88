import React, { useState, useEffect } from 'react';
import { UserProfile, SystemSettings, UserRole, UserNotificationSettings } from '../types';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { 
  updateDoc, 
  doc, 
  collection, 
  onSnapshot, 
  getDoc, 
  setDoc, 
  deleteDoc,
  query,
  where
} from 'firebase/firestore';
import { 
  User, 
  Mail, 
  Shield, 
  Save, 
  CheckCircle2, 
  Building2, 
  MapPin, 
  Phone, 
  Users, 
  Settings as SettingsIcon, 
  Globe, 
  Trash2, 
  Plus, 
  X,
  AlertTriangle,
  Gavel,
  DollarSign,
  Bell,
  Monitor,
  AtSign,
  FileText
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import ConfirmModal from './ConfirmModal';

interface SettingsProps {
  user: UserProfile;
}

export default function Settings({ user }: SettingsProps) {
  const [activeTab, setActiveTab] = useState<'profile' | 'office' | 'users' | 'notifications'>('profile');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Profile State
  const [profileData, setProfileData] = useState({
    name: user.name,
    email: user.email,
  });

  // Notification Settings State
  const [notifSettings, setNotifSettings] = useState<UserNotificationSettings>({
    id: user.uid,
    emailNotifications: true,
    browserNotifications: true,
    types: {
      deadline: true,
      session: true,
      expert: true,
      task: true,
      note: true,
      consultation: true,
      finance: true
    }
  });

  // System Settings State
  const [systemSettings, setSystemSettings] = useState<SystemSettings>({
    id: 'global',
    officeName: 'مكتب المحاماة الدولي',
    officeDescription: 'للمحاماة والاستشارات القانونية والتحكيم',
    officeAddress: 'مدينة الكويت، برج التحرير، الطابق 15',
    officePhone: '+965 1234 5678',
    officeFax: '+965 1234 5679',
    officeEmail: 'info@lawyer-office.com',
    currency: 'د.ك',
    caseTypes: ['مدني', 'جنائي', 'تجاري', 'أحوال شخصية', 'عمالي', 'إداري'],
    courtNames: [
      'قصر العدل', 
      'محكمة الرقعي', 
      'محكمة حولي', 
      'محكمة الأحمدي', 
      'محكمة الفروانية', 
      'محكمة الجهراء',
      'أسرة حولي',
      'أسرة العاصمة',
      'أسرة مبارك الكبير',
      'أسرة الأحمدي',
      'أسرة الجهراء',
      'أسرة الفروانية'
    ],
  });

  // Users Management State
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [isUsersLoading, setIsUsersLoading] = useState(false);

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<string | null>(null);

  useEffect(() => {
    // Load System Settings
    const loadSettings = async () => {
      try {
        const settingsSnap = await getDoc(doc(db, 'settings', 'global'));
        if (settingsSnap.exists()) {
          const data = settingsSnap.data() as SystemSettings;
          // Ensure new family courts are added if missing
          const newCourts = [
            'أسرة حولي',
            'أسرة العاصمة',
            'أسرة مبارك الكبير',
            'أسرة الأحمدي',
            'أسرة الجهراء',
            'أسرة الفروانية'
          ];
          const updatedCourts = [...data.courtNames];
          let changed = false;
          newCourts.forEach(court => {
            if (!updatedCourts.includes(court)) {
              updatedCourts.push(court);
              changed = true;
            }
          });

          if (changed) {
            const updatedSettings = { ...data, courtNames: updatedCourts };
            setSystemSettings(updatedSettings);
            // Auto-save the new courts to DB
            await setDoc(doc(db, 'settings', 'global'), updatedSettings);
          } else {
            setSystemSettings(data);
          }
        } else {
          // Initialize default settings if not exists
          await setDoc(doc(db, 'settings', 'global'), systemSettings);
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, 'settings');
      }
    };

    loadSettings();

    // Load Notification Settings
    const loadNotifSettings = async () => {
      try {
        const snap = await getDoc(doc(db, 'notificationSettings', user.uid));
        if (snap.exists()) {
          setNotifSettings(snap.data() as UserNotificationSettings);
        } else {
          // Initialize with defaults
          await setDoc(doc(db, 'notificationSettings', user.uid), notifSettings);
        }
      } catch (err) {
        console.error('Error loading notification settings:', err);
      }
    };
    loadNotifSettings();

    // Load Users if Admin
    if (user.role === 'admin') {
      setIsUsersLoading(true);
      const unsub = onSnapshot(collection(db, 'users'), (snapshot) => {
        setAllUsers(snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile)));
        setIsUsersLoading(false);
      });
      return unsub;
    }
  }, [user.role]);

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        name: profileData.name,
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'users');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSystemSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await setDoc(doc(db, 'settings', 'global'), systemSettings);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleNotifSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await setDoc(doc(db, 'notificationSettings', user.uid), notifSettings);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'notificationSettings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateUserRole = async (uid: string, newRole: UserRole) => {
    try {
      await updateDoc(doc(db, 'users', uid), { role: newRole });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'users');
    }
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;
    if (userToDelete === user.uid) {
      setIsDeleteModalOpen(false);
      setUserToDelete(null);
      // We can't use alert, so we'll just return or show a toast if we had one
      return;
    }
    try {
      await deleteDoc(doc(db, 'users', userToDelete));
      setIsDeleteModalOpen(false);
      setUserToDelete(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'users');
    }
  };

  const addCaseType = () => {
    const type = prompt('أدخل نوع القضية الجديد:');
    if (type && !systemSettings.caseTypes.includes(type)) {
      setSystemSettings({
        ...systemSettings,
        caseTypes: [...systemSettings.caseTypes, type]
      });
    }
  };

  const removeCaseType = (type: string) => {
    setSystemSettings({
      ...systemSettings,
      caseTypes: systemSettings.caseTypes.filter(t => t !== type)
    });
  };

  const addCourt = () => {
    const court = prompt('أدخل اسم المحكمة الجديد:');
    if (court && !systemSettings.courtNames.includes(court)) {
      setSystemSettings({
        ...systemSettings,
        courtNames: [...systemSettings.courtNames, court]
      });
    }
  };

  const removeCourt = (court: string) => {
    setSystemSettings({
      ...systemSettings,
      courtNames: systemSettings.courtNames.filter(c => c !== court)
    });
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 rtl" dir="rtl">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 mb-2">الإعدادات</h1>
          <p className="text-slate-500 font-medium">إدارة ملفك الشخصي وإعدادات النظام بالكامل.</p>
        </div>
        
        <div className="flex items-center gap-2 bg-white p-1.5 rounded-2xl border border-slate-200 shadow-sm">
          <button
            onClick={() => setActiveTab('profile')}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all",
              activeTab === 'profile' ? "bg-indigo-600 text-white shadow-lg shadow-indigo-100" : "text-slate-500 hover:bg-slate-50"
            )}
          >
            <User className="w-4 h-4" />
            الملف الشخصي
          </button>
          {(user.role === 'admin' || user.role === 'lawyer') && (
            <button
              onClick={() => setActiveTab('office')}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all",
                activeTab === 'office' ? "bg-indigo-600 text-white shadow-lg shadow-indigo-100" : "text-slate-500 hover:bg-slate-50"
              )}
            >
              <Building2 className="w-4 h-4" />
              إعدادات المكتب
            </button>
          )}
          {user.role === 'admin' && (
            <button
              onClick={() => setActiveTab('users')}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all",
                activeTab === 'users' ? "bg-indigo-600 text-white shadow-lg shadow-indigo-100" : "text-slate-500 hover:bg-slate-50"
              )}
            >
              <Users className="w-4 h-4" />
              المستخدمين
            </button>
          )}
          <button
            onClick={() => setActiveTab('notifications')}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all",
              activeTab === 'notifications' ? "bg-indigo-600 text-white shadow-lg shadow-indigo-100" : "text-slate-500 hover:bg-slate-50"
            )}
          >
            <Bell className="w-4 h-4" />
            التنبيهات
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'profile' && (
          <motion.div
            key="profile"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-8"
          >
            <form onSubmit={handleProfileSubmit} className="space-y-8">
              <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3">
                  <User className="w-5 h-5 text-indigo-600" />
                  <h2 className="text-lg font-bold text-slate-900">بيانات المستخدم</h2>
                </div>
                <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">الاسم الكامل</label>
                    <div className="relative">
                      <User className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-12 pl-4 py-3 text-sm font-medium focus:ring-2 focus:ring-indigo-600 outline-none transition-all"
                        value={profileData.name}
                        onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">البريد الإلكتروني</label>
                    <div className="relative">
                      <Mail className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        disabled
                        type="email"
                        className="w-full bg-slate-100 border border-slate-200 rounded-xl pr-12 pl-4 py-3 text-sm font-medium text-slate-500 cursor-not-allowed"
                        value={profileData.email}
                      />
                    </div>
                    <p className="text-[10px] text-slate-400 font-bold">لا يمكن تغيير البريد الإلكتروني المرتبط بالحساب.</p>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">الدور الوظيفي الحالي</label>
                    <div className="relative">
                      <Shield className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        disabled
                        type="text"
                        className="w-full bg-slate-100 border border-slate-200 rounded-xl pr-12 pl-4 py-3 text-sm font-medium text-slate-500 capitalize cursor-not-allowed"
                        value={user.role === 'admin' ? 'مدير النظام' : user.role === 'lawyer' ? 'محامي' : user.role === 'staff' ? 'موظف إداري' : 'موكل'}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-4">
                {saveSuccess && (
                  <div className="flex items-center gap-2 text-emerald-600 font-bold text-sm">
                    <CheckCircle2 className="w-5 h-5" />
                    تم حفظ التغييرات
                  </div>
                )}
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex items-center gap-2 bg-indigo-600 text-white px-8 py-4 rounded-2xl font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all disabled:opacity-50"
                >
                  {isSaving ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save className="w-5 h-5" />}
                  حفظ الملف الشخصي
                </button>
              </div>
            </form>
          </motion.div>
        )}

        {activeTab === 'notifications' && (
          <motion.div
            key="notifications"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-8"
          >
            <form onSubmit={handleNotifSubmit} className="space-y-8">
              <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3">
                  <Bell className="w-5 h-5 text-indigo-600" />
                  <h2 className="text-lg font-bold text-slate-900">تفضيلات التنبيهات</h2>
                </div>
                <div className="p-8 space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                      <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                        <Monitor className="w-4 h-4 text-indigo-600" />
                        قنوات التنبيه
                      </h3>
                      <div className="space-y-3">
                        <label className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 cursor-pointer hover:bg-white hover:border-indigo-200 transition-all group">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-slate-400 group-hover:text-indigo-600 transition-colors">
                              <Monitor className="w-5 h-5" />
                            </div>
                            <div>
                              <p className="text-sm font-bold text-slate-900">تنبيهات المتصفح</p>
                              <p className="text-[10px] text-slate-500 font-medium">استقبال تنبيهات فورية داخل المتصفح</p>
                            </div>
                          </div>
                          <input
                            type="checkbox"
                            className="w-5 h-5 rounded-lg border-slate-300 text-indigo-600 focus:ring-indigo-600 transition-all"
                            checked={notifSettings.browserNotifications}
                            onChange={async (e) => {
                              const checked = e.target.checked;
                              if (checked && Notification.permission !== 'granted') {
                                const permission = await Notification.requestPermission();
                                if (permission !== 'granted') {
                                  setNotifSettings({ ...notifSettings, browserNotifications: false });
                                  return;
                                }
                              }
                              setNotifSettings({ ...notifSettings, browserNotifications: checked });
                            }}
                          />
                        </label>
                        <label className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 cursor-pointer hover:bg-white hover:border-indigo-200 transition-all group">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-slate-400 group-hover:text-indigo-600 transition-colors">
                              <AtSign className="w-5 h-5" />
                            </div>
                            <div>
                              <p className="text-sm font-bold text-slate-900">تنبيهات البريد الإلكتروني</p>
                              <p className="text-[10px] text-slate-500 font-medium">استلام ملخص يومي وتنبيهات هامة عبر البريد</p>
                            </div>
                          </div>
                          <input
                            type="checkbox"
                            className="w-5 h-5 rounded-lg border-slate-300 text-indigo-600 focus:ring-indigo-600 transition-all"
                            checked={notifSettings.emailNotifications}
                            onChange={(e) => setNotifSettings({ ...notifSettings, emailNotifications: e.target.checked })}
                          />
                        </label>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                        <Shield className="w-4 h-4 text-indigo-600" />
                        أنواع الأحداث
                      </h3>
                      <div className="grid grid-cols-1 gap-3">
                        {[
                          { key: 'deadline', label: 'المواعيد القانونية', desc: 'تنبيهات اقتراب مواعيد الاستئناف والطعن' },
                          { key: 'session', label: 'جلسات المحاكم', desc: 'تنبيهات الجلسات القادمة وتحديثات القرارات' },
                          { key: 'expert', label: 'جلسات الخبراء', desc: 'مواعيد الخبراء والاجتماعات الفنية' },
                          { key: 'task', label: 'المهام والعمليات', desc: 'المهام المسندة إليك وتحديثات الحالة' },
                          { key: 'note', label: 'الملاحظات الداخلية', desc: 'عند إضافة ملاحظة جديدة على قضية تتابعها' },
                          { key: 'consultation', label: 'الاستشارات', desc: 'طلبات الاستشارة الجديدة والردود عليها' },
                          { key: 'finance', label: 'المطالبات المالية', desc: 'تنبيهات الأقساط المتأخرة والتحصيلات المالية' },
                        ].map((type) => (
                          <label key={type.key} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100 cursor-pointer hover:bg-white hover:border-indigo-200 transition-all">
                            <div>
                              <p className="text-xs font-bold text-slate-900">{type.label}</p>
                              <p className="text-[10px] text-slate-500 font-medium">{type.desc}</p>
                            </div>
                            <input
                              type="checkbox"
                              className="w-4 h-4 rounded-md border-slate-300 text-indigo-600 focus:ring-indigo-600 transition-all"
                              checked={notifSettings.types[type.key as keyof typeof notifSettings.types]}
                              onChange={(e) => setNotifSettings({
                                ...notifSettings,
                                types: { ...notifSettings.types, [type.key]: e.target.checked }
                              })}
                            />
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-4">
                {saveSuccess && (
                  <div className="flex items-center gap-2 text-emerald-600 font-bold text-sm">
                    <CheckCircle2 className="w-5 h-5" />
                    تم حفظ تفضيلات التنبيهات
                  </div>
                )}
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex items-center gap-2 bg-indigo-600 text-white px-8 py-4 rounded-2xl font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all disabled:opacity-50"
                >
                  {isSaving ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save className="w-5 h-5" />}
                  حفظ التفضيلات
                </button>
              </div>
            </form>
          </motion.div>
        )}

        {activeTab === 'office' && (
          <motion.div
            key="office"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-8"
          >
            <form onSubmit={handleSystemSubmit} className="space-y-8">
              <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3">
                  <Building2 className="w-5 h-5 text-indigo-600" />
                  <h2 className="text-lg font-bold text-slate-900">بيانات المكتب والتقارير</h2>
                </div>
                <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-sm font-bold text-slate-700">اسم المكتب</label>
                    <div className="relative">
                      <Building2 className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-12 pl-4 py-3 text-sm font-medium focus:ring-2 focus:ring-indigo-600 outline-none transition-all"
                        value={systemSettings.officeName}
                        onChange={(e) => setSystemSettings({ ...systemSettings, officeName: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-sm font-bold text-slate-700">وصف المكتب (يظهر في التقارير)</label>
                    <div className="relative">
                      <FileText className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-12 pl-4 py-3 text-sm font-medium focus:ring-2 focus:ring-indigo-600 outline-none transition-all"
                        value={systemSettings.officeDescription || ''}
                        onChange={(e) => setSystemSettings({ ...systemSettings, officeDescription: e.target.value })}
                        placeholder="مثال: للمحاماة والاستشارات القانونية والتحكيم"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">العنوان</label>
                    <div className="relative">
                      <MapPin className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-12 pl-4 py-3 text-sm font-medium focus:ring-2 focus:ring-indigo-600 outline-none transition-all"
                        value={systemSettings.officeAddress}
                        onChange={(e) => setSystemSettings({ ...systemSettings, officeAddress: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">رقم الهاتف</label>
                    <div className="relative">
                      <Phone className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-12 pl-4 py-3 text-sm font-medium focus:ring-2 focus:ring-indigo-600 outline-none transition-all"
                        value={systemSettings.officePhone}
                        onChange={(e) => setSystemSettings({ ...systemSettings, officePhone: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">رقم الفاكس</label>
                    <div className="relative">
                      <Phone className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-12 pl-4 py-3 text-sm font-medium focus:ring-2 focus:ring-indigo-600 outline-none transition-all"
                        value={systemSettings.officeFax || ''}
                        onChange={(e) => setSystemSettings({ ...systemSettings, officeFax: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">البريد الإلكتروني للمكتب</label>
                    <div className="relative">
                      <Mail className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="email"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-12 pl-4 py-3 text-sm font-medium focus:ring-2 focus:ring-indigo-600 outline-none transition-all"
                        value={systemSettings.officeEmail}
                        onChange={(e) => setSystemSettings({ ...systemSettings, officeEmail: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">العملة المستخدمة</label>
                    <div className="relative">
                      <DollarSign className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-12 pl-4 py-3 text-sm font-medium focus:ring-2 focus:ring-indigo-600 outline-none transition-all"
                        value={systemSettings.currency}
                        onChange={(e) => setSystemSettings({ ...systemSettings, currency: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Gavel className="w-5 h-5 text-indigo-600" />
                      <h2 className="text-lg font-bold text-slate-900">أنواع القضايا</h2>
                    </div>
                    <button
                      type="button"
                      onClick={addCaseType}
                      className="p-2 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-100 transition-all"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="p-6 flex flex-wrap gap-2">
                    {systemSettings.caseTypes.map((type) => (
                      <div key={type} className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl text-sm font-bold text-slate-700">
                        {type}
                        <button type="button" onClick={() => removeCaseType(type)} className="text-slate-400 hover:text-red-600">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Globe className="w-5 h-5 text-indigo-600" />
                      <h2 className="text-lg font-bold text-slate-900">المحاكم</h2>
                    </div>
                    <button
                      type="button"
                      onClick={addCourt}
                      className="p-2 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-100 transition-all"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="p-6 flex flex-wrap gap-2">
                    {systemSettings.courtNames.map((court) => (
                      <div key={court} className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl text-sm font-bold text-slate-700">
                        {court}
                        <button type="button" onClick={() => removeCourt(court)} className="text-slate-400 hover:text-red-600">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-4">
                {saveSuccess && (
                  <div className="flex items-center gap-2 text-emerald-600 font-bold text-sm">
                    <CheckCircle2 className="w-5 h-5" />
                    تم حفظ إعدادات النظام
                  </div>
                )}
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex items-center gap-2 bg-indigo-600 text-white px-8 py-4 rounded-2xl font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all disabled:opacity-50"
                >
                  {isSaving ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save className="w-5 h-5" />}
                  حفظ إعدادات المكتب
                </button>
              </div>
            </form>
          </motion.div>
        )}

        {activeTab === 'users' && (
          <motion.div
            key="users"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-8"
          >
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Users className="w-5 h-5 text-indigo-600" />
                  <h2 className="text-lg font-bold text-slate-900">إدارة مستخدمي النظام</h2>
                </div>
                <div className="text-xs font-black text-slate-400 uppercase tracking-widest">
                  إجمالي المستخدمين: {allUsers.length}
                </div>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-right">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-widest">المستخدم</th>
                      <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-widest">البريد الإلكتروني</th>
                      <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-widest">الدور الوظيفي</th>
                      <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-widest">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {allUsers.map((u) => (
                      <tr key={u.uid} className="hover:bg-slate-50/50 transition-all">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 font-black">
                              {u.name.charAt(0)}
                            </div>
                            <div className="font-bold text-slate-900">{u.name}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm font-medium text-slate-500">{u.email}</td>
                        <td className="px-6 py-4">
                          <select
                            value={u.role}
                            onChange={(e) => handleUpdateUserRole(u.uid, e.target.value as UserRole)}
                            className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-600 transition-all"
                          >
                            <option value="admin">مدير نظام</option>
                            <option value="lawyer">محامي</option>
                            <option value="staff">موظف</option>
                            <option value="client">موكل</option>
                          </select>
                        </td>
                        <td className="px-6 py-4">
                          <button
                            onClick={() => {
                              if (u.uid === user.uid) return;
                              setUserToDelete(u.uid);
                              setIsDeleteModalOpen(true);
                            }}
                            className={cn(
                              "p-2 rounded-xl transition-all",
                              u.uid === user.uid ? "text-slate-200 cursor-not-allowed" : "text-slate-400 hover:text-red-600 hover:bg-red-50"
                            )}
                            title="حذف المستخدم"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              {isUsersLoading && (
                <div className="p-12 flex justify-center">
                  <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>

            <div className="bg-amber-50 border border-amber-200 p-6 rounded-3xl flex items-start gap-4">
              <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0" />
              <div>
                <h4 className="text-amber-900 font-bold mb-1">تنبيه أمني</h4>
                <p className="text-amber-700 text-sm font-medium">
                  تغيير أدوار المستخدمين يمنحهم صلاحيات وصول مختلفة للنظام. يرجى التأكد من منح الصلاحيات المناسبة لكل موظف.
                  حذف المستخدم سيؤدي إلى فقدان وصوله للنظام فوراً.
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setUserToDelete(null);
        }}
        onConfirm={handleDeleteUser}
        title="حذف المستخدم"
        message="هل أنت متأكد من حذف هذا المستخدم؟ لا يمكن التراجع عن هذا الإجراء."
        confirmLabel="حذف"
        cancelLabel="إلغاء"
      />
    </div>
  );
}
