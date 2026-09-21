/**
 * Carte reelle de Hasdrubal de Carthage, retranscrite depuis la carte papier
 * (cuisine mediterraneenne, "Midi a minuit").
 *
 * - Prix TTC en dinars (DT), tels qu'imprimes sur la carte.
 * - `price: null` : prix illisible ou absent sur la carte. Le plat est importe
 *   INACTIF (donc absent du menu public) jusqu'a ce que le prix soit saisi.
 * - Les orthographes de la carte sont conservees ("panco", "tartuffo"...).
 *   Les mots coupes par la photo sont completes au plus probable et listes
 *   dans `A_VERIFIER` ci-dessous.
 * - `allergens` est DEDUIT des ingredients affiches (la carte papier n'en
 *   indique aucun). Approche prudente : en cas de doute on l'ajoute. Cette
 *   liste doit etre relue par la cuisine avant impression du QR code.
 */

export const A_VERIFIER = [
  'Toast poulpe avocat : prix absent de la photo (importe inactif).',
  'Filet de Saint Pierre : prix absent de la photo (importe inactif).',
  'Tyropita : "miel et s… noir" coupe sur la photo, lu comme "sésame noir".',
  'Ravioli ricotta épinards / Gnocchi crema di formaggi : "croustillant" coupe, complété.',
  '"Suprême" corrigé (la carte imprime "Suprpême") ; "panco", "tartuffo", "pistachio" gardés tels quels.',
  'Allergènes : déduits des ingrédients, à faire valider par la cuisine.',
];

