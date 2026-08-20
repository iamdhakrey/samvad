import { ApiResponse, RequestItem } from "@samvad-internal/models";
import { invoke } from "@tauri-apps/api/core";

export async function sendNativeRequest(
  request: RequestItem,
): Promise<ApiResponse> {
  // The key 'request' exactly matches your Rust fn argument name
  // return await invoke<ApiResponse>("send_request", { request });
  console.log("request", request);
  return await invoke<ApiResponse>("send_request", { request: request });
}
