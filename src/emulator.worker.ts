let offscreenCanvas: any = null;
let inputSharedView: Int32Array | null = null;
let coreModule: any = null;

const CANVAS_WIDTH = 640;
const CANVAS_HEIGHT = 480;

let targetFps = 60;
let frameIntervalMs = 1000 / targetFps;
let lastRenderTime = performance.now();

let loadedRomBaseName = 'World Soccer Winning Eleven 2002 (Japan)';

const eventListeners: { [key: string]: Function[] } = {};

function dispatchWorkerEvent(type: string, eventObj: any) {
  if (eventListeners[type]) {
    for (const listener of eventListeners[type]) {
      listener(eventObj);
    }
  }
}

function createSafeStyleProxy() {
  const target: Record<string, any> = {
    setProperty: () => {},
    getPropertyValue: (prop: string) => {
      if (prop === 'width') return `${CANVAS_WIDTH}px`;
      if (prop === 'height') return `${CANVAS_HEIGHT}px`;
      return '';
    },
    removeProperty: () => '',
    width: `${CANVAS_WIDTH}px`,
    height: `${CANVAS_HEIGHT}px`,
  };
  return new Proxy(target, {
    get: (obj, prop) => (prop in obj ? obj[prop as string] : ''),
    set: (obj, prop, value) => {
      obj[prop as string] = value;
      return true;
    },
  });
}

const safeStyle = createSafeStyleProxy();

function patchOffscreenCanvas(canvas: OffscreenCanvas): any {
  const c = canvas as any;

  c.width = CANVAS_WIDTH;
  c.height = CANVAS_HEIGHT;
  c.clientWidth = CANVAS_WIDTH;
  c.clientHeight = CANVAS_HEIGHT;
  c.offsetWidth = CANVAS_WIDTH;
  c.offsetHeight = CANVAS_HEIGHT;
  c.style = safeStyle;

  c.getAttribute = (attr: string) => {
    if (attr === 'width') return CANVAS_WIDTH.toString();
    if (attr === 'height') return CANVAS_HEIGHT.toString();
    if (attr === 'id') return 'canvas';
    return null;
  };
  c.setAttribute = () => {};
  c.removeAttribute = () => {};

  c.getBoundingClientRect = () => ({
    width: CANVAS_WIDTH,
    height: CANVAS_HEIGHT,
    top: 0,
    left: 0,
    right: CANVAS_WIDTH,
    bottom: CANVAS_HEIGHT,
    x: 0,
    y: 0,
  });

  c.focus = () => {};
  c.blur = () => {};

  c.addEventListener = (type: string, listener: Function) => {
    if (!eventListeners[type]) eventListeners[type] = [];
    eventListeners[type].push(listener);
  };
  c.removeEventListener = (type: string, listener: Function) => {
    if (!eventListeners[type]) return;
    eventListeners[type] = eventListeners[type].filter((fn) => fn !== listener);
  };
  c.dispatchEvent = (e: any) => {
    dispatchWorkerEvent(e.type, e);
    return true;
  };

  return c;
}

class ResizeObserverShim {
  constructor(_callback: any) {}
  observe(_target: any) {}
  unobserve(_target: any) {}
  disconnect() {}
}

class MutationObserverShim {
  constructor(_callback: any) {}
  observe(_target: any, _options: any) {}
  disconnect() {}
  takeRecords() { return []; }
}

(self as any).ResizeObserver = (self as any).ResizeObserver || ResizeObserverShim;
(self as any).MutationObserver = (self as any).MutationObserver || MutationObserverShim;

const getComputedStyleShim = () => safeStyle;

const regulatedRAF = (callback: FrameRequestCallback): number => {
  const now = performance.now();
  const elapsed = now - lastRenderTime;
  const delay = Math.max(0, frameIntervalMs - elapsed);

  return (self as any).setTimeout(() => {
    lastRenderTime = performance.now();
    callback(lastRenderTime);
  }, delay);
};

