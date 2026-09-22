import React, { useState, useEffect } from 'react';
import { useStore } from '@nanostores/react';
import { toast } from 'react-toastify';
import { currentUser, saasActions, type SaaSPlan } from '~/lib/stores/saasStore';
import { classNames } from '~/utils/classNames';

interface PaymentCheckoutModalProps {
  isOpen: boolean;
  targetPlan: SaaSPlan | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function PaymentCheckoutModal({
  isOpen,
  targetPlan,
  onClose,
  onSuccess,
}: PaymentCheckoutModalProps) {
  const user = useStore(currentUser);

  const [cardNumber, setCardNumber] = useState('');
  const [cardholderName, setCardholderName] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvc, setCvc] = useState('');
  const [cardBrand, setCardBrand] = useState<'visa' | 'mastercard'>('visa');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processStep, setProcessStep] = useState<number>(0);

  // Initialize cardholder with user name
  useEffect(() => {
    if (user && !cardholderName) {
      setCardholderName(user.name.toUpperCase());
    }
  }, [user]);

  if (!isOpen || !targetPlan) return null;

  // Auto-detect brand based on first digit
  const handleCardNumberChange = (val: string) => {
    // Remove non-digits
    const clean = val.replace(/\D/g, '').slice(0, 16);
    if (clean.startsWith('5')) {
      setCardBrand('mastercard');
    } else {
      setCardBrand('visa');
    }

    // Format in groups of 4
    const parts = clean.match(/.{1,4}/g) || [];
    setCardNumber(parts.join(' '));
  };

  const handleExpiryChange = (val: string) => {
    const clean = val.replace(/\D/g, '').slice(0, 4);
    if (clean.length >= 2) {
      setExpiry(`${clean.slice(0, 2)}/${clean.slice(2)}`);
    } else {
      setExpiry(clean);
    }
  };

  const handleFillDemoVisa = () => {
    setCardNumber('4532 8921 4432 8842');
    setCardBrand('visa');
    setExpiry('12/28');
    setCvc('382');
    setCardholderName(user.name ? user.name.toUpperCase() : 'ALEXANDER ADMIN');
    toast.info('💳 Datos de Visa de Prueba cargados');
  };

  const handleFillDemoMastercard = () => {
    setCardNumber('5421 9832 7712 9914');
    setCardBrand('mastercard');
    setExpiry('10/27');
    setCvc('741');
    setCardholderName(user.name ? user.name.toUpperCase() : 'LUCÍA FERNÁNDEZ');
    toast.info('💳 Datos de Mastercard de Prueba cargados');
  };

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();

    const rawNumber = cardNumber.replace(/\s/g, '');
    if (rawNumber.length < 15) {
      toast.warn('Por favor ingresa un número de tarjeta válido (16 dígitos)');
      return;
    }

    if (expiry.length < 5) {
      toast.warn('Por favor ingresa una fecha de expiración válida (MM/AA)');
      return;
    }

    if (cvc.length < 3) {
      toast.warn('Por favor ingresa el código CVC de 3 dígitos');
      return;
    }

    // Start realistic simulated payment flow
    setIsProcessing(true);
    setProcessStep(1);

    await new Promise((r) => setTimeout(r, 900));
    setProcessStep(2);

    await new Promise((r) => setTimeout(r, 1100));
    setProcessStep(3);

    await new Promise((r) => setTimeout(r, 700));

    const cardLast4 = rawNumber.slice(-4) || '4242';
    const result = saasActions.processPaymentAndUpgrade(user.id, targetPlan.id, {
      cardBrand,
      cardLast4,
      cardholder: cardholderName || user.name,
    });

    setIsProcessing(false);
    setProcessStep(0);

    if (result.success) {
      toast.success(
        `🎉 ¡Pago aprobado con éxito! Tu cuenta ha sido actualizada al plan ${targetPlan.name}.`,
      );
      onSuccess();
      onClose();
    } else {
      toast.error('Ocurrió un error al procesar la transacción bancaria');
    }
  };

  const displayMaskedNumber = cardNumber
    ? cardNumber
    : '•••• •••• •••• ••••';

  return (
    <div className="fixed inset-0 z-[350] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in overflow-y-auto">
      <div
        className="relative w-full max-w-2xl my-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between bg-zinc-50 dark:bg-zinc-900/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <span className="i-ph:lock-key-fill text-base" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-zinc-900 dark:text-white">
                  Pasarela de Pago Segura
                </h3>
                <span className="px-2 py-0.5 text-[10px] font-mono font-semibold uppercase rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  256-Bit SSL
                </span>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Mejora tu plan a <strong className="text-zinc-800 dark:text-zinc-200">{targetPlan.name}</strong> • ${targetPlan.priceMonthly} USD/mes
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition disabled:opacity-50"
          >
            <span className="i-ph:x text-xl" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6">
          {/* Quick Demo Autofill Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs">
            <span className="font-semibold text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
              <span className="i-ph:magic-wand text-emerald-500" />
              <span>Simulador Rápido de Tarjetas:</span>
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleFillDemoVisa}
                className="px-2.5 py-1 rounded-lg font-bold text-[11px] bg-blue-600 hover:bg-blue-500 text-white transition flex items-center gap-1 shadow-xs cursor-pointer"
              >
                <span>Usar Visa</span>
                <span className="opacity-70 text-[9px]">4532</span>
              </button>
              <button
                type="button"
                onClick={handleFillDemoMastercard}
                className="px-2.5 py-1 rounded-lg font-bold text-[11px] bg-amber-600 hover:bg-amber-500 text-white transition flex items-center gap-1 shadow-xs cursor-pointer"
              >
                <span>Usar Mastercard</span>
                <span className="opacity-70 text-[9px]">5421</span>
              </button>
            </div>
          </div>

          {/* Interactive Virtual Credit Card Visual */}
          <div className="relative w-full max-w-md mx-auto aspect-[1.586] rounded-2xl p-6 text-white shadow-2xl flex flex-col justify-between overflow-hidden select-none border border-white/10 transition-all duration-300">
            {/* Card Background Gradient */}
            <div
              className={classNames(
                'absolute inset-0 transition-colors duration-500',
                cardBrand === 'mastercard'
                  ? 'bg-gradient-to-tr from-zinc-900 via-rose-950 to-amber-900'
                  : 'bg-gradient-to-tr from-slate-950 via-indigo-950 to-blue-900',
              )}
            />
            {/* Glossy overlay */}
            <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent pointer-events-none" />

            {/* Top row: Chip & Contactless */}
            <div className="relative z-10 flex items-center justify-between">
              <div className="flex items-center gap-3">
                {/* Chip */}
                <div className="w-11 h-8 rounded-md bg-gradient-to-br from-amber-200 via-amber-400 to-amber-600 border border-amber-300/60 shadow-inner flex items-center justify-center">
                  <div className="w-8 h-5 border border-amber-800/30 rounded-xs grid grid-cols-2 gap-0.5 opacity-60" />
                </div>
                {/* Contactless */}
                <span className="i-ph:wave-triangle text-lg text-white/70" />
              </div>

              {/* Brand Logo */}
              <div className="flex items-center">
                {cardBrand === 'mastercard' ? (
                  <div className="flex items-center -space-x-2">
                    <div className="w-7 h-7 rounded-full bg-rose-500/90 shadow-sm" />
                    <div className="w-7 h-7 rounded-full bg-amber-500/90 shadow-sm" />
                  </div>
                ) : (
                  <div className="px-2 py-0.5 font-black italic tracking-widest text-lg text-white bg-blue-600/60 rounded border border-white/20">
                    VISA
                  </div>
                )}
              </div>
            </div>

            {/* Card Number */}
            <div className="relative z-10 font-mono text-lg sm:text-xl tracking-widest text-zinc-100 drop-shadow-md">
              {displayMaskedNumber}
            </div>

            {/* Bottom row: Cardholder & Expiry */}
            <div className="relative z-10 flex items-end justify-between text-xs">
              <div>
                <span className="text-[9px] uppercase tracking-wider text-zinc-400 block font-mono">
                  TITULAR DE LA TARJETA
                </span>
                <span className="font-bold tracking-wider truncate max-w-[180px] block">
                  {cardholderName || 'NOMBRE APELLIDO'}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[9px] uppercase tracking-wider text-zinc-400 block font-mono">
                  VENCE
                </span>
                <span className="font-mono font-bold tracking-wider">
                  {expiry || 'MM/AA'}
                </span>
              </div>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handlePay} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                Nombre en la Tarjeta
              </label>
              <input
                type="text"
                required
                value={cardholderName}
                onChange={(e) => setCardholderName(e.target.value.toUpperCase())}
                placeholder="EJ. JUAN PÉREZ"
                className="w-full px-3.5 py-2 text-xs rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:border-emerald-500 uppercase transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                Número de Tarjeta
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={cardNumber}
                  onChange={(e) => handleCardNumberChange(e.target.value)}
                  placeholder="4532 •••• •••• ••••"
                  maxLength={19}
                  className="w-full pl-3.5 pr-12 py-2 text-xs font-mono rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:border-emerald-500 transition"
                />
                <div className="absolute right-3 top-2 flex items-center gap-1.5 text-lg">
                  {cardBrand === 'mastercard' ? (
                    <span className="i-ph:credit-card text-amber-500" title="Mastercard detectada" />
                  ) : (
                    <span className="i-ph:credit-card text-blue-500" title="Visa detectada" />
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Expiración (MM/AA)
                </label>
                <input
                  type="text"
                  required
                  value={expiry}
                  onChange={(e) => handleExpiryChange(e.target.value)}
                  placeholder="12/28"
                  maxLength={5}
                  className="w-full px-3.5 py-2 text-xs font-mono rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:border-emerald-500 transition text-center"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Código CVC / CVV
                </label>
                <div className="relative">
                  <input
                    type="password"
                    required
                    value={cvc}
                    onChange={(e) => setCvc(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    placeholder="•••"
                    maxLength={4}
                    className="w-full px-3.5 py-2 text-xs font-mono rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:border-emerald-500 transition text-center"
                  />
                  <span className="i-ph:shield-check text-xs text-zinc-400 absolute right-3 top-2.5" />
                </div>
              </div>
            </div>

            {/* Order Breakdown Box */}
            <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-900/70 border border-zinc-200 dark:border-zinc-800 space-y-2 text-xs">
              <div className="flex items-center justify-between text-zinc-600 dark:text-zinc-400">
                <span>Subtotal ({targetPlan.name}):</span>
                <span className="font-mono">${targetPlan.priceMonthly}.00 USD</span>
              </div>
              <div className="flex items-center justify-between text-zinc-600 dark:text-zinc-400">
                <span>Impuestos / IVA (0%):</span>
                <span className="font-mono">$0.00 USD</span>
              </div>
              <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between font-bold text-zinc-900 dark:text-white text-sm">
                <span>Total a Cobrar Hoy:</span>
                <span className="font-mono text-emerald-600 dark:text-emerald-400">
                  ${targetPlan.priceMonthly}.00 USD
                </span>
              </div>
            </div>

            {/* Processing Simulation Alert */}
            {isProcessing && (
              <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-3 animate-pulse">
                <span className="i-svg-spinners:90-ring-with-bg text-xl shrink-0" />
                <div>
                  <span className="font-bold block">
                    {processStep === 1 && 'Conectando con la red bancaria 256-Bit SSL...'}
                    {processStep === 2 && 'Validando protocolo de seguridad 3D-Secure...'}
                    {processStep === 3 && '¡Transacción autorizada! Acreditando cuota...'}
                  </span>
                  <span className="text-[11px] opacity-80">
                    No cierres esta ventana mientras se confirma la operación.
                  </span>
                </div>
              </div>
            )}

            {/* Submit Button */}
            <div className="pt-2 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={isProcessing}
                className="px-4 py-2 text-xs font-semibold rounded-xl text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition disabled:opacity-50 cursor-pointer"
              >
                Cancelar
              </button>

              <button
                type="submit"
                disabled={isProcessing}
                className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 shadow-md shadow-emerald-600/20 transition flex items-center gap-2 disabled:opacity-50 cursor-pointer hover:scale-102"
              >
                {isProcessing ? (
                  <>
                    <span className="i-svg-spinners:90-ring-with-bg text-sm" />
                    <span>Procesando Pago...</span>
                  </>
                ) : (
                  <>
                    <span className="i-ph:check-circle-fill text-sm" />
                    <span>Confirmar Pago de ${targetPlan.priceMonthly} USD</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
