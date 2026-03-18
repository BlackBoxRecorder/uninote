'use client';

import { useCallback, useEffect, useRef } from 'react';
import { type Value } from 'platejs';
import { Plate, usePlateEditor } from 'platejs/react';

import { EditorKit } from '@/components/editor/editor-kit';
import { Editor, EditorContainer } from '@/components/ui/editor';
import { useEditorStore } from '@/stores/editor-store';

export function PlateEditor() {
  const {
    currentNoteId,
    initialContent,
    saveStatus,
    setSaveStatus,
    setCurrentContent,
  } = useEditorStore();

  // 用于跟踪基准内容（初始内容或保存后的内容），比较是否真的有修改
  const baselineContentRef = useRef<Value | null>(null);
  // 用于标记编辑器是否已完成初始化，避免初始化时触发虚假的 unsaved 状态
  const isInitializedRef = useRef(false);

  const editor = usePlateEditor({
    plugins: EditorKit,
    value: initialContent ?? undefined,
  });

  const handleChange = useCallback(
    ({ value }: { value: Value }) => {
      if (!currentNoteId) return;

      // 如果编辑器还未完成初始化，不处理 change 事件
      if (!isInitializedRef.current) return;

      // 比较内容是否真的改变了（与基准内容比较）
      const baselineStr = JSON.stringify(baselineContentRef.current);
      const currentStr = JSON.stringify(value);

      if (baselineStr !== currentStr) {
        setSaveStatus('unsaved');
        setCurrentContent(value);
      } else {
        // 内容与基准内容相同，确保状态是 saved
        setSaveStatus('saved');
        setCurrentContent(null);
      }
    },
    [currentNoteId, setSaveStatus, setCurrentContent]
  );

  // Reset editor when note changes
  useEffect(() => {
    // 先标记为未初始化
    isInitializedRef.current = false;

    if (initialContent) {
      editor.tf.setValue(initialContent);
      baselineContentRef.current = initialContent;
      // 延迟标记为已初始化，确保编辑器状态稳定
      requestAnimationFrame(() => {
        isInitializedRef.current = true;
      });
    } else {
      baselineContentRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentNoteId]);

  // 保存成功后更新基准内容
  useEffect(() => {
    if (saveStatus === 'saved' && currentNoteId) {
      // 获取当前编辑器内容作为新的基准
      baselineContentRef.current = editor.children as Value;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saveStatus]);

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
