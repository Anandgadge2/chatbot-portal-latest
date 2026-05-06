"use client";

import React from 'react';

export default function MaintenancePage() {
  return (
    <div className="min-h-screen bg-[#fcfcfd] flex flex-col items-center justify-center p-6 font-sans antialiased text-[#1a1c21]">
      {/* Top Branding */}
      <div className="absolute top-8 left-8 flex items-center gap-2">
        <div className="w-8 h-8 bg-[#2563eb] rounded-lg flex items-center justify-center text-white font-bold">P</div>
        <span className="font-bold text-xl tracking-tight">PugArch <span className="text-[#64748b] font-medium">Connect</span></span>
      </div>

      <div className="max-w-xl w-full text-center">
        {/* Modern Illustration/Icon */}
        <div className="relative mb-12">
          <div className="absolute inset-0 bg-blue-100/50 blur-3xl rounded-full scale-150"></div>
          <div className="relative z-10 flex justify-center">
            <div className="w-32 h-32 bg-white rounded-3xl shadow-2xl flex items-center justify-center border border-gray-100">
              <svg 
                className="w-16 h-16 text-[#2563eb]" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={1.5} 
                  d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" 
                />
              </svg>
            </div>
          </div>
        </div>

        <h1 className="text-4xl font-bold mb-4 tracking-tight text-[#0f172a]">
          Under Maintenance
        </h1>
        
        <p className="text-lg text-[#64748b] mb-10 leading-relaxed">
          The <span className="font-semibold text-[#0f172a]">Grievance Portal</span> is currently undergoing a scheduled update to improve system performance and security.
        </p>

        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm mb-10 text-left">
          <div className="flex items-start gap-4">
            <div className="mt-1 w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
            <div>
              <h3 className="font-semibold text-sm uppercase tracking-wider text-[#94a3b8] mb-2">Current Status</h3>
              <p className="text-[#334155] font-medium leading-relaxed">
                The portal is undergoing a scheduled system update. We expect all services to be fully operational shortly. <span className="block mt-1 text-[#64748b] text-sm">Please try again in 15-20 minutes.</span>
              </p>
            </div>
          </div>
        </div>

        <div className="flex justify-center">
          <button 
            onClick={() => window.location.reload()}
            className="px-8 py-3 bg-[#0f172a] text-white font-semibold rounded-xl hover:bg-black transition-all active:scale-95 shadow-lg shadow-gray-200"
          >
            Check Status
          </button>
        </div>
      </div>

      {/* Subtle Footer */}
      <div className="absolute bottom-8 left-0 right-0 px-8 flex justify-center items-center text-xs text-[#94a3b8] font-medium uppercase tracking-widest">
        <div>
          © 2026 PugArch Technologies. All Rights Reserved.
        </div>
      </div>

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        body { font-family: 'Inter', sans-serif; }
      `}</style>
    </div>
  );
}
