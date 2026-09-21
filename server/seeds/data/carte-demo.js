/**
 * Carte de DEMONSTRATION (plats inventes, avec fiches techniques completes).
 * Elle sert uniquement aux tests automatiques (SEED_MENU=demo) : la vraie carte
 * du restaurant est dans carte-hasdrubal.js.
 *
 * Prix TTC en dinars. Quantites des fiches dans l'unite de l'ingredient
 * (0.18 kg = 180 g).
 */
export const CARTE_DEMO = [
  {
    category: 'Entrées', description: 'Pour ouvrir la table', order: 1,
    items: [
      { name: 'Salade méchouia', price: 18, tags: ['vegetarien', 'epice'], allergens: ['oeufs'],
        description: 'Poivrons et tomates grillés au feu de bois, huile d\'olive, œuf dur.',
        recipe: [['Poivrons verts', 0.18], ['Tomates', 0.15], ['Oignons', 0.05], ['Huile d’olive', 0.03], ['Œufs', 1], ['Harissa', 0.01]] },
      { name: 'Brik à l\'œuf', price: 14, tags: ['classique'], allergens: ['gluten', 'oeufs'],
        description: 'Feuille croustillante, œuf coulant, persil et citron.',
        recipe: [['Œufs', 1], ['Farine', 0.04], ['Persil', 0.1], ['Huile d’olive', 0.05], ['Citrons', 0.03]] },
      { name: 'Salade de crevettes croustillantes', price: 32, tags: ['signature'], allergens: ['crustaces', 'gluten'],
        description: 'Crevettes panées, jeunes pousses, trois sauces maison.',
        recipe: [['Crevettes royales', 0.14], ['Farine', 0.03], ['Citrons', 0.03], ['Huile d’olive', 0.03], ['Tomates', 0.05]] },
      { name: 'Calamars frits', price: 26, tags: [], allergens: ['mollusques', 'gluten'],
        description: 'Anneaux de calamars, citron et sauce tartare.',
        recipe: [['Calamars', 0.2], ['Farine', 0.05], ['Citrons', 0.04], ['Huile d’olive', 0.06]] },
    ],
  },
  {
    category: 'Plats', description: 'Terre et mer de Carthage', order: 2,
    items: [
      { name: 'Couscous à l\'agneau', price: 48, tags: ['classique', 'signature'], allergens: ['gluten'],
        description: 'Semoule fine, épaule d\'agneau, légumes du marché, bouillon relevé.',
        recipe: [['Semoule fine', 0.15], ['Agneau épaule', 0.25], ['Tomates', 0.1], ['Oignons', 0.08], ['Pommes de terre', 0.12], ['Harissa', 0.015], ['Huile d’olive', 0.02]] },
      { name: 'Spaghetti aux crevettes royales', price: 58, tags: ['signature'], allergens: ['gluten', 'crustaces'],
        description: 'Crevettes royales, tomates confites, persil, une pointe de piment.',
        recipe: [['Spaghetti', 0.13], ['Crevettes royales', 0.2], ['Tomates', 0.12], ['Persil', 0.1], ['Huile d’olive', 0.03], ['Harissa', 0.005]] },
      { name: 'Loup de mer grillé', price: 62, tags: [], allergens: ['poisson'],
        description: 'Loup entier grillé, pommes de terre, citron et huile d\'olive.',
        recipe: [['Loup de mer', 0.45], ['Pommes de terre', 0.2], ['Citrons', 0.06], ['Huile d’olive', 0.03]] },
      { name: 'Ojja merguez', price: 36, tags: ['epice'], allergens: ['oeufs'],
        description: 'Sauce tomate et poivrons, merguez maison, œufs pochés.',
        recipe: [['Merguez', 0.18], ['Œufs', 2], ['Tomates', 0.2], ['Poivrons verts', 0.08], ['Harissa', 0.015], ['Huile d’olive', 0.02]] },
      { name: 'Poulet fermier rôti', price: 42, tags: [], allergens: ['lait'],
        description: 'Demi-poulet rôti au beurre, pommes grenaille.',
        recipe: [['Poulet fermier', 0.5], ['Pommes de terre', 0.2], ['Beurre', 0.03], ['Citrons', 0.03]] },
    ],
  },
  {
    category: 'Desserts', description: 'Pour finir en douceur', order: 3,
    items: [
      { name: 'Crème pistache Hasdrubal', price: 22, tags: ['signature'], allergens: ['lait', 'fruits a coque'],
        description: 'Crème onctueuse, éclats de pistache torréfiée.',
        recipe: [['Crème fraîche', 0.12], ['Pistaches', 0.035], ['Sucre', 0.03], ['Œufs', 1]] },
      { name: 'Assiette de fruits de saison', price: 16, tags: ['vegetarien'], allergens: [],
        description: 'Selon le marché du jour.', recipe: [['Citrons', 0.05], ['Menthe fraîche', 0.1]] },
    ],
  },
  {
    category: 'Boissons', description: null, order: 4,
    items: [
      { name: 'Thé à la menthe', price: 6, tags: ['classique'], allergens: [], vat: 19,
        description: 'Thé vert, menthe fraîche.', recipe: [['Thé vert', 0.005], ['Menthe fraîche', 0.2], ['Sucre', 0.02]] },
      { name: 'Eau minérale 1,5 L', price: 5, tags: [], allergens: [], description: null,
        recipe: [['Eau minérale 1,5L', 1]] },
      { name: 'Boisson gazeuse', price: 7, tags: [], allergens: [], description: null,
        recipe: [['Boisson gazeuse 1L', 1]] },
    ],
  },
];
