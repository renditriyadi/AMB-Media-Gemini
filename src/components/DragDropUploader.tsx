import React, { useRef, useState } from 'react';
import { UploadCloud, FileText, Image as ImageIcon, Video as VideoIcon, X } from 'lucide-react';
import { AttachedMedia } from '../types';

interface DragDropUploaderProps {
  attachedMedia: AttachedMedia[];
  onAttachMedia: (media: AttachedMedia) => void;
  onRemoveMedia: (id: string) => void;
}

export const DragDropUploader: React.FC<DragDropUploaderProps> = ({
  attachedMedia,
  onAttachMedia,
  onRemoveMedia,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];

    const fileSizeMB = file.size / (1024 * 1024);
    if (fileSizeMB > 50) {
      alert(`Ukuran file (${fileSizeMB.toFixed(1)} MB) melebihi batas maksimal 50 MB. Silakan pilih file dengan ukuran di bawah 50 MB.`);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const type = file.type.startsWith('video/')
      ? 'video'
      : file.type.startsWith('image/')
      ? 'image'
      : 'file';

    const objectUrl = URL.createObjectURL(file);

    const newMedia: AttachedMedia = {
      id: `att-${Date.now()}`,
      name: file.name,
      type,
      source: 'device',
      size: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
      url: objectUrl,
      previewUrl: objectUrl,
      fileObject: file,
      isUploading: true,
      uploadProgress: 0,
    };

    onAttachMedia(newMedia);

    // Reset input value so selecting the same file again triggers onChange
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files) {
      handleFiles(e.dataTransfer.files);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold text-gray-900 tracking-tight">
          Attachments <span className="text-gray-400 font-normal">(Optional)</span>
        </label>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />

      {/* Drag & Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
          isDragging
            ? 'border-purple-600 bg-purple-50/80 scale-[0.99]'
            : 'border-purple-200 hover:border-purple-400 bg-purple-50/20 hover:bg-purple-50/50'
        }`}
      >
        <div className="flex flex-col items-center justify-center space-y-2">
          <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center text-purple-600 shadow-2xs">
            <UploadCloud className="w-5 h-5" />
          </div>
          <p className="text-xs font-semibold text-gray-700">
            <span className="text-purple-600 font-bold hover:underline">Drag and drop image or video here</span> or click to browse files
          </p>
          <p className="text-[10px] text-gray-400 font-medium">
            Supported formats: JPG, PNG, WEBP, MP4, MOV • Max size: 50MB
          </p>
        </div>
      </div>

      {/* Uploaded Attachments List */}
      {attachedMedia.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
          {attachedMedia.map((media) => (
            <div
              key={media.id}
              className="flex items-center justify-between p-2.5 bg-white border border-gray-200 rounded-xl shadow-2xs text-xs group"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                {Boolean(media.previewUrl?.trim() || media.url?.trim()) && media.type === 'image' ? (
                  <img
                    src={(media.previewUrl?.trim() || media.url?.trim())!}
                    alt={media.name}
                    referrerPolicy="no-referrer"
                    className="w-9 h-9 rounded-lg object-cover border border-gray-100 shrink-0"
                  />
                ) : media.type === 'video' ? (
                  <div className="w-9 h-9 rounded-lg bg-slate-900 flex items-center justify-center text-white shrink-0">
                    <VideoIcon className="w-4 h-4 text-purple-400" />
                  </div>
                ) : (
                  <div className="w-9 h-9 rounded-lg bg-purple-50 flex items-center justify-center text-purple-600 shrink-0">
                    <ImageIcon className="w-4 h-4" />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="font-bold text-gray-900 truncate">{media.name}</p>
                  <p className="text-[10px] text-gray-400">{media.size || 'Reference Media'}</p>
                </div>
              </div>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveMedia(media.id);
                }}
                className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                title="Remove attachment"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
