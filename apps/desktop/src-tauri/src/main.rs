use std::path::PathBuf;

use velofire::http_engine;
use velofire::importers;
use velofire::importers::ImportReport;
use velofire::models::{ApiRequest, ApiResponse, Collection, Environment, RequestHistoryEntry};
use velofire::request_service::{self, ExecuteRequestInput, ExecuteRequestOutput};
use velofire::workspace::FileWorkspaceStore;

#[tauri::command]
async fn send_request(request: ApiRequest) -> Result<ApiResponse, String> {
    http_engine::send_request(request)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
async fn execute_request(input: ExecuteRequestInput) -> Result<ExecuteRequestOutput, String> {
    request_service::execute_request(input)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn import_curl(command: String) -> Result<ApiRequest, String> {
    importers::import_curl(&command).map_err(|error| error.to_string())
}

#[tauri::command]
fn import_postman_collection(content: String) -> Result<ImportReport, String> {
    importers::import_postman_collection(&content).map_err(|error| error.to_string())
}

#[tauri::command]
fn import_openapi(content: String) -> Result<ImportReport, String> {
    importers::import_openapi(&content).map_err(|error| error.to_string())
}

#[tauri::command]
fn init_workspace(root_path: String, name: String) -> Result<velofire::models::Workspace, String> {
    FileWorkspaceStore::new(PathBuf::from(root_path))
        .init(name)
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn load_collections(root_path: String) -> Result<Vec<Collection>, String> {
    FileWorkspaceStore::new(PathBuf::from(root_path))
        .load_collections()
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn save_collection(root_path: String, collection: Collection) -> Result<String, String> {
    FileWorkspaceStore::new(PathBuf::from(root_path))
        .save_collection(&collection)
        .map(|path| path.to_string_lossy().into_owned())
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn load_environments(root_path: String) -> Result<Vec<Environment>, String> {
    FileWorkspaceStore::new(PathBuf::from(root_path))
        .load_environments()
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn save_environment(root_path: String, environment: Environment) -> Result<String, String> {
    FileWorkspaceStore::new(PathBuf::from(root_path))
        .save_environment(&environment)
        .map(|path| path.to_string_lossy().into_owned())
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn load_history(root_path: String) -> Result<Vec<RequestHistoryEntry>, String> {
    FileWorkspaceStore::new(PathBuf::from(root_path))
        .load_history()
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn clear_history(root_path: String) -> Result<(), String> {
    FileWorkspaceStore::new(PathBuf::from(root_path))
        .clear_history()
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn export_collection_json(collection: Collection) -> Result<String, String> {
    FileWorkspaceStore::new(PathBuf::new())
        .export_collection_json(&collection)
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn export_collection_yaml(collection: Collection) -> Result<String, String> {
    FileWorkspaceStore::new(PathBuf::new())
        .export_collection_yaml(&collection)
        .map_err(|error| error.to_string())
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            send_request,
            execute_request,
            import_curl,
            import_postman_collection,
            import_openapi,
            init_workspace,
            load_collections,
            save_collection,
            load_environments,
            save_environment,
            load_history,
            clear_history,
            export_collection_json,
            export_collection_yaml
        ])
        .run(tauri::generate_context!())
        .expect("failed to run Velofire desktop app");
}
