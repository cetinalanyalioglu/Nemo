import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { IoChevronDown } from 'react-icons/io5';
import MathLabel from './MathLabel';

export interface MathSelectOption {
  value: string;
  label?: string;
  description?: string;
}

interface MathSelectProps {
  /** Currently selected option value. */
  value: string;
  options: MathSelectOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  /** Extra class names applied to the trigger button. */
  className?: string;
}

/**
 * A select-style dropdown whose trigger and choices are typeset with KaTeX via
 * {@link MathLabel}. Native `<option>` elements only render plain text, so this
 * replaces `<select>` with a button plus a popup listbox, letting option labels
 * carry inline math (e.g. `Rigid ($u' = 0$)`).
 *
 * The menu renders in a portal with fixed positioning because the properties
 * panel clips its groups (`overflow: hidden` for the collapse animation), which
 * would otherwise cut off an inline-positioned popup.
 */
const MathSelect: React.FC<MathSelectProps> = ({
  value,
  options,
  onChange,
  disabled = false,
  className = '',
}) => {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [menuRect, setMenuRect] = useState<{ left: number; top: number; width: number } | null>(
    null
  );
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);

  const selectedIndex = options.findIndex((opt) => opt.value === value);
  const selected = selectedIndex >= 0 ? options[selectedIndex] : undefined;

  const close = useCallback(() => setOpen(false), []);

  const openMenu = useCallback(() => {
    if (disabled) return;
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
    setOpen(true);
  }, [disabled, selectedIndex]);

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    setMenuRect({ left: rect.left, top: rect.bottom, width: rect.width });
  }, []);

  // Position the menu once it opens, and keep it anchored to the trigger as the
  // panel scrolls or the window resizes.
  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
    const handle = () => updatePosition();
    // Capture phase so we also catch scrolling inside the properties panel.
    window.addEventListener('scroll', handle, true);
    window.addEventListener('resize', handle);
    return () => {
      window.removeEventListener('scroll', handle, true);
      window.removeEventListener('resize', handle);
    };
  }, [open, updatePosition]);

  // Close when clicking outside both the trigger and the (portaled) menu.
  useEffect(() => {
    if (!open) return;
    const handle = (event: MouseEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      close();
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [open, close]);

  const commit = (index: number) => {
    const opt = options[index];
    if (opt) onChange(opt.value);
    close();
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (disabled) return;
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        if (!open) openMenu();
        else setActiveIndex((i) => Math.min(options.length - 1, i + 1));
        break;
      case 'ArrowUp':
        event.preventDefault();
        if (!open) openMenu();
        else setActiveIndex((i) => Math.max(0, i - 1));
        break;
      case 'Home':
        if (open) {
          event.preventDefault();
          setActiveIndex(0);
        }
        break;
      case 'End':
        if (open) {
          event.preventDefault();
          setActiveIndex(options.length - 1);
        }
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        if (open) commit(activeIndex);
        else openMenu();
        break;
      case 'Escape':
        if (open) {
          event.preventDefault();
          close();
        }
        break;
      case 'Tab':
        if (open) close();
        break;
      default:
        break;
    }
  };

  return (
    <div className="math-select">
      <button
        ref={triggerRef}
        type="button"
        className={`parameter-select math-select-trigger ${className}`.trim()}
        onClick={() => (open ? close() : openMenu())}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="math-select-value">
          <MathLabel text={selected?.label ?? selected?.value ?? value} />
        </span>
      </button>
      <IoChevronDown className="parameter-select-icon" aria-hidden />
      {open &&
        menuRect &&
        createPortal(
          <ul
            ref={menuRef}
            className="math-select-menu"
            role="listbox"
            style={{ left: menuRect.left, top: menuRect.top, width: menuRect.width }}
          >
            {options.map((opt, index) => (
              <li
                key={opt.value}
                role="option"
                aria-selected={opt.value === value}
                className={`math-select-option${index === activeIndex ? ' active' : ''}${
                  opt.value === value ? ' selected' : ''
                }`}
                title={opt.description}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => commit(index)}
              >
                <MathLabel text={opt.label ?? opt.value} />
              </li>
            ))}
          </ul>,
          document.body
        )}
    </div>
  );
};

export default MathSelect;
