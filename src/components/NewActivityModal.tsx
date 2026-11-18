import React, { useState } from 'react';
import { Plus, X } from 'lucide-react';
import type { ComputedActivity, EventPlan, HoraireMode } from '../types/planner';
import { getEtapeDisplay } from '../utils/etapeDefaults';
import { computeActivityDate, normalizeTimeInput } from '../utils/scheduleEngine';
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
  const [needsCorrection, setNeedsCorrection] = useState(false);
  const [texte, setTexte] = useState('');
  const [saving, setSaving] = useState(false);

  const parsedStep = stepStr.trim() === '' ? null : parseInt(stepStr, 10);
  const validStep = parsedStep !== null && !Number.isNaN(parsedStep) ? parsedStep : null;
  const previewDate = computeActivityDate(event.eventDate, validStep);

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
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Step (jours vs événement)
              </label>
              <input
                type="number"
                value={stepStr}
                onChange={(e) => setStepStr(e.target.value)}
                placeholder="ex. -1, 0, 1"
                className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
              <p className="mt-1 text-xs text-slate-500 font-mono">Date : {previewDate}</p>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Bloc / Étape critique
              </label>
              <ResourceCreatableSelect
                value={etape}
                options={event.etapes}
                optionLabels={etapeLabels}
                placeholder="Choisir ou ajouter un bloc..."
                onChange={(val) => {
                  setEtape(val);
                  setDependsOnId(null);
                }}
                onAddOption={onAddEtape}
              />
            </div>
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

          <label className="inline-flex items-center gap-2 text-xs text-slate-700 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={needsCorrection}
              onChange={(e) => setNeedsCorrection(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500 accent-amber-600"
            />
            <span>Marquer comme nécessitant une correction</span>
          </label>

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