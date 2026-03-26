// =============================================================
// LBF Stock v2 — Configuration Supabase
// À remplir avec les valeurs de votre projet Supabase
// NE PAS COMMITTER ce fichier avec de vraies valeurs de prod
// =============================================================

// Récupérer ces valeurs dans : Supabase Dashboard → Settings → API
const SUPABASE_URL     = 'https://VOTRE_PROJET.supabase.co';
const SUPABASE_ANON_KEY = 'VOTRE_CLE_ANON_ICI';

// Paramètres de l'application
const APP_CONFIG = {
  // Préfixe pour les IDs de barres
  prefixeProfil: 'BAR',
  prefixeTole: 'TOL',

  // Nombre de chiffres dans l'ID (ex: BAR-0001 → 4 chiffres)
  idPadding: 4,

  // Nuances acier disponibles
  nuancesAcier: ['S235', 'S275', 'S355', 'S420', 'S460'],

  // Disponibilités possibles
  disponibilites: ['disponible', 'reserve', 'sorti'],

  // Statuts de validation
  statuts: ['valide', 'en_attente', 'rejete', 'archive'],
};
