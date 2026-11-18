import React, { useState } from 'react';
import { FileSpreadsheet, RotateCcw, Upload, X } from 'lucide-react';
import { loadBundledEventCsv, parseEventCsv, type ParsedCsvPlan } from '../utils/csvImporter';

interface ImportCsvModalProps {
  currentEventDate: string;
  onReplaceCurrent: (parsed: ParsedCsvPlan) => Promise<void>;
  onCreateNewEvent: (title: string, parsed: ParsedCsvPlan) => Promise<void>;
  onClose: () => void;
}

export const ImportCsvModal: React.FC<ImportCsvModalProps> = ({
  currentEventDate,
  onReplaceCurrent,
  onCreateNewEvent,
  onClose,
}) => {
  const [parsed, setParsed] = useState<ParsedCsvPlan | null>(null);
  const [fileName, setFileName] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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
        setError('Aucune activité détectée dans ce fichier CSV.');
        setParsed(null);
      } else {
        setParsed(result);
      }
    } catch {
      setError('Impossible de lire ce fichier CSV.');
    }
  };

  const handleLoadInitialCsv = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await loadBundledEventCsv();
      setParsed(result);
      setFileName('Minute_par_Minute_2_juin_2026.csv');
      setNewTitle('Relais pour la vie 2026 — Minute par minute');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement.');
    } finally {
      setLoading(false);
    }
  };

  const handleApplyReplace = async () => {
    if (!parsed) return;
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

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white border border-slate-200 rounded-xl w-full max-w-lg overflow-hidden shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-blue-600" />
            <h2 className="text-base font-semibold text-slate-900">
              Importer un fichier CSV
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
          <label className="flex flex-col items-center justify-center gap-2 p-6 border border-dashed border-slate-300 rounded-lg bg-slate-50 hover:bg-slate-100/70 cursor-pointer transition-colors">
            <Upload className="w-6 h-6 text-slate-500" />
            <span className="text-sm font-medium text-slate-800">
              {fileName || 'Choisir un fichier CSV (; ou ,)'}
            </span>
            <span className="text-xs text-slate-500">
              Colonnes : Step, Étape, Date, Horaire, Activités, Responsable, Exécutant
            </span>
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileChange}
              className="hidden"
            />
          </label>

          <button
            type="button"
            onClick={handleLoadInitialCsv}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Charger le fichier modèle (Minute_par_Minute_2_juin_2026.csv)
          </button>

          {error && <p className="text-xs text-red-600">{error}</p>}

          {parsed && (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
              <div className="text-xs text-slate-700 space-y-1">
                <p className="font-medium text-slate-900">
                  Aperçu : {parsed.activities.length} activités détectées
                </p>
                <p>
                  Date événement : <span className="font-mono">{parsed.eventDate}</span> ·{' '}
                  {parsed.etapes.length} étapes · {parsed.resources.length} ressources
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Nom (si nouvel événement)
                </label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm bg-white border border-slate-200 rounded-md"
                />
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleApplyReplace}
                  className="flex-1 px-3 py-2 text-xs font-medium text-slate-800 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50"
                >
                  Remplacer l’événement actuel
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleApplyNew}
                  className="flex-1 px-3 py-2 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  Créer un nouvel événement
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};