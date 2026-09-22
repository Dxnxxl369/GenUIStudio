import React, { useState } from 'react';
import { useStore } from '@nanostores/react';
import type { MetaFunction } from '@remix-run/cloudflare';
import { themeStore, toggleTheme } from '~/lib/stores/theme';
import { saasStore, currentUser } from '~/lib/stores/saasStore';
import { LoginModal } from '~/components/saas/LoginModal';
import { classNames } from '~/utils/classNames';

export const meta: MetaFunction = () => {
  return [
    { title: 'GenUI Studio • Generador de Software Autónomo con IA y Runtime en el Navegador' },
    {
      name: 'description',
      content:
        'Crea aplicaciones web funcionales con base de datos en caché del navegador, WebContainers en tiempo real y orquestación multi-modelo con GenUI Studio.',
    },
  ];
};

export default function LandingPage() {
  const currentTheme = useStore(themeStore);
  const state = useStore(saasStore);
  const user = useStore(currentUser);

  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [loginModalMode, setLoginModalMode] = useState<'login' | 'register'>('login');
  const [activeFaq, setActiveFaq] = useState<number | null>(null);

  const scrollToSection = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    const element = document.getElementById(id);
    if (element) {
      const navOffset = 80;
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - navOffset;

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth',
      });
    }
  };

  const faqs = [
    {
      q: '¿Cómo funciona la base de datos que se guarda en el navegador?',
      a: 'GenUI Studio utiliza tecnologías modernas como IndexedDB, localStorage y bases de datos SQLite compiladas a WebAssembly (WASM). Cuando la IA genera tu aplicación, crea automáticamente tablas, migraciones y almacenes locales dentro del navegador del usuario. Tus datos persisten entre recargas de página y sesiones sin requerir infraestructura externa obligatoria.',
    },
    {
      q: '¿Qué es el runtime WebContainer y por qué no necesito instalar Node.js?',
      a: 'WebContainer es un micro-sistema operativo que ejecuta Node.js nativamente dentro de una pestaña de tu navegador. La IA escribe el código fuente, instala dependencias mediante npm y arranca un servidor Vite en vivo de forma instantánea y aislada con cero latencia.',
    },
    {
      q: '¿Puedo conectar mi propio backend o base de datos PostgreSQL en la nube?',
      a: '¡Por supuesto! GenUI Studio cuenta con integración nativa en 1-clic con Supabase. Puedes pasar de almacenar datos en la memoria local del navegador a una base de datos PostgreSQL remota en cualquier momento simplemente configurando tus claves.',
    },
    {
      q: '¿Qué modelos de Inteligencia Artificial están disponibles?',
      a: 'Soportamos los modelos más avanzados de la industria: Anthropic Claude 3.5 Sonnet, OpenAI GPT-4o, Google Gemini 1.5 Pro & Flash, DeepSeek V3, y modelos open-source ejecutados localmente mediante Ollama o LM Studio.',
    },
    {
      q: '¿Cómo se controlan y descuentan los créditos de IA?',
      a: 'Cada petición enviada a los modelos deduce tokens de tu balance mensual en tiempo real. Puedes monitorear tu consumo exacto desde la barra superior y desde el panel de administración centralizado, con métricas detalladas por modelo y costo.',
    },
    {
      q: '¿Puedo exportar el código fuente o desplegar a producción?',
      a: 'Sí, el código generado te pertenece al 100%. Puedes descargar un archivo .ZIP listo para producción, sincronizar con repositorios de GitHub o GitLab, o desplegar en 1-clic a plataformas como Netlify y Vercel.',
    },
  ];

  return (
    <div className="min-h-screen flex flex-col scroll-smooth bg-zinc-50 dark:bg-[#0a0a09] text-zinc-900 dark:text-[#f2f0e9] font-sans selection:bg-[#ff7a1a]/30 selection:text-[#ff7a1a] transition-colors duration-200">
      {/* ------------------------------------------------------------- */}
      {/* TOP NAVIGATION BAR */}
      {/* ------------------------------------------------------------- */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-white/80 dark:bg-[#0a0a09]/85 border-b border-zinc-200 dark:border-[#2a2a25] transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Brand Logo */}
          <a href="/" className="flex items-center gap-3 group">
            <img
              src="/logo-genui.png"
              alt="GenUI Studio Logo"
              className="w-9 h-9 rounded-xl object-cover shadow-md ring-1 ring-[#ff7a1a]/40 group-hover:scale-105 group-hover:ring-[#ff7a1a] transition duration-200"
            />
            <div className="flex flex-col">
              <span className="font-bold text-base tracking-tight text-zinc-900 dark:text-[#f2f0e9] font-grotesk leading-none">
                GenUI<span className="text-[#ff7a1a] font-normal ml-0.5">Studio</span>
              </span>
              <span className="text-[10px] text-zinc-400 dark:text-[#8c887b] font-mono leading-none mt-1">
                AI Full-Stack Generator
              </span>
            </div>
          </a>

          {/* Nav Links */}
          <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-zinc-600 dark:text-[#9a988e]">
            <a
              href="#capacidades"
              onClick={(e) => scrollToSection(e, 'capacidades')}
              className="hover:text-[#ff7a1a] dark:hover:text-[#ff7a1a] transition cursor-pointer"
            >
              Capacidades
            </a>
            <a
              href="#database"
              onClick={(e) => scrollToSection(e, 'database')}
              className="hover:text-[#ff7a1a] dark:hover:text-[#ff7a1a] transition cursor-pointer"
            >
              Base de Datos
            </a>
            <a
              href="#runtime"
              onClick={(e) => scrollToSection(e, 'runtime')}
              className="hover:text-[#ff7a1a] dark:hover:text-[#ff7a1a] transition cursor-pointer"
            >
              Runtime Web
            </a>
            <a
              href="#planes"
              onClick={(e) => scrollToSection(e, 'planes')}
              className="hover:text-[#ff7a1a] dark:hover:text-[#ff7a1a] transition cursor-pointer"
            >
              Planes
            </a>
            <a
              href="#faq"
              onClick={(e) => scrollToSection(e, 'faq')}
              className="hover:text-[#ff7a1a] dark:hover:text-[#ff7a1a] transition cursor-pointer"
            >
              FAQ
            </a>
          </nav>

          {/* Right Action CTAs */}
          <div className="flex items-center gap-3">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-xl border border-zinc-200 dark:border-[#2a2a25] text-zinc-600 dark:text-[#8c887b] hover:bg-zinc-100 dark:hover:bg-[#1a1a17] transition cursor-pointer"
              title="Alternar Modo Claro / Oscuro"
            >
              <span
                className={classNames(
                  'text-base',
                  currentTheme === 'dark' ? 'i-ph:sun text-amber-400' : 'i-ph:moon-stars text-zinc-600',
                )}
              />
            </button>

            {state.isAuthenticated ? (
              <div className="flex items-center gap-2">
                <a
                  href="/admin"
                  className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border border-[#ff7a1a]/30 bg-[#ff7a1a]/10 text-[#ff7a1a] hover:bg-[#ff7a1a]/20 transition"
                >
                  <span className="i-ph:gauge text-xs" />
                  <span>Panel Admin</span>
                </a>
                <a
                  href="/"
                  className="px-4 py-2 rounded-xl text-xs font-bold text-[#0a0a09] bg-[#ff7a1a] hover:bg-[#ff8c3a] shadow-md shadow-[#ff7a1a]/20 transition flex items-center gap-1.5"
                >
                  <span className="i-ph:laptop text-sm font-bold" />
                  <span>Abrir Workspace</span>
                </a>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsLoginOpen(true)}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-zinc-700 dark:text-[#d0cbbe] hover:bg-zinc-100 dark:hover:bg-[#1a1a17] border border-transparent hover:border-zinc-200 dark:hover:border-[#2a2a25] transition cursor-pointer"
                >
                  Iniciar Sesión
                </button>
                <a
                  href="/"
                  className="px-4 py-2 rounded-xl text-xs font-bold text-[#0a0a09] bg-[#ff7a1a] hover:bg-[#ff8c3a] shadow-md shadow-[#ff7a1a]/20 transition flex items-center gap-1.5 cursor-pointer"
                >
                  <span>Crear Proyecto</span>
                  <span className="i-ph:arrow-right text-xs font-bold" />
                </a>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ------------------------------------------------------------- */}
      {/* HERO SECTION */}
      {/* ------------------------------------------------------------- */}
      <section className="relative pt-16 pb-20 overflow-hidden">
        {/* Glow backdrop effects */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[350px] bg-[#ff7a1a]/15 blur-[120px] rounded-full pointer-events-none -z-10" />

        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-medium border border-[#ff7a1a]/30 bg-[#ff7a1a]/10 text-[#ff7a1a] animate-fade-in shadow-xs">
            <span className="i-ph:sparkle-fill text-xs" />
            <span>Generador de Software Autónomo • Motor v2.0</span>
          </div>

          {/* Headline */}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-zinc-900 dark:text-[#f2f0e9] font-grotesk max-w-4xl mx-auto leading-[1.12]">
            Construye Sistemas Funcionales con{' '}
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#ff7a1a] via-amber-400 to-[#ff8c3a]">
              Base de Datos y Runtime
            </span>{' '}
            en tu Navegador
          </h1>

          {/* Subtitle */}
          <p className="text-base sm:text-lg text-zinc-600 dark:text-[#9a988e] max-w-2xl mx-auto leading-relaxed">
            GenUI Studio combina inteligencia artificial avanzada, WebContainers en tiempo real y persistencia en caché local
            para transformar cualquier requerimiento en software interactivo y desplegable en segundos.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-3.5 pt-2">
            <a
              href="/"
              className="px-6 py-3.5 rounded-xl text-sm font-bold text-[#0a0a09] bg-[#ff7a1a] hover:bg-[#ff8c3a] shadow-lg shadow-[#ff7a1a]/25 transition flex items-center gap-2 cursor-pointer group"
            >
              <span className="i-ph:play-fill text-base font-bold" />
              <span>Abrir Workspace Gratuito</span>
              <span className="i-ph:arrow-right text-xs group-hover:translate-x-0.5 transition" />
            </a>

            <button
              onClick={() => setIsLoginOpen(true)}
              className="px-5 py-3.5 rounded-xl text-sm font-semibold border border-zinc-200 dark:border-[#2a2a25] bg-white dark:bg-[#131311] hover:bg-zinc-100 dark:hover:bg-[#1a1a17] text-zinc-800 dark:text-[#f2f0e9] transition flex items-center gap-2 cursor-pointer shadow-xs"
            >
              <span className="i-ph:lock-key text-base text-[#ff7a1a]" />
              <span>Acceso de Clientes & Admin</span>
            </button>
          </div>

          {/* Key Metric Highlights */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto pt-8 border-t border-zinc-200 dark:border-[#2a2a25]/80">
            <div className="p-4 rounded-xl bg-white/60 dark:bg-[#131311]/80 border border-zinc-200 dark:border-[#2a2a25]">
              <div className="text-2xl font-black text-[#ff7a1a] font-grotesk">0ms</div>
              <div className="text-xs text-zinc-500 dark:text-[#8c887b] mt-0.5">Latencia de Backend</div>
            </div>
            <div className="p-4 rounded-xl bg-white/60 dark:bg-[#131311]/80 border border-zinc-200 dark:border-[#2a2a25]">
              <div className="text-2xl font-black text-zinc-900 dark:text-[#f2f0e9] font-grotesk">100% Local</div>
              <div className="text-xs text-zinc-500 dark:text-[#8c887b] mt-0.5">Caché & IndexedDB</div>
            </div>
            <div className="p-4 rounded-xl bg-white/60 dark:bg-[#131311]/80 border border-zinc-200 dark:border-[#2a2a25]">
              <div className="text-2xl font-black text-[#ff7a1a] font-grotesk">Multi-LLM</div>
              <div className="text-xs text-zinc-500 dark:text-[#8c887b] mt-0.5">Claude, GPT-4o, Gemini</div>
            </div>
            <div className="p-4 rounded-xl bg-white/60 dark:bg-[#131311]/80 border border-zinc-200 dark:border-[#2a2a25]">
              <div className="text-2xl font-black text-zinc-900 dark:text-[#f2f0e9] font-grotesk">1-Clic</div>
              <div className="text-xs text-zinc-500 dark:text-[#8c887b] mt-0.5">Exportación ZIP & Git</div>
            </div>
          </div>

          {/* Interactive Hero Workspace Graphic */}
          <div className="mt-10 rounded-2xl border border-zinc-200 dark:border-[#2a2a25] bg-white dark:bg-[#131311] shadow-2xl overflow-hidden p-2 sm:p-3 transition-transform hover:scale-[1.005] duration-300">
            <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-100 dark:border-[#2a2a25] bg-zinc-50 dark:bg-[#1a1a17] rounded-t-xl text-xs text-zinc-400">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80 inline-block" />
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80 inline-block" />
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80 inline-block" />
                <span className="text-[11px] font-mono ml-2 text-zinc-500 dark:text-[#8c887b]">
                  workspace.genui.studio • preview
                </span>
              </div>
              <div className="flex items-center gap-2 font-mono text-[10px]">
                <span className="text-emerald-500 font-bold">● Live WebContainer</span>
                <span>Port 5173</span>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-2 p-2 min-h-[360px] text-left">
              {/* Left Column: Chat Simulation */}
              <div className="lg:col-span-4 p-4 rounded-xl bg-zinc-50 dark:bg-[#0a0a09] border border-zinc-200 dark:border-[#2a2a25] flex flex-col justify-between">
                <div className="space-y-3 text-xs">
                  <div className="flex items-center gap-2 pb-2 border-b border-zinc-200 dark:border-[#2a2a25]">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#ff7a1a] to-[#c94f00] text-[#0a0a09] font-bold text-[10px] flex items-center justify-center">
                      A
                    </div>
                    <span className="font-semibold text-zinc-800 dark:text-zinc-200">Usuario</span>
                  </div>
                  <p className="text-zinc-600 dark:text-[#9a988e] bg-zinc-200/50 dark:bg-[#1a1a17] p-2.5 rounded-lg font-mono text-[11px]">
                    "Crea un CRM de clientes con tabla dinámica, estado de leads y base de datos local que se guarde al recargar."
                  </p>
                  <div className="p-2.5 rounded-lg bg-[#ff7a1a]/10 border border-[#ff7a1a]/20 text-[11px] text-[#ff7a1a] space-y-1">
                    <div className="font-bold flex items-center gap-1.5">
                      <span className="i-ph:check-circle-fill text-xs" />
                      <span>GenUI Engine ejecutando:</span>
                    </div>
                    <ul className="text-[10px] text-zinc-600 dark:text-[#d0cbbe] list-disc list-inside space-y-0.5">
                      <li>Creando esquema IndexedDB: 'crm_leads'</li>
                      <li>Inyectando tabla interactiva React + Tailwind</li>
                      <li>Iniciando dev server en WebContainer...</li>
                    </ul>
                  </div>
                </div>
                <div className="text-[10px] font-mono text-zinc-400 dark:text-[#66645b] pt-2 border-t border-zinc-200 dark:border-[#2a2a25]">
                  Tokens deducidos: 450 créditos
                </div>
              </div>

              {/* Right Column: Interactive App Preview */}
              <div className="lg:col-span-8 p-4 rounded-xl bg-white dark:bg-[#1a1a17] border border-zinc-200 dark:border-[#2a2a25] flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-[#2a2a25]">
                    <div className="flex items-center gap-2">
                      <span className="i-ph:database-fill text-[#ff7a1a] text-base" />
                      <span className="font-bold text-xs text-zinc-800 dark:text-[#f2f0e9]">
                        Gestión de Leads • Almacenamiento Local Activo
                      </span>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-500 font-bold">
                      IndexedDB Sincronizada
                    </span>
                  </div>

                  <div className="mt-3 space-y-2">
                    <div className="grid grid-cols-4 gap-2 text-[10px] font-mono font-bold text-zinc-400 dark:text-[#8c887b] px-2 py-1 bg-zinc-50 dark:bg-[#131311] rounded">
                      <span>CLIENTE</span>
                      <span>EMPRESA</span>
                      <span>ESTADO</span>
                      <span className="text-right">VALOR</span>
                    </div>
                    {[
                      { name: 'Sofía Martínez', company: 'Apex Cloud', status: 'Cerrado', value: '$4,200', color: 'text-emerald-500' },
                      { name: 'Mateo Morales', company: 'DevStudio Inc', status: 'En Negociación', value: '$2,800', color: 'text-amber-500' },
                      { name: 'Elena Vega', company: 'FinTech Group', status: 'Contacto Inicial', value: '$7,500', color: 'text-blue-500' },
                    ].map((row, idx) => (
                      <div
                        key={idx}
                        className="grid grid-cols-4 gap-2 text-xs items-center px-2 py-1.5 rounded hover:bg-zinc-50 dark:hover:bg-[#131311] transition"
                      >
                        <span className="font-medium text-zinc-900 dark:text-[#f2f0e9]">{row.name}</span>
                        <span className="text-zinc-500 dark:text-[#8c887b]">{row.company}</span>
                        <span className={classNames('text-[10px] font-bold', row.color)}>● {row.status}</span>
                        <span className="font-mono font-bold text-right text-zinc-800 dark:text-[#f2f0e9]">{row.value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-[#2a2a25] flex items-center justify-between text-[11px] text-zinc-500 dark:text-[#8c887b]">
                  <span className="flex items-center gap-1.5">
                    <span className="i-ph:hard-drive text-xs text-[#ff7a1a]" />
                    <span>Guardado automático en caché del cliente</span>
                  </span>
                  <a href="/" className="font-bold text-[#ff7a1a] hover:underline flex items-center gap-1">
                    <span>Interactuar en vivo</span>
                    <span className="i-ph:arrow-right text-xs" />
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- */}
      {/* 4 CORE PILLARS / CAPABILITIES */}
      {/* ------------------------------------------------------------- */}
      <section id="capacidades" className="scroll-mt-24 py-20 bg-zinc-100/60 dark:bg-[#131311]/50 border-y border-zinc-200 dark:border-[#2a2a25]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center space-y-3 max-w-2xl mx-auto">
            <span className="text-xs font-mono font-bold uppercase tracking-widest text-[#ff7a1a]">
              ARQUITECTURA DE VANGUARDIA
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-zinc-900 dark:text-[#f2f0e9] font-grotesk tracking-tight">
              Diseñado para Desarrolladores, Equipos y Empresas
            </h2>
            <p className="text-sm text-zinc-600 dark:text-[#9a988e]">
              Elimina la fricción entre la generación por IA y el entorno de ejecución real.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Feature 1: Database in Browser Cache */}
            <div id="database" className="scroll-mt-24 rounded-2xl border border-zinc-200 dark:border-[#2a2a25] bg-white dark:bg-[#131311] overflow-hidden flex flex-col shadow-xs group">
              <div className="h-48 overflow-hidden relative">
                <img
                  src="https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=1000&q=80"
                  alt="Base de datos en navegador"
                  className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-white dark:from-[#131311] via-transparent to-transparent" />
                <span className="absolute top-3 left-3 px-2.5 py-1 rounded-md text-[10px] font-mono font-bold uppercase bg-[#ff7a1a] text-[#0a0a09] shadow-sm">
                  Persistencia Híbrida
                </span>
              </div>
              <div className="p-6 flex-1 flex flex-col justify-between space-y-3">
                <div>
                  <h3 className="text-lg font-bold text-zinc-900 dark:text-[#f2f0e9] flex items-center gap-2">
                    <span className="i-ph:database text-xl text-[#ff7a1a]" />
                    <span>Base de Datos en el Caché del Navegador</span>
                  </h3>
                  <p className="text-xs text-zinc-600 dark:text-[#9a988e] mt-2 leading-relaxed">
                    Crea colecciones, tablas y relaciones que se almacenan automáticamente en IndexedDB, localStorage y SQLite client-side. Si el usuario recarga la página o apaga el navegador, toda la información continúa disponible sin costo de servidor.
                  </p>
                </div>
                <div className="pt-3 border-t border-zinc-100 dark:border-[#2a2a25] flex items-center justify-between text-[11px] text-zinc-500 dark:text-[#8c887b]">
                  <span>Soporte Supabase PostgreSQL opcional</span>
                  <span className="text-[#ff7a1a] font-bold">100% Offline-Ready</span>
                </div>
              </div>
            </div>

            {/* Feature 2: WebContainers Runtime */}
            <div id="runtime" className="scroll-mt-24 rounded-2xl border border-zinc-200 dark:border-[#2a2a25] bg-white dark:bg-[#131311] overflow-hidden flex flex-col shadow-xs group">
              <div className="h-48 overflow-hidden relative">
                <img
                  src="https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=1000&q=80"
                  alt="Runtime en el navegador WebContainers"
                  className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-white dark:from-[#131311] via-transparent to-transparent" />
                <span className="absolute top-3 left-3 px-2.5 py-1 rounded-md text-[10px] font-mono font-bold uppercase bg-[#ff7a1a] text-[#0a0a09] shadow-sm">
                  Node.js Client-Side
                </span>
              </div>
              <div className="p-6 flex-1 flex flex-col justify-between space-y-3">
                <div>
                  <h3 className="text-lg font-bold text-zinc-900 dark:text-[#f2f0e9] flex items-center gap-2">
                    <span className="i-ph:browsers text-xl text-[#ff7a1a]" />
                    <span>Runtime Seguro WebContainers</span>
                  </h3>
                  <p className="text-xs text-zinc-600 dark:text-[#9a988e] mt-2 leading-relaxed">
                    Ejecuta paquetes de npm, scripts de compilación Vite y servidores React completos directamente dentro de la sandbox de tu navegador. Sin tiempos de espera en colas de servidor y con máxima seguridad.
                  </p>
                </div>
                <div className="pt-3 border-t border-zinc-100 dark:border-[#2a2a25] flex items-center justify-between text-[11px] text-zinc-500 dark:text-[#8c887b]">
                  <span>Terminal interactivo con salida en tiempo real</span>
                  <span className="text-[#ff7a1a] font-bold">Sin configuración</span>
                </div>
              </div>
            </div>

            {/* Feature 3: Multi-Model Orchestration & Tokens */}
            <div className="rounded-2xl border border-zinc-200 dark:border-[#2a2a25] bg-white dark:bg-[#131311] overflow-hidden flex flex-col shadow-xs group">
              <div className="h-48 overflow-hidden relative">
                <img
                  src="https://images.unsplash.com/photo-1620712943543-bcc4688e7485?auto=format&fit=crop&w=1000&q=80"
                  alt="Modelos de Inteligencia Artificial"
                  className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-white dark:from-[#131311] via-transparent to-transparent" />
                <span className="absolute top-3 left-3 px-2.5 py-1 rounded-md text-[10px] font-mono font-bold uppercase bg-[#ff7a1a] text-[#0a0a09] shadow-sm">
                  Multi-LLM Engine
                </span>
              </div>
              <div className="p-6 flex-1 flex flex-col justify-between space-y-3">
                <div>
                  <h3 className="text-lg font-bold text-zinc-900 dark:text-[#f2f0e9] flex items-center gap-2">
                    <span className="i-ph:brain text-xl text-[#ff7a1a]" />
                    <span>Orquestación de Modelos & Cuotas de Créditos</span>
                  </h3>
                  <p className="text-xs text-zinc-600 dark:text-[#9a988e] mt-2 leading-relaxed">
                    Cambia de modelo en pleno chat: utiliza Claude 3.5 para arquitectura compleja, GPT-4o para interfaces y Gemini para razonamiento ultra rápido. Controla el consumo exacto de tokens con límites y recargas en tiempo real.
                  </p>
                </div>
                <div className="pt-3 border-t border-zinc-100 dark:border-[#2a2a25] flex items-center justify-between text-[11px] text-zinc-500 dark:text-[#8c887b]">
                  <span>Auditoría de IA con registro por consulta</span>
                  <span className="text-[#ff7a1a] font-bold">Tokens Controlados</span>
                </div>
              </div>
            </div>

            {/* Feature 4: Visual Inspector & Instant Code Sync */}
            <div className="rounded-2xl border border-zinc-200 dark:border-[#2a2a25] bg-white dark:bg-[#131311] overflow-hidden flex flex-col shadow-xs group">
              <div className="h-48 overflow-hidden relative">
                <img
                  src="https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1000&q=80"
                  alt="Inspector visual y reportes analíticos"
                  className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-white dark:from-[#131311] via-transparent to-transparent" />
                <span className="absolute top-3 left-3 px-2.5 py-1 rounded-md text-[10px] font-mono font-bold uppercase bg-[#ff7a1a] text-[#0a0a09] shadow-sm">
                  Edición Visual
                </span>
              </div>
              <div className="p-6 flex-1 flex flex-col justify-between space-y-3">
                <div>
                  <h3 className="text-lg font-bold text-zinc-900 dark:text-[#f2f0e9] flex items-center gap-2">
                    <span className="i-ph:cursor-click text-xl text-[#ff7a1a]" />
                    <span>Inspector Visual & Reportes Analíticos</span>
                  </h3>
                  <p className="text-xs text-zinc-600 dark:text-[#9a988e] mt-2 leading-relaxed">
                    Haz clic sobre cualquier elemento visual generado para enfocar a la IA en ese componente. Genera reportes técnicos completos con diagnóstico de código y métricas de seguridad descargables.
                  </p>
                </div>
                <div className="pt-3 border-t border-zinc-100 dark:border-[#2a2a25] flex items-center justify-between text-[11px] text-zinc-500 dark:text-[#8c887b]">
                  <span>Exportación de informes ejecutivos</span>
                  <span className="text-[#ff7a1a] font-bold">Precisión Quirúrgica</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- */}
      {/* HOW IT WORKS SECTION */}
      {/* ------------------------------------------------------------- */}
      <section className="py-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center space-y-2">
            <span className="text-xs font-mono font-bold uppercase tracking-widest text-[#ff7a1a]">
              FLUJO INTUITIVO
            </span>
            <h2 className="text-3xl font-extrabold text-zinc-900 dark:text-[#f2f0e9] font-grotesk">
              De la Idea a la Aplicación en 4 Pasos
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                step: '01',
                title: 'Describe el Sistema',
                desc: 'Escribe en lenguaje natural lo que necesitas: un ERP, panel de inventario, CRM o tienda interactiva.',
              },
              {
                step: '02',
                title: 'Generación de Código & Tablas',
                desc: 'La IA estructura los componentes React, estilos Tailwind y el esquema de base de datos en caché.',
              },
              {
                step: '03',
                title: 'Ejecución en Tiempo Real',
                desc: 'El WebContainer monta el servidor en vivo en tu pestaña para probar y cargar registros inmediatamente.',
              },
              {
                step: '04',
                title: 'Exporta o Despliega',
                desc: 'Descarga el proyecto completo en .ZIP o sincroniza directamente con GitHub y proveedores cloud.',
              },
            ].map((s, idx) => (
              <div
                key={idx}
                className="p-6 rounded-2xl bg-white dark:bg-[#131311] border border-zinc-200 dark:border-[#2a2a25] space-y-3 relative group hover:border-[#ff7a1a]/40 transition"
              >
                <div className="text-3xl font-black text-[#ff7a1a]/30 group-hover:text-[#ff7a1a] transition font-mono">
                  {s.step}
                </div>
                <h4 className="text-sm font-bold text-zinc-900 dark:text-[#f2f0e9]">{s.title}</h4>
                <p className="text-xs text-zinc-600 dark:text-[#9a988e] leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- */}
      {/* PRICING / PLANS SECTION */}
      {/* ------------------------------------------------------------- */}
      <section id="planes" className="scroll-mt-24 py-20 bg-zinc-100/60 dark:bg-[#131311]/50 border-t border-zinc-200 dark:border-[#2a2a25]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center space-y-3 max-w-xl mx-auto">
            <span className="text-xs font-mono font-bold uppercase tracking-widest text-[#ff7a1a]">
              PLANES TRANSPARENTES
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-zinc-900 dark:text-[#f2f0e9] font-grotesk">
              Elige el Plan que se Ajuste a tu Ritmo
            </h2>
            <p className="text-sm text-zinc-600 dark:text-[#9a988e]">
              Comienza gratis hoy mismo o desbloquea cuotas ilimitadas para tu equipo.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {state.plans.map((plan) => (
              <div
                key={plan.id}
                className={classNames(
                  'rounded-2xl p-6 flex flex-col justify-between border transition relative bg-white dark:bg-[#131311]',
                  plan.isPopular
                    ? 'border-[#ff7a1a]/60 shadow-xl shadow-[#ff7a1a]/10 ring-1 ring-[#ff7a1a]/40'
                    : 'border-zinc-200 dark:border-[#2a2a25]',
                )}
              >
                {plan.isPopular && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-gradient-to-r from-[#ff7a1a] to-[#d65f00] text-[#0a0a09] shadow-sm">
                    Recomendado
                  </span>
                )}

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold text-zinc-900 dark:text-[#f2f0e9]">{plan.name}</h3>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded uppercase bg-zinc-100 dark:bg-[#1a1a17] text-zinc-600 dark:text-[#8c887b]">
                      {plan.badge}
                    </span>
                  </div>

                  <div>
                    <div className="text-3xl font-black text-zinc-900 dark:text-[#f2f0e9] font-grotesk">
                      ${plan.priceMonthly}
                      <span className="text-xs font-normal text-zinc-400"> / mes</span>
                    </div>
                    <p className="text-[11px] text-zinc-500 dark:text-[#8c887b] mt-1">{plan.description}</p>
                  </div>

                  <div className="p-3 rounded-xl bg-zinc-50 dark:bg-[#1a1a17] border border-zinc-100 dark:border-[#2a2a25] text-xs space-y-1">
                    <span className="text-[10px] text-zinc-400 uppercase font-mono">Créditos IA:</span>
                    <div className="font-mono font-bold text-[#ff7a1a] text-sm">
                      {plan.creditsMonthly.toLocaleString()} pts
                    </div>
                  </div>

                  <ul className="space-y-2 text-xs">
                    {plan.features.map((f, i) => (
                      <li key={i} className="flex items-start gap-2 text-zinc-600 dark:text-[#d0cbbe]">
                        <span className="i-ph:check-circle-fill text-[#ff7a1a] text-sm shrink-0 mt-0.5" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <a
                  href="/"
                  className={classNames(
                    'mt-6 w-full py-2.5 px-4 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-sm',
                    plan.isPopular
                      ? 'bg-[#ff7a1a] hover:bg-[#ff8c3a] text-[#0a0a09] font-bold'
                      : 'bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-100 text-white dark:text-zinc-900',
                  )}
                >
                  <span>{plan.priceMonthly === 0 ? 'Comenzar Gratis' : 'Elegir Plan'}</span>
                  <span className="i-ph:arrow-right text-xs" />
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- */}
      {/* FAQ SECTION */}
      {/* ------------------------------------------------------------- */}
      <section id="faq" className="scroll-mt-24 py-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="text-center space-y-2">
            <span className="text-xs font-mono font-bold uppercase tracking-widest text-[#ff7a1a]">
              PREGUNTAS FRECUENTES
            </span>
            <h2 className="text-3xl font-extrabold text-zinc-900 dark:text-[#f2f0e9] font-grotesk">
              Todo lo que Necesitas Saber
            </h2>
          </div>

          <div className="space-y-3">
            {faqs.map((faq, idx) => (
              <div
                key={idx}
                className="rounded-2xl border border-zinc-200 dark:border-[#2a2a25] bg-white dark:bg-[#131311] overflow-hidden transition"
              >
                <button
                  onClick={() => setActiveFaq(activeFaq === idx ? null : idx)}
                  className="w-full p-4 sm:p-5 flex items-center justify-between text-left text-sm font-bold text-zinc-900 dark:text-[#f2f0e9] cursor-pointer hover:text-[#ff7a1a] dark:hover:text-[#ff7a1a] transition"
                >
                  <span>{faq.q}</span>
                  <span
                    className={classNames(
                      'text-base text-zinc-400 transition-transform duration-200 shrink-0 ml-3',
                      activeFaq === idx ? 'i-ph:caret-up-bold text-[#ff7a1a]' : 'i-ph:caret-down-bold',
                    )}
                  />
                </button>
                {activeFaq === idx && (
                  <div className="px-5 pb-5 text-xs text-zinc-600 dark:text-[#9a988e] leading-relaxed border-t border-zinc-100 dark:border-[#1a1a17] pt-3">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- */}
      {/* CALL TO ACTION BOTTOM BANNER */}
      {/* ------------------------------------------------------------- */}
      <section className="py-16 px-4 bg-gradient-to-br from-[#1a1a17] to-[#0a0a09] border-t border-zinc-200 dark:border-[#2a2a25] text-white text-center relative overflow-hidden">
        <div className="max-w-4xl mx-auto space-y-5 relative z-10">
          <img
            src="/logo-genui.png"
            alt="GenUI Studio"
            className="w-14 h-14 rounded-2xl object-cover shadow-2xl ring-2 ring-[#ff7a1a]/60 mx-auto"
          />
          <h2 className="text-3xl sm:text-4xl font-black font-grotesk tracking-tight text-[#f2f0e9]">
            Construye tu primer software con base de datos en menos de 2 minutos
          </h2>
          <p className="text-sm text-[#9a988e] max-w-xl mx-auto">
            Sin instalaciones complejas, sin tarjetas de crédito obligatorias. Solo describe tu visión y deja que GenUI Studio se encargue del resto.
          </p>
          <div className="pt-2 flex flex-wrap items-center justify-center gap-4">
            <a
              href="/"
              className="px-6 py-3.5 rounded-xl text-sm font-bold text-[#0a0a09] bg-[#ff7a1a] hover:bg-[#ff8c3a] shadow-xl shadow-[#ff7a1a]/30 transition flex items-center gap-2 cursor-pointer"
            >
              <span className="i-ph:sparkle-fill text-base" />
              <span>Lanzar GenUI Workspace</span>
            </a>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- */}
      {/* FOOTER */}
      {/* ------------------------------------------------------------- */}
      <footer className="border-t border-zinc-200 dark:border-[#2a2a25] py-10 bg-white dark:bg-[#0a0a09] text-xs text-zinc-500 dark:text-[#8c887b]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <img src="/logo-genui.png" alt="GenUI Logo" className="w-6 h-6 rounded-md object-cover" />
            <span className="font-bold text-zinc-800 dark:text-[#f2f0e9]">
              GenUI<span className="text-[#ff7a1a] font-normal ml-0.5">Studio</span>
            </span>
            <span>• Plataforma de Desarrollo Autónomo con IA</span>
          </div>
          <div className="flex items-center gap-6">
            <a href="/" className="hover:text-[#ff7a1a] transition">
              Workspace
            </a>
            <a href="/login" className="hover:text-[#ff7a1a] transition">
              Iniciar Sesión
            </a>
            <a href="/admin" className="hover:text-[#ff7a1a] transition">
              Panel Admin
            </a>
          </div>
        </div>
      </footer>

      {/* Login & Register Modal */}
      <LoginModal
        isOpen={isLoginOpen}
        onClose={() => setIsLoginOpen(false)}
        initialMode={loginModalMode}
        redirectTo="/"
      />
    </div>
  );
}
