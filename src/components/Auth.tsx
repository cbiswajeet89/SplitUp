import React from 'react';
import { useApp } from '../context/AppContext';
import { motion } from 'motion/react';
import { ArrowRight, ShieldCheck, RefreshCw, BarChart3, Coins } from 'lucide-react';

export const Auth: React.FC = () => {
  const { loginWithGoogle, loginAsDemo } = useApp();

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-md shadow-indigo-100">
            <div className="w-5 h-5 border-2 border-white rounded-md"></div>
          </div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-bold text-slate-900 tracking-tight font-display">
          SettleUp
        </h2>
        <p className="mt-2 text-center text-sm text-slate-500 max-w-xs mx-auto leading-relaxed">
          The ultimate multi-currency shared expense tracker & transaction minimizer.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-lg">
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="bg-white py-8 px-4 shadow-sm rounded-3xl sm:px-10 border border-slate-200"
        >
          <div className="space-y-6">
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 space-y-3">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Key Capabilities</h3>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-start space-x-2">
                  <ShieldCheck className="h-4 w-4 text-indigo-600 mt-0.5 flex-shrink-0" />
                  <span className="text-xs text-slate-600">Secure Shared Groups</span>
                </div>
                <div className="flex items-start space-x-2">
                  <RefreshCw className="h-4 w-4 text-indigo-600 mt-0.5 flex-shrink-0" />
                  <span className="text-xs text-slate-600">Smart Settle Minimizer</span>
                </div>
                <div className="flex items-start space-x-2">
                  <Coins className="h-4 w-4 text-indigo-600 mt-0.5 flex-shrink-0" />
                  <span className="text-xs text-slate-600">Multi-Currency Rates</span>
                </div>
                <div className="flex items-start space-x-2">
                  <BarChart3 className="h-4 w-4 text-indigo-600 mt-0.5 flex-shrink-0" />
                  <span className="text-xs text-slate-600">Automated Monthly Reports</span>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <button
                type="button"
                id="google-signin-btn"
                onClick={loginWithGoogle}
                className="w-full flex justify-center items-center py-3 px-4 border border-slate-200 rounded-2xl shadow-sm text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors cursor-pointer"
              >
                <svg className="h-5 w-5 mr-2" viewBox="0 0 24 24" width="24" height="24" xmlns="http://www.w3.org/2000/svg">
                  <g transform="matrix(1, 0, 0, 1, 0, 0)">
                    <path d="M21.35,11.1H12v2.7h5.38C16.88,15.75,14.8,17.1,12,17.1c-3.15,0-5.8-2.15-6.75-5.05c-0.25-0.75-0.4-1.55-0.4-2.4s0.15-1.65,0.4-2.4C6.2,4.35,8.85,2.2,12,2.2c1.9,0,3.6,0.7,4.95,2l2.05-2.05C17.05,0.4,14.7,0,12,0C7.35,0,3.35,2.65,1.4,6.55c-0.55,1.1-0.9,2.3-0.9,3.6s0.35,2.5,0.9,3.6c1.95,3.9,5.95,6.55,10.6,6.55c2.95,0,5.7-1,7.65-2.8c2.45-2.25,3.75-5.4,3.75-9.1C23.4,11.9,23.35,11.5,21.35,11.1z" fill="#4285F4"/>
                  </g>
                </svg>
                Sign in with Google
              </button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-slate-400">Or experience instantly</span>
                </div>
              </div>

              <button
                type="button"
                id="sandbox-signin-btn"
                onClick={loginAsDemo}
                className="w-full flex justify-center items-center py-3.5 px-4 border border-transparent rounded-2xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors shadow-sm shadow-indigo-100 cursor-pointer"
              >
                Explore Demo Sandbox
                <ArrowRight className="ml-2 h-4 w-4" />
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};
