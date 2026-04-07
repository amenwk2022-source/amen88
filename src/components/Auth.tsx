import React, { useState, useEffect } from 'react';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { motion } from 'motion/react';
import { Scale, ShieldCheck, UserCheck, AlertCircle } from 'lucide-react';

export default function Auth() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createProfile = async (user: any) => {
    const userRef = doc(db, 'users', user.uid);
    try {
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) {
        const role = user.email === 'amenwk2022@gmail.com' ? 'admin' : 'staff';
        await setDoc(userRef, {
          uid: user.uid,
          name: user.displayName || 'Unnamed User',
          email: user.email,
          role: role,
          createdAt: new Date().toISOString()
        });
      }
    } catch (err: any) {
      handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}`);
    }
  };

  const handleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      await createProfile(result.user);
      // App.tsx will pick up the change via onAuthStateChanged
    } catch (err: any) {
      console.error('Login error:', err);
      if (err.code === 'auth/unauthorized-domain') {
        setError('هذا النطاق (Domain) غير مصرح له بتسجيل الدخول في إعدادات Firebase. يرجى إضافة رابط Vercel إلى قائمة Authorized Domains.');
      } else if (err.code === 'auth/popup-blocked') {
        setError('تم حظر النافذة المنبثقة. يرجى السماح بالنوافذ المنبثقة لهذا الموقع والمحاولة مرة أخرى.');
      } else {
        setError('فشل تسجيل الدخول. يرجى المحاولة مرة أخرى أو التأكد من السماح بالنوافذ المنبثقة.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Check if user is already logged in but profile is missing
  useEffect(() => {
    if (auth.currentUser) {
      createProfile(auth.currentUser);
    }
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4 rtl" dir="rtl">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-white p-8 rounded-2xl shadow-xl border border-slate-200 text-center"
      >
        <div className="mb-8 flex justify-center">
          <div className="p-4 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-200">
            <Scale className="w-12 h-12 text-white" />
          </div>
        </div>

        <h1 className="text-3xl font-bold text-slate-900 mb-2">Loyer OS</h1>
        <p className="text-slate-500 mb-8 font-medium">نظام إدارة المكاتب القانونية - الجيل القادم</p>

        {error && (
          <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-xl border border-red-100 text-sm flex items-center gap-2">
            <AlertCircle className="w-5 h-5 shrink-0" />
            {error}
          </div>
        )}

        <button
          onClick={handleLogin}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 bg-white border-2 border-slate-200 text-slate-700 font-bold py-3 px-6 rounded-xl hover:bg-slate-50 hover:border-indigo-600 hover:text-indigo-600 transition-all disabled:opacity-50"
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          ) : (
            <>
              <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5" />
              تسجيل الدخول باستخدام Google
            </>
          )}
        </button>

        <div className="mt-8 grid grid-cols-3 gap-4">
          <div className="flex flex-col items-center gap-1">
            <ShieldCheck className="w-5 h-5 text-indigo-600" />
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">أمان عالٍ</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <UserCheck className="w-5 h-5 text-indigo-600" />
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">صلاحيات مرنة</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <Scale className="w-5 h-5 text-indigo-600" />
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">إدارة ذكية</span>
          </div>
        </div>

        <div className="mt-8 p-4 bg-slate-50 rounded-xl border border-slate-100 text-[10px] text-slate-400 font-medium">
          إذا واجهت مشكلة في تسجيل الدخول، يرجى فتح التطبيق في نافذة جديدة.
        </div>
      </motion.div>
    </div>
  );
}
