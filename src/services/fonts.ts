
import { invoke } from "@tauri-apps/api/core";

export async function loadFonts() {
    return await invoke<string[]>('get_system_fonts');
}
