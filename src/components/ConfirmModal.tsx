import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, X } from 'lucide-react';
import { cn } from '../lib/utils';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'info';
}

export default function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'تأكيد',
  cancelLabel = 'إلغاء',
  variant = 'danger'
}: ConfirmModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden rtl"
            dir="rtl"
          >
            <div className="p-6 text-center">
              <div className={cn(
                "w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4",
                variant === 'danger' ? "bg-red-100 text-red-600" :
                variant === 'warning' ? "bg-amber-100 text-amber-600" :
                "bg-indigo-100 text-indigo-600"
              )}>
                <AlertTriangle className="w-8 h-8" />
              </div>
              
              <h3 className="text-xl font-black text-slate-900 mb-2">{title}</h3>
              <p className="text-slate-500 font-medium mb-8">{message}</p>
              
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={onClose}
                  className="px-6 py-3 rounded-xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-all"
                >
                  {cancelLabel}
                </button>
                <button
                  onClick={() => {
                    onConfirm();
                    onClose();
                  }}
                  className={cn(
                    "px-6 py-3 rounded-xl font-bold text-white transition-all shadow-lg",
                    variant === 'danger' ? "bg-red-600 hover:bg-red-700 shadow-red-100" :
                    variant === 'warning' ? "bg-amber-600 hover:bg-amber-700 shadow-amber-100" :
                    "bg-indigo-600 hover:bg-indigo-700 shadow-indigo-100"
                  )}
                >
                  {confirmLabel}
                </button>
              </div>
            </div>
            
            <button 
              onClick={onClose}
              className="absolute top-4 left-4 p-2 hover:bg-slate-100 rounded-xl transition-all"
            >
              <X className="w-5 h-5 text-slate-400" />
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
