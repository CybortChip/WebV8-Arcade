import { ArcadeInputSystem } from './inputManager';
import { SaveStateManager } from './storage/saveStateManager';
import { ArcadeAudioManager } from './audioManager';

const saveManager = new SaveStateManager();
saveManager.init();

const audioManager = new ArcadeAudioManager();

const WIDTH = 640;
const HEIGHT = 480;
const VIDEO_SIZE = WIDTH * HEIGHT * 4;
const INPUT_SIZE = 4;

const sharedBuffer = new SharedArrayBuffer(VIDEO_SIZE + INPUT_SIZE);
const inputSystem = new ArcadeInputSystem(sharedBuffer, VIDEO_SIZE);

inputSystem.onGamepadConnected = (id) => showToast(`🎮 Mando conectado: ${id.substring(0, 20)}`);
inputSystem.onGamepadDisconnected = () => showToast(`🔌 Mando desconectado`, true);

const cabinet = document.getElementById('arcade-cabinet') as HTMLDivElement;
const canvas = document.getElementById('viewport') as HTMLCanvasElement;
const loadingOverlay = document.getElementById('loading-overlay') as HTMLDivElement;
const loadingText = document.getElementById('loading-text') as HTMLDivElement;
const toggleBtn = document.getElementById('btn-toggle') as HTMLButtonElement;
const audioBtn = document.getElementById('btn-audio') as HTMLButtonElement;
const btnFullscreenOverlay = document.getElementById('btn-fullscreen-overlay') as HTMLButtonElement;
const romInput = document.getElementById('rom-input') as HTMLInputElement;
const fpsSelector = document.getElementById('fps-selector') as HTMLSelectElement;

const chkScanlines = document.getElementById('chk-scanlines') as HTMLInputElement;
const chkGlow = document.getElementById('chk-glow') as HTMLInputElement;

const btnSaveState = document.getElementById('btn-save-state') as HTMLButtonElement;
const btnLoadState = document.getElementById('btn-load-state') as HTMLButtonElement;
const btnClearState = document.getElementById('btn-clear-state') as HTMLButtonElement;
const btnExportFile = document.getElementById('btn-export-file') as HTMLButtonElement;
const stateFileInput = document.getElementById('state-file-input') as HTMLInputElement;
const saveToast = document.getElementById('save-toast') as HTMLDivElement;

const settingsOverlay = document.getElementById('settings-overlay') as HTMLDivElement;
const btnOpenSettings = document.getElementById('btn-open-settings') as HTMLButtonElement;
const btnCloseSettings = document.getElementById('btn-close-settings') as HTMLButtonElement;

const mappingList = document.getElementById('mapping-list') as HTMLDivElement;
const btnAutoconfig = document.getElementById('btn-autoconfig') as HTMLButtonElement;
const btnSaveCfg = document.getElementById('btn-save-cfg') as HTMLButtonElement;
const btnLoadCfg = document.getElementById('btn-load-cfg') as HTMLButtonElement;
const fileCfgInput = document.getElementById('file-cfg-input') as HTMLInputElement;
const gpStatusText = document.getElementById('gamepad-status-text') as HTMLDivElement;
const gpCard = document.getElementById('gamepad-card') as HTMLDivElement;
const gpTitle = document.getElementById('gamepad-title') as HTMLDivElement;
const gpActiveInput = document.getElementById('gamepad-active-input') as HTMLDivElement;

const offscreen = canvas.transferControlToOffscreen();

const worker = new Worker(new URL('./emulator.worker.ts', import.meta.url), {
  type: 'module',
});

worker.postMessage(
  {
    type: 'INIT',
    payload: {
      canvas: offscreen,
      sab: sharedBuffer,
      inputOffset: VIDEO_SIZE,
      targetFps: 60,
    },
  },
  [offscreen]
);

let isRunning = true;
let currentRomName = 'Winning_Eleven_2002';
let isExportPending = false;
let lastKnownBuffer: ArrayBuffer | null = null;

function showToast(text: string, isError = false) {
  saveToast.textContent = text;
  saveToast.style.background = isError ? 'rgba(239, 68, 68, 0.9)' : 'rgba(16, 185, 129, 0.9)';
  saveToast.classList.add('visible');
  setTimeout(() => saveToast.classList.remove('visible'), 2400);
}

