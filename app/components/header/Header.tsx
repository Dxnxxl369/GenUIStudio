import { useStore } from '@nanostores/react';
import { ClientOnly } from 'remix-utils/client-only';
import { chatStore } from '~/lib/stores/chat';
import { classNames } from '~/utils/classNames';
import { HeaderActionButtons } from './HeaderActionButtons.client';
import { WorkbenchViewToggle } from './WorkbenchViewToggle.client';
import { ChatDescription } from '~/lib/persistence/ChatDescription.client';
import { UserPlanBadge } from '~/components/saas/UserPlanBadge';

import { isSidebarOpen, toggleSidebar } from '~/lib/stores/sidebarStore';

export function Header() {
  const chat = useStore(chatStore);
  const sidebarOpen = useStore(isSidebarOpen);

  return (
    <header className="flex items-center justify-between px-6 py-3 border-b border-zinc-200 dark:border-[#2a2a25] bg-white dark:bg-[#0a0a09] select-none shrink-0 z-20 transition-colors">
      <div className="flex items-center gap-2.5">
        {/* GenUI Studio Logo & Brand Link */}
        <a
          href="/landing"
          className="flex items-center gap-2 mr-1 hover:opacity-90 transition group shrink-0"
          title="GenUI Studio • Ir a la página informativa"
        >
          <img
            src="/logo-genui.png"
            alt="GenUI Studio Logo"
            className="w-7 h-7 rounded-lg object-cover shadow-sm ring-1 ring-zinc-300 dark:ring-[#2a2a25] group-hover:ring-[#ff7a1a] transition"
          />
          <span className="font-bold text-sm tracking-tight text-zinc-900 dark:text-[#f2f0e9] hidden xl:inline">
            GenUI<span className="text-[#ff7a1a] font-normal ml-0.5">Studio</span>
          </span>
        </a>

        {/* Separator */}
        <span className="text-zinc-300 dark:text-[#2a2a25] hidden xl:inline">|</span>

        {/* Sidebar toggle button (Chat history drawer) */}
        <button
          data-sidebar-toggle
          onClick={() => toggleSidebar()}
          className={classNames(
            'p-1.5 rounded-lg transition cursor-pointer flex items-center justify-center border',
            sidebarOpen
              ? 'bg-[#ff7a1a]/15 text-[#ff7a1a] border-[#ff7a1a]/30'
              : 'text-zinc-600 dark:text-[#9a988e] hover:text-zinc-900 dark:hover:text-[#f2f0e9] hover:bg-zinc-100 dark:hover:bg-[#131311] border-transparent',
          )}
          title={sidebarOpen ? 'Cerrar historial de chats' : 'Abrir historial de chats'}
        >
          <div className="i-ph:sidebar-simple-duotone text-lg" />
        </button>

        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 text-[13px] text-zinc-600 dark:text-[#9a988e]">
          <span>Workspace</span>
          <span className="text-zinc-400 dark:text-[#66645b]">/</span>
          {chat.started ? (
            <div className="flex items-center gap-2">
              <span className="text-zinc-900 dark:text-[#f2f0e9] font-medium max-w-[280px] truncate">
                <ClientOnly>{() => <ChatDescription />}</ClientOnly>
              </span>
              <a
                href="/"
                className="text-[11px] font-mono px-2 py-0.5 rounded bg-zinc-100 dark:bg-[#1a1a17] text-zinc-600 dark:text-[#9a988e] hover:text-[#ff7a1a] dark:hover:text-[#ff7a1a] hover:border-[#ff7a1a] border border-zinc-200 dark:border-[#2a2a25] transition ml-1"
                title="Nuevo build"
              >
                + Nuevo build
              </a>
            </div>
          ) : (
            <b className="text-zinc-900 dark:text-[#f2f0e9] font-medium">Nuevo build</b>
          )}
        </div>

        {/* Topbar Restore Chat button when collapsed */}
        {chat.started && !chat.showChat && (
          <button
            onClick={() => chatStore.setKey('showChat', true)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-[#ff7a1a]/15 text-[#ff7a1a] border border-[#ff7a1a]/40 hover:bg-[#ff7a1a]/25 transition cursor-pointer shadow-xs ml-2 animate-fade-in"
            title="Desplegar panel de chat"
          >
            <div className="i-ph:chat-teardrop-text text-sm" />
            <span>Mostrar Chat</span>
          </button>
        )}
      </div>

      <div className="flex items-center gap-3">
        <ClientOnly>
          {() => <WorkbenchViewToggle />}
        </ClientOnly>
        {chat.started && (
          <ClientOnly>
            {() => (
              <div>
                <HeaderActionButtons chatStarted={chat.started} />
              </div>
            )}
          </ClientOnly>
        )}
        <ClientOnly>{() => <UserPlanBadge />}</ClientOnly>
      </div>
    </header>
  );
}
