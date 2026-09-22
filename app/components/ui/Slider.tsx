import { motion } from 'framer-motion';
import { memo } from 'react';
import { classNames } from '~/utils/classNames';
import { cubicEasingFn } from '~/utils/easings';
import { genericMemo } from '~/utils/react';

export type SliderItem<T> = {
  value: T;
  text: string;
  icon?: string;
  badge?: string | number;
};

export type SliderOptions<T> =
  | {
      left: { value: T; text: string; icon?: string };
      middle?: { value: T; text: string; icon?: string };
      right: { value: T; text: string; icon?: string };
    }
  | Array<SliderItem<T>>;

interface SliderProps<T> {
  selected: T;
  options: SliderOptions<T>;
  setSelected?: (selected: T) => void;
}

export const Slider = genericMemo(<T,>({ selected, options, setSelected }: SliderProps<T>) => {
  const items: SliderItem<T>[] = Array.isArray(options)
    ? options
    : [options.left, ...(options.middle ? [options.middle] : []), options.right];

  return (
    <div className="flex items-center flex-wrap shrink-0 gap-1 bg-bolt-elements-background-depth-1 overflow-hidden rounded-full p-1">
      {items.map((item) => {
        const isSelected = selected === item.value;

        return (
          <SliderButton
            key={String(item.value)}
            selected={isSelected}
            setSelected={() => setSelected?.(item.value)}
          >
            <span className="flex items-center gap-1.5">
              {item.icon && <div className={classNames(item.icon, 'text-sm')} />}
              <span>{item.text}</span>
              {item.badge !== undefined && (
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-accent-500/20 text-accent-500">
                  {item.badge}
                </span>
              )}
            </span>
          </SliderButton>
        );
      })}
    </div>
  );
});

interface SliderButtonProps {
  selected: boolean;
  children: string | JSX.Element | Array<JSX.Element | string>;
  setSelected: () => void;
}

const SliderButton = memo(({ selected, children, setSelected }: SliderButtonProps) => {
  return (
    <button
      onClick={setSelected}
      className={classNames(
        'bg-transparent text-sm px-2.5 py-0.5 rounded-full relative',
        selected
          ? 'text-bolt-elements-item-contentAccent'
          : 'text-bolt-elements-item-contentDefault hover:text-bolt-elements-item-contentActive',
      )}
    >
      <span className="relative z-10">{children}</span>
      {selected && (
        <motion.span
          layoutId="pill-tab"
          transition={{ duration: 0.2, ease: cubicEasingFn }}
          className="absolute inset-0 z-0 bg-bolt-elements-item-backgroundAccent rounded-full"
        ></motion.span>
      )}
    </button>
  );
});
