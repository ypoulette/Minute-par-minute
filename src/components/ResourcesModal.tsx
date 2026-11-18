import React, { useState } from 'react';
import { Layers, Plus, Trash2, UserCheck, X } from 'lucide-react';
import type { EtapeDetail, EventPlan } from '../types/planner';
import { getEtapeDisplay } from '../utils/etapeDefaults';

interface ResourcesModalProps {
  event: EventPlan;
  onUpdateResources: (nextResources: string[]) => Promise<void>;
  onUpdateEtapes: (
    nextEtapes: string[],
    nextDetails?: Record<string, EtapeDetail>
  ) => Promise<void>;
  onClose: () => void;
}

export const ResourcesModal: React.FC<ResourcesModalProps> = ({
  event,
  onUpdateResources,
  onUpdateEtapes,
  onClose,
}) => {
  const [tab, setTab] = useState<'resources' | 'etapes'>('resources');
  const [newName, setNewName] = useState('');
  const [newBlocTitle, setNewBlocTitle] = useState('');
  const [newBlocDesc, setNewBlocDesc] = useState('');
  const [saving, setSaving] = useState(false);

  const items = tab === 'resources' ? event.resources : event.etapes;

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newName.trim();
    if (!trimmed) return;
    if (items.some((i) => i.toLowerCase() === trimmed.toLowerCase())) {
      setNewName('');
      return;
    }

    setSaving(true);
    try {
      if (tab === 'resources') {
        const next = [...event.resources, trimmed].sort((a, b) =>
          a.localeCompare(b, 'fr', { sensitivity: 'base' })
        );
        await onUpdateResources(next);
      } else {
        const nextEtapes = [...event.etapes, trimmed];
        const nextDetails = {
          ...(event.etapeDetails || {}),
          [trimmed]: {
            title: newBlocTitle.trim(),
            description: newBlocDesc.trim(),
          },
        };
        await onUpdateEtapes(nextEtapes, nextDetails);
        setNewBlocTitle('');
        setNewBlocDesc('');
      }
      setNewName('');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateBlocDetail = async (
    etapeKey: string,
    field: 'title' | 'description',
    val: string
  ) => {
    const current = getEtapeDisplay(etapeKey, event.etapeDetails);
    const nextDetails: Record<string, EtapeDetail> = {
      ...(event.etapeDetails || {}),
      [etapeKey]: {
        ...current,
        [field]: val,
      },
    };
    await onUpdateEtapes(event.etapes, nextDetails);
  };

  const handleRemove = async (name: string) => {
    setSaving(true);
    try {
      if (tab === 'resources') {
        await onUpdateResources(event.resources.filter((r) => r !== name));
      } else {
        const nextDetails = { ...(event.etapeDetails || {}) };
        delete nextDetails[name];
        await onUpdateEtapes(
          event.etapes.filter((et) => et !== name),
          nextDetails
        );
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white border border-slate-200 rounded-xl w-full max-w-2xl overflow-hidden shadow-xl max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 shrink-0">
          <h2 className="text-base font-semibold text-slate-900">
            Répertoire des ressources & blocs
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
            aria-label="Fermer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 pt-4 shrink-0">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => setTab('resources')}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                tab === 'resources'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5" />
              Ressources ({event.resources.length})
            </button>
            <button
              type="button"
              onClick={() => setTab('etapes')}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                tab === 'etapes'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              Blocs & définitions ({event.etapes.length})
            </button>
          </div>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto">
          <form onSubmit={handleAdd} className="space-y-2">
            <div className="flex gap-2">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={
                  tab === 'resources'
                    ? 'Ajouter un nom (Responsable / Exécutant)...'
                    : 'Code du bloc (ex. Bloc 11)...'
                }
                className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
              {tab === 'etapes' && (
                <input
                  type="text"
                  value={newBlocTitle}
                  onChange={(e) => setNewBlocTitle(e.target.value)}
                  placeholder="Nom du bloc (ex. Animation soirée)..."
                  className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              )}
              <button
                type="submit"
                disabled={saving || !newName.trim()}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap shrink-0"
              >
                <Plus className="w-4 h-4" />
                Ajouter
              </button>
            </div>
            {tab === 'etapes' && (
              <input
                type="text"
                value={newBlocDesc}
                onChange={(e) => setNewBlocDesc(e.target.value)}
                placeholder="Définition du contenu du bloc (optionnel)..."
                className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            )}
          </form>

          <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-lg">
            {items.length === 0 ? (
              <div className="px-4 py-6 text-center text-xs text-slate-400">
                Aucun élément enregistré.
              </div>
            ) : tab === 'resources' ? (
              items.map((name) => (
                <div
                  key={name}
                  className="flex items-center justify-between px-3 py-2 text-sm bg-white hover:bg-slate-50"
                >
                  <span className="text-slate-800 truncate">{name}</span>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => handleRemove(name)}
                    className="p-1 text-slate-400 hover:text-red-600 rounded"
                    title="Retirer de la liste"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            ) : (
              items.map((etapeKey) => {
                const detail = getEtapeDisplay(etapeKey, event.etapeDetails);
                return (
                  <BlocEditorRow
                    key={etapeKey}
                    etapeKey={etapeKey}
                    title={detail.title}
                    description={detail.description}
                    saving={saving}
                    onSaveTitle={(v) => handleUpdateBlocDetail(etapeKey, 'title', v)}
                    onSaveDesc={(v) => handleUpdateBlocDetail(etapeKey, 'description', v)}
                    onRemove={() => handleRemove(etapeKey)}
                  />
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

interface BlocEditorRowProps {
  etapeKey: string;
  title: string;
  description: string;
  saving: boolean;
  onSaveTitle: (v: string) => void;
  onSaveDesc: (v: string) => void;
  onRemove: () => void;
}

const BlocEditorRow: React.FC<BlocEditorRowProps> = ({
  etapeKey,
  title,
  description,
  saving,
  onSaveTitle,
  onSaveDesc,
  onRemove,
}) => {
  const [titleDraft, setTitleDraft] = useState(title);
  const [descDraft, setDescDraft] = useState(description);

  return (
    <div className="p-3 bg-white space-y-1.5">
      <div className="flex items-center gap-2">
        <span className="font-mono text-xs font-semibold text-slate-700 w-24 shrink-0">
          {etapeKey}
        </span>
        <input
          type="text"
          value={titleDraft}
          onChange={(e) => setTitleDraft(e.target.value)}
          onBlur={() => {
            if (titleDraft.trim() !== title) onSaveTitle(titleDraft);
          }}
          placeholder="Nom du bloc (ex. Préparation du site)..."
          className="flex-1 px-2 py-1 text-xs font-medium text-slate-900 bg-slate-50 border border-slate-200 rounded focus:outline-none focus:bg-white focus:border-blue-600"
        />
        <button
          type="button"
          disabled={saving}
          onClick={onRemove}
          className="p-1 text-slate-400 hover:text-red-600 rounded shrink-0"
          title="Retirer ce bloc"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
      <input
        type="text"
        value={descDraft}
        onChange={(e) => setDescDraft(e.target.value)}
        onBlur={() => {
          if (descDraft.trim() !== description) onSaveDesc(descDraft);
        }}
        placeholder="Contenu / objectif du bloc..."
        className="w-full px-2 py-1 text-xs text-slate-600 bg-transparent border border-transparent hover:border-slate-200 focus:border-blue-600 focus:bg-white rounded focus:outline-none"
      />
    </div>
  );
};