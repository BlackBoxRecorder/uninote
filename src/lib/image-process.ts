import sharp from "sharp";

export async function processImage(buffer: Buffer): Promise<{
  data: Buffer;
  width: number;
  height: number;
}> {
  const processed = sharp(buffer)
    .resize({ width: 1920, withoutEnlargement: true })
    .webp({ quality: 80 });

  const data = await processed.toBuffer();
  const metadata = await sharp(data).metadata();

  return {
    data,
    width: metadata.width || 0,
    height: metadata.height || 0,
  };
}
