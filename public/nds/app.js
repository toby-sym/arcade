// SPDX-License-Identifier: GPL-3.0-only
import { MelonDS } from "./js/melonds.js";

const MAX_ROM_BYTES = 512 * 1024 * 1024;
const MAX_SAVE_BYTES = 64 * 1024 * 1024;
const MAX_STATE_BYTES = 128 * 1024 * 1024;
const MAX_STATES_PER_GAME = 3;
const DB_NAME = "arcade-nds-local";
const DB_VERSION = 1;

const el = (id) => document.getElementById(id);
const romInput = el("rom-input");
const saveInput = el("save-input");
const stateInput = el("state-input");
const canvas = el("screen");
const stage = el("stage");
const playerStatus = el("game-status");
const message = el("message");
const emptyScreen = el("screen-empty");
const stateList = el("state-list");
const layoutSelect = el("layout-select");
const volumeRange = el("volume-range");
const pauseButton = el("pause-button");
const restartButton = el("restart-button");
const soundButton = el("sound-button");
const saveStateButton = el("save-state-button");
const exportSaveButton = el("export-save-button");
const importSaveInput = el("save-input");
const importStateInput = el("state-input");

let player = null;
let currentGame = null;
let currentRecord = null;
let detachInputs = [];
let removeSaveListener = null;
let soundEnabled = false;
let busy = false;
let persistenceQueue = Promise.resolve();
const activePointers = new Map();
const heldTouchButtons = new Map();

function setMessage(text, isError = false) {
  message.textContent = text;
  message.classList.toggle("is-error", isError);
}

function setStatus(text, kind = "ready") {
  playerStatus.textContent = text;
  playerStatus.classList.toggle("is-running", kind === "running");
  playerStatus.classList.toggle("is-paused", kind === "paused");
  playerStatus.classList.toggle("is-error", kind === "error");
}

function setBusy(value) {
  busy = value;
  romInput.disabled = value;
  document.querySelector(".file-button").classList.toggle("disabled", value);
}

function setGameControlsEnabled(enabled) {
  for (const button of document.querySelectorAll("[data-button]")) button.disabled = !enabled;
  pauseButton.disabled = !enabled;
  restartButton.disabled = !enabled;
  soundButton.disabled = !enabled;
  saveStateButton.disabled = !enabled;
  exportSaveButton.disabled = !enabled;
  importSaveInput.disabled = !enabled;
  importStateInput.disabled = !enabled;
  el("import-save-label").classList.toggle("disabled", !enabled);
  el("import-state-label").classList.toggle("disabled", !enabled);
  if (!enabled) {
    pauseButton.textContent = "Pause game";
    pauseButton.dataset.paused = "0";
    setStatus("NO GAME");
  }
}

function setPlaybackState() {
  if (!player) return;
  const paused = player.paused;
  pauseButton.textContent = paused ? "Resume game" : "Pause game";
  pauseButton.dataset.paused = paused ? "1" : "0";
  setStatus(paused ? "PAUSED" : "RUNNING", paused ? "paused" : "running");
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains("games")) request.result.createObjectStore("games");
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Browser storage could not be opened."));
    request.onblocked = () => reject(new Error("Browser storage is busy in another tab. Close the other Arcade tab and retry."));
  });
}

async function readRecord(hash) {
  const db = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction("games", "readonly");
      const request = transaction.objectStore("games").get(hash);
      request.onsuccess = () => resolve(request.result || { save: null, states: [] });
      request.onerror = () => reject(request.error || new Error("Saved game data could not be read."));
      transaction.onabort = () => reject(transaction.error || new Error("Saved game data could not be read."));
    });
  } finally {
    db.close();
  }
}

