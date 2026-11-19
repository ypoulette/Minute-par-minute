import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CornerDownRight,
  FileText,
  GripVertical,
  Link2,
  MessageSquare,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react';
import type {
  ActivityItem,
  BlocGroup,
  ComputedActivity,
  EtapeDetail,
  EventPlan,
  TeamRole,
} from '../types/planner';
import { getEtapeDisplay } from '../utils/etapeDefaults';
import {
  collectDependentSubtreeIds,
  groupActivitiesByBloc,
} from '../utils/scheduleEngine';
import { ResourceCreatableSelect } from './ResourceCreatableSelect';
import { ResourceMultiSelect } from './ResourceMultiSelect';
import { TimePickerDropdown } from './TimePickerDropdown';

interface ScheduleTableProps {
  event: EventPlan;
  userRole?: TeamRole;
  allActivities: ComputedActivity[];
  visibleActivities: ComputedActivity[];
  allActivitiesCount: number;
  viewMode: 'bloc' | 'chronologique';
  hasActiveFilters: boolean;
  pendingTimeEditId: string | null;
  onClearPendingTimeEdit: () => void;
  onOpenDetail: (activityId: string) => void;
  onUpdateActivity: (activityId: string, updates: Partial<ActivityItem>) => Promise<void>;
  onDeleteActivity: (activityId: string) => Promise<void>;
  onUpdateBlocDetail: (etapeKey: string, detail: EtapeDetail) => Promise<void>;
  onAddActivityInBloc: (
    etapeKey: string,
    defaultStep: number | null,
    suggestedNextTime?: string
  ) => void;
  onReorderDrop: (
    draggedId: string,
    targetId: string,
    position: 'before' | 'after'
  ) => Promise<void>;
  onDropToBloc: (draggedId: string, targetEtapeKey: string) => Promise<void>;
  onAddResource: (name: string) => Promise<void>;
  onAddEtape: (name: string) => Promise<void>;
  onCreateFirst: () => void;
}

