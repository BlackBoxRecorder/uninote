/**
 * Markdown serialization utilities based on Turndown
 * Used both client-side (with Quill HTML) and server-side (with quill-delta-to-html)
 */

import TurndownService from 'turndown';

let turndownInstance: TurndownService | null = null;

/**
 * Get or create a configured Turndown instance
 */
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
 * Convert HTML string to Markdown
 */
export function htmlToMarkdown(html: string): string {
  if (!html || !html.trim()) return '';
  const td = getTurndown();
  return td.turndown(html);
}
