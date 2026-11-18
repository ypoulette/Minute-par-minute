import type {
  ActivityItem,
  BlocGroup,
  ComputedActivity,
  EtapeDetail,
} from '../types/planner';
import { getEtapeDisplay } from './etapeDefaults';

export function computeActivityDate(eventDate: string, step: number | null): string {
  if (step === null || Number.isNaN(step)) {
    return 'À planifier';
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) {
    return 'Date invalide';
  }
  const [y, m, d] = eventDate.split('-').map(Number);
  const utc = Date.UTC(y, m - 1, d + step);
  const dt = new Date(utc);
  const yyyy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function diffDaysBetweenDates(targetDate: string, baseDate: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate) || !/^\d{4}-\d{2}-\d{2}$/.test(baseDate)) {
    return null;
  }
  const [ty, tm, td] = targetDate.split('-').map(Number);
  const [by, bm, bd] = baseDate.split('-').map(Number);
  const targetMs = Date.UTC(ty, tm - 1, td);
  const baseMs = Date.UTC(by, bm - 1, bd);
  return Math.round((targetMs - baseMs) / 86400000);
}

export function parseTimeToMinutes(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/^(\d{1,2})[:hH](\d{2})$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const mins = Number(match[2]);
  if (hours < 0 || hours > 47 || mins < 0 || mins > 59) return null;
  return hours * 60 + mins;
}

export function formatMinutesToHHMM(totalMinutes: number): string {
  const normalized = ((Math.round(totalMinutes) % 1440) + 1440) % 1440;
  const h = Math.floor(normalized / 60);
  const m = normalized % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function getSortWeightMinutes(raw: string, exactMinutes: number | null): number {
  if (exactMinutes !== null) return exactMinutes;
  const upper = raw.trim().toUpperCase();
  if (upper === 'AM') return 6 * 60;
  if (upper === 'PM') return 13 * 60;
  return 24 * 60 + 1;
}

export function normalizeTimeInput(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  const upper = trimmed.toUpperCase();
  if (upper === 'AM' || upper === 'PM') return upper;
  const match = trimmed.match(/^(\d{1,2})[:hH](\d{2})$/);
  if (match) {
    const h = Number(match[1]);
    const m = Number(match[2]);
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }
  }
  return trimmed.slice(0, 20);
}

export function resolveActivityExecutants(item: Pick<ActivityItem, 'executant' | 'executants'>): string[] {
  if (Array.isArray(item.executants)) {
    return item.executants.map((s) => s.trim()).filter(Boolean);
  }
  const single = (item.executant || '').trim();
  return single ? [single] : [];
}

function getEtapeRank(etape: string, etapesOrder: string[]): number {
  if (!etape) return 999999;
  const idx = etapesOrder.indexOf(etape);
  if (idx >= 0) return idx;
  return 500000;
}

/**
 * Checks whether assigning `candidateParentId` as parent of `activityId` would create a cycle.
 */
export function wouldCreateDependencyCycle(
  activities: ActivityItem[],
  activityId: string,
  candidateParentId: string
): boolean {
  if (activityId === candidateParentId) return true;
  const byId = new Map(activities.map((a) => [a.id, a]));
  let curr: string | null | undefined = candidateParentId;
  const visited = new Set<string>([activityId]);
  while (curr) {
    if (visited.has(curr)) return true;
    visited.add(curr);
    curr = byId.get(curr)?.dependsOnId;
  }
  return false;
}

/**
 * Returns the ordered list of IDs containing `rootId` followed by all of its transitive
 * dependent sub-activities (in DFS display order).
 */
export function collectDependentSubtreeIds(
  computedActivities: ComputedActivity[],
  rootId: string
): string[] {
  const result: string[] = [rootId];
  const included = new Set<string>([rootId]);

  for (const act of computedActivities) {
    if (act.id !== rootId && act.parentId && included.has(act.parentId)) {
      result.push(act.id);
      included.add(act.id);
    }
  }
  return result;
}

/**
 * Computes dates, dependency hierarchies (with cycle protection), cascading times,
 * WBS numbering, and tree connector metadata grouped by block.
 */
