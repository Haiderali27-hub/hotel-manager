import { invoke } from '@tauri-apps/api/core';

export const isTauriEnvironment =
  typeof window !== 'undefined' && Boolean((window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__);

export async function invokeCommand<T>(
  command: string,
  args?: Record<string, unknown>
): Promise<T> {
  return invoke<T>(command, args);
}

export async function invokeWithFallback<T>(
  primary: string,
  primaryArgs: Record<string, unknown> | undefined,
  fallback: string,
  fallbackArgs?: Record<string, unknown>
): Promise<T> {
  try {
    return await invoke<T>(primary, primaryArgs);
  } catch {
    return invoke<T>(fallback, fallbackArgs ?? primaryArgs);
  }
}
