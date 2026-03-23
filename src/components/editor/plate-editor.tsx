'use client';

import { useCallback, useEffect, useRef } from 'react';
import { type Value } from 'platejs';
import { Plate, usePlateEditor } from 'platejs/react';
import { Loader2 } from 'lucide-react';

import { EditorKit } from '@/components/editor/editor-kit';
import { Editor, EditorContainer } from '@/components/ui/editor';
import { useEditorStore } from '@/stores/editor-store';

/**
 * Fast comparison of two editor values without JSON.stringify.
 * Returns true if values are structurally equal.
 */
function isEqualValue(a: Value | null, b: Value | null): boolean {
  // Fast path: same reference
  if (a === b) return true;
  // Fast path: one is null
  if (!a || !b) return false;
  // Fast path: different lengths
  if (a.length !== b.length) return false;

  // Compare each node recursively
  for (let i = 0; i < a.length; i++) {
    if (!isEqualNode(a[i], b[i])) return false;
  }
  return true;
}

function isEqualNode(a: unknown, b: unknown): boolean {
  // Primitive comparison
  if (typeof a !== 'object' || typeof b !== 'object') return a === b;
  if (a === null || b === null) return a === b;

  const aObj = a as Record<string, unknown>;
  const bObj = b as Record<string, unknown>;

  // Compare text nodes
  if ('text' in aObj && 'text' in bObj) {
    return aObj.text === bObj.text;
  }

  // Compare type
  if (aObj.type !== bObj.type) return false;

  // Compare children recursively
  const aChildren = aObj.children as unknown[] | undefined;
  const bChildren = bObj.children as unknown[] | undefined;

  if (aChildren && bChildren) {
    if (aChildren.length !== bChildren.length) return false;
    for (let i = 0; i < aChildren.length; i++) {
      if (!isEqualNode(aChildren[i], bChildren[i])) return false;
    }
  } else if (aChildren !== bChildren) {
    return false;
  }

  return true;
}

export function PlateEditor() {
  const {
    currentNoteId,
    initialContent,
    saveStatus,
    isLoadingContent,
    setSaveStatus,
    setCurrentContent,
    setMarkdownSerializer,
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

      // Use fast comparison instead of JSON.stringify
      if (!isEqualValue(value, baselineContentRef.current)) {
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
      // Deep clone editor.children to avoid reference issues
      baselineContentRef.current = JSON.parse(JSON.stringify(editor.children)) as Value;
    }
  }, [saveStatus, currentNoteId, editor]);

  // Set up markdown serializer
  useEffect(() => {
    const serializer = (value: Value) => {
      return editor.api.markdown.serialize({ value });
    };
    setMarkdownSerializer(serializer);
    return () => setMarkdownSerializer(null);
  }, [editor, setMarkdownSerializer]);

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