const windowShim: any = {
  getComputedStyle: getComputedStyleShim,
  innerWidth: CANVAS_WIDTH,
  innerHeight: CANVAS_HEIGHT,
  outerWidth: CANVAS_WIDTH,
  outerHeight: CANVAS_HEIGHT,
  devicePixelRatio: 1,
  screen: { width: 1920, height: 1080 },
  ResizeObserver: (self as any).ResizeObserver,
  MutationObserver: (self as any).MutationObserver,
  matchMedia: () => ({ matches: false, addListener: () => {}, removeListener: () => {} }),
  addEventListener: (type: string, listener: Function) => {
    if (!eventListeners[type]) eventListeners[type] = [];
    eventListeners[type].push(listener);
  },
  removeEventListener: (type: string, listener: Function) => {
    if (!eventListeners[type]) return;
    eventListeners[type] = eventListeners[type].filter((fn) => fn !== listener);
  },
  requestAnimationFrame: regulatedRAF,
  cancelAnimationFrame: (id: number) => self.clearTimeout(id),
};

(self as any).requestAnimationFrame = regulatedRAF;
(self as any).cancelAnimationFrame = (id: number) => self.clearTimeout(id);
(self as any).getComputedStyle = getComputedStyleShim;
(self as any).window = new Proxy(windowShim, {
  get: (target, prop) => {
    if (prop in target) return target[prop];
    if (prop in self) return (self as any)[prop];
    return undefined;
  },
});

if (typeof (self as any).document === 'undefined') {
  (self as any).document = {
    defaultView: (self as any).window,
    addEventListener: (type: string, listener: Function) => {
      if (!eventListeners[type]) eventListeners[type] = [];
      eventListeners[type].push(listener);
    },
    removeEventListener: (type: string, listener: Function) => {
      if (!eventListeners[type]) return;
      eventListeners[type] = eventListeners[type].filter((fn) => fn !== listener);
    },
    getElementById: (id: string) => (id === 'canvas' ? offscreenCanvas : null),
    querySelector: () => offscreenCanvas,
    querySelectorAll: () => [],
    createElement: () => ({
      style: safeStyle,
      getAttribute: () => null,
      setAttribute: () => {},
      clientWidth: CANVAS_WIDTH,
      clientHeight: CANVAS_HEIGHT,
    }),
    documentElement: {
      style: safeStyle,
      clientWidth: CANVAS_WIDTH,
      clientHeight: CANVAS_HEIGHT,
    },
    body: {
      style: safeStyle,
      clientWidth: CANVAS_WIDTH,
      clientHeight: CANVAS_HEIGHT,
    },
  };
}

let previousButtons = 0;

const KEY_MAP: { [bit: number]: { code: string; key: string; keyCode: number } } = {
  0: { code: 'ArrowUp', key: 'ArrowUp', keyCode: 38 },
  1: { code: 'ArrowDown', key: 'ArrowDown', keyCode: 40 },
  2: { code: 'ArrowLeft', key: 'ArrowLeft', keyCode: 37 },
  3: { code: 'ArrowRight', key: 'ArrowRight', keyCode: 39 },
  4: { code: 'KeyZ', key: 'z', keyCode: 90 },
  5: { code: 'KeyX', key: 'x', keyCode: 88 },
  6: { code: 'KeyA', key: 'a', keyCode: 65 },
  7: { code: 'KeyS', key: 's', keyCode: 83 },
  8: { code: 'KeyQ', key: 'q', keyCode: 81 },
  9: { code: 'KeyW', key: 'w', keyCode: 87 },
  10: { code: 'Enter', key: 'Enter', keyCode: 13 },
  11: { code: 'ShiftRight', key: 'Shift', keyCode: 16 },
};

function pollInputLoop() {
  if (inputSharedView) {
    const currentButtons = Atomics.load(inputSharedView, 0);

    if (currentButtons !== previousButtons) {
      for (let bit = 0; bit < 14; bit++) {
        const wasPressed = (previousButtons & (1 << bit)) !== 0;
        const isPressed = (currentButtons & (1 << bit)) !== 0;

        if (isPressed !== wasPressed) {
          const mapping = KEY_MAP[bit];
          if (mapping) {
            const eventType = isPressed ? 'keydown' : 'keyup';
            const evt = {
              type: eventType,
              code: mapping.code,
              key: mapping.key,
              keyCode: mapping.keyCode,
              which: mapping.keyCode,
              bubbles: true,
              cancelable: true,
              preventDefault: () => {},
            };
            dispatchWorkerEvent(eventType, evt);
          }
        }
      }
      previousButtons = currentButtons;
    }
  }

  self.setTimeout(pollInputLoop, 8);
}

