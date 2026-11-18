import React, { useState } from 'react';
import { Check, Copy, Plus, Trash2, Users, X, Shield, Edit3, MessageSquare, Eye } from 'lucide-react';
import type { EventPlan, TeamRole } from '../types/planner';

interface TeamModalProps {
  event: EventPlan;
  currentUserEmail: string;
  isOwnerOrAdmin: boolean;
  onSaveTeam: (nextEmails: string[], nextRoles: Record<string, TeamRole>) => Promise<void>;
  onClose: () => void;
}

const ROLE_LABELS: Record<TeamRole, { label: string; desc: string; icon: React.ReactNode }> = {
  admin: {
    label: 'Administrateur',
    desc: 'Gestion des membres et modifications complètes',
    icon: <Shield className="w-3.5 h-3.5 text-amber-600" />,
  },
  editeur: {
    label: 'Éditeur',
    desc: 'Modification des horaires, étapes, durées et activités',
    icon: <Edit3 className="w-3.5 h-3.5 text-blue-600" />,
  },
  reviseur: {
    label: 'Réviseur',
    desc: 'Ajout de commentaires, demandes d’ajouts/modifications et signalement',
    icon: <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />,
  },
  lecteur: {
    label: 'Lecteur',
    desc: 'Consultation seule (aucun droit de modification)',
    icon: <Eye className="w-3.5 h-3.5 text-slate-500" />,
  },
};

