import fs from "fs";
import path from "path";
import type { StorageProvider } from "./index";

const UPLOAD_DIR = path.resolve(process.cwd(), "data/uploads");

export class LocalStorage implements StorageProvider {
  async upload(buffer: Buffer, key: string): Promise<string> {
    const filePath = path.join(UPLOAD_DIR, key);
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, buffer);
    return `/api/files/${key}`;
  }

  async delete(key: string): Promise<void> {
    const filePath = path.join(UPLOAD_DIR, key);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }

  getUrl(key: string): string {
    return `/api/files/${key}`;
  }
}