function getAllFileSystemFiles(): { path: string; size: number }[] {
  if (!coreModule || !coreModule.FS) return [];
  const fs = coreModule.FS;
  const list: { path: string; size: number }[] = [];

  function traverse(dir: string) {
    let entries: string[] = [];
    try {
      entries = fs.readdir(dir);
    } catch (_) {
      return;
    }

    for (const name of entries) {
      if (name === '.' || name === '..' || name === 'dev' || name === 'proc') continue;
      const full = dir === '/' ? `/${name}` : `${dir}/${name}`;
      try {
        const st = fs.stat(full);
        if (fs.isDir(st.mode)) {
          traverse(full);
        } else {
          list.push({ path: full, size: st.size });
        }
      } catch (_) {}
    }
  }

  traverse('/');
  return list;
}

function sendKey(key: string, code: string, keyCode: number) {
  dispatchWorkerEvent('keydown', { key, code, keyCode, bubbles: true, preventDefault: () => {} });
  setTimeout(() => {
    dispatchWorkerEvent('keyup', { key, code, keyCode, bubbles: true, preventDefault: () => {} });
  }, 50);
}

function saveState() {
  if (!coreModule) return;

  sendKey('F2', 'F2', 113);

  let retries = 0;
  const check = () => {
    retries++;
    const files = getAllFileSystemFiles();

    // Prioridad absoluta a la ruta de PCSX-ReARMed confirmada en consola
    const primaryPath = `/home/web_user/retroarch/userdata/states/PCSX-ReARMed/${loadedRomBaseName}.state`;
    try {
      const data = coreModule.FS.readFile(primaryPath);
      if (data && data.length > 50000) {
        const copy = new Uint8Array(data);
        console.log(`[Worker] State capturado de ruta oficial: ${primaryPath} (${copy.length} bytes)`);
        self.postMessage({ type: 'STATE_SAVED', payload: { buffer: copy.buffer } }, [copy.buffer]);
        return;
      }
    } catch (_) {}

    // Búsqueda en otros archivos .state
    const stateFiles = files
      .filter((f) => f.path.includes('.state') && f.size > 50000)
      .sort((a, b) => b.size - a.size);

    if (stateFiles.length > 0) {
      try {
        const best = stateFiles[0];
        const data = coreModule.FS.readFile(best.path);
        const copy = new Uint8Array(data);
        console.log(`[Worker] State capturado de ${best.path} (${copy.length} bytes)`);
        self.postMessage({ type: 'STATE_SAVED', payload: { buffer: copy.buffer } }, [copy.buffer]);
        return;
      } catch (err) {}
    }

    if (retries < 12) {
      setTimeout(check, 120);
    } else {
      self.postMessage({ type: 'STATE_SAVED_INTERNAL' });
    }
  };

  setTimeout(check, 120);
}

function loadState(buffer?: ArrayBuffer) {
  if (!coreModule || !coreModule.FS) return;
  const fs = coreModule.FS;

  if (buffer) {
    const bytes = new Uint8Array(buffer);
    console.log(`[Worker] Preparando estructura de directorios e inyectando ${bytes.length} bytes...`);

    // Aseguramos la existencia de toda la jerarquía de carpetas
    const requiredDirs = [
      '/home',
      '/home/web_user',
      '/home/web_user/retroarch',
      '/home/web_user/retroarch/userdata',
      '/home/web_user/retroarch/userdata/states',
      '/home/web_user/retroarch/userdata/states/PCSX-ReARMed',
      '/retroarch',
      '/retroarch/userdata',
      '/retroarch/userdata/states',
      '/retroarch/userdata/states/PCSX-ReARMed',
    ];

    for (const d of requiredDirs) {
      try { fs.mkdirTree(d); } catch (_) {}
    }

    // Ruta confirmada en consola
    const officialBase = `/home/web_user/retroarch/userdata/states/PCSX-ReARMed/${loadedRomBaseName}`;

    const criticalTargets = [
      `${officialBase}.state`,
      `${officialBase}.state0`,
      `${officialBase}.state.auto`,
      `/home/web_user/retroarch/userdata/states/${loadedRomBaseName}.state`,
      `/home/web_user/retroarch/userdata/states/${loadedRomBaseName}.state0`,
      `/${loadedRomBaseName}.state`,
      `/${loadedRomBaseName}.state0`,
      '/game.state',
      '/game.state0',
    ];

    for (const t of criticalTargets) {
      try {
        try { fs.unlink(t); } catch (_) {}
        fs.writeFile(t, bytes);
        console.log(`[Worker] Escrito con éxito en ruta crítica: ${t}`);
      } catch (err) {
        console.warn(`[Worker] Error escribiendo en ${t}:`, err);
      }
    }
  }

  // Esperar 200ms para asegurar flush en el FS y enviar F4
  setTimeout(() => {
    console.log('[Worker] Disparando tecla F4 a RetroArch...');
    sendKey('F4', 'F4', 115);
    self.postMessage({ type: 'STATE_LOADED' });
  }, 200);
}

