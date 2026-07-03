// منارة — تهيئة Tauri: نافذة أصلية + حفظ الحالة + إشعارات + تحديث + خزنة + SQLite
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .setup(|app| {
            // خزنة stronghold لتخزين tokens خارج localStorage
            let salt_path = app
                .path()
                .app_local_data_dir()
                .expect("app data dir")
                .join("manarah.salt");
            app.handle()
                .plugin(tauri_plugin_stronghold::Builder::with_argon2(&salt_path).build())?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("فشل تشغيل تطبيق منارة");
}
