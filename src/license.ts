const SLUG = 'natural-pause-recorder';
const TOKEN_KEY = `sb_license:${SLUG}`;
const CACHE_KEY = `sb_license_verdict:${SLUG}`;
const API = 'https://api.sociobot.in/api/v1';
const DAY = 86_400_000;

type Verdict = { valid: boolean; reason?: string; expires_at?: string | null; checkedAt: number };

function readVerdict(): Verdict | null {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY) ?? 'null') as Verdict | null; } catch { return null; }
}

export function captureReturnedLicense(): void {
  const url = new URL(location.href);
  const token = url.searchParams.get('license');
  if (!token) return;
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(CACHE_KEY, JSON.stringify({ valid: true, reason: 'pending', checkedAt: 0 } satisfies Verdict));
  url.searchParams.delete('license');
  history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
}

export function isOptimisticallyUnlocked(): boolean {
  const token = localStorage.getItem(TOKEN_KEY);
  const verdict = readVerdict();
  return Boolean(token && verdict?.valid);
}

export async function verifyStoredLicense(force = false): Promise<{ unlocked: boolean; message: string }> {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) return { unlocked: false, message: 'Free edition' };
  const cached = readVerdict();
  if (!force && cached && Date.now() - cached.checkedAt < DAY) return { unlocked: cached.valid, message: cached.valid ? 'Plus unlocked' : 'License no longer active' };
  try {
    const response = await fetch(`${API}/products/${SLUG}/verify?license=${encodeURIComponent(token)}`);
    if (!response.ok) throw new Error('Verification service unavailable.');
    const result = await response.json() as { valid: boolean; reason?: string; expires_at?: string | null };
    localStorage.setItem(CACHE_KEY, JSON.stringify({ ...result, checkedAt: Date.now() } satisfies Verdict));
    return { unlocked: result.valid, message: result.valid ? 'Plus unlocked on this device' : `License no longer active${result.reason ? ` (${result.reason.replaceAll('_', ' ')})` : ''}` };
  } catch {
    return { unlocked: Boolean(cached?.valid), message: cached?.valid ? 'Plus unlocked · verification will retry online' : 'Could not verify while offline' };
  }
}

export async function restoreLicense(token: string): Promise<{ unlocked: boolean; message: string }> {
  const cleaned = token.trim();
  if (!cleaned) return { unlocked: false, message: 'Paste a license token first.' };
  localStorage.setItem(TOKEN_KEY, cleaned);
  localStorage.removeItem(CACHE_KEY);
  return verifyStoredLicense(true);
}
