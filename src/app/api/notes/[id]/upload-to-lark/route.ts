import { NextRequest, NextResponse } from "next/server";
import { getDatabase } from "@/db";
import { notes } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getLarkClient, isLarkConfigured, getFolderToken } from "@/lib/lark";

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

    const markdown = note.markdown || `# ${note.title}\n`;
    const title = note.title || "Untitled";
    const folderToken = getFolderToken();

    const client = getLarkClient();

    // 1. Create a new Lark document
    const createRes = await client.docx.document.create({
      data: {
        title,
        folder_token: folderToken || undefined,
      },
    });

    if (createRes.code !== 0) {
      console.error("[lark upload] Failed to create document:", createRes.msg);
      return NextResponse.json(
        { error: `创建飞书文档失败: ${createRes.msg}` },
        { status: 500 }
      );
    }

    const documentId = createRes.data?.document?.document_id;
    if (!documentId) {
      return NextResponse.json(
        { error: "创建飞书文档失败: 未返回文档ID" },
        { status: 500 }
      );
    }

    // 2. Convert markdown to Lark blocks using the convert API
    try {
      const convertRes = await client.docx.document.convert({
        data: {
          content_type: "markdown",
          content: markdown,
        },
      });

      if (
        convertRes.code === 0 &&
        convertRes.data?.blocks &&
        convertRes.data.blocks.length > 0
      ) {
        // Filter out the page block (block_type 1) and add remaining blocks as children
        const childBlocks = convertRes.data.blocks.filter(
          (b: { block_type: number }) => b.block_type !== 1
        );

        if (childBlocks.length > 0) {
          await client.docx.documentBlockChildren.create({
            data: {
              children: childBlocks,
              index: 0,
            },
            path: {
              document_id: documentId,
              block_id: documentId,
            },
          });
        }
      } else {
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
  const paragraphs = markdown.split(/\n\n+/).filter((p) => p.trim());
  if (paragraphs.length === 0) return;

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

  await client.docx.documentBlockChildren.create({
    data: {
      children: children as Array<{ block_type: number }>,
      index: 0,
    },
    path: {
      document_id: documentId,
      block_id: documentId,
    },
  });
}
