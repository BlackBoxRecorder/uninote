'use client';

import type { DropdownMenuProps } from '@radix-ui/react-dropdown-menu';
import {
  DownloadIcon,
  FileCodeIcon,
  FileTextIcon,
  FileTypeIcon,
} from 'lucide-react';
import { useEditorRef } from 'platejs/react';
import * as React from 'react';
import { toast } from 'sonner';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useEditorStore } from '@/stores/editor-store';

import { ToolbarButton } from './toolbar';

// Dynamic imports to avoid SSR issues
const loadDocxLibs = async () => {
  const [docx, remark, remarkGfm, remarkDocx] = await Promise.all([
    import('docx'),
    import('remark'),
    import('remark-gfm'),
    import('remark-docx'),
  ]);
  return { docx, remark, remarkGfm, remarkDocx };
};

export function ExportToolbarButton(props: DropdownMenuProps) {
  const editor = useEditorRef();
  const [open, setOpen] = React.useState(false);
  const { currentNoteId } = useEditorStore();

  const handleExportMarkdown = React.useCallback(async () => {
    if (!currentNoteId) {
      toast.error('请先选择一篇笔记');
      return;
    }

    try {
      // Get the current editor content
      const value = editor.children;

      // Serialize to markdown using the editor's markdown API
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const markdown = (editor.api as any).markdown.serialize({ value });

      // Create a blob and download
      const blob = new Blob([markdown], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);

      // Use note ID as filename base (title may contain special chars)
      const filename = `note-${currentNoteId.slice(0, 8)}.md`;

      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success('Markdown 导出成功');
    } catch (error) {
      console.error('Export markdown error:', error);
      toast.error('导出 Markdown 失败');
    }

    setOpen(false);
  }, [editor, currentNoteId]);

  const handleExportHTML = React.useCallback(async () => {
    if (!currentNoteId) {
      toast.error('请先选择一篇笔记');
      return;
    }

    try {
      // Fetch the note data to get title
      const response = await fetch(`/api/notes/${currentNoteId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch note');
      }
      const note = await response.json();

      // Get the current editor content
      const value = editor.children;

      // Serialize to markdown first
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const markdown = (editor.api as any).markdown.serialize({ value });

      // Convert markdown to HTML (simple conversion)
      const htmlContent = markdown
        .replace(/^### (.*$)/gim, '<h3>$1</h3>')
        .replace(/^## (.*$)/gim, '<h2>$1</h2>')
        .replace(/^# (.*$)/gim, '<h1>$1</h1>')
        .replace(/\*\*(.*)\*\*/gim, '<strong>$1</strong>')
        .replace(/\*(.*)\*/gim, '<em>$1</em>')
        .replace(/`(.*?)`/gim, '<code>$1</code>')
        .replace(/```[\s\S]*?```/gim, (match: string) => {
          const code = match.replace(/```/g, '').trim();
          return `<pre><code>${code}</code></pre>`;
        })
        .replace(/\n/gim, '<br />');

      // Create a complete HTML document
      const fullHtml = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${note.title || 'Exported Note'}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      line-height: 1.6;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
      color: #333;
    }
    h1, h2, h3, h4, h5, h6 { margin-top: 24px; margin-bottom: 16px; }
    h1 { font-size: 2em; border-bottom: 1px solid #eee; padding-bottom: 0.3em; }
    h2 { font-size: 1.5em; border-bottom: 1px solid #eee; padding-bottom: 0.3em; }
    h3 { font-size: 1.25em; }
    p { margin-bottom: 16px; }
    code {
      background-color: #f4f4f4;
      padding: 2px 6px;
      border-radius: 3px;
      font-family: monospace;
      font-size: 0.9em;
    }
    pre {
      background-color: #f4f4f4;
      padding: 16px;
      border-radius: 6px;
      overflow-x: auto;
    }
    pre code {
      background-color: transparent;
      padding: 0;
    }
    blockquote {
      border-left: 4px solid #ddd;
      margin: 0;
      padding-left: 16px;
      color: #666;
    }
    img { max-width: 100%; height: auto; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background-color: #f4f4f4; }
    ul, ol { margin-bottom: 16px; padding-left: 2em; }
    li { margin-bottom: 4px; }
  </style>
</head>
<body>
${htmlContent}
</body>
</html>`;

      // Create a blob and download
      const blob = new Blob([fullHtml], { type: 'text/html' });
      const url = URL.createObjectURL(blob);

      const filename = `${note.title || 'note'}.html`;

      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success('HTML 导出成功');
    } catch (error) {
      console.error('Export HTML error:', error);
      toast.error('导出 HTML 失败');
    }

    setOpen(false);
  }, [editor, currentNoteId]);

  const handleExportDocx = React.useCallback(async () => {
    if (!currentNoteId) {
      toast.error('请先选择一篇笔记');
      return;
    }

    try {
      // Fetch the note data to get title
      const response = await fetch(`/api/notes/${currentNoteId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch note');
      }
      const note = await response.json();

      // Get the current editor content
      const value = editor.children;

      // Serialize to markdown first
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const markdown = (editor.api as any).markdown.serialize({ value });

      // Load libraries dynamically
      const { remark, remarkGfm, remarkDocx } = await loadDocxLibs();

      // Use remark-docx to convert markdown to docx
      const processor = remark.remark()
        .use(remarkGfm.default)
        .use(remarkDocx.default, {
          output: 'blob',
          title: note.title || 'Exported Note',
        });

      const result = await processor.process(markdown);
      // remark-docx returns ArrayBuffer, need to wrap in Blob
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const arrayBuffer = await (result.result as any) as ArrayBuffer;
      const blob = new Blob([arrayBuffer], {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });

      // Download
      const url = URL.createObjectURL(blob);
      const filename = `${note.title || 'note'}.docx`;

      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success('Word 文档导出成功');
    } catch (error) {
      console.error('Export DOCX error:', error);
      toast.error('导出 Word 文档失败');
    }

    setOpen(false);
  }, [editor, currentNoteId]);

  return (
    <DropdownMenu modal={false} onOpenChange={setOpen} open={open} {...props}>
      <DropdownMenuTrigger asChild>
        <ToolbarButton pressed={open} tooltip="导出">
          <DownloadIcon />
        </ToolbarButton>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="start"
        className="ignore-click-outside/toolbar flex max-h-125 min-w-45 flex-col overflow-y-auto"
      >
        <DropdownMenuGroup>
          <DropdownMenuItem onSelect={handleExportMarkdown}>
            <FileTextIcon />
            导出为 Markdown
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={handleExportHTML}>
            <FileCodeIcon />
            导出为 HTML
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={handleExportDocx}>
            <FileTypeIcon />
            导出为 Word
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
