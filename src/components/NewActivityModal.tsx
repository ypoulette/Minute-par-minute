import React, { useMemo, useState } from 'react';
import { Calendar, Plus, X } from 'lucide-react';
import type { ComputedActivity, EventPlan, HoraireMode } from '../types/planner';
import { getEtapeDisplay } from '../utils/etapeDefaults';
import {
  computeActivityDate,
  diffDaysBetweenDates,
  normalizeTimeInput,
} from '../utils/scheduleEngine';
import { ResourceCreatableSelect } from './ResourceCreatableSelect';
import { ResourceMultiSelect } from './ResourceMultiSelect';
import { TimePickerDropdown } from './TimePickerDropdown';

interface NewActivityModalProps {
  event: EventPlan;
  allActivities: ComputedActivity[];
  defaultStep: number | null;
  defaultEtape: string;
  defaultDependsOnId?: string | null;
  suggestedNextTime?: string;
  onAddResource: (name: string) => Promise<void>;
  onAddEtape: (name: string) => Promise<void>;
  onCreate: (payload: {
    step: number | null;
    etape: string;
    horaireMode: HoraireMode;
    horaireManuel: string;
    dependsOnId: string | null;
    dureeMinutes: number;
    activite: string;
    responsable: string;
    executants: string[];
    needsCorrection: boolean;
    isDone?: boolean;
    texte: string;
  }) => Promise<void>;
  onClose: () => void;
}

