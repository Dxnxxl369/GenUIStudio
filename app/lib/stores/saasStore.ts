import { atom, computed } from 'nanostores';

export type UserRole = 'superadmin' | 'admin' | 'user';

export type PlanTier = 'plan_free' | 'plan_pro' | 'plan_team' | 'plan_enterprise';

export interface SaaSPlan {
  id: PlanTier;
  name: string;
  badge: string;
  priceMonthly: number;
  creditsMonthly: number;
  description: string;
  color: string;
  features: string[];
  maxProjects: number;
  allowedModels: 'basic' | 'all' | 'priority';
  hasDatabaseExport: boolean;
  hasGenerativeReports: boolean;
  hasCodeInjection: boolean;
  hasDeployments: boolean;
  isPopular?: boolean;
}

export interface SaaSUser {
  id: string;
  name: string;
  email: string;
  password?: string;
  avatar: string;
  role: UserRole;
  planId: PlanTier;
  status: 'active' | 'suspended';
  creditsTotal: number;
  creditsUsed: number;
  createdAt: string;
  lastActive: string;
  company?: string;
}

export interface UsageLog {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  action: 'chat_generation' | 'report_query' | 'database_export' | 'code_injection' | 'deployment' | 'plan_upgrade' | 'credit_recharge';
  details: string;
  tokensConsumed: number;
  creditsDeducted: number;
  estimatedCostUSD: number;
  timestamp: string;
  modelUsed?: string;
}

export interface SaaSState {
  currentUserId: string;
  isAuthenticated: boolean;
  plans: SaaSPlan[];
  users: SaaSUser[];
  logs: UsageLog[];
}

// -------------------------------------------------------------
// SEED DATA: 4 PLANS & 4 REALISTIC SEED USERS
// -------------------------------------------------------------

export const SEED_PLANS: SaaSPlan[] = [
  {
    id: 'plan_free',
    name: 'Free / Starter',
    badge: 'FREE',
    priceMonthly: 0,
    creditsMonthly: 50000,
    description: 'Para estudiantes, prototipado rápido y evaluación de la plataforma.',
    color: 'emerald',
    features: [
      '50.000 créditos mensuales de IA (~15 consultas)',
      'Modelos rápidos: Gemini 1.5 Flash y Llama 3 8B',
      'Acceso a Base de Datos (Lectura y hasta 3 tablas)',
      'Reportes IA: Visualización básica (hasta 5 consultas)',
      'Vista previa en tiempo real en WebContainer',
      'Comunidad pública de soporte',
    ],
    maxProjects: 3,
    allowedModels: 'basic',
    hasDatabaseExport: false,
    hasGenerativeReports: true,
    hasCodeInjection: false,
    hasDeployments: false,
  },
  {
    id: 'plan_pro',
    name: 'Pro Developer',
    badge: 'PRO',
    priceMonthly: 24,
    creditsMonthly: 500000,
    description: 'Para programadores y creadores independientes que construyen apps reales.',
    color: 'blue',
    isPopular: true,
    features: [
      '500.000 créditos mensuales de IA (~200 consultas)',
      'Acceso a Claude 3.5 Sonnet, GPT-4o y DeepSeek R1',
      'Base de Datos ilimitada + Exportación SQL DDL completa',
      'Reportes IA ilimitados con ejecución in-memory',
      '🚀 Inyección de Reportes directo al código del proyecto',
      'Despliegue con 1 clic a Netlify, Vercel y GitHub',
      'Soporte por correo con respuesta < 24 hrs',
    ],
    maxProjects: 25,
    allowedModels: 'all',
    hasDatabaseExport: true,
    hasGenerativeReports: true,
    hasCodeInjection: true,
    hasDeployments: true,
  },
  {
    id: 'plan_team',
    name: 'Team / Business',
    badge: 'TEAM',
    priceMonthly: 89,
    creditsMonthly: 2500000,
    description: 'Para startups, agencias de software y equipos de desarrollo ágiles.',
    color: 'purple',
    features: [
      '2.500.000 créditos mensuales compartidos',
      'Hasta 5 miembros de equipo con roles',
      'Acceso prioritario a todos los modelos de IA sin colas',
      'Proyectos compartidos y sincronización colaborativa',
      'Integración directa con Supabase y bases de datos cloud',
      'Commits y ramas automáticas a GitLab y GitHub corporativo',
      'Soporte prioritario y onboarding técnico',
    ],
    maxProjects: 100,
    allowedModels: 'priority',
    hasDatabaseExport: true,
    hasGenerativeReports: true,
    hasCodeInjection: true,
    hasDeployments: true,
  },
  {
    id: 'plan_enterprise',
    name: 'Enterprise',
    badge: 'ENTERPRISE',
    priceMonthly: 299,
    creditsMonthly: 10000000,
    description: 'Para grandes empresas que requieren escala ilimitada, seguridad y SLA.',
    color: 'amber',
    features: [
      '10.000.000 créditos mensuales de IA o cuota dedicada',
      'Miembros y proyectos ilimitados',
      'Posibilidad de usar API Keys propias (BYOK) sin límites',
      'Despliegue en infraestructura privada On-Premise',
      'SLA de 99.9% de disponibilidad garantizada',
      'Gestor de cuenta técnico dedicado y soporte 24/7',
    ],
    maxProjects: 9999,
    allowedModels: 'priority',
    hasDatabaseExport: true,
    hasGenerativeReports: true,
    hasCodeInjection: true,
    hasDeployments: true,
  },
];

