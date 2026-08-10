-- Insert children categories
INSERT INTO "Category" (id, name, "parentId") VALUES
  ('c1a7f3d2-4b8e-4c15-9f60-2d7a6e5b8c31', 'Business - Employees', '66e6ec1e-083e-4305-b933-039db6529f9b')
ON CONFLICT (name) DO NOTHING;
