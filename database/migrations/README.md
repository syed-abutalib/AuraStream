# Existing database

No migration is required for the supplied eight-table schema. The application does not run DDL or seed credentials at startup.

`../schema.sql` is a structure-only snapshot of the original XAMPP database. Its `CREATE TABLE IF NOT EXISTS` statements are intended for a **new** database or isolated tests. Do not import it to change existing columns. Back up existing data before applying any future migration.

Foreign keys use the original `ON DELETE CASCADE` rules. Deleting a song intentionally removes its playlist membership, favorites, listening events and download history. Counts on the admin dashboard reflect the remaining catalog.
