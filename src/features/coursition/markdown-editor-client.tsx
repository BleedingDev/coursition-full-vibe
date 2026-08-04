import {
  BlockTypeSelect,
  BoldItalicUnderlineToggles,
  CreateLink,
  InsertThematicBreak,
  ListsToggle,
  MDXEditor,
  Separator,
  UndoRedo,
  codeBlockPlugin,
  headingsPlugin,
  imagePlugin,
  linkDialogPlugin,
  linkPlugin,
  listsPlugin,
  markdownShortcutPlugin,
  quotePlugin,
  tablePlugin,
  thematicBreakPlugin,
  toolbarPlugin,
} from '@mdxeditor/editor';
import type { MDXEditorMethods } from '@mdxeditor/editor';
import { useEffect, useRef } from 'react';
import type { MarkdownEditorClientProps } from './markdown-editor-client.types';

const SourceMarkdownToolbarContents = () => (
  <>
    <UndoRedo />
    <Separator />
    <BlockTypeSelect />
    <BoldItalicUnderlineToggles />
    <ListsToggle />
    <CreateLink />
    <InsertThematicBreak />
  </>
);

const MarkdownEditorClient = ({
  onChange,
  placeholder,
  readOnly = false,
  value,
}: MarkdownEditorClientProps) => {
  const editorRef = useRef<MDXEditorMethods>(null);
  useEffect(() => {
    const editor = editorRef.current;
    if (editor !== null && editor.getMarkdown() !== value) {
      editor.setMarkdown(value);
    }
  }, [value]);

  const plugins = [
    headingsPlugin(),
    listsPlugin(),
    quotePlugin(),
    linkPlugin(),
    linkDialogPlugin(),
    codeBlockPlugin(),
    imagePlugin({
      disableImageResize: true,
      disableImageSettingsButton: true,
    }),
    tablePlugin(),
    thematicBreakPlugin(),
    markdownShortcutPlugin(),
    ...(readOnly
      ? []
      : [
          toolbarPlugin({
            toolbarContents: SourceMarkdownToolbarContents,
          }),
        ]),
  ];

  return (
    <MDXEditor
      ref={editorRef}
      className={`coursition-mdx-editor ${readOnly ? 'coursition-mdx-editor--readonly' : ''}`}
      contentEditableClassName={`coursition-mdx-editor-content ${
        readOnly ? 'coursition-mdx-editor-content--readonly' : ''
      }`}
      markdown={value}
      onChange={(markdown) => {
        if (!readOnly) {
          onChange?.(markdown);
        }
      }}
      placeholder={placeholder}
      plugins={plugins}
      readOnly={readOnly}
      spellCheck
      trim={false}
    />
  );
};

export default MarkdownEditorClient;
