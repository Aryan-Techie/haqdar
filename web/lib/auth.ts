const KEY = "haqdar:token";
let memoryToken: string | null = null;

export function getToken(): string | null {
  try {
    return localStorage.getItem(KEY) ?? memoryToken;
  } catch {
    return memoryToken;
  }
}

export function setToken(token: string): void {
  memoryToken = token;
  try {
    localStorage.setItem(KEY, token);
  } catch {
    /* storage unavailable: token lives in memory only */
  }
}

export function clearToken(): void {
  memoryToken = null;
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
