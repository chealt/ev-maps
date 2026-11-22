-- What's within walking distance of each charger, from OpenStreetMap
-- (src/import/amenities.js): a bit per kind (src/amenities.js). NULL until
-- the charger's area has been looked at.
ALTER TABLE chargers ADD COLUMN amenities INTEGER;
