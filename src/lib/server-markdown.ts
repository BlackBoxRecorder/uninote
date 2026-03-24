/**
 * Server-side markdown serialization
 * Converts Quill Delta JSON to Markdown using quill-delta-to-html + Turndown
 */

import { QuillDeltaToHtmlConverter } from 'quill-delta-to-html';
import TurndownService from 'turndown';

let turndownInstance: TurndownService | null = null;

function getTurndown(): TurndownService {
  if (turndownInstance) return turndownInstance;

  turndownInstance = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    emDelimiter: '*',
    bulletListMarker: '-',
    hr: '---',
  });

  // Strikethrough support
  turndownInstance.addRule('strikethrough', {
    filter: ['del', 's'],
    replacement(content) {
      return `~~${content}~~`;
    },
  });

  // Underline - just output the text (markdown doesn't have underline)
  turndownInstance.addRule('underline', {
    filter: ['u'],
    replacement(content) {
      return content;
    },
  });

  return turndownInstance;
}

/**
 * Convert Quill Delta JSON content to Markdown string
 * @param content - JSON string of Quill Delta
 * @returns Markdown string
 */
export function serializeToMarkdown(content: string): string {
  try {
    const parsed = typeof content === 'string' ? JSON.parse(content) : content;

    if (!parsed || !Array.isArray(parsed.ops) || parsed.ops.length === 0) {
      return '';
    }

    // Convert Delta to HTML
    const converter = new QuillDeltaToHtmlConverter(parsed.ops, {
      multiLineParagraph: false,
    });
    const html = converter.convert();

    if (!html || !html.trim()) return '';

    // Convert HTML to Markdown
    const td = getTurndown();
    return td.turndown(html);
  } catch (error) {
    console.error('[server-markdown] Failed to serialize content:', error);
    return '';
  }
}

/**
 * Convert Quill Delta JSON content to Markdown with title prefix
 * @param content - JSON string of Quill Delta
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
