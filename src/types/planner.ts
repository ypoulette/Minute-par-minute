import type { Timestamp } from 'firebase/firestore';

export type HoraireMode = 'manuel' | 'dependant';

export type TeamRole = 'admin' | 'editeur' | 'reviseur' | 'lecteur';

export interface EtapeDetail {
  title: string;
  description: string;
}

export interface EventPlan {
  id: string;
  title: string;
  eventDate: string; // YYYY-MM-DD
  ownerId: string;
  ownerEmail: string;
  teamEmails: string[];
  teamRoles?: Record<string, TeamRole>;
  resources: string[];
  etapes: string[];
  etapeDetails?: Record<string, EtapeDetail>;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface ActivityItem {
  id: string;
  eventId: string;
  ownerId: string;
  teamEmails: string[];
  step: number | null;
  etape: string;
  horaireMode: HoraireMode;
  horaireManuel: string;
  dureeMinutes: number;
  orderIndex: number;
  activite: string;
  responsable: string;
  executant: string;
  executants?: string[];
  dependsOnId?: string | null;
  needsCorrection?: boolean;
  commentaires?: string; // Remarques / ajouts / modifications demandées par les réviseurs
  texte: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface ComputedActivity extends ActivityItem {
  computedDate: string; // YYYY-MM-DD or 'À planifier'
  computedHoraire: string; // '16:30', 'AM', 'PM', '—'
  computedMinutes: number | null; // exact minutes from 00:00 if HH:MM
  sortMinutes: number; // numeric weight for sorting (AM=360, PM=780, unset=1440)
  computedEndHoraire: string; // '16:45' or ''
  computedEndMinutes: number | null;
  isCascadeWarning: boolean; // true if dependant on an activity without exact HH:MM
  resolvedExecutants: string[];
  dependencyDepth: number; // 0 = root, 1 = sub-activity, 2 = sub-sub-activity...
  parentId: string | null;
  parentActivite: string;
  childCount: number; // number of transitive dependent sub-activities
  wbsCode: string; // e.g. '1', '2', '2.1', '2.2'
  hasNextSibling: boolean;
  ancestorHasNextSibling: boolean[];
}

export interface BlocGroup {
  etapeKey: string;
  title: string;
  description: string;
  activities: ComputedActivity[];
  timeRangeLabel: string;
}