function updateShaders() {
  if (chkScanlines.checked) {
    cabinet.classList.add('fx-scanlines-active');
  } else {
    cabinet.classList.remove('fx-scanlines-active');
  }

  if (chkGlow.checked) {
    cabinet.classList.add('fx-glow-active');
  } else {
    cabinet.classList.remove('fx-glow-active');
  }
}

chkScanlines.addEventListener('change', updateShaders);
chkGlow.addEventListener('change', updateShaders);

function downloadBinaryState(buffer: ArrayBuffer, filename: string) {
  if (!buffer || buffer.byteLength < 1000) {
    showToast('State no listo, pulsa Save primero', true);
    return;
  }
  const blob = new Blob([buffer], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  showToast(`Exportado: ${(buffer.byteLength / 1024 / 1024).toFixed(1)} MB`);
}

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    cabinet.requestFullscreen().catch((err) => {
      console.warn('Error al entrar a fullscreen:', err);
    });
  } else {
    document.exitFullscreen().catch((err) => {
      console.warn('Error al salir de fullscreen:', err);
    });
  }
}

btnFullscreenOverlay.addEventListener('click', (e) => {
  e.stopPropagation();
  toggleFullscreen();
});

cabinet.addEventListener('dblclick', toggleFullscreen);

window.addEventListener('keydown', (e) => {
  if (e.altKey && e.key === 'Enter') {
    e.preventDefault();
    toggleFullscreen();
  }
});

document.addEventListener('fullscreenchange', () => {
  if (document.fullscreenElement) {
    btnFullscreenOverlay.textContent = '🗗';
    btnFullscreenOverlay.title = 'Salir de pantalla completa (Esc / Alt+Enter)';
  } else {
    btnFullscreenOverlay.textContent = '⛶';
    btnFullscreenOverlay.title = 'Pantalla completa (Alt+Enter)';
  }
});

worker.onmessage = (e: MessageEvent) => {
  const { type, payload } = e.data;

  if (type === 'STATE_SAVED') {
    const buffer = payload.buffer;
    lastKnownBuffer = buffer;

    saveManager.saveState(currentRomName, buffer).catch((err) => {
      console.error('[Main] Failed to save state to IndexedDB', err);
    });

    if (isExportPending) {
      isExportPending = false;
      downloadBinaryState(buffer, `${currentRomName}.state`);
    } else {
      showToast(`State Saved (${(buffer.byteLength / 1024 / 1024).toFixed(1)} MB)`);
    }
  } else if (type === 'STATE_SAVED_INTERNAL') {
    if (isExportPending) {
      isExportPending = false;
      if (lastKnownBuffer) {
        downloadBinaryState(lastKnownBuffer, `${currentRomName}.state`);
      } else {
        showToast('Guardando... pulsa Export en 1 seg');
      }
    } else {
      showToast('State Saved (Slot 0)');
    }
  } else if (type === 'STATE_LOADED') {
    showToast('State Loaded');
  } else if (type === 'STATE_ERROR') {
    showToast('State Operation Failed', true);
  } else if (type === 'AUDIO_CHUNK') {
    audioManager.playChunk(payload.left, payload.right);
  }
};

audioBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  const isActive = audioManager.toggleAudio();
  audioBtn.textContent = isActive ? '🔊 Audio' : '🔇 Audio';
  if (isActive) {
    showToast('Audio Activado');
  }
});

function triggerSaveState(exportToFile = false) {
  isExportPending = exportToFile;
  worker.postMessage({ type: 'SAVE_STATE' });
}

async function triggerLoadState() {
  const buffer = await saveManager.loadState(currentRomName);
  if (buffer) {
    worker.postMessage({ type: 'LOAD_STATE', payload: { buffer } }, [buffer]);
    return;
  }
  worker.postMessage({ type: 'LOAD_STATE' });
}

btnSaveState.addEventListener('click', () => triggerSaveState(false));
btnLoadState.addEventListener('click', triggerLoadState);

btnClearState.addEventListener('click', async () => {
  await saveManager.deleteState(currentRomName);
  lastKnownBuffer = null;
  showToast('Save State Borrado');
});

btnExportFile.addEventListener('click', () => {
  triggerSaveState(true);
});

stateFileInput.addEventListener('change', async () => {
  const file = stateFileInput.files?.[0];
  if (!file) return;

  console.log(`[Main] Archivo seleccionado: ${file.name} (${file.size} bytes)`);
  if (file.size < 1000) {
    showToast('Archivo .state inválido o vacío', true);
    stateFileInput.value = '';
    return;
  }

  const buffer = await file.arrayBuffer();
  lastKnownBuffer = buffer;
  worker.postMessage({ type: 'LOAD_STATE', payload: { buffer } }, [buffer]);
  stateFileInput.value = '';
});

