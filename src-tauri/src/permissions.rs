// src-tauri/src/permissions.rs

#[cfg(target_os = "macos")]
pub fn check_and_request_accessibility() -> bool {
    use macos_accessibility_client::accessibility;
    if accessibility::application_is_trusted() {
        log::info!("Accessibility permission granted");
        return true;
    }
    log::warn!("Accessibility permission not granted, prompting user");
    accessibility::application_is_trusted_with_prompt();
    false
}

#[cfg(not(target_os = "macos"))]
pub fn check_and_request_accessibility() -> bool {
    true // Windows/Linux는 별도 권한 불필요
}
