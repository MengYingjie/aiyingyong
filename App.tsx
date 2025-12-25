
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { UploadedImage, AppStep, ImagePair, Difference } from './types';
import Header from './components/Header';
import FileUploader from './components/FileUploader';
import AuditResultView from './components/AuditResultView';
import { analyzeUIComparison, fileToBase64 } from './services/geminiService';
import ExcelJS from 'exceljs';

// --- IndexedDB 简单封装，用于存储大体积图片数据 ---
const DB_NAME = 'TencentMapAuditDB';
const STORE_NAME = 'images';

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

const saveBlob = async (id: string, blob: Blob) => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).put(blob, id);
    transaction.oncomplete = () => resolve(true);
    transaction.onerror = () => reject(transaction.error);
  });
};

const getBlob = async (id: string): Promise<Blob | null> => {
  const db = await openDB();
  return new Promise((resolve) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const request = transaction.objectStore(STORE_NAME).get(id);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => resolve(null);
  });
};

const deleteBlob = async (id: string) => {
  const db = await openDB();
  const transaction = db.transaction(STORE_NAME, 'readwrite');
  transaction.objectStore(STORE_NAME).delete(id);
};

const clearDB = async () => {
  const db = await openDB();
  const transaction = db.transaction(STORE_NAME, 'readwrite');
  transaction.objectStore(STORE_NAME).clear();
};
// ----------------------------------------------

