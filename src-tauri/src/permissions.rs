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

/// 프롬프트 없이 현재 권한 상태만 체크
#[cfg(target_os = "macos")]
pub fn check_accessibility_silent() -> bool {
    use macos_accessibility_client::accessibility;
    accessibility::application_is_trusted()
}

#[cfg(not(target_os = "macos"))]
pub fn check_and_request_accessibility() -> bool {
    true
}

#[cfg(not(target_os = "macos"))]
pub fn check_accessibility_silent() -> bool {
    true
}
