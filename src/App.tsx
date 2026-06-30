import React, { useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Auth } from './components/Auth';
import { Dashboard } from './components/Dashboard';
import { Groups } from './components/Groups';
import { GroupDetail } from './components/GroupDetail';
import { Reports } from './components/Reports';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Landmark, LayoutDashboard, Users, BarChart3, LogOut, 
  Menu, X, ShieldCheck, HelpCircle 
} from 'lucide-react';

const MainAppContent: React.FC = () => {
  const { user, activeGroup, setActiveGroupId, logout } = useApp();
  const [activeView, setActiveView] = useState<'dashboard' | 'groups' | 'reports'>('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);

  if (!user) {
    return <Auth />;
  }

  const navigateToGroup = (groupId: string) => {
    setActiveGroupId(groupId);
    setActiveView('groups');
    setIsMobileMenuOpen(false);
  };

  const openCreateGroup = () => {
    setIsCreateGroupOpen(true);
    setActiveGroupId(null);
    setActiveView('groups');
    setIsMobileMenuOpen(false);
  };

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'groups', label: 'Shared Groups', icon: Users },
    { id: 'reports', label: 'Monthly Reports', icon: BarChart3 },
  ] as const;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row text-slate-900 font-sans">
      
      {/* MOBILE HEADER */}
      <header className="md:hidden bg-white text-slate-900 px-4 py-3 flex justify-between items-center border-b border-slate-200">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-sm">
            <div className="w-4 h-4 border-2 border-white rounded-sm"></div>
          </div>
          <span className="font-bold text-lg tracking-tight font-display">SettleUp</span>
        </div>

        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-1.5 text-slate-500 hover:text-slate-900 transition-colors cursor-pointer"
        >
          {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </header>

      {/* MOBILE SLIDE MENU NAVIGATION */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, x: -100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -100 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-white text-slate-950 z-40 md:hidden flex flex-col pt-16 px-6 pb-6 justify-between border-r border-slate-200"
          >
            <div className="space-y-6">
              <nav className="space-y-2">
                {navItems.map(item => {
                  const Icon = item.icon;
                  const isActive = activeView === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        setActiveView(item.id);
                        if (item.id !== 'groups') setActiveGroupId(null);
                        setIsMobileMenuOpen(false);
                      }}
                      className={`w-full flex items-center space-x-3 px-4 py-3.5 rounded-2xl text-sm font-semibold transition-colors cursor-pointer ${
                        isActive 
                          ? 'bg-indigo-50 text-indigo-700' 
                          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </nav>
            </div>

            <div className="border-t border-slate-200 pt-5 space-y-4">
              <div className="flex items-center space-x-3 px-2">
                <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center font-bold text-indigo-700">
                  {user.displayName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h4 className="text-sm font-semibold truncate max-w-[150px] text-slate-900">{user.displayName}</h4>
                  <p className="text-xs text-slate-500 truncate max-w-[150px]">{user.email}</p>
                </div>
              </div>

              <button
                onClick={logout}
                className="w-full flex items-center space-x-3 px-4 py-3 bg-slate-100 hover:bg-rose-50 hover:text-rose-600 rounded-2xl text-xs font-bold text-slate-600 transition-colors cursor-pointer"
              >
                <LogOut className="h-4 w-4" />
                <span>Sign Out</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* DESKTOP SIDEBAR */}
      <aside className="hidden md:flex flex-col w-64 bg-white text-slate-900 p-5 justify-between min-h-screen border-r border-slate-200">
        <div className="space-y-8">
          {/* Logo */}
          <div className="flex items-center space-x-2.5 px-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-sm shadow-indigo-100">
              <div className="w-4 h-4 border-2 border-white rounded-sm"></div>
            </div>
            <span className="font-bold text-xl tracking-tight font-display text-slate-900">SettleUp</span>
          </div>

          {/* Navigation Menu */}
          <nav className="space-y-1.5">
            {navItems.map(item => {
              const Icon = item.icon;
              const isActive = activeView === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveView(item.id);
                    if (item.id !== 'groups') setActiveGroupId(null);
                  }}
                  className={`w-full flex items-center space-x-3 px-4 py-3 rounded-2xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                    isActive 
                      ? 'bg-indigo-50 text-indigo-700 font-semibold' 
                      : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* User profile footer */}
        <div className="border-t border-slate-150 pt-4 space-y-4">
          <div className="flex items-center space-x-3 px-2">
            <div className="h-9 w-9 rounded-full bg-indigo-100 flex items-center justify-center font-bold text-indigo-700 shadow-inner">
              {user.displayName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="text-xs font-bold truncate text-slate-900">{user.displayName}</h4>
              <p className="text-[10px] text-slate-500 truncate">{user.email}</p>
            </div>
          </div>

          <button
            onClick={logout}
            className="w-full flex items-center space-x-2.5 px-4 py-2.5 bg-slate-50 hover:bg-rose-50 hover:text-rose-600 border border-slate-150 rounded-xl text-[10px] font-bold text-slate-500 uppercase tracking-wider transition-colors cursor-pointer"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* MAIN VIEW CONTROLLER AREA */}
      <main className="flex-1 p-4 md:p-8 max-w-6xl mx-auto w-full">
        <motion.div
          key={`${activeView}-${activeGroup?.id || 'none'}`}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="h-full"
        >
          {activeView === 'dashboard' && (
            <Dashboard 
              onNavigateToGroup={navigateToGroup} 
              onOpenCreateGroup={openCreateGroup}
            />
          )}

          {activeView === 'groups' && (
            activeGroup ? (
              <GroupDetail onBack={() => setActiveGroupId(null)} />
            ) : (
              <Groups 
                onNavigateToGroup={navigateToGroup}
                isCreateOpen={isCreateGroupOpen}
                setIsCreateOpen={setIsCreateGroupOpen}
              />
            )
          )}

          {activeView === 'reports' && (
            <Reports />
          )}
        </motion.div>
      </main>
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <MainAppContent />
    </AppProvider>
  );
}
