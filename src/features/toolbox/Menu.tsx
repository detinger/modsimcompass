import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { ChevronDown, type LucideIcon } from 'lucide-react';

export interface MenuItem { id: string; label: string; run: () => void; detail?: string; icon?: LucideIcon; current?: boolean; /** Draws a line above the item. */ divider?: boolean }

/**
 * A button that opens a small menu. Keyboard: Enter, Space or Arrow Down opens; arrows, Home and End move;
 * Enter or Space chooses; Escape closes and gives the focus back to the button; Tab closes and moves on.
 */
export function MenuButton({ label, icon: Icon, items, empty, disabled, align = 'start', className = 'btn' }: {
  label: string; icon?: LucideIcon; items: MenuItem[]; /** A line of text above the items, for example “Nothing saved yet”. */ empty?: string; disabled?: boolean;
  align?: 'start' | 'end'; className?: string;
}) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  const options = () => Array.from(wrap.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
  const close = (refocus: boolean) => { setOpen(false); if (refocus) button.current?.focus(); };

  useEffect(() => {
    if (!open) return;
    (options()[0] ?? wrap.current?.querySelector<HTMLElement>('.menu-pop'))?.focus();
    const outside = (e: MouseEvent) => { if (!wrap.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', outside);
    return () => document.removeEventListener('mousedown', outside);
  }, [open]);

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!open) return;
    const list = options(), at = list.indexOf(document.activeElement as HTMLElement);
    const move = (i: number) => { e.preventDefault(); list[(i + list.length) % list.length]?.focus(); };
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(true); }
    else if (e.key === 'ArrowDown') move(at + 1);
    else if (e.key === 'ArrowUp') move(at <= 0 ? list.length - 1 : at - 1);
    else if (e.key === 'Home') move(0);
    else if (e.key === 'End') move(list.length - 1);
    else if (e.key === 'Tab') setOpen(false);
  };

  return (
    <div className={`menu-wrap${align === 'end' ? ' end' : ''}`} ref={wrap} onKeyDown={onKey}>
      <button ref={button} type="button" className={className} aria-haspopup="menu" aria-expanded={open} aria-controls={open ? menuId : undefined} disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => { if (e.key === 'ArrowDown' && !open) { e.preventDefault(); setOpen(true); } }}>
        {Icon && <Icon size={16} aria-hidden="true" />} {label} <ChevronDown size={14} aria-hidden="true" className="menu-caret" />
      </button>
      {open && (
        <div className="menu-pop" id={menuId} role="menu" aria-label={label} tabIndex={-1}>
          {empty && <p className="menu-empty" role="presentation">{empty}</p>}
          {items.map((it) => {
            const I = it.icon;
            return (
              <button key={it.id} type="button" role="menuitem" className={`menu-item${it.divider ? ' divided' : ''}`} aria-current={it.current ? 'true' : undefined}
                onClick={() => { close(true); it.run(); }}>
                {I && <I size={16} aria-hidden="true" />}
                <span className="menu-label">{it.label}{it.detail && <small>{it.detail}</small>}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
