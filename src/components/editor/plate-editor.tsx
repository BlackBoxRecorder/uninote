'use client';

import { useCallback, useEffect, useRef } from 'react';
import { type Value } from 'platejs';
import { serializeMd } from '@platejs/markdown';
import { Plate, usePlateEditor } from 'platejs/react';

import { EditorKit } from '@/components/editor/editor-kit';
import { Editor, EditorContainer } from '@/components/ui/editor';
import { useEditorStore } from '@/stores/editor-store';

export function PlateEditor() {
  const {
    currentNoteId,
    initialContent,
    setSaveStatus,
    setWordCount,
  } = useEditorStore();

  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const isSavingRef = useRef(false);

  const editor = usePlateEditor({
    plugins: EditorKit,
    value: initialContent ?? undefined,
  });

  const saveContent = useCallback(
    async (value: Value) => {
      if (!currentNoteId || isSavingRef.current) return;

      isSavingRef.current = true;
      setSaveStatus('saving');

      try {
        const content = JSON.stringify(value);
        const markdown = serializeMd(editor);
        const text = editor.api.string([]);
        const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;

        const res = await fetch(`/api/notes/${currentNoteId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content, markdown, wordCount }),
        });

        if (res.ok) {
          setSaveStatus('saved');
          setWordCount(wordCount);
        } else {
          setSaveStatus('error');
        }
      } catch {
        setSaveStatus('error');
      } finally {
        isSavingRef.current = false;
      }
    },
    [currentNoteId, editor, setSaveStatus, setWordCount]
  );

  const handleChange = useCallback(
    ({ value }: { value: Value }) => {
      if (!currentNoteId) return;

      setSaveStatus('unsaved');

      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }

      saveTimerRef.current = setTimeout(() => {
        saveContent(value);
      }, 1000);
    },
    [currentNoteId, saveContent, setSaveStatus]
  );

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, []);

  // Reset editor when note changes
  useEffect(() => {
    if (initialContent) {
      editor.tf.setValue(initialContent);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentNoteId]);

  if (!currentNoteId) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        选择或创建一篇笔记开始编辑
      </div>
    );
  }

  return (
    <Plate editor={editor} onChange={handleChange}>
      <EditorContainer>
        <Editor variant="default" />
      </EditorContainer>
    </Plate>
  );
}