export const NewActivityModal: React.FC<NewActivityModalProps> = ({
  event,
  allActivities,
  defaultStep,
  defaultEtape,
  defaultDependsOnId = null,
  suggestedNextTime,
  onAddResource,
  onAddEtape,
  onCreate,
  onClose,
}) => {
  const [stepStr, setStepStr] = useState(defaultStep === null ? '' : String(defaultStep));

  // Date spécifique initiale
  const initialDate =
    defaultStep !== null ? computeActivityDate(event.eventDate, defaultStep) : event.eventDate;
  const [specificDate, setSpecificDate] = useState<string>(
    /^\d{4}-\d{2}-\d{2}$/.test(initialDate) ? initialDate : event.eventDate
  );

  const [etape, setEtape] = useState(defaultEtape || event.etapes[0] || '');
  const [horaireMode, setHoraireMode] = useState<HoraireMode>(
    defaultDependsOnId ? 'dependant' : 'manuel'
  );
  const [dependsOnId, setDependsOnId] = useState<string | null>(defaultDependsOnId);
  const [horaireManuel, setHoraireManuel] = useState(suggestedNextTime || '09:00');
  const [dureeMinutes, setDureeMinutes] = useState('15');
  const [activite, setActivite] = useState('');
  const [responsable, setResponsable] = useState('');
  const [executants, setExecutants] = useState<string[]>([]);
  const [isDone, setIsDone] = useState(false);
  const [needsCorrection, setNeedsCorrection] = useState(false);
  const [texte, setTexte] = useState('');
  const [saving, setSaving] = useState(false);

  const parsedStep = stepStr.trim() === '' ? null : parseInt(stepStr, 10);
  const validStep = parsedStep !== null && !Number.isNaN(parsedStep) ? parsedStep : null;

  // Synchronisation calendrier -> step relatif
  const handleDateChange = (newDate: string) => {
    setSpecificDate(newDate);
    if (!newDate) {
      setStepStr('');
      return;
    }
    const diff = diffDaysBetweenDates(newDate, event.eventDate);
    if (diff !== null) {
      setStepStr(String(diff));
    }
  };

  // Synchronisation step relatif -> calendrier
  const handleStepChange = (val: string) => {
    setStepStr(val);
    const trimmed = val.trim();
    if (trimmed === '') return;
    const parsed = parseInt(trimmed, 10);
    if (!Number.isNaN(parsed)) {
      const computed = computeActivityDate(event.eventDate, parsed);
      if (/^\d{4}-\d{2}-\d{2}$/.test(computed)) {
        setSpecificDate(computed);
      }
    }
  };

  const handlePresetDate = (stepVal: number | null) => {
    if (stepVal === null) {
      setStepStr('');
    } else {
      setStepStr(String(stepVal));
      const computed = computeActivityDate(event.eventDate, stepVal);
      if (/^\d{4}-\d{2}-\d{2}$/.test(computed)) {
        setSpecificDate(computed);
      }
    }
  };

  const previewDateLabel = useMemo(() => {
    if (validStep === null) return 'Statut : À planifier (sans date fixée)';
    const date = computeActivityDate(event.eventDate, validStep);
    if (validStep === 0) return `Jour J : ${date} (jour de l'événement)`;
    if (validStep > 0) return `${date} (+${validStep} j après l'événement)`;
    return `${date} (${Math.abs(validStep)} j avant l'événement)`;
  }, [event.eventDate, validStep]);

  const etapeLabels: Record<string, string> = {};
  for (const et of event.etapes) {
    const d = getEtapeDisplay(et, event.etapeDetails);
    if (d.title) etapeLabels[et] = d.title;
  }

  const sameBlocActivities = allActivities.filter((a) => a.etape === etape);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activite.trim()) return;
    setSaving(true);
    try {
      await onCreate({
        step: validStep,
        etape,
        horaireMode,
        horaireManuel: horaireMode === 'manuel' ? normalizeTimeInput(horaireManuel) : '',
        dependsOnId: horaireMode === 'dependant' ? dependsOnId : null,
        dureeMinutes: Math.max(0, parseInt(dureeMinutes, 10) || 0),
        activite: activite.trim(),
        responsable,
        executants,
        needsCorrection,
        isDone,
        texte,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white border border-slate-200 rounded-xl w-full max-w-2xl overflow-hidden shadow-xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 shrink-0">
          <h2 className="text-base font-semibold text-slate-900">
            {defaultDependsOnId ? 'Nouvelle sous-activité dépendante' : 'Nouvelle activité'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
            aria-label="Fermer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
          {/* Bloc 1: Date spécifique (calendrier) & Step relatif */}
          <div className="bg-slate-50/90 p-3.5 rounded-xl border border-slate-200 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-blue-600" />
                Date de l'activité & Step
              </span>
              <span className="text-[11px] text-slate-500 font-mono">
                Événement : <strong className="text-slate-700">{event.eventDate}</strong> (Jour J)
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Calendrier date spécifique */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Choisir une date spécifique (calendrier)
                </label>
                <input
                  type="date"
                  value={specificDate}
                  onChange={(e) => handleDateChange(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 bg-white"
                />
                <p className="mt-1 text-[11px] text-slate-500">
                  Calcule automatiquement le Step selon l'événement
                </p>
              </div>

              {/* Step relatif */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Step (jours vs événement)
                </label>
                <input
                  type="number"
                  value={stepStr}
                  onChange={(e) => handleStepChange(e.target.value)}
                  placeholder="ex. -1, 0, 1 (ou vide pour À planifier)"
                  className="w-full px-3 py-1.5 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 bg-white"
                />
                <p className="mt-1 text-[11px] font-medium text-blue-700 font-mono">
                  {previewDateLabel}
                </p>
              </div>
            </div>

            {/* Raccourcis rapides */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-200/60 text-[11px]">
              <span className="text-slate-500 mr-1 font-medium">Raccourcis :</span>
              <button
                type="button"
                onClick={() => handlePresetDate(0)}
                className={`px-2 py-0.5 rounded border transition-colors ${
                  validStep === 0
                    ? 'bg-blue-600 text-white border-blue-600 font-medium shadow-sm'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                }`}
              >
                Jour J (0 j)
              </button>
              <button
                type="button"
                onClick={() => handlePresetDate(-1)}
                className={`px-2 py-0.5 rounded border transition-colors ${
                  validStep === -1
                    ? 'bg-blue-600 text-white border-blue-600 font-medium shadow-sm'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                }`}
              >
                Veille (J-1)
              </button>
              <button
                type="button"
                onClick={() => handlePresetDate(1)}
                className={`px-2 py-0.5 rounded border transition-colors ${
                  validStep === 1
                    ? 'bg-blue-600 text-white border-blue-600 font-medium shadow-sm'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                }`}
              >
                Lendemain (J+1)
              </button>
              <button
                type="button"
                onClick={() => handlePresetDate(null)}
                className={`px-2 py-0.5 rounded border transition-colors ${
                  validStep === null
                    ? 'bg-amber-600 text-white border-amber-600 font-medium shadow-sm'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                }`}
              >
                À planifier
              </button>
            </div>
          </div>

          {/* Bloc / Étape critique */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Bloc / Étape critique
            </label>
            <ResourceCreatableSelect
              value={etape}
              options={event.etapes}
              optionLabels={etapeLabels}
              placeholder="Sélectionner ou créer un bloc..."
              onChange={(val) => {
                setEtape(val);
                setDependsOnId(null);
              }}
              onAddOption={onAddEtape}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-start">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Mode d’horaire
              </label>
              <div className="flex items-center p-1 bg-slate-100 rounded-lg">
                <button
                  type="button"
                  onClick={() => setHoraireMode('manuel')}
                  className={`flex-1 px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    horaireMode === 'manuel'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Manuel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setHoraireMode('dependant');
                    if (!dependsOnId && sameBlocActivities.length > 0) {
                      setDependsOnId(sameBlocActivities[sameBlocActivities.length - 1].id);
                    }
                  }}
                  className={`flex-1 px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    horaireMode === 'dependant'
                      ? 'bg-white text-blue-700 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Dépendant
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                {horaireMode === 'dependant' ? 'Dépend de l’activité' : 'Horaire'}
              </label>
              {horaireMode === 'dependant' ? (
                <select
                  value={dependsOnId || ''}
                  onChange={(e) => setDependsOnId(e.target.value || null)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
                >
                  <option value="">(Activité précédente)</option>
                  {sameBlocActivities.map((act) => (
                    <option key={act.id} value={act.id}>
                      #{act.wbsCode} {act.computedHoraire} — {act.activite.slice(0, 42)}
                    </option>
                  ))}
                </select>
              ) : (
                <TimePickerDropdown
                  value={horaireManuel}
                  onChange={setHoraireManuel}
                  suggestedNextTime={suggestedNextTime}
                  placeholder="ex. 16:30 ou AM"
                />
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Durée (minutes)
              </label>
              <input
                type="number"
                min={0}
                max={1440}
                value={dureeMinutes}
                onChange={(e) => setDureeMinutes(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Activité (description courte) *
            </label>
            <input
              type="text"
              required
              value={activite}
              onChange={(e) => setActivite(e.target.value)}
              placeholder="Décrire l'activité..."
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Responsable
              </label>
              <ResourceCreatableSelect
                value={responsable}
                options={event.resources}
                placeholder="Choisir ou ajouter..."
                onChange={setResponsable}
                onAddOption={onAddResource}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Exécutant(s) — choix multiple
              </label>
              <ResourceMultiSelect
                values={executants}
                options={event.resources}
                placeholder="Choisir un ou plusieurs..."
                onChange={setExecutants}
                onAddOption={onAddResource}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Texte complet / Script / Notes détaillées (optionnel)
            </label>
            <textarea
              rows={4}
              value={texte}
              onChange={(e) => setTexte(e.target.value)}
              placeholder="Collez ici un texte d'animation, un protocole détaillé ou des notes..."
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 resize-y"
            />
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-1">
            <label className="inline-flex items-center gap-2 text-xs text-slate-700 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isDone}
                onChange={(e) => setIsDone(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 accent-emerald-600"
              />
              <span>Activité déjà terminée</span>
            </label>

            <label className="inline-flex items-center gap-2 text-xs text-slate-700 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={needsCorrection}
                onChange={(e) => setNeedsCorrection(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500 accent-amber-600"
              />
              <span>Marquer comme nécessitant une correction</span>
            </label>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={saving || !activite.trim()}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              Ajouter l’activité
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};