import React, { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Plus, X } from 'lucide-react';

interface ResourceCreatableSelectProps {
  value: string;
  options: string[];
  optionLabels?: Record<string, string>;
  placeholder?: string;
  emptyLabel?: string;
  onChange: (newValue: string) => void;
  onAddOption: (newOption: string) => Promise<void> | void;
  compact?: boolean;
  disabled?: boolean;
  ariaLabel?: string;
}

export const ResourceCreatableSelect: React.FC<ResourceCreatableSelectProps> = ({
  value,
  options,
  optionLabels,
  placeholder = 'Sélectionner...',
  emptyLabel = '— Aucun —',
  onChange,
  onAddOption,
  compact = false,
  disabled = false,
  ariaLabel,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [coords, setCoords] = useState<{ top: number; left: number; openUp: boolean }>({
    top: 0,
    left: 0,
    openUp: false,
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const updatePosition = () => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUp = spaceBelow < 280 && rect.top > 280;
    const left = Math.min(rect.left, window.innerWidth - 270);
    setCoords({
      top: openUp ? rect.top - 4 : rect.bottom + 4,
      left: Math.max(8, left),
      openUp,
    });
  };

  useEffect(() => {
    if (!isOpen) return;
    updatePosition();
    setTimeout(() => inputRef.current?.focus(), 0);

    const handleOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        popoverRef.current &&
        !popoverRef.current.contains(target)
      ) {
        setIsOpen(false);
        setSearch('');
      }
    };

    const handleScrollOrResize = () => updatePosition();

    document.addEventListener('mousedown', handleOutside);
    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);

    return () => {
      document.removeEventListener('mousedown', handleOutside);
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [isOpen]);

  const trimmedSearch = search.trim();
  const filtered = options.filter((opt) => {
    const label = optionLabels?.[opt] ? `${opt} ${optionLabels[opt]}` : opt;
    return label.toLowerCase().includes(trimmedSearch.toLowerCase());
  });
  const exactExists = options.some(
    (opt) => opt.toLowerCase() === trimmedSearch.toLowerCase()
  );

  const handleSelect = (val: string) => {
    onChange(val);
    setIsOpen(false);
    setSearch('');
  };

  const handleCreateAndSelect = async () => {
    if (!trimmedSearch) return;
    await onAddOption(trimmedSearch);
    onChange(trimmedSearch);
    setIsOpen(false);
    setSearch('');
  };

  const displayValue = value && optionLabels?.[value] ? `${value} — ${optionLabels[value]}` : value;

  return (
    <div ref={containerRef} className="relative w-full">
      <button
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        onClick={() => {
          if (disabled) return;
          if (!isOpen) updatePosition();
          setIsOpen((prev) => !prev);
        }}
        className={`w-full flex items-center justify-between gap-1.5 text-left rounded-md border border-slate-200 transition-colors ${
          disabled
            ? 'bg-slate-50 text-slate-500 cursor-not-allowed border-transparent'
            : 'bg-white hover:border-slate-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600'
        } ${
          compact ? 'px-2 py-1 text-xs min-h-[30px]' : 'px-3 py-2 text-sm min-h-[40px]'
        }`}
      >
        <span className={`truncate ${value ? (disabled ? 'text-slate-600' : 'text-slate-900') : 'text-slate-400'}`}>
          {displayValue || placeholder}
        </span>
        {!disabled && <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
      </button>

      {isOpen && (
        <div
          ref={popoverRef}
          style={{
            position: 'fixed',
            top: coords.top,
            left: coords.left,
            transform: coords.openUp ? 'translateY(-100%)' : undefined,
          }}
          className="z-[100] w-64 bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden"
        >
          <div className="p-2 border-b border-slate-100 flex items-center gap-1.5">
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (trimmedSearch && !exactExists) {
                    handleCreateAndSelect();
                  } else if (filtered.length > 0) {
                    handleSelect(filtered[0]);
                  }
                } else if (e.key === 'Escape') {
                  setIsOpen(false);
                  setSearch('');
                }
              }}
              placeholder="Rechercher ou ajouter un nom..."
              className="w-full text-xs px-2 py-1.5 bg-slate-50 border border-slate-200 rounded focus:outline-none focus:border-blue-500 text-slate-900"
            />
            {value && (
              <button
                type="button"
                title="Effacer la sélection"
                onClick={() => handleSelect('')}
                className="p-1 text-slate-400 hover:text-slate-700 rounded"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="max-h-56 overflow-y-auto py-1">
            {trimmedSearch && !exactExists && (
              <button
                type="button"
                onClick={handleCreateAndSelect}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-blue-700 bg-blue-50/70 hover:bg-blue-100/80 text-left transition-colors"
              >
                <Plus className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Ajouter « {trimmedSearch} »</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => handleSelect('')}
              className="w-full flex items-center justify-between px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-50 text-left"
            >
              <span>{emptyLabel}</span>
              {value === '' && <Check className="w-3.5 h-3.5 text-blue-600" />}
            </button>

            {filtered.length === 0 && !trimmedSearch && (
              <div className="px-3 py-2 text-xs text-slate-400">
                Aucune option disponible
              </div>
            )}

            {filtered.map((opt) => {
              const label = optionLabels?.[opt] ? `${opt} — ${optionLabels[opt]}` : opt;
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => handleSelect(opt)}
                  className="w-full flex items-center justify-between px-3 py-1.5 text-xs text-slate-800 hover:bg-slate-50 text-left"
                >
                  <span className="truncate">{label}</span>
                  {value === opt && <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};