export function computeSchedule(
  activities: ActivityItem[],
  eventDate: string,
  etapesOrder: string[] = []
): ComputedActivity[] {
  const buckets = new Map<string, ActivityItem[]>();
  for (const act of activities) {
    const key = act.etape || '';
    const arr = buckets.get(key);
    if (arr) {
      arr.push(act);
    } else {
      buckets.set(key, [act]);
    }
  }

  const sortedKeys = Array.from(buckets.keys()).sort((a, b) => {
    const ra = getEtapeRank(a, etapesOrder);
    const rb = getEtapeRank(b, etapesOrder);
    if (ra !== rb) return ra - rb;
    return a.localeCompare(b, 'fr', { numeric: true });
  });

  const allComputed: ComputedActivity[] = [];

  for (const key of sortedKeys) {
    const items = buckets.get(key) || [];
    const byId = new Map(items.map((it) => [it.id, it]));

    // Pre-sort inside block by (step, orderIndex) so fallback sequential links resolve reliably
    const seqOrdered = [...items].sort((a, b) => {
      const stepA = a.step ?? 99999;
      const stepB = b.step ?? 99999;
      if (stepA !== stepB) return stepA - stepB;
      return a.orderIndex - b.orderIndex;
    });

    // Resolve parent pointer for each item inside the block
    const resolvedParentMap = new Map<string, string | null>();
    for (let i = 0; i < seqOrdered.length; i++) {
      const item = seqOrdered[i];
      if (item.horaireMode !== 'dependant') {
        resolvedParentMap.set(item.id, null);
        continue;
      }

      if (item.dependsOnId && byId.has(item.dependsOnId) && item.dependsOnId !== item.id) {
        // Cycle guard
        let cur: string | null | undefined = item.dependsOnId;
        const seen = new Set<string>([item.id]);
        let hasCycle = false;
        while (cur) {
          if (seen.has(cur)) {
            hasCycle = true;
            break;
          }
          seen.add(cur);
          const p = byId.get(cur);
          cur = p?.horaireMode === 'dependant' ? p.dependsOnId : null;
        }
        resolvedParentMap.set(item.id, hasCycle ? null : item.dependsOnId);
      } else if (!item.dependsOnId && i > 0 && seqOrdered[i - 1].step === item.step) {
        // Legacy sequential dependency fallback
        resolvedParentMap.set(item.id, seqOrdered[i - 1].id);
      } else {
        resolvedParentMap.set(item.id, null);
      }
    }

    // Build children lists
    const childrenMap = new Map<string, ActivityItem[]>();
    const roots: ActivityItem[] = [];
    for (const item of seqOrdered) {
      const pid = resolvedParentMap.get(item.id);
      if (pid) {
        const arr = childrenMap.get(pid);
        if (arr) arr.push(item);
        else childrenMap.set(pid, [item]);
      } else {
        roots.push(item);
      }
    }

    // Sort roots chronologically by (step, manual sortMinutes, orderIndex)
    roots.sort((a, b) => {
      const stepA = a.step ?? 99999;
      const stepB = b.step ?? 99999;
      if (stepA !== stepB) return stepA - stepB;
      const exactA = parseTimeToMinutes(a.horaireManuel);
      const exactB = parseTimeToMinutes(b.horaireManuel);
      const sortA = getSortWeightMinutes(a.horaireManuel, exactA);
      const sortB = getSortWeightMinutes(b.horaireManuel, exactB);
      if (sortA !== sortB) return sortA - sortB;
      return a.orderIndex - b.orderIndex;
    });

    // Helper to count transitive descendants
    const countDescendants = (id: string): number => {
      const kids = childrenMap.get(id) || [];
      let total = kids.length;
      for (const k of kids) total += countDescendants(k.id);
      return total;
    };

    const blockResult: ComputedActivity[] = [];

    const visitNode = (
      item: ActivityItem,
      parentComputed: ComputedActivity | null,
      depth: number,
      wbsCode: string,
      hasNextSibling: boolean,
      ancestorHasNextSibling: boolean[]
    ) => {
      const computedDate = computeActivityDate(eventDate, item.step);
      const duree = Math.max(0, Math.round(item.dureeMinutes || 0));

      let computedMinutes: number | null = null;
      let computedHoraire = '—';
      let sortMinutes = 24 * 60 + 1;
      let isCascadeWarning = false;

      if (item.horaireMode === 'dependant' && parentComputed) {
        if (parentComputed.computedEndMinutes !== null) {
          computedMinutes = parentComputed.computedEndMinutes;
          computedHoraire = formatMinutesToHHMM(computedMinutes);
          sortMinutes = computedMinutes;
        } else {
          computedMinutes = null;
          computedHoraire = parentComputed.computedHoraire;
          sortMinutes = parentComputed.sortMinutes;
          isCascadeWarning = true;
        }
      } else {
        const parsed = parseTimeToMinutes(item.horaireManuel);
        if (parsed !== null) {
          computedMinutes = parsed;
          computedHoraire = formatMinutesToHHMM(parsed);
          sortMinutes = parsed;
        } else {
          computedMinutes = null;
          computedHoraire = item.horaireManuel.trim() || '—';
          sortMinutes = getSortWeightMinutes(item.horaireManuel, null);
          if (item.horaireMode === 'dependant') {
            isCascadeWarning = true;
          }
        }
      }

      const computedEndMinutes = computedMinutes !== null ? computedMinutes + duree : null;
      const computedEndHoraire =
        computedEndMinutes !== null && duree > 0 ? formatMinutesToHHMM(computedEndMinutes) : '';

      const nodeComputed: ComputedActivity = {
        ...item,
        computedDate,
        computedHoraire,
        computedMinutes,
        sortMinutes,
        computedEndHoraire,
        computedEndMinutes,
        isCascadeWarning,
        resolvedExecutants: resolveActivityExecutants(item),
        dependencyDepth: depth,
        parentId: parentComputed?.id ?? null,
        parentActivite: parentComputed?.activite ?? '',
        childCount: countDescendants(item.id),
        wbsCode,
        hasNextSibling,
        ancestorHasNextSibling,
      };

      blockResult.push(nodeComputed);

      const kids = (childrenMap.get(item.id) || []).sort(
        (a, b) => a.orderIndex - b.orderIndex
      );
      kids.forEach((child, idx) => {
        const childHasNext = idx < kids.length - 1;
        visitNode(
          child,
          nodeComputed,
          depth + 1,
          `${wbsCode}.${idx + 1}`,
          childHasNext,
          depth > 0 ? [...ancestorHasNextSibling, hasNextSibling] : ancestorHasNextSibling
        );
      });
    };

    roots.forEach((root, rIdx) => {
      visitNode(root, null, 0, String(rIdx + 1), false, []);
    });

    allComputed.push(...blockResult);
  }

  return allComputed;
}

