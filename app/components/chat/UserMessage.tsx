/*
 * @ts-nocheck
 * Preventing TS checks with files presented in the video for a better presentation.
 */
import React, { useState } from 'react';
import { toast } from 'react-toastify';
import { MODEL_REGEX, PROVIDER_REGEX } from '~/utils/constants';
import { Markdown } from './Markdown';
import { useStore } from '@nanostores/react';
import { profileStore } from '~/lib/stores/profile';
import { saasStore, currentUser } from '~/lib/stores/saasStore';
import type {
  TextUIPart,
  ReasoningUIPart,
  ToolInvocationUIPart,
  SourceUIPart,
  FileUIPart,
  StepStartUIPart,
} from '@ai-sdk/ui-utils';

interface UserMessageProps {
  content: string | Array<{ type: string; text?: string; image?: string }>;
  parts:
    | (TextUIPart | ReasoningUIPart | ToolInvocationUIPart | SourceUIPart | FileUIPart | StepStartUIPart)[]
    | undefined;
  messageId?: string;
  timeString?: string;
}

export function UserMessage({ content, parts, timeString }: UserMessageProps) {
  const profile = useStore(profileStore);
  const saas = useStore(saasStore);
  const user = useStore(currentUser);
  const [copied, setCopied] = useState(false);

  const activeUserName = saas.isAuthenticated && user?.name ? user.name : profile?.username || 'Tú';
  const activeUserInitial = (activeUserName[0] || 'U').toUpperCase();

  // Extract images from parts - look for file parts with image mime types
  const images =
    parts?.filter(
      (part): part is FileUIPart => part.type === 'file' && 'mimeType' in part && part.mimeType.startsWith('image/'),
    ) || [];

  const handleCopy = (text: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('Mensaje copiado al portapapeles');
    setTimeout(() => setCopied(false), 2000);
  };

  if (Array.isArray(content)) {
    const textItem = content.find((item) => item.type === 'text');
    const textContent = stripMetadata(textItem?.text || '');

    return (
      <div className="overflow-hidden flex flex-col gap-3 items-center select-text">
        <div className="flex flex-row items-start justify-center overflow-hidden shrink-0 self-start">
          <div className="flex items-center gap-2">
            <div className="w-[24px] h-[24px] rounded-full bg-gradient-to-br from-[#ff7a1a] to-[#c94f00] text-[#0a0a09] font-bold text-[10px] flex items-center justify-center shrink-0 font-grotesk shadow-xs">
              {activeUserInitial}
            </div>
            <span className="text-bolt-elements-textPrimary text-sm font-medium">
              {activeUserName}
            </span>
          </div>
        </div>
        <div className="flex flex-col gap-3 bg-accent-500/10 backdrop-blur-sm p-4 w-auto rounded-xl mr-auto border border-[#ff7a1a]/15 shadow-xs">
          {textContent && <Markdown html>{textContent}</Markdown>}
          {images.map((item, index) => (
            <img
              key={index}
              src={`data:${item.mimeType};base64,${item.data}`}
              alt={`Image ${index + 1}`}
              className="max-w-full h-auto rounded-lg"
              style={{ maxHeight: '512px', objectFit: 'contain' }}
            />
          ))}
          {/* Footer with timestamp and copy button */}
          <div className="flex items-center justify-between gap-3 pt-1 border-t border-zinc-200/40 dark:border-zinc-700/30 text-[11px] text-zinc-500 dark:text-[#9a988e]">
            {timeString && (
              <span className="font-mono text-[10px] opacity-80" title="Hora de envío">
                {timeString}
              </span>
            )}
            <button
              onClick={() => handleCopy(textContent)}
              className="flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-black/5 dark:hover:bg-white/10 text-zinc-500 dark:text-zinc-400 hover:text-[#ff7a1a] dark:hover:text-[#ff7a1a] transition cursor-pointer"
              title="Copiar mensaje"
            >
              <span className={copied ? 'i-ph:check-bold text-[#ff7a1a]' : 'i-ph:copy'} />
              <span className="text-[10px]">{copied ? 'Copiado' : 'Copiar'}</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  const textContent = stripMetadata(content);

  return (
    <div className="flex flex-col bg-accent-500/10 backdrop-blur-sm px-5 py-3.5 w-auto max-w-[90%] rounded-xl ml-auto border border-[#ff7a1a]/20 shadow-xs select-text">
      {images.length > 0 && (
        <div className="flex gap-3.5 mb-3">
          {images.map((item, index) => (
            <div key={index} className="relative flex rounded-lg border border-bolt-elements-borderColor overflow-hidden">
              <div className="h-16 w-16 bg-transparent outline-none">
                <img
                  src={`data:${item.mimeType};base64,${item.data}`}
                  alt={`Image ${index + 1}`}
                  className="h-full w-full rounded-lg"
                  style={{ objectFit: 'fill' }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
      <Markdown html>{textContent}</Markdown>

      {/* Footer with timestamp and copy button */}
      <div className="flex items-center justify-end gap-3 mt-2 pt-1.5 border-t border-zinc-200/40 dark:border-zinc-700/30 text-[11px] text-zinc-500 dark:text-[#9a988e]">
        {timeString && (
          <span className="font-mono text-[10px] opacity-80" title="Hora de envío">
            {timeString}
          </span>
        )}
        <button
          onClick={() => handleCopy(textContent)}
          className="flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-black/5 dark:hover:bg-white/10 text-zinc-500 dark:text-zinc-400 hover:text-[#ff7a1a] dark:hover:text-[#ff7a1a] transition cursor-pointer"
          title="Copiar mensaje"
        >
          <span className={copied ? 'i-ph:check-bold text-[#ff7a1a]' : 'i-ph:copy'} />
          <span className="text-[10px]">{copied ? 'Copiado' : 'Copiar'}</span>
        </button>
      </div>
    </div>
  );
}

function stripMetadata(content: string) {
  const artifactRegex = /<boltArtifact\s+[^>]*>[\s\S]*?<\/boltArtifact>/gm;
  return content.replace(MODEL_REGEX, '').replace(PROVIDER_REGEX, '').replace(artifactRegex, '').trim();
}