const App: React.FC = () => {
  const [step, setStep] = useState<AppStep>(AppStep.UPLOAD_DESIGN);
  const [designImages, setDesignImages] = useState<UploadedImage[]>([]);
  const [implementationImages, setImplementationImages] = useState<UploadedImage[]>([]);
  const [pairs, setPairs] = useState<ImagePair[]>([]);
  const [currentProcessingIdx, setCurrentProcessingIdx] = useState(-1);
  const [shareSuccess, setShareSuccess] = useState(false);
  
  const [isAddingInResults, setIsAddingInResults] = useState(false);
  const [addStepInResults, setAddStepInResults] = useState<1 | 2>(1);

  const importInputRef = useRef<HTMLInputElement>(null);

  // 初始化逻辑：处理 URL 分享参数或本地缓存
  useEffect(() => {
    const initApp = async () => {
      // 1. 优先检查 URL 分享参数
      const urlParams = new URLSearchParams(window.location.search);
      const sharedData = urlParams.get('share');
      
      if (sharedData) {
        try {
          const decodedData = JSON.parse(atob(decodeURIComponent(sharedData)));
          const sharedPairs: ImagePair[] = decodedData.map((item: any) => ({
            id: item.id,
            design: { id: `share_${item.id}_d`, name: item.name, previewUrl: '', file: null as any },
            implementation: { id: `share_${item.id}_i`, name: `${item.name}_impl`, previewUrl: '', file: null as any },
            status: item.status,
            result: item.result
          }));
          setPairs(sharedPairs);
          setStep(AppStep.RESULTS);
          // 清除 URL 参数，避免刷新重复加载
          window.history.replaceState({}, document.title, window.location.pathname);
          return;
        } catch (e) {
          console.error('Failed to parse share link', e);
        }
      }

      // 2. 恢复本地缓存
      const savedPairs = localStorage.getItem('audit_pairs');
      const savedStep = localStorage.getItem('audit_step') as AppStep;

      if (savedPairs) {
        try {
          const parsedPairs: ImagePair[] = JSON.parse(savedPairs);
          const restoredPairs = await Promise.all(parsedPairs.map(async (p) => {
            const designBlob = await getBlob(p.design.id);
            const implBlob = await getBlob(p.implementation.id);
            
            return {
              ...p,
              design: {
                ...p.design,
                previewUrl: designBlob ? URL.createObjectURL(designBlob) : p.design.previewUrl,
                file: designBlob ? new File([designBlob], p.design.name) : (null as any)
              },
              implementation: {
                ...p.implementation,
                previewUrl: implBlob ? URL.createObjectURL(implBlob) : p.implementation.previewUrl,
                file: implBlob ? new File([implBlob], p.implementation.name) : (null as any)
              }
            };
          }));
          setPairs(restoredPairs);
          if (savedStep) setStep(savedStep);
        } catch (e) {
          console.error('Failed to load saved pairs', e);
        }
      }
    };
    initApp();
  }, []);

  // 持久化 pairs 状态
  useEffect(() => {
    if (pairs.length > 0) {
      const storagePairs = pairs.map(p => ({
        ...p,
        design: { id: p.design.id, name: p.design.name, previewUrl: '' },
        implementation: { id: p.implementation.id, name: p.implementation.name, previewUrl: '' }
      }));
      localStorage.setItem('audit_pairs', JSON.stringify(storagePairs));
      localStorage.setItem('audit_step', step);
    } else {
      localStorage.removeItem('audit_pairs');
      localStorage.removeItem('audit_step');
    }
  }, [pairs, step]);

  const resetAll = async () => {
    if (!window.confirm("确定要清空所有走查记录吗？此操作不可撤销。")) return;
    setDesignImages([]);
    setImplementationImages([]);
    setPairs([]);
    setCurrentProcessingIdx(-1);
    setStep(AppStep.UPLOAD_DESIGN);
    setIsAddingInResults(false);
    localStorage.clear();
    await clearDB();
  };

  const autoPairImages = async () => {
    const newPairs: ImagePair[] = [];
    const minLength = Math.min(designImages.length, implementationImages.length);

    for (let i = 0; i < minLength; i++) {
      newPairs.push({
        id: Math.random().toString(36).substr(2, 9),
        design: designImages[i],
        implementation: implementationImages[i],
        status: 'pending'
      });
    }

    setPairs(prev => [...prev, ...newPairs]);
    setDesignImages([]);
    setImplementationImages([]);
    
    if (step !== AppStep.RESULTS) {
      setStep(AppStep.PAIRING);
    } else {
      setIsAddingInResults(false);
    }
  };

  const startAnalysis = useCallback(async () => {
    if (step !== AppStep.RESULTS) {
      setStep(AppStep.RESULTS);
    }
    
    for (let i = 0; i < pairs.length; i++) {
      if (pairs[i].status === 'completed' || pairs[i].status === 'processing') continue;
      
      setCurrentProcessingIdx(i);
      setPairs(prev => prev.map((p, idx) => idx === i ? { ...p, status: 'processing' } : p));
      
      try {
        const d64 = await fileToBase64(pairs[i].design.file);
        const i64 = await fileToBase64(pairs[i].implementation.file);
        const result = await analyzeUIComparison(d64, i64);
        
        setPairs(prev => prev.map((p, idx) => idx === i ? { ...p, status: 'completed', result } : p));
      } catch (err) {
        console.error(err);
        setPairs(prev => prev.map((p, idx) => idx === i ? { ...p, status: 'failed' } : p));
      }
    }
    setCurrentProcessingIdx(-1);
  }, [pairs, step]);

  useEffect(() => {
    const hasPending = pairs.some(p => p.status === 'pending');
    if (hasPending && step === AppStep.RESULTS && currentProcessingIdx === -1) {
      startAnalysis();
    }
  }, [pairs, step, currentProcessingIdx, startAnalysis]);

  const updateDifference = (pairId: string, diffIndex: number, updatedDiff: Partial<Difference> | null) => {
    setPairs(prev => prev.map(p => {
      if (p.id !== pairId || !p.result) return p;
      const newDiffs = [...p.result.differences];
      if (updatedDiff === null) {
        newDiffs.splice(diffIndex, 1);
      } else {
        newDiffs[diffIndex] = { ...newDiffs[diffIndex], ...updatedDiff };
      }
      return { ...p, result: { ...p.result, differences: newDiffs } };
    }));
  };

  const handleExportExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('UI走查详情');

    worksheet.columns = [
      { header: '序号', key: 'idx', width: 8 },
      { header: '设计稿预览', key: 'designImg', width: 30 },
      { header: '实装图预览', key: 'implImg', width: 30 },
      { header: '匹配度', key: 'score', width: 10 },
      { header: '问题分类', key: 'category', width: 12 },
      { header: '问题描述', key: 'description', width: 40 },
      { header: '严重程度', key: 'severity', width: 10 },
      { header: '修复建议', key: 'suggestion', width: 40 }
    ];

    let currentRow = 2;

    for (const [pIdx, p] of pairs.entries()) {
      if (!p.result) continue;

      // 为每组图片添加一张缩略图到 Excel
      let designImageId: number | undefined;
      let implImageId: number | undefined;

      try {
        if (p.design.file) {
          const dBase64 = await fileToBase64(p.design.file);
          designImageId = workbook.addImage({
            base64: dBase64,
            extension: 'png',
          });
        }
        if (p.implementation.file) {
          const iBase64 = await fileToBase64(p.implementation.file);
          implImageId = workbook.addImage({
            base64: iBase64,
            extension: 'png',
          });
        }
      } catch (e) {
        console.error("Image export failed for pair", pIdx, e);
      }

      for (const [dIdx, d] of p.result.differences.entries()) {
        const row = worksheet.addRow({
          idx: `${pIdx + 1}-${dIdx + 1}`,
          score: p.result.matchScore + '%',
          category: d.category,
          description: d.description,
          severity: d.severity,
          suggestion: d.suggestion || '-'
        });
        
        row.height = 100; // 设置行高以容纳图片
        
        // 仅在每组问题的首行插入图片
        if (dIdx === 0) {
          if (designImageId !== undefined) {
            worksheet.addImage(designImageId, {
              tl: { col: 1, row: row.number - 1 },
              ext: { width: 180, height: 120 }
            });
          }
          if (implImageId !== undefined) {
            worksheet.addImage(implImageId, {
              tl: { col: 2, row: row.number - 1 },
              ext: { width: 180, height: 120 }
            });
          }
        }
      }
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Tencentmap_Audit_Report_${new Date().toLocaleDateString()}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleGenerateShareLink = () => {
    const shareData = pairs.map(p => ({
      id: p.id,
      name: p.design.name,
      result: p.result,
      status: p.status
    }));

    try {
      const serialized = btoa(JSON.stringify(shareData));
      const shareUrl = `${window.location.origin}${window.location.pathname}?share=${encodeURIComponent(serialized)}`;
      
      navigator.clipboard.writeText(shareUrl).then(() => {
        setShareSuccess(true);
        setTimeout(() => setShareSuccess(false), 3000);
      });
    } catch (e) {
      alert("生成分享链接失败：数据量过大，请尝试减少走查项或使用导出功能。");
    }
  };

  const addFiles = async (files: File[], setFn: React.Dispatch<React.SetStateAction<UploadedImage[]>>) => {
    const newImages = await Promise.all(files.map(async file => {
      const id = Math.random().toString(36).substr(2, 9);
      await saveBlob(id, file);
      return {
        id,
        file,
        previewUrl: URL.createObjectURL(file),
        name: file.name
      };
    }));
    setFn(prev => [...prev, ...newImages]);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col font-sans selection:bg-indigo-100 selection:text-indigo-900">
      <Header 
        showExport={step === AppStep.RESULTS} 
        onExport={handleExportExcel}
      />
      
      <main className="flex-1 max-w-7xl mx-auto w-full p-6 py-12">
        {/* Stepper */}
        <div className="flex items-center justify-center mb-16 gap-4">
          {[AppStep.UPLOAD_DESIGN, AppStep.UPLOAD_IMPLEMENTATION, AppStep.PAIRING, AppStep.RESULTS].map((s, idx) => {
            const stepsOrder = [AppStep.UPLOAD_DESIGN, AppStep.UPLOAD_IMPLEMENTATION, AppStep.PAIRING, AppStep.RESULTS];
            const isCompleted = stepsOrder.indexOf(step) > idx;
            const isActive = step === s;
            
            return (
              <React.Fragment key={s}>
                <div 
                  className={`flex flex-col items-center gap-2 group cursor-pointer transition-all ${isActive || isCompleted ? 'opacity-100' : 'opacity-30'}`}
                  onClick={() => isCompleted && setStep(s)}
                >
                  <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-xs font-black transition-all border-2 ${
                    isActive ? 'bg-indigo-600 border-indigo-600 text-white shadow-xl shadow-indigo-100 scale-110' : 
                    isCompleted ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'border-slate-200 text-slate-400'
                  }`}>
                    {isCompleted ? (
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                    ) : (idx + 1)}
                  </div>
                </div>
                {idx < 3 && <div className={`w-12 h-0.5 rounded-full transition-colors duration-500 ${isCompleted ? 'bg-indigo-600' : 'bg-slate-200'}`} />}
              </React.Fragment>
            );
          })}
        </div>

        <div className="bg-white border border-slate-200 rounded-[2.5rem] p-10 shadow-xl shadow-slate-200/40 min-h-[600px]">
          {step === AppStep.UPLOAD_DESIGN && (
            <div className="space-y-10 animate-in slide-in-from-bottom-4 duration-500">
              <FileUploader 
                title="第一步：上传参考设计稿"
                description="请按照走查顺序批量上传设计稿图（支持多选）"
                images={designImages}
                onFilesAdded={(f) => addFiles(f, setDesignImages)}
                onRemove={(id) => { setDesignImages(prev => prev.filter(img => img.id !== id)); deleteBlob(id); }}
              />
              <div className="flex justify-end pt-6">
                <button 
                  disabled={designImages.length === 0}
                  onClick={() => setStep(AppStep.UPLOAD_IMPLEMENTATION)}
                  className="px-10 py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-xl shadow-indigo-100 hover:bg-indigo-700 disabled:opacity-30 transition-all flex items-center gap-2 active:scale-95"
                >
                  下一步：上传实装图
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                </button>
              </div>
            </div>
          )}

          {step === AppStep.UPLOAD_IMPLEMENTATION && (
            <div className="space-y-10 animate-in slide-in-from-bottom-4 duration-500">
              <FileUploader 
                title="第二步：上传开发截图"
                description="请按照对应设计稿的顺序批量上传实装截图"
                images={implementationImages}
                onFilesAdded={(f) => addFiles(f, setImplementationImages)}
                onRemove={(id) => { setImplementationImages(prev => prev.filter(img => img.id !== id)); deleteBlob(id); }}
              />
              <div className="flex justify-between pt-6">
                <button onClick={() => setStep(AppStep.UPLOAD_DESIGN)} className="px-6 py-4 text-slate-400 font-bold hover:text-indigo-600 flex items-center gap-2 transition-colors">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M11 17l-5-5m0 0l5-5m-5 5h12" /></svg>
                  返回上一步
                </button>
                <button 
                  disabled={implementationImages.length === 0}
                  onClick={autoPairImages}
                  className="px-10 py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-xl shadow-indigo-100 hover:bg-indigo-700 disabled:opacity-30 transition-all flex items-center gap-2 active:scale-95"
                >
                  顺序配对并核对
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                </button>
              </div>
            </div>
          )}

          {step === AppStep.PAIRING && (
            <div className="space-y-10 animate-in slide-in-from-bottom-4 duration-500">
              <div className="text-center space-y-2">
                <h2 className="text-3xl font-black text-slate-900 tracking-tight">核对配对结果</h2>
                <p className="text-slate-500 font-medium">系统已根据您的上传顺序完成 1:1 配对，请确认无误后开始走查。</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {pairs.map((pair, idx) => (
                  <div key={pair.id} className="group relative p-5 bg-slate-50 border border-slate-200 rounded-[2rem] flex flex-col gap-4 hover:border-indigo-300 transition-all hover:bg-white hover:shadow-xl hover:shadow-slate-200/50">
                    <div className="absolute top-4 left-4 px-3 py-1 bg-slate-900 text-white text-[10px] font-black rounded-lg flex items-center justify-center shadow-lg z-10">
                      第 {idx + 1} 组
                    </div>
                    <button 
                      onClick={() => {
                        setPairs(prev => prev.filter(p => p.id !== pair.id));
                        deleteBlob(pair.design.id);
                        deleteBlob(pair.implementation.id);
                      }}
                      className="absolute top-4 right-4 w-8 h-8 bg-white border border-slate-200 text-slate-400 rounded-full flex items-center justify-center hover:bg-rose-50 hover:text-rose-500 shadow-sm opacity-0 group-hover:opacity-100 transition-all z-10"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                    <div className="flex items-center gap-3 bg-white p-3 rounded-2xl shadow-sm border border-slate-100 mt-8">
                      <div className="w-1/2 aspect-[3/4] rounded-xl overflow-hidden relative group/item">
                        <img src={pair.design.previewUrl} className="w-full h-full object-cover" />
                      </div>
                      <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0 shadow-inner">
                         <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M8 7h12m0 0l-4-4m4 4l-4 4" /></svg>
                      </div>
                      <div className="w-1/2 aspect-[3/4] rounded-xl overflow-hidden relative group/item">
                        <img src={pair.implementation.previewUrl} className="w-full h-full object-cover" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex justify-between pt-8 border-t border-slate-100">
                <button onClick={() => setStep(AppStep.UPLOAD_IMPLEMENTATION)} className="px-6 py-4 text-slate-400 font-bold hover:text-indigo-600 flex items-center gap-2 transition-colors">
                   <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M11 17l-5-5m0 0l5-5m-5 5h12" /></svg>
                   重新上传
                </button>
                <button 
                  disabled={pairs.length === 0}
                  onClick={startAnalysis}
                  className="px-12 py-5 bg-indigo-600 text-white rounded-2xl font-black shadow-2xl shadow-indigo-200 hover:bg-indigo-700 hover:scale-105 transition-all flex items-center gap-3 active:scale-95"
                >
                  🚀 开始 AI 智能走查
                </button>
              </div>
            </div>
          )}

          {step === AppStep.RESULTS && (
            <div className="space-y-16 animate-in fade-in duration-700">
              <div className="flex flex-col lg:flex-row lg:items-end justify-between border-b border-slate-100 pb-10 gap-6">
                <div className="space-y-2">
                  <h2 className="text-4xl font-black text-slate-900 tracking-tight">批量走查报告</h2>
                  <div className="flex items-center gap-3">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${currentProcessingIdx !== -1 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                      {currentProcessingIdx !== -1 ? '分析进行中' : '全量分析完成'}
                    </span>
                    <p className="text-slate-400 font-bold text-sm">
                      {currentProcessingIdx !== -1 
                        ? `正在处理第 ${currentProcessingIdx + 1}/${pairs.length} 组...` 
                        : `共计完成 ${pairs.length} 组 UI 深度对比`}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-4">
                  <button 
                    onClick={handleGenerateShareLink}
                    className="px-6 py-3 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-xl text-sm font-black shadow-sm hover:bg-indigo-100 transition-all flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
                    {shareSuccess ? '链接已复制' : '复制分享链接'}
                  </button>
                  <button 
                    onClick={() => setStep(AppStep.PAIRING)} 
                    className="px-6 py-3 bg-white border border-slate-200 text-slate-600 rounded-xl text-sm font-black shadow-sm hover:border-indigo-300 hover:text-indigo-600 transition-all flex items-center gap-2"
                  >
                    修改配对
                  </button>
                  <button 
                    onClick={resetAll} 
                    className="px-6 py-3 bg-slate-900 text-white rounded-xl text-sm font-black shadow-xl shadow-slate-200 hover:bg-black transition-all"
                  >
                    全部重置
                  </button>
                </div>
              </div>

              <div className="space-y-32 pb-24">
                {pairs.map((pair, idx) => (
                  <div key={pair.id} className="relative group">
                    <div className="absolute -top-6 left-8 px-6 py-3 bg-indigo-600 text-white rounded-2xl text-xs font-black shadow-2xl shadow-indigo-100 z-10">
                      项目组 #{idx + 1}
                    </div>
                    {pair.status === 'processing' && (
                      <div className="h-[500px] flex flex-col items-center justify-center gap-8 bg-slate-50/50 rounded-[3rem] border-2 border-dashed border-indigo-200/50 animate-pulse">
                        <div className="relative">
                           <div className="w-20 h-20 border-4 border-indigo-600/20 border-t-indigo-600 rounded-full animate-spin"></div>
                           <div className="absolute inset-0 flex items-center justify-center">
                             <span className="text-[10px] font-black text-indigo-600">AI</span>
                           </div>
                        </div>
                        <div className="text-center">
                          <p className="text-xl font-black text-slate-800">正在分析「{pair.design.name}」</p>
                        </div>
                      </div>
                    )}
                    {(pair.status === 'completed' || (pair.status === 'failed' && pair.result)) && (
                      <AuditResultView 
                        pair={pair} 
                        onUpdateDifference={updateDifference} 
                      />
                    )}
                    {pair.status === 'failed' && !pair.result && (
                      <div className="h-[400px] flex flex-col items-center justify-center bg-rose-50 rounded-[3rem] border border-rose-100">
                        <p className="text-rose-600 font-black text-xl">分析异常</p>
                        <button onClick={startAnalysis} className="mt-4 px-6 py-2 bg-rose-600 text-white rounded-xl text-sm font-black">重试</button>
                      </div>
                    )}
                  </div>
                ))}

                {currentProcessingIdx === -1 && (
                  <div className="pt-20 border-t border-slate-100 animate-in slide-in-from-bottom-10 duration-700">
                    <div className="max-w-4xl mx-auto">
                      {!isAddingInResults ? (
                        <div className="bg-indigo-50/40 border-2 border-dashed border-indigo-200 rounded-[3rem] p-12 text-center space-y-8 group hover:bg-indigo-50 hover:border-indigo-300 transition-all duration-500">
                          <div className="inline-flex items-center justify-center w-20 h-20 bg-white rounded-[2rem] shadow-xl shadow-indigo-100 group-hover:scale-110 transition-transform duration-500">
                             <svg className="w-10 h-10 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                             </svg>
                          </div>
                          <div className="space-y-3">
                            <h3 className="text-2xl font-black text-slate-900 tracking-tight">新增批量走查</h3>
                            <p className="text-slate-500 font-medium">您可以继续上传新的图片组，新的对比结果将追加到历史列表下方。</p>
                          </div>
                          <div className="flex justify-center">
                            <button 
                              onClick={() => setIsAddingInResults(true)}
                              className="px-12 py-5 bg-indigo-600 text-white rounded-2xl font-black shadow-2xl shadow-indigo-200 hover:bg-indigo-700 hover:-translate-y-1 active:scale-95 transition-all flex items-center gap-3"
                            >
                              开始上传新图
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="bg-white border-2 border-indigo-100 rounded-[3rem] p-10 shadow-2xl space-y-8 animate-in zoom-in-95 duration-300">
                          <div className="flex items-center justify-between mb-4">
                            <h4 className="text-lg font-black text-slate-800">
                              {addStepInResults === 1 ? '1. 上传新设计稿' : '2. 上传对应实现图'}
                            </h4>
                            <button onClick={() => setIsAddingInResults(false)} className="text-slate-400 hover:text-slate-600 font-bold text-xs uppercase tracking-widest">取消</button>
                          </div>
                          
                          {addStepInResults === 1 ? (
                            <FileUploader 
                              title=""
                              description="请上传新的参考设计稿"
                              images={designImages}
                              onFilesAdded={(f) => addFiles(f, setDesignImages)}
                              onRemove={(id) => { setDesignImages(prev => prev.filter(img => img.id !== id)); deleteBlob(id); }}
                            />
                          ) : (
                            <FileUploader 
                              title=""
                              description="请上传对应的开发实现截图"
                              images={implementationImages}
                              onFilesAdded={(f) => addFiles(f, setImplementationImages)}
                              onRemove={(id) => { setImplementationImages(prev => prev.filter(img => img.id !== id)); deleteBlob(id); }}
                            />
                          )}

                          <div className="flex justify-between pt-4">
                            {addStepInResults === 2 ? (
                              <button onClick={() => setAddStepInResults(1)} className="px-6 py-3 text-slate-400 font-bold hover:text-indigo-600 transition-colors">返回上一步</button>
                            ) : <div></div>}
                            
                            <button 
                              onClick={() => {
                                if (addStepInResults === 1) {
                                  if (designImages.length > 0) setAddStepInResults(2);
                                } else {
                                  if (implementationImages.length > 0) autoPairImages();
                                }
                              }}
                              disabled={(addStepInResults === 1 && designImages.length === 0) || (addStepInResults === 2 && implementationImages.length === 0)}
                              className="px-10 py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-xl shadow-indigo-100 hover:bg-indigo-700 disabled:opacity-30 transition-all flex items-center gap-2"
                            >
                              {addStepInResults === 1 ? '下一步' : '提交并开始分析'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default App;
