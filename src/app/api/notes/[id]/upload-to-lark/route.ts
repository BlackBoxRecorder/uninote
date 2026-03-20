import { NextRequest, NextResponse } from "next/server";
import { getDatabase } from "@/db";
import { folders, notes } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  isLarkConfigured,
  getTenantAccessToken,
  ensureFolderPath,
  deleteFile,
} from "@/lib/lark";
import { serializeNoteToMarkdown } from "@/lib/server-markdown";

/**
 * 将 Markdown 字符串转换为 ArrayBuffer (用于上传)
 */
function markdownToBuffer(markdown: string): ArrayBuffer {
  console.log("[lark import] Converting markdown to buffer, length:", markdown.length);
  const encoder = new TextEncoder();
  return encoder.encode(markdown).buffer;
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
  console.log("[lark import] Uploading file to drive:", fileName, "folderToken:", folderToken || "(none)");
  
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
  
  console.log("[lark import] FormData entries:");
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
  console.log("[lark import] Upload file response:", {
    code: result.code,
    msg: result.msg,
    data: result.data,
  });
  
  if (result.code !== 0) {
    throw new Error(`上传文件失败: ${result.msg} (code: ${result.code})`);
  }
  
  return result.data.file_token;
}

/**
 * 创建导入任务（使用 REST API）
 */
async function createImportTask(
  tenantToken: string,
  fileToken: string,
  fileName: string,
  folderToken?: string
): Promise<string> {
  console.log("[lark import] Creating import task for:", fileName);
  
  const response = await fetch(
    "https://open.feishu.cn/open-apis/drive/v1/import_tasks",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tenantToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        file_extension: "md",
        file_token: fileToken,
        type: "docx",
        file_name: fileName,
        point: {
          mount_type: 1,
          mount_key: folderToken || "",
        },
      }),
    }
  );
  
  const result = await response.json();
  console.log("[lark import] Import task response:", {
    code: result.code,
    msg: result.msg,
    data: result.data,
  });
  
  if (result.code !== 0) {
    throw new Error(`创建导入任务失败: ${result.msg}`);
  }
  
  const ticket = result.data?.ticket;
  if (!ticket) {
    throw new Error("创建导入任务失败: 未返回 ticket");
  }
  
  return ticket;
}

/**
 * 轮询查询导入状态（使用 REST API）
 */
async function pollImportStatus(
  tenantToken: string,
  ticket: string,
  maxAttempts = 30,
  intervalMs = 2000
): Promise<{ docUrl: string; docToken: string }> {
  console.log("[lark import] Polling import status, ticket:", ticket);
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const response = await fetch(
      `https://open.feishu.cn/open-apis/drive/v1/import_tasks/${ticket}`,
      {
        headers: {
          Authorization: `Bearer ${tenantToken}`,
        },
      }
    );
    
    const result = await response.json();
    const jobStatus = result.data?.result?.job_status;
    
    console.log(`[lark import] Poll attempt ${attempt}/${maxAttempts}:`, {
      code: result.code,
      jobStatus,
    });
    
    if (result.code !== 0) {
      throw new Error(`查询导入状态失败: ${result.msg}`);
    }
    
    // job_status: 0=成功, 1=初始化, 2=处理中, >=3=失败
    if (jobStatus === 0) {
      const token = result.data?.result?.token;
      const url = result.data?.result?.url;
      
      if (!token) {
        console.log("[lark import] Full result.data:", JSON.stringify(result.data, null, 2));
        throw new Error("导入完成但未返回文档信息");
      }
      
      const docUrl = url || `https://feishu.cn/docx/${token}`;
      console.log("[lark import] Import completed:", docUrl);
      return { docUrl, docToken: token };
    }
    
    if (jobStatus && jobStatus >= 3) {
      const errorMsg = result.data?.result?.job_error_msg || `导入失败 (错误码: ${jobStatus})`;
      throw new Error(`导入失败: ${errorMsg}`);
    }
    
    // job_status = 1 (初始化) 或 2 (处理中)，继续等待
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  
  throw new Error("导入任务超时，请稍后到飞书云空间查看");
}

/**
 * 获取笔记所在的文件夹路径（从根目录到笔记所在文件夹）
 * @returns 文件夹路径数组，如 ["工作", "项目", "笔记"]
 */
function getNoteFolderPath(
  db: ReturnType<typeof getDatabase>,
  folderId: string | null
): string[] {
  if (!folderId) {
    return [];
  }

  const path: string[] = [];
  let currentFolderId: string | null = folderId;
  const visited = new Set<string>(); // 防止循环引用

  while (currentFolderId && !visited.has(currentFolderId)) {
    visited.add(currentFolderId);
    const folder = db
      .select()
      .from(folders)
      .where(eq(folders.id, currentFolderId))
      .get();

    if (!folder) {
      break;
    }

    // 将文件夹名称添加到路径开头（因为是从子到父遍历）
    path.unshift(folder.name);
    currentFolderId = folder.parentId;
  }

  return path;
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

    // 获取笔记所在的文件夹路径
    const folderPath = getNoteFolderPath(db, note.folderId);
    console.log("[lark import] Note folder path:", folderPath);

    console.log("[lark import] Starting import for note:", {
      id,
      title,
      folderPath: folderPath.length > 0 ? folderPath.join(" / ") : "(root)",
    });

    // 1. 获取 tenant access token
    const tenantToken = await getTenantAccessToken();
    console.log("[lark import] Got tenant access token");

    // 2. 确保飞书云空间中存在对应的文件夹结构
    const targetFolderToken = await ensureFolderPath(tenantToken, folderPath);
    console.log("[lark import] Target folder token:", targetFolderToken);

    // 3. 获取 Markdown 内容
    let markdown: string;
    if (note.markdown) {
      markdown = note.markdown;
      console.log("[lark import] Using stored markdown, length:", markdown.length);
    } else if (note.content) {
      markdown = serializeNoteToMarkdown(note.content, title);
      console.log("[lark import] Serialized from content to markdown, length:", markdown.length);
    } else {
      markdown = `# ${title}\n`;
      console.log("[lark import] Using title-only fallback");
    }

    // 4. 将 Markdown 转换为 Buffer
    const markdownBuffer = markdownToBuffer(markdown);
    console.log("[lark import] Converted to buffer, size:", markdownBuffer.byteLength, "bytes");

    // 5. 上传文件到飞书云盘
    const fileName = `${title}.md`;
    const fileToken = await uploadFileToDrive(tenantToken, markdownBuffer, fileName, targetFolderToken);
    console.log("[lark import] File uploaded, token:", fileToken);

    // 6. 创建导入任务
    const ticket = await createImportTask(tenantToken, fileToken, fileName, targetFolderToken);
    console.log("[lark import] Import task created, ticket:", ticket);

    // 7. 轮询导入状态
    const { docUrl } = await pollImportStatus(tenantToken, ticket);

    // 8. 导入成功后删除临时上传的 markdown 文件
    await deleteFile(tenantToken, fileToken, "file");

    console.log("[lark import] Import completed successfully:", docUrl);
    
    return NextResponse.json({ 
      success: true, 
      url: docUrl,
      message: folderPath.length > 0 
        ? `文档已成功导入飞书云空间: ${folderPath.join(" / ")}` 
        : "文档已成功导入飞书云空间"
    });
  } catch (e) {
    console.error("[lark import] Error:", e);
    const message = e instanceof Error ? e.message : "导入到飞书文档失败";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
