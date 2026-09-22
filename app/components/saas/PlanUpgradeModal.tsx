import React, { useState } from 'react';
import { useStore } from '@nanostores/react';
import { toast } from 'react-toastify';
import { saasStore, currentUser, currentPlan, saasActions, type PlanTier, type SaaSPlan } from '~/lib/stores/saasStore';
import { classNames } from '~/utils/classNames';
import { PaymentCheckoutModal } from './PaymentCheckoutModal';

interface PlanUpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function PlanUpgradeModal({ isOpen, onClose }: PlanUpgradeModalProps) {
  const state = useStore(saasStore);
  const user = useStore(currentUser);
  const activePlan = useStore(currentPlan);
  const [selectedPlanForPayment, setSelectedPlanForPayment] = useState<SaaSPlan | null>(null);

  if (!isOpen) return null;

  const handleSelectPlan = (plan: SaaSPlan) => {
    if (plan.id === user.planId) {
      toast.info(`Ya te encuentras en el plan ${plan.name}`);
      return;
    }

    if (plan.priceMonthly === 0) {
      saasActions.changeUserPlan(user.id, plan.id);
      toast.success(`Has cambiado al plan ${plan.name}`);
      onClose();
      return;
    }

    // Open Visa / Mastercard Checkout Modal
    setSelectedPlanForPayment(plan);
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div
        className="relative w-full max-w-5xl my-8 rounded-2xl border border-zinc-200 dark:border-[#2a2a25] bg-white dark:bg-[#131311] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 pb-4 border-b border-zinc-100 dark:border-[#2a2a25] flex items-start justify-between bg-zinc-50/50 dark:bg-[#1a1a17]/50">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#ff7a1a]/10 text-[#ff7a1a] border border-[#ff7a1a]/20 mb-2">
              <span className="i-ph:sparkle-fill text-xs" />
              <span>Suscripciones & Cuotas de IA</span>
            </div>
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-[#f2f0e9] tracking-tight">
              Elige el Plan Ideal para tu Flujo de Desarrollo
            </h2>
            <p className="text-xs text-zinc-500 dark:text-[#8c887b] mt-1">
              Desbloquea modelos avanzados, inyección de reportes en código, exportación SQL completa y despliegues sin límites.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-[#1a1a17] transition"
          >
            <span className="i-ph:x text-xl" />
          </button>
        </div>

        {/* Plans Grid */}
        <div className="p-6 overflow-y-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {state.plans.map((plan) => {
            const isCurrent = plan.id === activePlan.id;
            return (
              <div
                key={plan.id}
                className={classNames(
                  'relative rounded-xl p-5 flex flex-col justify-between border transition-all duration-200',
                  plan.isPopular
                    ? 'border-[#ff7a1a]/50 bg-[#ff7a1a]/5 dark:bg-[#ff7a1a]/10 shadow-md ring-1 ring-[#ff7a1a]/30'
                    : 'border-zinc-200 dark:border-[#2a2a25] bg-white dark:bg-[#1a1a17]/60 hover:border-zinc-300 dark:hover:border-[#3a3a35]',
                )}
              >
                {plan.isPopular && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-gradient-to-r from-[#ff7a1a] to-[#d65f00] text-[#0a0a09] shadow-sm">
                    Más Popular
                  </span>
                )}

                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <h3 className="text-base font-bold text-zinc-900 dark:text-[#f2f0e9]">{plan.name}</h3>
                    <span
                      className={classNames(
                        'px-2 py-0.5 text-[10px] font-semibold rounded-md uppercase tracking-wider',
                        isCurrent
                          ? 'bg-[#ff7a1a]/15 text-[#ff7a1a] border border-[#ff7a1a]/30'
                          : 'bg-zinc-100 dark:bg-[#2a2a25] text-zinc-600 dark:text-[#8c887b]',
                      )}
                    >
                      {plan.badge}
                    </span>
                  </div>

                  <p className="text-[11px] text-zinc-500 dark:text-[#8c887b] min-h-[32px] mb-4">
                    {plan.description}
                  </p>

                  <div className="mb-4">
                    <span className="text-3xl font-black text-zinc-900 dark:text-[#f2f0e9]">
                      ${plan.priceMonthly}
                    </span>
                    <span className="text-xs text-zinc-500 dark:text-[#8c887b] font-medium"> / mes</span>
                  </div>

                  <div className="p-2.5 rounded-lg bg-zinc-50 dark:bg-[#131311] border border-zinc-100 dark:border-[#2a2a25] mb-4">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-zinc-600 dark:text-[#8c887b] font-medium">Créditos de IA:</span>
                      <span className="font-mono font-bold text-[#ff7a1a]">
                        {plan.creditsMonthly.toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {/* Feature Checklist */}
                  <ul className="space-y-2 text-xs mb-6">
                    {plan.features.map((feat, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-zinc-600 dark:text-[#d0cbbe]">
                        <span className="i-ph:check-circle-fill text-[#ff7a1a] text-sm shrink-0 mt-0.5" />
                        <span className="leading-tight">{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Plan Selection Action */}
                <button
                  onClick={() => handleSelectPlan(plan)}
                  disabled={isCurrent}
                  className={classNames(
                    'w-full py-2.5 px-4 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-sm',
                    isCurrent
                      ? 'bg-zinc-100 dark:bg-[#2a2a25] text-zinc-400 dark:text-zinc-500 cursor-not-allowed border border-zinc-200 dark:border-[#2a2a25]'
                      : plan.isPopular
                      ? 'bg-[#ff7a1a] hover:bg-[#ff8c3a] text-[#0a0a09] shadow-[#ff7a1a]/20 font-bold'
                      : 'bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-100 text-white dark:text-zinc-900',
                  )}
                >
                  {isCurrent ? (
                    <>
                      <span className="i-ph:check text-sm" />
                      <span>Plan Actual</span>
                    </>
                  ) : (
                    <>
                      <span className="i-ph:lightning-fill text-xs" />
                      <span>{plan.priceMonthly === 0 ? 'Seleccionar Plan' : 'Mejorar Ahora'}</span>
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>

        {/* Footer Note */}
        <div className="p-4 border-t border-zinc-100 dark:border-zinc-800/80 bg-zinc-50 dark:bg-zinc-900/30 flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
          <div className="flex items-center gap-2">
            <span className="i-ph:shield-check text-emerald-500 text-base" />
            <span>Facturación segura con Stripe & MercadoPago. Cancela o cambia de plan en cualquier momento.</span>
          </div>
          <span className="text-[11px] font-mono text-zinc-400">
            Usuario actual: {user.name} ({user.email})
          </span>
        </div>
      </div>

      {/* Credit Card Payment Checkout Modal */}
      <PaymentCheckoutModal
        isOpen={!!selectedPlanForPayment}
        targetPlan={selectedPlanForPayment}
        onClose={() => setSelectedPlanForPayment(null)}
        onSuccess={() => {
          setSelectedPlanForPayment(null);
          onClose();
        }}
      />
    </div>
  );
}
