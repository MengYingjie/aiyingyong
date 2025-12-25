
import React from 'react';

interface HeaderProps {
  onExport?: () => void;
  showExport?: boolean;
}

const Header: React.FC<HeaderProps> = ({ onExport, showExport }) => {
  return (
    <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-black shadow-lg shadow-indigo-200/50">T</div>
          <div className="flex flex-col">
            <span className="text-lg font-black tracking-tight text-slate-900 leading-none">Tencentmap</span>
            <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest mt-1">走查工具pro</span>
          </div>
        </div>
        <nav className="flex items-center gap-6">
          {showExport && (
            <button 
              onClick={onExport}
              className="px-5 py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-black hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              导出 Excel 报告
            </button>
          )}
        </nav>
      </div>
    </header>
  );
};

export default Header;
