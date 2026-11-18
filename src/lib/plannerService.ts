import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import type { ActivityItem, EtapeDetail, EventPlan, HoraireMode, TeamRole } from '../types/planner';
import type { ParsedCsvPlan } from '../utils/csvImporter';
import { db, handleFirestoreError, OperationType } from './firebase';

function makeSafeId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 10);
  const ts = Date.now().toString(36);
  return `${prefix}_${ts}_${rand}`.replace(/[^a-zA-Z0-9_-]/g, '');
}

export function sanitizeStep(step: number | null | undefined): number | null {
  if (step === null || step === undefined || Number.isNaN(Number(step))) return null;
  return Math.max(-365, Math.min(365, Math.round(Number(step))));
}

export function sanitizeDuration(mins: number | undefined): number {
  if (mins === undefined || Number.isNaN(Number(mins))) return 0;
  return Math.max(0, Math.min(1440, Math.round(Number(mins))));
}

export function sanitizeExecutants(
  executants: string[] | undefined,
  fallbackSingle?: string
): { executants: string[]; executant: string } {
  const list = Array.isArray(executants)
    ? Array.from(new Set(executants.map((e) => e.trim().slice(0, 120)).filter(Boolean))).slice(0, 20)
    : (fallbackSingle ?? '').trim()
    ? [(fallbackSingle ?? '').trim().slice(0, 120)]
    : [];
  return {
    executants: list,
    executant: list.join(', ').slice(0, 500),
  };
}

export function sanitizeActivityFields(input: Partial<ActivityItem>): {
  step: number | null;
  etape: string;
  horaireMode: HoraireMode;
  horaireManuel: string;
  dureeMinutes: number;
  orderIndex: number;
  activite: string;
  responsable: string;
  executant: string;
  executants: string[];
  dependsOnId: string | null;
  needsCorrection: boolean;
  commentaires: string;
  texte: string;
} {
  const exec = sanitizeExecutants(input.executants, input.executant);
  const depId =
    typeof input.dependsOnId === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(input.dependsOnId)
      ? input.dependsOnId
      : null;

  return {
    step: sanitizeStep(input.step),
    etape: (input.etape ?? '').trim().slice(0, 120),
    horaireMode: input.horaireMode === 'dependant' ? 'dependant' : 'manuel',
    horaireManuel: (input.horaireManuel ?? '').trim().slice(0, 20),
    dureeMinutes: sanitizeDuration(input.dureeMinutes),
    orderIndex: typeof input.orderIndex === 'number' && Number.isFinite(input.orderIndex) ? input.orderIndex : 1000,
    activite: (input.activite ?? '').trim().slice(0, 1000) || 'Nouvelle activité',
    responsable: (input.responsable ?? '').trim().slice(0, 120),
    executant: exec.executant,
    executants: exec.executants,
    dependsOnId: depId,
    needsCorrection: Boolean(input.needsCorrection),
    commentaires: (input.commentaires ?? '').slice(0, 50000),
    texte: (input.texte ?? '').slice(0, 50000),
  };
}

