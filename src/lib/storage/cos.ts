import COS from "cos-nodejs-sdk-v5";
import type { StorageProvider } from "./index";

interface COSConfig {
  secretId: string;
  secretKey: string;
  bucket: string;
  region: string;
}

export class COSStorage implements StorageProvider {
  private cos: COS;
  private bucket: string;
  private region: string;

  constructor(config: COSConfig) {
    this.cos = new COS({
      SecretId: config.secretId,
      SecretKey: config.secretKey,
    });
    this.bucket = config.bucket;
    this.region = config.region;
  }

  async upload(buffer: Buffer, key: string): Promise<string> {
    return new Promise((resolve, reject) => {
      this.cos.putObject(
        {
          Bucket: this.bucket,
          Region: this.region,
          Key: `ynote/${key}`,
          Body: buffer,
        },
        (err) => {
          if (err) reject(err);
          else resolve(this.getUrl(key));
        }
      );
    });
  }

  async delete(key: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.cos.deleteObject(
        {
          Bucket: this.bucket,
          Region: this.region,
          Key: `ynote/${key}`,
        },
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  getUrl(key: string): string {
    return `https://${this.bucket}.cos.${this.region}.myqcloud.com/ynote/${key}`;
  }
}
