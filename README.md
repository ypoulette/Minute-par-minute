# ChronoPlan — Minute par Minute

Application collaborative de planification d'événement minute par minute (Relais pour la vie 2026), avec calcul automatique des dates à partir des étapes (Steps), cascade horaire des dépendances, assignation de ressources, vue détaillée avec blocs de texte narratifs et export Excel.

---

## 🚀 Fonctionnalités principales

1. **Planification multi-blocs et chronologique** :
   - Organisation par blocs (Bloc 00 à Bloc 10) et affichage chronologique linéaire.
   - Calcul dynamique des dates réelles à partir de la date de l'événement et du décalage (Step en jours).
   - Cascade horaire intelligente : les activités dépendantes recalculent automatiquement leur heure de début selon l'heure de fin de leur activité parente.
   - Détection des boucles de dépendance et indicateurs d'avertissement.

2. **Collaboration en équipe temps réel (Lecture & Écriture)** :
   - Authentification Firebase (Google Sign-In et Courriel / Mot de passe).
   - Gestion d'accès d'équipe intégrée via le bouton **« Équipe »** :
     - L'administrateur (`yvespoulette@live.ca` ou créateur) peut inviter les membres de l'équipe de projet en ajoutant simplement leur adresse courriel.
     - Les membres autorisés bénéficient d'un accès complet en **lecture et écriture** synchronisé en temps réel via Google Cloud Firestore.

3. **Préservation et gestion du contenu** :
   - Le contenu complet de l'événement (tiré du fichier de référence `Minute par Minute 2 juin 2026`) est directement intégré dans le dossier `public/assets/aistudio/Minute_par_Minute_2_juin_2026_7c0e0a34.csv`.
   - Fonction d'import CSV (remplacement de l'événement ou création d'un nouvel événement).
   - Export Excel complet (`.xlsx`) avec ou sans colonne narrative/texte.

---

## 📁 Structure du projet

```text
Minute par minute/
├── firebase-applet-config.json    # Configuration Firebase (Auth & Firestore)
├── index.html                     # Page d'accueil HTML
├── package.json                   # Dépendances React 19, Vite, Tailwind, Firebase, XLSX
├── tsconfig.json                  # Configuration TypeScript
├── vite.config.ts                 # Configuration Vite
├── public/
│   └── assets/aistudio/           # Données initiales CSV (Minute par Minute 2 juin 2026)
└── src/
    ├── main.tsx                   # Point d'entrée React
    ├── App.tsx                    # Composant racine avec gestion d'état, filtres et synchronisation
    ├── index.css                  # Styles Tailwind CSS et polices (DM Sans, Plus Jakarta Sans, JetBrains Mono)
    ├── components/
    │   ├── ActivityDetailPage.tsx     # Fiche détaillée d'une activité
    │   ├── AuthScreen.tsx             # Écran d'authentification (Google SSO / Courriel)
    │   ├── CompactFullTextView.tsx    # Vue texte compacte avec édition directe
    │   ├── ErrorBoundary.tsx          # Gestionnaire d'erreurs d'affichage
    │   ├── ImportCsvModal.tsx         # Modal d'import de fichier CSV
    │   ├── NewActivityModal.tsx       # Modal de création d'activité
    │   ├── ResourceCreatableSelect.tsx # Sélecteur avec ajout direct de ressource
    │   ├── ResourceMultiSelect.tsx    # Sélection multiple d'exécutants
    │   ├── ResourcesModal.tsx         # Gestion des ressources et blocs
    │   ├── ScheduleTable.tsx          # Tableau principal avec drag-and-drop & arborescence
    │   ├── TeamModal.tsx              # Gestion des membres de l'équipe et accès
    │   └── TimePickerDropdown.tsx     # Sélecteur d'heures (format HH:MM, AM, PM)
    ├── lib/
    │   ├── firebase.ts                # Initialisation de Firebase Auth et Firestore
    │   └── plannerService.ts          # Requêtes Firestore en temps réel (Events, Activités, Équipe)
    ├── types/
    │   └── planner.ts                 # Définitions TypeScript (EventPlan, ActivityItem, ComputedActivity)
    └── utils/
        ├── csvImporter.ts             # Parser CSV avec détection de séparateurs et normalisation
        ├── etapeDefaults.ts           # Descriptions et titres par défaut des blocs 00 à 10
        ├── excelExport.ts             # Générateur de fichiers Excel (.xlsx) avec mise en page
        └── scheduleEngine.ts          # Moteur de calcul des dates, heures cascadées et WBS
```

---

## 👥 Comment permettre l'accès Lecture / Écriture à votre équipe

### 1. Ajouter un membre à l'équipe dans l'application
1. Connectez-vous à ChronoPlan avec votre compte administrateur (`yvespoulette@live.ca`).
2. Dans la barre supérieure, cliquez sur le bouton **« Équipe »**.
3. Saisissez l'adresse courriel du collègue (ex: `prenom.nom@exemple.com`) et cliquez sur **« Ajouter »**.
4. Cliquez sur **« Enregistrer l'équipe »**.
5. L'adresse est immédiatement ajoutée à la liste `teamEmails` de l'événement et de toutes ses activités dans Firestore. Dès que ce collègue se connecte (avec Google ou par courriel/mot de passe), l'événement s'ouvre automatiquement avec les droits de modification en temps réel.

### 2. Déployer l'application pour que l'équipe y accède facilement
L'URL d'origine `ais-dev-...run.app` étant un environnement de développement interne Google AI Studio restreint, vous pouvez publier l'application pour toute votre équipe :

#### Option A — Déploiement Firebase Hosting (Recommandé)
Le projet Firebase est déjà configuré (`gen-lang-client-0730235019`) :
```bash
npm install -g firebase-tools
firebase login
firebase init hosting
firebase deploy --only hosting
```
L'application sera accessible publiquement sur `https://gen-lang-client-0730235019.web.app` (sécurisée par l'écran d'authentification).

#### Option B — Déploiement Vercel ou Netlify
1. Pousser le dossier sur GitHub ou GitLab.
2. Importer le dépôt sur [Vercel](https://vercel.com) ou [Netlify](https://netlify.com) (commande de build: `npm run build`, dossier: `dist`).
3. Vous obtenez une URL d'équipe permanente (ex: `https://chronoplan-relais.vercel.app`).

#### Option C — Exécution locale ou sur réseau d'entreprise
```bash
npm install
npm run dev -- --host
```
Vous pouvez partager l'adresse IP locale affichée dans le terminal (ex: `http://192.168.1.XX:3000`) avec les personnes sur le même réseau.
