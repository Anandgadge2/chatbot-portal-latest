'use client';

import { useEffect, useState, useRef } from 'react';
import { Terminal, Copy, Trash2, Maximize2, Play, Circle, Search, ChevronRight } from 'lucide-react';

interface LogEntry {
  id: string;
  timestamp: string;
  type: 'info' | 'error' | 'success' | 'warn';
  message: string;
  source: string;
}

export default function TerminalLogs() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filter, setFilter] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  // Mock real-time logs for demo
  useEffect(() => {
    const initialLogs: LogEntry[] = [
      { id: '1', timestamp: new Date().toISOString(), type: 'info', message: 'System initialization started...', source: 'KERNEL' },
      { id: '2', timestamp: new Date().toISOString(), type: 'success', message: 'Database connection established.', source: 'POSTGRES' },
      { id: '3', timestamp: new Date().toISOString(), type: 'info', message: 'Starting Next.js compilation...', source: 'BUILD' },
    ];
    setLogs(initialLogs);

    const interval = setInterval(() => {
      const types: ('info' | 'error' | 'success' | 'warn')[] = ['info', 'success', 'warn'];
      const messages = [
        'GET /api/v1/user/stats 200 OK',
        'Cache hit for organization registry',
        'Webhook delivery successful to Meta API',
        'Processing background jobs...',
        'Compiling assets for production...',
        'Session cleared for user USER000302'
      ];
      const sources = ['API', 'CACHE', 'WEBHOOK', 'WORKER', 'BUILD', 'AUTH'];
      
      const newLog: LogEntry = {
        id: Math.random().toString(36).substr(2, 9),
        timestamp: new Date().toISOString(),
        type: types[Math.floor(Math.random() * types.length)],
        message: messages[Math.floor(Math.random() * messages.length)],
        source: sources[Math.floor(Math.random() * sources.length)]
      };
      
      setLogs(prev => [...prev.slice(-100), newLog]);
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  const filteredLogs = logs.filter(log => 
    log.message.toLowerCase().includes(filter.toLowerCase()) || 
    log.source.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="bg-[#0f172a] rounded-xl border border-slate-800 shadow-2xl overflow-hidden flex flex-col h-[600px] transition-all">
      {/* Terminal Title Bar */}
      <div className="px-5 py-3 bg-[#1e293b] border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex gap-2">
            <Circle className="w-3 h-3 fill-rose-500 text-rose-500" />
            <Circle className="w-3 h-3 fill-amber-500 text-amber-500" />
            <Circle className="w-3 h-3 fill-emerald-500 text-emerald-500" />
          </div>
          <div className="h-4 w-px bg-slate-700"></div>
          <div className="flex items-center gap-2 text-slate-400">
            <Terminal className="w-4 h-4" />
            <span className="text-[11px] font-black uppercase tracking-widest font-mono">System Console — Platform Runtime</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-500" />
            <input 
              type="text" 
              placeholder="Filter logs..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="bg-slate-900/50 border border-slate-700 h-7 rounded-lg pl-8 pr-3 text-[10px] text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500 w-40 transition-all font-mono"
            />
          </div>
          <button className="text-slate-500 hover:text-white transition-colors">
            <Copy className="w-3.5 h-3.5" />
          </button>
          <button className="text-slate-500 hover:text-rose-500 transition-colors" onClick={() => setLogs([])}>
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Terminal Content */}
      <div 
        ref={scrollRef}
        className="flex-1 p-5 overflow-y-auto font-mono text-[11px] space-y-1 custom-scrollbar"
      >
        {filteredLogs.map((log) => (
          <div key={log.id} className="flex gap-4 group transition-colors hover:bg-slate-800/10 py-0.5">
            <div className="text-slate-600 select-none whitespace-nowrap hidden sm:block">
              {new Date(log.timestamp).toLocaleTimeString([], { hour12: false })}
            </div>
            <div className="flex items-center gap-2 min-w-[80px]">
              <span className={`text-[9px] font-black underline decoration-2 underline-offset-2 uppercase tracking-tighter ${
                log.type === 'info' ? 'text-indigo-400' :
                log.type === 'success' ? 'text-emerald-400' :
                log.type === 'error' ? 'text-rose-400' : 'text-amber-400'
              }`}>
                {log.source || 'SYS'}
              </span>
              <ChevronRight className="w-2.5 h-2.5 text-slate-700" />
            </div>
            <div className={`flex-1 break-all ${
              log.type === 'error' ? 'text-rose-400 font-bold' : 
              log.type === 'warn' ? 'text-amber-300' : 
              log.type === 'success' ? 'text-emerald-300' : 
              'text-slate-300'
            }`}>
              {log.message}
            </div>
          </div>
        ))}
        {filteredLogs.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-slate-600 space-y-3 opacity-50">
             <Play className="w-8 h-8 animate-pulse" />
             <p className="tracking-widest uppercase text-[10px] font-black">Awaiting sequence...</p>
          </div>
        )}
      </div>

      {/* Terminal Footer */}
      <div className="px-5 py-2 bg-[#1e293b] border-t border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-4 text-[9px] font-bold uppercase tracking-widest text-slate-500 font-mono">
          <span className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
            Main Cluster: Online
          </span>
          <span className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]"></div>
            API Node: Balanced
          </span>
        </div>
        <div className="text-[9px] text-slate-600 font-mono">
           UTF-8 • PLATFORM_STABLE_V4.2
        </div>
      </div>
    </div>
  );
}
