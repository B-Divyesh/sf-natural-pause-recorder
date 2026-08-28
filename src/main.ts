import './styles.css';
import { analyzePcm, decodeWav, encodeWav, formatTime, makeZip, mergeChunks, renderSegments, rmsDb, safeFilename } from './audio';
import { deleteTake, listTakes, saveTake } from './db';
import { captureReturnedLicense, isOptimisticallyUnlocked, restoreLicense, verifyStoredLicense } from './license';
import type { AudioSegment, PortableTake, Take } from './types';

const byId = <T extends HTMLElement>(id: string): T => {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing #${id}`);
  return element as T;
};

function renderLegalPage(kind: 'privacy' | 'terms'): boolean {
  if (location.pathname !== `/${kind}` && location.pathname !== `/${kind}/`) return false;
  const title = kind === 'privacy' ? 'Privacy' : 'Terms';
  document.title = `${title} — Pausekeeper`;
  const main = byId<HTMLElement>('main');
  main.className = 'legal-page';
  main.innerHTML = kind === 'privacy' ? `
    <p class="eyebrow">Last updated August 28, 2026</p><h1>Privacy, in plain language</h1>
    <p>Pausekeeper is designed so your microphone audio stays on your device. We do not run analytics, create advertising profiles, or operate an audio cloud.</p>
    <h2>What is stored</h2><p>Your recordings, pause edits, names, and preferences are stored in your browser using IndexedDB and local storage. They remain until you delete them, clear site data, or import a replacement backup.</p>
    <h2>Microphone access</h2><p>The browser asks permission only when you press “Start recording.” Audio is processed locally with browser audio APIs. Pausekeeper does not transcribe, identify speakers, or upload microphone data.</p>
    <h2>Purchases</h2><p>If you buy or restore Plus, Sociobot/Dodo acts as merchant of record. Pausekeeper sends the license token—not your audio—to Sociobot to verify access, at most once per day. Their checkout handles payment details.</p>
    <h2>Your control</h2><p>Use “Export project data” for a portable backup and each take’s Delete button to remove it. Browser settings can remove all local Pausekeeper data.</p>
    <h2>Contact</h2><p>Questions can be raised through the project’s public source repository. <a href="/">Return to Pausekeeper</a>.</p>` : `
    <p class="eyebrow">Last updated August 28, 2026</p><h1>Terms of use</h1>
    <p>Pausekeeper is a local recording and pause-editing tool. By using it, you agree to these straightforward terms.</p>
    <h2>Your recordings</h2><p>You retain ownership of your audio. You are responsible for obtaining permission from anyone you record and for complying with applicable recording laws.</p>
    <h2>No voice identification claim</h2><p>Pausekeeper distinguishes audio above and below a chosen loudness threshold. It does not identify a particular person, provide clinical voice analysis, transcribe speech, or guarantee removal of background sound.</p>
    <h2>Plus purchase</h2><p>Plus is a one-time $12 purchase that unlocks custom presets and batch ZIP export. Core recording, individual WAV export, project backup, privacy, and accessibility remain free. Sociobot/Dodo is the merchant of record and handles checkout and refunds. A refund revokes the associated license.</p>
    <h2>Availability and warranty</h2><p>The software is provided “as is.” Keep independent backups of important recordings; browser storage may be cleared by device or browser policies.</p>
    <h2>Acceptable use</h2><p>Do not use Pausekeeper to record people unlawfully or to infringe others’ rights. <a href="/">Return to Pausekeeper</a>.</p>`;
  document.querySelector('.site-header nav')?.setAttribute('hidden', '');
  return true;
}

const legalPath = location.pathname.startsWith('/terms') ? 'terms' : 'privacy';
if (location.pathname.startsWith('/privacy') || location.pathname.startsWith('/terms')) renderLegalPage(legalPath);
else void startApp();

