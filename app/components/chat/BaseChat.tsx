/*
 * @ts-nocheck
 * Preventing TS checks with files presented in the video for a better presentation.
 */
import type { JSONValue, Message } from 'ai';
import React, { type RefCallback, useEffect, useState } from 'react';
import { ClientOnly } from 'remix-utils/client-only';
import { Menu } from '~/components/sidebar/Menu.client';
import { Workbench } from '~/components/workbench/Workbench.client';
import { classNames } from '~/utils/classNames';
import { PROVIDER_LIST } from '~/utils/constants';
import { Messages } from './Messages.client';
import { APIKeyManager, getApiKeysFromCookies } from './APIKeyManager';
import { LOCAL_PROVIDERS } from '~/lib/stores/settings';
import Cookies from 'js-cookie';
import * as Tooltip from '@radix-ui/react-tooltip';
import styles from './BaseChat.module.scss';
import type { ProviderInfo } from '~/types/model';
import { PromptTemplatesGrid } from '~/components/chat/PromptTemplatesGrid';
import type { ActionAlert, SupabaseAlert, DeployAlert, LlmErrorAlertType } from '~/types/actions';
import DeployChatAlert from '~/components/deploy/DeployAlert';
import ChatAlert from './ChatAlert';
import type { ModelInfo } from '~/lib/modules/llm/types';
import ProgressCompilation from './ProgressCompilation';
import type { ProgressAnnotation } from '~/types/context';
import { SupabaseChatAlert } from '~/components/chat/SupabaseAlert';
import { expoUrlAtom } from '~/lib/stores/qrCodeStore';
import { useStore } from '@nanostores/react';
import { workbenchStore } from '~/lib/stores/workbench';
import { chatStore } from '~/lib/stores/chat';
import { StickToBottom, useStickToBottomContext } from '~/lib/hooks';
import { ChatBox } from './ChatBox';
import type { DesignScheme } from '~/types/design-scheme';
import type { ElementInfo } from '~/components/workbench/Inspector';
import LlmErrorAlert from './LLMApiAlert';
import { currentUser } from '~/lib/stores/saasStore';
import { ModelSelector } from '~/components/chat/ModelSelector';
import FilePreview from './FilePreview';

const TEXTAREA_MIN_HEIGHT = 76;

interface BaseChatProps {
  textareaRef?: React.RefObject<HTMLTextAreaElement> | undefined;
  messageRef?: RefCallback<HTMLDivElement> | undefined;
  scrollRef?: RefCallback<HTMLDivElement> | undefined;
  showChat?: boolean;
  chatStarted?: boolean;
  isStreaming?: boolean;
  onStreamingChange?: (streaming: boolean) => void;
  messages?: Message[];
  description?: string;
  enhancingPrompt?: boolean;
  promptEnhanced?: boolean;
  input?: string;
  model?: string;
  setModel?: (model: string) => void;
  provider?: ProviderInfo;
  setProvider?: (provider: ProviderInfo) => void;
  providerList?: ProviderInfo[];
  handleStop?: () => void;
  sendMessage?: (event: React.UIEvent, messageInput?: string) => void;
  handleInputChange?: (event: React.ChangeEvent<HTMLTextAreaElement>) => void;
  enhancePrompt?: () => void;
  importChat?: (description: string, messages: Message[]) => Promise<void>;
  exportChat?: () => void;
  uploadedFiles?: File[];
  setUploadedFiles?: (files: File[]) => void;
  imageDataList?: string[];
  setImageDataList?: (dataList: string[]) => void;
  actionAlert?: ActionAlert;
  clearAlert?: () => void;
  supabaseAlert?: SupabaseAlert;
  clearSupabaseAlert?: () => void;
  deployAlert?: DeployAlert;
  clearDeployAlert?: () => void;
  llmErrorAlert?: LlmErrorAlertType;
  clearLlmErrorAlert?: () => void;
  data?: JSONValue[] | undefined;
  chatMode?: 'discuss' | 'build';
  setChatMode?: (mode: 'discuss' | 'build') => void;
  append?: (message: Message) => void;
  designScheme?: DesignScheme;
  setDesignScheme?: (scheme: DesignScheme) => void;
  selectedElement?: ElementInfo | null;
  setSelectedElement?: (element: ElementInfo | null) => void;
  addToolResult?: ({ toolCallId, result }: { toolCallId: string; result: any }) => void;
  onWebSearchResult?: (result: string) => void;
}

