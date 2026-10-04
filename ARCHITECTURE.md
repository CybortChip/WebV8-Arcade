# ARCHITECTURE.md: WebV8-Arcade

## 1. System Overview
WebV8-Arcade is a high-performance web-based multi-system emulator for PlayStation 1 (PS1) and Nintendo 64 (N64) targeting modern desktop and mobile browsers.

### Base Tech Stack
* **Frontend Runtime:** TypeScript + Vite
* **Emulation Engines:** WebAssembly (Wasm) modules compiled with Emscripten (-O3, SIMD128, threads)
* **Graphics Pipeline:** WebGL2 / WebGPU abstraction using OffscreenCanvas
* **Concurrency & Memory:** Web Workers, SharedArrayBuffer, and Atomics
* **Audio Subsystem:** AudioWorkletNode with lock-free RingBuffer
* **Input Subsystem:** Gamepad API + Keyboard Event listeners mapped through atomic shared buffers

---

## 2. WebAssembly Emulation Cores
* **PS1 Core:** Beetle/Mednafen PS1 (MIPS R3000A interpreter/recompiler, hardware rasterization mapped to WebGL2).
* **N64 Core:** Mupen64Plus-Core (VR4300 CPU, RSP/RDP microcode translated to WebGL2/WebGPU shaders).

---

## 3. Concurrency, Memory & Frame Timing
* **Main Thread:** Handles UI, user input polling, ROM loading, and WebGL/WebGPU surface presentation.
* **Emulation Worker:** Houses the Wasm core instance, instruction loop, and memory access.
* **Memory Model:** SharedArrayBuffer layout containing:
  * `Control Block`: Atomic state flags (Run, Pause, Reset, Step).
  * `Input Buffer`: 32-bit atomic state queried by Wasm during VBlank.
  * `Audio RingBuffer`: PCM stereo 16-bit samples consumed by AudioWorklet.

### 3.1. Dynamic Frame Rate Control (30 - 60 FPS)
* **Target Rate Selector:** User can configure emulation target rate between 30 FPS and 60 FPS.
* **Worker Timing Mechanism:** The emulation loop computes target frame times:
  * `16.66 ms` for 60 FPS targets.
  * `33.33 ms` for 30 FPS targets.
* **Frame Skipping Strategy:** When running in 30 FPS mode on games natively updating at 60 Hz, the core runs CPU/DSP logic continuously but skips rasterization to the frame buffer every other frame.
* **Audio Decoupling:** Sound output is paced independently through the circular buffer to prevent pitch warping or stuttering regardless of visual frame rate changes.

---

## 4. Graphics & Audio Pipelines
* **RenderContext:** Automatic fallback from WebGPU to WebGL2. Supports internal resolution scaling (1x native 240p up to 4x).
* **Audio Engine:** AudioWorklet thread resampling dynamically to prevent underruns or buffer drift.

---

## 5. Phased Roadmap
* **Phase 1 - Foundation:** Vite configuration, COOP/COEP headers, Web Worker scaffolding, SharedArrayBuffer setup.
* **Phase 2 - PS1 Core:** Beetle Wasm compilation, linear framebuffer display, basic AudioWorklet integration.
* **Phase 3 - N64 Core:** Mupen64Plus Wasm compilation, RDP shader translation, Gamepad mapping.
* **Phase 4 - Polish & Optimization:** WebGPU backend, CRT scanline post-processing shaders, IndexedDB save states.
