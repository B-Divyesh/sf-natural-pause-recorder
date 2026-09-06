const SLUG = 'natural-pause-recorder';
const API = 'https://api.sociobot.in/api/v1';
const DAY = 86_400_000;

export type LicenseScope = 'real' | 'demo';

type Verdict = { valid: boolean; reason?: string; expires_at?: string | null; checkedAt: number };

function keys(scope: LicenseScope): { token: string; cache: string } {
  const prefix = scope === 'demo' ? 'demo:' : '';
  return { token: `${prefix}sb_license:${SLUG}`, cache: `${prefix}sb_license_verdict:${SLUG}` };
}

function readVerdict(scope: LicenseScope): Verdict | null {
  try { return JSON.parse(localStorage.getItem(keys(scope).cache) ?? 'null') as Verdict | null; } catch { return null; }
}

export function captureReturnedLicense(scope: LicenseScope = 'real'): void {
  const url = new URL(location.href);
  const token = url.searchParams.get('license');
  if (!token) return;
  const key = keys(scope);
  localStorage.setItem(key.token, token);
  localStorage.setItem(key.cache, JSON.stringify({ valid: true, reason: 'pending', checkedAt: 0 } satisfies Verdict));
  url.searchParams.delete('license');
  history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
}

export function isOptimisticallyUnlocked(scope: LicenseScope = 'real'): boolean {
  const token = localStorage.getItem(keys(scope).token);
  const verdict = readVerdict(scope);
  return Boolean(token && verdict?.valid);
}

export async function verifyStoredLicense(force = false, scope: LicenseScope = 'real'): Promise<{ unlocked: boolean; message: string }> {
  const key = keys(scope);
  const token = localStorage.getItem(key.token);
  if (!token) return { unlocked: false, message: 'Free edition' };
  const cached = readVerdict(scope);
  if (!force && cached && Date.now() - cached.checkedAt < DAY) return { unlocked: cached.valid, message: cached.valid ? 'Plus unlocked' : 'License no longer active' };
  try {
    const response = await fetch(`${API}/products/${SLUG}/verify?license=${encodeURIComponent(token)}`);
    if (!response.ok) throw new Error('Verification service unavailable.');
    const result = await response.json() as { valid: boolean; reason?: string; expires_at?: string | null };
    localStorage.setItem(key.cache, JSON.stringify({ ...result, checkedAt: Date.now() } satisfies Verdict));
    return { unlocked: result.valid, message: result.valid ? 'Plus unlocked on this device' : `License no longer active${result.reason ? ` (${result.reason.replaceAll('_', ' ')})` : ''}` };
  } catch {
    return { unlocked: Boolean(cached?.valid), message: cached?.valid ? 'Plus unlocked · verification will retry online' : 'Could not verify while offline' };
  }
}

export async function restoreLicense(token: string, scope: LicenseScope = 'real'): Promise<{ unlocked: boolean; message: string }> {
  const cleaned = token.trim();
  if (!cleaned) return { unlocked: false, message: 'Paste a license token first.' };
  const key = keys(scope);
  localStorage.setItem(key.token, cleaned);
  localStorage.removeItem(key.cache);
  return verifyStoredLicense(true, scope);
}