export function subscribeUserEvents(
  userEmail: string,
  onData: (events: EventPlan[]) => void
): Unsubscribe {
  const emailLower = userEmail.toLowerCase();
  const path = 'events';
  const q = query(collection(db, path), where('teamEmails', 'array-contains', emailLower));

  return onSnapshot(
    q,
    (snapshot) => {
      const list: EventPlan[] = snapshot.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<EventPlan, 'id'>),
      }));
      onData(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export function subscribeEventActivities(
  eventId: string,
  userEmail: string,
  onData: (activities: ActivityItem[]) => void
): Unsubscribe {
  const emailLower = userEmail.toLowerCase();
  const path = `events/${eventId}/activities`;
  const q = query(collection(db, path), where('teamEmails', 'array-contains', emailLower));

  return onSnapshot(
    q,
    (snapshot) => {
      const list: ActivityItem[] = snapshot.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<ActivityItem, 'id'>),
      }));
      onData(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export async function createEventWithCsv(
  userUid: string,
  userEmail: string,
  title: string,
  parsed: ParsedCsvPlan
): Promise<string> {
  const eventId = makeSafeId('evt');
  const emailLower = userEmail.toLowerCase();
  const teamEmails = [emailLower];
  const eventPath = `events/${eventId}`;

  const safeTitle = title.trim().slice(0, 160) || 'Relais pour la vie 2026';
  const safeDate = /^\d{4}-\d{2}-\d{2}$/.test(parsed.eventDate) ? parsed.eventDate : '2026-06-06';
  const safeResources = Array.from(new Set(parsed.resources.map((r) => r.trim().slice(0, 120)).filter(Boolean))).slice(0, 200);
  const safeEtapes = Array.from(new Set(parsed.etapes.map((e) => e.trim().slice(0, 120)).filter(Boolean))).slice(0, 50);
  const safeEtapeDetails = sanitizeEtapeDetails(parsed.etapeDetails);

  try {
    await setDoc(doc(db, 'events', eventId), {
      title: safeTitle,
      eventDate: safeDate,
      ownerId: userUid,
      ownerEmail: emailLower,
      teamEmails,
      teamRoles: { [emailLower]: 'admin' },
      resources: safeResources,
      etapes: safeEtapes,
      etapeDetails: safeEtapeDetails,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, eventPath);
  }

  // Batch create activities in chunks of 400
  const items = parsed.activities;
  for (let i = 0; i < items.length; i += 400) {
    const chunk = items.slice(i, i + 400);
    const batch = writeBatch(db);
    for (const item of chunk) {
      const actId = makeSafeId('act');
      const clean = sanitizeActivityFields(item);
      batch.set(doc(db, 'events', eventId, 'activities', actId), {
        eventId,
        ownerId: userUid,
        teamEmails,
        ...clean,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    try {
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `events/${eventId}/activities`);
    }
  }

  return eventId;
}

export async function replaceEventActivitiesFromCsv(
  event: EventPlan,
  existingActivities: ActivityItem[],
  parsed: ParsedCsvPlan
): Promise<void> {
  // 1. Delete existing activities in chunks
  for (let i = 0; i < existingActivities.length; i += 400) {
    const chunk = existingActivities.slice(i, i + 400);
    const batch = writeBatch(db);
    for (const act of chunk) {
      batch.delete(doc(db, 'events', event.id, 'activities', act.id));
    }
    try {
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `events/${event.id}/activities`);
    }
  }

  // 2. Update event metadata (date, merged resources & etapes)
  const mergedResources = Array.from(
    new Set([...event.resources, ...parsed.resources].map((r) => r.trim().slice(0, 120)).filter(Boolean))
  ).slice(0, 200);
  const mergedEtapes = Array.from(
    new Set([...event.etapes, ...parsed.etapes].map((e) => e.trim().slice(0, 120)).filter(Boolean))
  ).slice(0, 50);
  const mergedDetails = sanitizeEtapeDetails({
    ...(parsed.etapeDetails || {}),
    ...(event.etapeDetails || {}),
  });

  try {
    await updateDoc(doc(db, 'events', event.id), {
      eventDate: /^\d{4}-\d{2}-\d{2}$/.test(parsed.eventDate) ? parsed.eventDate : event.eventDate,
      resources: mergedResources,
      etapes: mergedEtapes,
      etapeDetails: mergedDetails,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `events/${event.id}`);
  }

  // 3. Create new activities in chunks
  for (let i = 0; i < parsed.activities.length; i += 400) {
    const chunk = parsed.activities.slice(i, i + 400);
    const batch = writeBatch(db);
    for (const item of chunk) {
      const actId = makeSafeId('act');
      const clean = sanitizeActivityFields(item);
      batch.set(doc(db, 'events', event.id, 'activities', actId), {
        eventId: event.id,
        ownerId: event.ownerId,
        teamEmails: event.teamEmails,
        ...clean,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    try {
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `events/${event.id}/activities`);
    }
  }
}

export function sanitizeEtapeDetails(
  details: Record<string, EtapeDetail> | undefined
): Record<string, EtapeDetail> {
  if (!details) return {};
  const entries = Object.entries(details).slice(0, 50);
  const out: Record<string, EtapeDetail> = {};
  for (const [k, v] of entries) {
    const cleanKey = k.trim().slice(0, 120);
    if (!cleanKey) continue;
    out[cleanKey] = {
      title: (v?.title ?? '').trim().slice(0, 120),
      description: (v?.description ?? '').trim().slice(0, 500),
    };
  }
  return out;
}

export async function updateEventMetadata(
  eventId: string,
  updates: Partial<Pick<EventPlan, 'title' | 'eventDate' | 'resources' | 'etapes' | 'etapeDetails'>>
): Promise<void> {
  const payload: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
  };
  if (updates.title !== undefined) {
    payload.title = updates.title.trim().slice(0, 160) || 'Événement';
  }
  if (updates.eventDate !== undefined && /^\d{4}-\d{2}-\d{2}$/.test(updates.eventDate)) {
    payload.eventDate = updates.eventDate;
  }
  if (updates.resources !== undefined) {
    payload.resources = Array.from(
      new Set(updates.resources.map((r) => r.trim().slice(0, 120)).filter(Boolean))
    ).slice(0, 200);
  }
  if (updates.etapes !== undefined) {
    payload.etapes = Array.from(
      new Set(updates.etapes.map((e) => e.trim().slice(0, 120)).filter(Boolean))
    ).slice(0, 50);
  }
  if (updates.etapeDetails !== undefined) {
    payload.etapeDetails = sanitizeEtapeDetails(updates.etapeDetails);
  }

  const path = `events/${eventId}`;
  try {
    await updateDoc(doc(db, 'events', eventId), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateTeamAccess(
  event: EventPlan,
  activities: ActivityItem[],
  nextTeamEmails: string[],
  nextTeamRoles?: Record<string, TeamRole>
): Promise<void> {
  const normalized = Array.from(
    new Set([
      event.ownerEmail.toLowerCase(),
      ...nextTeamEmails.map((e) => e.trim().toLowerCase()).filter((e) => e.includes('@')),
    ])
  ).slice(0, 50);

  const rolesPayload: Record<string, TeamRole> = {
    [event.ownerEmail.toLowerCase()]: 'admin',
  };
  if (nextTeamRoles) {
    for (const email of normalized) {
      if (email === event.ownerEmail.toLowerCase()) continue;
      rolesPayload[email] = nextTeamRoles[email] || 'editeur';
    }
  }

  try {
    await updateDoc(doc(db, 'events', event.id), {
      teamEmails: normalized,
      teamRoles: rolesPayload,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `events/${event.id}`);
  }

  for (let i = 0; i < activities.length; i += 400) {
    const chunk = activities.slice(i, i + 400);
    const batch = writeBatch(db);
    for (const act of chunk) {
      batch.update(doc(db, 'events', event.id, 'activities', act.id), {
        teamEmails: normalized,
        updatedAt: serverTimestamp(),
      });
    }
    try {
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `events/${event.id}/activities`);
    }
  }
}

export async function createActivity(
  event: EventPlan,
  input: Partial<ActivityItem>
): Promise<string> {
  const actId = makeSafeId('act');
  const clean = sanitizeActivityFields(input);
  const path = `events/${event.id}/activities/${actId}`;

  try {
    await setDoc(doc(db, 'events', event.id, 'activities', actId), {
      eventId: event.id,
      ownerId: event.ownerId,
      teamEmails: event.teamEmails,
      ...clean,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }

  return actId;
}

export async function updateActivity(
  eventId: string,
  activityId: string,
  updates: Partial<ActivityItem>
): Promise<void> {
  const payload: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
  };

  if (updates.step !== undefined) payload.step = sanitizeStep(updates.step);
  if (updates.etape !== undefined) payload.etape = updates.etape.trim().slice(0, 120);
  if (updates.horaireMode !== undefined) {
    payload.horaireMode = updates.horaireMode === 'dependant' ? 'dependant' : 'manuel';
  }
  if (updates.horaireManuel !== undefined) payload.horaireManuel = updates.horaireManuel.trim().slice(0, 20);
  if (updates.dureeMinutes !== undefined) payload.dureeMinutes = sanitizeDuration(updates.dureeMinutes);
  if (updates.orderIndex !== undefined && Number.isFinite(updates.orderIndex)) {
    payload.orderIndex = updates.orderIndex;
  }
  if (updates.activite !== undefined) {
    payload.activite = updates.activite.trim().slice(0, 1000) || 'Activité';
  }
  if (updates.responsable !== undefined) payload.responsable = updates.responsable.trim().slice(0, 120);
  if (updates.executants !== undefined) {
    const exec = sanitizeExecutants(updates.executants);
    payload.executants = exec.executants;
    payload.executant = exec.executant;
  } else if (updates.executant !== undefined) {
    const exec = sanitizeExecutants(undefined, updates.executant);
    payload.executants = exec.executants;
    payload.executant = exec.executant;
  }
  if (updates.dependsOnId !== undefined) {
    payload.dependsOnId =
      typeof updates.dependsOnId === 'string' &&
      /^[a-zA-Z0-9_-]{1,128}$/.test(updates.dependsOnId)
        ? updates.dependsOnId
        : null;
  }
  if (updates.needsCorrection !== undefined) {
    payload.needsCorrection = Boolean(updates.needsCorrection);
  }
  if (updates.commentaires !== undefined) payload.commentaires = updates.commentaires.slice(0, 50000);
  if (updates.texte !== undefined) payload.texte = updates.texte.slice(0, 50000);

  const path = `events/${eventId}/activities/${activityId}`;
  try {
    await updateDoc(doc(db, 'events', eventId, 'activities', activityId), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function batchUpdateActivitiesOrder(
  eventId: string,
  updates: Array<{
    id: string;
    orderIndex: number;
    step?: number | null;
    etape?: string;
    horaireManuel?: string;
    horaireMode?: HoraireMode;
    dependsOnId?: string | null;
  }>
): Promise<void> {
  for (let i = 0; i < updates.length; i += 400) {
    const chunk = updates.slice(i, i + 400);
    const batch = writeBatch(db);
    for (const u of chunk) {
      const payload: Record<string, unknown> = {
        orderIndex: u.orderIndex,
        updatedAt: serverTimestamp(),
      };
      if (u.step !== undefined) payload.step = sanitizeStep(u.step);
      if (u.etape !== undefined) payload.etape = u.etape.trim().slice(0, 120);
      if (u.horaireManuel !== undefined) payload.horaireManuel = u.horaireManuel.trim().slice(0, 20);
      if (u.horaireMode !== undefined) payload.horaireMode = u.horaireMode;
      if (u.dependsOnId !== undefined) {
        payload.dependsOnId =
          typeof u.dependsOnId === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(u.dependsOnId)
            ? u.dependsOnId
            : null;
      }

      batch.update(doc(db, 'events', eventId, 'activities', u.id), payload);
    }
    try {
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `events/${eventId}/activities`);
    }
  }
}

export async function deleteActivity(eventId: string, activityId: string): Promise<void> {
  const path = `events/${eventId}/activities/${activityId}`;
  try {
    await deleteDoc(doc(db, 'events', eventId, 'activities', activityId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}