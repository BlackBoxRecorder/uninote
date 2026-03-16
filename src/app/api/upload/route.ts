import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { getStorage } from "@/lib/storage";
import { processImage } from "@/lib/image-process";
import { getDatabase } from "@/db";
import { fileAttachments } from "@/db/schema";

const MAX_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp", "image/svg+xml"];

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const noteId = formData.get("noteId") as string | null;

    if (!file) {
      return NextResponse.json({ error: "未选择文件" }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: "不支持的文件类型" }, { status: 400 });
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: "文件大小不能超过 10MB" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { data, width, height } = await processImage(buffer);

    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const id = nanoid();
    const key = `${year}/${month}/${id}.webp`;

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
          mimeType: "image/webp",
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
