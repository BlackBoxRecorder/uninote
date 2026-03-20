import { NextRequest, NextResponse } from "next/server";
import { getDatabase } from "@/db";
import { notes } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getLarkClient, isLarkConfigured, getFolderToken } from "@/lib/lark";
import { serializeNoteToMarkdown } from "@/lib/server-markdown";

interface LarkFolder {
  token: string;
  name: string;
  path?: string;
}

/**
 * 递归获取所有文件夹列表用于日志展示
 */
async function fetchAllFolders(
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

      if (res.code !== 0) break;

      const files = res.data?.files || [];
      const subFolders = files.filter((f) => f.type === "folder");

      for (const folder of subFolders) {
        const currentPath = parentPath
          ? `${parentPath} / ${folder.name}`
          : folder.name;

        folders.push({
          token: folder.token,
          name: folder.name,
          path: currentPath,
        });

        // 递归获取子文件夹
        const childFolders = await fetchAllFolders(
          client,
          folder.token,
          currentPath
        );
        folders.push(...childFolders);
      }

      pageToken = res.data?.next_page_token;
    } catch {
      break;
    }
  } while (pageToken);

  return folders;
}

/**
 * 打印用户云空间文件夹列表到控制台
 */
async function logUserFolders(client: ReturnType<typeof getLarkClient>) {
  try {
    console.log("\n========== 飞书云空间文件夹列表 ==========");
    const folders = await fetchAllFolders(client);

    if (folders.length === 0) {
      console.log("未找到任何文件夹（云空间为空或没有访问权限）");
      console.log("\n可能的原因：");
      console.log("1. 飞书应用没有 'drive:drive:read' 权限");
      console.log("2. 应用未获得用户授权（需要用户安装应用并同意授权）");
      console.log("3. 应用是'自建应用'类型，只能访问应用自身的空间");
    } else {
      folders.sort((a, b) => (a.path || "").localeCompare(b.path || ""));
      console.log(`共找到 ${folders.length} 个文件夹：\n`);
      folders.forEach((folder) => {
        console.log(`  📁 ${folder.path}`);
        console.log(`     Token: ${folder.token}`);
        console.log("");
      });
    }

    const currentFolderToken = getFolderToken();
    if (currentFolderToken) {
      const found = folders.find((f) => f.token === currentFolderToken);
      if (found) {
        console.log(`✅ 当前配置的目标文件夹: ${found.path}`);
      } else {
        console.log(`⚠️ 当前配置的 LARK_FOLDER_TOKEN (${currentFolderToken}) 未在云空间中找到`);
        console.log("   文档将上传到云空间根目录");
      }
    } else {
      console.log("ℹ️ LARK_FOLDER_TOKEN 未配置，文档将上传到云空间根目录");
    }
    console.log("==========================================\n");
  } catch (error) {
    console.error("获取文件夹列表失败:", error);
  }
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

    // Get markdown: prefer stored markdown, fallback to converting from content
    let markdown: string;
    if (note.markdown) {
      markdown = note.markdown;
      console.log("[lark upload] Using stored markdown, length:", markdown.length);
    } else if (note.content) {
      markdown = serializeNoteToMarkdown(note.content, title);
      console.log("[lark upload] Serialized from content to markdown using Plate.js, length:", markdown.length);
    } else {
      markdown = `# ${title}\n`;
      console.log("[lark upload] Using title-only fallback");
    }

    const folderToken = getFolderToken();

    const client = getLarkClient();

    // 打印用户云空间文件夹列表
    await logUserFolders(client);

    // 1. Create a new Lark document
    console.log("[lark upload] Creating document with params:", {
      title,
      folderToken: folderToken || "(empty, will save to root)",
    });

    const createRes = await client.docx.document.create({
      data: {
        title,
        folder_token: folderToken || undefined,
      },
    });

    console.log("[lark upload] Create document response:", {
      code: createRes.code,
      msg: createRes.msg,
      data: createRes.data,
    });

    if (createRes.code !== 0) {
      console.error("[lark upload] Failed to create document:", {
        code: createRes.code,
        msg: createRes.msg,
        folderToken: folderToken || "(empty, will save to root)",
      });
      return NextResponse.json(
        { error: `创建飞书文档失败: ${createRes.msg}。请检查 LARK_FOLDER_TOKEN 是否正确（应以 fldcn 开头）` },
        { status: 500 }
      );
    }

    const documentId = createRes.data?.document?.document_id;
    console.log("[lark upload] Document created:", {
      documentId,
      title: createRes.data?.document?.title,
      revisionId: createRes.data?.document?.revision_id,
    });

    if (!documentId) {
      return NextResponse.json(
        { error: "创建飞书文档失败: 未返回文档ID" },
        { status: 500 }
      );
    }

    // 2. Convert markdown to Lark blocks using the convert API
    console.log("[lark upload] Starting markdown conversion, content length:", markdown.length);

    try {
      const convertRes = await client.docx.document.convert({
        data: {
          content_type: "markdown",
          content: markdown,
        },
      });

      console.log("[lark upload] Convert API response:", {
        code: convertRes.code,
        msg: convertRes.msg,
        blocksCount: convertRes.data?.blocks?.length || 0,
      });

      // 打印前几个 block 的详细信息用于调试
      if (convertRes.data?.blocks && convertRes.data.blocks.length > 0) {
        console.log("[lark upload] First 3 blocks sample:", JSON.stringify(convertRes.data.blocks.slice(0, 3), null, 2));
      }

      if (
        convertRes.code === 0 &&
        convertRes.data?.blocks &&
        convertRes.data.blocks.length > 0
      ) {
        // Filter out the page block (block_type 1) and add remaining blocks as children
        const childBlocks = convertRes.data.blocks.filter(
          (b: { block_type: number }) => b.block_type !== 1
        );

        console.log("[lark upload] Inserting blocks:", {
          totalBlocks: convertRes.data.blocks.length,
          childBlocks: childBlocks.length,
        });

        if (childBlocks.length > 0) {
          // 逐个插入 block 以保证顺序
          // 使用 index: -1 追加到末尾
          console.log("[lark upload] Inserting blocks one by one, total:", childBlocks.length);

          let successCount = 0;
          for (let i = 0; i < childBlocks.length; i++) {
            const block = childBlocks[i];

            const insertRes = await client.docx.documentBlockChildren.create({
              data: {
                children: [block],
                index: -1, // 追加到末尾
              },
              path: {
                document_id: documentId,
                block_id: documentId,
              },
            });

            if (insertRes.code === 0) {
              successCount++;
            } else {
              console.error(`[lark upload] Failed to insert block ${i}:`, {
                code: insertRes.code,
                msg: insertRes.msg,
                blockType: block.block_type,
              });
            }

            // 每 50 个 block 打印一次进度
            if ((i + 1) % 50 === 0) {
              console.log(`[lark upload] Progress: ${i + 1}/${childBlocks.length}`);
            }
          }

          console.log("[lark upload] Total blocks inserted:", successCount);
        }
      } else {
        console.log("[lark upload] Convert API returned no blocks, using fallback");
        // Fallback: insert markdown as plain text paragraphs
        await insertMarkdownAsText(client, documentId, markdown);
      }
    } catch (convertErr) {
      console.warn(
        "[lark upload] Convert API failed, falling back to plain text:",
        convertErr
      );
      await insertMarkdownAsText(client, documentId, markdown);
    }

    const documentUrl = `https://feishu.cn/docx/${documentId}`;
    console.log("[lark upload] Upload completed successfully:", { documentUrl });
    console.log("\n========== 重要提示 ==========");
    console.log("文档已创建，但可能位于应用维度空间，而非用户云空间。");
    console.log("如果文档未在云空间中看到，请检查：");
    console.log("1. 飞书应用权限是否包含 'docx:document' 和 'drive:drive' 权限");
    console.log("2. 应用是否已发布并获得用户授权");
    console.log("3. 尝试直接访问文档链接:", documentUrl);
    console.log("==============================\n");
    return NextResponse.json({ success: true, url: documentUrl });
  } catch (e) {
    console.error("[lark upload] Error:", e);
    return NextResponse.json(
      { error: "上传到飞书文档失败" },
      { status: 500 }
    );
  }
}

