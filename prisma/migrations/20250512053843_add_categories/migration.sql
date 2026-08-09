-- Insert parent categories
INSERT INTO "Category" (id, name, "parentId") VALUES
  ('b1e2c1a2-1f2e-4c3d-8a1b-9c2d3e4f5a6b', 'Food & Drinks', NULL),
  ('c2d3e4f5-2a3b-4c5d-9e1f-0a1b2c3d4e5f', 'Bills', NULL),
  ('d3e4f5a6-3b4c-5d6e-0f1a-1b2c3d4e5f6a', 'Home', NULL),
  ('f5a6b7c8-5d6e-7f8a-2b3c-3d4e5f6a7b8c', 'Income', NULL),
  ('a6b7c8d9-6e7f-8a9b-3c4d-4e5f6a7b8c9d', 'Kids & Babies', NULL),
  ('b7c8d9e0-7f8a-9b0c-4d5e-5f6a7b8c9d0e', 'Investments', NULL),
  ('c8d9e0f1-8a9b-0c1d-5e6f-6a7b8c9d0e1f', 'Technology', NULL),
  ('d9e0f1a2-9b0c-1d2e-6f7a-7b8c9d0e1f2a', 'Shopping', NULL),
  ('e0f1a2b3-0c1d-2e3f-7a8b-8c9d0e1f2a3b', 'Entertainment', NULL),
  ('f1a2b3c4-1d2e-3f4a-8b9c-9d0e1f2a3b4c', 'Health', NULL),
  ('a2b3c4d5-2e3f-4a5b-9c0d-0e1f2a3b4c5d', 'Pets', NULL),
  ('b3c4d5e6-3f4a-5b6c-0d1e-1f2a3b4c5d6e', 'Transportation', NULL),
  ('f7e1a2b3-8888-4f3d-8a1b-9c2d3e4f5a6b', 'Taxes', NULL),
  ('f7e1a2b3-9999-4f3d-8a1b-9c2d3e4f5a6b', 'Donation', NULL),
  ('f7e1a2b3-3333-4f3d-8a1b-9c2d3e4f5a6b', 'Travels', NULL),
  ('f7e1a2b3-aaaa-4f3d-8a1b-9c2d3e4f5a6b', 'Wedding', NULL),
  ('f7e1a2b3-2222-4f3d-8a1b-9c2d3e4f5a6b', 'Other (Expenses)', NULL);

-- Food & Drinks children
INSERT INTO "Category" (id, name, "parentId") VALUES
  ('f7e1a2b3-1111-4c3d-8a1b-9c2d3e4f5a6b', 'Eating out', 'b1e2c1a2-1f2e-4c3d-8a1b-9c2d3e4f5a6b'),
  ('f7e1a2b3-2222-4c3d-8a1b-9c2d3e4f5a6b', 'Bar', 'b1e2c1a2-1f2e-4c3d-8a1b-9c2d3e4f5a6b'),
  ('f7e1a2b3-3333-4c3d-8a1b-9c2d3e4f5a6b', 'Food/Drinks', 'b1e2c1a2-1f2e-4c3d-8a1b-9c2d3e4f5a6b');

-- Bills children
INSERT INTO "Category" (id, name, "parentId") VALUES
  ('f7e1a2b3-4444-4c3d-8a1b-9c2d3e4f5a6b', 'Electricity', 'c2d3e4f5-2a3b-4c5d-9e1f-0a1b2c3d4e5f'),
  ('f7e1a2b3-5555-4c3d-8a1b-9c2d3e4f5a6b', 'Water Bill', 'c2d3e4f5-2a3b-4c5d-9e1f-0a1b2c3d4e5f'),
  ('f7e1a2b3-6666-4c3d-8a1b-9c2d3e4f5a6b', 'Gas Bill', 'c2d3e4f5-2a3b-4c5d-9e1f-0a1b2c3d4e5f'),
  ('f7e1a2b3-7777-4c3d-8a1b-9c2d3e4f5a6b', 'Internet & TV', 'c2d3e4f5-2a3b-4c5d-9e1f-0a1b2c3d4e5f'),
  ('f7e1a2b3-8888-4c3d-8a1b-9c2d3e4f5a6b', 'Phone', 'c2d3e4f5-2a3b-4c5d-9e1f-0a1b2c3d4e5f');

-- Home children
INSERT INTO "Category" (id, name, "parentId") VALUES
  ('f7e1a2b3-aaaa-4c3d-8a1b-9c2d3e4f5a6b', 'Rent', 'd3e4f5a6-3b4c-5d6e-0f1a-1b2c3d4e5f6a'),
  ('f7e1a2b3-cccc-4c3d-8a1b-9c2d3e4f5a6b', 'Home Products', 'd3e4f5a6-3b4c-5d6e-0f1a-1b2c3d4e5f6a'),
  ('f7e1a2b3-dddd-4c3d-8a1b-9c2d3e4f5a6b', 'Building Committee', 'd3e4f5a6-3b4c-5d6e-0f1a-1b2c3d4e5f6a'),
  ('f7e1a2b3-eeee-4c3d-8a1b-9c2d3e4f5a6b', 'Mortgage', 'd3e4f5a6-3b4c-5d6e-0f1a-1b2c3d4e5f6a');

-- Income children
INSERT INTO "Category" (id, name, "parentId") VALUES
  ('f7e1a2b3-aaaa-4d3d-8a1b-9c2d3e4f5a6b', 'Salary', 'f5a6b7c8-5d6e-7f8a-2b3c-3d4e5f6a7b8c'),
  ('f7e1a2b3-bbbb-4d3d-8a1b-9c2d3e4f5a6b', 'Other (Income)', 'f5a6b7c8-5d6e-7f8a-2b3c-3d4e5f6a7b8c'),
  ('f7e1a2b3-cccc-4d3d-8a1b-9c2d3e4f5a6b', 'Odd jobs', 'f5a6b7c8-5d6e-7f8a-2b3c-3d4e5f6a7b8c');

