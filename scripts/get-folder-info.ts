/**
 * 获取飞书空间文件夹详细信息的脚本
 * 
 * 使用方法：npx tsx scripts/get-folder-info.ts
 */

import "dotenv/config";

// 从环境变量获取配置
const appId = process.env.LARK_APP_ID;
const appSecret = process.env.LARK_APP_SECRET;

if (!appId || !appSecret) {
  console.error("❌ 请在 .env 文件中配置 LARK_APP_ID 和 LARK_APP_SECRET");
  process.exit(1);
}

// 缓存 token
let cachedToken: string | null = null;

/**
 * 获取 Tenant Access Token
 */
async function getTenantAccessToken(): Promise<string> {
  if (cachedToken) {
    return cachedToken;
  }
  
  const response = await fetch(
    "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ app_id: appId, app_secret: appSecret }),
    }
  );
  
  const data = await response.json() as { code: number; msg: string; tenant_access_token: string };
  
  if (data.code !== 0) {
    throw new Error(`获取 tenant_access_token 失败: ${data.msg}`);
  }
  
  cachedToken = data.tenant_access_token;
  return cachedToken;
}

/**
 * 获取根文件夹（我的空间）元数据
 * API: GET /open-apis/drive/explorer/v2/root_folder/meta
 */
async function getRootFolderMeta() {
  console.log("\n📁 获取根文件夹（我的空间）元数据...\n");
  
  try {
    const token = await getTenantAccessToken();
    const response = await fetch("https://open.feishu.cn/open-apis/drive/explorer/v2/root_folder/meta", {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });
    
    const res = await response.json() as { code: number; msg: string; data?: { token: string; id: string; user_id: string } };
    
    if (res.code !== 0) {
      console.error("❌ 获取根文件夹元数据失败：", res.msg);
      return null;
    }
    
    console.log("✅ 根文件夹元数据：");
    console.log(JSON.stringify(res.data, null, 2));
    
    return res.data;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("❌ 获取根文件夹元数据失败：", message);
    return null;
  }
}

/**
 * 获取文件夹中的文件清单
 * API: GET /open-apis/drive/v1/files
 */
async function getFolderFiles(folderToken: string) {
  console.log(`\n📂 获取文件夹 (token: ${folderToken}) 中的文件清单...\n`);
  
  try {
    const token = await getTenantAccessToken();
    const url = new URL("https://open.feishu.cn/open-apis/drive/v1/files");
    url.searchParams.set("folder_token", folderToken);
    url.searchParams.set("page_size", "50");
    
    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });
    
    const res = await response.json() as { code: number; msg: string; data?: { files: Array<{ token: string; name: string; type: string; parent_token: string }> } };
    
    if (res.code !== 0) {
      console.error("❌ 获取文件清单失败：", res.msg);
      return null;
    }
    
    console.log("✅ 文件清单：");
    console.log(JSON.stringify(res.data, null, 2));
    
    return res.data;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("❌ 获取文件清单失败：", message);
    return null;
  }
}

/**
 * 获取文件夹元数据
 * API: GET /open-apis/drive/explorer/v2/folder/:folderToken/meta
 */
async function getFolderMeta(folderToken: string) {
  console.log(`\n📋 获取文件夹 (token: ${folderToken}) 元数据...\n`);
  
  try {
    const token = await getTenantAccessToken();
    const response = await fetch(`https://open.feishu.cn/open-apis/drive/explorer/v2/folder/${folderToken}/meta`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });
    
    const res = await response.json() as { code: number; msg: string; data?: { token: string; id: string; name: string } };
    
    if (res.code !== 0) {
      console.error("❌ 获取文件夹元数据失败：", res.msg);
      return null;
    }
    
    console.log("✅ 文件夹元数据：");
    console.log(JSON.stringify(res.data, null, 2));
    
    return res.data;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("❌ 获取文件夹元数据失败：", message);
    return null;
  }
}

async function main() {
  console.log("🚀 开始获取飞书空间文件夹信息");
  console.log("=".repeat(50));
  
  // 1. 获取根文件夹元数据
  const rootMeta = await getRootFolderMeta();
  
  if (rootMeta?.token) {
    // 2. 获取根文件夹中的文件清单
    await getFolderFiles(rootMeta.token);
  }
  
  // 3. 获取配置的 LARK_FOLDER_TOKEN 对应的文件夹信息
  const configuredFolderToken = process.env.LARK_FOLDER_TOKEN;
  if (configuredFolderToken) {
    console.log("\n" + "=".repeat(50));
    console.log(`📌 配置的 LARK_FOLDER_TOKEN: ${configuredFolderToken}`);
    
    // 获取该文件夹的元数据
    await getFolderMeta(configuredFolderToken);
    
    // 获取该文件夹中的文件清单
    await getFolderFiles(configuredFolderToken);
  }
  
  console.log("\n" + "=".repeat(50));
  console.log("✨ 完成！");
}

main().catch(console.error);
