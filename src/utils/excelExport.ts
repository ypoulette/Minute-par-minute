import * as XLSX from 'xlsx';
import type { ComputedActivity, EtapeDetail } from '../types/planner';
import { getEtapeDisplay } from './etapeDefaults';

export function exportActivitiesToExcel(
  activities: ComputedActivity[],
  eventTitle: string,
  eventDate: string,
  includeTextColumn: boolean,
  etapeDetails?: Record<string, EtapeDetail>
): void {
  const byId = new Map(activities.map((a) => [a.id, a]));

  const rows = activities.map((act) => {
    const detail = act.etape ? getEtapeDisplay(act.etape, etapeDetails) : null;
    const etapeLabel =
      act.etape && detail?.title ? `${act.etape} — ${detail.title}` : act.etape;
    const parent = act.parentId ? byId.get(act.parentId) : null;
    const indent = act.dependencyDepth > 0 ? `${'  '.repeat(act.dependencyDepth)}↳ ` : '';
    const executantLabel =
      act.resolvedExecutants.length > 0
        ? act.resolvedExecutants.join(', ')
        : act.executant;

    const baseRow: Record<string, string | number> = {
      '#': act.wbsCode,
      Step: act.step === null ? '' : act.step,
      Bloc: etapeLabel,
      Date: act.computedDate,
      Horaire: act.computedHoraire === '—' ? '' : act.computedHoraire,
      Mode: act.horaireMode === 'dependant' ? 'Dépendant' : 'Manuel',
      'Dépend de': parent ? `#${parent.wbsCode}` : '',
      'Durée (min)': act.dureeMinutes,
      Activité: `${indent}${act.activite}`,
      Responsable: act.responsable,
      'Exécutant(s)': executantLabel,
      'À corriger': act.needsCorrection ? 'Oui' : '',
      'Commentaires réviseur': act.commentaires || '',
    };

    if (includeTextColumn) {
      baseRow.Texte = act.texte;
    }

    return baseRow;
  });

  const worksheet = XLSX.utils.json_to_sheet(rows);

  const colWidths = [
    { wch: 8 },  // #
    { wch: 7 },  // Step
    { wch: 30 }, // Bloc
    { wch: 12 }, // Date
    { wch: 10 }, // Horaire
    { wch: 11 }, // Mode
    { wch: 11 }, // Dépend de
    { wch: 12 }, // Durée
    { wch: 62 }, // Activité
    { wch: 22 }, // Responsable
    { wch: 30 }, // Exécutant(s)
    { wch: 11 }, // À corriger
    { wch: 40 }, // Commentaires réviseur
  ];

  if (includeTextColumn) {
    colWidths.push({ wch: 70 }); // Texte
  }

  worksheet['!cols'] = colWidths;

  const workbook = XLSX.utils.book_new();
  const sheetName = includeTextColumn ? 'Minute par minute complet' : 'Minute par minute';
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  const safeSlug =
    eventTitle
      .toLowerCase()
      .replace(/[^a-z0-9]+/gi, '_')
      .replace(/^_|_$/g, '')
      .slice(0, 40) || 'evenement';
  const suffix = includeTextColumn ? 'avec_texte' : 'simple';
  const filename = `${safeSlug}_${eventDate}_${suffix}.xlsx`;

  XLSX.writeFile(workbook, filename);
}