window.addEventListener('keydown', (e) => {
  if (e.key === 'F2') {
    e.preventDefault();
    triggerSaveState(false);
  } else if (e.key === 'F4') {
    e.preventDefault();
    triggerLoadState();
  }
});

fpsSelector.addEventListener('change', () => {
  const fps = parseFloat(fpsSelector.value) || 60;
  worker.postMessage({ type: 'SET_FPS', payload: { fps } });
});

btnOpenSettings.addEventListener('click', (e) => {
  e.stopPropagation();
  settingsOverlay.classList.add('active');
});

btnCloseSettings.addEventListener('click', (e) => {
  e.stopPropagation();
  settingsOverlay.classList.remove('active');
});

settingsOverlay.addEventListener('click', (e) => {
  if (e.target === settingsOverlay) {
    settingsOverlay.classList.remove('active');
  }
});

function renderMappings() {
  mappingList.innerHTML = '';
  inputSystem.mappings.forEach((m) => {
    const row = document.createElement('div');
    row.className = 'mapping-row';

    const name = document.createElement('div');
    name.textContent = m.label;

    const right = document.createElement('div');
    const val = document.createElement('span');
    val.style.marginRight = '8px';
    val.textContent = m.type === 'gamepad' ? `B${m.code}` : `${m.code}`;

    const assignBtn = document.createElement('button');
    assignBtn.className = 'btn-assign';
    assignBtn.textContent = 'Asignar';

    assignBtn.addEventListener('click', () => {
      assignBtn.textContent = 'Presiona...';
      assignBtn.classList.add('waiting');
      inputSystem.startAssign(m.id, () => {
        renderMappings();
      });
    });

    right.appendChild(val);
    right.appendChild(assignBtn);
    row.appendChild(name);
    row.appendChild(right);
    mappingList.appendChild(row);
  });
}
renderMappings();

btnAutoconfig.addEventListener('click', () => {
  inputSystem.autoConfigureStandard();
  renderMappings();
});

btnSaveCfg.addEventListener('click', () => {
  inputSystem.exportToFile();
});

btnLoadCfg.addEventListener('click', () => {
  fileCfgInput.click();
});

fileCfgInput.addEventListener('change', () => {
  const file = fileCfgInput.files?.[0];
  if (file) {
    inputSystem.importFromFile(file, () => renderMappings());
  }
});

function updateGamepadUI() {
  const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
  const gp = gamepads.find((g) => g !== null);

  if (gp) {
    gpStatusText.style.display = 'none';
    gpCard.style.display = 'block';
    gpTitle.textContent = `${gp.id}`;

    const pressed: string[] = [];
    gp.buttons.forEach((b, idx) => {
      if (b.pressed) pressed.push(`B${idx}`);
    });
    gpActiveInput.textContent = pressed.length > 0 ? `Entradas: ${pressed.join(', ')}` : '(sin entradas)';
  } else {
    gpStatusText.style.display = 'block';
    gpCard.style.display = 'none';
  }

  requestAnimationFrame(updateGamepadUI);
}
updateGamepadUI();

romInput.addEventListener('change', async () => {
  const file = romInput.files?.[0];
  if (!file) return;

  currentRomName = file.name.replace(/\.[^/.]+$/, '');
  
  loadingOverlay.classList.add('active');
  loadingText.textContent = `Leyendo ${file.name}...`;

  try {
    const buffer = await file.arrayBuffer();
    loadingText.textContent = 'Montando ROM...';
    
    worker.postMessage(
      {
        type: 'LOAD_ROM',
        payload: { name: file.name, buffer },
      },
      [buffer]
    );

    setTimeout(() => {
      loadingOverlay.classList.remove('active');
    }, 500);
  } catch (err) {
    console.error('[Main] Error al cargar la ROM:', err);
    showToast('Error de memoria al leer la ROM', true);
    loadingOverlay.classList.remove('active');
  }
});

toggleBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  isRunning = !isRunning;
  toggleBtn.textContent = isRunning ? '⏸️' : '▶️';
  worker.postMessage({ type: isRunning ? 'RESUME' : 'PAUSE' });
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((registration) => {
      console.log('[PWA] Service Worker registrado con éxito:', registration.scope);
    }).catch((err) => {
      console.error('[PWA] Error registrando Service Worker:', err);
    });
  });
}
