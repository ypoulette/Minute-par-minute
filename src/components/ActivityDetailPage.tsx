import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Clock,
  Link2,
  MessageSquare,
  Shield,
  Trash2,
} from 'lucide-react';
import type { ActivityItem, ComputedActivity, EventPlan, HoraireMode, TeamRole } from '../types/planner';
import { getEtapeDisplay } from '../utils/etapeDefaults';
import {
  computeActivityDate,
  formatDurationLabel,
  wouldCreateDependencyCycle,
} from '../utils/scheduleEngine';
import { ResourceCreatableSelect } from './ResourceCreatableSelect';
import { ResourceMultiSelect } from './ResourceMultiSelect';
import { TimePickerDropdown } from './TimePickerDropdown';

interface ActivityDetailPageProps {
  event: EventPlan;
  userRole?: TeamRole;
  allActivities: ComputedActivity[];
  activity: ComputedActivity;
  previousActivity: ComputedActivity | null;
  nextActivity: ComputedActivity | null;
  positionIndex: number;
  totalCount: number;
  onBack: () => void;
  onNavigate: (activityId: string) => void;
  onUpdate: (activityId: string, updates: Partial<ActivityItem>) => Promise<void>;
  onDelete: (activityId: string) => Promise<void>;
  onAddResource: (name: string) => Promise<void>;
  onAddEtape: (name: string) => Promise<void>;
}

