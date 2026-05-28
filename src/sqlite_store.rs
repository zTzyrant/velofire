use crate::models::{Collection, Environment, RequestHistoryEntry};
use rusqlite::{Connection, params};
use std::path::Path;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum SqliteStoreError {
    #[error("sqlite error: {0}")]
    Sqlite(#[from] rusqlite::Error),
    #[error("serialization error: {0}")]
    Serialization(#[from] serde_json::Error),
}

pub type SqliteStoreResult<T> = Result<T, SqliteStoreError>;

pub struct SqliteStore {
    connection: Connection,
}

impl SqliteStore {
    pub fn open(path: impl AsRef<Path>) -> SqliteStoreResult<Self> {
        let connection = Connection::open(path)?;
        let store = Self { connection };
        store.migrate()?;
        Ok(store)
    }

    pub fn in_memory() -> SqliteStoreResult<Self> {
        let connection = Connection::open_in_memory()?;
        let store = Self { connection };
        store.migrate()?;
        Ok(store)
    }

    pub fn migrate(&self) -> SqliteStoreResult<()> {
        self.connection.execute_batch(
            r#"
            CREATE TABLE IF NOT EXISTS collections (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                document TEXT NOT NULL,
                created_at TEXT,
                updated_at TEXT
            );

            CREATE TABLE IF NOT EXISTS environments (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                variables TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS history (
                id TEXT PRIMARY KEY,
                request_snapshot TEXT NOT NULL,
                response_snapshot TEXT,
                created_at TEXT NOT NULL
            );
            "#,
        )?;
        Ok(())
    }

    pub fn save_collection(&self, collection: &Collection) -> SqliteStoreResult<()> {
        let document = serde_json::to_string(collection)?;
        self.connection.execute(
            r#"
            INSERT INTO collections (id, name, document, created_at, updated_at)
            VALUES (?1, ?2, ?3, ?4, ?5)
            ON CONFLICT(id) DO UPDATE SET
                name = excluded.name,
                document = excluded.document,
                updated_at = excluded.updated_at
            "#,
            params![
                collection.id,
                collection.name,
                document,
                collection.created_at,
                collection.updated_at
            ],
        )?;
        Ok(())
    }

    pub fn load_collections(&self) -> SqliteStoreResult<Vec<Collection>> {
        let mut statement = self
            .connection
            .prepare("SELECT document FROM collections ORDER BY name ASC")?;
        let rows = statement.query_map([], |row| row.get::<_, String>(0))?;
        let mut collections = Vec::new();
        for row in rows {
            collections.push(serde_json::from_str(&row?)?);
        }
        Ok(collections)
    }

    pub fn save_environment(&self, environment: &Environment) -> SqliteStoreResult<()> {
        let variables = serde_json::to_string(&environment.variables)?;
        self.connection.execute(
            r#"
            INSERT INTO environments (id, name, variables)
            VALUES (?1, ?2, ?3)
            ON CONFLICT(id) DO UPDATE SET
                name = excluded.name,
                variables = excluded.variables
            "#,
            params![environment.id, environment.name, variables],
        )?;
        Ok(())
    }

    pub fn append_history(&self, entry: &RequestHistoryEntry) -> SqliteStoreResult<()> {
        let request = serde_json::to_string(&entry.request_snapshot)?;
        let response = entry
            .response_snapshot
            .as_ref()
            .map(serde_json::to_string)
            .transpose()?;
        self.connection.execute(
            r#"
            INSERT INTO history (id, request_snapshot, response_snapshot, created_at)
            VALUES (?1, ?2, ?3, ?4)
            "#,
            params![entry.id, request, response, entry.created_at],
        )?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::Collection;

    #[test]
    fn saves_and_loads_collection() {
        let store = SqliteStore::in_memory().unwrap();
        let collection = Collection::new("Demo");

        store.save_collection(&collection).unwrap();
        let loaded = store.load_collections().unwrap();

        assert_eq!(loaded[0].name, "Demo");
    }
}
