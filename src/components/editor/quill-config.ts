/**
 * Quill 2.x editor configuration
 * Toolbar, modules, and custom blot definitions
 */

import type Quill from 'quill';

/**
 * Register custom Divider (HR) blot.
 * Must be called before creating any Quill instance.
 */
export function registerCustomBlots(QuillClass: typeof Quill) {
  const BlockEmbed = QuillClass.import('blots/block/embed') as typeof import('parchment').EmbedBlot;

  class DividerBlot extends BlockEmbed {
    static blotName = 'divider';
    static tagName = 'hr';

    static create() {
      const node = super.create() as HTMLElement;
      return node;
    }

    static value() {
      return true;
    }
  }

  QuillClass.register(DividerBlot);
}

/**
 * Toolbar configuration for Quill Snow theme
 */
export const toolbarOptions = [
  [{ header: [1, 2, 3, false] }],
  ['bold', 'italic', 'underline', 'strike'],
  ['blockquote', 'code-block'],
  [{ list: 'ordered' }, { list: 'bullet' }],
  ['link', 'image'],
  ['divider'],
  ['clean'],
];

/**
 * Quill module configuration
 */
export const quillModules = {
  toolbar: {
    container: toolbarOptions,
    handlers: {
      divider(this: { quill: Quill }) {
        const range = this.quill.getSelection(true);
        this.quill.insertText(range.index, '\n', 'user');
        this.quill.insertEmbed(range.index + 1, 'divider', true, 'user');
        this.quill.setSelection(range.index + 2, 0, 'silent');
      },
    },
  },
};

/**
 * Quill theme
 */
export const QUILL_THEME = 'snow';
