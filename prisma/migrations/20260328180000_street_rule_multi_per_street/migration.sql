-- Allow multiple street rules per (region, street); selection uses union (OR) of rules.
DROP INDEX IF EXISTS "StreetRule_regionId_street_name_key";