-- Kids & Babies children
INSERT INTO "Category" (id, name, "parentId") VALUES
  ('f7e1a2b3-dddd-4d3d-8a1b-9c2d3e4f5a6b', 'Children', 'a6b7c8d9-6e7f-8a9b-3c4d-4e5f6a7b8c9d'),
  ('f7e1a2b3-eeee-4d3d-8a1b-9c2d3e4f5a6b', 'Family', 'a6b7c8d9-6e7f-8a9b-3c4d-4e5f6a7b8c9d'),
  ('f7e1a2b3-ffff-4d3d-8a1b-9c2d3e4f5a6b', 'Babies', 'a6b7c8d9-6e7f-8a9b-3c4d-4e5f6a7b8c9d');

-- Shopping children
INSERT INTO "Category" (id, name, "parentId") VALUES
  ('f7e1a2b3-3333-4e3d-8a1b-9c2d3e4f5a6b', 'Clothing', 'd9e0f1a2-9b0c-1d2e-6f7a-7b8c9d0e1f2a'),
  ('f7e1a2b3-4444-4e3d-8a1b-9c2d3e4f5a6b', 'Shoes', 'd9e0f1a2-9b0c-1d2e-6f7a-7b8c9d0e1f2a'),
  ('f7e1a2b3-6666-4e3d-8a1b-9c2d3e4f5a6b', 'Books/Magazines', 'd9e0f1a2-9b0c-1d2e-6f7a-7b8c9d0e1f2a'),
  ('f7e1a2b3-7777-4e3d-8a1b-9c2d3e4f5a6b', 'eBay/AliExpress', 'd9e0f1a2-9b0c-1d2e-6f7a-7b8c9d0e1f2a'),
  ('f7e1a2b3-8888-4e3d-8a1b-9c2d3e4f5a6b', 'Gifts', 'd9e0f1a2-9b0c-1d2e-6f7a-7b8c9d0e1f2a');

-- Entertainment children
INSERT INTO "Category" (id, name, "parentId") VALUES
  ('f7e1a2b3-aaaa-4e3d-8a1b-9c2d3e4f5a6b', 'Sport', 'e0f1a2b3-0c1d-2e3f-7a8b-8c9d0e1f2a3b'),
  ('f7e1a2b3-bbbb-4e3d-8a1b-9c2d3e4f5a6b', 'XBOX', 'e0f1a2b3-0c1d-2e3f-7a8b-8c9d0e1f2a3b'),
  ('f7e1a2b3-cccc-4e3d-8a1b-9c2d3e4f5a6b', 'Cinema', 'e0f1a2b3-0c1d-2e3f-7a8b-8c9d0e1f2a3b');

-- Health children
INSERT INTO "Category" (id, name, "parentId") VALUES
  ('f7e1a2b3-eeee-4e3d-8a1b-9c2d3e4f5a6b', 'HMO/Health Fund', 'f1a2b3c4-1d2e-3f4a-8b9c-9d0e1f2a3b4c');

-- Pets children
INSERT INTO "Category" (id, name, "parentId") VALUES
  ('f7e1a2b3-0000-4e3d-8a1b-9c2d3e4f5a6b', 'Food - Pets', 'a2b3c4d5-2e3f-4a5b-9c0d-0e1f2a3b4c5d');

-- Transportation children
INSERT INTO "Category" (id, name, "parentId") VALUES
  ('f7e1a2b3-1111-4f3d-8a1b-9c2d3e4f5a6b', 'Car', 'b3c4d5e6-3f4a-5b6c-0d1e-1f2a3b4c5d6e'),
  ('f7e1a2b3-4444-4f3d-8a1b-9c2d3e4f5a6b', 'Taxi', 'b3c4d5e6-3f4a-5b6c-0d1e-1f2a3b4c5d6e'),
  ('f7e1a2b3-5555-4f3d-8a1b-9c2d3e4f5a6b', 'Bikes & Scooters', 'b3c4d5e6-3f4a-5b6c-0d1e-1f2a3b4c5d6e'),
  ('f7e1a2b3-6666-4f3d-8a1b-9c2d3e4f5a6b', 'Bird', 'b3c4d5e6-3f4a-5b6c-0d1e-1f2a3b4c5d6e'),
  ('f7e1a2b3-ffff-4c3d-8a1b-9c2d3e4f5a6b', 'Fuel', 'b3c4d5e6-3f4a-5b6c-0d1e-1f2a3b4c5d6e'),
  ('f7e1a2b3-0000-4c3d-8a1b-9c2d3e4f5a6b', 'Insurance', 'b3c4d5e6-3f4a-5b6c-0d1e-1f2a3b4c5d6e');

-- Accommodation as child of Travels
INSERT INTO "Category" (id, name, "parentId") VALUES
  ('f7e1a2b3-7777-4f3d-8a1b-9c2d3e4f5a6b', 'Accommodation', 'f7e1a2b3-3333-4f3d-8a1b-9c2d3e4f5a6b'),
  ('3a43001f-fa9a-429f-a093-fc3f4ef301e6', 'Transportation - Travels', 'f7e1a2b3-3333-4f3d-8a1b-9c2d3e4f5a6b'),
  ('e39dc398-e41f-4878-8f0f-bb4cc75333b1', 'Car Rental', 'f7e1a2b3-3333-4f3d-8a1b-9c2d3e4f5a6b'),
  ('4370a372-df95-4b3e-93c1-fa3c0d7c617e', 'Other (Travels)', 'f7e1a2b3-3333-4f3d-8a1b-9c2d3e4f5a6b');