export function groupActivitiesByBloc(
  activities: ComputedActivity[],
  etapesOrder: string[],
  etapeDetails?: Record<string, EtapeDetail>,
  includeEmptyBlocks = true
): BlocGroup[] {
  const buckets = new Map<string, ComputedActivity[]>();
  if (includeEmptyBlocks) {
    for (const et of etapesOrder) {
      buckets.set(et, []);
    }
  }
  for (const act of activities) {
    const key = act.etape || '';
    const arr = buckets.get(key);
    if (arr) {
      arr.push(act);
    } else {
      buckets.set(key, [act]);
    }
  }

  const keys = Array.from(buckets.keys()).sort((a, b) => {
    const ra = getEtapeRank(a, etapesOrder);
    const rb = getEtapeRank(b, etapesOrder);
    if (ra !== rb) return ra - rb;
    return a.localeCompare(b, 'fr', { numeric: true });
  });

  return keys.map((key) => {
    const list = buckets.get(key) || [];
    const display =
      key === ''
        ? { title: 'Sans bloc', description: 'Activités non rattachées à un bloc' }
        : getEtapeDisplay(key, etapeDetails);

    let timeRangeLabel = '';
    if (list.length > 0) {
      const first = list[0];
      const last = list[list.length - 1];
      if (first.computedDate === last.computedDate) {
        const start = first.computedHoraire !== '—' ? first.computedHoraire : '';
        const end =
          last.computedEndHoraire ||
          (last.computedHoraire !== '—' ? last.computedHoraire : '');
        if (start && end && start !== end) {
          timeRangeLabel = `${first.computedDate} · ${start} → ${end}`;
        } else if (start) {
          timeRangeLabel = `${first.computedDate} · ${start}`;
        } else {
          timeRangeLabel = first.computedDate;
        }
      } else {
        timeRangeLabel = `${first.computedDate} → ${last.computedDate}`;
      }
    }

    return {
      etapeKey: key,
      title: display.title,
      description: display.description,
      activities: list,
      timeRangeLabel,
    };
  });
}

export function formatDurationLabel(minutes: number): string {
  if (!minutes || minutes <= 0) return '0 min';
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, '0')}`;
}