export const ActivityDetailPage: React.FC<ActivityDetailPageProps> = ({
  event,
  userRole = 'editeur',
  allActivities,
  activity,
  previousActivity,
  nextActivity,
  positionIndex,
  totalCount,
  onBack,
  onNavigate,
  onUpdate,
  onDelete,
  onAddResource,
  onAddEtape,
}) => {
  const canEditCore = userRole === 'admin' || userRole === 'editeur';
  const canEditComments = userRole === 'admin' || userRole === 'editeur' || userRole === 'reviseur';
  const canToggleCorrection = userRole === 'admin' || userRole === 'editeur' || userRole === 'reviseur';
  const canDelete = userRole === 'admin' || userRole === 'editeur';

  const [activite, setActivite] = useState(activity.activite);
  const [texte, setTexte] = useState(activity.texte);
  const [commentaires, setCommentaires] = useState(activity.commentaires || '');
  const [stepStr, setStepStr] = useState(activity.step === null ? '' : String(activity.step));
  const [dureeStr, setDureeStr] = useState(String(activity.dureeMinutes));
  const [savingField, setSavingField] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    setActivite(activity.activite);
    setTexte(activity.texte);
    setCommentaires(activity.commentaires || '');
    setStepStr(activity.step === null ? '' : String(activity.step));
    setDureeStr(String(activity.dureeMinutes));
    setConfirmDelete(false);
  }, [
    activity.id,
    activity.activite,
    activity.texte,
    activity.commentaires,
    activity.step,
    activity.dureeMinutes,
  ]);

  const commitUpdate = async (updates: Partial<ActivityItem>) => {
    setSavingField(true);
    try {
      await onUpdate(activity.id, updates);
      setSavedNotice(true);
      setTimeout(() => setSavedNotice(false), 1600);
    } finally {
      setSavingField(false);
    }
  };

  const handleSaveTextAndTitle = async () => {
    if (!canEditCore) return;
    const trimmedAct = activite.trim() || activity.activite;
    if (trimmedAct !== activity.activite || texte !== activity.texte) {
      await commitUpdate({ activite: trimmedAct, texte });
    }
  };

  const handleSaveComments = async () => {
    const trimmed = commentaires.trim();
    if (trimmed !== (activity.commentaires || '').trim()) {
      await commitUpdate({ commentaires: trimmed });
    }
  };

  const handleStepBlur = async () => {
    const trimmed = stepStr.trim();
    const parsed = trimmed === '' ? null : parseInt(trimmed, 10);
    const clean = parsed !== null && !Number.isNaN(parsed) ? parsed : null;
    if (clean !== activity.step) {
      await commitUpdate({ step: clean });
    }
  };

  const handleDureeCommit = async (nextVal?: number) => {
    const num = nextVal !== undefined ? nextVal : Math.max(0, parseInt(dureeStr, 10) || 0);
    setDureeStr(String(num));
    if (num !== activity.dureeMinutes) {
      await commitUpdate({ dureeMinutes: num });
    }
  };

  const handleModeChange = async (mode: HoraireMode) => {
    if (mode === activity.horaireMode) return;
    if (mode === 'dependant') {
      const candidateParent =
        sameBlocPrev?.id ||
        validPredecessors[validPredecessors.length - 1]?.id ||
        null;
      await commitUpdate({
        horaireMode: 'dependant',
        dependsOnId: activity.dependsOnId || candidateParent,
      });
    } else {
      await commitUpdate({
        horaireMode: 'manuel',
        dependsOnId: null,
        horaireManuel:
          activity.horaireManuel ||
          (activity.computedHoraire !== '—' ? activity.computedHoraire : ''),
      });
    }
  };

  const previewDate = computeActivityDate(
    event.eventDate,
    stepStr.trim() === '' ? null : parseInt(stepStr, 10)
  );

  const etapeLabels: Record<string, string> = {};
  for (const et of event.etapes) {
    const d = getEtapeDisplay(et, event.etapeDetails);
    if (d.title) etapeLabels[et] = d.title;
  }

  const activeBlocInfo = activity.etape
    ? getEtapeDisplay(activity.etape, event.etapeDetails)
    : null;

  const sameBlocPrev =
    previousActivity && previousActivity.etape === activity.etape
      ? previousActivity
      : null;

  const validPredecessors = allActivities.filter(
    (candidate) =>
      candidate.etape === activity.etape &&
      candidate.id !== activity.id &&
      !wouldCreateDependencyCycle(allActivities, activity.id, candidate.id)
  );

  const currentParent = activity.parentId
    ? allActivities.find((a) => a.id === activity.parentId) || null
    : null;

  const suggestedNextTime =
    sameBlocPrev?.computedEndHoraire ||
    (sameBlocPrev?.computedHoraire && sameBlocPrev.computedHoraire !== '—'
      ? sameBlocPrev.computedHoraire
      : undefined);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Top breadcrumb & navigation bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Retour à la liste simple
          </button>

          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="font-mono tabular-nums">
              #{activity.wbsCode} · {positionIndex + 1} / {totalCount}
            </span>
            {activity.etape && (
              <>
                <span aria-hidden="true">·</span>
                <span className="text-slate-700 font-medium">
                  {activity.etape}
                  {activeBlocInfo?.title ? ` — ${activeBlocInfo.title}` : ''}
                </span>
              </>
            )}
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">{activity.computedDate}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {savedNotice && (
            <span className="flex items-center gap-1 text-xs text-emerald-700 font-medium mr-2">
              <Check className="w-3.5 h-3.5" />
              Enregistré
            </span>
          )}
          {savingField && (
            <span className="text-xs text-slate-400 mr-2">Synchronisation...</span>
          )}

          <button
            type="button"
            disabled={!previousActivity}
            onClick={() => previousActivity && onNavigate(previousActivity.id)}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Précédente
          </button>
          <button
            type="button"
            disabled={!nextActivity}
            onClick={() => nextActivity && onNavigate(nextActivity.id)}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40"
          >
            Suivante
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Banner for reviewer role */}
      {userRole === 'reviseur' && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-3 text-xs text-emerald-950 shadow-sm">
          <Shield className="w-5 h-5 text-emerald-700 shrink-0" />
          <div>
            <span className="font-bold">Espace de révision actif :</span> en tant que réviseur, vous pouvez formuler vos remarques et demandes d'ajouts dans la boîte ci-dessous et cocher <span className="font-semibold">« Correction nécessaire »</span>. Les horaires, étapes et ressources sont protégés en lecture seule.
          </div>
        </div>
      )}

      {/* Main 2-column content */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left: Primary Description, Complete Long Text & Sub-activities */}
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <Clock className="w-4 h-4 text-blue-600" />
                <span className="font-mono text-lg font-semibold text-slate-900 tabular-nums">
                  {activity.computedHoraire}
                </span>
                {activity.computedEndHoraire && (
                  <span className="font-mono text-sm text-slate-500 tabular-nums">
                    → {activity.computedEndHoraire} ({formatDurationLabel(activity.dureeMinutes)})
                  </span>
                )}
              </div>

              <span className="text-xs text-slate-500">
                {activity.horaireMode === 'dependant'
                  ? `Dépendant${currentParent ? ` de #${currentParent.wbsCode}` : ''}`
                  : 'Horaire défini manuellement'}
              </span>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">
                Description de l’activité {!canEditCore && <span className="text-slate-400 font-normal">(lecture seule)</span>}
              </label>
              <textarea
                rows={2}
                disabled={!canEditCore}
                value={activite}
                onChange={(e) => setActivite(e.target.value)}
                onBlur={handleSaveTextAndTitle}
                className={`w-full px-3.5 py-2.5 text-base font-medium rounded-lg focus:outline-none resize-y ${
                  canEditCore
                    ? 'text-slate-900 bg-slate-50/60 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-blue-600'
                    : 'text-slate-700 bg-slate-50 border border-slate-200 cursor-default'
                }`}
              />
            </div>

            {/* Zone Commentaires des réviseurs & modifications demandées */}
            <div className="p-4 bg-emerald-50/60 border-2 border-emerald-200 rounded-xl space-y-2.5 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-emerald-700" />
                  <label className="text-xs font-bold text-emerald-950 uppercase tracking-wider">
                    Commentaires & modifications demandées par les réviseurs
                  </label>
                </div>
                {userRole === 'reviseur' && (
                  <span className="text-[11px] font-semibold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-300">
                    Votre rôle : Réviseur
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-600">
                Ce champ est réservé aux réviseurs pour consigner les demandes d'ajouts, ajustements d'horaire, matériel à prévoir ou corrections à appliquer par l'éditeur.
              </p>
              <textarea
                rows={3}
                disabled={!canEditComments}
                value={commentaires}
                onChange={(e) => setCommentaires(e.target.value)}
                onBlur={handleSaveComments}
                placeholder={
                  canEditComments
                    ? "Ex : Déplacer à 17h00, ajouter un micro sans-fil, changer l'exécutant pour Luc, valider avec la sécurité..."
                    : "Aucun commentaire pour le moment."
                }
                className={`w-full px-3.5 py-2.5 text-sm text-slate-900 rounded-lg focus:outline-none resize-y ${
                  canEditComments
                    ? 'bg-white border border-emerald-300 focus:ring-2 focus:ring-emerald-600'
                    : 'bg-emerald-50/50 border border-emerald-200 cursor-default'
                }`}
              />
              {canEditComments && (
                <div className="flex items-center justify-between pt-1">
                  <span className="text-[11px] text-slate-400">
                    Enregistré automatiquement à la sortie du champ
                  </span>
                  <button
                    type="button"
                    onClick={handleSaveComments}
                    disabled={savingField}
                    className="px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-md shadow-sm disabled:opacity-50"
                  >
                    Enregistrer le commentaire
                  </button>
                </div>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-medium text-slate-600">
                  Texte complet (script d’animation, protocole, consignes détaillées) {!canEditCore && <span className="text-slate-400 font-normal">(lecture seule)</span>}
                </label>
                <span className="text-xs text-slate-400 font-mono tabular-nums">
                  {texte.length.toLocaleString('fr-CA')} / 50 000 car.
                </span>
              </div>
              <textarea
                rows={14}
                disabled={!canEditCore}
                value={texte}
                onChange={(e) => setTexte(e.target.value)}
                onBlur={handleSaveTextAndTitle}
                placeholder={
                  canEditCore
                    ? "Saisissez ou collez ici le texte complet associé à cette activité (discours, texte d'animation, liste de matériel, notes d'équipe)..."
                    : "Aucun texte saisi."
                }
                className={`w-full px-4 py-3 text-sm leading-relaxed rounded-lg focus:outline-none resize-y min-h-[260px] ${
                  canEditCore
                    ? 'text-slate-800 bg-white border border-slate-200 focus:ring-2 focus:ring-blue-600'
                    : 'text-slate-700 bg-slate-50 border border-slate-200 cursor-default'
                }`}
              />
              {canEditCore && (
                <div className="mt-2 flex items-center justify-between">
                  <p className="text-xs text-slate-400">
                    Les modifications sont enregistrées automatiquement pour toute l’équipe.
                  </p>
                  <button
                    type="button"
                    onClick={handleSaveTextAndTitle}
                    disabled={savingField}
                    className="px-4 py-2 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    Enregistrer le texte
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right: Scheduling & Resources Sidebar */}
        <div className="lg:col-span-4 space-y-5">
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-5">
            <h3 className="text-sm font-semibold text-slate-900 pb-3 border-b border-slate-100 flex items-center justify-between">
              <span>Paramètres & ressources</span>
              {!canEditCore && (
                <span className="text-xs font-normal text-slate-400">Protégé</span>
              )}
            </h3>

            {/* Step & Date */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Step (jours)
                </label>
                <input
                  type="number"
                  disabled={!canEditCore}
                  value={stepStr}
                  onChange={(e) => setStepStr(e.target.value)}
                  onBlur={handleStepBlur}
                  placeholder="—"
                  className={`w-full px-3 py-2 text-sm font-mono border rounded-lg focus:outline-none ${
                    canEditCore
                      ? 'border-slate-200 focus:ring-2 focus:ring-blue-600 bg-white'
                      : 'border-slate-200 bg-slate-50 text-slate-600 cursor-default'
                  }`}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Date calculée
                </label>
                <div className="px-3 py-2 text-sm font-mono bg-slate-50 border border-slate-200 rounded-lg text-slate-700 tabular-nums">
                  {previewDate}
                </div>
              </div>
            </div>

            {/* Bloc / Étape critique */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Bloc / Étape critique
              </label>
              <ResourceCreatableSelect
                disabled={!canEditCore}
                value={activity.etape}
                options={event.etapes}
                optionLabels={etapeLabels}
                placeholder="Sélectionner un bloc..."
                onChange={(val) => commitUpdate({ etape: val, dependsOnId: null })}
                onAddOption={onAddEtape}
              />
            </div>

            {/* Horaire Mode */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">
                Calcul de l’horaire
              </label>
              <div className="flex items-center p-1 bg-slate-100 rounded-lg">
                <button
                  type="button"
                  disabled={!canEditCore}
                  onClick={() => handleModeChange('manuel')}
                  className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    activity.horaireMode === 'manuel'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  } ${!canEditCore ? 'cursor-default' : ''}`}
                >
                  Manuel
                </button>
                <button
                  type="button"
                  disabled={!canEditCore}
                  onClick={() => handleModeChange('dependant')}
                  className={`flex-1 flex items-center justify-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    activity.horaireMode === 'dependant'
                      ? 'bg-white text-blue-700 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  } ${!canEditCore ? 'cursor-default' : ''}`}
                >
                  <Link2 className="w-3.5 h-3.5" />
                  Dépendant
                </button>
              </div>
            </div>

            {/* Horaire value or Parent Activity selector */}
            {activity.horaireMode === 'manuel' ? (
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Heure manuelle
                </label>
                {canEditCore ? (
                  <TimePickerDropdown
                    value={activity.horaireManuel}
                    suggestedNextTime={suggestedNextTime}
                    onChange={(nextVal) => commitUpdate({ horaireManuel: nextVal })}
                  />
                ) : (
                  <div className="px-3 py-2 text-sm font-mono bg-slate-50 border border-slate-200 rounded-lg text-slate-700">
                    {activity.horaireManuel || '—'}
                  </div>
                )}
              </div>
            ) : (
              <div className="p-3 bg-blue-50/60 border border-blue-100 rounded-lg space-y-2">
                <label className="block text-xs font-medium text-blue-900">
                  Activité parente (prédécesseur)
                </label>
                <select
                  disabled={!canEditCore}
                  value={activity.parentId || ''}
                  onChange={(e) =>
                    commitUpdate({ dependsOnId: e.target.value || null })
                  }
                  className={`w-full px-2.5 py-1.5 text-xs border border-blue-200 rounded-md focus:outline-none ${
                    canEditCore
                      ? 'bg-white text-slate-900 focus:ring-2 focus:ring-blue-600'
                      : 'bg-blue-50 text-slate-700 cursor-default'
                  }`}
                >
                  <option value="">(Activité précédente dans le bloc)</option>
                  {validPredecessors.map((pred) => (
                    <option key={pred.id} value={pred.id}>
                      #{pred.wbsCode} · {pred.computedHoraire} — {pred.activite.slice(0, 42)}
                    </option>
                  ))}
                </select>
                {currentParent && (
                  <p className="text-xs text-blue-800 leading-relaxed">
                    Suit la fin de « {currentParent.activite.slice(0, 50)}
                    {currentParent.activite.length > 50 ? '…' : ''} » (
                    <span className="font-mono">
                      {currentParent.computedHoraire} + {currentParent.dureeMinutes} min
                    </span>
                    )
                  </p>
                )}
              </div>
            )}

            {/* Durée */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Durée prévue (minutes)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  disabled={!canEditCore}
                  min={0}
                  max={1440}
                  value={dureeStr}
                  onChange={(e) => setDureeStr(e.target.value)}
                  onBlur={() => handleDureeCommit()}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') e.currentTarget.blur();
                  }}
                  className={`w-24 px-3 py-2 text-sm font-mono border rounded-lg focus:outline-none ${
                    canEditCore
                      ? 'border-slate-200 focus:ring-2 focus:ring-blue-600 bg-white'
                      : 'border-slate-200 bg-slate-50 text-slate-600 cursor-default'
                  }`}
                />
                {canEditCore && (
                  <div className="flex flex-wrap gap-1">
                    {[5, 10, 15, 30, 60].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => handleDureeCommit(preset)}
                        className={`px-2 py-1 text-xs font-mono rounded border transition-colors ${
                          activity.dureeMinutes === preset
                            ? 'bg-slate-900 text-white border-slate-900'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        {preset}m
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Responsable & Exécutants (Multi) */}
            <div className="space-y-3 pt-2 border-t border-slate-100">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Responsable
                </label>
                <ResourceCreatableSelect
                  disabled={!canEditCore}
                  value={activity.responsable}
                  options={event.resources}
                  placeholder="Choisir ou ajouter..."
                  onChange={(val) => commitUpdate({ responsable: val })}
                  onAddOption={onAddResource}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Exécutant(s) — choix multiple
                </label>
                <ResourceMultiSelect
                  disabled={!canEditCore}
                  values={activity.resolvedExecutants}
                  options={event.resources}
                  placeholder="Choisir un ou plusieurs..."
                  onChange={(vals) => commitUpdate({ executants: vals })}
                  onAddOption={onAddResource}
                />
              </div>
            </div>

            {/* Correction nécessaire */}
            <div className="pt-3 border-t border-slate-100">
              <label className="flex items-start gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  disabled={!canToggleCorrection}
                  checked={Boolean(activity.needsCorrection)}
                  onChange={(e) =>
                    commitUpdate({ needsCorrection: e.target.checked })
                  }
                  className="mt-0.5 w-4 h-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500 cursor-pointer accent-amber-600 shrink-0"
                />
                <span className="text-xs leading-snug">
                  <span
                    className={`block font-medium ${
                      activity.needsCorrection ? 'text-amber-800' : 'text-slate-800'
                    }`}
                  >
                    Correction nécessaire
                  </span>
                  <span className="text-slate-500">
                    Signaler cette activité pour révision dans les filtres
                  </span>
                </span>
              </label>
            </div>

            {/* Delete */}
            {canDelete && (
              <div className="pt-3 border-t border-slate-100">
                {!confirmDelete ? (
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(true)}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-red-600 bg-white border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Supprimer cette activité
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onDelete(activity.id)}
                      className="flex-1 px-3 py-2 text-xs font-medium text-white bg-red-600 rounded-lg hover:bg-red-700"
                    >
                      Confirmer la suppression
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(false)}
                      className="px-3 py-2 text-xs font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200"
                    >
                      Annuler
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};