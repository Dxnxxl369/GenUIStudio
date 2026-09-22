import React from 'react';

interface PromptTemplate {
  title: string;
  category: string;
  description: string;
  prompt: string;
  icon: string;
  accentColor: string;
}

const TEMPLATES: PromptTemplate[] = [
  {
    title: 'Dashboard Analítico & KPIs',
    category: 'Métricas & Finanzas',
    description: 'Gráficos interactivos, indicadores de rendimiento, tablas con filtro y reportes SQL.',
    prompt: 'Dashboard Analítico Ejecutivo con gráficos interactivos, KPIs financieros, tablas dinámicas y módulo de reportes generativos',
    icon: 'i-ph:chart-polar-duotone',
    accentColor: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
  },
  {
    title: 'Sistema POS & Inventario',
    category: 'Comercio & Retail',
    description: 'Punto de venta rápido, control de stock crítico, facturación y catálogo de productos.',
    prompt: 'Sistema POS de Ventas y Facturación completo con gestión de inventario, stock crítico, catálogo de productos y arqueo de caja',
    icon: 'i-ph:shopping-bag-open-duotone',
    accentColor: 'text-teal-500 bg-teal-500/10 border-teal-500/20',
  },
  {
    title: 'Clínica & Agenda Médica',
    category: 'Salud & Servicios',
    description: 'Control de citas, historias clínicas, fichas de pacientes y recordatorios.',
    prompt: 'Sistema de Gestión de Clínica Veterinaria con agenda de citas, historial clínico de pacientes, control de vacunas y fichas médicas',
    icon: 'i-ph:heartbeat-duotone',
    accentColor: 'text-cyan-500 bg-cyan-500/10 border-cyan-500/20',
  },
  {
    title: 'Proveedores & Compras',
    category: 'Operaciones & B2B',
    description: 'Directorio de proveedores, órdenes de compra, tabla interactiva y estado de envíos.',
    prompt: 'Sistema de Gestión de Proveedores y Compras con tabla de datos reactiva, filtrado inteligente y modal de registro de pedidos',
    icon: 'i-ph:package-duotone',
    accentColor: 'text-indigo-500 bg-indigo-500/10 border-indigo-500/20',
  },
];

interface PromptTemplatesGridProps {
  onSelectPrompt: (event: React.UIEvent, text: string) => void;
}

export function PromptTemplatesGrid({ onSelectPrompt }: PromptTemplatesGridProps) {
  return (
    <div id="examples" className="w-full max-w-4xl mx-auto mt-4 px-2 sm:px-0">
      <div className="flex items-center justify-between mb-3 px-1">
        <span className="text-xs font-semibold text-bolt-elements-textTertiary uppercase tracking-wider flex items-center gap-1.5">
          <span className="i-ph:lightbulb-filament-fill text-amber-400 text-sm" />
          <span>Plantillas de Inicio Rápido</span>
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {TEMPLATES.map((item, idx) => (
          <button
            key={idx}
            type="button"
            onClick={(e) => onSelectPrompt(e, item.prompt)}
            className="group relative p-3.5 rounded-xl text-left transition-all duration-200 cursor-pointer bg-bolt-elements-background-depth-2 hover:bg-bolt-elements-item-backgroundHover border border-bolt-elements-borderColor hover:border-emerald-500/40 shadow-xs flex flex-col justify-between"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center border shrink-0 ${item.accentColor} group-hover:scale-105 transition`}
                >
                  <span className={`${item.icon} text-lg`} />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-bolt-elements-textPrimary group-hover:text-emerald-500 transition">
                    {item.title}
                  </h4>
                  <span className="text-[10px] text-bolt-elements-textTertiary font-medium">
                    {item.category}
                  </span>
                </div>
              </div>
              <span className="i-ph:arrow-up-right text-sm text-bolt-elements-textTertiary group-hover:text-emerald-500 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition" />
            </div>

            <p className="text-[11px] text-bolt-elements-textSecondary mt-2 leading-relaxed">
              {item.description}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}
