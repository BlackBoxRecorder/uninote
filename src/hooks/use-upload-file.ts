'use client';

import { useState, useCallback } from 'react';

interface UploadedFile {
  url: string;
  name: string;
}

export function useUploadFile() {
  const [uploadedFile, setUploadedFile] = useState<UploadedFile | null>(null);
  const [uploadingFile, setUploadingFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

  const uploadFile = useCallback(async (file: File) => {
    setIsUploading(true);
    setUploadingFile(file);
    setProgress(0);

    try {
      const formData = new FormData();
      formData.append('file', file);

      setProgress(50);

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) throw new Error('Upload failed');

      const data = await res.json();
      setProgress(100);
      setUploadedFile({ url: data.url, name: file.name });
    } catch (error) {
      console.error('Upload failed:', error);
      setProgress(0);
    } finally {
      setIsUploading(false);
    }
  }, []);

  return {
    isUploading,
    progress,
    uploadedFile,
    uploadFile,
    uploadingFile,
  };
}
