import React, { useState } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Settings, 
  User, 
  Plus, 
  LayoutDashboard, 
  Calendar as CalendarIcon, 
  BarChart3, 
  Briefcase, 
  Users, 
  FileText,
  Link as LinkIcon
} from 'lucide-react';
import { 
  format, 
  addMonths, 
  subMonths, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  isSameMonth, 
  isSameDay, 
  addDays, 
  eachDayOfInterval 
} from 'date-fns';
import { arSA, enUS } from 'date-fns/locale';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

const AdminDashboard: React.FC = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<'week' | 'month'>('month');
  const [activeTab, setActiveTab] = useState('Calendar');

  const navItems = [
    { name: 'Dashboard', icon: LayoutDashboard },
    { name: 'Calendar', icon: CalendarIcon },
    { name: 'Reports', icon: BarChart3 },
    { name: 'Services', icon: Briefcase },
    { name: 'Clients', icon: Users },
    { name: 'Invoices', icon: FileText },
  ];

  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));

  const renderHeader = () => {
    return (
      <header className="w-full bg-white border-b border-slate-100 sticky top-0 z-40">
        <div className="max-w-[1600px] mx-auto px-6 h-20 flex items-center justify-between">
          {/* Left: Logo */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center">
              <LinkIcon className="w-5 h-5 text-[#03A9F4]" />
            </div>
            <span className="text-xl font-bold tracking-tight text-black">Amen</span>
          </div>

          {/* Middle: Navigation */}
          <nav className="hidden md:flex items-center gap-8">
            {navItems.map((item) => (
              <button
                key={item.name}
                onClick={() => setActiveTab(item.name)}
                className={cn(
                  "text-sm font-medium transition-colors hover:text-black",
                  activeTab === item.name ? "text-black" : "text-slate-500"
                )}
              >
                {item.name}
              </button>
            ))}
          </nav>

          {/* Right: Actions */}
          <div className="flex items-center gap-4">
            <button className="bg-black text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-slate-800 transition-all shadow-sm">
              BOOK AN APPOINTMENT
            </button>
            <button className="p-2 hover:bg-slate-50 rounded-full transition-colors">
              <Settings className="w-5 h-5 text-black" />
            </button>
            <div className="w-10 h-10 rounded-full border-2 border-slate-100 bg-slate-50 flex items-center justify-center overflow-hidden">
              <User className="w-6 h-6 text-slate-400" />
            </div>
          </div>
        </div>
      </header>
    );
  };

  const renderControlBar = () => {
    return (
      <div className="w-full max-w-[1600px] mx-auto px-6 py-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <h1 className="text-4xl font-bold text-black">Calendar</h1>
        
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <button 
              onClick={prevMonth}
              className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold hover:bg-slate-50 transition-all flex items-center gap-2"
            >
              <ChevronLeft className="w-4 h-4" />
              Prev
            </button>
            <button 
              onClick={nextMonth}
              className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold hover:bg-slate-50 transition-all flex items-center gap-2"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <span className="text-lg font-medium text-black min-w-[200px] text-center">
            {format(currentDate, 'MMMM d — d, yyyy')}
          </span>

          <div className="flex bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setView('week')}
              className={cn(
                "px-6 py-2 rounded-lg text-sm font-bold transition-all",
                view === 'week' ? "bg-[#03A9F4] text-white shadow-sm" : "text-slate-500 hover:text-black"
              )}
            >
              Week
            </button>
            <button
              onClick={() => setView('month')}
              className={cn(
                "px-6 py-2 rounded-lg text-sm font-bold transition-all",
                view === 'month' ? "bg-[#03A9F4] text-white shadow-sm" : "text-slate-500 hover:text-black"
              )}
            >
              Month
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderDays = () => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return (
      <div className="grid grid-cols-7 mb-4">
        {days.map((day) => (
          <div key={day} className="text-center text-sm font-bold text-black uppercase tracking-wider py-4">
            {day}
          </div>
        ))}
      </div>
    );
  };

  const renderCells = () => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);

    const calendarDays = eachDayOfInterval({
      start: startDate,
      end: endDate,
    });

    const rows = [];
    let days = [];

    calendarDays.forEach((day, i) => {
      const formattedDate = format(day, 'd');
      const isSelected = isSameDay(day, new Date(currentDate.getFullYear(), currentDate.getMonth(), 14)); // Example active day 14
      const isCurrentMonth = isSameMonth(day, monthStart);

      days.push(
        <div
          key={day.toString()}
          className={cn(
            "relative h-32 md:h-40 border-r border-b border-slate-100 p-4 transition-all hover:bg-slate-50/50 group cursor-pointer",
            !isCurrentMonth ? "bg-slate-50/30" : "bg-white"
          )}
        >
          <div className="flex justify-end">
            <span
              className={cn(
                "text-sm font-bold w-8 h-8 flex items-center justify-center rounded-full transition-all",
                !isCurrentMonth ? "text-slate-300" : "text-black",
                isSelected ? "bg-[#03A9F4] text-white shadow-md shadow-sky-100" : "group-hover:bg-slate-100"
              )}
            >
              {formattedDate}
            </span>
          </div>
          
          {/* Event Placeholder */}
          {isSelected && (
            <div className="mt-2 p-2 bg-sky-50 border-l-4 border-[#03A9F4] rounded-r-md">
              <p className="text-[10px] font-bold text-[#03A9F4] uppercase">Client Meeting</p>
              <p className="text-xs font-medium text-slate-700 truncate">Discussion on Case #2024</p>
            </div>
          )}
        </div>
      );

      if ((i + 1) % 7 === 0) {
        rows.push(
          <div className="grid grid-cols-7" key={day.toString()}>
            {days}
          </div>
        );
        days = [];
      }
    });

    return <div className="border-t border-l border-slate-100 rounded-b-3xl overflow-hidden">{rows}</div>;
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-black selection:bg-sky-100 selection:text-sky-900">
      {renderHeader()}
      
      <main className="pb-20">
        {renderControlBar()}

        <div className="max-w-[1600px] mx-auto px-6">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-[32px] shadow-xl shadow-slate-200/50 overflow-hidden border border-slate-100"
          >
            <div className="p-4 md:p-8">
              {renderDays()}
              {renderCells()}
            </div>
          </motion.div>
        </div>
      </main>

      {/* Floating Action Button for Mobile */}
      <button className="fixed bottom-8 right-8 w-14 h-14 bg-black text-white rounded-full shadow-2xl flex items-center justify-center hover:scale-110 transition-transform md:hidden z-50">
        <Plus className="w-6 h-6" />
      </button>
    </div>
  );
};

export default AdminDashboard;
