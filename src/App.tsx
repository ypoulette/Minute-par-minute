import React, { useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import {
  Calendar,
  Download,
  FileSpreadsheet,
  Layers,
  LogOut,
  Plus,
  Search,
  Users,
} from 'lucide-react';
import { ActivityDetailPage } from './components/ActivityDetailPage';
import { AuthScreen } from './components/AuthScreen';
import { CompactFullTextView } from './components/CompactFullTextView';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ImportCsvModal } from './components/ImportCsvModal';
import { NewActivityModal } from './components/NewActivityModal';
import { ResourcesModal } from './components/ResourcesModal';
import { ScheduleTable } from './components/ScheduleTable';
import { TeamModal } from './components/TeamModal';
import { auth } from './lib/firebase';
import {
  batchUpdateActivitiesOrder,
  createActivity,
  createEventWithCsv,
  deleteActivity,
  replaceEventActivitiesFromCsv,
  subscribeEventActivities,
  subscribeUserEvents,
  updateActivity,
  updateEventMetadata,
  updateTeamAccess,
} from './lib/plannerService';
import type {
  ActivityItem,
  ComputedActivity,
  EtapeDetail,
  EventPlan,
  HoraireMode,
  TeamRole,
} from './types/planner';
import { loadBundledEventCsv, type ParsedCsvPlan } from './utils/csvImporter';
import { getEtapeDisplay } from './utils/etapeDefaults';
import { exportActivitiesToExcel } from './utils/excelExport';
import { collectDependentSubtreeIds, computeSchedule } from './utils/scheduleEngine';

