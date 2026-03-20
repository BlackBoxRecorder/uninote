/**
 * Server-side markdown serialization using Plate.js
 * This module creates a server-side editor to convert Plate JSON content to Markdown
 */

import { createSlateEditor } from 'platejs';
import { MarkdownPlugin, remarkMdx, remarkMention } from '@platejs/markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';

// Base plugins for markdown serialization (no React components needed)
import {
  BaseBoldPlugin,
  BaseCodePlugin,
  BaseItalicPlugin,
  BaseStrikethroughPlugin,
  BaseSubscriptPlugin,
  BaseSuperscriptPlugin,
  BaseUnderlinePlugin,
  BaseHighlightPlugin,
  BaseH1Plugin,
  BaseH2Plugin,
  BaseH3Plugin,
  BaseH4Plugin,
  BaseH5Plugin,
  BaseH6Plugin,
  BaseBlockquotePlugin,
  BaseHorizontalRulePlugin,
} from '@platejs/basic-nodes';
import { BaseCodeBlockPlugin } from '@platejs/code-block';
import { BaseLinkPlugin } from '@platejs/link';
import { BaseListPlugin } from '@platejs/list';
import { BaseImagePlugin } from '@platejs/media';

/**
 * Server-side plugins for markdown serialization
 * These are the base plugins without React components
 */
const serverPlugins = [
  // Marks
  BaseBoldPlugin,
  BaseItalicPlugin,
  BaseUnderlinePlugin,
  BaseCodePlugin,
  BaseStrikethroughPlugin,
  BaseSubscriptPlugin,
  BaseSuperscriptPlugin,
  BaseHighlightPlugin,

  // Blocks
  BaseH1Plugin,
  BaseH2Plugin,
  BaseH3Plugin,
  BaseH4Plugin,
  BaseH5Plugin,
  BaseH6Plugin,
  BaseBlockquotePlugin,
  BaseHorizontalRulePlugin,

  // Code block
  BaseCodeBlockPlugin,

  // Link
  BaseLinkPlugin,

  // List
  BaseListPlugin,

  // Image
  BaseImagePlugin,

  // Markdown plugin with remark plugins
  MarkdownPlugin.configure({
    options: {
      remarkPlugins: [remarkMath, remarkGfm, remarkMdx, remarkMention],
    },
  }),
];

/**
 * Convert Plate JSON content to Markdown string
 * @param content - JSON string or parsed array of Plate nodes
 * @returns Markdown string
 */
export function serializeToMarkdown(content: string): string {
  try {
    // Parse content if it's a string
    const nodes = typeof content === 'string' ? JSON.parse(content) : content;

    if (!Array.isArray(nodes) || nodes.length === 0) {
      return '';
    }

    // Create a server-side editor
    const editor = createSlateEditor({
      plugins: serverPlugins,
      value: nodes,
    });

    // Serialize to markdown
    const markdown = editor.api.markdown.serialize({ value: nodes });

    return markdown;
  } catch (error) {
    console.error('[server-markdown] Failed to serialize content:', error);
    return '';
  }
}

/**
 * Convert Plate JSON content to Markdown with title prefix
 * @param content - JSON string or parsed array of Plate nodes
 * @param title - Note title to add as H1 heading
 * @returns Markdown string with title
 */
export function serializeNoteToMarkdown(content: string, title: string): string {
  const bodyMarkdown = serializeToMarkdown(content);

  // Add title as H1 if not already present
  const titleHeading = `# ${title}`;

  // Check if the first line is already a heading with the same title
  const lines = bodyMarkdown.split('\n');
  const firstLine = lines[0] || '';

  // If the content starts with a heading that matches the title, don't add another
  if (firstLine === titleHeading || firstLine === `# ${title}`) {
    return bodyMarkdown;
  }

  // Add title heading at the beginning
  if (bodyMarkdown.trim()) {
    return `${titleHeading}\n\n${bodyMarkdown}`;
  }

  return titleHeading;
}
