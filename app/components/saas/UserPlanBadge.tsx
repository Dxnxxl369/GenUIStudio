import React, { useState, useRef, useEffect } from 'react';
import { useStore } from '@nanostores/react';
import {
  saasStore,
  currentUser,
  currentPlan,
  saasActions,
  type SaaSUser,
} from '~/lib/stores/saasStore';
import { themeStore, toggleTheme } from '~/lib/stores/theme';
import { PlanUpgradeModal } from './PlanUpgradeModal';
import { LoginModal } from './LoginModal';
import { toast } from 'react-toastify';
import { classNames } from '~/utils/classNames';

export function UserPlanBadge() {
  const state = useStore(saasStore);
  const user = useStore(currentUser);
  const plan = useStore(currentPlan);
  const currentTheme = useStore(themeStore);

  const [isOpen, setIsOpen] = useState(false);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const creditsRemaining = Math.max(user.creditsTotal - user.creditsUsed, 0);
  const creditsPercent = Math.round((creditsRemaining / user.creditsTotal) * 100);

  const batteryColor =
    creditsPercent > 40
      ? 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20'
      : creditsPercent > 15
      ? 'text-amber-500 bg-amber-500/10 border-amber-500/20'
      : 'text-rose-500 bg-rose-500/10 border-rose-500/20';

  const planBadgeColors: Record<string, string> = {
    plan_free: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 border-zinc-300 dark:border-zinc-700',
    plan_pro: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30',
    plan_team: 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30',
    plan_enterprise: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30',
  };

  // If user is not authenticated, render Login / Register trigger
  if (!state.isAuthenticated) {
    return (
      <>
        <div className="flex items-center gap-2">
          <a
            href="/landing"
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-600 dark:text-[#9a988e] hover:text-zinc-900 dark:hover:text-[#f2f0e9] hover:bg-zinc-100 dark:hover:bg-[#1a1a17] transition"
            title="Conoce cómo funciona GenUI Studio"
          >
            <span className="i-ph:info text-sm text-[#ff7a1a]" />
            <span>¿Qué es GenUI?</span>
          </a>
          <button
            onClick={() => setIsLoginModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold text-[#0a0a09] bg-[#ff7a1a] hover:bg-[#ff8c3a] shadow-sm shadow-[#ff7a1a]/20 transition cursor-pointer"
          >
            <span className="i-ph:sign-in text-sm font-bold" />
            <span>Iniciar Sesión</span>
          </button>
        </div>
        <LoginModal isOpen={isLoginModalOpen} onClose={() => setIsLoginModalOpen(false)} />
      </>
    );
  }

  return (
    <>
      <div className="relative flex items-center gap-2" ref={dropdownRef}>
        {/* If user is Admin, button linking to /admin */}
        {(user.role === 'admin' || user.role === 'superadmin') && (
          <a
            href="/admin"
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-orange-300/80 dark:border-[#ff7a1a]/30 bg-orange-50/90 hover:bg-orange-100 text-orange-900 dark:bg-[#ff7a1a]/15 dark:text-[#ff7a1a] dark:hover:bg-[#ff7a1a]/25 shadow-xs transition"
            title="Abrir Consola de Administración SaaS"
          >
            <span className="i-ph:sliders-horizontal text-xs" />
            <span>Panel Admin</span>
          </a>
        )}

        {/* Quick Upgrade button for Free & Pro users */}
        {user.planId !== 'plan_enterprise' && (
          <button
            onClick={() => setIsUpgradeModalOpen(true)}
            className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-orange-500/10 text-orange-600 dark:text-[#ff7a1a] border border-orange-500/25 hover:bg-orange-500/20 transition cursor-pointer"
            title="Ver planes y mejorar suscripción"
          >
            <span className="i-ph:sparkle text-xs" />
            <span>Mejorar Plan</span>
          </button>
        )}

        {/* Credits Meter Pill with live balance */}
        <div
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11.5px] font-mono border border-zinc-200 dark:border-[#2a2a25] bg-zinc-50 dark:bg-[#131311] cursor-pointer select-none transition hover:border-[#ff7a1a]"
          onClick={() => setIsOpen(!isOpen)}
          title={`Balance: ${creditsRemaining.toLocaleString()} de ${user.creditsTotal.toLocaleString()} créditos (${creditsPercent}% restante)`}
        >
          <b className="text-[#ff7a1a] font-bold">
            {creditsRemaining >= 1000000
              ? `${(creditsRemaining / 1000000).toFixed(2)}M`
              : creditsRemaining >= 1000
              ? `${(creditsRemaining / 1000).toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}k`
              : creditsRemaining.toLocaleString('es-ES')}
          </b>
          <span className="text-zinc-500 dark:text-[#9a988e]">créditos</span>
        </div>

        {/* User Pill & Initial-based Avatar Trigger */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 p-1 pr-2 rounded-full border border-zinc-200 dark:border-[#2a2a25] bg-zinc-50 dark:bg-[#131311] hover:bg-zinc-100 dark:hover:bg-[#1a1a17] transition cursor-pointer shadow-xs"
        >
          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#ff7a1a] to-[#c94f00] text-[#0a0a09] font-bold text-[11px] flex items-center justify-center shrink-0 shadow-xs font-grotesk">
            {user.name?.[0]?.toUpperCase() || 'U'}
          </div>
          <span className="text-xs font-medium text-zinc-800 dark:text-zinc-200 hidden lg:inline max-w-[100px] truncate">
            {user.name.split(' ')[0]}
          </span>
          <span
            className={classNames(
              'px-1.5 py-0.5 text-[9px] font-bold rounded-md uppercase tracking-wider border',
              planBadgeColors[user.planId] || planBadgeColors.plan_free,
            )}
          >
            {plan.badge}
          </span>
          <span className="i-ph:caret-down text-xs text-zinc-400" />
        </button>

        {/* Dropdown Menu */}
        {isOpen && (
          <div className="absolute right-0 top-full mt-2 w-80 rounded-2xl border border-zinc-200 dark:border-[#2a2a25] bg-white dark:bg-[#131311] shadow-2xl p-4 z-50 text-zinc-900 dark:text-[#f2f0e9] animate-in fade-in-0 zoom-in-95">
            {/* User Details */}
            <div className="flex items-center gap-3 pb-3 border-b border-zinc-200 dark:border-[#2a2a25]">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#ff7a1a] to-[#c94f00] text-[#0a0a09] font-bold text-base flex items-center justify-center shrink-0 shadow-sm font-grotesk">
                {user.name?.[0]?.toUpperCase() || 'U'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <h4 className="text-sm font-bold text-zinc-900 dark:text-[#f2f0e9] truncate">{user.name}</h4>
                  {user.role === 'superadmin' && (
                    <span className="i-ph:shield-check-fill text-xs text-amber-400" title="SuperAdmin" />
                  )}
                </div>
                <p className="text-xs text-zinc-500 dark:text-[#9a988e] truncate">{user.email}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span
                    className={classNames(
                      'px-1.5 py-0.2 rounded text-[9px] font-bold uppercase',
                      planBadgeColors[user.planId],
                    )}
                  >
                    Plan {plan.name}
                  </span>
                  {user.company && (
                    <span className="text-[10px] text-zinc-400 dark:text-[#66645b] truncate">• {user.company}</span>
                  )}
                </div>
              </div>
            </div>

            {/* Credit Progress Card */}
            <div className="my-3 p-3 rounded-xl bg-zinc-50 dark:bg-[#1a1a17] border border-zinc-200 dark:border-[#2a2a25] space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-600 dark:text-[#9a988e] font-medium">Balance de Créditos</span>
                <span className="font-mono font-bold text-[#ff7a1a]">
                  {creditsRemaining.toLocaleString()} / {user.creditsTotal.toLocaleString()}
                </span>
              </div>
              <div className="w-full bg-zinc-200 dark:bg-[#2a2a25] h-2 rounded-full overflow-hidden">
                <div
                  className="bg-gradient-to-r from-[#ff7a1a] to-amber-400 h-full rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(creditsPercent, 100)}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[10px] text-zinc-500 dark:text-[#66645b]">
                <span>{creditsPercent}% restante ({creditsRemaining.toLocaleString()} créditos)</span>
                <span>Descontado en tiempo real</span>
              </div>
            </div>

            {/* Actions List */}
            <div className="space-y-1 text-xs">
              {(user.role === 'admin' || user.role === 'superadmin') && (
                <a
                  href="/admin"
                  className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg font-semibold text-orange-600 dark:text-[#ff7a1a] hover:bg-orange-500/10 transition bg-transparent"
                  onClick={() => setIsOpen(false)}
                >
                  <span className="i-ph:gauge text-base" />
                  <span>Panel de Control (Admin)</span>
                </a>
              )}

              <button
                onClick={() => {
                  setIsOpen(false);
                  setIsUpgradeModalOpen(true);
                }}
                className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 font-semibold transition cursor-pointer bg-transparent"
              >
                <span className="i-ph:sparkle text-base" />
                <span>Ver Planes y Mejorar Cuota</span>
              </button>

              <button
                onClick={toggleTheme}
                className="flex items-center justify-between w-full px-3 py-2 rounded-lg hover:bg-bolt-elements-item-backgroundHover transition text-bolt-elements-textPrimary cursor-pointer bg-transparent"
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className={classNames(
                      'text-base',
                      currentTheme === 'dark' ? 'i-ph:moon-stars text-indigo-400' : 'i-ph:sun text-amber-500',
                    )}
                  />
                  <span>Tema: {currentTheme === 'dark' ? 'Modo Oscuro' : 'Modo Claro'}</span>
                </div>
                <span className="text-[10px] uppercase font-mono text-bolt-elements-textTertiary">Cambiar</span>
              </button>

              <button
                onClick={() => {
                  saasActions.logout();
                  setIsOpen(false);
                  toast.info('Sesión cerrada correctamente');
                  if (typeof window !== 'undefined' && window.location.pathname.startsWith('/chat')) {
                    window.location.href = '/';
                  }
                }}
                className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg hover:bg-rose-500/10 text-rose-600 dark:text-rose-400 transition cursor-pointer bg-transparent"
              >
                <span className="i-ph:sign-out text-base" />
                <span>Cerrar Sesión</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Subscription Modal */}
      <PlanUpgradeModal
        isOpen={isUpgradeModalOpen}
        onClose={() => setIsUpgradeModalOpen(false)}
      />

      {/* Login Modal */}
      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
      />
    </>
  );
}
