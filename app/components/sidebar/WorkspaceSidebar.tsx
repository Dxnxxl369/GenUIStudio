import React, { useEffect, useState } from 'react';
import { useStore } from '@nanostores/react';
import { currentUser } from '~/lib/stores/saasStore';
import { db, getAll, type ChatHistoryItem } from '~/lib/persistence';
import { chatStore } from '~/lib/stores/chat';
import { isSidebarOpen } from '~/lib/stores/sidebarStore';

interface WorkspaceSidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export function WorkspaceSidebar({ isOpen, onClose }: WorkspaceSidebarProps) {
  const user = useStore(currentUser);
  const chat = useStore(chatStore);
  const sidebarOpen = useStore(isSidebarOpen);
  const [recentChats, setRecentChats] = useState<ChatHistoryItem[]>([]);

  useEffect(() => {
    if (db) {
      getAll(db)
        .then((items) => {
          const valid = items.filter((item) => item.urlId && item.description);
          setRecentChats(valid.slice(0, 5));
        })
        .catch(() => {});
    }
  }, [chat.started]);

  const userName = user?.name?.split(' ')[0] || 'Alexander';
  const userPlan = user?.planId ? user.planId.replace('plan_', '').toUpperCase() : 'ENTERPRISE';

  const defaultRecent = [
    { title: 'Dashboard KPIs — Ventas', meta: 'editado hace 2h' },
    { title: 'POS Retail v3', meta: 'editado ayer' },
    { title: 'Agenda Clínica', meta: 'editado hace 4 días' },
  ];

