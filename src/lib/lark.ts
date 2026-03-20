import * as lark from "@larksuiteoapi/node-sdk";

let client: lark.Client | null = null;
let wsClient: lark.WSClient | null = null;

export type LarkEventMode = "webhook" | "websocket";

export function getLarkClient(): lark.Client {
  if (!client) {
    const appId = process.env.LARK_APP_ID;
    const appSecret = process.env.LARK_APP_SECRET;
    if (!appId || !appSecret) {
      throw new Error("LARK_APP_ID and LARK_APP_SECRET are required");
    }
    client = new lark.Client({
      appId,
      appSecret,
      appType: lark.AppType.SelfBuild,
      domain: lark.Domain.Feishu,
    });
  }
  return client;
}

export function isLarkConfigured(): boolean {
  return !!(process.env.LARK_APP_ID && process.env.LARK_APP_SECRET);
}

export function getVerificationToken(): string {
  return process.env.LARK_VERIFICATION_TOKEN || "";
}

export function getAllowedUserIds(): Set<string> {
  const ids = process.env.LARK_ALLOWED_USER_IDS || "";
  return new Set(
    ids
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  );
}

export function getFolderToken(): string {
  return process.env.LARK_FOLDER_TOKEN || "";
}

/**
 * Get the event mode from environment
 * @returns "webhook" or "websocket", defaults to "webhook"
 */
export function getLarkEventMode(): LarkEventMode {
  const mode = process.env.LARK_EVENT_MODE?.toLowerCase();
  if (mode === "websocket") {
    return "websocket";
  }
  return "webhook";
}

/**
 * Get the encrypt key for message decryption
 */
export function getEncryptKey(): string {
  return process.env.LARK_ENCRYPT_KEY || "";
}

/**
 * Create or get the WebSocket client for long connection mode
 */
export function getWSClient(): lark.WSClient {
  if (!wsClient) {
    const appId = process.env.LARK_APP_ID;
    const appSecret = process.env.LARK_APP_SECRET;
    if (!appId || !appSecret) {
      throw new Error("LARK_APP_ID and LARK_APP_SECRET are required for WebSocket mode");
    }
    wsClient = new lark.WSClient({
      appId,
      appSecret,
      domain: lark.Domain.Feishu,
      loggerLevel: lark.LoggerLevel.info,
      autoReconnect: true,
    });
  }
  return wsClient;
}

/**
 * Close the WebSocket client
 */
export function closeWSClient(): void {
  if (wsClient) {
    wsClient.close();
    wsClient = null;
  }
}

// ============== 飞书云空间文件夹操作 API ==============

/**
 * 获取 Tenant Access Token
 */
export async function getTenantAccessToken(): Promise<string> {
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

  const data = (await response.json()) as {
    code: number;
    msg: string;
    tenant_access_token: string;
  };

  if (data.code !== 0) {
    throw new Error(`获取 tenant_access_token 失败: ${data.msg}`);
  }

  return data.tenant_access_token;
}

/**
 * 获取根文件夹（我的空间）元数据
 * API: GET /open-apis/drive/explorer/v2/root_folder/meta
 */
export async function getRootFolderMeta(
  tenantToken: string
): Promise<{ token: string; id: string; user_id: string }> {
  const response = await fetch(
    "https://open.feishu.cn/open-apis/drive/explorer/v2/root_folder/meta",
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tenantToken}`,
        "Content-Type": "application/json",
      },
    }
  );

  const res = (await response.json()) as {
    code: number;
    msg: string;
    data?: { token: string; id: string; user_id: string };
  };

  if (res.code !== 0) {
    throw new Error(`获取根文件夹元数据失败: ${res.msg}`);
  }

  if (!res.data) {
    throw new Error("获取根文件夹元数据失败: 无返回数据");
  }

  return res.data;
}

/**
 * 获取文件夹中的子文件夹列表
 * API: GET /open-apis/drive/v1/files
 */
export async function getSubFolders(
  tenantToken: string,
  folderToken: string
): Promise<Array<{ token: string; name: string; type: string }>> {
  const folders: Array<{ token: string; name: string; type: string }> = [];
  let pageToken: string | undefined;

  do {
    const url = new URL("https://open.feishu.cn/open-apis/drive/v1/files");
    url.searchParams.set("folder_token", folderToken);
    url.searchParams.set("page_size", "200");
    if (pageToken) {
      url.searchParams.set("page_token", pageToken);
    }

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tenantToken}`,
        "Content-Type": "application/json",
      },
    });

    const res = (await response.json()) as {
      code: number;
      msg: string;
      data?: {
        files: Array<{ token: string; name: string; type: string }>;
        next_page_token?: string;
      };
    };

    if (res.code !== 0) {
      console.error("[lark] 获取文件夹列表失败:", res.msg);
      break;
    }

    const files = res.data?.files || [];
    const subFolders = files.filter((f) => f.type === "folder");
    folders.push(...subFolders);

    pageToken = res.data?.next_page_token;
  } while (pageToken);

  return folders;
}

