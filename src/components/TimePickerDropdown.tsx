import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, Clock } from 'lucide-react';
import { normalizeTimeInput } from '../utils/scheduleEngine';

interface TimePickerDropdownProps {
  value: string;
  onChange: (newValue: string) => void;
  suggestedNextTime?: string;
  compact?: boolean;
  highlightPending?: boolean;
  onClearPending?: () => void;
  placeholder?: string;
  ariaLabel?: string;
}

const HOURS = [
  '06', '07', '08', '09', '10', '11', '12', '13', '14', '15', '16', '17',
  '18', '19', '20', '21', '22', '23', '00', '01', '02', '03', '04', '05',
];

const MINUTES = ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'];

export const TimePickerDropdown: React.FC<TimePickerDropdownProps> = ({
  value,
  onChange,
  suggestedNextTime,
  compact = false,
  highlightPending = false,
  onClearPending,
  placeholder = 'HH:MM',
  ariaLabel = 'Horaire manuel',
}) => {
  const [draft, setDraft] = useState(value);
  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number; openUp: boolean }>({
    top: 0,
    left: 0,
    openUp: false,
  });

  const wrapperRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  useEffect(() => {
    if (highlightPending) {
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 30);
    }
  }, [highlightPending]);

  const updatePosition = () => {
    if (!wrapperRef.current) return;
    const rect = wrapperRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUp = spaceBelow < 290 && rect.top > 290;
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

    const handleOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(target) &&
        popoverRef.current &&
        !popoverRef.current.contains(target)
      ) {
        setIsOpen(false);
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

  const commitValue = (raw: string, closeAfter = false) => {
    const norm = normalizeTimeInput(raw);
    setDraft(norm);
    if (norm !== value) {
      onChange(norm);
    }
    if (highlightPending && onClearPending) {
      onClearPending();
    }
    if (closeAfter) {
      setIsOpen(false);
    }
  };

  // Parse currently selected HH & MM for highlighting in dropdown
  const match = draft.trim().match(/^(\d{2}):(\d{2})$/);
  const selectedHour = match ? match[1] : '09';
  const selectedMinute = match ? match[2] : '00';

  return (
    <div ref={wrapperRef} className="relative inline-flex items-center">
      <div
        className={`flex items-center rounded border transition-colors ${
          highlightPending
            ? 'bg-blue-50 border-blue-500 ring-2 ring-blue-200'
            : isOpen
            ? 'bg-white border-blue-600'
            : compact
            ? 'bg-white border-slate-200 hover:border-slate-300'
            : 'bg-white border-slate-200 hover:border-slate-300'
        }`}
      >
        <input
          ref={inputRef}
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => commitValue(draft, false)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              commitValue(draft, true);
              e.currentTarget.blur();
            } else if (e.key === 'Escape') {
              setDraft(value);
              setIsOpen(false);
            }
          }}
          placeholder={placeholder}
          aria-label={ariaLabel}
          className={`font-mono tabular-nums bg-transparent focus:outline-none text-slate-900 ${
            compact ? 'w-[46px] px-1 py-1 text-xs' : 'w-full px-3 py-2 text-sm'
          }`}
        />
        <button
          type="button"
          onClick={() => {
            if (!isOpen) updatePosition();
            setIsOpen((prev) => !prev);
          }}
          title="Ouvrir le menu déroulant des heures"
          aria-label="Ouvrir le menu déroulant des heures"
          className={`text-slate-400 hover:text-slate-700 flex items-center justify-center shrink-0 ${
            compact ? 'px-0.5 py-1' : 'px-2.5 py-2 border-l border-slate-100'
          }`}
        >
          <ChevronDown className="w-3.5 h-3.5" />
        </button>
      </div>

      {isOpen && (
        <div
          ref={popoverRef}
          style={{
            position: 'fixed',
            top: coords.top,
            left: coords.left,
            transform: coords.openUp ? 'translateY(-100%)' : undefined,
          }}
          className="z-[100] w-64 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden"
        >
          {/* Quick Presets */}
          <div className="p-2 border-b border-slate-100 bg-slate-50/70 space-y-1.5">
            {suggestedNextTime && suggestedNextTime !== '—' && (
              <button
                type="button"
                onClick={() => commitValue(suggestedNextTime, true)}
                className="w-full flex items-center justify-between px-2.5 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors"
              >
                <span className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  Suite précédente
                </span>
                <span className="font-mono tabular-nums font-semibold">
                  {suggestedNextTime}
                </span>
              </button>
            )}

            <div className="grid grid-cols-3 gap-1">
              <button
                type="button"
                onClick={() => commitValue('AM', true)}
                className={`px-2 py-1 text-xs font-mono font-medium rounded border transition-colors ${
                  draft.toUpperCase() === 'AM'
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                AM
              </button>
              <button
                type="button"
                onClick={() => commitValue('PM', true)}
                className={`px-2 py-1 text-xs font-mono font-medium rounded border transition-colors ${
                  draft.toUpperCase() === 'PM'
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                PM
              </button>
              <button
                type="button"
                onClick={() => commitValue('', true)}
                className="px-2 py-1 text-xs text-slate-500 bg-white border border-slate-200 rounded hover:bg-slate-100"
              >
                Effacer
              </button>
            </div>
          </div>

          {/* 2-Column Hour x Minute Selector */}
          <div className="grid grid-cols-2 divide-x divide-slate-100">
            <div>
              <div className="px-2.5 py-1.5 text-[11px] font-medium text-slate-400 border-b border-slate-100">
                Heure
              </div>
              <div className="max-h-48 overflow-y-auto p-1 grid grid-cols-2 gap-0.5">
                {HOURS.map((h) => {
                  const active = match && selectedHour === h;
                  return (
                    <button
                      key={h}
                      type="button"
                      onClick={() => {
                        const nextTime = `${h}:${match ? selectedMinute : '00'}`;
                        setDraft(nextTime);
                        onChange(nextTime);
                      }}
                      className={`py-1 text-xs font-mono tabular-nums rounded transition-colors ${
                        active
                          ? 'bg-blue-600 text-white font-semibold'
                          : 'text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {h}h
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <div className="px-2.5 py-1.5 text-[11px] font-medium text-slate-400 border-b border-slate-100">
                Minutes
              </div>
              <div className="max-h-48 overflow-y-auto p-1 grid grid-cols-2 gap-0.5">
                {MINUTES.map((m) => {
                  const active = match && selectedMinute === m;
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => {
                        const nextTime = `${selectedHour}:${m}`;
                        commitValue(nextTime, true);
                      }}
                      className={`py-1 text-xs font-mono tabular-nums rounded transition-colors ${
                        active
                          ? 'bg-blue-600 text-white font-semibold'
                          : 'text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      :{m}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};