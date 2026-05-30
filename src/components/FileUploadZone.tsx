import { useState, useRef, useCallback } from "react";
import { Upload, X, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  isSupportedFile,
  getFileIcon,
  formatFileSize,
  MAX_FILE_SIZE,
  MAX_FILES,
  ACCEPTED_MIME_TYPES,
  SUPPORTED_FORMATS,
} from "@/lib/file-extractors";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

interface FileUploadZoneProps {
  files: File[];
  onFilesChange: (files: File[]) => void;
  maxFiles?: number;
  maxFileSize?: number;
}

export function FileUploadZone({
  files,
  onFilesChange,
  maxFiles = MAX_FILES,
  maxFileSize = MAX_FILE_SIZE,
}: FileUploadZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const validateAndAdd = useCallback(
    (incoming: File[]) => {
      const errors: string[] = [];
      const valid: File[] = [];

      for (const file of incoming) {
        if (!isSupportedFile(file.name)) {
          errors.push(`${file.name} — unsupported file type`);
          continue;
        }
        if (file.size > maxFileSize) {
          errors.push(`${file.name} (${formatFileSize(file.size)}) — max ${formatFileSize(maxFileSize)}`);
          continue;
        }
        valid.push(file);
      }

      const total = files.length + valid.length;
      if (total > maxFiles) {
        const allowed = maxFiles - files.length;
        errors.push(`Too many files. Only adding first ${allowed} of ${valid.length}`);
        valid.splice(allowed);
      }

      // Deduplicate by name+size
      const existing = new Set(files.map((f) => `${f.name}:${f.size}`));
      const unique = valid.filter((f) => !existing.has(`${f.name}:${f.size}`));

      if (errors.length) {
        toast.error(errors.join("\n"), { duration: 5000 });
      }

      if (unique.length > 0) {
        onFilesChange([...files, ...unique]);
      }
    },
    [files, maxFiles, maxFileSize, onFilesChange]
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    const items = e.dataTransfer.items;
    const droppedFiles: File[] = [];

    // Check for folder drops via webkitGetAsEntry
    if (items) {
      const entries: FileSystemEntry[] = [];
      for (let i = 0; i < items.length; i++) {
        const entry = items[i].webkitGetAsEntry?.();
        if (entry) entries.push(entry);
      }

      if (entries.some((e) => e.isDirectory)) {
        const allFiles = await readEntriesRecursive(entries);
        validateAndAdd(allFiles);
        return;
      }
    }

    // Regular file drop
    for (let i = 0; i < e.dataTransfer.files.length; i++) {
      droppedFiles.push(e.dataTransfer.files[i]);
    }
    validateAndAdd(droppedFiles);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      validateAndAdd(Array.from(e.target.files));
    }
    e.target.value = "";
  };

  const removeFile = (index: number) => {
    onFilesChange(files.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`
          relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer
          transition-all duration-200
          ${isDragOver
            ? "border-primary bg-primary/5 scale-[1.01]"
            : "border-border hover:border-primary/50 hover:bg-muted/30"
          }
        `}
      >
        <Upload className={`w-8 h-8 mx-auto mb-3 ${isDragOver ? "text-primary" : "text-muted-foreground"}`} />
        <p className="text-sm font-medium text-foreground">
          Drag & drop files here
        </p>
        <p className="text-xs text-muted-foreground mt-1">or click to browse</p>
        <p className="text-xs text-muted-foreground mt-3">
          Supported: {SUPPORTED_FORMATS.join(", ")}
        </p>
        <p className="text-xs text-muted-foreground">
          Max {formatFileSize(maxFileSize)} per file • Up to {maxFiles} files
        </p>

        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          multiple
          accept={ACCEPTED_MIME_TYPES}
          onChange={handleFileInput}
        />
      </div>

      {/* Folder upload button */}
      <div className="flex justify-center">
        <Button
          variant="ghost"
          size="sm"
          className="gap-2 text-xs text-muted-foreground"
          onClick={(e) => {
            e.stopPropagation();
            folderInputRef.current?.click();
          }}
        >
          <FolderOpen className="w-3.5 h-3.5" />
          Upload a folder
        </Button>
        <input
          ref={folderInputRef}
          type="file"
          className="hidden"
          // @ts-ignore - webkitdirectory is non-standard
          webkitdirectory=""
          directory=""
          onChange={handleFileInput}
        />
      </div>

      {/* File list */}
      <AnimatePresence>
        {files.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-1.5"
          >
            <p className="text-xs font-medium text-muted-foreground">
              Selected files ({files.length}):
            </p>
            <div className="max-h-48 overflow-y-auto space-y-1 rounded-lg border border-border p-2">
              {files.map((file, idx) => (
                <motion.div
                  key={`${file.name}-${file.size}`}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="flex items-center justify-between gap-2 py-1.5 px-2 rounded-md hover:bg-muted/50"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-base flex-shrink-0">{getFileIcon(file.name)}</span>
                    <span className="text-xs text-foreground truncate">{file.name}</span>
                    <span className="text-xs text-muted-foreground flex-shrink-0">
                      {formatFileSize(file.size)}
                    </span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFile(idx);
                    }}
                    className="text-muted-foreground hover:text-destructive transition-colors flex-shrink-0"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Recursively read file entries from a dropped folder */
async function readEntriesRecursive(entries: FileSystemEntry[]): Promise<File[]> {
  const files: File[] = [];

  async function processEntry(entry: FileSystemEntry): Promise<void> {
    if (entry.isFile) {
      const file = await new Promise<File>((resolve) => {
        (entry as FileSystemFileEntry).file(resolve);
      });
      files.push(file);
    } else if (entry.isDirectory) {
      const dirReader = (entry as FileSystemDirectoryEntry).createReader();
      const subEntries = await new Promise<FileSystemEntry[]>((resolve) => {
        dirReader.readEntries(resolve);
      });
      for (const sub of subEntries) {
        await processEntry(sub);
      }
    }
  }

  for (const entry of entries) {
    await processEntry(entry);
  }

  return files;
}
