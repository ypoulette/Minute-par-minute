import React, { useState } from 'react';
import { Download, FileSpreadsheet, Plus, Sparkles, Upload, X } from 'lucide-react';
import { parseEventCsv, type ParsedCsvPlan } from '../utils/csvImporter';

interface ImportCsvModalProps {
  currentEventDate: string;
  onAppendActivities: (parsed: ParsedCsvPlan) => Promise<void>;
  onReplaceCurrent?: (parsed: ParsedCsvPlan) => Promise<void>;
  onCreateNewEvent: (title: string, parsed: ParsedCsvPlan) => Promise<void>;
  onClose: () => void;
}

function downloadBlankCsvTemplate() {
  const headers = [
    'Step',
    'Étape',
    'Date',
    'Horaire',
    'Activités',
    'Responsable',
    'Exécutant',
    'Commentaires',
    'Texte',
  ];
  const sampleRow1 = [
    '0',
    'Bloc 00',
    '',
    '08:00',
    'Préparation du site et installation technique',
    'Coordonnateur',
    'Équipe logistique, Responsable technique',
    '',
    'Installation des tentes, vérification du son et des branchements électriques.',
  ];
  const sampleRow2 = [
    '0',
    'Bloc 00',
    '',
    '09:00',
    'Accueil des premiers participants et bénévoles',
    'Accueil',
    'Bénévoles accueil',
    '',
    'Distribution des dossards et remise des trousses de bienvenue.',
  ];

  const csvContent =
    '\uFEFF' +
    [headers.join(';'), sampleRow1.join(';'), sampleRow2.join(';')].join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'Gabarit_Modele_ChronoPlan.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export const ImportCsvModal: React.FC<ImportCsvModalProps> = ({
  currentEventDate,
  onAppendActivities,
  onReplaceCurrent,
  onCreateNewEvent,
  onClose,
}) => {
  const [parsed, setParsed] = useState<ParsedCsvPlan | null>(null);
  const [fileName, setFileName] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showAdvancedReplace, setShowAdvancedReplace] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    setFileName(file.name);
    setNewTitle(file.name.replace(/\.csv$/i, '').replace(/_/g, ' '));
    try {
      const text = await file.text();
      const result = parseEventCsv(text, currentEventDate);
      if (result.activities.length === 0) {
        setError('Aucune activité détectée dans ce fichier CSV. Vérifiez les séparateurs (; ou ,).');
        setParsed(null);
      } else {
        setParsed(result);
      }
    } catch {
      setError('Impossible de lire ce fichier CSV.');
    }
  };

  const handleApplyAppend = async () => {
    if (!parsed) return;
    setLoading(true);
    setError('');
    try {
      await onAppendActivities(parsed);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de l’ajout des activités.');
    } finally {
      setLoading(false);
    }
  };

  const handleApplyNew = async () => {
    if (!parsed) return;
    setLoading(true);
    setError('');
    try {
      await onCreateNewEvent(newTitle || 'Nouvel événement', parsed);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la création.');
    } finally {
      setLoading(false);
    }
  };

  const handleApplyReplace = async () => {
    if (!parsed || !onReplaceCurrent) return;
    if (
      !window.confirm(
        'Attention : cette action va supprimer toutes les activités actuelles pour les remplacer par le CSV. Voulez-vous continuer ?'
      )
    ) {
      return;
    }
    setLoading(true);
    setError('');
    try {
      await onReplaceCurrent(parsed);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors du remplacement.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white border border-slate-200 rounded-xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-blue-600" />
            <h2 className="text-base font-semibold text-slate-900">
              Importer des activités (CSV)
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
            aria-label="Fermer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <label className="flex flex-col items-center justify-center gap-2 p-6 border-2 border-dashed border-slate-300 rounded-lg bg-slate-50 hover:bg-blue-50/40 hover:border-blue-400 cursor-pointer transition-colors">
            <Upload className="w-6 h-6 text-slate-500" />
            <span className="text-sm font-semibold text-slate-800 text-center">
              {fileName || 'Choisir ou glisser un fichier CSV'}
            </span>
            <span className="text-xs text-slate-500 text-center">
              Séparateurs acceptés : point-virgule (;) ou virgule (,)
            </span>
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileChange}
              className="hidden"
            />
          </label>

          {/* Gabarit CSV vierge téléchargeable */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between gap-3">
            <div className="text-xs text-slate-600 leading-snug">
              <span className="font-semibold text-slate-800 block">Besoin du format exact ?</span>
              Téléchargez un modèle vierge préformaté pour Excel.
            </div>
            <button
              type="button"
              onClick={downloadBlankCsvTemplate}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-100 whitespace-nowrap shadow-xs transition-colors shrink-0"
            >
              <Download className="w-3.5 h-3.5 text-blue-600" />
              Gabarit CSV vide
            </button>
          </div>

          {error && (
            <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
              {error}
            </p>
          )}

          {parsed && (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
              <div className="text-xs text-slate-700 space-y-1">
                <p className="font-semibold text-slate-900 text-sm flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-emerald-600" />
                  {parsed.activities.length} activités prêtes à être importées
                </p>
                <p className="text-slate-600">
                  {parsed.etapes.length} bloc(s) · {parsed.resources.length} ressource(s) détectée(s)
                </p>
              </div>

              {/* Action principale : Ajouter sans écraser */}
              <div className="space-y-2 pt-1">
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleApplyAppend}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors disabled:opacity-50 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  {loading
                    ? 'Ajout en cours...'
                    : `Ajouter les ${parsed.activities.length} activités au planning actuel`}
                </button>
                <p className="text-[11px] text-slate-500 text-center">
                  Conserve toutes vos activités actuelles et ajoute les nouvelles lignes à la suite.
                </p>
              </div>

              {/* Action alternative : Créer un nouvel événement */}
              <div className="pt-2 border-t border-slate-200 space-y-2">
                <label className="block text-xs font-medium text-slate-700">
                  Ou créer un tout nouvel événement séparé :
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="Nom du nouvel événement"
                    className="flex-1 px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-md"
                  />
                  <button
                    type="button"
                    disabled={loading || !newTitle.trim()}
                    onClick={handleApplyNew}
                    className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-100 disabled:opacity-50 whitespace-nowrap"
                  >
                    Créer l’événement
                  </button>
                </div>
              </div>

              {/* Option avancée : Remplacement complet */}
              {onReplaceCurrent && (
                <div className="pt-2 text-right">
                  {!showAdvancedReplace ? (
                    <button
                      type="button"
                      onClick={() => setShowAdvancedReplace(true)}
                      className="text-[11px] text-slate-400 hover:text-red-600 underline"
                    >
                      Option avancée : Remplacer l’événement complet…
                    </button>
                  ) : (
                    <div className="p-2.5 bg-red-50 border border-red-200 rounded-md text-left space-y-1.5">
                      <p className="text-[11px] text-red-800 font-medium">
                        ⚠️ Attention : cela écrasera toutes les activités existantes.
                      </p>
                      <button
                        type="button"
                        disabled={loading}
                        onClick={handleApplyReplace}
                        className="px-2.5 py-1 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded-md"
                      >
                        Confirmer le remplacement total
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
