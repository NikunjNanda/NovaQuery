import React, { useState, useRef } from 'react';
import { Upload, FileText, Database, X, AlertCircle, RefreshCw, Plus, CheckCircle2 } from 'lucide-react';
import Modal from '../common/Modal';

function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

export default function MultiUploadModal({
  isOpen,
  onClose,
  onUpload,
  isUploading,
  uploadStep = 'idle',
  uploadError = null,
}) {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef(null);

  const handleFilesAdded = (fileList) => {
    if (!fileList || fileList.length === 0) return;
    const newFiles = Array.from(fileList);
    // Combine without exact name & size duplicates
    setSelectedFiles((prev) => {
      const existingKeys = new Set(prev.map((f) => `${f.name}-${f.size}`));
      const filtered = newFiles.filter((f) => !existingKeys.has(`${f.name}-${f.size}`));
      const combined = [...prev, ...filtered];
      return combined.slice(0, 6); // Max 6 files
    });
  };

  const handleRemoveFile = (index) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleClear = () => {
    setSelectedFiles([]);
  };

  const handleSubmit = () => {
    if (selectedFiles.length === 0 || isUploading) return;
    onUpload(selectedFiles);
  };

  const handleClose = () => {
    if (isUploading) return;
    setSelectedFiles([]);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Upload Datasets"
      maxWidth="max-w-xl"
    >
      <div className="flex flex-col gap-5">
        <p className="text-xs text-slate-400 leading-relaxed">
          Upload 1 dataset for standard exploration, or <strong className="text-violet-300 font-semibold">2 to 6 related files</strong> to create a unified multi-table workspace with auto-detected JOIN relationships.
        </p>

        {uploadError && (
          <div className="p-3.5 rounded-xl bg-rose-950/30 border border-rose-800/40 text-rose-300 text-xs font-mono flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div className="flex-1 leading-relaxed">{uploadError}</div>
          </div>
        )}

        {/* Drag and Drop Area */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragOver(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            setIsDragOver(false);
          }}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragOver(false);
            if (e.dataTransfer.files) {
              handleFilesAdded(e.dataTransfer.files);
            }
          }}
          onClick={() => {
            if (!isUploading && fileInputRef.current) {
              fileInputRef.current.click();
            }
          }}
          className={`border-2 border-dashed rounded-2xl p-6 sm:p-8 flex flex-col items-center justify-center gap-2.5 transition text-center cursor-pointer ${
            isDragOver
              ? 'border-violet-500 bg-violet-950/20 shadow-lg shadow-violet-950/50'
              : 'border-[#1e2a44] hover:border-violet-500/50 bg-[#070b14]/60'
          } ${isUploading ? 'opacity-60 cursor-wait' : ''}`}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".db,.sqlite,.sqlite3,.sql,.csv,.xlsx,.xls,.json,.parquet"
            disabled={isUploading}
            className="hidden"
            onChange={(e) => {
              if (e.target.files) {
                handleFilesAdded(e.target.files);
                e.target.value = '';
              }
            }}
          />

          {isUploading ? (
            <div className="flex flex-col items-center gap-2">
              <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin" />
              <span className="text-xs font-semibold text-slate-200">
                {uploadStep === 'detecting'
                  ? 'Auto-detecting relationships between tables...'
                  : 'Uploading and processing datasets...'}
              </span>
              <span className="text-[11px] text-slate-400 font-mono">
                {uploadStep === 'detecting' ? 'Analyzing candidate foreign keys' : 'Building SQLite workspace'}
              </span>
            </div>
          ) : (
            <>
              <div className="w-12 h-12 rounded-2xl bg-violet-950/40 border border-violet-800/40 flex items-center justify-center text-violet-400">
                <Upload className="w-6 h-6" />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs sm:text-sm font-semibold text-slate-200">
                  Click to browse or drag & drop files here
                </span>
                <span className="text-[11px] text-slate-400">
                  Select 2–6 related files (e.g. customers.csv, orders.csv)
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-mono pt-1">
                <span>CSV</span>
                <span>•</span>
                <span>XLSX</span>
                <span>•</span>
                <span>JSON</span>
                <span>•</span>
                <span>PARQUET</span>
                <span>•</span>
                <span>SQLITE</span>
                <span>•</span>
                <span>Max 50MB/file</span>
              </div>
            </>
          )}
        </div>

        {/* Queued Files List */}
        {selectedFiles.length > 0 && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs text-slate-400 px-1">
              <span className="font-semibold text-slate-300">
                Selected Datasets ({selectedFiles.length} of 6)
              </span>
              {!isUploading && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="text-[11px] text-slate-400 hover:text-rose-400 transition"
                >
                  Clear all
                </button>
              )}
            </div>

            <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto pr-1">
              {selectedFiles.map((file, idx) => (
                <div
                  key={`${file.name}-${idx}`}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-[#090e1b] border border-[#1a253d] text-xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-6 h-6 rounded-lg bg-violet-950/60 border border-violet-800/40 flex items-center justify-center text-violet-400 shrink-0">
                      <FileText className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-slate-200 font-mono truncate max-w-[200px] sm:max-w-xs">
                      {file.name}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono shrink-0">
                      ({formatFileSize(file.size)})
                    </span>
                  </div>

                  {!isUploading && (
                    <button
                      type="button"
                      onClick={() => handleRemoveFile(idx)}
                      className="p-1 rounded-md text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 transition shrink-0"
                      title="Remove file"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {selectedFiles.length === 1 && (
              <p className="text-[11px] text-cyan-400/90 font-mono px-1">
                Single dataset selected: will load as standalone exploration table.
              </p>
            )}

            {selectedFiles.length >= 2 && (
              <p className="text-[11px] text-violet-400/90 font-mono px-1">
                Multi-dataset selected: will create shared workspace and detect JOIN relationships.
              </p>
            )}
          </div>
        )}

        {/* Modal Footer Controls */}
        <div className="flex items-center justify-between pt-2 border-t border-[#1a243a]">
          <button
            type="button"
            onClick={handleClose}
            disabled={isUploading}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 transition disabled:opacity-50"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={selectedFiles.length === 0 || isUploading}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-semibold text-xs transition shadow-lg shadow-violet-950/60 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
          >
            {isUploading ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>
                  {uploadStep === 'detecting' ? 'Analyzing Relationships...' : 'Uploading...'}
                </span>
              </>
            ) : (
              <>
                <Upload className="w-3.5 h-3.5" />
                <span>
                  {selectedFiles.length > 1
                    ? `Upload ${selectedFiles.length} Datasets`
                    : 'Upload Dataset'}
                </span>
              </>
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
}

