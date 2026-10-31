-- Every deployment that can serve now opens a household at signup, so a user
-- inserted without one is a bug to refuse, not an old build to cover for.
-- IF EXISTS because a shared preview database had already lost the trigger,
-- and a failed migration there blocks every later deploy against it.
DROP TRIGGER IF EXISTS "User_open_own_household" ON "User";
DROP FUNCTION IF EXISTS "user_open_own_household"();
