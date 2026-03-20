import { NextRequest, NextResponse } from "next/server";
import { getDatabase } from "@/db";
import { notes } from "@/db/schema";
import { eq } from "drizzle-orm";
import { isLarkConfigured, getFolderToken } from "@/lib/lark";
import { serializeNoteToMarkdown } from "@/lib/server-markdown";

/**
 * 将 Markdown 字符串转换为 ArrayBuffer (用于上传)
 */
function markdownToBuffer(markdown: string): ArrayBuffer {
  console.log("[lark upload] Converting markdown to buffer, length:", markdown.length);
  const encoder = new TextEncoder();
  return encoder.encode(markdown).buffer;
}

/**
 * 获取 Tenant Access Token
 */
async function getTenantAccessToken(): Promise<string> {
  const appId = process.env.LARK_APP_ID;
  const appSecret = process.env.LARK_APP_SECRET;
  
  if (!appId || !appSecret) {
    throw new Error("LARK_APP_ID 和 LARK_APP_SECRET 未配置");
  }
  
  const response = await fetch(
    "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ app_id: appId, app_secret: appSecret }),
    }
  );
  
  const data = await response.json();
  
  if (data.code !== 0) {
    throw new Error(`获取 tenant_access_token 失败: ${data.msg}`);
  }
  
  return data.tenant_access_token;
}

/**
 * 上传文件到飞书云盘获取 file_token
 */
async function uploadFileToDrive(
  tenantToken: string,
  fileData: ArrayBuffer,
  fileName: string,
  folderToken?: string
): Promise<string> {
  console.log("[lark upload] Uploading file to drive:", fileName, "folderToken:", folderToken || "(none)");
  
  const formData = new FormData();
  
  // 创建 Blob (Markdown 文件)
  const blob = new Blob([fileData], {
    type: "text/markdown",
  });
  
  formData.append("file_name", fileName);
  
  // 如果有文件夹 token，上传到指定文件夹；否则上传到应用资源空间
  if (folderToken) {
    formData.append("parent_type", "explorer");
    formData.append("parent_node", folderToken);
  } else {
    // ccm_resource: 上传到应用资源空间，不需要 parent_node
    formData.append("parent_type", "ccm_resource");
  }
  
  // 添加文件大小
  formData.append("size", fileData.byteLength.toString());
  
  formData.append("file", blob, fileName);
  
  console.log("[lark upload] FormData entries:");
  for (const [key, value] of formData.entries()) {
    if (key === "file") {
      console.log(`  ${key}: [File] ${fileName}`);
    } else {
      console.log(`  ${key}: ${value}`);
    }
  }
  
  const response = await fetch(
    "https://open.feishu.cn/open-apis/drive/v1/files/upload_all",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tenantToken}`,
      },
      body: formData,
    }
  );
  
  const result = await response.json();
  console.log("[lark upload] Upload file response:", {
    code: result.code,
    msg: result.msg,
    data: result.data,
  });
  
  if (result.code !== 0) {
    throw new Error(`上传文件失败: ${result.msg} (code: ${result.code})`);
  }
  
  return result.data.file_token;
}



export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!isLarkConfigured()) {
      return NextResponse.json(
        { error: "飞书未配置，请设置 LARK_APP_ID 和 LARK_APP_SECRET" },
        { status: 400 }
      );
    }

    const { id } = await params;
    const db = getDatabase();
    const note = db.select().from(notes).where(eq(notes.id, id)).get();

    if (!note) {
      return NextResponse.json({ error: "笔记不存在" }, { status: 404 });
    }

    const title = note.title || "Untitled";
    const folderToken = getFolderToken();

    console.log("[lark upload] Starting upload for note:", {
      id,
      title,
      folderToken: folderToken || "(empty)",
    });

    // 1. 获取 Markdown 内容
    let markdown: string;
    if (note.markdown) {
      markdown = note.markdown;
      console.log("[lark upload] Using stored markdown, length:", markdown.length);
    } else if (note.content) {
      markdown = serializeNoteToMarkdown(note.content, title);
      console.log("[lark upload] Serialized from content to markdown, length:", markdown.length);
    } else {
      markdown = `# ${title}\n`;
      console.log("[lark upload] Using title-only fallback");
    }

    // 2. 获取 tenant access token
    const tenantToken = await getTenantAccessToken();
    console.log("[lark upload] Got tenant access token");

    // 3. 将 Markdown 转换为 Buffer
    const markdownBuffer = markdownToBuffer(markdown);
    console.log("[lark upload] Converted to buffer, size:", markdownBuffer.byteLength, "bytes");

    // 4. 上传文件到飞书云空间
    const fileName = `${title}.md`;
    const fileToken = await uploadFileToDrive(tenantToken, markdownBuffer, fileName, folderToken || undefined);
    console.log("[lark upload] File uploaded successfully, token:", fileToken);
    
    return NextResponse.json({ 
      success: true, 
      fileToken,
      fileName,
      message: "文件已成功上传到飞书云空间" 
    });
  } catch (e) {
    console.error("[lark upload] Error:", e);
    const message = e instanceof Error ? e.message : "上传到飞书云空间失败";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
