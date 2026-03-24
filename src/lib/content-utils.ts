/**
 * 内容管理公共工具函数
 * 用于 notes 和 diaries 共享的逻辑
 * 基于 Quill Delta 格式
 */

export interface DeltaOp {
  insert?: string | Record<string, unknown>;
  attributes?: Record<string, unknown>;
}

export interface QuillDeltaData {
  ops: DeltaOp[];
}

/**
 * 从 Quill Delta ops 中提取所有文本内容
 * @param delta Quill Delta 数据
 * @returns 纯文本内容
 */
export function extractText(delta: QuillDeltaData): string {
  if (!delta || !Array.isArray(delta.ops)) return '';

  return delta.ops
    .map((op) => {
      if (typeof op.insert === 'string') return op.insert;
      return '';
    })
    .join('');
}

/**
 * 计算字数（不包含空白字符）
 * @param delta Quill Delta 数据
 * @returns 字数
 */
export function calculateWordCount(delta: QuillDeltaData): number {
  const text = extractText(delta);
  return text.replace(/\s/g, '').length;
}
