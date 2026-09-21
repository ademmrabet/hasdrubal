/**
 * Fiche d'identite du restaurant, utilisee pour l'affichage.
 * La source de verite cote base est la cle `restaurant` de la table settings :
 * ces valeurs servent de repli et pour les ecrans publics.
 */
export const RESTAURANT = {
  name: 'Hasdrubal',
  suffix: 'de Carthage',
  fullName: 'Hasdrubal de Carthage',
  phone: '+216 90 177 773',
  phoneDial: '+21690177773',
  address: 'V75X+6X Carthage',
  locatedIn: 'La Percée Verte',
  city: 'Carthage',
  country: 'Tunisie',
  priceRange: 'TND 40 – 100 par personne',
  services: ['Sur place', 'Drive', 'Livraison'],
  instagram: 'hasdrubal_restaurant',
};

/** Horaires : dimanche ferme, service a partir de midi. */
export const OPENING_HOURS = [
  { day: 'Lundi',    open: '12:00', close: '23:00' },
  { day: 'Mardi',    open: '12:00', close: '23:00' },
  { day: 'Mercredi', open: '12:00', close: '23:00' },
  { day: 'Jeudi',    open: '12:00', close: '23:00' },
  { day: 'Vendredi', open: '12:00', close: '23:30' },
  { day: 'Samedi',   open: '12:00', close: '23:30' },
  { day: 'Dimanche', open: null,    close: null },
];
