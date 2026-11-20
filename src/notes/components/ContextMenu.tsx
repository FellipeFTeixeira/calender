import { useEffect, useLayoutEffect, useRef, useState } from 'react';

export interface MenuItem {
  label: string;
  onClick?: () => void;
  danger?: boolean;
  disabled?: boolean;
  separator?: boolean;
  submenu?: MenuItem[];
  checked?: boolean;
}

interface Props {
  x: number;
  y: number;
  items: MenuItem[];
  onClose: () => void;
}

export function ContextMenu({ x, y, items, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x, y });
  const [open, setOpen] = useState<number | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPos({
      x: Math.min(x, window.innerWidth - r.width - 8),
      y: Math.min(y, window.innerHeight - r.height - 8),
    });
  }, [x, y]);

  useEffect(() => {
    const down = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('mousedown', down);
    window.addEventListener('keydown', key);
    window.addEventListener('blur', onClose);
    return () => {
      window.removeEventListener('mousedown', down);
      window.removeEventListener('keydown', key);
      window.removeEventListener('blur', onClose);
    };
  }, [onClose]);

  const render = (list: MenuItem[], sub = false) => (
    <div className={sub ? 'ctx-menu ctx-submenu' : 'ctx-menu'} ref={sub ? undefined : ref} style={sub ? undefined : { left: pos.x, top: pos.y }}>
      {list.map((it, i) =>
        it.separator ? (
          <div key={i} className="ctx-sep" />
        ) : (
          <div
            key={i}
            className={`ctx-item${it.danger ? ' danger' : ''}${it.disabled ? ' disabled' : ''}${it.submenu ? ' has-sub' : ''}`}
            onMouseEnter={() => !sub && setOpen(it.submenu ? i : null)}
            onClick={(e) => {
              e.stopPropagation();
              if (it.disabled || it.submenu) return;
              it.onClick?.();
              onClose();
            }}
          >
            <span className="ctx-check">{it.checked ? '✓' : ''}</span>
            <span className="ctx-label">{it.label}</span>
            {it.submenu && <span className="ctx-arrow">›</span>}
            {it.submenu && open === i && render(it.submenu, true)}
          </div>
        ),
      )}
    </div>
  );

  return render(items);
}
