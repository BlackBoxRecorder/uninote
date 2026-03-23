/**
 * 内容管理公共工具函数
 * 用于 notes 和 diaries 共享的逻辑
 */

/**
 * 递归提取所有文本内容
 * @param nodes Plate/Slate 节点数组
 * @returns 纯文本内容
 */
export function extractText(nodes: unknown[]): string {
  return nodes
    .map((node) => {
      if (!node || typeof node !== 'object') return '';
      const n = node as Record<string, unknown>;

      if (typeof n.text === 'string') return n.text;

      if (Array.isArray(n.children)) {
        return extractText(n.children);
      }

      return '';
    })
    .join('');
}

/**
 * 计算字数（不包含空白字符）
 * @param content Plate/Slate 内容节点数组
 * @returns 字数
 */
export function calculateWordCount(content: unknown[]): number {
  const text = extractText(content);
  return text.replace(/\s/g, '').length;
}
