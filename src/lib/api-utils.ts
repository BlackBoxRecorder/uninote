import { NextRequest, NextResponse } from "next/server";

// ApiError 类
export class ApiError extends Error {
  constructor(public statusCode: number = 500, message: string = "服务器错误") {
    super(message);
  }
}

// 统一的错误处理包装器
export function withErrorHandler(
  handler: (req: NextRequest, context?: any) => Promise<NextResponse>
) {
  return async (req: NextRequest, context?: any) => {
    try {
      return await handler(req, context);
    } catch (error) {
      console.error("API Error:", error);
      if (error instanceof ApiError) {
        return NextResponse.json(
          { error: error.message },
          { status: error.statusCode }
        );
      }
      return NextResponse.json({ error: "服务器内部错误" }, { status: 500 });
    }
  };
}

// 验证工具
export const ValidationUtils = {
  NAME_MAX: 100,
  INVALID_CHARS: /[\/\\:*?"<>|]/,

  validateName(name: unknown): string {
    if (!name || typeof name !== "string") throw new ApiError(400, "名称不能为空");
    const trimmed = name.trim();
    if (trimmed.length === 0) throw new ApiError(400, "名称不能为空");
    if (trimmed.length > this.NAME_MAX)
      throw new ApiError(400, `名称不能超过${this.NAME_MAX}个字符`);
    if (this.INVALID_CHARS.test(trimmed))
      throw new ApiError(400, "名称包含非法字符");
    return trimmed;
  },
};
