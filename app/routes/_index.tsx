import { json, type MetaFunction } from '@remix-run/cloudflare';
import { ClientOnly } from 'remix-utils/client-only';
import { BaseChat } from '~/components/chat/BaseChat';
import { Chat } from '~/components/chat/Chat.client';
import { Header } from '~/components/header/Header';

export const meta: MetaFunction = () => {
  return [
    { title: 'GenUI Studio — Workspace' },
    { name: 'description', content: 'GenUI Studio: Workspace autónomo para generación y gestión de software' },
  ];
};

export const loader = () => json({});

export default function Index() {
  return (
    <div className="flex flex-col h-screen w-screen bg-[var(--ws-bg)] text-[var(--ws-text)] font-grotesk overflow-hidden select-none transition-colors duration-200">
      <Header />
      <div className="flex-1 min-h-0 overflow-hidden relative">
        <ClientOnly fallback={<BaseChat />}>{() => <Chat />}</ClientOnly>
      </div>
    </div>
  );
}