export const SEED_USERS: SaaSUser[] = [
  {
    id: 'usr_admin_01',
    name: 'Alexander Admin',
    email: 'admin@genui.studio',
    password: 'Admin123!',
    avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=AlexanderAdmin&backgroundColor=10b981',
    role: 'superadmin',
    planId: 'plan_enterprise',
    status: 'active',
    creditsTotal: 10000000,
    creditsUsed: 142500,
    createdAt: '2026-01-10',
    lastActive: 'Hace unos instantes',
    company: 'GenUI Studio Inc.',
  },
  {
    id: 'usr_free_02',
    name: 'Carlos Gómez',
    email: 'carlos@genui.studio',
    password: 'Carlos123!',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=CarlosGomez',
    role: 'user',
    planId: 'plan_free',
    status: 'active',
    creditsTotal: 50000,
    creditsUsed: 38400,
    createdAt: '2026-09-01',
    lastActive: 'Hace 2 horas',
    company: 'Universidad / Estudiante',
  },
  {
    id: 'usr_pro_03',
    name: 'Lucía Fernández',
    email: 'lucia.dev@startup.io',
    password: 'Lucia123!',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=LuciaDev',
    role: 'user',
    planId: 'plan_pro',
    status: 'active',
    creditsTotal: 500000,
    creditsUsed: 125000,
    createdAt: '2026-08-15',
    lastActive: 'Hace 15 minutos',
    company: 'Freelance Tech',
  },
  {
    id: 'usr_team_04',
    name: 'Valeria Morales',
    email: 'valeria@apexsoftware.com',
    password: 'Valeria123!',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=ValeriaApex',
    role: 'user',
    planId: 'plan_team',
    status: 'active',
    creditsTotal: 2500000,
    creditsUsed: 890000,
    createdAt: '2026-07-20',
    lastActive: 'Ayer',
    company: 'Apex Software Studio',
  },
];

export const SEED_LOGS: UsageLog[] = [
  {
    id: 'log_01',
    userId: 'usr_pro_03',
    userName: 'Lucía Fernández',
    userEmail: 'lucia.dev@startup.io',
    action: 'report_query',
    details: 'Generación Text-to-SQL: "Mostrar todos los juegos AAA de PS3"',
    tokensConsumed: 620,
    creditsDeducted: 620,
    estimatedCostUSD: 0.0031,
    timestamp: '2026-09-21 00:45:10',
    modelUsed: 'claude-3-5-sonnet-20241022',
  },
  {
    id: 'log_02',
    userId: 'usr_team_04',
    userName: 'Valeria Morales',
    userEmail: 'valeria@apexsoftware.com',
    action: 'code_injection',
    details: 'Inyección de componente GeneratedReport.jsx en el proyecto',
    tokensConsumed: 1240,
    creditsDeducted: 1240,
    estimatedCostUSD: 0.0062,
    timestamp: '2026-09-20 23:30:22',
    modelUsed: 'gpt-4o',
  },
  {
    id: 'log_03',
    userId: 'usr_free_02',
    userName: 'Carlos Gómez',
    userEmail: 'carlos.gomez@gmail.com',
    action: 'chat_generation',
    details: 'Creación de estructura base React + Tailwind',
    tokensConsumed: 3200,
    creditsDeducted: 3200,
    estimatedCostUSD: 0.0016,
    timestamp: '2026-09-20 22:15:05',
    modelUsed: 'gemini-1.5-flash-latest',
  },
  {
    id: 'log_04',
    userId: 'usr_admin_01',
    userName: 'Alexander Admin',
    userEmail: 'admin@genui.studio',
    action: 'deployment',
    details: 'Despliegue a producción en Netlify (site: genui-main-live)',
    tokensConsumed: 450,
    creditsDeducted: 450,
    estimatedCostUSD: 0.0009,
    timestamp: '2026-09-20 21:00:18',
    modelUsed: 'system-deploy',
  },
];

