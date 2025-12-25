
import React, { useState, useRef, useEffect } from 'react';
import { ImagePair, Difference, DifferenceStatus, PlatformType } from '../types';

interface AuditResultViewProps {
  pair: ImagePair;
  onUpdateDifference: (pairId: string, diffIndex: number, updatedDiff: Partial<Difference> | null) => void;
}

// 放大预览 Modal
const ImageModal: React.FC<{ src: string; onClose: () => void }> = ({ src, onClose }) => (
  <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/90 p-4 animate-in fade-in duration-200" onClick={onClose}>
    <button className="absolute top-6 right-6 text-white/50 hover:text-white transition-colors">
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
    </button>
    <img src={src} className="max-w-full max-h-full object-contain rounded-lg shadow-2xl" onClick={(e) => e.stopPropagation()} />
  </div>
);

const DropdownMenu: React.FC<{ isOpen: boolean; onClose: () => void; children: React.ReactNode; className?: string }> = ({ isOpen, onClose, children, className = "" }) => {
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) onClose();
    };
    if (isOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);
  if (!isOpen) return null;
  return (
    <div ref={menuRef} className={`absolute z-[100] mt-2 py-2 bg-white border border-slate-200 rounded-2xl shadow-xl min-w-[160px] animate-in fade-in zoom-in-95 duration-200 ${className}`}>
      {children}
    </div>
  );
};

