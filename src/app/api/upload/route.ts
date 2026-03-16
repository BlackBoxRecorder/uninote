import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { getStorage } from "@/lib/storage";
import { processImage } from "@/lib/image-process";
import { getDatabase } from "@/db";
import { fileAttachments } from "@/db/schema";

const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 100MB
const MAX_AUDIO_SIZE = 50 * 1024 * 1024; // 50MB
const MAX_DOCUMENT_SIZE = 50 * 1024 * 1024; // 50MB

const ALLOWED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp", "image/svg+xml"];
const ALLOWED_VIDEO_TYPES = ["video/mp4", "video/webm", "video/ogg", "video/quicktime"];
const ALLOWED_AUDIO_TYPES = [
  "audio/mpeg", // mp3
  "audio/wav",
  "audio/ogg",
  "audio/aac",
  "audio/flac",
  "audio/m4a",
  "audio/x-m4a",
  "audio/webm",
];
const ALLOWED_DOCUMENT_TYPES = [
  // PDF
  "application/pdf",
  // Markdown
  "text/markdown",
  "text/x-markdown",
  "text/plain", // .md 有时会被识别为 text/plain
  // 压缩包
  "application/zip",
  "application/x-zip-compressed",
  "application/x-rar-compressed",
  "application/x-7z-compressed",
  "application/gzip",
  "application/x-gzip",
  "application/x-tar",
  "application/x-bzip2",
  // Office 文档
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
];

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const noteId = formData.get("noteId") as string | null;

    if (!file) {
      return NextResponse.json({ error: "未选择文件" }, { status: 400 });
    }

    const isImage = ALLOWED_IMAGE_TYPES.includes(file.type);
    const isVideo = ALLOWED_VIDEO_TYPES.includes(file.type);
    const isAudio = ALLOWED_AUDIO_TYPES.includes(file.type);
    const isDocument = ALLOWED_DOCUMENT_TYPES.includes(file.type);

    if (!isImage && !isVideo && !isAudio && !isDocument) {
      return NextResponse.json({ error: "不支持的文件类型" }, { status: 400 });
    }

    let maxSize: number;
    if (isVideo) {
      maxSize = MAX_VIDEO_SIZE;
    } else if (isAudio) {
      maxSize = MAX_AUDIO_SIZE;
    } else if (isDocument) {
      maxSize = MAX_DOCUMENT_SIZE;
    } else {
      maxSize = MAX_IMAGE_SIZE;
    }
    if (file.size > maxSize) {
      const maxSizeMB = maxSize / (1024 * 1024);
      return NextResponse.json({ error: `文件大小不能超过 ${maxSizeMB}MB` }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    let data: Buffer;
    let width: number | undefined;
    let height: number | undefined;
    let mimeType: string;
    let ext: string;

    if (isImage) {
      const processed = await processImage(buffer);
      data = processed.data;
      width = processed.width;
      height = processed.height;
      mimeType = "image/webp";
      ext = "webp";
    } else {
      // 视频、音频、文档：直接保存原始文件
      data = buffer;
      mimeType = file.type;
      // 从文件名获取扩展名，如果没有则根据类型推断
      const fileExt = file.name.split(".").pop()?.toLowerCase();
      if (fileExt && fileExt.length > 0 && fileExt.length <= 10) {
        ext = fileExt;
      } else if (isVideo) {
        ext = "mp4";
      } else if (isAudio) {
        ext = "mp3";
      } else if (isDocument) {
        ext = "pdf";
      } else {
        ext = "bin";
      }
    }

    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const id = nanoid();
    const key = `${year}/${month}/${id}.${ext}`;

    const storage = getStorage();
    const url = await storage.upload(data, key);

    if (noteId) {
      const db = getDatabase();
      db.insert(fileAttachments)
        .values({
          id,
          noteId,
          fileName: file.name,
          filePath: key,
          storageType: url.startsWith("/api/files") ? "local" : "cos",
          cosUrl: url.startsWith("http") ? url : null,
          mimeType,
          size: data.length,
          width,
          height,
          createdAt: Date.now(),
        })
        .run();
    }

    return NextResponse.json({ url, id, width, height });
  } catch (e) {
    console.error("Upload failed:", e);
    return NextResponse.json({ error: "上传失败" }, { status: 500 });
  }
}