  if (!sidebarOpen && !isOpen) {
    return null;
  }

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 md:hidden backdrop-blur-xs"
          onClick={onClose}
        />
      )}

      <aside
        className={`
          w-[248px] shrink-0 bg-white dark:bg-[#131311] border-r border-zinc-200 dark:border-[#2a2a25] p-[22px_16px] flex flex-col gap-7 select-none h-full z-40 transition-all duration-200
          ${isOpen ? 'fixed inset-y-0 left-0 shadow-2xl' : 'static'}
        `}
      >
        {/* Brand */}
        <div className="flex items-center gap-2.5 px-1.5">
          <div className="w-[30px] h-[30px] rounded-[8px] bg-gradient-to-br from-[#ff7a1a] to-[#c94f00] flex items-center justify-center font-bold text-[15px] text-[#0a0a09] shrink-0 shadow-sm">
            G
          </div>
          <div>
            <div className="font-semibold text-[15px] tracking-tight text-zinc-900 dark:text-[#f2f0e9] leading-tight font-grotesk">
              GenUI Studio
            </div>
            <div className="text-[10.5px] text-zinc-500 dark:text-[#66645b] font-mono-jb tracking-wide leading-tight">
              workspace
            </div>
          </div>
        </div>

        {/* Nav Group: agente */}
        <div className="flex flex-col gap-0.5">
          <div className="text-[10.5px] text-zinc-500 dark:text-[#66645b] font-mono-jb px-2.5 pb-1.5 tracking-wider uppercase">
            agente
          </div>
          <a
            href="/"
            className="flex items-center gap-2.5 px-2.5 py-2 rounded-[7px] text-[13.5px] bg-zinc-100 dark:bg-[#1a1a17] text-zinc-900 dark:text-[#f2f0e9] font-medium transition cursor-pointer hover:bg-zinc-200/80 dark:hover:bg-[#20201d]"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#ff7a1a] shrink-0" />
            <span>Nuevo build</span>
          </a>
          <button
            type="button"
            onClick={() => {
              // Dispatch mouse event to open slide-over menu if needed
              const enterEvt = new MouseEvent('mousemove', { clientX: 10, screenX: 10 });
              window.dispatchEvent(enterEvt);
            }}
            className="flex items-center gap-2.5 px-2.5 py-2 rounded-[7px] text-[13.5px] text-zinc-600 dark:text-[#9a988e] hover:text-zinc-900 dark:hover:text-[#f2f0e9] hover:bg-zinc-100 dark:hover:bg-[#1a1a17]/50 transition cursor-pointer text-left w-full"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 dark:bg-[#66645b] shrink-0" />
            <span>Historial</span>
          </button>
          <a
            href="#plantillas"
            onClick={(e) => {
              e.preventDefault();
              const el = document.getElementById('plantillas-section');
              if (el) {
                el.scrollIntoView({ behavior: 'smooth' });
              }
            }}
            className="flex items-center gap-2.5 px-2.5 py-2 rounded-[7px] text-[13.5px] text-zinc-600 dark:text-[#9a988e] hover:text-zinc-900 dark:hover:text-[#f2f0e9] hover:bg-zinc-100 dark:hover:bg-[#1a1a17]/50 transition cursor-pointer"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 dark:bg-[#66645b] shrink-0" />
            <span>Plantillas</span>
          </a>
          <button
            type="button"
            onClick={() => {
              // Open settings dialog
              const settingsBtn = document.querySelector('[data-testid="settings-button"]') as HTMLElement;
              if (settingsBtn) {
                settingsBtn.click();
              } else {
                const enterEvt = new MouseEvent('mousemove', { clientX: 10, screenX: 10 });
                window.dispatchEvent(enterEvt);
              }
            }}
            className="flex items-center gap-2.5 px-2.5 py-2 rounded-[7px] text-[13.5px] text-zinc-600 dark:text-[#9a988e] hover:text-zinc-900 dark:hover:text-[#f2f0e9] hover:bg-zinc-100 dark:hover:bg-[#1a1a17]/50 transition cursor-pointer text-left w-full"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 dark:bg-[#66645b] shrink-0" />
            <span>Integraciones</span>
          </button>
        </div>

        {/* Nav Group: recientes */}
        <div className="flex flex-col gap-0.5 flex-1 overflow-y-auto modern-scrollbar">
          <div className="text-[10.5px] text-zinc-500 dark:text-[#66645b] font-mono-jb px-2.5 pb-1.5 tracking-wider uppercase">
            recientes
          </div>
          {recentChats.length > 0 ? (
            recentChats.map((item) => (
              <a
                key={item.id}
                href={`/chat/${item.urlId}`}
                className="p-[9px_10px] rounded-[7px] border border-transparent hover:border-zinc-200 dark:hover:border-[#2a2a25] hover:bg-zinc-100 dark:hover:bg-[#1a1a17] transition cursor-pointer group block"
              >
                <div className="text-[12.5px] text-zinc-800 dark:text-[#f2f0e9] group-hover:text-[#ff7a1a] truncate transition-colors">
                  {item.description}
                </div>
                <div className="text-[10.5px] text-zinc-500 dark:text-[#66645b] font-mono-jb mt-0.5">
                  {item.timestamp ? new Date(item.timestamp).toLocaleDateString('es-ES', { month: 'short', day: 'numeric' }) : 'reciente'}
                </div>
              </a>
            ))
          ) : (
            defaultRecent.map((item, idx) => (
              <div
                key={idx}
                className="p-[9px_10px] rounded-[7px] border border-transparent hover:border-zinc-200 dark:hover:border-[#2a2a25] hover:bg-zinc-100 dark:hover:bg-[#1a1a17] transition cursor-pointer group"
              >
                <div className="text-[12.5px] text-zinc-800 dark:text-[#f2f0e9] group-hover:text-[#ff7a1a] transition-colors">
                  {item.title}
                </div>
                <div className="text-[10.5px] text-zinc-500 dark:text-[#66645b] font-mono-jb mt-0.5">
                  {item.meta}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Sidebar Footer */}
        <div className="mt-auto flex items-center gap-2.5 p-[9px_8px] rounded-[8px] border border-zinc-200 dark:border-[#2a2a25] bg-zinc-50 dark:bg-[#0a0a09]/60 shrink-0">
          <div className="w-[26px] h-[26px] rounded-[6px] bg-zinc-200 dark:bg-[#3a372c] flex items-center justify-center text-[12px] font-bold text-zinc-800 dark:text-[#f2f0e9] shrink-0 font-grotesk">
            {userName[0]?.toUpperCase() || 'A'}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[12.5px] font-medium text-zinc-900 dark:text-[#f2f0e9] truncate leading-tight font-grotesk">
              {userName}
            </div>
            <div className="text-[10px] text-[#ff7a1a] font-mono-jb font-semibold tracking-wider leading-tight uppercase">
              {userPlan}
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
