-- Every deployment that can serve now opens a household at signup, so a user
-- inserted without one is a bug to refuse, not an old build to cover for.
DROP TRIGGER "User_open_own_household" ON "User";
DROP FUNCTION "user_open_own_household"();