async function initWasmCore(canvas: OffscreenCanvas) {
  try {
    offscreenCanvas = patchOffscreenCanvas(canvas);

    const coreUrl = new URL('/cores/pcsx_rearmed_libretro.js', self.location.origin).href;
    const dynamicImport = new Function('url', 'return import(url)');
    const imported = await dynamicImport(coreUrl);

    const factory = imported.default || imported.PCSX || (self as any).PCSX || (self as any).Module;

    const moduleConfig = {
      canvas: offscreenCanvas,
      noInitialRun: true,
      locateFile: (path: string) => `/cores/${path}`,
      setCanvasSize: (width: number, height: number) => {
        offscreenCanvas.width = width;
        offscreenCanvas.height = height;
      },
      print: (text: string) => console.log('[RetroArch Core Log]:', text),
      printErr: (text: string) => console.warn('[RetroArch Core Warn/Err]:', text),
    };

    if (typeof factory === 'function') {
      coreModule = await factory(moduleConfig);
    } else {
      coreModule = factory || (self as any).Module;
    }

    console.log('[Worker Core] Emscripten Runtime listo.');
    pollInputLoop();
  } catch (err) {
    console.error('[Worker] Error inicializando Wasm Core:', err);
  }
}

self.onmessage = async (e: MessageEvent) => {
  const { type, payload } = e.data;

  switch (type) {
    case 'INIT':
      inputSharedView = new Int32Array(payload.sab, payload.inputOffset, 1);
      if (payload.targetFps) {
        targetFps = payload.targetFps;
        frameIntervalMs = 1000 / targetFps;
      }
      await initWasmCore(payload.canvas);
      break;

    case 'SET_FPS':
      if (payload.fps && payload.fps > 0) {
        targetFps = payload.fps;
        frameIntervalMs = 1000 / targetFps;
      }
      break;

    case 'SAVE_STATE':
      saveState();
      break;

    case 'LOAD_STATE':
      loadState(payload?.buffer);
      break;

    case 'LOAD_ROM': {
      if (!coreModule || !coreModule.FS) {
        setTimeout(() => self.postMessage(e.data), 300);
        return;
      }

      const rawName = payload.name || 'game.bin';
      loadedRomBaseName = rawName.replace(/\.[^/.]+$/, '');
      console.log(`[Worker] Montando ROM: "${loadedRomBaseName}"`);

      // Creamos de antemano el árbol de carpetas de estados para este core
      try {
        coreModule.FS.mkdirTree('/home/web_user/retroarch/userdata/states/PCSX-ReARMed');
      } catch (_) {}

      const romBytes = new Uint8Array(payload.buffer);

      try {
        try { coreModule.FS.unlink(`/${rawName}`); } catch (_) {}
        try { coreModule.FS.unlink('/game.bin'); } catch (_) {}

        coreModule.FS.writeFile(`/${rawName}`, romBytes);
        coreModule.FS.writeFile('/game.bin', romBytes);

        if (coreModule.callMain) {
          coreModule.callMain([`/${rawName}`]);
        }
      } catch (err) {
        console.error('[Worker] Error al ejecutar callMain:', err);
      }
      break;
    }

    case 'PAUSE':
      if (coreModule && coreModule._cmd_pause) coreModule._cmd_pause();
      break;

    case 'RESUME':
      if (coreModule && coreModule._cmd_unpause) coreModule._cmd_unpause();
      break;
  }
};