// Fallback: insert markdown content as plain text paragraphs
async function insertMarkdownAsText(
  client: ReturnType<typeof getLarkClient>,
  documentId: string,
  markdown: string
) {
  console.log("[lark upload] Using fallback: insertMarkdownAsText");

  const paragraphs = markdown.split(/\n\n+/).filter((p) => p.trim());
  console.log("[lark upload] Paragraphs to insert:", paragraphs.length);

  if (paragraphs.length === 0) {
    console.log("[lark upload] No paragraphs to insert");
    return;
  }

  const children = paragraphs.map((para) => {
    const trimmed = para.trim();

    // Detect heading levels
    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const headingText = headingMatch[2];
      // block_type: 3=heading1, 4=heading2, ..., 11=heading9
      const blockType = 2 + level;
      const headingKey = `heading${level}` as
        | "heading1"
        | "heading2"
        | "heading3"
        | "heading4"
        | "heading5"
        | "heading6";
      return {
        block_type: blockType,
        [headingKey]: {
          elements: [{ text_run: { content: headingText } }],
        },
      };
    }

    // Default: text block (block_type 2)
    return {
      block_type: 2,
      text: {
        elements: [{ text_run: { content: trimmed } }],
      },
    };
  });

  console.log("[lark upload] Inserting fallback blocks:", children.length);

  // 逐个插入 block 以保证顺序
  for (let i = 0; i < children.length; i++) {
    const block = children[i];

    const insertRes = await client.docx.documentBlockChildren.create({
      data: {
        children: [block as { block_type: number }],
        index: -1, // 追加到末尾
      },
      path: {
        document_id: documentId,
        block_id: documentId,
      },
    });

    if (insertRes.code !== 0) {
      console.error(`[lark upload] Fallback: Failed to insert block ${i}:`, {
        code: insertRes.code,
        msg: insertRes.msg,
      });
    }
  }

  console.log("[lark upload] Fallback total inserted:", children.length);
}