export const BaseChat = React.forwardRef<HTMLDivElement, BaseChatProps>(
  (
    {
      textareaRef,
      showChat = true,
      chatStarted = false,
      isStreaming = false,
      onStreamingChange,
      model,
      setModel,
      provider,
      setProvider,
      providerList,
      input = '',
      enhancingPrompt,
      handleInputChange,

      // promptEnhanced,
      enhancePrompt,
      sendMessage,
      handleStop,
      importChat,
      exportChat,
      uploadedFiles = [],
      setUploadedFiles,
      imageDataList = [],
      setImageDataList,
      messages,
      actionAlert,
      clearAlert,
      deployAlert,
      clearDeployAlert,
      supabaseAlert,
      clearSupabaseAlert,
      llmErrorAlert,
      clearLlmErrorAlert,
      data,
      chatMode,
      setChatMode,
      append,
      designScheme,
      setDesignScheme,
      selectedElement,
      setSelectedElement,
      addToolResult = () => {
        throw new Error('addToolResult not implemented');
      },
      onWebSearchResult,
    },
    ref,
  ) => {
    const TEXTAREA_MAX_HEIGHT = chatStarted ? 400 : 200;
    const [apiKeys, setApiKeys] = useState<Record<string, string>>(getApiKeysFromCookies());
    const [modelList, setModelList] = useState<ModelInfo[]>([]);
    const [isModelSettingsCollapsed, setIsModelSettingsCollapsed] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [recognition, setRecognition] = useState<SpeechRecognition | null>(null);
    const [transcript, setTranscript] = useState('');
    const [isModelLoading, setIsModelLoading] = useState<string | undefined>('all');
    const [progressAnnotations, setProgressAnnotations] = useState<ProgressAnnotation[]>([]);
    const expoUrl = useStore(expoUrlAtom);
    const showWorkbench = useStore(workbenchStore.showWorkbench);
    const [qrModalOpen, setQrModalOpen] = useState(false);
    const user = useStore(currentUser);
    const [greetTime, setGreetTime] = useState('');

    useEffect(() => {
      const updateTime = () => {
        const now = new Date();
        const day = now.toLocaleDateString('es-ES', { weekday: 'long' });
        const time = now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
        setGreetTime(`${day}, ${time}`);
      };
      updateTime();
      const timer = setInterval(updateTime, 30000);
      return () => clearInterval(timer);
    }, []);

    const triggerQuickPrompt = (promptText: string) => {
      if (handleInputChange) {
        const syntheticEvent = {
          target: { value: promptText },
        } as React.ChangeEvent<HTMLTextAreaElement>;
        handleInputChange(syntheticEvent);
      }
      if (sendMessage) {
        sendMessage({} as any, promptText);
      }
    };

    useEffect(() => {
      if (expoUrl) {
        setQrModalOpen(true);
      }
    }, [expoUrl]);

    useEffect(() => {
      if (data) {
        const progressList = data.filter(
          (x) => typeof x === 'object' && (x as any).type === 'progress',
        ) as ProgressAnnotation[];
        setProgressAnnotations(progressList);
      }
    }, [data]);
    useEffect(() => {
      console.log(transcript);
    }, [transcript]);

    useEffect(() => {
      onStreamingChange?.(isStreaming);
    }, [isStreaming, onStreamingChange]);

    useEffect(() => {
      if (typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;

        recognition.onresult = (event) => {
          const transcript = Array.from(event.results)
            .map((result) => result[0])
            .map((result) => result.transcript)
            .join('');

          setTranscript(transcript);

          if (handleInputChange) {
            const syntheticEvent = {
              target: { value: transcript },
            } as React.ChangeEvent<HTMLTextAreaElement>;
            handleInputChange(syntheticEvent);
          }
        };

        recognition.onerror = (event) => {
          console.error('Speech recognition error:', event.error);
          setIsListening(false);
        };

        setRecognition(recognition);
      }
    }, []);

    useEffect(() => {
      if (typeof window !== 'undefined') {
        let parsedApiKeys: Record<string, string> | undefined = {};

        try {
          parsedApiKeys = getApiKeysFromCookies();
          setApiKeys(parsedApiKeys);
        } catch (error) {
          console.error('Error loading API keys from cookies:', error);
          Cookies.remove('apiKeys');
        }

        setIsModelLoading('all');
        fetch('/api/models')
          .then((response) => response.json())
          .then((data) => {
            const typedData = data as { modelList: ModelInfo[] };
            setModelList(typedData.modelList);
          })
          .catch((error) => {
            console.error('Error fetching model list:', error);
          })
          .finally(() => {
            setIsModelLoading(undefined);
          });
      }
    }, [providerList, provider]);

    const onApiKeysChange = async (providerName: string, apiKey: string) => {
      const newApiKeys = { ...apiKeys, [providerName]: apiKey };
      setApiKeys(newApiKeys);
      Cookies.set('apiKeys', JSON.stringify(newApiKeys));

      setIsModelLoading(providerName);

      let providerModels: ModelInfo[] = [];

      try {
        const response = await fetch(`/api/models/${encodeURIComponent(providerName)}`);
        const data = await response.json();
        providerModels = (data as { modelList: ModelInfo[] }).modelList;
      } catch (error) {
        console.error('Error loading dynamic models for:', providerName, error);
      }

      // Only update models for the specific provider
      setModelList((prevModels) => {
        const otherModels = prevModels.filter((model) => model.provider !== providerName);
        return [...otherModels, ...providerModels];
      });
      setIsModelLoading(undefined);
    };

    const startListening = () => {
      if (recognition) {
        recognition.start();
        setIsListening(true);
      }
    };

    const stopListening = () => {
      if (recognition) {
        recognition.stop();
        setIsListening(false);
      }
    };

    const handleSendMessage = (event: React.UIEvent, messageInput?: string) => {
      if (sendMessage) {
        sendMessage(event, messageInput);
        setSelectedElement?.(null);

        if (recognition) {
          recognition.abort(); // Stop current recognition
          setTranscript(''); // Clear transcript
          setIsListening(false);

          // Clear the input by triggering handleInputChange with empty value
          if (handleInputChange) {
            const syntheticEvent = {
              target: { value: '' },
            } as React.ChangeEvent<HTMLTextAreaElement>;
            handleInputChange(syntheticEvent);
          }
        }
      }
    };

    const handleFileUpload = () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';

      input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];

        if (file) {
          const reader = new FileReader();

          reader.onload = (e) => {
            const base64Image = e.target?.result as string;
            setUploadedFiles?.([...uploadedFiles, file]);
            setImageDataList?.([...imageDataList, base64Image]);
          };
          reader.readAsDataURL(file);
        }
      };

      input.click();
    };

    const handlePaste = async (e: React.ClipboardEvent) => {
      const items = e.clipboardData?.items;

      if (!items) {
        return;
      }

      for (const item of items) {
        if (item.type.startsWith('image/')) {
          e.preventDefault();

          const file = item.getAsFile();

          if (file) {
            const reader = new FileReader();

            reader.onload = (e) => {
              const base64Image = e.target?.result as string;
              setUploadedFiles?.([...uploadedFiles, file]);
              setImageDataList?.([...imageDataList, base64Image]);
            };
            reader.readAsDataURL(file);
          }

          break;
        }
      }
    };

    const baseChat = (
      <div
        ref={ref}
        className={classNames(styles.BaseChat, 'relative flex h-full w-full overflow-hidden bg-white dark:bg-[#0a0a09] transition-colors')}
        data-chat-visible={showChat}
      >
        <ClientOnly>{() => <Menu />}</ClientOnly>
        <div className="flex flex-col lg:flex-row overflow-y-auto w-full h-full">
          <div
            className={classNames(
              styles.Chat,
              'flex flex-col flex-grow h-full transition-all duration-300',
              showChat
                ? 'lg:min-w-[var(--chat-min-width)] w-auto opacity-100'
                : 'w-0 min-w-0 max-w-0 overflow-hidden opacity-0 pointer-events-none p-0 m-0 border-0',
            )}
          >
            {!chatStarted ? (
              <div className="flex-1 flex flex-col items-center justify-start p-[48px_24px_40px] max-w-[880px] mx-auto w-full overflow-y-auto modern-scrollbar select-none">
                {/* Brand Logo & Name */}
                <a
                  href="/landing"
                  className="flex items-center gap-2.5 mb-3 px-3 py-1.5 rounded-2xl bg-zinc-100/80 dark:bg-[#131311] border border-zinc-200 dark:border-[#2a2a25] hover:border-[#ff7a1a]/50 transition group"
                  title="Conoce más sobre GenUI Studio"
                >
                  <img
                    src="/logo-genui.png"
                    alt="GenUI Studio Logo"
                    className="w-8 h-8 rounded-xl object-cover shadow-md ring-1 ring-[#ff7a1a]/40 group-hover:scale-105 group-hover:ring-[#ff7a1a] transition duration-200"
                  />
                  <div className="flex items-center gap-1.5 text-left">
                    <span className="font-bold text-xs tracking-tight text-zinc-900 dark:text-[#f2f0e9] font-grotesk">
                      GenUI<span className="text-[#ff7a1a] font-normal ml-0.5">Studio</span>
                    </span>
                    <span className="text-[9px] uppercase font-mono px-1.5 py-0.5 rounded bg-[#ff7a1a]/15 text-[#ff7a1a] font-bold">
                      v2.0
                    </span>
                  </div>
                </a>

                {/* Greet */}
                <div className="text-[12.5px] font-mono-jb text-zinc-500 dark:text-[#66645b] mb-2.5 tracking-wide text-center">
                  {greetTime || 'martes, 21:04'} — listo cuando quieras
                </div>

                {/* H1 */}
                <h1 className="text-[34px] font-semibold tracking-[-0.02em] mb-[34px] text-center leading-[1.15] max-w-[620px] text-zinc-900 dark:text-[#f2f0e9] font-grotesk">
                  ¿Qué construimos ahora, {user?.name?.split(' ')[0] || 'Alexander'}?
                </h1>

                {/* Alerts if any */}
                {(deployAlert || supabaseAlert || actionAlert || llmErrorAlert) && (
                  <div className="flex flex-col gap-2 w-full mb-3">
                    {deployAlert && (
                      <DeployChatAlert
                        alert={deployAlert}
                        clearAlert={() => clearDeployAlert?.()}
                        postMessage={(message: string | undefined) => {
                          sendMessage?.({} as any, message);
                          clearSupabaseAlert?.();
                        }}
                      />
                    )}
                    {supabaseAlert && (
                      <SupabaseChatAlert
                        alert={supabaseAlert}
                        clearAlert={() => clearSupabaseAlert?.()}
                        postMessage={(message) => {
                          sendMessage?.({} as any, message);
                          clearSupabaseAlert?.();
                        }}
                      />
                    )}
                    {actionAlert && (
                      <ChatAlert
                        alert={actionAlert}
                        clearAlert={() => clearAlert?.()}
                        postMessage={(message) => {
                          sendMessage?.({} as any, message);
                          clearAlert?.();
                        }}
                      />
                    )}
                    {llmErrorAlert && <LlmErrorAlert alert={llmErrorAlert} clearAlert={() => clearLlmErrorAlert?.()} />}
                  </div>
                )}

                {/* Command Bar Container */}
                <div className="w-full">
                  <div className="w-full bg-zinc-50 dark:bg-[#131311] border border-zinc-200 dark:border-[#2a2a25] rounded-[12px] p-1 flex items-center gap-1 transition-colors focus-within:border-[#ff7a1a] shadow-xs">
                    <textarea
                      ref={textareaRef}
                      rows={1}
                      value={input}
                      onChange={(e) => {
                        handleInputChange?.(e);
                      }}
                      onPaste={handlePaste}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          if (isStreaming) {
                            handleStop?.();
                            return;
                          }
                          if (input.trim().length > 0 || (uploadedFiles && uploadedFiles.length > 0)) {
                            handleSendMessage?.(e);
                          }
                        }
                      }}
                      placeholder="Describe el sistema o módulo que necesitas..."
                      className="flex-1 bg-transparent border-none outline-none text-zinc-900 dark:text-[#f2f0e9] font-grotesk text-[14.5px] p-[12px_14px] placeholder:text-zinc-400 dark:placeholder:text-[#66645b] resize-none overflow-hidden leading-relaxed"
                      style={{ minHeight: '46px', maxHeight: '120px' }}
                    />

                    <div className="flex items-center gap-0.5 pr-0.5">
                      {/* File Upload (+) */}
                      <button
                        type="button"
                        onClick={handleFileUpload}
                        className="w-8 h-8 rounded-[7px] flex items-center justify-center text-zinc-400 dark:text-[#66645b] hover:text-zinc-700 dark:hover:text-[#9a988e] hover:bg-zinc-200/60 dark:hover:bg-[#1a1a17] transition cursor-pointer text-lg font-light"
                        title="Adjuntar archivo o imagen"
                      >
                        ＋
                      </button>

                      {/* Model / Settings (⌘) */}
                      <button
                        type="button"
                        onClick={() => setIsModelSettingsCollapsed(!isModelSettingsCollapsed)}
                        className={classNames(
                          'w-8 h-8 rounded-[7px] flex items-center justify-center transition cursor-pointer text-sm font-sans',
                          isModelSettingsCollapsed
                            ? 'text-zinc-400 dark:text-[#66645b] hover:text-zinc-700 dark:hover:text-[#9a988e] hover:bg-zinc-200/60 dark:hover:bg-[#1a1a17]'
                            : 'text-[#ff7a1a] bg-orange-100/60 dark:bg-[#1a1a17]',
                        )}
                        title="Ajustes de modelo e IA (⌘)"
                      >
                        ⌘
                      </button>

                      {/* Mic */}
                      {recognition && (
                        <button
                          type="button"
                          onClick={isListening ? stopListening : startListening}
                          className={classNames(
                            'w-8 h-8 rounded-[7px] flex items-center justify-center transition cursor-pointer',
                            isListening
                              ? 'text-red-500 bg-red-500/10 animate-pulse'
                              : 'text-zinc-400 dark:text-[#66645b] hover:text-zinc-700 dark:hover:text-[#9a988e] hover:bg-zinc-200/60 dark:hover:bg-[#1a1a17]',
                          )}
                          title={isListening ? 'Detener dictado' : 'Dictar por voz'}
                        >
                          <div className={isListening ? 'i-ph:microphone-slash text-base' : 'i-ph:microphone text-base'} />
                        </button>
                      )}

                      {/* Send (↵) */}
                      <button
                        type="button"
                        onClick={(e) => {
                          if (isStreaming) {
                            handleStop?.();
                            return;
                          }
                          if (input.trim().length > 0 || (uploadedFiles && uploadedFiles.length > 0)) {
                            handleSendMessage?.(e);
                          }
                        }}
                        disabled={!input.trim() && (!uploadedFiles || uploadedFiles.length === 0)}
                        className="w-[34px] h-[34px] rounded-[8px] bg-[#ff7a1a] hover:bg-[#ff8c3a] disabled:opacity-40 disabled:hover:bg-[#ff7a1a] flex items-center justify-center text-[#0a0a09] font-bold text-base transition-all active:scale-95 cursor-pointer shrink-0 ml-1 shadow-xs"
                        title="Enviar build"
                      >
                        ↵
                      </button>
                    </div>
                  </div>

                  {/* Model Selector Drawer if opened */}
                  {!isModelSettingsCollapsed && (
                    <div className="w-full mt-3 p-3 bg-white dark:bg-[#131311] border border-zinc-200 dark:border-[#2a2a25] rounded-xl shadow-2xl">
                      <ClientOnly>
                        {() => (
                          <>
                            <ModelSelector
                              key={provider?.name + ':' + modelList.length}
                              model={model}
                              setModel={setModel}
                              modelList={modelList}
                              provider={provider}
                              setProvider={setProvider}
                              providerList={providerList || (PROVIDER_LIST as ProviderInfo[])}
                              apiKeys={apiKeys}
                              modelLoading={isModelLoading}
                            />
                            {(providerList || []).length > 0 && provider && !LOCAL_PROVIDERS.includes(provider.name) && (
                              <APIKeyManager
                                provider={provider}
                                apiKey={apiKeys[provider.name] || ''}
                                setApiKey={(key) => {
                                  onApiKeysChange(provider.name, key);
                                }}
                              />
                            )}
                          </>
                        )}
                      </ClientOnly>
                    </div>
                  )}

                  {/* Uploaded files preview if any */}
                  {uploadedFiles && uploadedFiles.length > 0 && (
                    <div className="w-full mt-2 p-2 bg-zinc-50 dark:bg-[#131311] border border-zinc-200 dark:border-[#2a2a25] rounded-lg">
                      <FilePreview
                        files={uploadedFiles}
                        imageDataList={imageDataList || []}
                        onRemove={(index) => {
                          setUploadedFiles?.(uploadedFiles.filter((_, i) => i !== index));
                          setImageDataList?.(imageDataList.filter((_, i) => i !== index));
                        }}
                      />
                    </div>
                  )}
                </div>

                {/* Chips */}
                <div className="flex flex-wrap gap-2 mt-3.5 justify-center">
                  <button
                    type="button"
                    onClick={() =>
                      triggerQuickPrompt(
                        'Crea un Dashboard Analítico interactivo con KPIs de ingresos, gráficos de rendimiento semanal y mensual, y reportes SQL completos con tabla de datos.',
                      )
                    }
                    className="text-[12px] font-mono-jb text-zinc-600 dark:text-[#9a988e] border border-zinc-200 dark:border-[#2a2a25] hover:border-[#ff7a1a] hover:text-zinc-900 dark:hover:text-[#f2f0e9] p-[7px_13px] rounded-[20px] cursor-pointer flex items-center gap-1.5 transition-colors bg-white dark:bg-[#131311]/60 shadow-xs"
                  >
                    <span className="w-[5px] h-[5px] rounded-full bg-[#4f8cff]" />
                    Dashboard &amp; KPIs
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      triggerQuickPrompt(
                        'Construye un sistema POS y control de inventario con venta rápida, escaneo de código/sku, catálogo de productos con stock, carrito de compras y facturación.',
                      )
                    }
                    className="text-[12px] font-mono-jb text-zinc-600 dark:text-[#9a988e] border border-zinc-200 dark:border-[#2a2a25] hover:border-[#ff7a1a] hover:text-zinc-900 dark:hover:text-[#f2f0e9] p-[7px_13px] rounded-[20px] cursor-pointer flex items-center gap-1.5 transition-colors bg-white dark:bg-[#131311]/60 shadow-xs"
                  >
                    <span className="w-[5px] h-[5px] rounded-full bg-[#ff7a1a]" />
                    POS &amp; Inventario
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      triggerQuickPrompt(
                        'Diseña una aplicación clínica moderna para agendar citas médicas u odontológicas, con calendario de horarios, gestión de pacientes y doctores.',
                      )
                    }
                    className="text-[12px] font-mono-jb text-zinc-600 dark:text-[#9a988e] border border-zinc-200 dark:border-[#2a2a25] hover:border-[#ff7a1a] hover:text-zinc-900 dark:hover:text-[#f2f0e9] p-[7px_13px] rounded-[20px] cursor-pointer flex items-center gap-1.5 transition-colors bg-white dark:bg-[#131311]/60 shadow-xs"
                  >
                    <span className="w-[5px] h-[5px] rounded-full bg-[#37c98b]" />
                    Agenda Clínica
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      triggerQuickPrompt(
                        'Desarrolla una plataforma de compras y gestión de proveedores B2B con emisión de órdenes de compra, catálogo de suministros y seguimiento de estados.',
                      )
                    }
                    className="text-[12px] font-mono-jb text-zinc-600 dark:text-[#9a988e] border border-zinc-200 dark:border-[#2a2a25] hover:border-[#ff7a1a] hover:text-zinc-900 dark:hover:text-[#f2f0e9] p-[7px_13px] rounded-[20px] cursor-pointer flex items-center gap-1.5 transition-colors bg-white dark:bg-[#131311]/60 shadow-xs"
                  >
                    <span className="w-[5px] h-[5px] rounded-full bg-[#c9a537]" />
                    Proveedores B2B
                  </button>
                </div>

                {/* Plantillas destacadas divider */}
                <div
                  id="plantillas-section"
                  className="w-full mt-[52px] mb-4 text-[11.5px] font-mono-jb text-zinc-400 dark:text-[#66645b] flex items-center gap-2.5 after:content-[''] after:flex-1 after:h-[1px] after:bg-zinc-200 dark:after:bg-[#2a2a25]"
                >
                  plantillas destacadas
                </div>

                {/* Preview strip cards */}
                <div className="w-full grid grid-cols-1 md:grid-cols-3 gap-3">
                  {/* Card 1 */}
                  <div
                    onClick={() =>
                      triggerQuickPrompt(
                        'Crea un Dashboard Analítico completo para métricas, gráficos de rendimiento y reportes con base de datos SQL integrada.',
                      )
                    }
                    className="border border-zinc-200 dark:border-[#2a2a25] hover:border-zinc-300 dark:hover:border-[#3a3830] rounded-[10px] overflow-hidden bg-white dark:bg-[#131311] cursor-pointer transition-colors group text-left shadow-xs"
                  >
                    <div className="h-[108px] bg-zinc-100 dark:bg-[#1a1a17] relative overflow-hidden p-3">
                      <div className="h-[5px] rounded-[2px] bg-orange-200/60 dark:bg-[#4a2c10] w-[40%] mb-[7px]" />
                      <div className="h-[5px] rounded-[2px] bg-zinc-300 dark:bg-[#3a372c] w-[70%] mb-[7px]" />
                      <div className="grid grid-cols-2 gap-1.5 mt-2">
                        <div className="h-[22px] rounded-[4px] bg-zinc-200/70 dark:bg-[#232019] border border-zinc-300/80 dark:border-[#2a2a25] group-hover:border-[#ff7a1a]/40 transition-colors" />
                        <div className="h-[22px] rounded-[4px] bg-zinc-200/70 dark:bg-[#232019] border border-zinc-300/80 dark:border-[#2a2a25] group-hover:border-[#ff7a1a]/40 transition-colors" />
                        <div className="h-[22px] rounded-[4px] bg-zinc-200/70 dark:bg-[#232019] border border-zinc-300/80 dark:border-[#2a2a25] group-hover:border-[#ff7a1a]/40 transition-colors" />
                        <div className="h-[22px] rounded-[4px] bg-zinc-200/70 dark:bg-[#232019] border border-zinc-300/80 dark:border-[#2a2a25] group-hover:border-[#ff7a1a]/40 transition-colors" />
                      </div>
                    </div>
                    <div className="p-[11px_13px]">
                      <div className="text-[12.5px] font-medium text-zinc-900 dark:text-[#f2f0e9] group-hover:text-[#ff7a1a] transition-colors mb-0.5">
                        Dashboard Analítico
                      </div>
                      <div className="text-[11px] text-zinc-500 dark:text-[#66645b]">Métricas, gráficos y reportes SQL</div>
                    </div>
                  </div>

                  {/* Card 2 */}
                  <div
                    onClick={() =>
                      triggerQuickPrompt(
                        'Construye un sistema POS & Inventario para venta rápida en mostrador, stock en tiempo real y facturación de productos.',
                      )
                    }
                    className="border border-zinc-200 dark:border-[#2a2a25] hover:border-zinc-300 dark:hover:border-[#3a3830] rounded-[10px] overflow-hidden bg-white dark:bg-[#131311] cursor-pointer transition-colors group text-left shadow-xs"
                  >
                    <div className="h-[108px] bg-zinc-100 dark:bg-[#1a1a17] relative overflow-hidden p-3">
                      <div className="h-[5px] rounded-[2px] bg-orange-200/60 dark:bg-[#4a2c10] w-[40%] mb-[7px]" />
                      <div className="h-[5px] rounded-[2px] bg-zinc-300 dark:bg-[#3a372c] w-[55%] mb-[7px]" />
                      <div className="grid grid-cols-2 gap-1.5 mt-2">
                        <div className="h-[22px] rounded-[4px] bg-zinc-200/70 dark:bg-[#232019] border border-zinc-300/80 dark:border-[#2a2a25] group-hover:border-[#ff7a1a]/40 transition-colors" />
                        <div className="h-[22px] rounded-[4px] bg-zinc-200/70 dark:bg-[#232019] border border-zinc-300/80 dark:border-[#2a2a25] group-hover:border-[#ff7a1a]/40 transition-colors" />
                        <div className="h-[22px] rounded-[4px] bg-zinc-200/70 dark:bg-[#232019] border border-zinc-300/80 dark:border-[#2a2a25] group-hover:border-[#ff7a1a]/40 transition-colors" />
                        <div className="h-[22px] rounded-[4px] bg-zinc-200/70 dark:bg-[#232019] border border-zinc-300/80 dark:border-[#2a2a25] group-hover:border-[#ff7a1a]/40 transition-colors" />
                      </div>
                    </div>
                    <div className="p-[11px_13px]">
                      <div className="text-[12.5px] font-medium text-zinc-900 dark:text-[#f2f0e9] group-hover:text-[#ff7a1a] transition-colors mb-0.5">
                        POS &amp; Inventario
                      </div>
                      <div className="text-[11px] text-zinc-500 dark:text-[#66645b]">Venta rápida, stock y facturación</div>
                    </div>
                  </div>

                  {/* Card 3 */}
                  <div
                    onClick={() =>
                      triggerQuickPrompt(
                        'Desarrolla un módulo de Proveedores & Compras con gestión de catálogos, órdenes de compra y control de estados de pago.',
                      )
                    }
                    className="border border-zinc-200 dark:border-[#2a2a25] hover:border-zinc-300 dark:hover:border-[#3a3830] rounded-[10px] overflow-hidden bg-white dark:bg-[#131311] cursor-pointer transition-colors group text-left shadow-xs"
                  >
                    <div className="h-[108px] bg-zinc-100 dark:bg-[#1a1a17] relative overflow-hidden p-3">
                      <div className="h-[5px] rounded-[2px] bg-orange-200/60 dark:bg-[#4a2c10] w-[40%] mb-[7px]" />
                      <div className="h-[5px] rounded-[2px] bg-zinc-300 dark:bg-[#3a372c] w-[64%] mb-[7px]" />
                      <div className="grid grid-cols-2 gap-1.5 mt-2">
                        <div className="h-[22px] rounded-[4px] bg-zinc-200/70 dark:bg-[#232019] border border-zinc-300/80 dark:border-[#2a2a25] group-hover:border-[#ff7a1a]/40 transition-colors" />
                        <div className="h-[22px] rounded-[4px] bg-zinc-200/70 dark:bg-[#232019] border border-zinc-300/80 dark:border-[#2a2a25] group-hover:border-[#ff7a1a]/40 transition-colors" />
                        <div className="h-[22px] rounded-[4px] bg-zinc-200/70 dark:bg-[#232019] border border-zinc-300/80 dark:border-[#2a2a25] group-hover:border-[#ff7a1a]/40 transition-colors" />
                        <div className="h-[22px] rounded-[4px] bg-zinc-200/70 dark:bg-[#232019] border border-zinc-300/80 dark:border-[#2a2a25] group-hover:border-[#ff7a1a]/40 transition-colors" />
                      </div>
                    </div>
                    <div className="p-[11px_13px]">
                      <div className="text-[12.5px] font-medium text-zinc-900 dark:text-[#f2f0e9] group-hover:text-[#ff7a1a] transition-colors mb-0.5">
                        Proveedores &amp; Compras
                      </div>
                      <div className="text-[11px] text-zinc-500 dark:text-[#66645b]">Órdenes, catálogo y pagos</div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <StickToBottom
                className="h-full flex flex-col modern-scrollbar pt-6 px-2 sm:px-6 relative"
                resize="smooth"
                initial="smooth"
              >
                <StickToBottom.Content className="flex flex-col gap-4 relative ">
                  <ClientOnly>
                    {() => {
                      return (
                        <Messages
                          className="flex flex-col w-full flex-1 max-w-chat pb-4 mx-auto z-1"
                          messages={messages}
                          isStreaming={isStreaming}
                          append={append}
                          chatMode={chatMode}
                          setChatMode={setChatMode}
                          provider={provider}
                          model={model}
                          addToolResult={addToolResult}
                        />
                      );
                    }}
                  </ClientOnly>
                  <ScrollToBottom />
                </StickToBottom.Content>
                <div className="my-auto flex flex-col gap-2 w-full mx-auto z-prompt mb-4 transition-all duration-300 sticky bottom-2 max-w-chat">
                  <div className="flex flex-col gap-2">
                    {deployAlert && (
                      <DeployChatAlert
                        alert={deployAlert}
                        clearAlert={() => clearDeployAlert?.()}
                        postMessage={(message: string | undefined) => {
                          sendMessage?.({} as any, message);
                          clearSupabaseAlert?.();
                        }}
                      />
                    )}
                    {supabaseAlert && (
                      <SupabaseChatAlert
                        alert={supabaseAlert}
                        clearAlert={() => clearSupabaseAlert?.()}
                        postMessage={(message) => {
                          sendMessage?.({} as any, message);
                          clearSupabaseAlert?.();
                        }}
                      />
                    )}
                    {actionAlert && (
                      <ChatAlert
                        alert={actionAlert}
                        clearAlert={() => clearAlert?.()}
                        postMessage={(message) => {
                          sendMessage?.({} as any, message);
                          clearAlert?.();
                        }}
                      />
                    )}
                    {llmErrorAlert && <LlmErrorAlert alert={llmErrorAlert} clearAlert={() => clearLlmErrorAlert?.()} />}
                  </div>
                  {progressAnnotations && <ProgressCompilation data={progressAnnotations} />}
                  <ChatBox
                    isModelSettingsCollapsed={isModelSettingsCollapsed}
                    setIsModelSettingsCollapsed={setIsModelSettingsCollapsed}
                    provider={provider}
                    setProvider={setProvider}
                    providerList={providerList || (PROVIDER_LIST as ProviderInfo[])}
                    model={model}
                    setModel={setModel}
                    modelList={modelList}
                    apiKeys={apiKeys}
                    isModelLoading={isModelLoading}
                    onApiKeysChange={onApiKeysChange}
                    uploadedFiles={uploadedFiles}
                    setUploadedFiles={setUploadedFiles}
                    imageDataList={imageDataList}
                    setImageDataList={setImageDataList}
                    textareaRef={textareaRef}
                    input={input}
                    handleInputChange={handleInputChange}
                    handlePaste={handlePaste}
                    TEXTAREA_MIN_HEIGHT={TEXTAREA_MIN_HEIGHT}
                    TEXTAREA_MAX_HEIGHT={TEXTAREA_MAX_HEIGHT}
                    isStreaming={isStreaming}
                    handleStop={handleStop}
                    handleSendMessage={handleSendMessage}
                    enhancingPrompt={enhancingPrompt}
                    enhancePrompt={enhancePrompt}
                    isListening={isListening}
                    startListening={startListening}
                    stopListening={stopListening}
                    chatStarted={chatStarted}
                    exportChat={exportChat}
                    qrModalOpen={qrModalOpen}
                    setQrModalOpen={setQrModalOpen}
                    handleFileUpload={handleFileUpload}
                    chatMode={chatMode}
                    setChatMode={setChatMode}
                    designScheme={designScheme}
                    setDesignScheme={setDesignScheme}
                    selectedElement={selectedElement}
                    setSelectedElement={setSelectedElement}
                    onWebSearchResult={onWebSearchResult}
                  />
                </div>
              </StickToBottom>
            )}
          </div>
          <ClientOnly>
            {() => (
              <Workbench chatStarted={chatStarted} isStreaming={isStreaming} setSelectedElement={setSelectedElement} />
            )}
          </ClientOnly>
        </div>
      </div>
    );

    return <Tooltip.Provider delayDuration={200}>{baseChat}</Tooltip.Provider>;
  },
);

function ScrollToBottom() {
  const { isAtBottom, scrollToBottom } = useStickToBottomContext();

  return (
    !isAtBottom && (
      <>
        <div className="sticky bottom-0 left-0 right-0 bg-gradient-to-t from-bolt-elements-background-depth-1 to-transparent h-20 z-10" />
        <button
          className="sticky z-50 bottom-0 left-0 right-0 text-4xl rounded-lg px-1.5 py-0.5 flex items-center justify-center mx-auto gap-2 bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor text-bolt-elements-textPrimary text-sm"
          onClick={() => scrollToBottom()}
        >
          Go to last message
          <span className="i-ph:arrow-down animate-bounce" />
        </button>
      </>
    )
  );
}
