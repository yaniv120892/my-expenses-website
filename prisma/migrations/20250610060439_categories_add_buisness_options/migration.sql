-- Insert parent categories
INSERT INTO "Category" (id, name, "parentId") VALUES
  ('66e6ec1e-083e-4305-b933-039db6529f9b', 'Business', NULL);


-- Insert children categories
INSERT INTO "Category" (id, name, "parentId") VALUES
  ('0369180d-981f-49a2-80f8-89387c2b49a1', 'Business - Incomes', '66e6ec1e-083e-4305-b933-039db6529f9b'),
  ('48b3d0df-68ba-41d0-91b6-6b33e87a410c', 'Business - Equipment', '66e6ec1e-083e-4305-b933-039db6529f9b'),
  ('6fd49628-b2db-43bb-98a3-1051be42de19', 'Business - Other expenses', '66e6ec1e-083e-4305-b933-039db6529f9b');
  

