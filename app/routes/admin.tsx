import React, { useState, useMemo, useEffect } from 'react';
import { useStore } from '@nanostores/react';
import { toast } from 'react-toastify';
import type { MetaFunction } from '@remix-run/cloudflare';
import {
  saasStore,
  currentUser,
  saasMetrics,
  saasActions,
  type PlanTier,
  type UserRole,
  type SaaSUser,
  type SaaSPlan,
} from '~/lib/stores/saasStore';
import { themeStore, toggleTheme } from '~/lib/stores/theme';
import { classNames } from '~/utils/classNames';

export const meta: MetaFunction = () => {
  return [
    { title: 'Panel de Administración SaaS • GenUI Studio' },
    { name: 'description', content: 'Consola de gestión de usuarios, suscripciones y consumo de IA' },
  ];
};

export default function AdminDashboard() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const state = useStore(saasStore);
  const user = useStore(currentUser);
  const metrics = useStore(saasMetrics);
  const currentTheme = useStore(themeStore);

  const [activeTab, setActiveTab] = useState<'metrics' | 'users' | 'plans' | 'logs'>('metrics');
  const [searchUser, setSearchUser] = useState('');
  const [filterPlan, setFilterPlan] = useState<string>('all');

  // Modal states
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserCompany, setNewUserCompany] = useState('');
  const [newUserPlan, setNewUserPlan] = useState<PlanTier>('plan_pro');
  const [newUserRole, setNewUserRole] = useState<UserRole>('user');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [showNewUserPassword, setShowNewUserPassword] = useState(false);

  const [rechargeUser, setRechargeUser] = useState<SaaSUser | null>(null);
  const [rechargeAmount, setRechargeAmount] = useState(50000);

  // Filtered users (Hook MUST be declared before any conditional returns)
  const filteredUsers = useMemo(() => {
    return state.users.filter((u) => {
      const matchesSearch =
        u.name.toLowerCase().includes(searchUser.toLowerCase()) ||
        u.email.toLowerCase().includes(searchUser.toLowerCase()) ||
        (u.company && u.company.toLowerCase().includes(searchUser.toLowerCase()));
      const matchesPlan = filterPlan === 'all' || u.planId === filterPlan;
      return matchesSearch && matchesPlan;
    });
  }, [state.users, searchUser, filterPlan]);

  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 text-emerald-500">
        <span className="i-svg-spinners:90-ring-with-bg text-3xl" />
      </div>
    );
  }

  const isAdmin = user && (user.role === 'admin' || user.role === 'superadmin');

  // Permission Gate: 403 Access Denied for non-admin accounts
  if (!state.isAuthenticated || !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-bolt-elements-background-depth-1 text-bolt-elements-textPrimary font-sans">
        <div className="max-w-md w-full rounded-2xl border border-rose-500/30 bg-bolt-elements-background-depth-2 shadow-2xl p-6 sm:p-8 space-y-5 text-center">
          <div className="inline-flex p-4 rounded-2xl bg-rose-500/10 text-rose-500 border border-rose-500/20 mb-1">
            <span className="i-ph:shield-warning text-3xl" />
          </div>
          <div>
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 bg-rose-500/10 px-2.5 py-0.5 rounded-full border border-rose-500/20">
              Error 403 • Acceso Prohibido
            </span>
            <h2 className="text-xl font-bold text-bolt-elements-textPrimary mt-2">
              Se Requiere Rol de Administrador
            </h2>
            <p className="text-xs text-bolt-elements-textSecondary mt-1.5">
              Esta área está reservada exclusivamente para Administradores de GenUI Studio.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor text-left text-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-bolt-elements-textTertiary">Usuario Conectado:</span>
              <span className="font-bold text-bolt-elements-textPrimary">{user?.name || 'Invitado'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-bolt-elements-textTertiary">Rol Actual:</span>
              <span className="font-mono text-amber-500 font-bold uppercase">{user?.role || 'none'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-bolt-elements-textTertiary">Plan de Cuenta:</span>
              <span className="font-bold text-emerald-500 uppercase">{user?.planId?.replace('plan_', '') || 'free'}</span>
            </div>
          </div>

          <div className="space-y-2 pt-2">
            <a
              href="/login"
              className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 shadow-md shadow-purple-600/20 transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <span className="i-ph:sign-in text-sm" />
              <span>Iniciar Sesión como Administrador</span>
            </a>

            <a
              href="/"
              className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundHover border border-bolt-elements-borderColor transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <span className="i-ph:arrow-left text-sm" />
              <span>Volver a la Vista de Usuario (Workspace)</span>
            </a>
          </div>
        </div>
      </div>
    );
  }

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName.trim() || !newUserEmail.trim()) {
      toast.warn('Por favor ingresa nombre y correo electrónico');
      return;
    }

    saasActions.createUser(
      newUserName,
      newUserEmail,
      newUserPlan,
      newUserRole,
      newUserCompany || 'Empresa',
      newUserPassword || 'GenUI2026!',
    );
    toast.success(`Usuario ${newUserName} creado con éxito`);
    setIsAddUserModalOpen(false);
    setNewUserName('');
    setNewUserEmail('');
    setNewUserCompany('');
    setNewUserPassword('');
  };

  const handleApplyRecharge = () => {
    if (!rechargeUser) return;
    saasActions.rechargeCredits(rechargeUser.id, rechargeAmount);
    toast.success(`Se recargaron ${rechargeAmount.toLocaleString()} créditos a ${rechargeUser.name}`);
    setRechargeUser(null);
  };

  const planBadges: Record<string, { label: string; color: string }> = {
    plan_free: { label: 'FREE', color: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700' },
    plan_pro: { label: 'PRO', color: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30' },
    plan_team: { label: 'TEAM', color: 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30' },
    plan_enterprise: { label: 'ENTERPRISE', color: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30' },
  };

  return (
    <div className="min-h-screen flex flex-col bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-sans transition-colors duration-200">
      {/* Top Admin Navbar */}
      <header className="sticky top-0 z-40 border-b border-zinc-200 dark:border-[#2a2a25] bg-white/90 dark:bg-[#0a0a09]/90 backdrop-blur-md px-4 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <a href="/" className="flex items-center gap-2.5 group">
            <img
              src="/logo-genui.png"
              alt="GenUI Studio"
              className="w-9 h-9 rounded-xl object-cover shadow-sm ring-1 ring-[#ff7a1a]/40 group-hover:scale-105 transition"
            />
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="text-base font-black tracking-tight text-zinc-900 dark:text-[#f2f0e9]">
                  GenUI<span className="text-[#ff7a1a] font-normal ml-0.5">Studio</span>
                </span>
                <span className="px-2 py-0.5 text-[9px] font-black tracking-wider uppercase rounded-full bg-[#ff7a1a]/15 text-[#ff7a1a] border border-[#ff7a1a]/30">
                  ADMIN CONSOLE
                </span>
              </div>
              <span className="text-[10px] text-zinc-500 dark:text-[#8c887b] font-mono -mt-0.5">
                PLATAFORMA SAAS & GOBERNANZA IA
              </span>
            </div>
          </a>
        </div>

        {/* Top Actions */}
        <div className="flex items-center gap-3">
          {/* Active Admin Profile */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-zinc-100 dark:bg-[#1a1a17] border border-zinc-200 dark:border-[#2a2a25]">
            <div className="w-5 h-5 rounded-full bg-gradient-to-br from-[#ff7a1a] to-[#c94f00] text-[#0a0a09] font-bold text-[10px] flex items-center justify-center shrink-0">
              {user.name?.[0]?.toUpperCase() || 'A'}
            </div>
            <span className="text-xs font-bold text-zinc-800 dark:text-[#f2f0e9] hidden sm:inline">{user.name}</span>
            <span className="px-1.5 py-0.2 rounded text-[9px] font-black uppercase tracking-wider bg-[#ff7a1a]/15 text-[#ff7a1a] border border-[#ff7a1a]/30">
              {user.role}
            </span>
          </div>

          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg border border-zinc-200 dark:border-[#2a2a25] text-zinc-600 dark:text-[#8c887b] hover:bg-zinc-100 dark:hover:bg-[#1a1a17] transition cursor-pointer"
            title="Alternar Modo Claro / Oscuro"
          >
            <span
              className={classNames(
                'text-lg',
                currentTheme === 'dark' ? 'i-ph:sun text-amber-400' : 'i-ph:moon-stars text-zinc-600',
              )}
            />
          </button>

          {/* Return to App Workspace */}
          <a
            href="/"
            className="px-3.5 py-2 rounded-xl text-xs font-bold bg-[#ff7a1a] hover:bg-[#ff8c3a] text-[#0a0a09] transition flex items-center gap-2 shadow-md shadow-[#ff7a1a]/20"
          >
            <span className="i-ph:desktop-tower-fill text-sm" />
            <span>Volver al Workspace</span>
          </a>

          {/* Logout */}
          <button
            onClick={() => {
              saasActions.logout();
              toast.info('Sesión cerrada correctamente');
              window.location.href = '/login';
            }}
            className="p-2 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 border border-zinc-200 dark:border-[#2a2a25] transition cursor-pointer flex items-center gap-1.5"
            title="Cerrar Sesión de Administrador"
          >
            <span className="i-ph:sign-out text-base" />
            <span className="hidden lg:inline">Salir</span>
          </button>
        </div>
      </header>

      {/* Admin Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Navigation Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-200 dark:border-[#2a2a25] pb-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('metrics')}
              className={classNames(
                'px-4 py-2 text-xs font-bold rounded-xl transition flex items-center gap-2 cursor-pointer',
                activeTab === 'metrics'
                  ? 'bg-[#ff7a1a] text-[#0a0a09] shadow-sm shadow-[#ff7a1a]/20'
                  : 'text-zinc-600 dark:text-[#8c887b] hover:bg-zinc-200/60 dark:hover:bg-[#1a1a17]',
              )}
            >
              <span className="i-ph:chart-line-up text-base" />
              <span>Resumen & Métricas</span>
            </button>

            <button
              onClick={() => setActiveTab('users')}
              className={classNames(
                'px-4 py-2 text-xs font-bold rounded-xl transition flex items-center gap-2 cursor-pointer',
                activeTab === 'users'
                  ? 'bg-[#ff7a1a] text-[#0a0a09] shadow-sm shadow-[#ff7a1a]/20'
                  : 'text-zinc-600 dark:text-[#8c887b] hover:bg-zinc-200/60 dark:hover:bg-[#1a1a17]',
              )}
            >
              <span className="i-ph:users-three text-base" />
              <span>Gestión de Usuarios ({state.users.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('plans')}
              className={classNames(
                'px-4 py-2 text-xs font-bold rounded-xl transition flex items-center gap-2 cursor-pointer',
                activeTab === 'plans'
                  ? 'bg-[#ff7a1a] text-[#0a0a09] shadow-sm shadow-[#ff7a1a]/20'
                  : 'text-zinc-600 dark:text-[#8c887b] hover:bg-zinc-200/60 dark:hover:bg-[#1a1a17]',
              )}
            >
              <span className="i-ph:diamonds-four text-base" />
              <span>Planes & Cuotas ({state.plans.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('logs')}
              className={classNames(
                'px-4 py-2 text-xs font-bold rounded-xl transition flex items-center gap-2 cursor-pointer',
                activeTab === 'logs'
                  ? 'bg-[#ff7a1a] text-[#0a0a09] shadow-sm shadow-[#ff7a1a]/20'
                  : 'text-zinc-600 dark:text-[#8c887b] hover:bg-zinc-200/60 dark:hover:bg-[#1a1a17]',
              )}
            >
              <span className="i-ph:terminal-window text-base" />
              <span>Auditoría de IA ({state.logs.length})</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (confirm('¿Restablecer los datos semilla originales del SaaS?')) {
                  saasActions.resetDefaults();
                  toast.success('Datos semilla restablecidos correctamente');
                }
              }}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200/60 dark:hover:bg-zinc-800 transition cursor-pointer flex items-center gap-1.5"
              title="Restablece usuarios y planes al estado inicial"
            >
              <span className="i-ph:arrows-counter-clockwise text-sm" />
              <span>Reiniciar Seed Data</span>
            </button>
          </div>
        </div>

        {/* TAB 1: METRICS & EXECUTIVE DASHBOARD */}
        {activeTab === 'metrics' && (
          <div className="space-y-6">
            {/* Top KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* MRR Card */}
              <div className="p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm flex flex-col justify-between">
                <div className="flex items-center justify-between text-xs font-bold text-zinc-400 uppercase tracking-wider">
                  <span>Ingresos Mensuales (MRR)</span>
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                    <span className="i-ph:currency-dollar text-lg" />
                  </div>
                </div>
                <div className="text-3xl font-black text-zinc-900 dark:text-white mt-2 mb-1">
                  ${metrics.mrr} <span className="text-xs text-zinc-400 font-normal">USD / mes</span>
                </div>
                <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400 font-medium">
                  <span>ARR Proyectado:</span>
                  <span className="font-mono font-bold text-emerald-500">${metrics.arr.toLocaleString()} USD</span>
                </div>
              </div>

              {/* Users Breakdown Card */}
              <div className="p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm flex flex-col justify-between">
                <div className="flex items-center justify-between text-xs font-bold text-zinc-400 uppercase tracking-wider">
                  <span>Usuarios Activos</span>
                  <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center">
                    <span className="i-ph:users text-lg" />
                  </div>
                </div>
                <div className="text-3xl font-black text-zinc-900 dark:text-white mt-2 mb-1">
                  {metrics.totalUsers} <span className="text-xs text-zinc-400 font-normal">totales</span>
                </div>
                <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400 font-medium">
                  <span>Suscripciones Pago:</span>
                  <span className="font-mono font-bold text-blue-500">{metrics.payingUsers} ({Math.round((metrics.payingUsers / metrics.totalUsers) * 100)}%)</span>
                </div>
              </div>

              {/* Total AI Credits Consumed */}
              <div className="p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm flex flex-col justify-between">
                <div className="flex items-center justify-between text-xs font-bold text-zinc-400 uppercase tracking-wider">
                  <span>Créditos IA Consumidos</span>
                  <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-500 flex items-center justify-center">
                    <span className="i-ph:lightning-fill text-lg" />
                  </div>
                </div>
                <div className="text-3xl font-black text-zinc-900 dark:text-white mt-2 mb-1">
                  {(metrics.totalCreditsUsed / 1000).toFixed(1)}k
                </div>
                <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400 font-medium">
                  <span>Tokens Procesados:</span>
                  <span className="font-mono font-bold text-purple-500">{metrics.totalTokensLogged.toLocaleString()}</span>
                </div>
              </div>

              {/* Net Margin Card */}
              <div className="p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm flex flex-col justify-between">
                <div className="flex items-center justify-between text-xs font-bold text-zinc-400 uppercase tracking-wider">
                  <span>Margen Bruto SaaS</span>
                  <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center">
                    <span className="i-ph:trend-up text-lg" />
                  </div>
                </div>
                <div className="text-3xl font-black text-emerald-500 mt-2 mb-1">
                  {metrics.marginPercent}%
                </div>
                <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400 font-medium">
                  <span>Costo APIs: ${metrics.totalApiCostUSD.toFixed(3)}</span>
                  <span className="font-mono font-bold text-emerald-500">+${metrics.profitUSD} netos</span>
                </div>
              </div>
            </div>

            {/* Financial & Operational Insights */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Distribution by Plan */}
              <div className="lg:col-span-2 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-white uppercase tracking-wider">
                    Desglose de Clientes por Plan
                  </h3>
                  <span className="text-xs text-zinc-400">Total ingresos: ${metrics.mrr} USD/mes</span>
                </div>

                <div className="space-y-3">
                  {state.plans.map((p) => {
                    const count = state.users.filter((u) => u.planId === p.id).length;
                    const revenue = count * p.priceMonthly;
                    const pct = Math.round((count / state.users.length) * 100);
                    return (
                      <div key={p.id} className="space-y-1.5 text-xs">
                        <div className="flex items-center justify-between font-semibold">
                          <div className="flex items-center gap-2">
                            <span className={classNames('px-2 py-0.5 rounded text-[10px] font-bold uppercase border', planBadges[p.id].color)}>
                              {p.name}
                            </span>
                            <span className="text-zinc-500 dark:text-zinc-400">({count} suscriptor{count !== 1 ? 'es' : ''})</span>
                          </div>
                          <span className="font-mono font-bold text-zinc-900 dark:text-white">${revenue} USD/mes</span>
                        </div>
                        <div className="w-full bg-zinc-100 dark:bg-zinc-800 h-3 rounded-full overflow-hidden">
                          <div
                            className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full rounded-full transition-all duration-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Provider Cost & Consumption Health */}
              <div className="p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm flex flex-col justify-between">
                <div>
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-white uppercase tracking-wider mb-2">
                    Gasto en Proveedores de IA
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-4">
                    Monitoreo en tiempo real para mantener márgenes saludables (&gt; 90%).
                  </p>

                  <div className="space-y-3 text-xs">
                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800">
                      <div className="flex items-center gap-2">
                        <span className="i-ph:cube text-purple-500 text-base" />
                        <span className="font-semibold">Anthropic (Claude 3.5)</span>
                      </div>
                      <span className="font-mono font-bold text-zinc-900 dark:text-white">$0.0031</span>
                    </div>

                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800">
                      <div className="flex items-center gap-2">
                        <span className="i-ph:sparkle-fill text-emerald-500 text-base" />
                        <span className="font-semibold">OpenAI (GPT-4o)</span>
                      </div>
                      <span className="font-mono font-bold text-zinc-900 dark:text-white">$0.0062</span>
                    </div>

                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800">
                      <div className="flex items-center gap-2">
                        <span className="i-ph:lightning text-blue-500 text-base" />
                        <span className="font-semibold">Google (Gemini 1.5 Flash)</span>
                      </div>
                      <span className="font-mono font-bold text-zinc-900 dark:text-white">$0.0016</span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800 text-xs text-zinc-500 flex items-center justify-between">
                  <span>Estado de APIs:</span>
                  <span className="inline-flex items-center gap-1.5 text-emerald-500 font-bold">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                    100% Operativas
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: USERS MANAGEMENT */}
        {activeTab === 'users' && (
          <div className="space-y-4">
            {/* Filter and Add User Bar */}
            <div className="p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-2 w-full sm:w-auto flex-1 max-w-md">
                <div className="relative w-full">
                  <input
                    type="text"
                    placeholder="Buscar por nombre, email o empresa..."
                    value={searchUser}
                    onChange={(e) => setSearchUser(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white focus:outline-none focus:border-emerald-500"
                  />
                  <span className="i-ph:magnifying-glass absolute left-3 top-2.5 text-zinc-400 text-sm" />
                </div>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                {/* Plan Filter */}
                <select
                  value={filterPlan}
                  onChange={(e) => setFilterPlan(e.target.value)}
                  className="px-3 py-2 text-xs font-semibold rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 focus:outline-none"
                >
                  <option value="all">Todos los Planes</option>
                  <option value="plan_free">Plan Free</option>
                  <option value="plan_pro">Plan Pro</option>
                  <option value="plan_team">Plan Team</option>
                  <option value="plan_enterprise">Plan Enterprise</option>
                </select>

                {/* Add User Button */}
                <button
                  onClick={() => setIsAddUserModalOpen(true)}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition flex items-center gap-1.5 shadow-sm shadow-emerald-500/20 cursor-pointer"
                >
                  <span className="i-ph:user-plus text-sm" />
                  <span>Nuevo Usuario</span>
                </button>
              </div>
            </div>

            {/* Users Data Table */}
            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-zinc-50 dark:bg-zinc-800/60 text-zinc-500 dark:text-zinc-400 font-semibold border-b border-zinc-200 dark:border-zinc-800 select-none">
                    <tr>
                      <th className="px-5 py-3">Usuario</th>
                      <th className="px-4 py-3">Plan & Estado</th>
                      <th className="px-4 py-3">Balance de Créditos</th>
                      <th className="px-4 py-3">Última Actividad</th>
                      <th className="px-5 py-3 text-right">Acciones de Admin</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {filteredUsers.map((u) => {
                      const uPlan = state.plans.find((p) => p.id === u.planId);
                      const remaining = Math.max(u.creditsTotal - u.creditsUsed, 0);
                      const pct = Math.round((remaining / u.creditsTotal) * 100);
                      return (
                        <tr key={u.id} className="hover:bg-zinc-50/60 dark:hover:bg-zinc-800/30 transition">
                          {/* User Column */}
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#ff7a1a] to-[#c94f00] text-[#0a0a09] font-bold text-xs flex items-center justify-center shrink-0 shadow-xs font-grotesk">
                                {u.name?.[0]?.toUpperCase() || 'U'}
                              </div>
                              <div>
                                <div className="flex items-center gap-1.5 font-bold text-zinc-900 dark:text-white">
                                  <span>{u.name}</span>
                                  {u.role === 'superadmin' && (
                                    <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 uppercase">
                                      ADMIN
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-zinc-500 dark:text-zinc-400">{u.email}</div>
                                {u.company && (
                                  <div className="text-[10px] text-zinc-400 font-medium">{u.company}</div>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Plan Column */}
                          <td className="px-4 py-3.5">
                            <div className="space-y-1">
                              <span className={classNames('px-2 py-0.5 rounded text-[10px] font-bold uppercase border', planBadges[u.planId].color)}>
                                {uPlan?.name}
                              </span>
                              <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                                {u.status === 'active' ? (
                                  <span className="text-emerald-500 font-medium">● Activo</span>
                                ) : (
                                  <span className="text-rose-500 font-medium">● Suspendido</span>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Credits Column */}
                          <td className="px-4 py-3.5">
                            <div className="w-48 space-y-1">
                              <div className="flex items-center justify-between text-[11px] font-mono">
                                <span className="font-bold text-zinc-900 dark:text-white">
                                  {remaining.toLocaleString()}
                                </span>
                                <span className="text-zinc-400">/ {u.creditsTotal.toLocaleString()}</span>
                              </div>
                              <div className="w-full bg-zinc-100 dark:bg-zinc-800 h-2 rounded-full overflow-hidden">
                                <div
                                  className={classNames(
                                    'h-full rounded-full transition-all',
                                    pct > 40 ? 'bg-emerald-500' : pct > 15 ? 'bg-amber-500' : 'bg-rose-500',
                                  )}
                                  style={{ width: `${Math.min(pct, 100)}%` }}
                                />
                              </div>
                              <span className="text-[10px] text-zinc-400">{pct}% disponible</span>
                            </div>
                          </td>

                          {/* Last Active */}
                          <td className="px-4 py-3.5 text-zinc-500 dark:text-zinc-400 text-xs">
                            <div>{u.lastActive}</div>
                            <div className="text-[10px] text-zinc-400">Alta: {u.createdAt}</div>
                          </td>

                          {/* Actions */}
                          <td className="px-5 py-3.5 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Recharge Credits */}
                              <button
                                onClick={() => setRechargeUser(u)}
                                className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/25 transition cursor-pointer"
                                title="Recargar créditos"
                              >
                                + Créditos
                              </button>

                              {/* Change Plan Dropdown */}
                              <select
                                value={u.planId}
                                onChange={(e) => {
                                  saasActions.changeUserPlan(u.id, e.target.value as PlanTier);
                                  toast.success(`Plan de ${u.name} actualizado`);
                                }}
                                className="px-2 py-1 text-xs font-semibold rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 focus:outline-none"
                              >
                                <option value="plan_free">Free</option>
                                <option value="plan_pro">Pro</option>
                                <option value="plan_team">Team</option>
                                <option value="plan_enterprise">Enterprise</option>
                              </select>

                              {/* Toggle Status */}
                              <button
                                onClick={() => {
                                  saasActions.toggleUserStatus(u.id);
                                  toast.info(`Estado de ${u.name} actualizado`);
                                }}
                                className={classNames(
                                  'p-1.5 rounded-lg border text-xs transition cursor-pointer',
                                  u.status === 'active'
                                    ? 'border-zinc-200 dark:border-zinc-700 text-zinc-400 hover:text-rose-500'
                                    : 'border-rose-500/30 bg-rose-500/10 text-rose-500',
                                )}
                                title={u.status === 'active' ? 'Suspender usuario' : 'Reactivar usuario'}
                              >
                                <span className={u.status === 'active' ? 'i-ph:pause' : 'i-ph:play'} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: PLANS & SUBSCRIPTIONS */}
        {activeTab === 'plans' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {state.plans.map((p) => {
              const count = state.users.filter((u) => u.planId === p.id).length;
              return (
                <div
                  key={p.id}
                  className={classNames(
                    'p-6 rounded-2xl border flex flex-col justify-between shadow-sm transition-all',
                    p.isPopular
                      ? 'border-emerald-500/50 bg-emerald-500/5 dark:bg-emerald-950/20 ring-1 ring-emerald-500/30'
                      : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900',
                  )}
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-base font-bold text-zinc-900 dark:text-white">{p.name}</h3>
                      <span className={classNames('px-2 py-0.5 rounded text-[10px] font-bold uppercase border', planBadges[p.id].color)}>
                        {p.badge}
                      </span>
                    </div>

                    <div className="mb-4">
                      <span className="text-3xl font-black text-zinc-900 dark:text-white">${p.priceMonthly}</span>
                      <span className="text-xs text-zinc-500 dark:text-zinc-400 font-medium"> USD / mes</span>
                    </div>

                    <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-100 dark:border-zinc-800 mb-4 space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-zinc-500 dark:text-zinc-400 font-medium">Cuota Mensual:</span>
                        <span className="font-mono font-bold text-emerald-500">{p.creditsMonthly.toLocaleString()} pts</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-zinc-500 dark:text-zinc-400 font-medium">Usuarios Actuales:</span>
                        <span className="font-mono font-bold text-zinc-900 dark:text-white">{count}</span>
                      </div>
                    </div>

                    <ul className="space-y-2 text-xs text-zinc-600 dark:text-zinc-300 mb-6">
                      {p.features.map((f, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="i-ph:check-circle-fill text-emerald-500 text-sm shrink-0 mt-0.5" />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-xs text-zinc-500">
                    <span>Ingresos de este plan:</span>
                    <span className="font-mono font-bold text-emerald-500">${count * p.priceMonthly} USD/m</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* TAB 4: AUDIT LOGS */}
        {activeTab === 'logs' && (
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-zinc-900 dark:text-white uppercase tracking-wider">
                  Registro de Operaciones de IA en Tiempo Real
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Auditoría completa de consumo de tokens y llamadas a APIs
                </p>
              </div>
              <span className="text-xs font-mono text-zinc-400">
                Total Registros: {state.logs.length}
              </span>
            </div>

            <div className="overflow-x-auto max-h-[500px]">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 bg-zinc-50 dark:bg-zinc-800/80 backdrop-blur text-zinc-500 dark:text-zinc-400 font-semibold border-b border-zinc-200 dark:border-zinc-800 select-none">
                  <tr>
                    <th className="px-5 py-3">Fecha & Hora</th>
                    <th className="px-4 py-3">Usuario</th>
                    <th className="px-4 py-3">Acción & Detalles</th>
                    <th className="px-4 py-3">Modelo</th>
                    <th className="px-4 py-3 text-right">Tokens / Créditos</th>
                    <th className="px-5 py-3 text-right">Costo Estimado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 font-mono">
                  {state.logs.map((log) => (
                    <tr key={log.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition">
                      <td className="px-5 py-3 text-zinc-500 dark:text-zinc-400 whitespace-nowrap">
                        {log.timestamp}
                      </td>
                      <td className="px-4 py-3 font-sans font-medium text-zinc-900 dark:text-white whitespace-nowrap">
                        {log.userName}
                      </td>
                      <td className="px-4 py-3 font-sans text-zinc-700 dark:text-zinc-300">
                        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 uppercase mr-2">
                          {log.action}
                        </span>
                        <span>{log.details}</span>
                      </td>
                      <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400 whitespace-nowrap">
                        {log.modelUsed || 'default'}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-purple-600 dark:text-purple-400 whitespace-nowrap">
                        -{log.creditsDeducted.toLocaleString()} pts
                      </td>
                      <td className="px-5 py-3 text-right text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                        ${log.estimatedCostUSD.toFixed(4)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* MODAL: ADD NEW USER */}
      {isAddUserModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <h3 className="text-base font-bold text-zinc-900 dark:text-white">Registrar Nuevo Cliente SaaS</h3>
              <button
                onClick={() => setIsAddUserModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-700 dark:hover:text-white"
              >
                <span className="i-ph:x text-lg" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Nombre Completo</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Martín Ramos"
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Correo Electrónico</label>
                <input
                  type="email"
                  required
                  placeholder="martin@empresa.com"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Empresa / Organización</label>
                <input
                  type="text"
                  placeholder="Ej: InnoTech Solutions"
                  value={newUserCompany}
                  onChange={(e) => setNewUserCompany(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Contraseña Inicial (opcional)
                </label>
                <div className="relative">
                  <input
                    type={showNewUserPassword ? 'text' : 'password'}
                    placeholder="Por defecto: GenUI2026!"
                    value={newUserPassword}
                    onChange={(e) => setNewUserPassword(e.target.value)}
                    className="w-full pl-3 pr-10 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white focus:outline-none focus:border-emerald-500 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewUserPassword(!showNewUserPassword)}
                    className="absolute right-3 top-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition cursor-pointer"
                    title={showNewUserPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                  >
                    <span className={classNames('text-base block', showNewUserPassword ? 'i-ph:eye-slash' : 'i-ph:eye')} />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Plan Asignado</label>
                  <select
                    value={newUserPlan}
                    onChange={(e) => setNewUserPlan(e.target.value as PlanTier)}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white focus:outline-none"
                  >
                    <option value="plan_free">Free ($0)</option>
                    <option value="plan_pro">Pro ($24)</option>
                    <option value="plan_team">Team ($89)</option>
                    <option value="plan_enterprise">Enterprise ($299)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Rol en Sistema</label>
                  <select
                    value={newUserRole}
                    onChange={(e) => setNewUserRole(e.target.value as UserRole)}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white focus:outline-none"
                  >
                    <option value="user">Usuario Estándar</option>
                    <option value="admin">Administrador</option>
                    <option value="superadmin">SuperAdmin</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsAddUserModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition shadow-sm"
                >
                  Crear Usuario
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: RECHARGE CREDITS */}
      {rechargeUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-zinc-900 dark:text-white">Recargar Créditos IA</h3>
                <p className="text-xs text-zinc-500">{rechargeUser.name}</p>
              </div>
              <button
                onClick={() => setRechargeUser(null)}
                className="text-zinc-400 hover:text-zinc-700 dark:hover:text-white"
              >
                <span className="i-ph:x text-lg" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <span className="block font-semibold text-zinc-700 dark:text-zinc-300">Selecciona el monto a añadir:</span>
              <div className="grid grid-cols-2 gap-2">
                {[25000, 50000, 100000, 500000].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setRechargeAmount(amt)}
                    className={classNames(
                      'p-2.5 rounded-xl border text-center font-mono font-bold transition cursor-pointer',
                      rechargeAmount === amt
                        ? 'border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500/30'
                        : 'border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300',
                    )}
                  >
                    +{(amt / 1000).toFixed(0)}k créditos
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setRechargeUser(null)}
                className="px-4 py-2 rounded-xl text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition font-medium text-xs"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleApplyRecharge}
                className="px-4 py-2 rounded-xl font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition shadow-sm text-xs"
              >
                Confirmar Recarga
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
