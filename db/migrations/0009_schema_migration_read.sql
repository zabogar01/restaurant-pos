-- The server refuses to start when the migrations recorded in the database are
-- not the files in db/migrations (PHASE1-S0), and it connects as pos_app.
-- pos_app may therefore read which migrations were applied. It gets SELECT and
-- nothing else: it can never record or erase one, so the separation between
-- the application role and the owner (ARCHITECTURE §11) stands. The runner
-- creates schema_migration before any migration runs, so the table exists here.
GRANT SELECT ON schema_migration TO pos_app;