const STORAGE_KEY = 'genui_saas_state_v3';

function getInitialState(): SaaSState {
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && parsed.users && parsed.plans) {
          return {
            ...parsed,
            isAuthenticated: parsed.isAuthenticated ?? true,
          };
        }
      }
    } catch {
      // ignore
    }
  }

  // Default initial state: starts as Alexander Admin for easy evaluation
  return {
    currentUserId: 'usr_admin_01',
    isAuthenticated: true,
    plans: SEED_PLANS,
    users: SEED_USERS,
    logs: SEED_LOGS,
  };
}

export const saasStore = atom<SaaSState>(getInitialState());

function persistState(state: SaaSState) {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (err) {
      console.error('Error saving SaaS state:', err);
    }
  }
}

// -------------------------------------------------------------
// COMPUTED SELECTORS
// -------------------------------------------------------------

export const currentUser = computed(saasStore, (state) => {
  if (!state.isAuthenticated || !state.currentUserId) {
    return {
      id: 'guest',
      name: 'Invitado',
      email: '',
      avatar: '',
      role: 'user' as UserRole,
      planId: 'plan_free' as PlanTier,
      creditsTotal: 50000,
      creditsUsed: 0,
      status: 'active' as const,
      createdAt: '2026-01-01',
      lastLogin: '',
      company: '',
    };
  }
  return state.users.find((u) => u.id === state.currentUserId) || state.users[0];
});

export const currentPlan = computed([saasStore, currentUser], (state, user) => {
  return state.plans.find((p) => p.id === user.planId) || state.plans[0];
});

export const saasMetrics = computed(saasStore, (state) => {
  const totalUsers = state.users.length;
  const payingUsers = state.users.filter((u) => u.planId !== 'plan_free').length;

  // Monthly Recurring Revenue (MRR)
  const mrr = state.users.reduce((acc, u) => {
    const plan = state.plans.find((p) => p.id === u.planId);
    return acc + (plan ? plan.priceMonthly : 0);
  }, 0);

  const totalCreditsUsed = state.users.reduce((acc, u) => acc + u.creditsUsed, 0);
  const totalTokensLogged = state.logs.reduce((acc, l) => acc + l.tokensConsumed, 0);
  const totalApiCostUSD = state.logs.reduce((acc, l) => acc + l.estimatedCostUSD, 0);

  // Profit Margin
  const profitUSD = Math.max(mrr - totalApiCostUSD, 0);
  const marginPercent = mrr > 0 ? ((profitUSD / mrr) * 100).toFixed(1) : '100';

  return {
    totalUsers,
    payingUsers,
    freeUsers: totalUsers - payingUsers,
    mrr,
    arr: mrr * 12,
    totalCreditsUsed,
    totalTokensLogged,
    totalApiCostUSD,
    profitUSD,
    marginPercent,
  };
});

// -------------------------------------------------------------
// SAAS CONTROLLER ACTIONS
// -------------------------------------------------------------

