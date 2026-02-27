import { useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import StarterKit from '@tiptap/starter-kit';
import { Bold, Italic, List, ListOrdered } from 'lucide-react';

type RichTextEditorProps = {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
};

export default function RichTextEditor({ value, onChange, placeholder }: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [StarterKit],
    content: value || '',
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'rich-editor focus:outline-none',
      },
    },
  });

  // Sync value when changed externally (e.g. product selected) but not while user is typing
  useEffect(() => {
    if (editor && !editor.isFocused) {
      const current = editor.getHTML();
      if (current !== value) {
        editor.commands.setContent(value || '');
      }
    }
  }, [value, editor]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      editor?.destroy();
    };
  }, [editor]);

  return (
    <div className="relative w-full border border-gray-200 rounded-lg focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/20 transition bg-white">
      {editor && (
        <BubbleMenu
          editor={editor}
          className="flex items-center gap-0.5 bg-gray-900 rounded-lg px-1.5 py-1 shadow-elevated z-50"
        >
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              editor.chain().focus().toggleBold().run();
            }}
            className={`p-1 rounded transition ${editor.isActive('bold') ? 'bg-white/25 text-white' : 'text-white/80 hover:bg-white/15 hover:text-white'}`}
            title="Fett (Ctrl+B)"
          >
            <Bold size={13} />
          </button>
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              editor.chain().focus().toggleItalic().run();
            }}
            className={`p-1 rounded transition ${editor.isActive('italic') ? 'bg-white/25 text-white' : 'text-white/80 hover:bg-white/15 hover:text-white'}`}
            title="Kursiv (Ctrl+I)"
          >
            <Italic size={13} />
          </button>
          <div className="w-px h-3.5 bg-white/25 mx-0.5" />
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              editor.chain().focus().toggleBulletList().run();
            }}
            className={`p-1 rounded transition ${editor.isActive('bulletList') ? 'bg-white/25 text-white' : 'text-white/80 hover:bg-white/15 hover:text-white'}`}
            title="Aufzählungsliste"
          >
            <List size={13} />
          </button>
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              editor.chain().focus().toggleOrderedList().run();
            }}
            className={`p-1 rounded transition ${editor.isActive('orderedList') ? 'bg-white/25 text-white' : 'text-white/80 hover:bg-white/15 hover:text-white'}`}
            title="Nummerierte Liste"
          >
            <ListOrdered size={13} />
          </button>
        </BubbleMenu>
      )}

      <div className="relative px-3 py-2">
        {editor?.isEmpty && placeholder && (
          <span className="absolute top-2 left-3 text-sm text-gray-400 pointer-events-none select-none z-10">
            {placeholder}
          </span>
        )}
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
