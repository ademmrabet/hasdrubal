-- =====================================================================
-- 003 — Fiche du restaurant et horaires de service
-- Source : Google Maps et compte Instagram du restaurant.
-- =====================================================================

INSERT INTO settings (key, value) VALUES (
  'restaurant',
  '{
     "name": "Hasdrubal",
     "suffix": "de Carthage",
     "fullName": "Hasdrubal de Carthage",
     "currency": "TND",
     "locale": "fr-TN",
     "phone": "+216 90 177 773",
     "address": "V75X+6X Carthage",
     "locatedIn": "La Percée Verte",
     "city": "Carthage",
     "country": "Tunisie",
     "priceRange": "TND 40 - 100 par personne",
     "services": ["Sur place", "Drive", "Livraison"],
     "instagram": "hasdrubal_restaurant",
     "taxId": null
   }'::jsonb
)
ON CONFLICT (key) DO UPDATE
  SET value = settings.value || EXCLUDED.value,   -- conserve un matricule fiscal deja saisi
      updated_at = now();

-- Dimanche ferme, service a partir de midi.
INSERT INTO settings (key, value) VALUES (
  'opening_hours',
  '{
     "monday":    {"open": "12:00", "close": "23:00"},
     "tuesday":   {"open": "12:00", "close": "23:00"},
     "wednesday": {"open": "12:00", "close": "23:00"},
     "thursday":  {"open": "12:00", "close": "23:00"},
     "friday":    {"open": "12:00", "close": "23:30"},
     "saturday":  {"open": "12:00", "close": "23:30"},
     "sunday":    null
   }'::jsonb
)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();

-- Palette de la charte, pour les futurs documents generes (factures, menu QR).
INSERT INTO settings (key, value) VALUES (
  'branding',
  '{
     "copper": "#a8683a",
     "sand":   "#e9cf9e",
     "cream":  "#fffcf6",
     "gold":   "#c79a3e",
     "olive":  "#6e7a4f",
     "ink":    "#3a2a1c",
     "displayFont": "Cinzel",
     "bodyFont": "Inter"
   }'::jsonb
)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();
