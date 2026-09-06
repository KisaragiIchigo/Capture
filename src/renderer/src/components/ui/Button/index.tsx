import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { m } from 'framer-motion'
import { cn } from '@renderer/lib/cn'

type Variant = 'primary' | 'ghost' | 'danger' | 'tally'
type Size = 'sm' | 'md' | 'lg'

/** Framer Motion の m.button は同名のドラッグ / アニメーションハンドラを自前で持つため、DOM 側を外す。 */
type NativeButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'onAnimationStart' | 'onAnimationEnd' | 'onAnimationIteration' | 'onDrag' | 'onDragStart' | 'onDragEnd'
>

interface ButtonProps extends NativeButtonProps {
  variant?: Variant
  size?: Size
  icon?: ReactNode
}

const VARIANT: Record<Variant, string> = {
  primary:
    'bg-accent-gradient text-emerald-50 shadow-accent-glow border border-emerald-400/20 hover:brightness-110',
  ghost:
    'bg-white/[0.02] text-slate-300 border border-white/[0.06] hover:bg-white/[0.05] hover:text-slate-200',
  danger: 'bg-rose-500/10 text-rose-300 border border-rose-500/20 hover:bg-rose-500/15',
  // 録画中であることを示す唯一の赤。他の用途には使わない。
  tally:
    'bg-tally-rec/15 text-rose-200 border border-tally-rec/40 shadow-tally-glow hover:bg-tally-rec/25'
}

const SIZE: Record<Size, string> = {
  sm: 'h-7 px-2.5 text-fluid-2xs gap-1.5',
  md: 'h-9 px-3.5 text-fluid-xs gap-2',
  lg: 'h-11 px-5 text-fluid-sm gap-2.5'
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'ghost', size = 'md', icon, className, children, disabled, ...props },
  ref
) {
  return (
    <m.button
      ref={ref}
      whileHover={disabled ? undefined : { scale: 1.01 }}
      whileTap={disabled ? undefined : { scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 420, damping: 32 }}
      disabled={disabled}
      className={cn(
        'no-drag inline-flex select-none items-center justify-center rounded-md font-medium tracking-wide transition-colors duration-150',
        'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-teal-500/50',
        // 無効状態はグレーアウトせず透明度で示す。色が死ぬと何のボタンか読めなくなる。
        'disabled:pointer-events-none disabled:opacity-[0.3]',
        VARIANT[variant],
        SIZE[size],
        className
      )}
      {...props}
    >
      {icon}
      {children}
    </m.button>
  )
})
