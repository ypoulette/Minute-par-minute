import type { EtapeDetail, HoraireMode } from '../types/planner';
import { DEFAULT_ETAPE_DETAILS } from './etapeDefaults';
import { diffDaysBetweenDates, normalizeTimeInput, parseTimeToMinutes } from './scheduleEngine';

export interface ParsedCsvActivity {
  step: number | null;
  etape: string;
  horaireMode: HoraireMode;
  horaireManuel: string;
  dureeMinutes: number;
  orderIndex: number;
  activite: string;
  responsable: string;
  executant: string;
  texte: string;
}

export interface ParsedCsvPlan {
  eventDate: string;
  activities: ParsedCsvActivity[];
  resources: string[];
  etapes: string[];
  etapeDetails?: Record<string, EtapeDetail>;
}

/**
 * RFC-4180 style delimiter-aware CSV parser handling multi-line quoted cells and "" escapes.
 */
export function parseDelimitedRows(text: string, delimiter: string): string[][] {
  const clean = text.replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    const next = clean[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        currentField += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        currentField += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === delimiter) {
        currentRow.push(currentField);
        currentField = '';
      } else if (ch === '\r' && next === '\n') {
        currentRow.push(currentField);
        rows.push(currentRow);
        currentRow = [];
        currentField = '';
        i++;
      } else if (ch === '\n' || ch === '\r') {
        currentRow.push(currentField);
        rows.push(currentRow);
        currentRow = [];
        currentField = '';
      } else {
        currentField += ch;
      }
    }
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField);
    rows.push(currentRow);
  }

  return rows.filter((r) => r.some((cell) => cell.trim() !== ''));
}

function detectDelimiter(headerLine: string): string {
  const semiCount = (headerLine.match(/;/g) || []).length;
  const commaCount = (headerLine.match(/,/g) || []).length;
  return semiCount >= commaCount ? ';' : ',';
}

