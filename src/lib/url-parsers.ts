import type { EmbedUrlData } from '@platejs/media';

const BILIBILI_EMBED_PREFIX = 'https://player.bilibili.com/player.html';

/**
 * Parse Bilibili video URL
 * Supports formats:
 * - https://www.bilibili.com/video/BVxxxxxx
 * - https://www.bilibili.com/video/BVxxxxxx?p=1
 * - https://b23.tv/xxxxxx (short link)
 */
export function parseBilibiliUrl(url: string): EmbedUrlData | undefined {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    return undefined;
  }

  const { hostname, pathname, searchParams } = parsedUrl;

  // Match bilibili.com or b23.tv
  const isBilibili =
    hostname === 'www.bilibili.com' ||
    hostname === 'bilibili.com' ||
    hostname === 'b23.tv';

  if (!isBilibili) return undefined;

  // Extract BV or AV ID from pathname
  const bvMatch = pathname.match(/\/video\/(BV[\w]+)/i);
  const avMatch = pathname.match(/\/video\/av(\d+)/i);

  let bvid: string | null = null;
  let aid: string | null = null;

  if (bvMatch) {
    bvid = bvMatch[1];
  } else if (avMatch) {
    aid = avMatch[1];
  } else {
    return undefined;
  }

  // Build embed URL
  const embedUrl = new URL(BILIBILI_EMBED_PREFIX);

  if (bvid) {
    embedUrl.searchParams.set('bvid', bvid);
  } else if (aid) {
    embedUrl.searchParams.set('aid', aid);
  }

  // Handle page number
  const page = searchParams.get('p') || '1';
  embedUrl.searchParams.set('page', page);

  // Enable high quality and danmaku
  embedUrl.searchParams.set('high_quality', '1');
  embedUrl.searchParams.set('danmaku', '0');

  const id = bvid || `av${aid}`;

  return {
    id,
    provider: 'bilibili',
    url: embedUrl.toString(),
  };
}