async function writeRecord(hash, record) {
  const db = await openDatabase();
  try {
    await new Promise((resolve, reject) => {
      const transaction = db.transaction("games", "readwrite");
      transaction.objectStore("games").put(record, hash);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || new Error("Browser storage could not save this game."));
      transaction.onabort = () => reject(transaction.error || new Error("Browser storage could not save this game."));
    });
  } finally {
    db.close();
  }
}

function queueRecordUpdate(hash, update) {
  persistenceQueue = persistenceQueue.catch(() => {}).then(async () => {
    const record = await readRecord(hash);
    const next = update({ save: record.save ?? null, states: Array.isArray(record.states) ? record.states : [] });
    await writeRecord(hash, next);
    if (currentGame?.hash === hash) {
      currentRecord = next;
      renderStates();
    }
    return next;
  });
  return persistenceQueue;
}

async function sha256(bytes) {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

function copyBytes(value) {
  if (value instanceof Uint8Array) return value.slice();
  if (value instanceof ArrayBuffer) return new Uint8Array(value.slice(0));
  return new Uint8Array(value || []);
}

function fileBaseName(name) {
  return (name || "game").replace(/\.(nds|srl)$/i, "").replace(/[^a-z0-9._-]+/gi, "-").replace(/^-+|-+$/g, "") || "game";
}

function download(bytes, name, type = "application/octet-stream") {
  const url = URL.createObjectURL(new Blob([bytes], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function renderStates() {
  const states = currentRecord?.states ?? [];
  el("state-count").textContent = `${states.length} / ${MAX_STATES_PER_GAME}`;
  stateList.replaceChildren();
  if (states.length === 0) {
    const empty = document.createElement("li");
    empty.className = "empty-states";
    empty.textContent = "No checkpoints saved in this browser yet.";
    stateList.append(empty);
    return;
  }

  for (const state of states.slice().sort((a, b) => b.createdAt - a.createdAt)) {
    const item = document.createElement("li");
    const copy = document.createElement("div");
    copy.className = "state-copy";
    const title = document.createElement("strong");
    title.textContent = state.name;
    const date = document.createElement("small");
    date.textContent = `${new Date(state.createdAt).toLocaleString()} · ${(state.bytes.byteLength / 1048576).toFixed(1)} MB`;
    copy.append(title, date);

    const tools = document.createElement("div");
    tools.className = "state-tools";
    tools.append(
      makeSmallButton(`Load ${state.name}`, "Load", () => void loadState(state)),
      makeSmallButton(`Export ${state.name}`, "Export", () => download(copyBytes(state.bytes), `${fileBaseName(currentGame?.name)}.mdsstate`)),
      makeSmallButton(`Delete ${state.name}`, "Delete", () => void deleteState(state)),
    );
    item.append(copy, tools);
    stateList.append(item);
  }
}

function makeSmallButton(label, text, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "button button-quiet";
  button.textContent = text;
  button.setAttribute("aria-label", label);
  button.addEventListener("click", onClick);
  return button;
}

function attachInput() {
  detachInputs = [player.attachKeyboard(), player.attachGamepad(), player.attachPointer(canvas)];
}

function detachInput() {
  detachInputs.splice(0).forEach((detach) => detach());
  for (const button of heldTouchButtons.keys()) player?.button(button, false);
  heldTouchButtons.clear();
  activePointers.clear();
}

async function persistBattery(hash, bytes) {
  try {
    await queueRecordUpdate(hash, (record) => ({ ...record, save: copyBytes(bytes), savedAt: Date.now() }));
    if (currentGame?.hash === hash) setMessage("Battery save stored in this browser.");
  } catch (error) {
    if (currentGame?.hash === hash) setMessage(`Could not store the battery save: ${error.message}`, true);
  }
}

async function persistCurrentSave() {
  if (!player || !currentGame) return;
  const { hash } = currentGame;
  try {
    const bytes = await player.getSaveNow();
    if (bytes?.length) await persistBattery(hash, bytes);
    await persistenceQueue;
  } catch {
    // Games without cartridge save memory return no save; their checkpoints still work.
  }
}

async function unloadCurrent() {
  if (!player) return;
  const oldPlayer = player;
  await persistCurrentSave();
  removeSaveListener?.();
  removeSaveListener = null;
  detachInput();
  player = null;
  await oldPlayer.dispose().catch(() => {});
}

async function openGame(file) {
  if (!file || busy) return;
  if (file.size > MAX_ROM_BYTES) {
    setMessage("This file is larger than the 512 MB limit.", true);
    return;
  }
  if (!globalThis.crossOriginIsolated || typeof SharedArrayBuffer === "undefined") {
    setMessage("The browser did not enable cross-origin isolation. Open Arcade's Nintendo DS page from its HTTPS address and try again.", true);
    return;
  }

  setBusy(true);
  setGameControlsEnabled(false);
  emptyScreen.hidden = false;
  emptyScreen.querySelector("strong").textContent = "LOADING GAME";
  el("file-name").textContent = file.name;
  setStatus("LOADING");
  setMessage("Opening the game locally in this browser…");

  try {
    await unloadCurrent();
    const bytes = new Uint8Array(await file.arrayBuffer());
    const hash = await sha256(bytes);
    const record = await readRecord(hash);
    currentGame = { name: file.name, hash };
    currentRecord = { save: record.save ? copyBytes(record.save) : null, states: Array.isArray(record.states) ? record.states : [] };
    renderStates();

    player = await MelonDS.create({ canvas, threads: "auto", audio: true });
    player.setLayout(layoutSelect.value);
    player.setVolume(Number(volumeRange.value) / 100);
    player.setMuted(!soundEnabled);
    await player.loadRom(bytes, { save: currentRecord.save });
    removeSaveListener = player.onSave((save) => void persistBattery(hash, save), 500);
    attachInput();
    player.start();
    setGameControlsEnabled(true);
    emptyScreen.hidden = true;
    setPlaybackState();
    setMessage(currentRecord.save ? "Local battery save restored. Your game stays in this browser." : "Game loaded. Your ROM stays in this tab and is never uploaded.");
  } catch (error) {
    await unloadCurrent();
    currentGame = null;
    currentRecord = null;
    renderStates();
    setGameControlsEnabled(false);
    setStatus("LOAD ERROR", "error");
    emptyScreen.hidden = false;
    emptyScreen.querySelector("strong").textContent = "GAME NOT LOADED";
    setMessage(`${error.code ? `${error.code}: ` : ""}${error.message || "Arcade could not open this game file."}`, true);
  } finally {
    setBusy(false);
    romInput.value = "";
  }
}

async function saveCheckpoint() {
  if (!player || !currentGame || busy) return;
  if ((currentRecord?.states.length ?? 0) >= MAX_STATES_PER_GAME) {
    setMessage("All three checkpoint slots are in use. Export or delete one before saving another.", true);
    return;
  }
  setBusy(true);
  saveStateButton.disabled = true;
  setMessage("Saving a local checkpoint…");
  try {
    const bytes = await player.saveState();
    const state = {
      id: crypto.randomUUID(),
      name: `Checkpoint ${new Date().toLocaleString()}`,
      createdAt: Date.now(),
      bytes: copyBytes(bytes),
    };
    await queueRecordUpdate(currentGame.hash, (record) => ({ ...record, states: [...record.states, state] }));
    setMessage("Checkpoint saved in this browser.");
  } catch (error) {
    setMessage(`Could not save this checkpoint: ${error.message}`, true);
  } finally {
    setBusy(false);
    saveStateButton.disabled = !player;
  }
}

async function loadState(state) {
  if (!player || busy) return;
  setBusy(true);
  setMessage("Loading checkpoint…");
  try {
    await player.loadState(copyBytes(state.bytes));
    if (player.paused) player.resume();
    setPlaybackState();
    setMessage("Checkpoint loaded.");
  } catch (error) {
    setMessage(`This checkpoint could not be loaded: ${error.message}`, true);
  } finally {
    setBusy(false);
  }
}

async function deleteState(state) {
  if (!currentGame || busy || !window.confirm(`Delete ${state.name} from this browser?`)) return;
  try {
    await queueRecordUpdate(currentGame.hash, (record) => ({ ...record, states: record.states.filter((candidate) => candidate.id !== state.id) }));
    setMessage("Checkpoint deleted from this browser.");
  } catch (error) {
    setMessage(`Could not delete this checkpoint: ${error.message}`, true);
  }
}

async function importCheckpoint(file) {
  if (!file || !player || !currentGame) return;
  if (file.size > MAX_STATE_BYTES) {
    setMessage("This checkpoint is larger than the 128 MB import limit.", true);
    return;
  }
  if ((currentRecord?.states.length ?? 0) >= MAX_STATES_PER_GAME) {
    setMessage("All three checkpoint slots are in use. Export or delete one before importing another.", true);
    return;
  }
  setBusy(true);
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    await player.loadState(bytes);
    const state = { id: crypto.randomUUID(), name: file.name.replace(/\.mdsstate$/i, "") || "Imported checkpoint", createdAt: Date.now(), bytes };
    await queueRecordUpdate(currentGame.hash, (record) => ({ ...record, states: [...record.states, state] }));
    if (player.paused) player.resume();
    setPlaybackState();
    setMessage("Checkpoint imported, loaded, and saved in this browser.");
  } catch (error) {
    setMessage(`Checkpoint import failed: ${error.message}`, true);
  } finally {
    setBusy(false);
    stateInput.value = "";
  }
}

async function importBatterySave(file) {
  if (!file || !player || !currentGame) return;
  if (file.size > MAX_SAVE_BYTES) {
    setMessage("This battery save is larger than the 64 MB import limit.", true);
    return;
  }
  if (!window.confirm("Import this battery save and restart the game from it?")) {
    saveInput.value = "";
    return;
  }
  setBusy(true);
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    await player.loadSave(bytes);
    await persistBattery(currentGame.hash, bytes);
    if (player.paused) player.resume();
    setPlaybackState();
    setMessage("Battery save imported and stored in this browser.");
  } catch (error) {
    setMessage(`Battery save import failed: ${error.message}`, true);
  } finally {
    setBusy(false);
    saveInput.value = "";
  }
}

async function exportBatterySave() {
  if (!player || !currentGame) return;
  try {
    const bytes = await player.getSaveNow();
    if (!bytes?.length) {
      setMessage("This game does not use a cartridge battery save.");
      return;
    }
    download(bytes, `${fileBaseName(currentGame.name)}.sav`);
    setMessage("Battery save exported to a file on this device.");
  } catch (error) {
    setMessage(`Could not export the battery save: ${error.message}`, true);
  }
}

function pressTouchButton(button, event) {
  if (!player || event.button !== 0 || activePointers.has(event.pointerId)) return;
  event.preventDefault();
  try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* pointer capture may be unavailable */ }
  activePointers.set(event.pointerId, { button, element: event.currentTarget });
  const count = heldTouchButtons.get(button) ?? 0;
  heldTouchButtons.set(button, count + 1);
  if (count === 0) player.button(button, true);
}

function releaseTouchButton(event) {
  const active = activePointers.get(event.pointerId);
  if (!active) return;
  activePointers.delete(event.pointerId);
  const count = Math.max(0, (heldTouchButtons.get(active.button) ?? 1) - 1);
  if (count === 0) {
    heldTouchButtons.delete(active.button);
    player?.button(active.button, false);
  } else {
    heldTouchButtons.set(active.button, count);
  }
  try {
    if (active.element.hasPointerCapture(event.pointerId)) active.element.releasePointerCapture(event.pointerId);
  } catch { /* already released by the browser */ }
}

romInput.addEventListener("change", () => void openGame(romInput.files?.[0]));
saveInput.addEventListener("change", () => void importBatterySave(saveInput.files?.[0]));
stateInput.addEventListener("change", () => void importCheckpoint(stateInput.files?.[0]));
saveStateButton.addEventListener("click", () => void saveCheckpoint());
exportSaveButton.addEventListener("click", () => void exportBatterySave());

for (const button of document.querySelectorAll("[data-button]")) {
  const name = button.dataset.button;
  button.addEventListener("pointerdown", (event) => pressTouchButton(name, event));
  button.addEventListener("pointerup", releaseTouchButton);
  button.addEventListener("pointercancel", releaseTouchButton);
  button.addEventListener("lostpointercapture", releaseTouchButton);
  button.addEventListener("keydown", (event) => {
    if ((event.code === "Space" || event.code === "Enter") && !event.repeat && player) {
      event.preventDefault();
      player.button(name, true);
      button.dataset.keyHeld = "true";
    }
  });
  button.addEventListener("keyup", (event) => {
    if ((event.code === "Space" || event.code === "Enter") && button.dataset.keyHeld === "true") {
      event.preventDefault();
      player?.button(name, false);
      delete button.dataset.keyHeld;
    }
  });
  button.addEventListener("blur", () => {
    if (button.dataset.keyHeld === "true") player?.button(name, false);
    delete button.dataset.keyHeld;
  });
}

pauseButton.addEventListener("click", () => {
  if (!player) return;
  if (player.paused) player.resume();
  else player.pause();
  setPlaybackState();
});

restartButton.addEventListener("click", async () => {
  if (!player || busy) return;
  setBusy(true);
  pauseButton.disabled = restartButton.disabled = true;
  setMessage("Saving progress before restart…");
  try {
    await persistCurrentSave();
    if (!player.paused) player.pause();
    removeSaveListener?.();
    removeSaveListener = null;
    detachInput();
    await player.reset();
    player.setLayout(layoutSelect.value);
    player.setVolume(Number(volumeRange.value) / 100);
    player.setMuted(!soundEnabled);
    removeSaveListener = player.onSave((save) => void persistBattery(currentGame.hash, save), 500);
    attachInput();
    player.start();
    setPlaybackState();
    setMessage("Game restarted from its latest local battery save.");
  } catch (error) {
    setMessage(`Could not restart the game: ${error.message}`, true);
  } finally {
    setBusy(false);
    pauseButton.disabled = restartButton.disabled = !player;
  }
});

el("fullscreen-button").addEventListener("click", async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await stage.requestFullscreen();
  } catch {
    setMessage("Fullscreen is not available in this browser.", true);
  }
});

soundButton.addEventListener("click", async () => {
  if (!player) return;
  soundEnabled = !soundEnabled;
  player.setMuted(!soundEnabled);
  if (soundEnabled) await player.unlockAudio().catch(() => {});
  soundButton.textContent = soundEnabled ? "Sound on" : "Sound off";
  soundButton.setAttribute("aria-pressed", String(soundEnabled));
});

layoutSelect.addEventListener("change", () => player?.setLayout(layoutSelect.value));
volumeRange.addEventListener("input", () => player?.setVolume(Number(volumeRange.value) / 100));

document.addEventListener("visibilitychange", () => {
  if (document.hidden && player && !player.paused) {
    player.pause();
    setPlaybackState();
    void persistCurrentSave();
  }
});
window.addEventListener("pagehide", () => void persistCurrentSave());

for (const link of document.querySelectorAll('a[href="/"]')) {
  link.addEventListener("click", async (event) => {
    if (!player) return;
    event.preventDefault();
    link.setAttribute("aria-busy", "true");
    await persistCurrentSave();
    await unloadCurrent();
    window.location.assign("/");
  });
}

setGameControlsEnabled(false);
renderStates();
