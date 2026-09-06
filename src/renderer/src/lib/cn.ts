import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** Tailwind のクラス衝突を後勝ちで解決しつつ結合する。 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
