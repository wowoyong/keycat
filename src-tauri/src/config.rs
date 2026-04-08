use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Clone, Serialize, Deserialize)]
pub struct MonitorInfo {
    pub name: String,
    pub width: u32,
    pub height: u32,
}

#[derive(Clone, Serialize, Deserialize)]
pub struct AppConfig {
    pub schema_version: u32,
    pub cat_skin: String,
    pub size: String,
    pub position: (f64, f64),
    pub monitor: Option<MonitorInfo>,
    pub auto_start: bool,
    // Legacy fields — ignored but kept for backwards compat with existing config files
    #[serde(default)]
    pub cat_hue: Option<f64>,
    #[serde(default)]
    pub cat_saturation: Option<f64>,
    #[serde(default)]
    pub cat_lightness: Option<f64>,
    #[serde(default)]
    pub accent_hue: Option<f64>,
    #[serde(default)]
    pub accent_saturation: Option<f64>,
    #[serde(default)]
    pub accent_lightness: Option<f64>,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            schema_version: 2,
            cat_skin: "orange".into(),
            size: "medium".into(),
            position: (-1.0, -1.0),
            monitor: None,
            auto_start: false,
            cat_hue: None,
            cat_saturation: None,
            cat_lightness: None,
            accent_hue: None,
            accent_saturation: None,
            accent_lightness: None,
        }
    }
}

fn config_path() -> PathBuf {
    let dir = dirs::config_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("keycat");
    fs::create_dir_all(&dir).ok();
    dir.join("settings.json")
}

pub fn load_config() -> AppConfig {
    let path = config_path();
    match fs::read_to_string(&path) {
        Ok(content) => serde_json::from_str(&content).unwrap_or_else(|e| {
            log::warn!("Config parse error, using defaults: {}", e);
            AppConfig::default()
        }),
        Err(_) => {
            log::info!("No config file found, using defaults");
            AppConfig::default()
        }
    }
}

pub fn save_config(config: &AppConfig) {
    let path = config_path();
    match serde_json::to_string_pretty(config) {
        Ok(json) => {
            if let Err(e) = fs::write(&path, json) {
                log::error!("Failed to save config: {}", e);
            }
        }
        Err(e) => log::error!("Failed to serialize config: {}", e),
    }
}

#[tauri::command]
pub fn get_config() -> AppConfig {
    load_config()
}

#[tauri::command]
pub fn set_config(config: AppConfig) {
    save_config(&config);
}

#[tauri::command]
pub fn update_position(x: f64, y: f64) {
    let mut config = load_config();
    config.position = (x, y);
    save_config(&config);
}
