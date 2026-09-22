import { useStore } from '@nanostores/react';
import { chatStore } from '~/lib/stores/chat';
import { workbenchStore } from '~/lib/stores/workbench';
import { classNames } from '~/utils/classNames';

export function WorkbenchViewToggle() {
  const chat = useStore(chatStore);
  const showWorkbench = useStore(workbenchStore.showWorkbench);
  const previews = useStore(workbenchStore.previews);
  const hasPreview = previews.length > 0;

  // Only show when in a chat session or if workbench has been opened
  if (!chat.started && !showWorkbench) {
    return null;
  }

  return (
    <button
      onClick={() => {
        workbenchStore.showWorkbench.set(!showWorkbench);
      }}
      className={classNames(
        'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer select-none border shadow-xs',
        showWorkbench
          ? 'bg-zinc-100 dark:bg-[#1a1a17] text-zinc-700 dark:text-[#f2f0e9] border-zinc-200 dark:border-[#2a2a25] hover:bg-zinc-200/80 dark:hover:bg-[#22221e]'
          : 'bg-[#ff7a1a]/15 text-[#ff7a1a] border-[#ff7a1a]/40 hover:bg-[#ff7a1a]/25 animate-fade-in',
      )}
      title={showWorkbench ? 'Ocultar panel de vista (Código / Preview)' : 'Mostrar panel de vista (Código / Preview)'}
    >
      <div
        className={classNames(
          'text-base',
          showWorkbench
            ? 'i-ph:sidebar-simple-reverse-duotone'
            : 'i-ph:sidebar-simple-reverse-fill text-[#ff7a1a]',
        )}
      />
      <span>{showWorkbench ? 'Ocultar Vista' : 'Mostrar Vista'}</span>
      {hasPreview && !showWorkbench && (
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.8)]" />
      )}
    </button>
  );
}