/**
 * 根据名称在父文件夹中查找子文件夹
 */
export async function findFolderByName(
  tenantToken: string,
  parentToken: string,
  folderName: string
): Promise<{ token: string; name: string } | null> {
  const subFolders = await getSubFolders(tenantToken, parentToken);
  return subFolders.find((f) => f.name === folderName) || null;
}

/**
 * 在飞书云空间创建文件夹
 * API: POST /open-apis/drive/v1/files/create_folder
 */
export async function createFolder(
  tenantToken: string,
  name: string,
  parentToken: string
): Promise<{ token: string; url: string }> {
  const response = await fetch(
    "https://open.feishu.cn/open-apis/drive/v1/files/create_folder",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tenantToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name,
        folder_token: parentToken,
      }),
    }
  );

  const res = (await response.json()) as {
    code: number;
    msg: string;
    data?: { token: string; url: string };
  };

  if (res.code !== 0) {
    throw new Error(`创建文件夹失败: ${res.msg} (code: ${res.code})`);
  }

  if (!res.data) {
    throw new Error("创建文件夹失败: 无返回数据");
  }

  return res.data;
}

/**
 * 确保文件夹路径存在，不存在则创建
 * @param tenantToken 飞书 tenant access token
 * @param folderPath 文件夹路径，如 ["工作", "项目", "笔记"]
 * @param rootFolderToken 根文件夹 token（可选，不传则使用我的空间根目录）
 * @returns 最终文件夹的 token
 */
export async function ensureFolderPath(
  tenantToken: string,
  folderPath: string[],
  rootFolderToken?: string
): Promise<string> {
  if (folderPath.length === 0) {
    // 没有路径，返回根目录或配置的文件夹
    const configuredToken = getFolderToken();
    if (configuredToken) {
      return configuredToken;
    }
    if (rootFolderToken) {
      return rootFolderToken;
    }
    // 获取我的空间根目录
    const rootMeta = await getRootFolderMeta(tenantToken);
    return rootMeta.token;
  }

  // 获取起始文件夹 token
  let currentToken: string;
  const configuredToken = getFolderToken();

  if (configuredToken) {
    // 如果配置了 LARK_FOLDER_TOKEN，从该文件夹开始
    currentToken = configuredToken;
  } else if (rootFolderToken) {
    currentToken = rootFolderToken;
  } else {
    // 获取我的空间根目录
    const rootMeta = await getRootFolderMeta(tenantToken);
    currentToken = rootMeta.token;
  }

  // 逐级检查/创建文件夹
  for (const folderName of folderPath) {
    // 查找是否已存在同名文件夹
    const existingFolder = await findFolderByName(
      tenantToken,
      currentToken,
      folderName
    );

    if (existingFolder) {
      // 文件夹已存在，继续下一级
      currentToken = existingFolder.token;
      console.log(`[lark] 文件夹已存在: ${folderName} (${currentToken})`);
    } else {
      // 创建文件夹
      const newFolder = await createFolder(tenantToken, folderName, currentToken);
      currentToken = newFolder.token;
      console.log(`[lark] 创建文件夹: ${folderName} (${currentToken})`);
    }
  }

  return currentToken;
}

/**
 * 删除云空间中的文件
 * API: DELETE /open-apis/drive/v1/files/:file_token
 * @param tenantToken 飞书 tenant access token
 * @param fileToken 要删除的文件 token
 * @param type 文件类型，默认为 "file"
 */
export async function deleteFile(
  tenantToken: string,
  fileToken: string,
  type: "file" | "docx" | "bitable" | "folder" | "doc" | "sheet" | "mindnote" | "shortcut" | "slides" = "file"
): Promise<void> {
  const url = new URL(`https://open.feishu.cn/open-apis/drive/v1/files/${fileToken}`);
  url.searchParams.set("type", type);

  const response = await fetch(url.toString(), {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${tenantToken}`,
    },
  });

  const result = await response.json() as { code: number; msg: string; data?: { task_id?: string } };

  if (result.code !== 0) {
    console.error("[lark] 删除文件失败:", result.msg, "file_token:", fileToken);
    // 不抛出错误，只记录日志，避免影响主流程
  } else {
    console.log("[lark] 文件已删除:", fileToken);
  }
}
