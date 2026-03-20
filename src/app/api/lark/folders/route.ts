import { NextResponse } from "next/server";
import { getLarkClient, isLarkConfigured } from "@/lib/lark";

interface LarkFolder {
  token: string;
  name: string;
  parent_token?: string;
  path?: string;
}

/**
 * 递归获取文件夹列表
 */
async function fetchFoldersRecursive(
  client: ReturnType<typeof getLarkClient>,
  parentToken?: string,
  parentPath: string = ""
): Promise<LarkFolder[]> {
  const folders: LarkFolder[] = [];
  let pageToken: string | undefined;

  do {
    try {
      const res = await client.drive.file.list({
        params: {
          folder_token: parentToken || "",
          page_size: 200,
          ...(pageToken ? { page_token: pageToken } : {}),
        },
      });

      if (res.code !== 0) {
        console.error("[lark folders] Failed to list folder:", res.msg);
        break;
      }

      const files = res.data?.files || [];
      const subFolders = files.filter((f) => f.type === "folder");

      for (const folder of subFolders) {
        const currentPath = parentPath
          ? `${parentPath} / ${folder.name}`
          : folder.name;

        folders.push({
          token: folder.token,
          name: folder.name,
          parent_token: folder.parent_token,
          path: currentPath,
        });

        // 递归获取子文件夹
        const childFolders = await fetchFoldersRecursive(
          client,
          folder.token,
          currentPath
        );
        folders.push(...childFolders);
      }

      pageToken = res.data?.next_page_token;
    } catch (error) {
      console.error("[lark folders] Error fetching folders:", error);
      break;
    }
  } while (pageToken);

  return folders;
}

export async function GET() {
  try {
    if (!isLarkConfigured()) {
      return NextResponse.json(
        { error: "飞书未配置，请设置 LARK_APP_ID 和 LARK_APP_SECRET" },
        { status: 400 }
      );
    }

    const client = getLarkClient();
    const folders = await fetchFoldersRecursive(client);

    // 按路径排序
    folders.sort((a, b) => (a.path || "").localeCompare(b.path || ""));

    return NextResponse.json({
      success: true,
      count: folders.length,
      folders,
    });
  } catch (error) {
    console.error("[lark folders] Error:", error);
    return NextResponse.json(
      { error: "获取飞书文件夹列表失败" },
      { status: 500 }
    );
  }
}