export const TeamModal: React.FC<TeamModalProps> = ({
  event,
  currentUserEmail,
  isOwnerOrAdmin,
  onSaveTeam,
  onClose,
}) => {
  const [input, setInput] = useState('');
  const [selectedRole, setSelectedRole] = useState<TeamRole>('reviseur');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  // Local map of roles initialized from event.teamRoles
  const roles: Record<string, TeamRole> = {
    [event.ownerEmail.toLowerCase()]: 'admin',
    ...(event.teamRoles || {}),
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const candidates = input
      .split(/[,;\n\s]+/)
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);

    if (candidates.length === 0) return;

    const invalid = candidates.filter((c) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c));
    if (invalid.length > 0) {
      setError(`Courriel invalide : ${invalid.join(', ')}`);
      return;
    }

    const merged = Array.from(new Set([...event.teamEmails, ...candidates]));
    if (merged.length > 50) {
      setError('Maximum 50 membres par événement.');
      return;
    }

    const nextRoles: Record<string, TeamRole> = { ...roles };
    for (const email of candidates) {
      if (email !== event.ownerEmail.toLowerCase()) {
        nextRoles[email] = selectedRole;
      }
    }

    setSaving(true);
    try {
      await onSaveTeam(merged, nextRoles);
      setInput('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la mise à jour.');
    } finally {
      setSaving(false);
    }
  };

  const handleChangeRole = async (email: string, newRole: TeamRole) => {
    if (email === event.ownerEmail.toLowerCase()) return;
    const nextRoles: Record<string, TeamRole> = {
      ...roles,
      [email]: newRole,
    };
    setSaving(true);
    setError('');
    try {
      await onSaveTeam(event.teamEmails, nextRoles);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors du changement de rôle.');
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (emailToRemove: string) => {
    if (emailToRemove === event.ownerEmail.toLowerCase()) return;
    setSaving(true);
    setError('');
    const nextEmails = event.teamEmails.filter((e) => e !== emailToRemove);
    const nextRoles = { ...roles };
    delete nextRoles[emailToRemove];
    try {
      await onSaveTeam(nextEmails, nextRoles);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors du retrait.');
    } finally {
      setSaving(false);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.origin);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white border border-slate-200 rounded-xl w-full max-w-xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div className="flex items-center gap-2.5">
            <Users className="w-5 h-5 text-blue-600" />
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Gestion des accès et rôles de l’équipe
              </h2>
              <p className="text-xs text-slate-500">
                Définissez qui peut modifier le planning ou déposer des commentaires de révision.
              </p>
            </div>
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

        <div className="p-6 space-y-5 overflow-y-auto">
          {/* Link sharing */}
          <div className="flex items-center justify-between gap-3 p-3 bg-slate-50 border border-slate-200 rounded-lg">
            <div className="min-w-0">
              <p className="text-xs font-medium text-slate-900">Lien public ou hébergé</p>
              <p className="text-xs text-slate-500 truncate font-mono">{window.location.origin}</p>
            </div>
            <button
              type="button"
              onClick={handleCopyLink}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 whitespace-nowrap shrink-0 shadow-sm"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  Copié
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  Copier le lien
                </>
              )}
            </button>
          </div>

          {/* Add member form */}
          {isOwnerOrAdmin ? (
            <form onSubmit={handleAdd} className="space-y-3 p-4 bg-blue-50/50 border border-blue-100 rounded-lg">
              <label className="block text-xs font-semibold text-slate-800">
                Ajouter un collaborateur ou réviseur
              </label>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="ex. collegue@gmail.com, nancy@live.ca"
                  className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 bg-white"
                />
                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value as TeamRole)}
                  className="px-3 py-2 text-xs font-medium border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                >
                  <option value="reviseur">Réviseur (Commentaires seuls)</option>
                  <option value="editeur">Éditeur (Modifications complètes)</option>
                  <option value="lecteur">Lecteur (Lecture seule)</option>
                </select>
                <button
                  type="submit"
                  disabled={saving || !input.trim()}
                  className="flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap shadow-sm"
                >
                  <Plus className="w-4 h-4" />
                  Autoriser
                </button>
              </div>
              <p className="text-[11px] text-slate-500">
                💡 <span className="font-medium text-slate-700">Réviseur</span> : peut ajouter des notes de correction et cocher « À corriger » sans altérer les heures ni les responsables.
              </p>
              {error && <p className="text-xs text-red-600 font-medium">{error}</p>}
            </form>
          ) : (
            <p className="text-xs text-slate-500 bg-slate-50 p-3 rounded-lg border border-slate-200">
              Seul le responsable ({event.ownerEmail}) peut inviter ou modifier les rôles de l’équipe.
            </p>
          )}

          {/* Members list */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-500 px-1">
              <span>Membres autorisés ({event.teamEmails.length}/50)</span>
              <span>Rôles en temps réel</span>
            </div>
            <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-lg bg-white">
              {event.teamEmails.map((email) => {
                const normEmail = email.toLowerCase();
                const isOwner = normEmail === event.ownerEmail.toLowerCase();
                const isMe = normEmail === currentUserEmail.toLowerCase();
                const currentRole: TeamRole = isOwner ? 'admin' : (roles[normEmail] || 'editeur');
                const roleConfig = ROLE_LABELS[currentRole];

                return (
                  <div
                    key={normEmail}
                    className="flex items-center justify-between px-3 py-2.5 text-sm gap-2 hover:bg-slate-50 transition-colors"
                  >
                    <div className="min-w-0 flex items-center gap-2">
                      <span className="text-slate-900 truncate font-mono text-xs font-medium">
                        {normEmail}
                      </span>
                      {isMe && (
                        <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-medium">
                          Vous
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {isOwner ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                          {roleConfig.icon}
                          Propriétaire
                        </span>
                      ) : isOwnerOrAdmin ? (
                        <select
                          value={currentRole}
                          onChange={(e) => handleChangeRole(normEmail, e.target.value as TeamRole)}
                          disabled={saving}
                          className="text-xs font-medium border border-slate-200 rounded-md px-2 py-1 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-600 cursor-pointer"
                        >
                          <option value="editeur">Éditeur (Modifs complètes)</option>
                          <option value="reviseur">Réviseur (Commentaires)</option>
                          <option value="lecteur">Lecteur (Lecture seule)</option>
                        </select>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                          {roleConfig.icon}
                          {roleConfig.label}
                        </span>
                      )}

                      {isOwnerOrAdmin && !isOwner && (
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => handleRemove(normEmail)}
                          className="p-1 text-slate-400 hover:text-red-600 rounded transition-colors"
                          title="Retirer l'accès"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white border border-slate-200 rounded-lg shadow-sm"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};
