import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged, auth, db } from './firebase';
import { doc, getDoc } from 'firebase/firestore';
import { UserProfile } from './types';
import Layout from './components/Layout';
import Auth from './components/Auth';
import Dashboard from './components/Dashboard';
import ClientManagement from './components/ClientManagement';
import CaseManagement from './components/CaseManagement';
import SessionRelay from './components/SessionRelay';
import FinanceManagement from './components/Finance';
import EDMS from './components/EDMS';
import { ErrorBoundary } from './components/ErrorBoundary';

export default function App() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const userRef = doc(db, 'users', firebaseUser.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          setUser({ uid: firebaseUser.uid, ...userSnap.data() } as UserProfile);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return unsub;
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 rtl" dir="rtl">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-500 font-bold">جاري تحميل Loyer OS...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Auth />;
  }

  return (
    <ErrorBoundary>
      <Router>
        <Layout user={user}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/clients" element={<ClientManagement />} />
            <Route path="/cases" element={<CaseManagement />} />
            <Route path="/sessions" element={<SessionRelay />} />
            <Route path="/finance" element={<FinanceManagement />} />
            <Route path="/documents" element={<EDMS />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Layout>
      </Router>
    </ErrorBoundary>
  );
}