function PlannerApp() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [emailVerifiedTick, setEmailVerifiedTick] = useState(0);

  const [events, setEvents] = useState<EventPlan[]>([]);
  const [eventsLoaded, setEventsLoaded] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [activitiesLoaded, setActivitiesLoaded] = useState(false);

  const [seeding, setSeeding] = useState(false);
  const autoSeedAttemptedRef = useRef(false);

  // Navigation & Modals
  const [activePage, setActivePage] = useState<'liste' | 'texte'>('liste');
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'bloc' | 'chronologique'>('bloc');
  const [showResourcesModal, setShowResourcesModal] = useState(false);
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [newModalConfig, setNewModalConfig] = useState<{
    open: boolean;
    defaultStep: number | null;
    defaultEtape: string;
    defaultDependsOnId?: string | null;
    suggestedNextTime?: string;
  }>({
    open: false,
    defaultStep: 0,
    defaultEtape: '',
    defaultDependsOnId: null,
  });

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterEtape, setFilterEtape] = useState('ALL');
  const [filterResource, setFilterResource] = useState('ALL');
  const [filterStep, setFilterStep] = useState('ALL');
  const [filterCorrectionOnly, setFilterCorrectionOnly] = useState(false);

  // Inline states
  const [titleDraft, setTitleDraft] = useState('');
  const [pendingTimeEditId, setPendingTimeEditId] = useState<string | null>(null);

  // 1. Auth listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthReady(true);
      if (!u) {
        setEvents([]);
        setEventsLoaded(false);
        setActivities([]);
        setActivitiesLoaded(false);
        setSelectedEventId('');
        setSelectedActivityId(null);
        autoSeedAttemptedRef.current = false;
      }
    });
    return () => unsub();
  }, []);

  // Permettre un accès direct et fluide aux membres de l'équipe dès la connexion
  const isEmailVerified = Boolean(user?.email);

  // 2. Subscribe to events accessible by the signed-in, verified user
  useEffect(() => {
    if (!authReady || !user?.email || !isEmailVerified) return;
    const unsub = subscribeUserEvents(user.email, (list) => {
      setEvents(list);
      setEventsLoaded(true);
      setSelectedEventId((prev) => {
        if (prev && list.some((e) => e.id === prev)) return prev;
        return list[0]?.id || '';
      });
    });
    return () => unsub();
  }, [authReady, user?.email, isEmailVerified, emailVerifiedTick]);

  const activeEvent = useMemo(
    () => events.find((e) => e.id === selectedEventId) || events[0] || null,
    [events, selectedEventId]
  );

  useEffect(() => {
    if (activeEvent) {
      setTitleDraft(activeEvent.title);
    }
  }, [activeEvent?.id, activeEvent?.title]);

  // 3. Auto-seed initial CSV for Yves on very first login if 0 events exist
  useEffect(() => {
    if (
      authReady &&
      user?.email &&
      isEmailVerified &&
      eventsLoaded &&
      events.length === 0 &&
      !autoSeedAttemptedRef.current &&
      user.email.toLowerCase() === 'yvespoulette@live.ca'
    ) {
      autoSeedAttemptedRef.current = true;
      setSeeding(true);
      loadBundledEventCsv()
        .then((parsed) =>
          createEventWithCsv(
            user.uid,
            user.email!,
            'Relais pour la vie 2026 — Minute par minute',
            parsed
          )
        )
        .then((newId) => setSelectedEventId(newId))
        .catch((err) => console.error('Initial CSV seed failed:', err))
        .finally(() => setSeeding(false));
    }
  }, [authReady, user, isEmailVerified, eventsLoaded, events.length]);

  // 4. Subscribe to activities of the active event
  useEffect(() => {
    if (!authReady || !user?.email || !isEmailVerified || !activeEvent?.id) {
      setActivities([]);
      setActivitiesLoaded(false);
      return;
    }
    const unsub = subscribeEventActivities(activeEvent.id, user.email, (list) => {
      setActivities(list);
      setActivitiesLoaded(true);
    });
    return () => unsub();
  }, [authReady, user?.email, isEmailVerified, emailVerifiedTick, activeEvent?.id]);

  // 5. Compute dates, dependency tree, cascading times, and bloc-grouped order
  const computedActivities = useMemo(() => {
    if (!activeEvent) return [];
    return computeSchedule(activities, activeEvent.eventDate, activeEvent.etapes);
  }, [activities, activeEvent?.eventDate, activeEvent?.etapes]);

  // Available step filter values
  const availableSteps = useMemo(() => {
    const map = new Map<string, { label: string; sortKey: number }>();
    for (const act of computedActivities) {
      const key = act.step === null ? 'UNSET' : String(act.step);
      if (!map.has(key)) {
        const label =
          act.step === null
            ? 'À planifier'
            : `${act.step > 0 ? `+${act.step}` : act.step} j (${act.computedDate})`;
        map.set(key, { label, sortKey: act.step ?? 99999 });
      }
    }
    return Array.from(map.entries())
      .sort((a, b) => a[1].sortKey - b[1].sortKey)
      .map(([key, val]) => ({ key, label: val.label }));
  }, [computedActivities]);

  const correctionCount = useMemo(
    () => computedActivities.filter((a) => Boolean(a.needsCorrection)).length,
    [computedActivities]
  );

  const hasActiveFilters = Boolean(
    searchQuery.trim() ||
      filterEtape !== 'ALL' ||
      filterResource !== 'ALL' ||
      filterStep !== 'ALL' ||
      filterCorrectionOnly
  );

  // Filtered activities for Liste simple & Texte complet
  const visibleActivities = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return computedActivities.filter((act) => {
      if (filterCorrectionOnly && !act.needsCorrection) return false;
      if (filterEtape !== 'ALL' && act.etape !== filterEtape) return false;
      if (
        filterResource !== 'ALL' &&
        act.responsable !== filterResource &&
        !act.resolvedExecutants.includes(filterResource) &&
        act.executant !== filterResource
      ) {
        return false;
      }
      if (filterStep !== 'ALL') {
        const key = act.step === null ? 'UNSET' : String(act.step);
        if (key !== filterStep) return false;
      }
      if (q) {
        const execText = act.resolvedExecutants.join(' ');
        const haystack = `${act.wbsCode} ${act.activite} ${act.etape} ${act.responsable} ${execText} ${act.texte} ${act.computedHoraire}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [
    computedActivities,
    searchQuery,
    filterEtape,
    filterResource,
    filterStep,
    filterCorrectionOnly,
  ]);

  const selectedActivityIndex = useMemo(() => {
    if (!selectedActivityId) return -1;
    return computedActivities.findIndex((a) => a.id === selectedActivityId);
  }, [computedActivities, selectedActivityId]);

  const selectedActivity =
    selectedActivityIndex >= 0 ? computedActivities[selectedActivityIndex] : null;

  // Handlers

  const handleSeedFromBundledCsv = async () => {
    if (!user?.email) return;
    setSeeding(true);
    try {
      const parsed = await loadBundledEventCsv();
      const newId = await createEventWithCsv(
        user.uid,
        user.email,
        'Relais pour la vie 2026 — Minute par minute',
        parsed
      );
      setSelectedEventId(newId);
    } finally {
      setSeeding(false);
    }
  };

  const handleCreateBlankEvent = async () => {
    if (!user?.email) return;
    setSeeding(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const newId = await createEventWithCsv(user.uid, user.email, 'Nouvel événement', {
        eventDate: today,
        activities: [],
        resources: [],
        etapes: ['Bloc 00'],
        etapeDetails: {
          'Bloc 00': { title: 'Préparation du site', description: '' },
        },
      });
      setSelectedEventId(newId);
    } finally {
      setSeeding(false);
    }
  };

  const handleAddResource = async (name: string) => {
    if (!activeEvent) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    if (activeEvent.resources.some((r) => r.toLowerCase() === trimmed.toLowerCase())) {
      return;
    }
    const next = [...activeEvent.resources, trimmed].sort((a, b) =>
      a.localeCompare(b, 'fr', { sensitivity: 'base' })
    );
    await updateEventMetadata(activeEvent.id, { resources: next });
  };

  const handleAddEtape = async (
    name: string,
    position: 'auto' | 'start' | 'before' | 'end' = 'auto',
    targetEtape?: string
  ) => {
    if (!activeEvent) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    if (activeEvent.etapes.some((et) => et.toLowerCase() === trimmed.toLowerCase())) {
      return;
    }
    let next: string[];
    if (position === 'start') {
      next = [trimmed, ...activeEvent.etapes];
    } else if (position === 'before' && targetEtape) {
      const idx = activeEvent.etapes.indexOf(targetEtape);
      if (idx >= 0) {
        next = [...activeEvent.etapes.slice(0, idx), trimmed, ...activeEvent.etapes.slice(idx)];
      } else {
        next = [trimmed, ...activeEvent.etapes];
      }
    } else if (position === 'end') {
      next = [...activeEvent.etapes, trimmed];
    } else {
      // 'auto': tri automatique alphanumérique naturel (ex: Bloc -01 avant Bloc 00)
      next = [...activeEvent.etapes, trimmed].sort((a, b) =>
        a.localeCompare(b, 'fr', { numeric: true, sensitivity: 'base' })
      );
    }
    await updateEventMetadata(activeEvent.id, { etapes: next });
  };

  const handleUpdateBlocDetail = async (etapeKey: string, detail: EtapeDetail) => {
    if (!activeEvent || !etapeKey) return;
    const nextDetails: Record<string, EtapeDetail> = {
      ...(activeEvent.etapeDetails || {}),
      [etapeKey]: detail,
    };
    await updateEventMetadata(activeEvent.id, { etapeDetails: nextDetails });
  };

  const handleUpdateActivity = async (
    activityId: string,
    updates: Partial<ActivityItem>
  ) => {
    if (!activeEvent) return;
    const existing = computedActivities.find((a) => a.id === activityId);

    // Optimistic local state update
    setActivities((prev) =>
      prev.map((a) => (a.id === activityId ? { ...a, ...updates } : a))
    );

    const etapeChanged =
      updates.etape !== undefined && existing && updates.etape !== existing.etape;
    const stepChanged =
      updates.step !== undefined && existing && updates.step !== existing.step;

    if (existing && (etapeChanged || stepChanged)) {
      const subtreeIds = collectDependentSubtreeIds(computedActivities, activityId);
      const rootUpdates: Partial<ActivityItem> = { ...updates };
      if (etapeChanged && existing.horaireMode === 'dependant') {
        rootUpdates.dependsOnId = null;
      }
      await updateActivity(activeEvent.id, activityId, rootUpdates, existing);

      if (subtreeIds.length > 1) {
        const byId = new Map(computedActivities.map((a) => [a.id, a]));
        const nextRootStep = updates.step !== undefined ? updates.step : existing.step;
        const stepDelta =
          stepChanged && nextRootStep !== null && existing.step !== null
            ? nextRootStep - existing.step
            : null;
        const childUpdates = subtreeIds.slice(1).map((cid) => {
          const child = byId.get(cid)!;
          const nextStep = stepChanged
            ? stepDelta !== null && child.step !== null
              ? child.step + stepDelta
              : nextRootStep
            : undefined;
          return {
            id: cid,
            orderIndex: child.orderIndex,
            ...(etapeChanged ? { etape: updates.etape } : {}),
            ...(nextStep !== undefined ? { step: nextStep } : {}),
          };
        });
        await batchUpdateActivitiesOrder(activeEvent.id, childUpdates);
      }
      return;
    }

    await updateActivity(activeEvent.id, activityId, updates, existing);
  };

  const handleCreateActivity = async (payload: {
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
  }) => {
    if (!activeEvent) return;
    const maxOrder = activities.reduce(
      (max, a) => (a.orderIndex > max ? a.orderIndex : max),
      0
    );
    await createActivity(activeEvent, {
      ...payload,
      orderIndex: maxOrder + 1000,
    });
  };

  const handleDeleteActivity = async (activityId: string) => {
    if (!activeEvent) return;
    if (selectedActivityId === activityId) {
      setSelectedActivityId(null);
    }

    // Detach any direct dependent children so they keep their last calculated start time cleanly
    const directChildren = computedActivities.filter((a) => a.parentId === activityId);
    if (directChildren.length > 0) {
      await batchUpdateActivitiesOrder(
        activeEvent.id,
        directChildren.map((child) => ({
          id: child.id,
          orderIndex: child.orderIndex,
          horaireMode: 'manuel',
          dependsOnId: null,
          horaireManuel:
            child.computedHoraire !== '—' ? child.computedHoraire : child.horaireManuel,
        }))
      );
    }

    await deleteActivity(activeEvent.id, activityId);
  };

  const handleReorderDrop = async (
    draggedId: string,
    targetId: string,
    position: 'before' | 'after'
  ) => {
    if (!activeEvent) return;
    const byId = new Map(computedActivities.map((a) => [a.id, a]));
    const dragged = byId.get(draggedId);
    const target = byId.get(targetId);
    if (!dragged || !target) return;

    // Collect dragged activity + all transitive dependent sub-activities so they follow together
    const subtreeIds = collectDependentSubtreeIds(computedActivities, draggedId);
    const subtreeSet = new Set(subtreeIds);
    if (subtreeSet.has(targetId)) return;

    const subtreeItems = subtreeIds
      .map((id) => byId.get(id))
      .filter((x): x is ComputedActivity => Boolean(x));

    const rest = computedActivities.filter((a) => !subtreeSet.has(a.id));
    const targetIdx = rest.findIndex((a) => a.id === targetId);
    if (targetIdx === -1) return;

    const insertIdx = position === 'before' ? targetIdx : targetIdx + 1;
    const newEtape = viewMode === 'bloc' ? target.etape : dragged.etape;

    const prevRaw = insertIdx > 0 ? rest[insertIdx - 1] : null;
    const nextRaw = insertIdx < rest.length ? rest[insertIdx] : null;
    const prev = prevRaw && prevRaw.etape === newEtape ? prevRaw : null;
    const next = nextRaw && nextRaw.etape === newEtape ? nextRaw : null;

    const newStep = prev ? prev.step : next ? next.step : dragged.step;
    const stepDelta =
      newStep !== null && dragged.step !== null ? newStep - dragged.step : null;

    let nextHoraireManuel = dragged.horaireManuel;
    let nextMode: HoraireMode = dragged.horaireMode;
    let nextDependsOnId: string | null | undefined = dragged.dependsOnId;
    let shouldOpenTimePrompt = false;

    if (dragged.horaireMode === 'manuel') {
      const prevMin = prev && prev.step === newStep ? prev.sortMinutes : -1;
      const nextMin = next && next.step === newStep ? next.sortMinutes : 99999;
      const fitsChronologically =
        dragged.sortMinutes >= prevMin && dragged.sortMinutes <= nextMin;

      if (!fitsChronologically) {
        if (prev && prev.step === newStep) {
          nextHoraireManuel =
            prev.computedEndHoraire ||
            (prev.computedHoraire !== '—' ? prev.computedHoraire : '');
        } else if (next && next.step === newStep && next.computedHoraire !== '—') {
          nextHoraireManuel = next.computedHoraire;
        } else {
          nextHoraireManuel = '';
        }
        shouldOpenTimePrompt = true;
      }
    } else {
      // Dragged itself was a dependent sub-activity: re-parent to the activity right before drop
      if (prev) {
        nextDependsOnId = prev.id;
      } else {
        nextDependsOnId = null;
        nextMode = 'manuel';
        nextHoraireManuel =
          dragged.computedHoraire !== '—' ? dragged.computedHoraire : dragged.horaireManuel;
      }
    }

    const reordered = [
      ...rest.slice(0, insertIdx),
      ...subtreeItems,
      ...rest.slice(insertIdx),
    ];

    const batchUpdates: Array<{
      id: string;
      orderIndex: number;
      step?: number | null;
      etape?: string;
      horaireManuel?: string;
      horaireMode?: HoraireMode;
      dependsOnId?: string | null;
    }> = [];

    reordered.forEach((item, idx) => {
      const newOrder = (idx + 1) * 1000;
      if (item.id === dragged.id) {
        batchUpdates.push({
          id: item.id,
          orderIndex: newOrder,
          step: newStep,
          etape: newEtape,
          horaireManuel: nextHoraireManuel,
          horaireMode: nextMode,
          ...(nextDependsOnId !== undefined ? { dependsOnId: nextDependsOnId } : {}),
        });
      } else if (subtreeSet.has(item.id)) {
        const descStep =
          stepDelta !== null && item.step !== null ? item.step + stepDelta : newStep;
        batchUpdates.push({
          id: item.id,
          orderIndex: newOrder,
          step: descStep,
          etape: newEtape,
        });
      } else if (item.orderIndex !== newOrder) {
        batchUpdates.push({
          id: item.id,
          orderIndex: newOrder,
        });
      }
    });

    if (batchUpdates.length > 0) {
      await batchUpdateActivitiesOrder(activeEvent.id, batchUpdates);
    }

    if (shouldOpenTimePrompt) {
      setPendingTimeEditId(dragged.id);
    }
  };

  const handleDropToBloc = async (draggedId: string, targetEtapeKey: string) => {
    if (!activeEvent) return;
    const byId = new Map(computedActivities.map((a) => [a.id, a]));
    const dragged = byId.get(draggedId);
    if (!dragged || dragged.etape === targetEtapeKey) return;

    const subtreeIds = collectDependentSubtreeIds(computedActivities, draggedId);
    const subtreeItems = subtreeIds
      .map((id) => byId.get(id))
      .filter((x): x is ComputedActivity => Boolean(x));

    const blocItems = computedActivities.filter((a) => a.etape === targetEtapeKey);
    const lastInBloc = blocItems.length > 0 ? blocItems[blocItems.length - 1] : null;
    const maxOrder = computedActivities.reduce(
      (max, a) => (a.orderIndex > max ? a.orderIndex : max),
      0
    );

    const newStep = lastInBloc ? lastInBloc.step : dragged.step;
    const stepDelta =
      newStep !== null && dragged.step !== null ? newStep - dragged.step : null;

    let nextHoraire = dragged.horaireManuel;
    let nextMode: HoraireMode = dragged.horaireMode;
    let nextDependsOnId: string | null | undefined = dragged.dependsOnId;

    if (dragged.horaireMode === 'manuel' && lastInBloc && lastInBloc.step === newStep) {
      if (lastInBloc.sortMinutes > dragged.sortMinutes) {
        nextHoraire =
          lastInBloc.computedEndHoraire ||
          (lastInBloc.computedHoraire !== '—' ? lastInBloc.computedHoraire : '');
      }
    } else if (dragged.horaireMode === 'dependant') {
      if (lastInBloc) {
        nextDependsOnId = lastInBloc.id;
      } else {
        nextDependsOnId = null;
        nextMode = 'manuel';
        nextHoraire =
          dragged.computedHoraire !== '—' ? dragged.computedHoraire : dragged.horaireManuel;
      }
    }

    const batchUpdates = subtreeItems.map((item, idx) => {
      const orderIndex = maxOrder + (idx + 1) * 1000;
      if (item.id === dragged.id) {
        return {
          id: item.id,
          orderIndex,
          step: newStep,
          etape: targetEtapeKey,
          horaireManuel: nextHoraire,
          horaireMode: nextMode,
          ...(nextDependsOnId !== undefined ? { dependsOnId: nextDependsOnId } : {}),
        };
      }
      const descStep =
        stepDelta !== null && item.step !== null ? item.step + stepDelta : newStep;
      return {
        id: item.id,
        orderIndex,
        step: descStep,
        etape: targetEtapeKey,
      };
    });

    await batchUpdateActivitiesOrder(activeEvent.id, batchUpdates);
  };

  const handleReplaceCsv = async (parsed: ParsedCsvPlan) => {
    if (!activeEvent) return;
    await replaceEventActivitiesFromCsv(activeEvent, activities, parsed);
  };

  const handleCreateNewEventFromCsv = async (title: string, parsed: ParsedCsvPlan) => {
    if (!user?.email) return;
    const newId = await createEventWithCsv(user.uid, user.email, title, parsed);
    setSelectedEventId(newId);
    setSelectedActivityId(null);
  };

  // Loading auth
  if (!authReady) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-sm text-slate-500">Chargement de l’espace de planification...</div>
      </div>
    );
  }

  // Signed out or awaiting email verification
  if (!user) {
    return <AuthScreen />;
  }

  if (!user.emailVerified) {
    return (
      <AuthScreen
        pendingVerificationUser={user}
        onEmailVerified={() => setEmailVerifiedTick((t) => t + 1)}
      />
    );
  }

  // Signed in, loading events or seeding
  if (!eventsLoaded || seeding) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white border border-slate-200 rounded-xl p-6 max-w-md w-full text-center space-y-2">
          <p className="text-sm font-medium text-slate-900">
            {seeding
              ? 'Importation du déroulement initial (CSV)...'
              : 'Chargement des événements partagés...'}
          </p>
          <p className="text-xs text-slate-500">
            Synchronisation en temps réel avec votre équipe.
          </p>
        </div>
      </div>
    );
  }

  // Signed in, no events accessible yet
  if (!activeEvent) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between gap-8">
          <span className="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0">
            ChronoPlan
          </span>
          <div className="flex items-center gap-4">
            <span className="text-xs font-mono text-slate-500">{user.email}</span>
            <button
              type="button"
              onClick={() => signOut(auth)}
              className="text-xs font-medium text-slate-600 hover:text-slate-900"
            >
              Déconnexion
            </button>
          </div>
        </header>

        <main className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-lg w-full bg-white border border-slate-200 rounded-xl p-8 space-y-5">
            <h1 className="font-display text-xl font-bold text-slate-900">
              Aucun événement partagé pour {user.email}
            </h1>
            <p className="text-sm text-slate-600 leading-relaxed">
              Si vous souhaitez rejoindre le planning d’un collègue, demandez-lui
              d’ajouter votre courriel (<span className="font-mono">{user.email}</span>)
              dans le menu <strong>Équipe</strong>. Sinon, créez votre propre planificateur :
            </p>
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                type="button"
                onClick={handleSeedFromBundledCsv}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
              >
                Charger le modèle CSV Relais 2026
              </button>
              <button
                type="button"
                onClick={handleCreateBlankEvent}
                className="px-4 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
              >
                Événement vierge
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  const currentUserEmail = user.email?.toLowerCase() || '';
  const isOwnerOrAdmin =
    activeEvent.ownerId === user.uid ||
    currentUserEmail === activeEvent.ownerEmail.toLowerCase() ||
    currentUserEmail === 'yvespoulette@live.ca';

  const currentUserRole: TeamRole = isOwnerOrAdmin
    ? 'admin'
    : (activeEvent.teamRoles?.[currentUserEmail] || 'editeur');

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top Bar: Strict 3-zone contract */}
      <header className="bg-white border-b border-slate-200 px-4 sm:px-6 h-14 flex items-center justify-between gap-8 sticky top-0 z-30">
        {/* Zone 1: Brand Wordmark */}
        <button
          type="button"
          onClick={() => setSelectedActivityId(null)}
          className="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 text-left"
        >
          ChronoPlan
        </button>

        {/* Zone 2: Concise single-line nav links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
          <button
            type="button"
            onClick={() => {
              setActivePage('liste');
              setSelectedActivityId(null);
            }}
            className={`whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors ${
              !selectedActivity && activePage === 'liste'
                ? 'text-slate-900 border-blue-600'
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            Liste simple
          </button>
          <button
            type="button"
            onClick={() => {
              setActivePage('texte');
              setSelectedActivityId(null);
            }}
            className={`whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors ${
              !selectedActivity && activePage === 'texte'
                ? 'text-slate-900 border-blue-600'
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            Texte complet
          </button>
          <button
            type="button"
            onClick={() => setShowResourcesModal(true)}
            className="whitespace-nowrap shrink-0 py-1 border-b-2 border-transparent hover:text-slate-900 transition-colors"
          >
            Ressources & blocs
          </button>
          <button
            type="button"
            onClick={() => setShowTeamModal(true)}
            className="whitespace-nowrap shrink-0 py-1 border-b-2 border-transparent hover:text-slate-900 transition-colors"
          >
            Équipe
          </button>
          <button
            type="button"
            onClick={() => setShowImportModal(true)}
            className="whitespace-nowrap shrink-0 py-1 border-b-2 border-transparent hover:text-slate-900 transition-colors"
          >
            Importer CSV
          </button>
        </nav>

        {/* Zone 3: 1 Primary Action */}
        <div className="shrink-0">
          {(currentUserRole === 'admin' || currentUserRole === 'editeur') && (
            <button
              type="button"
              onClick={() =>
                setNewModalConfig({
                  open: true,
                  defaultStep:
                    filterStep !== 'ALL' && filterStep !== 'UNSET'
                      ? Number(filterStep)
                      : 0,
                  defaultEtape:
                    filterEtape !== 'ALL'
                      ? filterEtape
                      : activeEvent.etapes[0] || '',
                  defaultDependsOnId: null,
                })
              }
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap shrink-0 shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              Nouvelle activité
            </button>
          )}
        </div>
      </header>

      {/* Main Content */}
      {selectedActivity ? (
        <main className="flex-1">
          <ActivityDetailPage
            event={activeEvent}
            userRole={currentUserRole}
            allActivities={computedActivities}
            activity={selectedActivity}
            previousActivity={
              selectedActivityIndex > 0
                ? computedActivities[selectedActivityIndex - 1]
                : null
            }
            nextActivity={
              selectedActivityIndex < computedActivities.length - 1
                ? computedActivities[selectedActivityIndex + 1]
                : null
            }
            positionIndex={selectedActivityIndex}
            totalCount={computedActivities.length}
            onBack={() => setSelectedActivityId(null)}
            onNavigate={(id) => setSelectedActivityId(id)}
            onUpdate={handleUpdateActivity}
            onDelete={handleDeleteActivity}
            onAddResource={handleAddResource}
            onAddEtape={handleAddEtape}
          />
        </main>
      ) : (
        <main
          className={`flex-1 w-full mx-auto px-4 sm:px-6 py-5 space-y-5 ${
            activePage === 'texte' ? 'max-w-[1640px]' : 'max-w-[1440px]'
          }`}
        >
          {/* Workspace Header Toolbar */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-4 min-w-0 flex-1">
                {events.length > 1 && (
                  <select
                    value={activeEvent.id}
                    onChange={(e) => setSelectedEventId(e.target.value)}
                    className="px-2.5 py-1.5 text-xs font-medium border border-slate-200 rounded-lg bg-slate-50 text-slate-800"
                    aria-label="Choisir l'événement"
                  >
                    {events.map((ev) => (
                      <option key={ev.id} value={ev.id}>
                        {ev.title}
                      </option>
                    ))}
                  </select>
                )}

                <input
                  type="text"
                  value={titleDraft}
                  onChange={(e) => setTitleDraft(e.target.value)}
                  onBlur={() => {
                    const trimmed = titleDraft.trim();
                    if (trimmed && trimmed !== activeEvent.title) {
                      updateEventMetadata(activeEvent.id, { title: trimmed });
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') e.currentTarget.blur();
                  }}
                  aria-label="Titre de l'événement"
                  className="font-display text-lg font-bold text-slate-900 bg-transparent border border-transparent hover:border-slate-200 focus:border-blue-600 focus:bg-slate-50 rounded-md px-2 py-1 min-w-[260px] flex-1 max-w-xl focus:outline-none"
                />

                <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg">
                  <Calendar className="w-4 h-4 text-blue-600 shrink-0" />
                  <span className="text-xs font-medium text-slate-600 whitespace-nowrap">
                    Date de l’événement (Step 0) :
                  </span>
                  <input
                    type="date"
                    value={activeEvent.eventDate}
                    onChange={(e) => {
                      if (e.target.value) {
                        updateEventMetadata(activeEvent.id, {
                          eventDate: e.target.value,
                        });
                      }
                    }}
                    className="text-xs font-mono font-medium text-slate-900 bg-transparent focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() =>
                    exportActivitiesToExcel(
                      computedActivities,
                      activeEvent.title,
                      activeEvent.eventDate,
                      false,
                      activeEvent.etapeDetails
                    )
                  }
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 whitespace-nowrap shrink-0"
                >
                  <Download className="w-3.5 h-3.5 text-slate-500" />
                  Excel simple
                </button>
                <button
                  type="button"
                  onClick={() =>
                    exportActivitiesToExcel(
                      computedActivities,
                      activeEvent.title,
                      activeEvent.eventDate,
                      true,
                      activeEvent.etapeDetails
                    )
                  }
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-900 bg-slate-100 border border-slate-200 rounded-lg hover:bg-slate-200/80 whitespace-nowrap shrink-0"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-blue-600" />
                  Excel avec texte
                </button>

                <div className="h-5 w-px bg-slate-200 mx-1 hidden sm:block" />

                <button
                  type="button"
                  onClick={() => setShowTeamModal(true)}
                  className="flex items-center gap-1.5 px-2.5 py-2 text-xs text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-50 whitespace-nowrap"
                  title="Gérer les accès de l'équipe"
                >
                  <Users className="w-3.5 h-3.5" />
                  <span className="font-mono tabular-nums">
                    {activeEvent.teamEmails.length}
                  </span>
                </button>

                <div className="flex items-center gap-1.5">
                  <span
                    className={`hidden sm:inline-flex items-center px-2 py-0.5 text-[11px] font-semibold rounded-md border ${
                      currentUserRole === 'admin'
                        ? 'bg-amber-50 text-amber-800 border-amber-200'
                        : currentUserRole === 'editeur'
                        ? 'bg-blue-50 text-blue-800 border-blue-200'
                        : currentUserRole === 'reviseur'
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        : 'bg-slate-50 text-slate-700 border-slate-200'
                    }`}
                    title={`Votre rôle : ${currentUserRole}`}
                  >
                    {currentUserRole === 'admin'
                      ? 'Admin'
                      : currentUserRole === 'editeur'
                      ? 'Éditeur'
                      : currentUserRole === 'reviseur'
                      ? 'Réviseur'
                      : 'Lecteur'}
                  </span>
                  <button
                    type="button"
                    onClick={() => signOut(auth)}
                    title={`Connecté : ${user.email} (${currentUserRole}) — Se déconnecter`}
                    className="flex items-center gap-1.5 px-2.5 py-2 text-xs text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-50 whitespace-nowrap"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span className="hidden xl:inline max-w-[140px] truncate">
                      {user.email}
                    </span>
                  </button>
                </div>
              </div>
            </div>

            {/* Mobile Nav Fallback */}
            <div className="flex md:hidden items-center gap-2 pt-2 border-t border-slate-100 overflow-x-auto">
              <button
                type="button"
                onClick={() => setActivePage('liste')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap ${
                  activePage === 'liste'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 text-slate-700'
                }`}
              >
                Liste simple
              </button>
              <button
                type="button"
                onClick={() => setActivePage('texte')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap ${
                  activePage === 'texte'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 text-slate-700'
                }`}
              >
                Texte complet
              </button>
              <button
                type="button"
                onClick={() => setShowResourcesModal(true)}
                className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 rounded-md whitespace-nowrap"
              >
                Ressources & blocs
              </button>
              <button
                type="button"
                onClick={() => setShowTeamModal(true)}
                className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 rounded-md whitespace-nowrap"
              >
                Équipe
              </button>
              <button
                type="button"
                onClick={() => setShowImportModal(true)}
                className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 rounded-md whitespace-nowrap"
              >
                Importer CSV
              </button>
            </div>

            {/* Filter & Grouping Bar */}
            <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-slate-100">
              <div className="flex items-center p-0.5 bg-slate-100 rounded-lg shrink-0">
                <button
                  type="button"
                  onClick={() => setViewMode('bloc')}
                  className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                    viewMode === 'bloc'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  Par bloc
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('chronologique')}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                    viewMode === 'chronologique'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Chronologique
                </button>
              </div>

              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Rechercher une activité, un responsable ou du texte..."
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <select
                value={filterStep}
                onChange={(e) => setFilterStep(e.target.value)}
                aria-label="Filtrer par jour / Step"
                className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                <option value="ALL">Tous les jours (Step)</option>
                {availableSteps.map((s) => (
                  <option key={s.key} value={s.key}>
                    Step {s.label}
                  </option>
                ))}
              </select>

              <select
                value={filterEtape}
                onChange={(e) => setFilterEtape(e.target.value)}
                aria-label="Filtrer par bloc"
                className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                <option value="ALL">Tous les blocs</option>
                {activeEvent.etapes.map((et) => {
                  const detail = getEtapeDisplay(et, activeEvent.etapeDetails);
                  return (
                    <option key={et} value={et}>
                      {detail.title ? `${et} — ${detail.title}` : et}
                    </option>
                  );
                })}
              </select>

              <select
                value={filterResource}
                onChange={(e) => setFilterResource(e.target.value)}
                aria-label="Filtrer par ressource"
                className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                <option value="ALL">Toutes les ressources</option>
                {activeEvent.resources.map((res) => (
                  <option key={res} value={res}>
                    {res}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => setFilterCorrectionOnly((prev) => !prev)}
                aria-pressed={filterCorrectionOnly}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 ${
                  filterCorrectionOnly
                    ? 'bg-amber-600 text-white border-amber-600'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-amber-50/70 hover:border-amber-300'
                }`}
              >
                <span>À corriger</span>
                <span
                  className={`font-mono tabular-nums ${
                    filterCorrectionOnly ? 'text-amber-100' : 'text-slate-500'
                  }`}
                >
                  ({correctionCount})
                </span>
              </button>

              <div className="text-xs text-slate-500 font-mono tabular-nums ml-auto">
                {visibleActivities.length} / {computedActivities.length} activités
              </div>
            </div>
          </div>

          {/* Schedule Table or Compact Full-Text Page */}
          {!activitiesLoaded ? (
            <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-sm text-slate-500">
              Chargement des activités...
            </div>
          ) : activePage === 'texte' ? (
            <CompactFullTextView
              event={activeEvent}
              userRole={currentUserRole}
              allActivities={computedActivities}
              visibleActivities={visibleActivities}
              allActivitiesCount={computedActivities.length}
              viewMode={viewMode}
              hasActiveFilters={hasActiveFilters}
              onOpenDetail={(id) => setSelectedActivityId(id)}
              onUpdateActivity={handleUpdateActivity}
            />
          ) : (
            <ScheduleTable
              event={activeEvent}
              userRole={currentUserRole}
              allActivities={computedActivities}
              visibleActivities={visibleActivities}
              allActivitiesCount={computedActivities.length}
              viewMode={viewMode}
              hasActiveFilters={hasActiveFilters}
              pendingTimeEditId={pendingTimeEditId}
              onClearPendingTimeEdit={() => setPendingTimeEditId(null)}
              onOpenDetail={(id) => setSelectedActivityId(id)}
              onUpdateActivity={handleUpdateActivity}
              onDeleteActivity={handleDeleteActivity}
              onUpdateBlocDetail={handleUpdateBlocDetail}
              onAddActivityInBloc={(etapeKey, defaultStep, suggestedNextTime) =>
                setNewModalConfig({
                  open: true,
                  defaultStep,
                  defaultEtape: etapeKey,
                  defaultDependsOnId: null,
                  suggestedNextTime,
                })
              }
              onReorderDrop={handleReorderDrop}
              onDropToBloc={handleDropToBloc}
              onAddResource={handleAddResource}
              onAddEtape={handleAddEtape}
              onCreateFirst={() =>
                setNewModalConfig({
                  open: true,
                  defaultStep: 0,
                  defaultEtape: activeEvent.etapes[0] || 'Bloc 00',
                  defaultDependsOnId: null,
                })
              }
            />
          )}
        </main>
      )}

      {/* Modals */}
      {showResourcesModal && (
        <ResourcesModal
          event={activeEvent}
          onUpdateResources={(next) =>
            updateEventMetadata(activeEvent.id, { resources: next })
          }
          onUpdateEtapes={(next, nextDetails) =>
            updateEventMetadata(activeEvent.id, {
              etapes: next,
              ...(nextDetails !== undefined ? { etapeDetails: nextDetails } : {}),
            })
          }
          onClose={() => setShowResourcesModal(false)}
        />
      )}

      {showTeamModal && (
        <TeamModal
          event={activeEvent}
          currentUserEmail={user.email || ''}
          isOwnerOrAdmin={isOwnerOrAdmin}
          onSaveTeam={(nextEmails, nextRoles) =>
            updateTeamAccess(activeEvent, activities, nextEmails, nextRoles)
          }
          onClose={() => setShowTeamModal(false)}
        />
      )}

      {showImportModal && (
        <ImportCsvModal
          currentEventDate={activeEvent.eventDate}
          onReplaceCurrent={handleReplaceCsv}
          onCreateNewEvent={handleCreateNewEventFromCsv}
          onClose={() => setShowImportModal(false)}
        />
      )}

      {newModalConfig.open && (
        <NewActivityModal
          event={activeEvent}
          allActivities={computedActivities}
          defaultStep={newModalConfig.defaultStep}
          defaultEtape={newModalConfig.defaultEtape}
          defaultDependsOnId={newModalConfig.defaultDependsOnId}
          suggestedNextTime={newModalConfig.suggestedNextTime}
          onAddResource={handleAddResource}
          onAddEtape={handleAddEtape}
          onCreate={handleCreateActivity}
          onClose={() => setNewModalConfig((prev) => ({ ...prev, open: false }))}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <PlannerApp />
    </ErrorBoundary>
  );
}