export const saasActions = {
  // User Authentication: Login
  login(email: string, password: string): { success: boolean; message: string; user?: SaaSUser } {
    const state = saasStore.get();
    const cleanEmail = email.trim().toLowerCase();

    const user = state.users.find(
      (u) =>
        u.email.toLowerCase() === cleanEmail ||
        u.email.split('@')[0].toLowerCase() === cleanEmail ||
        u.name.toLowerCase() === cleanEmail,
    );

    if (!user) {
      return { success: false, message: 'Usuario o correo no encontrado en el sistema.' };
    }

    if (user.status === 'suspended') {
      return { success: false, message: 'Esta cuenta se encuentra suspendida por un Administrador.' };
    }

    if (user.password && user.password !== password) {
      return { success: false, message: 'Contraseña incorrecta. Verifica tus credenciales.' };
    }

    const nextState: SaaSState = {
      ...state,
      currentUserId: user.id,
      isAuthenticated: true,
    };
    saasStore.set(nextState);
    persistState(nextState);

    return { success: true, message: `¡Bienvenido de nuevo, ${user.name}!`, user };
  },

  // User Authentication: Register new account
  register(data: { name: string; email: string; password?: string; company?: string }): {
    success: boolean;
    message: string;
    user?: SaaSUser;
  } {
    const state = saasStore.get();
    const cleanEmail = data.email.trim().toLowerCase();

    if (!cleanEmail) {
      return { success: false, message: 'El correo electrónico es requerido.' };
    }

    const existing = state.users.find((u) => u.email.toLowerCase() === cleanEmail);
    if (existing) {
      return { success: false, message: 'Ya existe una cuenta registrada con este correo electrónico.' };
    }

    const freePlan = state.plans.find((p) => p.id === 'plan_free') || state.plans[0];
    const newId = `usr_${Date.now()}`;
    const newUser: SaaSUser = {
      id: newId,
      name: data.name.trim(),
      email: cleanEmail,
      password: data.password || '',
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(data.name.trim())}`,
      role: 'user',
      planId: 'plan_free',
      status: 'active',
      creditsTotal: freePlan.creditsMonthly || 50000,
      creditsUsed: 0,
      createdAt: new Date().toISOString().slice(0, 10),
      lastActive: 'En línea',
      company: data.company?.trim() || 'Desarrollador',
    };

    const nextState: SaaSState = {
      ...state,
      users: [newUser, ...state.users],
      currentUserId: newId,
      isAuthenticated: true,
    };

    saasStore.set(nextState);
    persistState(nextState);

    return { success: true, message: `¡Cuenta creada exitosamente! Bienvenido, ${newUser.name}.`, user: newUser };
  },

  // User Authentication: Logout
  logout() {
    const state = saasStore.get();
    const nextState: SaaSState = {
      ...state,
      currentUserId: '',
      isAuthenticated: false,
    };
    saasStore.set(nextState);
    persistState(nextState);
  },

  // Switch active logged-in user
  switchUser(userId: string) {
    const state = saasStore.get();
    const user = state.users.find((u) => u.id === userId);
    if (!user) return;

    const nextState = { ...state, currentUserId: userId, isAuthenticated: true };
    saasStore.set(nextState);
    persistState(nextState);
  },

  // Process Realistic Payment Simulation & Plan Upgrade
  processPaymentAndUpgrade(
    userId: string,
    targetPlanId: PlanTier,
    cardDetails: { cardBrand: string; cardLast4: string; cardholder: string },
  ) {
    const state = saasStore.get();
    const targetPlan = state.plans.find((p) => p.id === targetPlanId);
    const user = state.users.find((u) => u.id === userId);
    if (!targetPlan || !user) return { success: false, transactionId: '' };

    const transactionId = `TXN-${Date.now().toString().slice(-6)}-${cardDetails.cardBrand.toUpperCase()}`;

    const updatedUsers = state.users.map((u) => {
      if (u.id === userId) {
        return {
          ...u,
          planId: targetPlanId,
          creditsTotal: targetPlan.creditsMonthly,
          creditsUsed: 0,
          lastActive: 'Hace un instante (Pago procesado)',
        };
      }
      return u;
    });

    const paymentLog: UsageLog = {
      id: `log_pay_${Date.now()}`,
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      action: 'plan_upgrade',
      details: `Pago de suscripción Plan ${targetPlan.name} ($${targetPlan.priceMonthly} USD/mes) procesado con ${cardDetails.cardBrand} terminada en ${cardDetails.cardLast4}. Ref: ${transactionId}`,
      tokensConsumed: 0,
      creditsDeducted: 0,
      estimatedCostUSD: 0,
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
      modelUsed: `Gateway-Sim-${cardDetails.cardBrand}`,
    };

    const nextState: SaaSState = {
      ...state,
      users: updatedUsers,
      logs: [paymentLog, ...state.logs],
    };
    saasStore.set(nextState);
    persistState(nextState);

    return { success: true, transactionId };
  },

  // Upgrade or change a user's plan
  changeUserPlan(userId: string, newPlanId: PlanTier) {
    const state = saasStore.get();
    const targetPlan = state.plans.find((p) => p.id === newPlanId);
    if (!targetPlan) return;

    const updatedUsers = state.users.map((u) => {
      if (u.id === userId) {
        return {
          ...u,
          planId: newPlanId,
          creditsTotal: targetPlan.creditsMonthly,
          // If upgraded, ensure remaining is at least target
          creditsUsed: Math.min(u.creditsUsed, targetPlan.creditsMonthly / 2),
        };
      }
      return u;
    });

    const nextState = { ...state, users: updatedUsers };
    saasStore.set(nextState);
    persistState(nextState);
  },

  // Recharge credits for a user (Admin action or token top-up)
  rechargeCredits(userId: string, amount: number) {
    const state = saasStore.get();
    const updatedUsers = state.users.map((u) => {
      if (u.id === userId) {
        return {
          ...u,
          creditsTotal: u.creditsTotal + amount,
        };
      }
      return u;
    });

    const nextState = { ...state, users: updatedUsers };
    saasStore.set(nextState);
    persistState(nextState);
  },

  // Deduct credits on AI query execution
  deductCredits(amount: number, actionName: UsageLog['action'], details: string, modelUsed = 'ia-engine') {
    const state = saasStore.get();
    const user = state.users.find((u) => u.id === state.currentUserId);
    if (!user) return false;

    // Check if user has sufficient credits
    const remaining = user.creditsTotal - user.creditsUsed;
    if (remaining < amount && user.role !== 'superadmin') {
      return false; // Insufficient credits
    }

    const updatedUsers = state.users.map((u) => {
      if (u.id === user.id) {
        return {
          ...u,
          creditsUsed: u.creditsUsed + amount,
          lastActive: 'Hace un momento',
        };
      }
      return u;
    });

    const newLog: UsageLog = {
      id: `log_${Date.now()}`,
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      action: actionName,
      details,
      tokensConsumed: amount,
      creditsDeducted: amount,
      estimatedCostUSD: (amount / 1000) * 0.003,
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
      modelUsed,
    };

    const nextState = {
      ...state,
      users: updatedUsers,
      logs: [newLog, ...state.logs.slice(0, 99)],
    };

    saasStore.set(nextState);
    persistState(nextState);
    return true;
  },

  // Toggle user active / suspended status
  toggleUserStatus(userId: string) {
    const state = saasStore.get();
    const updatedUsers = state.users.map((u) => {
      if (u.id === userId) {
        return {
          ...u,
          status: u.status === 'active' ? ('suspended' as const) : ('active' as const),
        };
      }
      return u;
    });

    const nextState = { ...state, users: updatedUsers };
    saasStore.set(nextState);
    persistState(nextState);
  },

  // Create a new user (Admin modal)
  createUser(name: string, email: string, planId: PlanTier, role: UserRole = 'user', company = 'Individual', password?: string) {
    const state = saasStore.get();
    const plan = state.plans.find((p) => p.id === planId) || state.plans[0];

    const newUser: SaaSUser = {
      id: `usr_${Date.now()}`,
      name,
      email,
      password: password || 'GenUI2026!',
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(name)}`,
      role,
      planId,
      status: 'active',
      creditsTotal: plan.creditsMonthly,
      creditsUsed: 0,
      createdAt: new Date().toISOString().slice(0, 10),
      lastActive: 'Recién registrado',
      company,
    };

    const nextState = {
      ...state,
      users: [newUser, ...state.users],
    };

    saasStore.set(nextState);
    persistState(nextState);
  },

  // Update plan details (prices, credits, features)
  updatePlan(planId: PlanTier, updates: Partial<SaaSPlan>) {
    const state = saasStore.get();
    const updatedPlans = state.plans.map((p) => {
      if (p.id === planId) {
        return { ...p, ...updates };
      }
      return p;
    });

    const nextState = { ...state, plans: updatedPlans };
    saasStore.set(nextState);
    persistState(nextState);
  },

  // Reset to original seed data
  resetDefaults() {
    const freshState: SaaSState = {
      currentUserId: 'usr_admin_01',
      isAuthenticated: true,
      plans: SEED_PLANS,
      users: SEED_USERS,
      logs: SEED_LOGS,
    };
    saasStore.set(freshState);
    persistState(freshState);
  },
};
