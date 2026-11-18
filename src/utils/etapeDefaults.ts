import type { EtapeDetail } from '../types/planner';

export const DEFAULT_ETAPE_DETAILS: Record<string, EtapeDetail> = {
  'Bloc 00': {
    title: 'Préparation du site',
    description:
      'Logistique pré-événement, livraisons, montage des chapiteaux, sonorisation et accueil des bénévoles',
  },
  'Bloc 01': {
    title: 'Accueil',
    description:
      'Ouverture officielle du site, musique d’ambiance, séance d’échauffement et accueil des participants',
  },
  'Bloc 02': {
    title: 'Cocktail des Porteurs d’Espoir',
    description:
      'Pavillon Mille-Roches — accueil des Porteurs d’Espoir et accompagnateurs, allocutions et tirages',
  },
  'Bloc 03': {
    title: 'Cérémonie d’ouverture',
    description:
      'Protocole officiel sur la scène extérieure et prises de parole des invités et dignitaires',
  },
  'Bloc 04': {
    title: 'Tour de l’Espoir',
    description:
      'Légende du papillon, coupe du ruban jaune et premier tour de piste des Porteurs d’Espoir',
  },
  'Bloc 05': {
    title: 'Marche des équipes',
    description:
      'On marche les uns avec les autres — ambiance dynamique sur la piste et préparation de la suite',
  },
  'Bloc 06': {
    title: 'Hommage aux marcheurs',
    description:
      'Reconnaissance des marcheurs individuels et capitaines, jeu Saviez-vous que et photo de groupe',
  },
  'Bloc 07': {
    title: 'Cérémonie des Luminaires',
    description:
      'Hommage aux personnes atteintes et disparues, montgolfière, cornemuse, minute de silence et prestation musicale',
  },
  'Bloc 08': {
    title: 'Retour au calme',
    description:
      'Service de la soupe, couvre-feu municipal, dernières consignes et bilan de la trésorerie',
  },
  'Bloc 09': {
    title: 'Cérémonie de clôture',
    description:
      'Dernier tour de piste, dévoilement des statistiques et du montant final amassé, mot de la fin',
  },
  'Bloc 10': {
    title: 'Démontage du site',
    description:
      'Ramassage, inventaire du matériel, retours aux fournisseurs et rencontre post-événement',
  },
};

export function getEtapeDisplay(
  etapeKey: string,
  etapeDetails?: Record<string, EtapeDetail>
): EtapeDetail {
  const custom = etapeDetails?.[etapeKey];
  const fallback = DEFAULT_ETAPE_DETAILS[etapeKey];

  if (custom) {
    return {
      title: custom.title || fallback?.title || '',
      description: custom.description ?? fallback?.description ?? '',
    };
  }

  if (fallback) {
    return fallback;
  }

  return {
    title: '',
    description: '',
  };
}