export function parseEventCsv(csvText: string, defaultEventDate = '2026-06-06'): ParsedCsvPlan {
  const firstLine = csvText.split(/\r?\n/)[0] || '';
  const delimiter = detectDelimiter(firstLine);
  const rows = parseDelimitedRows(csvText, delimiter);

  if (rows.length < 2) {
    return {
      eventDate: defaultEventDate,
      activities: [],
      resources: [],
      etapes: ['Bloc 00'],
    };
  }

  const headers = rows[0].map((h) => h.trim().toLowerCase());
  const findCol = (candidates: string[], fallback: number): number => {
    const idx = headers.findIndex((h) => candidates.some((c) => h === c || h.includes(c)));
    return idx >= 0 ? idx : fallback;
  };

  const colStep = findCol(['step'], 0);
  const colEtape = findCol(['étape', 'etape', 'bloc'], 1);
  const colDate = findCol(['date'], 2);
  const colHoraire = findCol(['horaire', 'heure'], 3);
  const colDuree = headers.findIndex((h) => h.includes('durée') || h.includes('duree'));
  const colMode = headers.findIndex((h) => h.includes('mode'));
  const colActivite = findCol(['activité', 'activite', 'description'], 4);
  const colResp = findCol(['responsable'], 5);
  const colExec = findCol(['exécutant', 'executant'], 6);
  const colTexte = headers.findIndex((h) => h.includes('texte') || h.includes('note'));

  // Determine eventDate (look for Step === '0' with a valid YYYY-MM-DD date, else default)
  let eventDate = defaultEventDate;
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const stepRaw = (r[colStep] || '').trim();
    const dateRaw = (r[colDate] || '').trim();
    if (stepRaw === '0' && /^\d{4}-\d{2}-\d{2}$/.test(dateRaw)) {
      eventDate = dateRaw;
      break;
    }
  }

  const resourceSet = new Set<string>();
  const etapeSet = new Set<string>();
  const rawParsed: ParsedCsvActivity[] = [];

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const stepRaw = (r[colStep] || '').trim();
    const etapeRaw = (r[colEtape] || '').trim();
    const dateRaw = (r[colDate] || '').trim();
    const horaireRaw = normalizeTimeInput((r[colHoraire] || '').trim());
    const activiteRaw = (r[colActivite] || '').trim();
    const respRaw = (r[colResp] || '').trim();
    const execRaw = (r[colExec] || '').trim();

    // Capture extra trailing note column from original Excel (col 7) or explicit Texte column
    const texteExplicit = colTexte >= 0 ? (r[colTexte] || '').trim() : '';
    const extraNotes =
      colTexte < 0
        ? r
            .slice(7)
            .map((c) => c.trim())
            .filter(Boolean)
            .join('\n')
        : '';
    const texteRaw = texteExplicit || extraNotes;

    if (!activiteRaw && !etapeRaw && !horaireRaw && !respRaw && !execRaw) {
      continue;
    }

    let step: number | null = null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateRaw)) {
      step = diffDaysBetweenDates(dateRaw, eventDate);
      // Adjust midnight Bloc 09 rows (00:00..00:59 labeled 2026-06-06 in source CSV) to day +1
      if (
        step === 0 &&
        etapeRaw.toLowerCase().includes('bloc 09') &&
        /^00:\d{2}$/.test(horaireRaw)
      ) {
        step = 1;
      }
    } else if (/^-?\d+$/.test(stepRaw)) {
      const n = parseInt(stepRaw, 10);
      if (n <= 0) step = n;
    }

    let horaireMode: HoraireMode = 'manuel';
    if (colMode >= 0) {
      const m = (r[colMode] || '').trim().toLowerCase();
      if (m.includes('dep') || m.includes('dép')) {
        horaireMode = 'dependant';
      }
    }

    let dureeMinutes = 5;
    if (colDuree >= 0) {
      const dNum = parseInt((r[colDuree] || '').replace(/[^\d]/g, ''), 10);
      if (!Number.isNaN(dNum) && dNum >= 0 && dNum <= 1440) {
        dureeMinutes = dNum;
      }
    } else if (horaireRaw === 'AM' || horaireRaw === 'PM' || horaireRaw === '') {
      dureeMinutes = 0;
    }

    const cleanActivite = activiteRaw || `(Activité à préciser${etapeRaw ? ` — ${etapeRaw}` : ''})`;

    if (respRaw) resourceSet.add(respRaw);
    if (execRaw) resourceSet.add(execRaw);
    if (etapeRaw) etapeSet.add(etapeRaw);

    rawParsed.push({
      step,
      etape: etapeRaw.slice(0, 120),
      horaireMode,
      horaireManuel: horaireRaw.slice(0, 20),
      dureeMinutes,
      orderIndex: i * 1000,
      activite: cleanActivite.slice(0, 1000),
      responsable: respRaw.slice(0, 120),
      executant: execRaw.slice(0, 120),
      texte: texteRaw.slice(0, 50000),
    });
  }

  // Sort chronologically by (step, sortMinutes, orderIndex) so initial sequence is clean
  rawParsed.sort((a, b) => {
    const sa = a.step ?? 99999;
    const sb = b.step ?? 99999;
    if (sa !== sb) return sa - sb;
    const ma = getCsvSortWeight(a.horaireManuel);
    const mb = getCsvSortWeight(b.horaireManuel);
    if (ma !== mb) return ma - mb;
    return a.orderIndex - b.orderIndex;
  });

  // Normalize orderIndex after sort
  rawParsed.forEach((item, idx) => {
    item.orderIndex = (idx + 1) * 1000;
  });

  const sortedEtapes = Array.from(etapeSet).sort((a, b) =>
    a.localeCompare(b, 'fr', { numeric: true })
  );
  const sortedResources = Array.from(resourceSet).sort((a, b) =>
    a.localeCompare(b, 'fr', { sensitivity: 'base' })
  );

  const etapeDetails: Record<string, EtapeDetail> = {};
  for (const et of sortedEtapes) {
    if (DEFAULT_ETAPE_DETAILS[et]) {
      etapeDetails[et] = { ...DEFAULT_ETAPE_DETAILS[et] };
    } else {
      const headerRow = rawParsed.find(
        (a) => a.etape === et && /^bloc\s+\d+\s*[-–=]/i.test(a.activite)
      );
      if (headerRow) {
        const afterDash = headerRow.activite.replace(/^bloc\s+\d+\s*[-–=]\s*/i, '').trim();
        etapeDetails[et] = {
          title: afterDash.slice(0, 80),
          description: '',
        };
      } else {
        etapeDetails[et] = { title: '', description: '' };
      }
    }
  }

  return {
    eventDate,
    activities: rawParsed,
    resources: sortedResources,
    etapes: sortedEtapes.length > 0 ? sortedEtapes : ['Bloc 00'],
    etapeDetails,
  };
}

function getCsvSortWeight(horaire: string): number {
  const exact = parseTimeToMinutes(horaire);
  if (exact !== null) return exact;
  const u = horaire.toUpperCase();
  if (u === 'AM') return 360;
  if (u === 'PM') return 780;
  return 1441;
}

export async function loadBundledEventCsv(): Promise<ParsedCsvPlan> {
  const baseUrl = import.meta.env.BASE_URL || '/';
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  const response = await fetch(`${normalizedBase}assets/aistudio/Minute_par_Minute_2_juin_2026_7c0e0a34.csv`);
  if (!response.ok) {
    throw new Error('Impossible de charger le fichier CSV initial.');
  }
  const text = await response.text();
  return parseEventCsv(text, '2026-06-06');
}
