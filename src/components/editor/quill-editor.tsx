'use client';

import { useCallback, useEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import type Quill from 'quill';
import type DeltaType from 'quill-delta';

import { useEditorStore } from '@/stores/editor-store';
import type { QuillDeltaData } from '@/lib/content-utils';
import { registerCustomBlots, quillModules, QUILL_THEME } from '@/components/editor/quill-config';
import { htmlToMarkdown } from '@/components/editor/quill-markdown';

export function QuillEditor() {
  const {
    currentNoteId,
    initialContent,
    saveStatus,
    isLoadingContent,
    setSaveStatus,
    setCurrentContent,
    setMarkdownSerializer,
    setGetEditorHTML,
  } = useEditorStore();

  const editorRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const quillRef = useRef<Quill | null>(null);
  const baselineRef = useRef<QuillDeltaData | null>(null);
  const isInitializedRef = useRef(false);
  const prevNoteIdRef = useRef<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const DeltaClassRef = useRef<typeof DeltaType | null>(null);

  // Initialize Quill (dynamic import to avoid SSR)
  useEffect(() => {
    let mounted = true;

    async function initQuill() {
      if (quillRef.current || !editorRef.current) return;

      const QuillClass = (await import('quill')).default;
      const DeltaClass = (await import('quill-delta')).default;

      if (!mounted || !editorRef.current) return;

      // Register custom blots (HR)
      registerCustomBlots(QuillClass);

      DeltaClassRef.current = DeltaClass;

      const quill = new QuillClass(editorRef.current, {
        theme: QUILL_THEME,
        modules: quillModules,
        placeholder: '开始编写...',
      });

      quillRef.current = quill;

      // Listen for text changes
      quill.on('text-change', () => {
        if (!isInitializedRef.current) return;
        const currentNoteId = useEditorStore.getState().currentNoteId;
        if (!currentNoteId) return;

        const currentDelta = quill.getContents();
        const currentData: QuillDeltaData = { ops: currentDelta.ops };

        // Compare with baseline using Delta diff
        if (baselineRef.current && DeltaClassRef.current) {
          const baselineDelta = new DeltaClassRef.current(baselineRef.current.ops);
          const diff = baselineDelta.diff(currentDelta);
          if (diff.ops.length === 0) {
            setSaveStatus('saved');
            setCurrentContent(null);
            return;
          }
        }

        setSaveStatus('unsaved');
        setCurrentContent(currentData);
      });

      // If there's already initialContent, set it
      const state = useEditorStore.getState();
      if (state.initialContent && state.currentNoteId) {
        const delta = new DeltaClass(state.initialContent.ops);
        quill.setContents(delta, 'silent');
        baselineRef.current = state.initialContent;
        prevNoteIdRef.current = state.currentNoteId;
        requestAnimationFrame(() => {
          isInitializedRef.current = true;
        });
      }
    }

    initQuill();

    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle note switching
  useEffect(() => {
    if (!quillRef.current || !DeltaClassRef.current) return;
    if (currentNoteId === prevNoteIdRef.current) return;
    prevNoteIdRef.current = currentNoteId;

    isInitializedRef.current = false;
    const quill = quillRef.current;

    if (initialContent) {
      const delta = new DeltaClassRef.current(initialContent.ops);
      quill.setContents(delta, 'silent');

      // Clear undo/redo history
      quill.history.clear();

      baselineRef.current = initialContent;

      // Scroll to top
      if (containerRef.current) {
        containerRef.current.scrollTop = 0;
      }

      requestAnimationFrame(() => {
        isInitializedRef.current = true;
      });
    } else {
      baselineRef.current = null;
    }
  }, [currentNoteId, initialContent]);

  // Update baseline after save
  useEffect(() => {
    if (saveStatus === 'saved' && currentNoteId && quillRef.current) {
      const currentDelta = quillRef.current.getContents();
      baselineRef.current = { ops: JSON.parse(JSON.stringify(currentDelta.ops)) };
    }
  }, [saveStatus, currentNoteId]);

  // Set up markdown serializer and HTML getter
  const getMarkdown = useCallback(() => {
    if (!quillRef.current) return '';
    const html = quillRef.current.getSemanticHTML();
    return htmlToMarkdown(html);
  }, []);

  const getHTML = useCallback(() => {
    if (!quillRef.current) return '';
    return quillRef.current.getSemanticHTML();
  }, []);

  useEffect(() => {
    setMarkdownSerializer(getMarkdown);
    setGetEditorHTML(getHTML);
    return () => {
      setMarkdownSerializer(null);
      setGetEditorHTML(null);
    };
  }, [getMarkdown, getHTML, setMarkdownSerializer, setGetEditorHTML]);

  return (
    <div ref={containerRef} className="relative h-full overflow-y-auto">
      {!currentNoteId && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background text-muted-foreground">
          选择或创建一篇笔记开始编辑
        </div>
      )}
      {isLoadingContent && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}
      <div ref={toolbarRef} />
      <div ref={editorRef} />
    </div>
  );
}
