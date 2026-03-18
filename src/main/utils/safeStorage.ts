import { safeStorage } from "electron";

export function canEncryptSecret(): boolean {
  return safeStorage.isEncryptionAvailable();
}

export function encryptSecret(value: string): string | null {
  if (!value || !canEncryptSecret()) {
    return null;
  }

  return safeStorage.encryptString(value).toString("base64");
}

export function decryptSecret(value: string | null | undefined): string | null {
  if (!value || !canEncryptSecret()) {
    return null;
  }

  return safeStorage.decryptString(Buffer.from(value, "base64"));
}
