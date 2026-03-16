export interface StorageProvider {
  upload(buffer: Buffer, key: string): Promise<string>;
  delete(key: string): Promise<void>;
  getUrl(key: string): string;
}

import { LocalStorage } from "./local";
import { COSStorage } from "./cos";

let storageInstance: StorageProvider | null = null;

export function getStorage(): StorageProvider {
  if (storageInstance) return storageInstance;

  const { COS_SECRET_ID, COS_SECRET_KEY, COS_BUCKET, COS_REGION } = process.env;

  if (COS_SECRET_ID && COS_SECRET_KEY && COS_BUCKET && COS_REGION) {
    storageInstance = new COSStorage({
      secretId: COS_SECRET_ID,
      secretKey: COS_SECRET_KEY,
      bucket: COS_BUCKET,
      region: COS_REGION,
    });
  } else {
    storageInstance = new LocalStorage();
  }

  return storageInstance;
}
