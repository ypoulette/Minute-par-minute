import React, { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Plus, X } from 'lucide-react';

interface ResourceMultiSelectProps {
  values: string[];
  options: string[];
  placeholder?: string;
  onChange: (nextValues: string[]) => void;
  onAddOption: (newOption: string) => Promise<void> | void;
  compact?: boolean;
  disabled?: boolean;
  ariaLabel?: string;
}

export const ResourceMultiSelect: React.FC<ResourceMultiSelectProps> = ({
  values,
  options,
  placeholder = 'Exécutant(s)...',
  onChange,
  onAddOption,
  compact = false,
  disabled = false,
  ariaLabel = 'Exécutants',
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
    const openUp = spaceBelow < 290 && rect.top > 290;
    const left = Math.min(rect.left, window.innerWidth - 275);
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
  const allKnownOptions = Array.from(new Set([...values, ...options])).sort((a, b) =>
    a.localeCompare(b, 'fr', { sensitivity: 'base' })
  );

  const filtered = allKnownOptions.filter((opt) =>
    opt.toLowerCase().includes(trimmedSearch.toLowerCase())
  );
  const exactExists = allKnownOptions.some(
    (opt) => opt.toLowerCase() === trimmedSearch.toLowerCase()
  );

  const toggleItem = (item: string) => {
    const exists = values.includes(item);
    const next = exists ? values.filter((v) => v !== item) : [...values, item];
    onChange(next);
  };

  const handleCreateAndSelect = async () => {
    if (!trimmedSearch) return;
    await onAddOption(trimmedSearch);
    if (!values.includes(trimmedSearch)) {
      onChange([...values, trimmedSearch]);
    }
    setSearch('');
  };

  const displaySummary =
    values.length === 0
      ? placeholder
      : values.length <= 2
      ? values.join(', ')
      : `${values[0]}, ${values[1]} (+${values.length - 2})`;

  return (
    <div ref={containerRef} className="relative w-full space-y-1.5">
      <button
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        title={values.length > 0 ? values.join(', ') : placeholder}
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
        <span className={`truncate ${values.length > 0 ? (disabled ? 'text-slate-600' : 'text-slate-900') : 'text-slate-400'}`}>
          {displaySummary}
        </span>
        <div className="flex items-center gap-1 shrink-0">
          {values.length > 1 && (
            <span className="text-[11px] font-mono text-blue-700 font-medium">
              {values.length}
            </span>
          )}
          {!disabled && <ChevronDown className="w-3.5 h-3.5 text-slate-400" />}
        </div>
      </button>

      {/* In non-compact views (Detail page / Modal), list selected items cleanly below with remove X */}
      {!compact && values.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-700 pt-0.5">
          {values.map((v) => (
            <span key={v} className="inline-flex items-center gap-1">
              <span>{v}</span>
              <button
                type="button"
                onClick={() => toggleItem(v)}
                className="text-slate-400 hover:text-red-600"
                title={`Retirer ${v}`}
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {isOpen && (
        <div
          ref={popoverRef}
          style={{
            position: 'fixed',
            top: coords.top,
            left: coords.left,
            transform: coords.openUp ? 'translateY(-100%)' : undefined,
          }}
          className="z-[100] w-68 bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden"
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
                    toggleItem(filtered[0]);
                  }
                } else if (e.key === 'Escape') {
                  setIsOpen(false);
                  setSearch('');
                }
              }}
              placeholder="Rechercher ou ajouter un nom..."
              className="w-full text-xs px-2 py-1.5 bg-slate-50 border border-slate-200 rounded focus:outline-none focus:border-blue-500 text-slate-900"
            />
            {values.length > 0 && (
              <button
                type="button"
                title="Tout désélectionner"
                onClick={() => onChange([])}
                className="p-1 text-slate-400 hover:text-slate-700 rounded"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="px-3 py-1.5 bg-slate-50/70 border-b border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>Sélection multiple ({values.length} choisi{values.length > 1 ? 's' : ''})</span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-blue-600 hover:text-blue-700 font-medium"
            >
              Terminé
            </button>
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

            {filtered.length === 0 && !trimmedSearch && (
              <div className="px-3 py-2 text-xs text-slate-400">
                Aucune ressource disponible
              </div>
            )}

            {filtered.map((opt) => {
              const checked = values.includes(opt);
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => toggleItem(opt)}
                  className={`w-full flex items-center justify-between px-3 py-1.5 text-xs text-left transition-colors ${
                    checked
                      ? 'bg-blue-50/60 text-blue-900 font-medium'
                      : 'text-slate-800 hover:bg-slate-50'
                  }`}
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <span
                      className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${
                        checked
                          ? 'bg-blue-600 border-blue-600 text-white'
                          : 'border-slate-300 bg-white'
                      }`}
                    >
                      {checked && <Check className="w-2.5 h-2.5" />}
                    </span>
                    <span className="truncate">{opt}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};