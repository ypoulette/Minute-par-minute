import React, { useMemo, useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronRight,
  CornerDownRight,
  ExternalLink,
  FileText,
  Link2,
  Pencil,
} from 'lucide-react';
import type { ActivityItem, ComputedActivity, EventPlan, TeamRole } from '../types/planner';
import { getEtapeDisplay } from '../utils/etapeDefaults';
import { groupActivitiesByBloc } from '../utils/scheduleEngine';

interface CompactFullTextViewProps {
  event: EventPlan;
  userRole?: TeamRole;
  allActivities: ComputedActivity[];
  visibleActivities: ComputedActivity[];
  allActivitiesCount: number;
  viewMode: 'bloc' | 'chronologique';
  hasActiveFilters: boolean;
  onOpenDetail: (activityId: string) => void;
  onUpdateActivity: (activityId: string, updates: Partial<ActivityItem>) => Promise<void>;
}

export const CompactFullTextView: React.FC<CompactFullTextViewProps> = ({
  event,
  userRole = 'editeur',
  allActivities,
  visibleActivities,
  allActivitiesCount,
  viewMode,
  hasActiveFilters,
  onOpenDetail,
  onUpdateActivity,
}) => {
  const canEditCore = userRole === 'admin' || userRole === 'editeur';
  const canEditComments = userRole === 'admin' || userRole === 'editeur' || userRole === 'reviseur';
  const canToggleCorrection = userRole === 'admin' || userRole === 'editeur' || userRole === 'reviseur';

  const [onlyWithText, setOnlyWithText] = useState(false);
  const [collapsedBlocs, setCollapsedBlocs] = useState<Record<string, boolean>>({});

  const parentById = useMemo(
    () => new Map(allActivities.map((a) => [a.id, a])),
    [allActivities]
  );

  const displayedActivities = useMemo(() => {
    if (!onlyWithText) return visibleActivities;
    return visibleActivities.filter((a) => a.texte.trim().length > 0);
  }, [visibleActivities, onlyWithText]);

  const withTextCount = useMemo(
    () => visibleActivities.filter((a) => a.texte.trim().length > 0).length,
    [visibleActivities]
  );

  const etapeLabels = useMemo(() => {
    const map: Record<string, string> = {};
    for (const et of event.etapes) {
      const d = getEtapeDisplay(et, event.etapeDetails);
      map[et] = d.title ? `${et} — ${d.title}` : et;
    }
    return map;
  }, [event.etapes, event.etapeDetails]);

  if (allActivitiesCount === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-sm text-slate-500">
        Aucune activité planifiée pour cet événement.
      </div>
    );
  }

  if (displayedActivities.length === 0) {
    return (
      <div className="space-y-3">
        <ViewSubHeader
          onlyWithText={onlyWithText}
          onToggleOnlyWithText={setOnlyWithText}
          totalVisible={visibleActivities.length}
          withTextCount={withTextCount}
        />
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center text-sm text-slate-500">
          {onlyWithText
            ? 'Aucune activité parmi les résultats actuels ne contient de texte détaillé.'
            : 'Aucune activité ne correspond aux filtres actuels.'}
        </div>
      </div>
    );
  }

  const toggleCollapse = (key: string) => {
    setCollapsedBlocs((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  if (viewMode === 'chronologique') {
    const flatSorted = [...displayedActivities].sort((a, b) => {
      const sa = a.step ?? 99999;
      const sb = b.step ?? 99999;
      if (sa !== sb) return sa - sb;
      if (a.sortMinutes !== b.sortMinutes) return a.sortMinutes - b.sortMinutes;
      return a.orderIndex - b.orderIndex;
    });

    return (
      <div className="space-y-3">
        <ViewSubHeader
          onlyWithText={onlyWithText}
          onToggleOnlyWithText={setOnlyWithText}
          totalVisible={visibleActivities.length}
          withTextCount={withTextCount}
        />

        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1080px] table-fixed border-collapse text-left">
              <colgroup>
                <col className="w-[34px]" />
                <col className="w-[44px]" />
                <col className="w-[42px]" />
                <col className="w-[96px]" />
                <col className="w-[82px]" />
                <col className="w-[56px]" />
                <col className="w-[44px]" />
                <col className="w-[170px]" />
                <col className="w-[88px]" />
                <col className="w-[98px]" />
                <col />
              </colgroup>
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-medium text-slate-600">
                  <th className="py-2 px-1 text-center" title="Correction nécessaire">
                    Corr.
                  </th>
                  <th className="py-2 px-1 text-center">#</th>
                  <th className="py-2 px-1 text-center">Step</th>
                  <th className="py-2 px-1.5">Bloc</th>
                  <th className="py-2 px-1.5">Date</th>
                  <th className="py-2 px-1.5">Heure</th>
                  <th className="py-2 px-1 text-right">Dur.</th>
                  <th className="py-2 px-2">Activité</th>
                  <th className="py-2 px-1.5">Resp.</th>
                  <th className="py-2 px-1.5">Exéc.</th>
                  <th className="py-2 px-3 bg-blue-50/40 text-slate-800">
                    Texte complet
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {flatSorted.map((act, idx) => {
                  const prevAct = idx > 0 ? flatSorted[idx - 1] : null;
                  const isNewDay = Boolean(
                    prevAct && prevAct.computedDate !== act.computedDate
                  );
                  const parentAct = act.parentId
                    ? parentById.get(act.parentId) || null
                    : null;

                  return (
                    <CompactRow
                      key={act.id}
                      activity={act}
                      parentActivity={parentAct}
                      canEditCore={canEditCore}
                      canToggleCorrection={canToggleCorrection}
                      showBlocColumn
                      blocLabel={etapeLabels[act.etape] || act.etape}
                      isNewDay={isNewDay}
                      onOpenDetail={() => onOpenDetail(act.id)}
                      onToggleCorrection={(checked) =>
                        onUpdateActivity(act.id, { needsCorrection: checked })
                      }
                      onSaveText={(nextText) =>
                        onUpdateActivity(act.id, { texte: nextText })
                      }
                    />
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  const blocGroups = groupActivitiesByBloc(
    displayedActivities,
    event.etapes,
    event.etapeDetails,
    !hasActiveFilters && !onlyWithText
  );

  return (
    <div className="space-y-4">
      <ViewSubHeader
        onlyWithText={onlyWithText}
        onToggleOnlyWithText={setOnlyWithText}
        totalVisible={visibleActivities.length}
        withTextCount={withTextCount}
      />

      {blocGroups.map((group) => {
        const isCollapsed = Boolean(collapsedBlocs[group.etapeKey]);

        return (
          <section
            key={group.etapeKey || '__uncategorized__'}
            className="bg-white border border-slate-200 rounded-xl overflow-hidden"
          >
            <div className="px-4 py-2.5 bg-slate-50/70 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <button
                  type="button"
                  onClick={() => toggleCollapse(group.etapeKey)}
                  aria-label={isCollapsed ? 'Déplier le bloc' : 'Replier le bloc'}
                  className="p-1 text-slate-500 hover:text-slate-900 rounded hover:bg-slate-200/60 shrink-0"
                >
                  {isCollapsed ? (
                    <ChevronRight className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </button>
                {group.etapeKey && (
                  <span className="font-mono text-xs font-semibold text-blue-700 shrink-0">
                    {group.etapeKey}
                  </span>
                )}
                <h2 className="font-display text-sm font-bold text-slate-900 truncate">
                  {group.title || (group.etapeKey ? 'Bloc' : 'Sans bloc')}
                </h2>
                {group.description && (
                  <>
                    <span className="text-slate-300 hidden md:inline" aria-hidden="true">
                      ·
                    </span>
                    <span className="text-xs text-slate-500 truncate hidden md:inline max-w-xl">
                      {group.description}
                    </span>
                  </>
                )}
              </div>

              <div className="flex items-center gap-2 text-xs text-slate-500 font-mono tabular-nums shrink-0">
                {group.timeRangeLabel && (
                  <>
                    <span>{group.timeRangeLabel}</span>
                    <span aria-hidden="true">·</span>
                  </>
                )}
                <span>
                  {group.activities.length}{' '}
                  {group.activities.length > 1 ? 'activités' : 'activité'}
                </span>
              </div>
            </div>

            {!isCollapsed && (
              <div className="overflow-x-auto border-t border-slate-200">
                {group.activities.length === 0 ? (
                  <div className="px-4 py-4 text-xs text-slate-400">
                    Aucune activité dans ce bloc.
                  </div>
                ) : (
                  <table className="w-full min-w-[1000px] table-fixed border-collapse text-left">
                    <colgroup>
                      <col className="w-[34px]" />
                      <col className="w-[44px]" />
                      <col className="w-[42px]" />
                      <col className="w-[82px]" />
                      <col className="w-[56px]" />
                      <col className="w-[44px]" />
                      <col className="w-[175px]" />
                      <col className="w-[90px]" />
                      <col className="w-[100px]" />
                      <col />
                    </colgroup>
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50/50 text-[11px] font-medium text-slate-600">
                        <th className="py-1.5 px-1 text-center" title="Correction nécessaire">
                          Corr.
                        </th>
                        <th className="py-1.5 px-1 text-center">#</th>
                        <th className="py-1.5 px-1 text-center">Step</th>
                        <th className="py-1.5 px-1.5">Date</th>
                        <th className="py-1.5 px-1.5">Heure</th>
                        <th className="py-1.5 px-1 text-right">Dur.</th>
                        <th className="py-1.5 px-2">Activité</th>
                        <th className="py-1.5 px-1.5">Resp.</th>
                        <th className="py-1.5 px-1.5">Exéc.</th>
                        <th className="py-1.5 px-3 bg-blue-50/40 text-slate-800">
                          Texte complet
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {group.activities.map((act, idx) => {
                        const prevAct = idx > 0 ? group.activities[idx - 1] : null;
                        const isNewDay = Boolean(
                          prevAct && prevAct.computedDate !== act.computedDate
                        );
                        const parentAct = act.parentId
                          ? parentById.get(act.parentId) || null
                          : null;

                        return (
                          <CompactRow
                            key={act.id}
                            activity={act}
                            parentActivity={parentAct}
                            canEditCore={canEditCore}
                            canToggleCorrection={canToggleCorrection}
                            showBlocColumn={false}
                            blocLabel=""
                            isNewDay={isNewDay}
                            onOpenDetail={() => onOpenDetail(act.id)}
                            onToggleCorrection={(checked) =>
                              onUpdateActivity(act.id, { needsCorrection: checked })
                            }
                            onSaveText={(nextText) =>
                              onUpdateActivity(act.id, { texte: nextText })
                            }
                          />
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
};

interface ViewSubHeaderProps {
  onlyWithText: boolean;
  onToggleOnlyWithText: (next: boolean) => void;
  totalVisible: number;
  withTextCount: number;
}

const ViewSubHeader: React.FC<ViewSubHeaderProps> = ({
  onlyWithText,
  onToggleOnlyWithText,
  totalVisible,
  withTextCount,
}) => {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-1">
      <div className="flex items-center gap-2 text-xs text-slate-600">
        <FileText className="w-3.5 h-3.5 text-blue-600 shrink-0" />
        <span>
          Vue condensée avec colonne{' '}
          <strong className="font-semibold text-slate-900">Texte complet</strong>{' '}
          (cliquez sur un texte pour le modifier sur place)
        </span>
      </div>

      <div className="flex items-center gap-1 p-0.5 bg-slate-200/70 rounded-lg">
        <button
          type="button"
          onClick={() => onToggleOnlyWithText(false)}
          className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
            !onlyWithText
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Toutes ({totalVisible})
        </button>
        <button
          type="button"
          onClick={() => onToggleOnlyWithText(true)}
          className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
            onlyWithText
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Avec texte ({withTextCount})
        </button>
      </div>
    </div>
  );
};

interface CompactRowProps {
  activity: ComputedActivity;
  parentActivity: ComputedActivity | null;
  canEditCore?: boolean;
  canToggleCorrection?: boolean;
  showBlocColumn: boolean;
  blocLabel: string;
  isNewDay: boolean;
  onOpenDetail: () => void;
  onToggleCorrection: (checked: boolean) => Promise<void>;
  onSaveText: (nextText: string) => Promise<void>;
}

const CompactRow: React.FC<CompactRowProps> = ({
  activity,
  parentActivity,
  canEditCore = true,
  canToggleCorrection = true,
  showBlocColumn,
  blocLabel,
  isNewDay,
  onOpenDetail,
  onToggleCorrection,
  onSaveText,
}) => {
  const [editingText, setEditingText] = useState(false);
  const [textDraft, setTextDraft] = useState(activity.texte);
  const [saving, setSaving] = useState(false);

  const isChild = activity.dependencyDepth > 0;
  const executantsText = activity.resolvedExecutants.join(', ');

  const startEditing = () => {
    if (!canEditCore) {
      onOpenDetail();
      return;
    }
    setTextDraft(activity.texte);
    setEditingText(true);
  };

  const commitText = async () => {
    setEditingText(false);
    if (textDraft !== activity.texte) {
      setSaving(true);
      try {
        await onSaveText(textDraft);
      } finally {
        setSaving(false);
      }
    }
  };

  return (
    <tr
      className={`group align-top transition-colors ${
        activity.needsCorrection
          ? 'bg-amber-50/55 hover:bg-amber-50/80'
          : isChild
          ? 'bg-slate-50/40 hover:bg-blue-50/25'
          : 'hover:bg-slate-50/80'
      } ${isNewDay ? 'border-t-2 border-t-slate-200' : ''}`}
    >
      {/* Correction nécessaire */}
      <td className="py-2 px-1 text-center">
        <input
          type="checkbox"
          disabled={!canToggleCorrection}
          checked={Boolean(activity.needsCorrection)}
          onChange={(e) => onToggleCorrection(e.target.checked)}
          aria-label="Correction nécessaire"
          title={
            canToggleCorrection
              ? 'Cocher si une correction est nécessaire'
              : 'Correction signalée'
          }
          className={`w-3.5 h-3.5 rounded border-slate-300 text-amber-600 focus:ring-amber-500 accent-amber-600 align-middle ${
            canToggleCorrection ? 'cursor-pointer' : 'cursor-default opacity-60'
          }`}
        />
      </td>
      {/* # WBS */}
      <td className="py-2 px-1 text-center font-mono text-[11px] tabular-nums text-slate-500 truncate">
        <span className={isChild ? 'text-blue-700 font-medium' : ''}>
          {activity.wbsCode}
        </span>
      </td>

      {/* Step */}
      <td className="py-2 px-1 text-center font-mono text-[11px] tabular-nums text-slate-600 truncate">
        {activity.step === null ? '—' : activity.step}
      </td>

      {/* Optional Bloc */}
      {showBlocColumn && (
        <td
          className="py-2 px-1.5 text-[11px] text-slate-600 truncate"
          title={blocLabel}
        >
          {blocLabel || '—'}
        </td>
      )}

      {/* Date */}
      <td className="py-2 px-1.5 font-mono text-[11px] tabular-nums text-slate-500 whitespace-nowrap truncate">
        {activity.computedDate}
      </td>

      {/* Heure */}
      <td
        className="py-2 px-1.5 font-mono text-[11px] tabular-nums whitespace-nowrap truncate"
        title={
          activity.horaireMode === 'dependant' && parentActivity
            ? `Dépendant de #${parentActivity.wbsCode}`
            : undefined
        }
      >
        <span
          className={`inline-flex items-center gap-0.5 ${
            activity.horaireMode === 'dependant'
              ? 'text-blue-700 font-medium'
              : 'text-slate-800'
          }`}
        >
          {activity.horaireMode === 'dependant' && (
            <Link2 className="w-2.5 h-2.5 shrink-0" />
          )}
          <span>{activity.computedHoraire}</span>
        </span>
      </td>

      {/* Durée */}
      <td className="py-2 px-1 text-right font-mono text-[11px] tabular-nums text-slate-500 whitespace-nowrap">
        {activity.dureeMinutes}m
      </td>

      {/* Activité (compressed) */}
      <td className="py-2 px-2">
        <div
          className="flex items-start gap-1 min-w-0"
          style={
            isChild
              ? { paddingLeft: `${Math.min(activity.dependencyDepth, 3) * 8}px` }
              : undefined
          }
        >
          {isChild && (
            <CornerDownRight
              className="w-3 h-3 text-blue-500 shrink-0 mt-0.5"
              aria-hidden="true"
            />
          )}
          <button
            type="button"
            onClick={onOpenDetail}
            title={`${activity.activite} — Ouvrir la fiche`}
            className="text-left text-xs font-medium text-slate-900 hover:text-blue-700 hover:underline leading-snug line-clamp-2 min-w-0"
          >
            {activity.activite}
          </button>
        </div>

        {activity.commentaires && (
          <div
            onClick={onOpenDetail}
            title={`Commentaire réviseur : ${activity.commentaires}`}
            className="mt-1 text-[11px] text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 truncate cursor-pointer hover:bg-emerald-100/80 transition-colors"
          >
            <span className="font-semibold mr-1">Rév:</span>
            {activity.commentaires}
          </div>
        )}
      </td>

      {/* Responsable (compressed) */}
      <td
        className="py-2 px-1.5 text-[11px] text-slate-600 truncate"
        title={activity.responsable || undefined}
      >
        {activity.responsable || <span className="text-slate-300">—</span>}
      </td>

      {/* Exécutants (compressed) */}
      <td
        className="py-2 px-1.5 text-[11px] text-slate-600 truncate"
        title={executantsText || undefined}
      >
        {executantsText || <span className="text-slate-300">—</span>}
      </td>

      {/* Texte complet (unconstrained, full text visible) */}
      <td className="py-2 px-3 bg-blue-50/15 border-l border-slate-100">
        {editingText ? (
          <div className="space-y-1.5">
            <textarea
              autoFocus
              rows={Math.max(4, Math.min(18, textDraft.split('\n').length + 1))}
              value={textDraft}
              onChange={(e) => setTextDraft(e.target.value)}
              onBlur={commitText}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setTextDraft(activity.texte);
                  setEditingText(false);
                }
              }}
              placeholder="Saisissez le texte complet..."
              className="w-full px-2.5 py-2 text-[13px] leading-relaxed text-slate-900 bg-white border border-blue-500 rounded-md focus:outline-none resize-y"
            />
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  commitText();
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700"
              >
                <Check className="w-3 h-3" />
                Enregistrer
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-start justify-between gap-2">
            <div
              onClick={startEditing}
              title={canEditCore ? "Cliquer pour modifier le texte" : "Cliquer pour voir la fiche"}
              className="min-w-0 flex-1 cursor-text rounded px-1 -mx-1 py-0.5 hover:bg-white/90 transition-colors"
            >
              {activity.texte.trim() ? (
                <p className="text-[13px] leading-relaxed text-slate-800 whitespace-pre-wrap break-words">
                  {activity.texte}
                </p>
              ) : (
                <span className="text-xs text-slate-300 italic">
                  {canEditCore ? "Aucun texte — cliquer pour ajouter…" : "Aucun texte saisi"}
                </span>
              )}
            </div>

            <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
              {saving && (
                <span className="text-[11px] text-slate-400">Enreg.…</span>
              )}
              {canEditCore && (
                <button
                  type="button"
                  onClick={startEditing}
                  title="Modifier le texte"
                  className="p-1 text-slate-400 hover:text-blue-700 rounded hover:bg-white"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                type="button"
                onClick={onOpenDetail}
                title="Ouvrir la fiche détaillée"
                className="p-1 text-slate-400 hover:text-blue-700 rounded hover:bg-white"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </td>
    </tr>
  );
};