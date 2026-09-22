import React, { useState } from 'react';
import { useStore } from '@nanostores/react';
import { toast } from 'react-toastify';
import type { MetaFunction } from '@remix-run/cloudflare';
import { saasActions } from '~/lib/stores/saasStore';
import { themeStore, toggleTheme } from '~/lib/stores/theme';
import { classNames } from '~/utils/classNames';

export const meta: MetaFunction = () => {
  return [
    { title: 'Acceso y Registro • GenUI Studio' },
    { name: 'description', content: 'Acceso seguro y registro de usuarios a la plataforma GenUI Studio' },
  ];
};

export default function LoginPage() {
  const currentTheme = useStore(themeStore);
  const [mode, setMode] = useState<'login' | 'register'>('login');

  // Login fields
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // Register fields
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail.trim()) {
      toast.warn('Por favor ingresa tu correo electrónico');
      return;
    }

    setIsLoading(true);
    setTimeout(() => {
      const res = saasActions.login(loginEmail, loginPassword);
      setIsLoading(false);

      if (res.success) {
        toast.success(res.message);
        if (res.user?.role === 'superadmin' || res.user?.role === 'admin') {
          window.location.href = '/admin';
        } else {
          window.location.href = '/';
        }
      } else {
        toast.error(res.message);
      }
    }, 400);
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();

    if (!firstName.trim()) {
      toast.warn('Por favor ingresa tu nombre');
      return;
    }

    if (!lastName.trim()) {
      toast.warn('Por favor ingresa tus apellidos');
      return;
    }

    if (!regEmail.trim()) {
      toast.warn('Por favor ingresa tu correo electrónico');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(regEmail.trim())) {
      toast.warn('Por favor ingresa un correo electrónico válido');
      return;
    }

    if (regPassword.length < 6) {
      toast.warn('La contraseña debe tener al menos 6 caracteres');
      return;
    }

    if (regPassword !== confirmPassword) {
      toast.error('Las contraseñas no coinciden. Verifica e intenta nuevamente.');
      return;
    }

    setIsLoading(true);
    setTimeout(() => {
      const fullName = `${firstName.trim()} ${lastName.trim()}`;
      const res = saasActions.register({
        name: fullName,
        email: regEmail.trim(),
        password: regPassword,
      });
      setIsLoading(false);

      if (res.success) {
        toast.success(res.message);
        window.location.href = '/';
      } else {
        toast.error(res.message);
      }
    }, 400);
  };

  return (
    <div className="min-h-screen flex flex-col justify-between bg-zinc-50 dark:bg-[#0a0a09] text-zinc-900 dark:text-[#f2f0e9] font-sans transition-colors duration-200">
      {/* Top Bar */}
      <header className="px-6 py-4 flex items-center justify-between border-b border-zinc-200 dark:border-[#2a2a25]">
        <a href="/" className="flex items-center gap-2.5">
          <img
            src="/logo-genui.png"
            alt="GenUI Studio Logo"
            className="w-8 h-8 rounded-lg object-cover shadow-sm ring-1 ring-[#ff7a1a]/40"
          />
          <span className="text-base font-bold text-zinc-900 dark:text-[#f2f0e9]">
            GenUI<span className="text-[#ff7a1a] font-normal ml-0.5">Studio</span>
          </span>
        </a>

        <div className="flex items-center gap-3">
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg border border-zinc-200 dark:border-[#2a2a25] text-zinc-600 dark:text-[#8c887b] hover:bg-zinc-100 dark:hover:bg-[#1a1a17] transition cursor-pointer"
            title="Cambiar tema"
          >
            <span
              className={classNames(
                'text-base',
                currentTheme === 'dark' ? 'i-ph:sun text-amber-400' : 'i-ph:moon text-zinc-600',
              )}
            />
          </button>
          <a
            href="/"
            className="text-xs font-semibold text-zinc-600 dark:text-[#8c887b] hover:text-[#ff7a1a] dark:hover:text-[#ff7a1a] transition"
          >
            Ir al Workspace →
          </a>
        </div>
      </header>

      {/* Main Login / Register Card */}
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-2xl border border-zinc-200 dark:border-[#2a2a25] bg-white dark:bg-[#131311] shadow-2xl p-6 sm:p-8 space-y-6">
          {/* Header Title */}
          <div className="text-center space-y-1.5">
            <div className="inline-flex p-3 rounded-2xl bg-[#ff7a1a]/10 text-[#ff7a1a] mb-2 border border-[#ff7a1a]/20">
              <span className={classNames('text-2xl', mode === 'login' ? 'i-ph:shield-check' : 'i-ph:user-plus')} />
            </div>
            <h2 className="text-2xl font-black text-zinc-900 dark:text-[#f2f0e9] tracking-tight">
              {mode === 'login' ? 'Iniciar Sesión' : 'Crear Cuenta'}
            </h2>
            <p className="text-xs text-zinc-500 dark:text-[#8c887b]">
              {mode === 'login'
                ? 'Accede a tu workspace empresarial y cuotas de IA'
                : 'Regístrate y obtén 50,000 créditos gratis para construir apps'}
            </p>
          </div>

          {/* Mode Tabs */}
          <div className="grid grid-cols-2 p-1 rounded-xl bg-zinc-100 dark:bg-[#1a1a17] border border-zinc-200/80 dark:border-[#2a2a25]">
            <button
              type="button"
              onClick={() => setMode('login')}
              className={classNames(
                'py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5',
                mode === 'login'
                  ? 'bg-white dark:bg-[#252520] text-[#ff7a1a] shadow-xs'
                  : 'text-zinc-500 dark:text-[#9a988e] hover:text-zinc-900 dark:hover:text-[#f2f0e9]',
              )}
            >
              <span className="i-ph:sign-in text-sm" />
              <span>Iniciar Sesión</span>
            </button>
            <button
              type="button"
              onClick={() => setMode('register')}
              className={classNames(
                'py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5',
                mode === 'register'
                  ? 'bg-white dark:bg-[#252520] text-[#ff7a1a] shadow-xs'
                  : 'text-zinc-500 dark:text-[#9a988e] hover:text-zinc-900 dark:hover:text-[#f2f0e9]',
              )}
            >
              <span className="i-ph:user-plus text-sm" />
              <span>Crear Cuenta</span>
            </button>
          </div>

          {mode === 'login' ? (
            /* Credentials Form */
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-[#d0cbbe] mb-1.5">
                  Correo Electrónico
                </label>
                <div className="relative">
                  <input
                    type="email"
                    required
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="usuario@empresa.com"
                    className="w-full pl-9 pr-3.5 py-2.5 text-xs rounded-xl bg-zinc-50 dark:bg-[#1a1a17] border border-zinc-200 dark:border-[#2a2a25] text-zinc-900 dark:text-[#f2f0e9] placeholder-zinc-400 dark:placeholder-zinc-600 focus:outline-none focus:border-[#ff7a1a] focus:ring-1 focus:ring-[#ff7a1a]/30 transition"
                  />
                  <span className="i-ph:envelope-simple text-sm text-zinc-400 absolute left-3 top-3" />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-[#d0cbbe]">
                    Contraseña
                  </label>
                  <a
                    href="#recuperar"
                    onClick={(e) => {
                      e.preventDefault();
                      toast.info('Para restablecer tu contraseña, contacta al administrador del sistema.');
                    }}
                    className="text-[11px] text-[#ff7a1a] hover:underline"
                  >
                    ¿Olvidaste tu contraseña?
                  </a>
                </div>
                <div className="relative">
                  <input
                    type={showLoginPassword ? 'text' : 'password'}
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-9 pr-10 py-2.5 text-xs rounded-xl bg-zinc-50 dark:bg-[#1a1a17] border border-zinc-200 dark:border-[#2a2a25] text-zinc-900 dark:text-[#f2f0e9] placeholder-zinc-400 dark:placeholder-zinc-600 focus:outline-none focus:border-[#ff7a1a] focus:ring-1 focus:ring-[#ff7a1a]/30 transition font-mono"
                  />
                  <span className="i-ph:lock text-sm text-zinc-400 absolute left-3 top-3" />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword(!showLoginPassword)}
                    className="absolute right-3 top-3 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition cursor-pointer"
                    title={showLoginPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                  >
                    <span className={classNames('text-base block', showLoginPassword ? 'i-ph:eye-slash' : 'i-ph:eye')} />
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-zinc-600 dark:text-[#8c887b]">
                  <input
                    type="checkbox"
                    defaultChecked
                    className="rounded accent-[#ff7a1a] text-[#ff7a1a] focus:ring-[#ff7a1a]"
                  />
                  <span>Recordar sesión en este equipo</span>
                </label>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full mt-2 py-3 px-4 rounded-xl text-xs font-bold text-[#0a0a09] bg-[#ff7a1a] hover:bg-[#ff8c3a] shadow-md shadow-[#ff7a1a]/20 transition flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <span className="i-svg-spinners:90-ring-with-bg text-sm" />
                    <span>Validando sesión...</span>
                  </>
                ) : (
                  <>
                    <span className="i-ph:sign-in text-sm font-bold" />
                    <span>Entrar a la Plataforma</span>
                  </>
                )}
              </button>

              <div className="text-center pt-1">
                <p className="text-xs text-zinc-500 dark:text-[#8c887b]">
                  ¿No tienes una cuenta aún?{' '}
                  <button
                    type="button"
                    onClick={() => setMode('register')}
                    className="font-semibold text-[#ff7a1a] hover:underline cursor-pointer ml-1"
                  >
                    Crear cuenta gratis
                  </button>
                </p>
              </div>
            </form>
          ) : (
            /* Registration Form */
            <form onSubmit={handleRegister} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-[#d0cbbe] mb-1.5">
                    Nombre
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="Ej: Alejandro"
                      className="w-full pl-8 pr-3 py-2 text-xs rounded-xl bg-zinc-50 dark:bg-[#1a1a17] border border-zinc-200 dark:border-[#2a2a25] text-zinc-900 dark:text-[#f2f0e9] placeholder-zinc-400 dark:placeholder-zinc-600 focus:outline-none focus:border-[#ff7a1a] focus:ring-1 focus:ring-[#ff7a1a]/30 transition"
                    />
                    <span className="i-ph:user text-sm text-zinc-400 absolute left-2.5 top-2.5" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-[#d0cbbe] mb-1.5">
                    Apellidos
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="Ej: Silva Gómez"
                      className="w-full pl-8 pr-3 py-2 text-xs rounded-xl bg-zinc-50 dark:bg-[#1a1a17] border border-zinc-200 dark:border-[#2a2a25] text-zinc-900 dark:text-[#f2f0e9] placeholder-zinc-400 dark:placeholder-zinc-600 focus:outline-none focus:border-[#ff7a1a] focus:ring-1 focus:ring-[#ff7a1a]/30 transition"
                    />
                    <span className="i-ph:identification-card text-sm text-zinc-400 absolute left-2.5 top-2.5" />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-[#d0cbbe] mb-1.5">
                  Correo Electrónico
                </label>
                <div className="relative">
                  <input
                    type="email"
                    required
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="alejandro@empresa.com"
                    className="w-full pl-8 pr-3.5 py-2 text-xs rounded-xl bg-zinc-50 dark:bg-[#1a1a17] border border-zinc-200 dark:border-[#2a2a25] text-zinc-900 dark:text-[#f2f0e9] placeholder-zinc-400 dark:placeholder-zinc-600 focus:outline-none focus:border-[#ff7a1a] focus:ring-1 focus:ring-[#ff7a1a]/30 transition"
                  />
                  <span className="i-ph:envelope-simple text-sm text-zinc-400 absolute left-2.5 top-2.5" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-[#d0cbbe] mb-1.5">
                  Contraseña
                </label>
                <div className="relative">
                  <input
                    type={showRegPassword ? 'text' : 'password'}
                    required
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    className="w-full pl-8 pr-10 py-2 text-xs rounded-xl bg-zinc-50 dark:bg-[#1a1a17] border border-zinc-200 dark:border-[#2a2a25] text-zinc-900 dark:text-[#f2f0e9] placeholder-zinc-400 dark:placeholder-zinc-600 focus:outline-none focus:border-[#ff7a1a] focus:ring-1 focus:ring-[#ff7a1a]/30 transition font-mono"
                  />
                  <span className="i-ph:lock text-sm text-zinc-400 absolute left-2.5 top-2.5" />
                  <button
                    type="button"
                    onClick={() => setShowRegPassword(!showRegPassword)}
                    className="absolute right-3 top-2.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition cursor-pointer"
                    title={showRegPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                  >
                    <span className={classNames('text-base block', showRegPassword ? 'i-ph:eye-slash' : 'i-ph:eye')} />
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-[#d0cbbe] mb-1.5">
                  Repetir Contraseña
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repite tu contraseña"
                    className="w-full pl-8 pr-10 py-2 text-xs rounded-xl bg-zinc-50 dark:bg-[#1a1a17] border border-zinc-200 dark:border-[#2a2a25] text-zinc-900 dark:text-[#f2f0e9] placeholder-zinc-400 dark:placeholder-zinc-600 focus:outline-none focus:border-[#ff7a1a] focus:ring-1 focus:ring-[#ff7a1a]/30 transition font-mono"
                  />
                  <span className="i-ph:shield-check text-sm text-zinc-400 absolute left-2.5 top-2.5" />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-2.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition cursor-pointer"
                    title={showConfirmPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                  >
                    <span className={classNames('text-base block', showConfirmPassword ? 'i-ph:eye-slash' : 'i-ph:eye')} />
                  </button>
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-orange-50/70 dark:bg-[#ff7a1a]/10 border border-orange-200/60 dark:border-[#ff7a1a]/20 text-[11px] text-orange-900 dark:text-[#ff7a1a] flex items-center gap-2">
                <span className="i-ph:sparkle text-sm shrink-0" />
                <span>Incluye 50,000 créditos mensuales y almacenamiento de apps en el navegador.</span>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full mt-2 py-3 px-4 rounded-xl text-xs font-bold text-[#0a0a09] bg-[#ff7a1a] hover:bg-[#ff8c3a] shadow-md shadow-[#ff7a1a]/20 transition flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <span className="i-svg-spinners:90-ring-with-bg text-sm" />
                    <span>Creando tu cuenta...</span>
                  </>
                ) : (
                  <>
                    <span className="i-ph:user-plus text-sm font-bold" />
                    <span>Crear Cuenta y Comenzar</span>
                  </>
                )}
              </button>

              <div className="text-center pt-1">
                <p className="text-xs text-zinc-500 dark:text-[#8c887b]">
                  ¿Ya tienes una cuenta?{' '}
                  <button
                    type="button"
                    onClick={() => setMode('login')}
                    className="font-semibold text-[#ff7a1a] hover:underline cursor-pointer ml-1"
                  >
                    Iniciar Sesión
                  </button>
                </p>
              </div>
            </form>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="px-6 py-4 border-t border-zinc-200 dark:border-[#2a2a25] text-center text-xs text-zinc-500 dark:text-[#8c887b] flex items-center justify-center gap-1.5">
        <span className="i-ph:shield-check text-xs text-[#ff7a1a]" />
        <span>GenUI Studio SaaS Platform • Autenticación Segura y Gobernanza de Modelos</span>
      </footer>
    </div>
  );
}
