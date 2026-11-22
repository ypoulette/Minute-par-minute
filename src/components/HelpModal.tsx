import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  CornerDownRight,
  Download,
  FileSpreadsheet,
  FileText,
  GripVertical,
  HelpCircle,
  Layers,
  Link2,
  MessageSquare,
  Plus,
  Printer,
  RotateCcw,
  Search,
  Shield,
  Trash2,
  Users,
  X,
} from 'lucide-react';

interface HelpModalProps {
  onClose: () => void;
}

export const HelpModal: React.FC<HelpModalProps> = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState<string>('intro');
  const [isPrinting, setIsPrinting] = useState(false);

  // Close with Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handlePrint = () => {
    setIsPrinting(true);
    document.body.classList.add('printing-manual');

    // Slight delay to ensure DOM is ready and styled
    setTimeout(() => {
      window.print();
      document.body.classList.remove('printing-manual');
      setIsPrinting(false);
    }, 200);
  };

  const sections = [
    { id: 'intro', label: '1. Connexion & Accès', icon: Shield },
    { id: 'navigation', label: '2. Menus & Navigation', icon: Layers },
    { id: 'vues', label: '3. Modes d’affichage', icon: FileText },
    { id: 'ajout', label: '4. Ajouter une activité', icon: Plus },
    { id: 'modif', label: '5. Modifier une activité', icon: Clock },
    { id: 'suppr', label: '6. Effacer heure vs Supprimer', icon: Trash2 },
    { id: 'undo', label: '7. Annuler (Undo / Ctrl+Z)', icon: RotateCcw },
    { id: 'blocs', label: '8. Blocs & Ressources', icon: Layers },
    { id: 'equipe', label: '9. Équipe & Rôles', icon: Users },
    { id: 'export', label: '10. Export & Impression', icon: Download },
  ];

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        id="printable-user-manual"
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden text-slate-800"
      >
        {/* Top Header */}
        <div className="no-print px-6 py-4 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold font-display tracking-tight text-white">
                  ChronoPlan — Manuel de l'utilisateur
                </h2>
                <span className="px-2 py-0.5 text-[10px] font-semibold bg-blue-500/30 text-blue-300 rounded-full border border-blue-400/30">
                  Guide officiel 2026
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Documentation complète, captures illustrées et exemples pas à pas
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              disabled={isPrinting}
              className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-xl transition-colors shadow-sm disabled:opacity-50"
              title="Télécharger ou imprimer ce document complet en PDF"
            >
              <Printer className="w-4 h-4" />
              <span>Télécharger / Imprimer en PDF</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
              title="Fermer le manuel (Échap)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Cover Header (visible only when printing to PDF) */}
        <div className="hidden print:block p-8 border-b-2 border-slate-300 bg-slate-50 text-slate-900">
          <div className="flex items-center justify-between pb-4 border-b border-slate-200">
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight font-display text-slate-900">
                ChronoPlan — Minute par minute
              </h1>
              <p className="text-base text-slate-600 mt-1">
                Manuel de l’utilisateur & Guide d'opération complet
              </p>
            </div>
            <div className="text-right text-xs text-slate-500 font-mono">
              <div>Version 1.0 (Production)</div>
              <div>Édition 2026</div>
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-3 leading-relaxed">
            Ce document décrit pas à pas la planification, la conduite opérationnelle, l'attribution des rôles d'équipe et la gestion sécurisée du déroulement minute par minute.
          </p>
        </div>

        {/* Navigation Tabs (Screen view) */}
        <div className="no-print bg-slate-100 border-b border-slate-200 px-4 py-2 flex items-center gap-1 overflow-x-auto shrink-0">
          {sections.map((sec) => {
            const Icon = sec.icon;
            const active = activeTab === sec.id;
            return (
              <button
                key={sec.id}
                type="button"
                onClick={() => {
                  setActiveTab(sec.id);
                  const el = document.getElementById(`section-${sec.id}`);
                  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-colors ${
                  active
                    ? 'bg-white text-blue-700 shadow-sm font-semibold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span>{sec.label}</span>
              </button>
            );
          })}
        </div>

        {/* Main Content Body */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-12 leading-relaxed text-sm">
          {/* ============================================================== */}
          {/* CHAPITRE 1 : CONNEXION & ACCÈS */}
          {/* ============================================================== */}
          <section id="section-intro" className="space-y-4 print-break-inside-avoid">
            <div className="flex items-center gap-2.5 pb-2 border-b border-slate-200">
              <span className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-xs">
                1
              </span>
              <h3 className="text-lg font-bold text-slate-900 font-display">
                Connexion initiale & Authentification sécurisée
              </h3>
            </div>

            <p className="text-slate-600">
              ChronoPlan est une application infonuagique collaborative en temps réel. Chaque utilisateur se connecte avec son identité propre pour assurer la traçabilité des modifications et le respect des permissions d’équipe.
            </p>

            {/* Mockup Capture 1 */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 sm:p-6 space-y-3">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Capture illustrée 1 — Fenêtre de connexion
              </div>
              <div className="max-w-md mx-auto bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
                <div className="text-center space-y-1">
                  <div className="w-10 h-10 mx-auto rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold text-lg">
                    C
                  </div>
                  <h4 className="text-base font-bold text-slate-900 font-display">ChronoPlan</h4>
                  <p className="text-xs text-slate-500">Planification d’événements minute par minute</p>
                </div>

                <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl text-xs text-blue-900 flex items-center gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-[10px] shrink-0">
                    ➊
                  </span>
                  <span><strong>Connexion Google en 1 clic :</strong> rapide, sans mot de passe supplémentaire.</span>
                </div>

                <button
                  type="button"
                  className="w-full flex items-center justify-center gap-2.5 py-2.5 px-4 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 shadow-sm"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                  </svg>
                  Continuer avec Google
                </button>

                <div className="relative flex py-1 items-center">
                  <div className="flex-grow border-t border-slate-200"></div>
                  <span className="flex-shrink mx-2 text-[10px] uppercase tracking-wider text-slate-400 font-medium">ou courriel</span>
                  <div className="flex-grow border-t border-slate-200"></div>
                </div>

                <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl text-xs text-amber-950 flex items-center gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-amber-600 text-white flex items-center justify-center font-bold text-[10px] shrink-0">
                    ➋
                  </span>
                  <span><strong>Connexion par courriel & mot de passe :</strong> pour ceux sans compte Google.</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                <span className="font-bold text-slate-900 block">➊ Première connexion :</span>
                <p className="text-slate-600">
                  Si aucun événement n'est encore associé à votre adresse, l'application initialise automatiquement votre premier planning avec les blocs et modèles préconfigurés.
                </p>
              </div>
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                <span className="font-bold text-slate-900 block">➋ Collaborateur invité :</span>
                <p className="text-slate-600">
                  Dès que le responsable ajoute votre adresse dans le volet <strong>Équipe</strong>, l'événement apparaît directement dans votre compte avec vos droits attribués.
                </p>
              </div>
            </div>
          </section>

          {/* ============================================================== */}
          {/* CHAPITRE 2 : MENUS & NAVIGATION */}
          {/* ============================================================== */}
          <section id="section-navigation" className="space-y-4 print-break-inside-avoid">
            <div className="flex items-center gap-2.5 pb-2 border-b border-slate-200">
              <span className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-xs">
                2
              </span>
              <h3 className="text-lg font-bold text-slate-900 font-display">
                Menus & Barre de navigation principale
              </h3>
            </div>

            <p className="text-slate-600">
              La barre supérieure donne accès aux fonctionnalités maîtresses en tout temps. Elle est divisée en 3 zones distinctes :
            </p>

            {/* Mockup Capture 2 */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 sm:p-5 space-y-3">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Capture illustrée 2 — En-tête et menus de l'application
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm flex flex-wrap items-center justify-between gap-4">
                {/* Zone 1 */}
                <div className="flex items-center gap-2">
                  <span className="px-1.5 py-0.5 bg-blue-100 text-blue-800 font-bold text-[11px] rounded">➊</span>
                  <span className="font-bold text-slate-900 font-display">ChronoPlan</span>
                </div>

                {/* Zone 2 */}
                <div className="flex items-center gap-3 text-xs font-medium text-slate-600">
                  <span className="px-1.5 py-0.5 bg-blue-100 text-blue-800 font-bold text-[11px] rounded">➋</span>
                  <span className="px-2.5 py-1 bg-blue-50 text-blue-700 rounded-lg font-semibold border border-blue-200">Liste simple</span>
                  <span className="hover:text-slate-900">Texte complet</span>
                  <span className="hover:text-slate-900">Ressources & blocs</span>
                  <span className="hover:text-slate-900">Équipe (2)</span>
                  <span className="hover:text-slate-900">Aide</span>
                </div>

                {/* Zone 3 */}
                <div className="flex items-center gap-2">
                  <span className="px-1.5 py-0.5 bg-blue-100 text-blue-800 font-bold text-[11px] rounded">➌</span>
                  <button className="flex items-center gap-1 px-2.5 py-1 text-xs border border-slate-200 rounded-lg bg-slate-50 text-slate-700">
                    <RotateCcw className="w-3 h-3 text-slate-500" />
                    <span>Annuler</span>
                  </button>
                  <button className="flex items-center gap-1 px-3 py-1 text-xs bg-blue-600 text-white rounded-lg font-medium">
                    <Plus className="w-3 h-3" />
                    Nouvelle activité
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs pt-1">
                <div className="bg-white p-3 rounded-lg border border-slate-200">
                  <span className="font-bold text-blue-700 block mb-0.5">➊ Accueil :</span>
                  Cliquez sur « ChronoPlan » à tout moment pour revenir à la vue globale du planning.
                </div>
                <div className="bg-white p-3 rounded-lg border border-slate-200">
                  <span className="font-bold text-blue-700 block mb-0.5">➋ Navigation :</span>
                  Permet d'alterner entre l'affichage tabulaire, le texte d'animation, les blocs, l'équipe et ce manuel.
                </div>
                <div className="bg-white p-3 rounded-lg border border-slate-200">
                  <span className="font-bold text-blue-700 block mb-0.5">➌ Actions rapides :</span>
                  Le bouton <strong>Annuler (Ctrl+Z)</strong> pour défaire une erreur et le bouton <strong>Nouvelle activité</strong>.
                </div>
              </div>
            </div>
          </section>

          {/* ============================================================== */}
          {/* CHAPITRE 3 : LES MODES D'AFFICHAGE */}
          {/* ============================================================== */}
          <section id="section-vues" className="space-y-4 print-break-inside-avoid">
            <div className="flex items-center gap-2.5 pb-2 border-b border-slate-200">
              <span className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-xs">
                3
              </span>
              <h3 className="text-lg font-bold text-slate-900 font-display">
                Les deux modes d'affichage : Liste simple & Texte complet
              </h3>
            </div>

            <p className="text-slate-600">
              ChronoPlan propose deux façons complémentaires de visualiser et d’animer votre événement :
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-white border-2 border-blue-200 rounded-xl space-y-2 shadow-sm">
                <div className="flex items-center gap-2 text-blue-700 font-bold">
                  <Layers className="w-4 h-4" />
                  <h4>Mode 1 : Liste simple (Vue de régie / Planning)</h4>
                </div>
                <p className="text-xs text-slate-600">
                  Conçu pour la coordination générale. Il présente l'enchaînement chronologique, les étapes (blocs), les heures de début et fin calculées, les responsables et les dépendances.
                </p>
                <ul className="text-xs text-slate-500 list-disc list-inside space-y-1">
                  <li>Glisser-déposer pour réordonner les activités</li>
                  <li>Modification instantanée des heures et durées</li>
                  <li>Cases à cocher « Fait » et « À corriger »</li>
                </ul>
              </div>

              <div className="p-4 bg-white border-2 border-purple-200 rounded-xl space-y-2 shadow-sm">
                <div className="flex items-center gap-2 text-purple-700 font-bold">
                  <FileText className="w-4 h-4" />
                  <h4>Mode 2 : Texte complet (Vue d’animation / Discours)</h4>
                </div>
                <p className="text-xs text-slate-600">
                  Idéal pour les maîtres de cérémonie, animateurs au micro, directeurs techniques et bénévoles en poste qui doivent lire les scripts complets, protocoles et consignes précises.
                </p>
                <ul className="text-xs text-slate-500 list-disc list-inside space-y-1">
                  <li>Affiche l'intégralité du texte d'animation sans tronquer</li>
                  <li>Édition rapide du script directement dans la ligne</li>
                  <li>Affichage simultané des remarques de révision</li>
                </ul>
              </div>
            </div>
          </section>

          {/* ============================================================== */}
          {/* CHAPITRE 4 : EXEMPLE 1 — AJOUT D'UNE ACTIVITÉ */}
          {/* ============================================================== */}
          <section id="section-ajout" className="space-y-4 print-break-inside-avoid">
            <div className="flex items-center gap-2.5 pb-2 border-b border-slate-200">
              <span className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-xs">
                4
              </span>
              <h3 className="text-lg font-bold text-slate-900 font-display">
                Exemple 1 : Ajout d'une nouvelle activité
              </h3>
            </div>

            <p className="text-slate-600">
              Pour ajouter une activité, cliquez sur <strong>« + Nouvelle activité »</strong> dans l'en-tête ou sur le bouton « + » au bas d'un bloc.
            </p>

            {/* Mockup Capture 3 */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 sm:p-5 space-y-3">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Capture illustrée 3 — Fenêtre d’ajout d’activité
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4 max-w-2xl mx-auto">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <h5 className="font-bold text-slate-900 text-sm">Nouvelle activité du planning</h5>
                  <span className="text-[11px] text-slate-400">Événement du 2026-06-13</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="font-medium text-slate-700 block mb-1">
                      ➊ Date spécifique (Calendrier interactif)
                    </label>
                    <div className="flex items-center gap-2 px-3 py-1.5 border border-slate-300 rounded-lg bg-white">
                      <Calendar className="w-3.5 h-3.5 text-blue-600" />
                      <span className="font-mono">2026-06-13 (Jour J)</span>
                    </div>
                  </div>
                  <div>
                    <label className="font-medium text-slate-700 block mb-1">
                      ➋ Bloc / Étape
                    </label>
                    <div className="px-3 py-1.5 border border-slate-300 rounded-lg bg-white text-slate-800">
                      Bloc 01 — Accueil & Inscription
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2 text-xs">
                  <label className="font-medium text-slate-700 block">
                    ➌ Mode horaire : Manuel ou Dépendant
                  </label>
                  <div className="flex gap-2">
                    <span className="px-3 py-1 bg-white border border-blue-500 text-blue-700 font-semibold rounded-md shadow-sm">
                      Manuel (ex: 09:30)
                    </span>
                    <span className="px-3 py-1 bg-slate-200 text-slate-600 rounded-md">
                      Dépendant (suit la fin de l'activité précédente)
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="font-medium text-slate-700 block mb-1">➍ Titre de l'activité</label>
                    <div className="px-3 py-1.5 border border-slate-300 rounded-lg bg-white text-slate-900 font-medium">
                      Accueil des délégations & Remise des dossiers
                    </div>
                  </div>
                  <div>
                    <label className="font-medium text-slate-700 block mb-1">➎ Responsable principal</label>
                    <div className="px-3 py-1.5 border border-slate-300 rounded-lg bg-white text-slate-800">
                      Coordonnatrice de l'accueil
                    </div>
                  </div>
                </div>

                <div className="text-xs">
                  <label className="font-medium text-slate-700 block mb-1">➏ Texte complet / Consignes / Discours</label>
                  <div className="px-3 py-2 border border-slate-300 rounded-lg bg-white text-slate-600 text-[11px] leading-relaxed">
                    « Souhaiter la bienvenue, remettre le macaron officiel, diriger les participants vers le vestiaire principal... »
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                  <div className="flex items-center gap-2">
                    <input type="checkbox" readOnly checked className="w-3.5 h-3.5 accent-emerald-600" />
                    <span className="text-slate-600">Activité terminée</span>
                  </div>
                  <button className="px-4 py-1.5 bg-blue-600 text-white rounded-lg font-medium text-xs">
                    Ajouter l'activité
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-blue-50/60 border border-blue-200 rounded-xl p-4 text-xs text-blue-950 space-y-1.5">
              <span className="font-bold flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-blue-700" /> Astuce horaire en cascade :
              </span>
              <p>
                Lorsque vous choisissez le mode <strong>Dépendant</strong>, vous liez cette activité à une parente. Si l’heure de la parente change, toutes les sous-activités liées s'ajustent <strong>automatiquement</strong> sans aucun calcul manuel !
              </p>
            </div>
          </section>

          {/* ============================================================== */}
          {/* CHAPITRE 5 : EXEMPLE 2 — MODIFICATION D'UNE ACTIVITÉ */}
          {/* ============================================================== */}
          <section id="section-modif" className="space-y-4 print-break-inside-avoid">
            <div className="flex items-center gap-2.5 pb-2 border-b border-slate-200">
              <span className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-xs">
                5
              </span>
              <h3 className="text-lg font-bold text-slate-900 font-display">
                Exemple 2 : Modification d'une activité (En ligne ou en Fiche)
              </h3>
            </div>

            <p className="text-slate-600">
              Vous disposez de deux méthodes simples pour modifier une activité selon vos besoins :
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-2">
                <span className="font-bold text-slate-900 text-sm block">A. Modification rapide dans le tableau :</span>
                <p className="text-slate-600">
                  Cliquez directement sur l'heure, la durée, le responsable ou la case à cocher dans la ligne du tableau pour une édition immédiate.
                </p>
                <div className="p-2 bg-slate-50 border border-slate-200 rounded font-mono text-[11px] text-slate-700">
                  Heure : 14:00 → clic sur le menu déroulant → choix 14:15
                </div>
              </div>

              <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-2">
                <span className="font-bold text-slate-900 text-sm block">B. Modification complète via la Fiche détaillée :</span>
                <p className="text-slate-600">
                  Cliquez sur le titre de l'activité ou sur le bouton <strong>« Fiche » / « Texte »</strong> à l'extrémité droite de la ligne.
                </p>
                <div className="p-2 bg-slate-50 border border-slate-200 rounded font-mono text-[11px] text-slate-700">
                  Ouvre l'éditeur plein écran avec le discours (jusqu'à 50 000 caractères) et l'espace réviseur.
                </div>
              </div>
            </div>
          </section>

          {/* ============================================================== */}
          {/* CHAPITRE 6 : EFFACER L'HEURE VS SUPPRIMER L'ACTIVITÉ */}
          {/* ============================================================== */}
          <section id="section-suppr" className="space-y-4 print-break-inside-avoid">
            <div className="flex items-center gap-2.5 pb-2 border-b border-slate-200">
              <span className="w-7 h-7 rounded-lg bg-red-100 text-red-700 font-bold flex items-center justify-center text-xs">
                6
              </span>
              <h3 className="text-lg font-bold text-slate-900 font-display">
                Distinction essentielle : Effacer l'heure vs Supprimer l'activité
              </h3>
            </div>

            <div className="p-3.5 bg-amber-50 border-l-4 border-amber-500 rounded-r-xl text-xs text-amber-950 space-y-1">
              <span className="font-bold flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-600" /> Attention fréquente évitée :
              </span>
              <p>
                Pour retirer une heure sans effacer le contenu d'une activité, veillez à utiliser le bouton <strong>« Effacer l'heure »</strong> et <strong>NON</strong> le bouton de suppression d'activité.
              </p>
            </div>

            {/* Mockup Capture 4 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Option A */}
              <div className="p-4 bg-white border-2 border-emerald-300 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-emerald-800 text-sm">Action A : Effacer seulement l'heure</span>
                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-semibold text-[10px]">Recommandé</span>
                </div>
                <p className="text-xs text-slate-600">
                  Dans la fiche détaillée (ou dans le menu de l'heure), cliquez sur le bouton :
                </p>
                <div className="flex items-center gap-2 p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                  <button className="px-2.5 py-1 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded hover:bg-red-50 hover:text-red-700 flex items-center gap-1">
                    <X className="w-3 h-3 text-red-500" />
                    Effacer l'heure
                  </button>
                  <span className="text-xs text-slate-500">→ L'activité reste intacte avec « — »</span>
                </div>
                <p className="text-[11px] text-emerald-700">
                  ✓ Conserve le titre, les notes, le responsable et la durée.
                </p>
              </div>

              {/* Option B */}
              <div className="p-4 bg-white border-2 border-red-300 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-red-800 text-sm">Action B : Supprimer TOUTE l'activité</span>
                  <span className="px-2 py-0.5 bg-red-100 text-red-800 rounded font-semibold text-[10px]">Zone de danger</span>
                </div>
                <p className="text-xs text-slate-600">
                  Situé tout en bas de la fiche détaillée dans l'encadré rouge :
                </p>
                <div className="p-2.5 bg-red-50/70 border border-red-200 rounded-lg">
                  <button className="w-full py-1.5 text-xs font-semibold text-red-700 bg-white border border-red-300 rounded shadow-sm flex items-center justify-center gap-1.5">
                    <Trash2 className="w-3 h-3" />
                    Supprimer toute l'activité
                  </button>
                </div>
                <p className="text-[11px] text-red-700">
                  ⚠ Retire complètement la ligne du déroulement d'événement.
                </p>
              </div>
            </div>
          </section>

          {/* ============================================================== */}
          {/* CHAPITRE 7 : LA FONCTION ANNULER (UNDO) */}
          {/* ============================================================== */}
          <section id="section-undo" className="space-y-4 print-break-inside-avoid">
            <div className="flex items-center gap-2.5 pb-2 border-b border-slate-200">
              <span className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-xs">
                7
              </span>
              <h3 className="text-lg font-bold text-slate-900 font-display">
                La fonction « Annuler » (Undo / Ctrl+Z)
              </h3>
            </div>

            <p className="text-slate-600">
              Vous avez fait une fausse manœuvre ou supprimé une activité par mégarde ? Pas de panique ! ChronoPlan intègre un gestionnaire d'annulation complet.
            </p>

            {/* Mockup Capture 5 */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 sm:p-5 space-y-3">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Capture illustrée 5 — Bannière d'annulation instantanée
              </div>
              <div className="bg-slate-900 text-white rounded-xl p-3.5 shadow-xl flex flex-wrap items-center justify-between gap-3 max-w-xl mx-auto">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded-lg bg-blue-600 text-white">
                    <RotateCcw className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase font-bold text-slate-400">Dernière action</span>
                    <span className="text-xs font-semibold text-white">Suppression de « Cérémonie des survivants »</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button className="px-3 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-lg shadow flex items-center gap-1.5">
                    <RotateCcw className="w-3 h-3" />
                    Annuler (Ctrl+Z)
                  </button>
                  <button className="text-slate-400 hover:text-white p-1">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3 bg-white border border-slate-200 rounded-xl">
                <span className="font-bold text-blue-700 block mb-1">Raccourci clavier :</span>
                Appuyez simplement sur <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-300 rounded font-mono font-semibold">Ctrl</kbd> + <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-300 rounded font-mono font-semibold">Z</kbd> (ou <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-300 rounded font-mono font-semibold">Cmd</kbd> + <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-300 rounded font-mono font-semibold">Z</kbd> sur Mac).
              </div>
              <div className="p-3 bg-white border border-slate-200 rounded-xl">
                <span className="font-bold text-blue-700 block mb-1">Bouton d'en-tête :</span>
                Le bouton <strong>« Annuler »</strong> dans la barre supérieure indique le nombre d'actions que vous pouvez rétrograder.
              </div>
              <div className="p-3 bg-white border border-slate-200 rounded-xl">
                <span className="font-bold text-blue-700 block mb-1">Restauration totale :</span>
                Restaure instantanément l'activité, ses liens de dépendance, ses heures et ses commentaires.
              </div>
            </div>
          </section>

          {/* ============================================================== */}
          {/* CHAPITRE 8 : GESTION DES BLOCS ET RESSOURCES */}
          {/* ============================================================== */}
          <section id="section-blocs" className="space-y-4 print-break-inside-avoid">
            <div className="flex items-center gap-2.5 pb-2 border-b border-slate-200">
              <span className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-xs">
                8
              </span>
              <h3 className="text-lg font-bold text-slate-900 font-display">
                Gestion des Blocs & Ressources
              </h3>
            </div>

            <p className="text-slate-600">
              Dans la barre de menus, cliquez sur <strong>« Ressources & blocs »</strong> pour administrer la structure temporelle de votre événement :
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-2">
                <span className="font-bold text-slate-900 text-sm block">A. Ordonnancement des blocs :</span>
                <p className="text-slate-600">
                  Utilisez les flèches <span className="font-bold text-blue-600">▲</span> et <span className="font-bold text-blue-600">▼</span> pour monter ou descendre un bloc d’activités.
                </p>
                <p className="text-slate-600">
                  Lors de l'ajout d'un nouveau bloc, vous pouvez choisir sa position : au tout début, avant un bloc spécifique, ou à la fin.
                </p>
              </div>

              <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-2">
                <span className="font-bold text-slate-900 text-sm block">B. Liste des ressources :</span>
                <p className="text-slate-600">
                  Ajoutez les noms de vos responsables, bénévoles et intervenants. Dès qu'un nom est saisi, il devient disponible en auto-complétion dans toutes les activités.
                </p>
              </div>
            </div>
          </section>

          {/* ============================================================== */}
          {/* CHAPITRE 9 : ÉQUIPE ET RÔLES DE COLLABORATION */}
          {/* ============================================================== */}
          <section id="section-equipe" className="space-y-4 print-break-inside-avoid">
            <div className="flex items-center gap-2.5 pb-2 border-b border-slate-200">
              <span className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-xs">
                9
              </span>
              <h3 className="text-lg font-bold text-slate-900 font-display">
                Partage d'équipe & Rôles de collaboration
              </h3>
            </div>

            <p className="text-slate-600">
              Dans le menu <strong>« Équipe »</strong>, le propriétaire peut inviter des collaborateurs et définir le niveau de permission de chacun :
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-1">
                <span className="font-bold text-amber-900 block flex items-center gap-1">
                  <Shield className="w-3.5 h-3.5 text-amber-600" /> Propriétaire / Admin
                </span>
                <p className="text-amber-800 text-[11px]">
                  Contrôle total : gestion des accès d’équipe, suppression d'événement, création et modification libre.
                </p>
              </div>

              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl space-y-1">
                <span className="font-bold text-blue-900 block flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-blue-600" /> Éditeur
                </span>
                <p className="text-blue-800 text-[11px]">
                  Peut créer, modifier et réorganiser les activités, changer les heures, durées et textes.
                </p>
              </div>

              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl space-y-1">
                <span className="font-bold text-emerald-900 block flex items-center gap-1">
                  <MessageSquare className="w-3.5 h-3.5 text-emerald-600" /> Réviseur
                </span>
                <p className="text-emerald-800 text-[11px]">
                  Peut ajouter des commentaires de révision et cocher « À corriger ». Les horaires et structures sont protégés.
                </p>
              </div>

              <div className="p-3 bg-slate-100 border border-slate-200 rounded-xl space-y-1">
                <span className="font-bold text-slate-800 block flex items-center gap-1">
                  <BookOpen className="w-3.5 h-3.5 text-slate-500" /> Lecteur
                </span>
                <p className="text-slate-600 text-[11px]">
                  Consultation en direct et extraction des données sans pouvoir altérer le document.
                </p>
              </div>
            </div>
          </section>

          {/* ============================================================== */}
          {/* CHAPITRE 10 : EXPORTATIONS & IMPRESSION */}
          {/* ============================================================== */}
          <section id="section-export" className="space-y-4 print-break-inside-avoid">
            <div className="flex items-center gap-2.5 pb-2 border-b border-slate-200">
              <span className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-xs">
                10
              </span>
              <h3 className="text-lg font-bold text-slate-900 font-display">
                Exportations Excel & Impression PDF
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-2">
                <div className="flex items-center gap-2 text-emerald-700 font-bold">
                  <FileSpreadsheet className="w-4 h-4" />
                  <h4>Exportation Excel (.xlsx)</h4>
                </div>
                <p className="text-slate-600">
                  Deux boutons sont disponibles au-dessus du tableau :
                </p>
                <ul className="text-slate-500 list-disc list-inside space-y-1">
                  <li><strong>Export Excel régie</strong> : colonnes standard pour l'équipe technique.</li>
                  <li><strong>Excel avec texte complet</strong> : inclut l'intégralité des scripts d'animation et notes.</li>
                </ul>
              </div>

              <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-2">
                <div className="flex items-center gap-2 text-blue-700 font-bold">
                  <Printer className="w-4 h-4" />
                  <h4>Extraction & Impression en PDF</h4>
                </div>
                <p className="text-slate-600">
                  Pour obtenir un document PDF propre et imprimable :
                </p>
                <ul className="text-slate-500 list-disc list-inside space-y-1">
                  <li>Cliquez sur <strong>« Télécharger / Imprimer en PDF »</strong> au haut de ce manuel.</li>
                  <li>Dans la fenêtre de votre navigateur, choisissez la destination <strong>« Enregistrer au format PDF »</strong>.</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Bottom Footer in Modal */}
          <div className="no-print pt-6 border-t border-slate-200 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-500">
            <div>
              ChronoPlan — Conçu pour la fluidité, la précision et la coordination d'équipe.
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePrint}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg font-semibold transition-colors"
              >
                <Printer className="w-3.5 h-3.5" />
                Imprimer / Exporter ce manuel en PDF
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-1.5 bg-slate-900 text-white hover:bg-slate-800 rounded-lg font-semibold transition-colors"
              >
                Fermer l'aide
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
