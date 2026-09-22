import { AnimatePresence, cubicBezier, motion } from 'framer-motion';

interface SendButtonProps {
  show: boolean;
  isStreaming?: boolean;
  disabled?: boolean;
  onClick?: (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => void;
  onImagesSelected?: (images: File[]) => void;
}

const customEasingFn = cubicBezier(0.4, 0, 0.2, 1);

export const SendButton = ({ show, isStreaming, disabled, onClick }: SendButtonProps) => {
  return (
    <AnimatePresence>
      {show ? (
        <motion.button
          className="absolute flex justify-center items-center top-[18px] right-[22px] p-1 bg-[#ff7a1a] hover:bg-[#ff8c3a] text-[#0a0a09] font-bold rounded-[8px] w-[34px] h-[34px] transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
          transition={{ ease: customEasingFn, duration: 0.17 }}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          disabled={disabled}
          onClick={(event) => {
            event.preventDefault();

            if (!disabled) {
              onClick?.(event);
            }
          }}
        >
          <div className="text-base font-bold">
            {!isStreaming ? <span>↵</span> : <div className="i-ph:stop-circle-bold text-lg"></div>}
          </div>
        </motion.button>
      ) : null}
    </AnimatePresence>
  );
};