export const CARTE_HASDRUBAL = [
  {
    category: 'Entrées froides', order: 1, description: null,
    items: [
      { name: 'Insalata di burrata mediterranea', price: 36, allergens: ['lait', 'fruits a coque'],
        description: 'Burrata, salade, roquette, tomates cerises, bresaola, sauce pesto et noix concassées.' },
      { name: 'Tartare d’avocat sur son lit de quinoa', price: 38, allergens: ['crustaces'],
        description: 'Avocat, oignons, tomates, quinoa et crevettes.' },
      { name: 'Carpaccio de bœuf', price: 36, allergens: ['poisson', 'oeufs'],
        description: 'Sauce au thon, fleur de câpres, tomates cerises.' },
      { name: 'Tartare d’avocat saumon et ananas', price: 40, allergens: ['poisson'], description: null },
      { name: 'Insalata mediterranea', price: 32, allergens: ['lait', 'sesame'], tags: ['vegetarien'],
        description: 'Mesclun de salade, fruits de saison, fromage de chèvre aux trois sésames.' },
      { name: 'Toast poulpe avocat', price: null, allergens: ['gluten', 'mollusques'],
        description: 'Pain complet, poulpe, avocat, oignons, tomates.' },
      { name: 'Carpaccio de poulpe', price: 43, allergens: ['mollusques'], description: null },
    ],
  },
  {
    category: 'Entrées chaudes', order: 2, description: null,
    items: [
      { name: 'Insalata con supreme di pollo', price: 30, allergens: [],
        description: 'Suprême de poulet, mesclun de salade, tomates cerises et bacon.' },
      { name: 'Mozzarella in carrozza', price: 28, allergens: ['gluten', 'lait', 'oeufs'], tags: ['vegetarien'],
        description: 'Mozzarella panées au panco, mesclun de salades, tomates cerises et oignons caramélisés.' },
      { name: 'Cocktail de crevettes au panco', price: 40, allergens: ['crustaces', 'gluten', 'oeufs'],
        description: 'Crevettes panées au panco, mesclun de salade, sauce cocktail maison.' },
      { name: 'Calamars dorés sauce tartare', price: 45, allergens: ['mollusques', 'gluten', 'oeufs'],
        description: 'Calamars panés au panco, mesclun de salade, sauce tartare.' },
      { name: 'Tyropita', price: 32, allergens: ['lait', 'gluten', 'sesame'], tags: ['vegetarien'],
        description: 'Fromage féta, pâte filo, thym, miel et sésame noir.' },
      { name: 'Arancini', price: 35, allergens: ['gluten', 'lait', 'oeufs'],
        description: 'Boulettes de riz panées farci à la sauce bolognaise et mozzarella.' },
    ],
  },
  {
    category: 'Pâtes', order: 3, description: 'Pâtes fraîches',
    items: [
      { name: 'Pasta Alfredo', price: 35, allergens: ['gluten', 'oeufs', 'lait'],
        description: 'Émincée de poulet, champignons, sauce blanche.' },
      { name: 'Spaghetti con gamberi', price: 45, allergens: ['gluten', 'oeufs', 'crustaces', 'lait'],
        description: 'Sauce rosée, tomates cerises, courgettes, basilic.' },
      { name: 'Spaghetti frutti di mare', price: 55, allergens: ['gluten', 'oeufs', 'crustaces', 'mollusques'],
        description: 'Sauce tomates fraîches, basilic.' },
      { name: 'Spaghetti calamars et boutargue', price: 56, allergens: ['gluten', 'oeufs', 'mollusques', 'poisson'],
        description: 'Sauce à l’ail, tomates cerises, persil.' },
      { name: 'Tagliatelle salsa tartuffo', price: 43, allergens: ['gluten', 'oeufs', 'lait'],
        description: 'Sauce aux truffes, champignons, copeaux de parmesan.' },
      { name: 'Tagliatelle a modo mio', price: 42, allergens: ['gluten', 'oeufs', 'lait'],
        description: 'Sauce rosée, champignons, sauce bolognaise.' },
      { name: 'Rigatoni au crabe et crème de brocoli', price: 45, allergens: ['gluten', 'crustaces', 'lait'],
        description: 'Effiloché de crabe, crème de brocoli.' },
      { name: 'Rigatoni tomates cerises et noix de cajou', price: 42, allergens: ['gluten', 'lait', 'fruits a coque'],
        description: 'Sauce rosée, tomates cerises confites, ricotta et noix de cajou.' },
      { name: 'Rigatoni au saumon', price: 65, allergens: ['gluten', 'poisson', 'lait'],
        description: 'Sauce rosée, saumon frais, saumon fumé, aneth.' },
    ],
  },
  {
    category: 'Risottos', order: 4, description: null,
    items: [
      { name: 'Risotto artichaut bacon', price: 43, allergens: ['lait', 'fruits a coque'],
        description: 'Sauce à la crème, crème d’artichaut, gorgonzola et noix concassées.' },
      { name: 'Risotto frutti di mare', price: 55, allergens: ['crustaces', 'mollusques'],
        description: 'Fruits de mer, sauce tomates fraîches, basilic.' },
      { name: 'Risotto pesto crevettes', price: 48, allergens: ['crustaces', 'lait', 'fruits a coque'],
        description: 'Sauce pesto, crème.' },
    ],
  },
  {
    category: 'Ravioli', order: 5, description: null,
    items: [
      { name: 'Ravioli ricotta épinards', price: 35, allergens: ['gluten', 'oeufs', 'lait'],
        description: 'Crème, champignons, bacon croustillant.' },
      { name: 'Ravioli salmone', price: 48, allergens: ['gluten', 'oeufs', 'poisson', 'lait', 'fruits a coque'],
        description: 'Sauce rosée, pistache concassées.' },
      { name: 'Ravioli nero crevettes courgettes', price: 48, allergens: ['gluten', 'oeufs', 'crustaces', 'mollusques', 'lait'],
        description: 'Sauce rosée, chevrettes, courgettes.' },
    ],
  },
  {
    category: 'Gnocchi', order: 6, description: null,
    items: [
      { name: 'Gnocchi al pesto', price: 32, allergens: ['gluten', 'oeufs', 'lait', 'fruits a coque'], tags: ['vegetarien'],
        description: 'Pesto basilic, parmesan et noix.' },
      { name: 'Gnocchi crema di formaggi e bacon', price: 36, allergens: ['gluten', 'oeufs', 'lait', 'fruits a coque'],
        description: 'Crème, gorgonzola, bacon croustillant et pistache concassées.' },
    ],
  },
  {
    category: 'Viandes', order: 7, description: 'Nos viandes',
    items: [
      { name: 'Scalopina di pollo', price: 38, allergens: ['lait'],
        description: 'Suprême de poulet, sauce à la crème et aux champignons et pommes au four au romarin.' },
      { name: 'Émincée de poulet à la crème', price: 40, allergens: ['lait'],
        description: 'Émincée de poulet, crème et mousseline de pommes de terre.' },
      { name: 'Émincée de bœuf beurre et sauge', price: 58, allergens: ['gluten', 'oeufs', 'lait'],
        description: 'Émincée de bœuf aux champignons et tagliatelle à la crème.' },
      { name: 'Suprême / cuisse de poulet fermier sauce à l’orange', price: 43, allergens: [],
        description: 'Suprême ou cuisse de poulet fermier farci aux épinards et champignons et riz safrané.' },
      { name: 'Filetto di manzo alla fiorentina', price: 78, allergens: ['lait'],
        description: 'Filet grillé, gratiné aux parmesan et aux épinards, purée à la crème de truffe, sauce champignons.' },
      { name: 'Filet grillé, mousse de crevettes', price: 90, allergens: ['crustaces', 'lait'],
        description: 'Filet de bœuf poêlé mousse de crevettes et chevrettes grillés.' },
      { name: 'Stinco di agnello cottura lenta', price: 75, allergens: ['lait'],
        description: 'Souris d’agneau cuisson basse température, miel, fruits confits et purée à la crème.' },
      { name: 'Le filet Hasdrubal', price: 85, allergens: [], tags: ['signature'],
        description: 'Filet de bœuf grillé, pâté de foie, purée de patate douce, pomme allumette et feuille d’or.' },
      { name: 'Souris d’agneau au riz safrané', price: 85, allergens: [],
        description: 'Souris d’agneau confite, riz safrané aux châtaignes.' },
      { name: 'Costada di manzo 400 g', price: 85, allergens: ['moutarde', 'sesame'],
        description: 'Côte à l’os grillée, sauce à la moutarde, légumes sautés glacés à la mélasse de dattes et graines de sésame.' },
    ],
  },
  {
    category: 'Poissons', order: 8, description: null,
    items: [
      { name: 'Misto scoglio', price: 85, allergens: ['poisson', 'crustaces', 'mollusques'],
        description: 'Symphonie de fruits de mer grillés, pommes au four et légumes poêlés.' },
      { name: 'Gamberi saltati con crema di burrata', price: 65, allergens: ['crustaces', 'lait'],
        description: 'Brochettes de crevettes, sauce à l’ail et tomates cerises et crème de burrata.' },
      { name: 'Escalope de saumon beurre blanc et sauce à l’orange', price: 68, allergens: ['poisson', 'lait', 'fruits a coque'],
        description: 'Purée à la crème de noisette.' },
      { name: 'Filet de loup sauvage poêlé', price: 72, allergens: ['poisson', 'mollusques', 'lait', 'fruits a coque'],
        description: 'Sauce beurre blanc aux moules et au câpre, légumes sautés et purés à la noisette.' },
      { name: 'Tranche d’espadon ou de mérou à la méditerranéenne', price: 68, allergens: ['poisson'],
        description: 'Sauce tomates fraîches, olives, câpres, citron confit, pommes au four.' },
      { name: 'Escalope de saumon', price: 65, allergens: ['poisson', 'lait'],
        description: 'Tranche de saumon, sauce rosée, pommes au four.' },
      { name: 'Filet de Saint Pierre', price: null, allergens: ['poisson', 'lait', 'fruits a coque'],
        description: 'Cuisson à l’unilatérale, légumes fondants et purée à la noisette.' },
    ],
  },
  {
    category: 'Desserts', order: 9, description: 'Nos desserts',
    items: [
      { name: 'Sorbet citron', price: 15, allergens: [], tags: ['vegetarien'], description: null },
      { name: 'Tiramisu alla due varianti', price: 20, allergens: ['lait', 'oeufs', 'gluten', 'fruits a coque'], tags: ['vegetarien'],
        description: 'Tiramisu maison crème de mascarpone traditionnel ou à la pistache.' },
      { name: 'Affogato pistachio', price: 20, allergens: ['lait', 'fruits a coque'], tags: ['vegetarien'],
        description: 'Pâte pistache, café et boule de glace vanille.' },
      { name: 'Panna cotta alla frutti di stagione', price: 20, allergens: ['lait'], tags: ['vegetarien'],
        description: 'Coulis de fruits rouges, passion ou fruit du dragon.' },
      { name: 'Glace pistache / noisettes', price: 20, allergens: ['lait', 'fruits a coque'], tags: ['vegetarien'], description: null },
      { name: 'Dessert du jour', price: 25, allergens: [], description: 'Selon disponibilité.' },
    ],
  },
  {
    category: 'Boissons', order: 10, description: null,
    items: [
      { name: 'Eau plate / gazéifiée', price: 6, allergens: [], description: null },
      { name: 'Café', price: 6, allergens: [], description: null },
      { name: 'Citronnade', price: 12, allergens: [], description: null },
      { name: 'Bière sans alcool', price: 9, allergens: ['gluten'], description: null },
      { name: 'Boisson énergétique', price: 15, allergens: [], description: null },
      { name: 'Jus frais', price: 15, allergens: [], description: null },
      { name: 'Mojito', price: 15, allergens: [], description: null },
    ],
  },
];
