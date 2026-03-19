'use client';

import { useCallback, useEffect, useRef } from 'react';
import { type Value } from 'platejs';
import { Plate, usePlateEditor } from 'platejs/react';
import { Loader2 } from 'lucide-react';

import { EditorKit } from '@/components/editor/editor-kit';
import { Editor, EditorContainer } from '@/components/ui/editor';
import { useEditorStore } from '@/stores/editor-store';

export function PlateEditor() {
  const {
    currentNoteId,
    initialContent,
    saveStatus,
    isLoadingContent,
    setSaveStatus,
    setCurrentContent,
  } = useEditorStore();

  const baselineContentRef = useRef<Value | null>(null);
  const isInitializedRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const prevNoteIdRef = useRef<string | null>(null);

  const editor = usePlateEditor({
    plugins: EditorKit,
    value: initialContent ?? undefined,
  });

  const handleChange = useCallback(
    ({ value }: { value: Value }) => {
      if (!currentNoteId) return;
      if (!isInitializedRef.current) return;

      const baselineStr = JSON.stringify(baselineContentRef.current);
      const currentStr = JSON.stringify(value);

      if (baselineStr !== currentStr) {
        setSaveStatus('unsaved');
        setCurrentContent(value);
      } else {
        setSaveStatus('saved');
        setCurrentContent(null);
      }
    },
    [currentNoteId, setSaveStatus, setCurrentContent]
  );

  // Reset editor when note changes
  useEffect(() => {
    if (currentNoteId === prevNoteIdRef.current) return;
    prevNoteIdRef.current = currentNoteId;

    isInitializedRef.current = false;

    if (initialContent) {
      editor.tf.setValue(initialContent);

      // Clear undo/redo history to prevent cross-note undo
      if (editor.history) {
        editor.history.undos = [];
        editor.history.redos = [];
      }

      // Deselect to avoid stale selection referencing old content
      if (editor.selection) {
        editor.selection = null;
      }

      baselineContentRef.current = initialContent;

      // Scroll editor container to top
      if (containerRef.current) {
        containerRef.current.scrollTop = 0;
      }

      requestAnimationFrame(() => {
        isInitializedRef.current = true;
      });
    } else {
      baselineContentRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentNoteId, initialContent]);

  // Update baseline after save
  useEffect(() => {
    if (saveStatus === 'saved' && currentNoteId) {
      baselineContentRef.current = editor.children as Value;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saveStatus]);

  return (
    <Plate editor={editor} onChange={handleChange}>
      <div className="relative h-full">
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
        <EditorContainer ref={containerRef}>
          <Editor variant="default" />
        </EditorContainer>
      </div>
    </Plate>
  );
}
