
import React, { useCallback } from 'react';
import { UploadedImage } from '../types';

interface FileUploaderProps {
  onFilesAdded: (files: File[]) => void;
  images: UploadedImage[];
  onRemove: (id: string) => void;
  title: string;
  description: string;
}

const FileUploader: React.FC<FileUploaderProps> = ({ onFilesAdded, images, onRemove, title, description }) => {
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      onFilesAdded(Array.from(e.target.files));
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files) {
      onFilesAdded(Array.from(e.dataTransfer.files));
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-slate-900">{title}</h2>
        <p className="text-slate-500 mt-2">{description}</p>
      </div>

      <div 
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        className="relative group border-2 border-dashed border-slate-300 rounded-2xl p-12 transition-all hover:border-indigo-400 hover:bg-indigo-50/30 flex flex-col items-center justify-center cursor-pointer"
        onClick={() => document.getElementById(`file-input-${title}`)?.click()}
      >
        <input 
          id={`file-input-${title}`}
          type="file" 
          multiple 
          accept="image/*" 
          className="hidden" 
          onChange={handleFileChange}
        />
        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
          <svg className="w-8 h-8 text-slate-400 group-hover:text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </div>
        <p className="text-sm font-medium text-slate-700">点击上传或拖拽图片到此处</p>
        <p className="text-xs text-slate-400 mt-1">支持 PNG, JPG 或 WebP (单个文件最大 10MB)</p>
      </div>

      {images.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {images.map((img) => (
            <div key={img.id} className="group relative aspect-square rounded-xl overflow-hidden border border-slate-200 bg-white shadow-sm">
              <img src={img.previewUrl} alt={img.name} className="w-full h-full object-cover" />
              <button 
                onClick={(e) => { e.stopPropagation(); onRemove(img.id); }}
                className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2">
                <p className="text-[10px] text-white truncate font-medium">{img.name}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default FileUploader;