export const ScheduleTable: React.FC<ScheduleTableProps> = ({
  event,
  userRole = 'editeur',
  allActivities,
  visibleActivities,
  allActivitiesCount,
  viewMode,
  hasActiveFilters,
  pendingTimeEditId,
  onClearPendingTimeEdit,
  onOpenDetail,
  onUpdateActivity,
  onDeleteActivity,
  onUpdateBlocDetail,
  onAddActivityInBloc,
  onReorderDrop,
  onDropToBloc,
  onAddResource,
  onAddEtape,
  onCreateFirst,
}) => {
  const canEditCore = userRole === 'admin' || userRole === 'editeur';
  const canEditComments = userRole === 'admin' || userRole === 'editeur' || userRole === 'reviseur';
  const canToggleCorrection = userRole === 'admin' || userRole === 'editeur' || userRole === 'reviseur';
  const canDeleteOrReorder = userRole === 'admin' || userRole === 'editeur';

  const [dragArmedId, setDragArmedId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{
    id: string;
    position: 'before' | 'after';
  } | null>(null);
  const [dropBlocKey, setDropBlocKey] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [collapsedBlocs, setCollapsedBlocs] = useState<Record<string, boolean>>({});

  const activityById = useMemo(
    () => new Map(allActivities.map((a) => [a.id, a])),
    [allActivities]
  );

  const draggingSubtreeIds = useMemo(() => {
    if (!draggingId) return new Set<string>();
    return new Set(collectDependentSubtreeIds(allActivities, draggingId));
  }, [allActivities, draggingId]);

  if (allActivitiesCount === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-12 text-center space-y-3">
        <h3 className="text-base font-semibold text-slate-900">
          Aucune activité planifiée pour cet événement
        </h3>
        <p className="text-sm text-slate-500 max-w-md mx-auto">
          Ajoutez votre première activité minute par minute ou importez votre fichier Excel/CSV.
        </p>
        <div className="pt-2">
          <button
            type="button"
            onClick={onCreateFirst}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
          >
            Créer la première activité
          </button>
        </div>
      </div>
    );
  }

  if (visibleActivities.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-10 text-center text-sm text-slate-500">
        Aucune activité ne correspond aux filtres actuels.
      </div>
    );
  }

  const etapeLabels: Record<string, string> = {};
  for (const et of event.etapes) {
    const d = getEtapeDisplay(et, event.etapeDetails);
    if (d.title) etapeLabels[et] = d.title;
  }

  const toggleCollapse = (key: string) => {
    setCollapsedBlocs((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  if (viewMode === 'chronologique') {
    const flatSorted = [...visibleActivities].sort((a, b) => {
      const sa = a.step ?? 99999;
      const sb = b.step ?? 99999;
      if (sa !== sb) return sa - sb;
      if (a.sortMinutes !== b.sortMinutes) return a.sortMinutes - b.sortMinutes;
      return a.orderIndex - b.orderIndex;
    });

    return (
      <div className="bg-white border border-slate-200 rounded-xl overflow-visible">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-medium text-slate-600">
                <th className="w-8 py-2.5 pl-2.5 pr-1" aria-label="Déplacer" />
                <th className="w-11 py-2.5 px-1 text-center" title="Activité terminée">
                  Fait
                </th>
                <th className="w-11 py-2.5 px-1 text-center" title="Correction nécessaire">
                  Corr.
                </th>
                <th className="w-10 py-2.5 px-1 text-center">#</th>
                <th className="w-12 py-2.5 px-1.5">Step</th>
                <th className="w-36 py-2.5 px-1.5">Bloc</th>
                <th className="w-24 py-2.5 px-1.5">Date</th>
                <th className="w-24 py-2.5 px-1.5">Horaire</th>
                <th className="w-16 py-2.5 px-1.5 text-right">Durée</th>
                <th className="min-w-[340px] py-2.5 px-3">Activité</th>
                <th className="w-36 py-2.5 px-1.5">Responsable</th>
                <th className="w-32 py-2.5 px-1.5">Exécutant(s)</th>
                <th className="w-56 py-2.5 px-2">Commentaires réviseur</th>
                <th className="w-20 py-2.5 pl-1.5 pr-2.5 text-right">Texte</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {flatSorted.map((act, idx) => {
                const prevAct = idx > 0 ? flatSorted[idx - 1] : null;
                const isNewDay = Boolean(prevAct && prevAct.computedDate !== act.computedDate);
                const suggestedNext =
                  prevAct?.computedEndHoraire ||
                  (prevAct?.computedHoraire && prevAct.computedHoraire !== '—'
                    ? prevAct.computedHoraire
                    : undefined);
                const parentAct = act.parentId ? activityById.get(act.parentId) || null : null;

                return (
                  <ActivityRow
                    key={act.id}
                    event={event}
                    activity={act}
                    parentActivity={parentAct}
                    canEditCore={canEditCore}
                    canEditComments={canEditComments}
                    canToggleCorrection={canToggleCorrection}
                    canDeleteOrReorder={canDeleteOrReorder}
                    showTreeLines={false}
                    showEtapeColumn
                    etapeLabels={etapeLabels}
                    suggestedNextTime={suggestedNext}
                    isNewDay={isNewDay}
                    isDragging={draggingSubtreeIds.has(act.id)}
                    isDragArmed={dragArmedId === act.id}
                    isDropBefore={
                      dropTarget?.id === act.id && dropTarget.position === 'before'
                    }
                    isDropAfter={
                      dropTarget?.id === act.id && dropTarget.position === 'after'
                    }
                    isPendingTimeEdit={pendingTimeEditId === act.id}
                    isConfirmingDelete={confirmDeleteId === act.id}
                    onArmDrag={() => setDragArmedId(act.id)}
                    onDisarmDrag={() => setDragArmedId(null)}
                    onDragStart={(e) => {
                      setDraggingId(act.id);
                      e.dataTransfer.effectAllowed = 'move';
                      e.dataTransfer.setData('text/plain', act.id);
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      if (!draggingId || draggingSubtreeIds.has(act.id)) return;
                      const rect = e.currentTarget.getBoundingClientRect();
                      const pos =
                        e.clientY - rect.top < rect.height / 2 ? 'before' : 'after';
                      setDropTarget({ id: act.id, position: pos });
                    }}
                    onDrop={async (e) => {
                      e.preventDefault();
                      const sourceId = draggingId || e.dataTransfer.getData('text/plain');
                      const pos = dropTarget?.position || 'after';
                      const blocked = draggingSubtreeIds.has(act.id);
                      setDraggingId(null);
                      setDropTarget(null);
                      setDragArmedId(null);
                      if (sourceId && sourceId !== act.id && !blocked) {
                        await onReorderDrop(sourceId, act.id, pos);
                      }
                    }}
                    onDragEnd={() => {
                      setDraggingId(null);
                      setDropTarget(null);
                      setDragArmedId(null);
                    }}
                    onOpenDetail={() => onOpenDetail(act.id)}
                    onUpdate={(updates) => onUpdateActivity(act.id, updates)}
                    onClearPendingTimeEdit={onClearPendingTimeEdit}
                    onRequestDelete={() => setConfirmDeleteId(act.id)}
                    onCancelDelete={() => setConfirmDeleteId(null)}
                    onConfirmDelete={async () => {
                      setConfirmDeleteId(null);
                      await onDeleteActivity(act.id);
                    }}
                    onAddResource={onAddResource}
                    onAddEtape={onAddEtape}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // Grouped by Bloc view (default, with WBS & project-management dependency tree)
  const blocGroups = groupActivitiesByBloc(
    visibleActivities,
    event.etapes,
    event.etapeDetails,
    !hasActiveFilters
  );

  return (
    <div className="space-y-5">
      {blocGroups.map((group) => {
        const isCollapsed = Boolean(collapsedBlocs[group.etapeKey]);
        const isHeaderDrop = dropBlocKey === group.etapeKey;
        const lastInBloc =
          group.activities.length > 0
            ? group.activities[group.activities.length - 1]
            : null;
        const defaultStepForBloc = lastInBloc ? lastInBloc.step : 0;
        const suggestedTimeForBloc =
          lastInBloc?.computedEndHoraire ||
          (lastInBloc?.computedHoraire && lastInBloc.computedHoraire !== '—'
            ? lastInBloc.computedHoraire
            : undefined);

        return (
          <section
            key={group.etapeKey || '__uncategorized__'}
            className={`bg-white border rounded-xl overflow-visible transition-colors ${
              isHeaderDrop ? 'border-blue-500 ring-2 ring-blue-100' : 'border-slate-200'
            }`}
          >
            <BlocHeader
              group={group}
              isCollapsed={isCollapsed}
              canEditCore={canEditCore}
              onToggleCollapse={() => toggleCollapse(group.etapeKey)}
              onUpdateDetail={(detail) => onUpdateBlocDetail(group.etapeKey, detail)}
              onAddActivity={() =>
                onAddActivityInBloc(
                  group.etapeKey,
                  defaultStepForBloc,
                  suggestedTimeForBloc
                )
              }
              onDragOver={(e) => {
                if (!draggingId) return;
                e.preventDefault();
                setDropBlocKey(group.etapeKey);
              }}
              onDragLeave={() => {
                if (dropBlocKey === group.etapeKey) setDropBlocKey(null);
              }}
              onDrop={async (e) => {
                e.preventDefault();
                const sourceId = draggingId || e.dataTransfer.getData('text/plain');
                setDraggingId(null);
                setDropTarget(null);
                setDropBlocKey(null);
                setDragArmedId(null);
                if (sourceId) {
                  await onDropToBloc(sourceId, group.etapeKey);
                }
              }}
            />

            {!isCollapsed && (
              <div className="overflow-x-auto border-t border-slate-200">
                {group.activities.length === 0 ? (
                  <div className="px-6 py-6 text-xs text-slate-400 flex items-center justify-between">
                    <span>
                      {canEditCore
                        ? 'Aucune activité dans ce bloc. Glissez une activité ici ou ajoutez-en une.'
                        : 'Aucune activité dans ce bloc.'}
                    </span>
                    {canEditCore && (
                      <button
                        type="button"
                        onClick={() =>
                          onAddActivityInBloc(group.etapeKey, 0, undefined)
                        }
                        className="text-blue-600 hover:text-blue-700 font-medium"
                      >
                        + Ajouter une activité
                      </button>
                    )}
                  </div>
                ) : (
                  <table className="w-full border-collapse text-left">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-600">
                        <th className="w-8 py-2 pl-2.5 pr-1" aria-label="Déplacer" />
                        <th className="w-11 py-2 px-1 text-center" title="Activité terminée">
                          Fait
                        </th>
                        <th className="w-11 py-2 px-1 text-center" title="Correction nécessaire">
                          Corr.
                        </th>
                        <th className="w-10 py-2 px-1 text-center">#</th>
                        <th className="w-12 py-2 px-1.5">Step</th>
                        <th className="w-24 py-2 px-1.5">Date</th>
                        <th className="w-24 py-2 px-1.5">Horaire</th>
                        <th className="w-16 py-2 px-1.5 text-right">Durée</th>
                        <th className="min-w-[380px] py-2 px-3">Activité</th>
                        <th className="w-36 py-2 px-1.5">Responsable</th>
                        <th className="w-32 py-2 px-1.5">Exécutant(s)</th>
                        <th className="w-56 py-2 px-2">Commentaires réviseur</th>
                        <th className="w-20 py-2 pl-1.5 pr-2.5 text-right">Texte</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                      {group.activities.map((act, idx) => {
                        const prevAct = idx > 0 ? group.activities[idx - 1] : null;
                        const isNewDay = Boolean(
                          prevAct && prevAct.computedDate !== act.computedDate
                        );
                        const suggestedNext =
                          prevAct?.computedEndHoraire ||
                          (prevAct?.computedHoraire && prevAct.computedHoraire !== '—'
                            ? prevAct.computedHoraire
                            : undefined);
                        const parentAct = act.parentId
                          ? activityById.get(act.parentId) || null
                          : null;

                        return (
                          <ActivityRow
                            key={act.id}
                            event={event}
                            activity={act}
                            parentActivity={parentAct}
                            canEditCore={canEditCore}
                            canEditComments={canEditComments}
                            canToggleCorrection={canToggleCorrection}
                            canDeleteOrReorder={canDeleteOrReorder}
                            showTreeLines={!hasActiveFilters}
                            showEtapeColumn={false}
                            etapeLabels={etapeLabels}
                            suggestedNextTime={suggestedNext}
                            isNewDay={isNewDay}
                            isDragging={draggingSubtreeIds.has(act.id)}
                            isDragArmed={dragArmedId === act.id}
                            isDropBefore={
                              dropTarget?.id === act.id &&
                              dropTarget.position === 'before'
                            }
                            isDropAfter={
                              dropTarget?.id === act.id &&
                              dropTarget.position === 'after'
                            }
                            isPendingTimeEdit={pendingTimeEditId === act.id}
                            isConfirmingDelete={confirmDeleteId === act.id}
                            onArmDrag={() => setDragArmedId(act.id)}
                            onDisarmDrag={() => setDragArmedId(null)}
                            onDragStart={(e) => {
                              setDraggingId(act.id);
                              e.dataTransfer.effectAllowed = 'move';
                              e.dataTransfer.setData('text/plain', act.id);
                            }}
                            onDragOver={(e) => {
                              e.preventDefault();
                              if (!draggingId || draggingSubtreeIds.has(act.id)) return;
                              const rect = e.currentTarget.getBoundingClientRect();
                              const pos =
                                e.clientY - rect.top < rect.height / 2
                                  ? 'before'
                                  : 'after';
                              setDropTarget({ id: act.id, position: pos });
                              setDropBlocKey(null);
                            }}
                            onDrop={async (e) => {
                              e.preventDefault();
                              const sourceId =
                                draggingId || e.dataTransfer.getData('text/plain');
                              const pos = dropTarget?.position || 'after';
                              const blocked = draggingSubtreeIds.has(act.id);
                              setDraggingId(null);
                              setDropTarget(null);
                              setDropBlocKey(null);
                              setDragArmedId(null);
                              if (sourceId && sourceId !== act.id && !blocked) {
                                await onReorderDrop(sourceId, act.id, pos);
                              }
                            }}
                            onDragEnd={() => {
                              setDraggingId(null);
                              setDropTarget(null);
                              setDropBlocKey(null);
                              setDragArmedId(null);
                            }}
                            onOpenDetail={() => onOpenDetail(act.id)}
                            onUpdate={(updates) => onUpdateActivity(act.id, updates)}
                            onClearPendingTimeEdit={onClearPendingTimeEdit}
                            onRequestDelete={() => setConfirmDeleteId(act.id)}
                            onCancelDelete={() => setConfirmDeleteId(null)}
                            onConfirmDelete={async () => {
                              setConfirmDeleteId(null);
                              await onDeleteActivity(act.id);
                            }}
                            onAddResource={onAddResource}
                            onAddEtape={onAddEtape}
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

interface BlocHeaderProps {
  group: BlocGroup;
  isCollapsed: boolean;
  canEditCore?: boolean;
  onToggleCollapse: () => void;
  onUpdateDetail: (detail: EtapeDetail) => Promise<void>;
  onAddActivity: () => void;
  onDragOver: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent<HTMLDivElement>) => void;
}

const BlocHeader: React.FC<BlocHeaderProps> = ({
  group,
  isCollapsed,
  canEditCore = true,
  onToggleCollapse,
  onUpdateDetail,
  onAddActivity,
  onDragOver,
  onDragLeave,
  onDrop,
}) => {
  const [editing, setEditing] = useState(false);
  const [titleDraft, setTitleDraft] = useState(group.title);
  const [descDraft, setDescDraft] = useState(group.description);

  useEffect(() => {
    setTitleDraft(group.title);
    setDescDraft(group.description);
  }, [group.title, group.description]);

  const handleSave = async () => {
    setEditing(false);
    const cleanTitle = titleDraft.trim();
    const cleanDesc = descDraft.trim();
    if (cleanTitle !== group.title || cleanDesc !== group.description) {
      await onUpdateDetail({ title: cleanTitle, description: cleanDesc });
    }
  };

  const canEdit = canEditCore && group.etapeKey !== '';

  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className="px-4 sm:px-5 py-3.5 bg-slate-50/50 flex flex-wrap items-start justify-between gap-4 rounded-t-xl"
    >
      <div className="flex items-start gap-2.5 min-w-0 flex-1">
        <button
          type="button"
          onClick={onToggleCollapse}
          aria-label={isCollapsed ? 'Déplier le bloc' : 'Replier le bloc'}
          className="mt-0.5 p-1 text-slate-500 hover:text-slate-900 rounded hover:bg-slate-200/60 shrink-0"
        >
          {isCollapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
        </button>

        <div className="min-w-0 flex-1 space-y-1">
          {editing ? (
            <div className="space-y-2 max-w-2xl">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-semibold text-blue-700 shrink-0">
                  {group.etapeKey}
                </span>
                <input
                  type="text"
                  autoFocus
                  value={titleDraft}
                  onChange={(e) => setTitleDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSave();
                    if (e.key === 'Escape') {
                      setTitleDraft(group.title);
                      setDescDraft(group.description);
                      setEditing(false);
                    }
                  }}
                  placeholder="Nom du bloc (ex. Préparation du site)..."
                  className="flex-1 px-2.5 py-1 text-sm font-semibold text-slate-900 bg-white border border-blue-500 rounded-md focus:outline-none"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={descDraft}
                  onChange={(e) => setDescDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSave();
                    if (e.key === 'Escape') {
                      setTitleDraft(group.title);
                      setDescDraft(group.description);
                      setEditing(false);
                    }
                  }}
                  placeholder="Décrire le contenu et l'objectif de ce bloc..."
                  className="flex-1 px-2.5 py-1 text-xs text-slate-700 bg-white border border-slate-300 rounded-md focus:outline-none focus:border-blue-500"
                />
                <button
                  type="button"
                  onClick={handleSave}
                  className="px-3 py-1 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 shrink-0"
                >
                  Enregistrer
                </button>
              </div>
            </div>
          ) : (
            <div className="group/header">
              <div className="flex flex-wrap items-baseline gap-2">
                {group.etapeKey ? (
                  <span className="font-mono text-xs font-semibold text-blue-700">
                    {group.etapeKey}
                  </span>
                ) : null}
                <h2 className="font-display text-sm sm:text-base font-bold text-slate-900">
                  {group.title || (group.etapeKey ? 'Nommer ce bloc' : 'Sans bloc')}
                </h2>
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => setEditing(true)}
                    title="Nommer le bloc et définir son contenu"
                    className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-blue-600 transition-colors"
                  >
                    <Pencil className="w-3 h-3" />
                    <span className="hidden sm:inline">Renommer / définir</span>
                  </button>
                )}
              </div>
              {group.description ? (
                <p
                  onClick={() => canEdit && setEditing(true)}
                  className={`text-xs text-slate-600 leading-relaxed ${
                    canEdit ? 'cursor-pointer hover:text-slate-900' : ''
                  }`}
                >
                  {group.description}
                </p>
              ) : (
                canEdit && (
                  <button
                    type="button"
                    onClick={() => setEditing(true)}
                    className="text-xs text-slate-400 hover:text-slate-600"
                  >
                    + Ajouter une définition du contenu du bloc
                  </button>
                )
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 shrink-0 self-center">
        <div className="hidden sm:flex items-center gap-2 text-xs text-slate-500 font-mono tabular-nums">
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

        {canEditCore && (
          <button
            type="button"
            onClick={onAddActivity}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 whitespace-nowrap shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            Ajouter
          </button>
        )}
      </div>
    </div>
  );
};

interface ReviewCommentCellProps {
  value: string;
  disabled: boolean;
  onSave: (val: string) => Promise<void>;
  onOpenDetail: () => void;
}

const ReviewCommentCell: React.FC<ReviewCommentCellProps> = ({
  value,
  disabled,
  onSave,
  onOpenDetail,
}) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editing) {
      setDraft(value);
    }
  }, [value, editing]);

  const commit = async () => {
    const trimmed = draft.trim();
    setEditing(false);
    if (trimmed !== (value || '').trim()) {
      setSaving(true);
      try {
        await onSave(trimmed);
      } catch (err) {
        console.error('Erreur sauvegarde commentaire:', err);
      } finally {
        setSaving(false);
      }
    }
  };

  const displayValue = saving ? draft : (value || draft);

  if (disabled) {
    if (!value) return <span className="text-slate-300 text-xs">—</span>;
    return (
      <div
        onClick={onOpenDetail}
        title={value}
        className="cursor-pointer max-w-[220px] truncate text-xs text-emerald-800 bg-emerald-50/80 px-2 py-1 rounded border border-emerald-200 hover:bg-emerald-100 transition-colors"
      >
        <span className="font-semibold mr-1">Rév:</span>
        {value}
      </div>
    );
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1 min-w-[200px]">
        <input
          type="text"
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') {
              setDraft(value);
              setEditing(false);
            }
          }}
          placeholder="Modif ou ajout demandé..."
          className="w-full px-2 py-1 text-xs border border-blue-500 rounded bg-white focus:outline-none shadow-sm"
        />
        {saving && <span className="text-[10px] text-slate-400">...</span>}
      </div>
    );
  }

  if (displayValue) {
    return (
      <div className="flex items-center gap-1 max-w-[230px]">
        <button
          type="button"
          onClick={() => setEditing(true)}
          title="Cliquer pour modifier la remarque de révision"
          className="truncate text-left text-xs font-medium text-emerald-800 bg-emerald-50 hover:bg-emerald-100/90 px-2 py-1 rounded border border-emerald-200 flex-1 transition-colors"
        >
          <span className="font-semibold text-emerald-950 mr-1">Rév:</span>
          {displayValue}
        </button>
        {saving && <span className="text-[10px] text-emerald-600 animate-pulse font-mono">…</span>}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="text-left text-xs text-slate-400 hover:text-emerald-700 italic px-1.5 py-0.5 rounded border border-transparent hover:border-slate-200 hover:bg-white transition-colors"
    >
      + Note de révision…
    </button>
  );
};

interface ActivityRowProps {
  event: EventPlan;
  activity: ComputedActivity;
  parentActivity: ComputedActivity | null;
  canEditCore: boolean;
  canEditComments: boolean;
  canToggleCorrection: boolean;
  canDeleteOrReorder: boolean;
  showTreeLines: boolean;
  showEtapeColumn: boolean;
  etapeLabels: Record<string, string>;
  suggestedNextTime?: string;
  isNewDay: boolean;
  isDragging: boolean;
  isDragArmed: boolean;
  isDropBefore: boolean;
  isDropAfter: boolean;
  isPendingTimeEdit: boolean;
  isConfirmingDelete: boolean;
  onArmDrag: () => void;
  onDisarmDrag: () => void;
  onDragStart: (e: React.DragEvent<HTMLTableRowElement>) => void;
  onDragOver: (e: React.DragEvent<HTMLTableRowElement>) => void;
  onDrop: (e: React.DragEvent<HTMLTableRowElement>) => void;
  onDragEnd: () => void;
  onOpenDetail: () => void;
  onUpdate: (updates: Partial<ActivityItem>) => Promise<void>;
  onClearPendingTimeEdit: () => void;
  onRequestDelete: () => void;
  onCancelDelete: () => void;
  onConfirmDelete: () => void;
  onAddResource: (name: string) => Promise<void>;
  onAddEtape: (name: string) => Promise<void>;
}

const ActivityRow: React.FC<ActivityRowProps> = ({
  event,
  activity,
  parentActivity,
  canEditCore,
  canEditComments,
  canToggleCorrection,
  canDeleteOrReorder,
  showTreeLines,
  showEtapeColumn,
  etapeLabels,
  suggestedNextTime,
  isNewDay,
  isDragging,
  isDragArmed,
  isDropBefore,
  isDropAfter,
  isPendingTimeEdit,
  isConfirmingDelete,
  onArmDrag,
  onDisarmDrag,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onOpenDetail,
  onUpdate,
  onClearPendingTimeEdit,
  onRequestDelete,
  onCancelDelete,
  onConfirmDelete,
  onAddResource,
  onAddEtape,
}) => {
  const [stepDraft, setStepDraft] = useState(
    activity.step === null ? '' : String(activity.step)
  );
  const [dureeDraft, setDureeDraft] = useState(String(activity.dureeMinutes));

  useEffect(() => {
    setStepDraft(activity.step === null ? '' : String(activity.step));
  }, [activity.step]);

  useEffect(() => {
    setDureeDraft(String(activity.dureeMinutes));
  }, [activity.dureeMinutes]);

  const commitStep = () => {
    const t = stepDraft.trim();
    const parsed = t === '' ? null : parseInt(t, 10);
    const clean = parsed !== null && !Number.isNaN(parsed) ? parsed : null;
    if (clean !== activity.step) {
      onUpdate({ step: clean });
    }
  };

  const commitDuration = () => {
    const num = Math.max(0, Math.min(1440, parseInt(dureeDraft, 10) || 0));
    setDureeDraft(String(num));
    if (num !== activity.dureeMinutes) {
      onUpdate({ dureeMinutes: num });
    }
  };

  const hasText = activity.texte.trim().length > 0;
  const isChild = activity.dependencyDepth > 0;

  return (
    <tr
      draggable={canDeleteOrReorder && isDragArmed}
      onDragStart={canDeleteOrReorder ? onDragStart : undefined}
      onDragOver={canDeleteOrReorder ? onDragOver : undefined}
      onDrop={canDeleteOrReorder ? onDrop : undefined}
      onDragEnd={canDeleteOrReorder ? onDragEnd : undefined}
      style={{
        boxShadow: isDropBefore
          ? 'inset 0 2px 0 0 #2563eb'
          : isDropAfter
          ? 'inset 0 -2px 0 0 #2563eb'
          : undefined,
      }}
      className={`group transition-colors ${
        isDragging
          ? 'opacity-40 bg-blue-50/50'
          : activity.isDone
          ? 'bg-emerald-50/35 hover:bg-emerald-50/70'
          : activity.needsCorrection
          ? 'bg-amber-50/55 hover:bg-amber-50/80'
          : isChild
          ? 'bg-slate-50/35 hover:bg-blue-50/30'
          : 'hover:bg-slate-50/90'
      } ${isNewDay ? 'border-t-2 border-t-slate-200' : ''}`}
    >
      {/* Drag Handle */}
      <td className="py-1.5 pl-3 pr-1 align-middle">
        {canDeleteOrReorder ? (
          <div
            onMouseEnter={onArmDrag}
            onMouseDown={onArmDrag}
            onMouseLeave={() => {
              if (!isDragging) onDisarmDrag();
            }}
            title={
              activity.childCount > 0
                ? `Glisser pour déplacer avec ses ${activity.childCount} sous-activité(s)`
                : "Glisser pour déplacer l'activité"
            }
            className="p-1 text-slate-300 hover:text-slate-600 cursor-grab active:cursor-grabbing rounded flex items-center justify-center"
          >
            <GripVertical className="w-4 h-4" />
          </div>
        ) : (
          <div className="w-4 h-4" />
        )}
      </td>

      {/* Activité terminée checkbox */}
      <td className="py-1.5 px-1 align-middle text-center">
        <input
          type="checkbox"
          disabled={!canEditCore}
          checked={Boolean(activity.isDone)}
          onChange={(e) => onUpdate({ isDone: e.target.checked })}
          aria-label="Activité terminée"
          title={
            canEditCore
              ? activity.isDone
                ? 'Marquer comme non terminée'
                : 'Marquer comme terminée'
              : activity.isDone
              ? 'Activité terminée'
              : 'Activité non terminée'
          }
          className={`w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 accent-emerald-600 align-middle ${
            canEditCore ? 'cursor-pointer' : 'cursor-default opacity-60'
          }`}
        />
      </td>

      {/* Correction nécessaire checkbox */}
      <td className="py-1.5 px-1 align-middle text-center">
        <input
          type="checkbox"
          disabled={!canToggleCorrection}
          checked={Boolean(activity.needsCorrection)}
          onChange={(e) => onUpdate({ needsCorrection: e.target.checked })}
          aria-label="Correction nécessaire"
          title={
            canToggleCorrection
              ? 'Cocher si une correction est nécessaire'
              : 'Signalement de correction'
          }
          className={`w-4 h-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500 accent-amber-600 align-middle ${
            canToggleCorrection ? 'cursor-pointer' : 'cursor-default opacity-60'
          }`}
        />
      </td>

      {/* WBS # */}
      <td className="py-1.5 px-1.5 align-middle text-center">
        <span
          className={`font-mono text-xs tabular-nums ${
            isChild
              ? 'text-blue-700 font-medium'
              : activity.childCount > 0
              ? 'text-slate-900 font-semibold'
              : 'text-slate-400'
          }`}
        >
          {activity.wbsCode}
        </span>
      </td>

      {/* Step */}
      <td className="py-1.5 px-2 align-middle">
        <input
          type="text"
          disabled={!canEditCore}
          value={stepDraft}
          onChange={(e) => setStepDraft(e.target.value)}
          onBlur={commitStep}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
          }}
          aria-label="Step"
          placeholder="—"
          className={`w-12 px-1.5 py-1 text-xs font-mono tabular-nums text-slate-700 bg-transparent rounded focus:outline-none text-center ${
            canEditCore
              ? 'hover:bg-white focus:bg-white border border-transparent hover:border-slate-200 focus:border-blue-600'
              : 'border-transparent cursor-default'
          }`}
        />
      </td>

      {/* Optional Bloc column in flat view */}
      {showEtapeColumn && (
        <td className="py-1.5 px-2 align-middle">
          <ResourceCreatableSelect
            compact
            disabled={!canEditCore}
            value={activity.etape}
            options={event.etapes}
            optionLabels={etapeLabels}
            placeholder="Bloc..."
            onChange={(val) => onUpdate({ etape: val })}
            onAddOption={onAddEtape}
            ariaLabel="Bloc"
          />
        </td>
      )}

      {/* Date calculée */}
      <td className="py-1.5 px-2 align-middle">
        <span className="text-xs font-mono tabular-nums text-slate-600 whitespace-nowrap">
          {activity.computedDate}
        </span>
      </td>

      {/* Horaire (compact) */}
      <td className="py-1.5 px-1.5 align-middle w-24">
        <div className="w-[88px]">
          {activity.horaireMode === 'dependant' || !canEditCore ? (
            <button
              type="button"
              onClick={onOpenDetail}
              className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-mono tabular-nums whitespace-nowrap ${
                activity.isCascadeWarning
                  ? 'text-amber-700 bg-amber-50 hover:bg-amber-100/70'
                  : 'text-blue-700 bg-blue-50/70 hover:bg-blue-100/70'
              }`}
              title={
                !canEditCore
                  ? 'Horaire (cliquer pour voir la fiche)'
                  : activity.isCascadeWarning
                  ? "L'activité parente n'a pas d'heure fixe HH:MM — cliquer pour modifier"
                  : parentActivity
                  ? `Calculé après #${parentActivity.wbsCode} (${parentActivity.computedHoraire} + ${parentActivity.dureeMinutes} min) — cliquer pour modifier`
                  : 'Heure calculée automatiquement — cliquer pour modifier'
              }
            >
              {activity.isCascadeWarning ? (
                <AlertTriangle className="w-3 h-3 shrink-0" />
              ) : (
                <Link2 className="w-3 h-3 shrink-0" />
              )}
              <span>{activity.computedHoraire}</span>
            </button>
          ) : (
            <TimePickerDropdown
              compact
              value={activity.horaireManuel}
              suggestedNextTime={suggestedNextTime}
              highlightPending={isPendingTimeEdit}
              onClearPending={onClearPendingTimeEdit}
              onChange={(nextVal) => {
                if (nextVal !== activity.horaireManuel) {
                  onUpdate({ horaireManuel: nextVal });
                }
              }}
            />
          )}
        </div>
      </td>

      {/* Durée */}
      <td className="py-1.5 px-2 align-middle text-right">
        <div className="inline-flex items-center justify-end gap-0.5">
          <input
            type="number"
            disabled={!canEditCore}
            min={0}
            max={1440}
            value={dureeDraft}
            onChange={(e) => setDureeDraft(e.target.value)}
            onBlur={commitDuration}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur();
            }}
            aria-label="Durée en minutes"
            className={`w-12 px-1 py-1 text-xs font-mono tabular-nums text-right text-slate-700 bg-transparent rounded focus:outline-none ${
              canEditCore
                ? 'hover:bg-white focus:bg-white border border-transparent hover:border-slate-200 focus:border-blue-600'
                : 'border-transparent cursor-default'
            }`}
          />
          <span className="text-[11px] text-slate-400 font-mono">m</span>
        </div>
      </td>

      {/* Activité (with Project Management Tree Connector & Dependency Metadata) */}
      <td className="py-1.5 px-3 align-middle">
        <div className="flex items-stretch gap-1 min-w-0">
          {showTreeLines && isChild && (
            <div className="flex items-stretch shrink-0 select-none" aria-hidden="true">
              {activity.ancestorHasNextSibling.map((hasLine, idx) => (
                <span
                  key={idx}
                  className="w-5 flex justify-center shrink-0"
                >
                  {hasLine && <span className="w-px bg-blue-200 h-full" />}
                </span>
              ))}
              <span className="w-5 relative shrink-0 flex items-center justify-center">
                {/* Vertical line from top to center (and bottom if sibling follows) */}
                <span
                  className={`absolute left-1/2 -translate-x-1/2 w-px bg-blue-300 ${
                    activity.hasNextSibling ? 'top-0 bottom-0' : 'top-0 h-1/2'
                  }`}
                />
                {/* Horizontal connector to activity */}
                <span className="absolute left-1/2 right-0 top-1/2 -translate-y-1/2 h-px bg-blue-300" />
              </span>
            </div>
          )}

          <div className="min-w-0 flex-1">
            <button
              type="button"
              onClick={onOpenDetail}
              className="text-left w-full group/link focus:outline-none py-0.5"
            >
              <span
                className={`text-sm group-hover/link:text-blue-700 group-hover/link:underline leading-snug block ${
                  activity.childCount > 0 && !isChild
                    ? 'font-semibold text-slate-900'
                    : isChild
                    ? 'font-normal text-slate-800'
                    : 'font-normal text-slate-900'
                }`}
              >
                {activity.activite}
              </span>

              {(parentActivity || activity.childCount > 0 || activity.needsCorrection || activity.isDone) && (
                <div className="flex flex-wrap items-center gap-2 mt-0.5 text-[11px] leading-tight">
                  {activity.isDone && (
                    <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 bg-emerald-100/90 px-1.5 py-0.5 rounded">
                      <Check className="w-3 h-3" />
                      Fait
                    </span>
                  )}
                  {activity.needsCorrection && (
                    <span className="font-medium text-amber-800">
                      {activity.isDone ? '· ' : ''}À corriger
                    </span>
                  )}
                  {parentActivity && (
                    <span className="inline-flex items-center gap-1 text-blue-700/85 truncate max-w-[260px]">
                      <CornerDownRight className="w-3 h-3 shrink-0" />
                      <span>
                        {activity.isDone || activity.needsCorrection ? '· ' : ''}Dépend de #{parentActivity.wbsCode}
                        {!showTreeLines ? ` — ${parentActivity.activite}` : ''}
                      </span>
                    </span>
                  )}
                  {activity.childCount > 0 && (
                    <span className="text-slate-500 font-mono tabular-nums">
                      {parentActivity || activity.needsCorrection || activity.isDone ? '· ' : ''}
                      {activity.childCount} sous-activité
                      {activity.childCount > 1 ? 's' : ''} liée
                      {activity.childCount > 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              )}
            </button>
          </div>
        </div>
      </td>

      {/* Responsable */}
      <td className="py-1.5 px-1.5 align-middle w-36">
        <div className="w-[136px]">
          <ResourceCreatableSelect
            compact
            disabled={!canEditCore}
            value={activity.responsable}
            options={event.resources}
            placeholder="Responsable..."
            onChange={(val) => onUpdate({ responsable: val })}
            onAddOption={onAddResource}
            ariaLabel="Responsable"
          />
        </div>
      </td>

      {/* Exécutants (Multi-select) */}
      <td className="py-1.5 px-1.5 align-middle w-32">
        <div className="w-[120px]">
          <ResourceMultiSelect
            compact
            disabled={!canEditCore}
            values={activity.resolvedExecutants}
            options={event.resources}
            placeholder="Exécutants..."
            onChange={(vals) => onUpdate({ executants: vals })}
            onAddOption={onAddResource}
            ariaLabel="Exécutants"
          />
        </div>
      </td>

      {/* Commentaires réviseur */}
      <td className="py-1.5 px-2 align-middle">
        <ReviewCommentCell
          value={activity.commentaires || ''}
          disabled={!canEditComments}
          onSave={(val) => onUpdate({ commentaires: val })}
          onOpenDetail={onOpenDetail}
        />
      </td>

      {/* Texte & Actions */}
      <td className="py-1.5 pl-2 pr-3 align-middle text-right">
        <div className="inline-flex items-center justify-end gap-1">
          <button
            type="button"
            onClick={onOpenDetail}
            title={
              hasText
                ? 'Ouvrir la fiche et lire le texte complet'
                : 'Ouvrir la fiche pour ajouter du texte'
            }
            className={`inline-flex items-center gap-1 px-2 py-1 text-xs rounded border transition-colors whitespace-nowrap ${
              hasText
                ? 'text-blue-700 bg-blue-50/70 border-blue-200 hover:bg-blue-100/70 font-medium'
                : 'text-slate-400 bg-white border-slate-200 hover:text-slate-700'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>{hasText ? 'Texte' : 'Fiche'}</span>
          </button>

          {canDeleteOrReorder && (
            !isConfirmingDelete ? (
              <button
                type="button"
                onClick={onRequestDelete}
                title="Supprimer"
                className="p-1 text-slate-300 hover:text-red-600 rounded opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            ) : (
              <div className="inline-flex items-center gap-1">
                <button
                  type="button"
                  onClick={onConfirmDelete}
                  className="px-1.5 py-0.5 text-[11px] font-medium text-white bg-red-600 rounded hover:bg-red-700"
                >
                  Suppr.
                </button>
                <button
                  type="button"
                  onClick={onCancelDelete}
                  className="px-1.5 py-0.5 text-[11px] text-slate-600 bg-slate-100 rounded"
                >
                  Non
                </button>
              </div>
            )
          )}
        </div>
      </td>
    </tr>
  );
};