// 走查进度标签组件
const StatusBadge: React.FC<{ status: DifferenceStatus; onChange: (s: DifferenceStatus) => void }> = ({ status, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const configs = {
    pending: { label: '待调整', style: 'bg-slate-100 text-slate-600 border-slate-200', dot: 'bg-slate-400' },
    fixed: { label: '已修改待验收', style: 'bg-blue-50 text-blue-700 border-blue-200', dot: 'bg-blue-500' },
    verified: { label: '完成验收', style: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' }
  };
  const config = configs[status];
  const statuses: DifferenceStatus[] = ['pending', 'fixed', 'verified'];

  return (
    <div className="relative">
      <button onClick={() => setIsOpen(!isOpen)} className={`px-2.5 py-1 rounded-full text-[10px] font-black border flex items-center transition-all hover:brightness-95 ${config.style}`}>
        <div className={`w-1.5 h-1.5 rounded-full mr-1.5 ${config.dot}`}></div>
        {config.label}
        <svg className={`ml-1 w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" /></svg>
      </button>
      <DropdownMenu isOpen={isOpen} onClose={() => setIsOpen(false)} className="left-0 origin-top-left">
        {statuses.map(s => (
          <button key={s} onClick={() => { onChange(s); setIsOpen(false); }} className={`w-full text-left px-4 py-2 text-[10px] font-bold flex items-center gap-2 hover:bg-slate-50 ${s === status ? 'text-indigo-600' : 'text-slate-600'}`}>
            <div className={`w-2 h-2 rounded-full ${configs[s].dot}`}></div>{configs[s].label}
          </button>
        ))}
      </DropdownMenu>
    </div>
  );
};

const SeverityBadge: React.FC<{ severity: Difference['severity']; onChange: (s: Difference['severity']) => void }> = ({ severity, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const configs = {
    P0: { label: 'P0 阻塞级', style: 'bg-rose-50 text-rose-700 border-rose-100', dot: 'bg-rose-500' },
    P1: { label: 'P1 高优先级', style: 'bg-amber-50 text-amber-700 border-amber-100', dot: 'bg-amber-500' },
    P2: { label: 'P2 中优先级', style: 'bg-indigo-50 text-indigo-700 border-indigo-100', dot: 'bg-indigo-500' },
    P3: { label: 'P3 低优先级', style: 'bg-slate-50 text-slate-600 border-slate-200', dot: 'bg-slate-400' }
  };
  const config = configs[severity];
  return (
    <div className="relative">
      <button onClick={() => setIsOpen(!isOpen)} className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase border flex items-center transition-all hover:brightness-95 ${config.style}`}>
        <div className={`w-1.5 h-1.5 rounded-full mr-1.5 ${config.dot}`}></div>
        {config.label}
        <svg className={`ml-1 w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" /></svg>
      </button>
      <DropdownMenu isOpen={isOpen} onClose={() => setIsOpen(false)} className="left-0 origin-top-left">
        {(['P0', 'P1', 'P2', 'P3'] as Difference['severity'][]).map(p => (
          <button key={p} onClick={() => { onChange(p); setIsOpen(false); }} className={`w-full text-left px-4 py-2 text-[10px] font-bold flex items-center gap-2 hover:bg-slate-50 ${p === severity ? 'text-indigo-600' : 'text-slate-600'}`}>
            <div className={`w-2 h-2 rounded-full ${configs[p].dot}`}></div>{configs[p].label}
          </button>
        ))}
      </DropdownMenu>
    </div>
  );
};

const PlatformBadge: React.FC<{ platform: PlatformType; onChange: (p: PlatformType) => void }> = ({ platform, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const configs = { dual: { label: '双端通用', icon: '📱' }, ios: { label: 'iOS 独有', icon: '🍎' }, android: { label: 'Android 独有', icon: '🤖' } };
  return (
    <div className="relative">
      <button onClick={() => setIsOpen(!isOpen)} className="px-2.5 py-1 rounded-lg text-[10px] font-black border border-slate-200 bg-slate-50 text-slate-600 flex items-center gap-1.5 transition-all hover:bg-white">
        <span>{configs[platform].icon}</span>{configs[platform].label}
        <svg className={`ml-0.5 w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" /></svg>
      </button>
      <DropdownMenu isOpen={isOpen} onClose={() => setIsOpen(false)} className="left-0 origin-top-left">
        {(['dual', 'ios', 'android'] as PlatformType[]).map(p => (
          <button key={p} onClick={() => { onChange(p); setIsOpen(false); }} className={`w-full text-left px-4 py-2 text-[10px] font-bold flex items-center gap-2 hover:bg-slate-50 ${p === platform ? 'text-indigo-600' : 'text-slate-600'}`}>
            <span>{configs[p].icon}</span>{configs[p].label}
          </button>
        ))}
      </DropdownMenu>
    </div>
  );
};

const AuditResultView: React.FC<AuditResultViewProps> = ({ pair, onUpdateDifference }) => {
  const [zoomSrc, setZoomSrc] = useState<string | null>(null);
  const [highlightIdx, setHighlightIdx] = useState<number | null>(null);
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const result = pair.result;
  if (!result) return null;

  const handleAddNew = () => {
    const newDiff: Difference = {
      category: 'other',
      description: '新增走查项...',
      severity: 'P2',
      platform: 'dual',
      status: 'pending',
      coordinates: { x: 50, y: 50 },
      suggestion: '请补充修复建议'
    };
    onUpdateDifference(pair.id, result.differences.length, newDiff);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (draggingIdx === null || !containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    
    const constrainedX = Math.max(0, Math.min(100, x));
    const constrainedY = Math.max(0, Math.min(100, y));
    
    onUpdateDifference(pair.id, draggingIdx, { 
      coordinates: { x: constrainedX, y: constrainedY } 
    });
  };

  const handleMouseUp = () => {
    setDraggingIdx(null);
  };

  return (
    <div className="flex flex-col lg:flex-row gap-8 items-start mb-16 p-8 bg-white/40 rounded-[3rem] border border-white shadow-xl">
      {/* 左侧：图片对比区域 */}
      <div className="w-full lg:w-1/2 lg:sticky lg:top-24 space-y-4">
        <div className="flex items-center justify-between px-2 mb-2">
          <div className="flex items-center gap-4">
            <div className="flex flex-col">
              <span className="text-3xl font-black text-slate-900 leading-none">{result.matchScore}%</span>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">匹配度</span>
            </div>
            <div className="w-px h-8 bg-slate-200 mx-2" />
            <div className="flex flex-col">
              <span className="text-xs font-black text-slate-700 truncate max-w-[200px]">{pair.design.name}</span>
              <span className="text-[10px] text-slate-400 font-medium italic">Gemini 视觉深度分析</span>
            </div>
          </div>
        </div>

        {/* 移除固定高度，确保内容贴合 */}
        <div className="grid grid-cols-2 gap-2 bg-slate-900/5 rounded-[2.5rem] border border-slate-200/50 overflow-hidden shadow-inner">
          <div className="relative group/img bg-white cursor-zoom-in" onClick={() => setZoomSrc(pair.design.previewUrl)}>
            <div className="absolute top-2 left-4 z-20 opacity-0 group-hover/img:opacity-100 transition-opacity">
              <span className="text-[9px] font-black text-white bg-black/40 backdrop-blur-md px-2 py-0.5 rounded uppercase tracking-widest">参考设计稿</span>
            </div>
            <img src={pair.design.previewUrl} className="w-full h-auto block" alt="Reference" />
          </div>
          <div 
            ref={containerRef}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            className="relative group/img bg-white select-none cursor-zoom-in"
            onClick={(e) => {
              if ((e.target as HTMLElement).classList.contains('pin-marker')) return;
              setZoomSrc(pair.implementation.previewUrl);
            }}
          >
            <div className="absolute top-2 left-4 z-20 opacity-0 group-hover/img:opacity-100 transition-opacity">
              <span className="text-[9px] font-black text-white bg-black/40 backdrop-blur-md px-2 py-0.5 rounded uppercase tracking-widest">开发实现图</span>
            </div>
            <img src={pair.implementation.previewUrl} className="w-full h-auto block pointer-events-none" alt="Actual" />
            
            {/* 序号标注 Pin */}
            {result.differences.map((diff, idx) => (
              diff.coordinates && (
                <div
                  key={idx}
                  className={`pin-marker absolute w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-black text-white shadow-xl border-2 border-white transform -translate-x-1/2 -translate-y-1/2 transition-all cursor-move active:scale-90 ${
                    highlightIdx === idx || draggingIdx === idx ? 'scale-125 z-50 bg-indigo-600 ring-4 ring-indigo-200' : 'z-10 bg-slate-900 opacity-90'
                  }`}
                  style={{ left: `${diff.coordinates.x}%`, top: `${diff.coordinates.y}%` }}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    setDraggingIdx(idx);
                    setHighlightIdx(idx);
                  }}
                  onMouseEnter={() => setHighlightIdx(idx)}
                  onMouseLeave={() => setHighlightIdx(null)}
                >
                  {idx + 1}
                </div>
              )
            ))}
          </div>
        </div>
        <p className="text-xs text-slate-500 font-medium italic text-center px-4 leading-relaxed">
          "{result.summary}"
        </p>
      </div>

      {/* 右侧：滚动问题列表 */}
      <div className="w-full lg:w-1/2 space-y-6">
        <div className="flex items-center justify-between px-2">
          <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
            <div className="w-1.5 h-4 bg-indigo-600 rounded-full"></div>
            走查发现 ({result.differences.length})
          </h4>
        </div>
        
        <div className="space-y-4">
          {result.differences.map((diff, idx) => (
            <div 
              id={`diff-card-${idx}`}
              key={idx} 
              className={`p-6 rounded-[2.2rem] border transition-all relative group ${
                highlightIdx === idx ? 'bg-indigo-50/50 border-indigo-200 shadow-xl -translate-y-1' : 'bg-white border-slate-200 shadow-sm'
              }`}
              onMouseEnter={() => setHighlightIdx(idx)}
              onMouseLeave={() => setHighlightIdx(null)}
            >
              <div className="flex flex-wrap items-center gap-3 mb-5">
                <div className="w-7 h-7 rounded-lg bg-slate-900 text-white flex items-center justify-center text-[10px] font-black shadow-md">
                  {idx + 1}
                </div>
                {/* 走查进度标签 */}
                <StatusBadge status={diff.status} onChange={(s) => onUpdateDifference(pair.id, idx, { status: s })} />
                <PlatformBadge platform={diff.platform} onChange={(p) => onUpdateDifference(pair.id, idx, { platform: p })} />
                <SeverityBadge severity={diff.severity} onChange={(s) => onUpdateDifference(pair.id, idx, { severity: s })} />
                
                <button 
                  onClick={() => onUpdateDifference(pair.id, idx, null)}
                  className="ml-auto p-2.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all"
                  title="删除"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
              </div>

              <div className="space-y-5">
                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 block px-1">走查描述</label>
                  <textarea 
                    className="w-full bg-slate-50/60 border border-slate-100 focus:border-indigo-200 focus:bg-white focus:ring-4 focus:ring-indigo-100/20 rounded-2xl p-4 text-sm font-bold text-slate-800 transition-all resize-none leading-relaxed"
                    value={diff.description}
                    rows={2}
                    onChange={(e) => onUpdateDifference(pair.id, idx, { description: e.target.value })}
                  />
                </div>
                
                <div className="bg-white rounded-2xl p-1 border border-indigo-100/50 shadow-sm">
                  <label className="text-[9px] font-black text-indigo-400 uppercase tracking-[0.2em] mb-2 mt-2 px-4 block">修复建议</label>
                  <textarea 
                    className="w-full bg-indigo-50/20 border-transparent focus:border-indigo-100 focus:bg-white focus:ring-0 rounded-xl p-4 text-[11px] text-indigo-800 font-mono leading-relaxed transition-all resize-none"
                    value={diff.suggestion || ""}
                    rows={2}
                    placeholder="请输入具体的样式修复建议或代码..."
                    onChange={(e) => onUpdateDifference(pair.id, idx, { suggestion: e.target.value })}
                  />
                </div>
              </div>
            </div>
          ))}

          {/* 新增按钮：放到列表底部 */}
          <button 
            onClick={handleAddNew}
            className="w-full py-6 bg-slate-50 border-2 border-dashed border-slate-200 text-slate-400 rounded-[2.2rem] text-sm font-black hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-600 transition-all flex items-center justify-center gap-2 group"
          >
            <div className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-all">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" /></svg>
            </div>
            点击新增走查项
          </button>
        </div>
      </div>

      {zoomSrc && <ImageModal src={zoomSrc} onClose={() => setZoomSrc(null)} />}
    </div>
  );
};

export default AuditResultView;
