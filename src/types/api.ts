/**
 * 统一的 API 响应类型定义
 */

// 通用 API 响应
export interface ApiResponse<T = unknown> {
  data?: T;
  error?: string;
  success?: boolean;
}

// 列表响应（用于分页）
export interface ListResponse<T> {
  items: T[];
  hasMore?: boolean;
  cursor?: number | string;
}

// Ideas 列表响应
export interface IdeasListResponse {
  ideas: import('./index').Idea[];
  hasMore: boolean;
}

// Tags 列表响应
export interface TagsListResponse {
  tags: import('./index').Tag[];
}

// Diaries 列表响应
export interface DiariesListResponse {
  diaries: import('./index').DiaryMeta[];
}

// Tree 响应
export interface TreeResponse {
  folders: import('./index').Folder[];
  notes: import('./index').NoteMeta[];
}

// 错误响应
export interface ErrorResponse {
  error: string;
}