async function startApp(): Promise<void> {
  const recordButton = byId<HTMLButtonElement>('record-button');
  const stopButton = byId<HTMLButtonElement>('stop-button');
  const recordState = byId<HTMLElement>('record-state');
  const lamp = byId<HTMLElement>('record-lamp');
  const timer = byId<HTMLTimeElement>('timer');
  const needle = byId<HTMLElement>('meter-needle');
  const liveTimeline = byId<HTMLElement>('live-timeline');
  const message = byId<HTMLElement>('recorder-message');
  const minInput = byId<HTMLInputElement>('minimum-silence');
  const minOutput = byId<HTMLOutputElement>('minimum-output');
  const sensitivityInput = byId<HTMLInputElement>('sensitivity');
  const sensitivityOutput = byId<HTMLOutputElement>('sensitivity-output');
  const presetSelect = byId<HTMLSelectElement>('preset-select');
  const review = byId<HTMLElement>('review');
  const reviewSummary = byId<HTMLElement>('review-summary');
  const reviewTimeline = byId<HTMLElement>('review-timeline');
  const reviewStatus = byId<HTMLElement>('review-status');
  const previewAudio = byId<HTMLAudioElement>('preview-audio');
  const takeName = byId<HTMLInputElement>('take-name');
  const takesList = byId<HTMLElement>('takes-list');
  const licenseState = byId<HTMLElement>('license-state');
  const licenseDialog = byId<HTMLDialogElement>('license-dialog');
  const licenseMessage = byId<HTMLElement>('license-message');
  const networkBadge = byId<HTMLElement>('network-badge');
  const srStatus = byId<HTMLElement>('sr-status');

  let audioContext: AudioContext | null = null;
  let processor: ScriptProcessorNode | null = null;
  let mediaStream: MediaStream | null = null;
  let chunks: Float32Array[] = [];
  let levelHistory: number[] = [];
  let startedAt = 0;
  let timerHandle = 0;
  let currentPcm: Float32Array | null = null;
  let currentTake: Take | null = null;
  let previewUrl = '';
  let takes: Take[] = [];
  let plusUnlocked = isOptimisticallyUnlocked();

  const storedSettings = JSON.parse(localStorage.getItem('pausekeeper:settings') ?? '{}') as { minSilenceMs?: number; thresholdDb?: number };
  if (storedSettings.minSilenceMs) minInput.value = String(storedSettings.minSilenceMs);
  if (storedSettings.thresholdDb) sensitivityInput.value = String(storedSettings.thresholdDb);

  const announce = (text: string) => { srStatus.textContent = ''; requestAnimationFrame(() => { srStatus.textContent = text; }); };
  const durationOf = (segments: AudioSegment[]) => segments.reduce((sum, segment) => sum + (segment.restored ? segment.originalDuration : segment.outputDuration), 0);
  const persistSettings = () => localStorage.setItem('pausekeeper:settings', JSON.stringify({ minSilenceMs: Number(minInput.value), thresholdDb: Number(sensitivityInput.value) }));
  const sensitivityLabel = () => Number(sensitivityInput.value) <= -48 ? 'More sensitive' : Number(sensitivityInput.value) >= -34 ? 'Less sensitive' : 'Balanced';
  const updateSettingLabels = () => {
    minOutput.value = `${(Number(minInput.value) / 1000).toFixed(1)} seconds`;
    sensitivityOutput.value = sensitivityLabel();
    persistSettings();
  };
  updateSettingLabels();
  minInput.addEventListener('input', updateSettingLabels);
  sensitivityInput.addEventListener('input', updateSettingLabels);

  function setNetworkState(): void {
    const online = navigator.onLine;
    networkBadge.textContent = online ? 'Online' : 'Offline ready';
    networkBadge.classList.toggle('offline', !online);
  }
  addEventListener('online', setNetworkState);
  addEventListener('offline', setNetworkState);
  setNetworkState();

  function renderLiveLevels(): void {
    liveTimeline.classList.remove('empty');
    liveTimeline.replaceChildren();
    const threshold = Number(sensitivityInput.value);
    for (const db of levelHistory.slice(-120)) {
      const bar = document.createElement('span');
      bar.className = `wave-bar${db < threshold ? ' quiet' : ''}`;
      bar.style.setProperty('--level', String(Math.max(.04, Math.min(1, (db + 60) / 50))));
      liveTimeline.append(bar);
    }
    liveTimeline.setAttribute('aria-label', `Live recording waveform with ${levelHistory.length} level samples`);
  }

  async function startRecording(): Promise<void> {
    if (!navigator.mediaDevices?.getUserMedia) {
      message.textContent = 'This browser cannot access a microphone. Try a current version of Chrome, Edge, Firefox, or Safari.';
      message.classList.add('error');
      return;
    }
    try {
      message.textContent = 'Requesting microphone access…';
      message.classList.remove('error');
      mediaStream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: false, autoGainControl: false } });
      audioContext = new AudioContext();
      await audioContext.resume();
      const source = audioContext.createMediaStreamSource(mediaStream);
      processor = audioContext.createScriptProcessor(4096, 1, 1);
      const silent = audioContext.createGain();
      silent.gain.value = 0;
      source.connect(processor);
      processor.connect(silent);
      silent.connect(audioContext.destination);
      chunks = [];
      levelHistory = [];
      processor.onaudioprocess = event => {
        const chunk = new Float32Array(event.inputBuffer.getChannelData(0));
        chunks.push(chunk);
        const db = rmsDb(chunk);
        levelHistory.push(db);
        if (levelHistory.length % 2 === 0) renderLiveLevels();
        const rotation = -58 + Math.max(0, Math.min(1, (db + 60) / 45)) * 116;
        needle.style.transform = `rotate(${rotation}deg)`;
      };
      startedAt = performance.now();
      timerHandle = window.setInterval(() => {
        const seconds = (performance.now() - startedAt) / 1000;
        timer.textContent = formatTime(seconds);
        timer.dateTime = `PT${Math.floor(seconds)}S`;
      }, 250);
      recordState.textContent = 'Recording';
      lamp.classList.add('active');
      recordButton.disabled = true;
      stopButton.disabled = false;
      minInput.disabled = true;
      sensitivityInput.disabled = true;
      message.textContent = 'Recording locally. Speak naturally; stop when your take is finished.';
      announce('Recording started');
    } catch (error) {
      const denied = error instanceof DOMException && (error.name === 'NotAllowedError' || error.name === 'SecurityError');
      message.textContent = denied ? 'Microphone access was blocked. Allow it in your browser’s site settings, then try again.' : 'The microphone could not start. Check that another app is not using it, then try again.';
      message.classList.add('error');
      recordState.textContent = 'Needs attention';
    }
  }

  async function stopRecording(): Promise<void> {
    if (!audioContext || !processor) return;
    window.clearInterval(timerHandle);
    processor.onaudioprocess = null;
    processor.disconnect();
    mediaStream?.getTracks().forEach(track => track.stop());
    const sampleRate = audioContext.sampleRate;
    await audioContext.close();
    audioContext = null; processor = null; mediaStream = null;
    lamp.classList.remove('active');
    recordButton.disabled = false;
    stopButton.disabled = true;
    minInput.disabled = false;
    sensitivityInput.disabled = false;
    needle.style.transform = 'rotate(-58deg)';
    recordState.textContent = 'Processing';
    message.textContent = 'Reading the quiet sections on this device…';
    currentPcm = mergeChunks(chunks);
    if (currentPcm.length < sampleRate / 3) {
      recordState.textContent = 'Ready';
      message.textContent = 'That take was too short to save. Record for at least one second.';
      message.classList.add('error');
      return;
    }
    const segments = analyzePcm(currentPcm, sampleRate, Number(sensitivityInput.value), Number(minInput.value));
    const rawBlob = encodeWav(currentPcm, sampleRate);
    const editedBlob = encodeWav(renderSegments(currentPcm, sampleRate, segments), sampleRate);
    const now = Date.now();
    const defaultName = `Take ${new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(now)}`;
    currentTake = { id: crypto.randomUUID(), name: defaultName, createdAt: now, duration: currentPcm.length / sampleRate, editedDuration: durationOf(segments), sampleRate, minSilenceMs: Number(minInput.value), thresholdDb: Number(sensitivityInput.value), segments, rawBlob, editedBlob };
    await saveTake(currentTake);
    takes = await listTakes();
    renderReview();
    renderTakes();
    recordState.textContent = 'Ready';
    message.textContent = 'Take saved locally. Review each long pause below.';
    message.classList.remove('error');
    announce('Recording stopped and saved. Review is ready.');
    review.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }

  async function refreshEditedTake(): Promise<void> {
    if (!currentTake || !currentPcm) return;
    currentTake.editedDuration = durationOf(currentTake.segments);
    currentTake.editedBlob = encodeWav(renderSegments(currentPcm, currentTake.sampleRate, currentTake.segments), currentTake.sampleRate);
    await saveTake(currentTake);
    takes = takes.map(take => take.id === currentTake?.id ? currentTake : take);
    renderReview();
    renderTakes();
  }

  function renderReview(): void {
    if (!currentTake) return;
    review.hidden = false;
    const pauses = currentTake.segments.filter(segment => segment.type === 'pause');
    const compacted = pauses.filter(segment => !segment.restored);
    const saved = Math.max(0, currentTake.duration - currentTake.editedDuration);
    reviewSummary.textContent = `${compacted.length} long ${compacted.length === 1 ? 'pause' : 'pauses'} compacted, saving ${saved.toFixed(1)} seconds. Select any amber pause to restore its full length.`;
    reviewTimeline.replaceChildren();
    for (const segment of currentTake.segments) {
      const item = document.createElement('div');
      item.className = `segment ${segment.type}${segment.restored ? ' restored' : ''}`;
      item.style.setProperty('--duration', String(Math.max(.25, segment.restored ? segment.originalDuration : segment.outputDuration)));
      if (segment.type === 'pause') {
        const button = document.createElement('button');
        const canCompact = segment.originalDuration * 1000 > currentTake.minSilenceMs;
        button.disabled = !canCompact;
        button.textContent = canCompact ? `${segment.restored ? 'Compact' : 'Restore'} ${segment.originalDuration.toFixed(1)}s pause` : `Held ${segment.originalDuration.toFixed(1)}s`;
        button.setAttribute('aria-pressed', String(segment.restored));
        button.addEventListener('click', () => {
          segment.restored = !segment.restored;
          reviewStatus.textContent = segment.restored ? `Restored the full ${segment.originalDuration.toFixed(1)} second pause.` : `Compacted the pause to ${(segment.outputDuration).toFixed(1)} seconds.`;
          void refreshEditedTake();
        });
        item.append(button);
      } else {
        const label = document.createElement('span');
        label.className = 'segment-label';
        label.textContent = `${segment.originalDuration.toFixed(1)}s voice`;
        item.append(label);
      }
      reviewTimeline.append(item);
    }
    reviewTimeline.setAttribute('aria-label', `Timeline: ${currentTake.segments.filter(segment => segment.type === 'voice').length} voice sections and ${pauses.length} pauses`);
    takeName.value = currentTake.name;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = URL.createObjectURL(currentTake.editedBlob);
    previewAudio.src = previewUrl;
  }

  const download = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url; anchor.download = filename; document.body.append(anchor); anchor.click(); anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  function renderTakes(): void {
    if (!takes.length) {
      takesList.innerHTML = '<div class="empty-state"><span aria-hidden="true">◇</span><h3>No saved takes yet</h3><p>Your finished recordings will wait here, even after a refresh.</p></div>';
      return;
    }
    takesList.replaceChildren();
    for (const take of takes) {
      const card = document.createElement('article');
      card.className = 'take-card';
      const info = document.createElement('div');
      const title = document.createElement('h3'); title.textContent = take.name;
      const meta = document.createElement('div'); meta.className = 'take-meta';
      meta.textContent = `${new Date(take.createdAt).toLocaleString()} · ${formatTime(take.editedDuration)} edited · ${(take.duration - take.editedDuration).toFixed(1)}s gathered`;
      info.append(title, meta);
      const actions = document.createElement('div'); actions.className = 'take-actions';
      const reviewButton = document.createElement('button'); reviewButton.className = 'button compact'; reviewButton.textContent = 'Review';
      reviewButton.addEventListener('click', async () => {
        currentTake = take;
        const decoded = await decodeWav(take.rawBlob);
        currentPcm = decoded.pcm;
        renderReview();
        review.scrollIntoView({ behavior: 'smooth' });
      });
      const exportButton = document.createElement('button'); exportButton.className = 'button compact'; exportButton.textContent = 'Export WAV';
      exportButton.addEventListener('click', () => download(take.editedBlob, `${safeFilename(take.name)}.wav`));
      const deleteButton = document.createElement('button'); deleteButton.className = 'button compact danger'; deleteButton.textContent = 'Delete';
      deleteButton.addEventListener('click', async () => {
        if (!confirm(`Delete “${take.name}” from this device? This cannot be undone unless you exported a project backup.`)) return;
        await deleteTake(take.id);
        takes = takes.filter(item => item.id !== take.id);
        if (currentTake?.id === take.id) { currentTake = null; currentPcm = null; review.hidden = true; }
        renderTakes(); announce(`${take.name} deleted`);
      });
      actions.append(reviewButton, exportButton, deleteButton);
      card.append(info, actions); takesList.append(card);
    }
  }

  recordButton.addEventListener('click', () => void startRecording());
  stopButton.addEventListener('click', () => void stopRecording());
  byId<HTMLButtonElement>('export-current').addEventListener('click', () => {
    if (currentTake) download(currentTake.editedBlob, `${safeFilename(currentTake.name)}.wav`);
  });
  takeName.addEventListener('change', async () => {
    if (!currentTake) return;
    currentTake.name = takeName.value.trim() || 'Untitled take';
    takeName.value = currentTake.name;
    await saveTake(currentTake); renderTakes();
  });

  const builtIns: Record<string, number> = { commentary: 500, narration: 800, lesson: 1300 };
  const savedPreset = JSON.parse(localStorage.getItem('pausekeeper:custom-preset') ?? 'null') as { name: string; minSilenceMs: number; thresholdDb: number } | null;
  if (savedPreset) {
    const option = document.createElement('option'); option.value = 'custom'; option.textContent = `${savedPreset.name} · ${(savedPreset.minSilenceMs / 1000).toFixed(1)}s`; presetSelect.append(option);
  }
  presetSelect.addEventListener('change', () => {
    if (presetSelect.value === 'custom' && savedPreset) {
      minInput.value = String(savedPreset.minSilenceMs); sensitivityInput.value = String(savedPreset.thresholdDb);
    } else if (builtIns[presetSelect.value]) minInput.value = String(builtIns[presetSelect.value]);
    updateSettingLabels();
  });
  byId<HTMLButtonElement>('save-preset').addEventListener('click', () => {
    if (!plusUnlocked) { licenseState.textContent = 'Custom presets require Plus. Recording and WAV export remain free.'; location.hash = 'upgrade'; return; }
    const name = prompt('Name this project preset:', 'My voice setup')?.trim();
    if (!name) return;
    localStorage.setItem('pausekeeper:custom-preset', JSON.stringify({ name, minSilenceMs: Number(minInput.value), thresholdDb: Number(sensitivityInput.value) }));
    byId<HTMLElement>('preset-note').textContent = `Saved “${name}”. Reload to see it in the preset menu.`;
  });

  const blobToDataUrl = (blob: Blob) => new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(reader.error); reader.readAsDataURL(blob); });
  const dataUrlToBlob = (url: string) => { const [header, body] = url.split(','); const mime = /data:(.*?);/.exec(header ?? '')?.[1] ?? 'audio/wav'; const bytes = Uint8Array.from(atob(body ?? ''), char => char.charCodeAt(0)); return new Blob([bytes], { type: mime }); };
  byId<HTMLButtonElement>('export-data').addEventListener('click', async () => {
    const portable: PortableTake[] = await Promise.all(takes.map(async take => ({ ...take, rawBlob: undefined, editedBlob: undefined, rawWav: await blobToDataUrl(take.rawBlob), editedWav: await blobToDataUrl(take.editedBlob) } as unknown as PortableTake)));
    download(new Blob([JSON.stringify({ product: 'Pausekeeper', version: 1, exportedAt: new Date().toISOString(), takes: portable }, null, 2)], { type: 'application/json' }), `pausekeeper-backup-${new Date().toISOString().slice(0, 10)}.json`);
    announce('Project backup exported');
  });
  byId<HTMLInputElement>('import-data').addEventListener('change', async event => {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0]; if (!file) return;
    try {
      const data = JSON.parse(await file.text()) as { product?: string; version?: number; takes?: PortableTake[] };
      if (data.product !== 'Pausekeeper' || data.version !== 1 || !Array.isArray(data.takes)) throw new Error('wrong format');
      for (const item of data.takes) {
        if (!item.id || !item.rawWav || !item.editedWav || !Array.isArray(item.segments)) throw new Error('missing take data');
        const take = { ...item, rawBlob: dataUrlToBlob(item.rawWav), editedBlob: dataUrlToBlob(item.editedWav) } as unknown as Take;
        delete (take as Partial<PortableTake>).rawWav; delete (take as Partial<PortableTake>).editedWav;
        await saveTake(take);
      }
      takes = await listTakes(); renderTakes(); announce(`Imported ${data.takes.length} takes`);
    } catch {
      alert('That file is not a valid Pausekeeper project backup. Your existing takes were not changed.');
    } finally { input.value = ''; }
  });

  function applyLicenseUi(unlocked: boolean, status: string): void {
    plusUnlocked = unlocked;
    licenseState.textContent = status;
    licenseState.classList.toggle('unlocked', unlocked);
    byId<HTMLAnchorElement>('buy-link').hidden = unlocked;
  }
  captureReturnedLicense();
  applyLicenseUi(plusUnlocked, plusUnlocked ? 'Plus unlocked · checking license quietly' : 'Free edition');
  void verifyStoredLicense().then(result => applyLicenseUi(result.unlocked, result.message));
  byId<HTMLButtonElement>('restore-license-open').addEventListener('click', () => licenseDialog.showModal());
  byId<HTMLButtonElement>('verify-license').addEventListener('click', async () => {
    const token = byId<HTMLInputElement>('license-input').value;
    licenseMessage.textContent = 'Checking this license…';
    const result = await restoreLicense(token);
    licenseMessage.textContent = result.message;
    applyLicenseUi(result.unlocked, result.message);
    if (result.unlocked) window.setTimeout(() => licenseDialog.close(), 700);
  });
  byId<HTMLButtonElement>('batch-export').addEventListener('click', async () => {
    if (!plusUnlocked) { licenseState.textContent = 'Batch ZIP export requires Plus. You can export every WAV individually for free.'; return; }
    if (!takes.length) { licenseState.textContent = 'Record at least one take before creating a batch.'; return; }
    const zip = await makeZip(takes.map(take => ({ name: `${safeFilename(take.name)}.wav`, blob: take.editedBlob })));
    download(zip, `pausekeeper-takes-${new Date().toISOString().slice(0, 10)}.zip`);
    licenseState.textContent = `Exported ${takes.length} WAV ${takes.length === 1 ? 'file' : 'files'} in one ZIP.`;
  });

  try { takes = await listTakes(); renderTakes(); }
  catch { takesList.innerHTML = '<div class="empty-state"><h3>Local storage is unavailable</h3><p>Pausekeeper needs browser storage to keep takes between visits. Private browsing or device policy may be blocking it.</p></div>'; }

  if ('serviceWorker' in navigator && import.meta.env.PROD) {
    navigator.serviceWorker.register('/sw.js').then(registration => {
      let applyingUpdate = false;
      const showUpdate = () => {
        const toast = byId<HTMLElement>('update-toast'); toast.hidden = false;
        byId<HTMLButtonElement>('apply-update').onclick = () => { applyingUpdate = true; registration.waiting?.postMessage({ type: 'SKIP_WAITING' }); };
      };
      if (registration.waiting) showUpdate();
      registration.addEventListener('updatefound', () => registration.installing?.addEventListener('statechange', () => { if (registration.waiting && navigator.serviceWorker.controller) showUpdate(); }));
      navigator.serviceWorker.addEventListener('controllerchange', () => { if (applyingUpdate) location.reload(); });
    }).catch(() => { /* Recording still works without install support. */ });
  }
}
