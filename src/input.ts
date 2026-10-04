// Mapeo de botones arcade (estándar PlayStation / N64)
export const BUTTONS = {
  UP: 0,
  DOWN: 1,
  LEFT: 2,
  RIGHT: 3,
  A: 4,      // Cruz / A
  B: 5,      // Círculo / B
  X: 6,      // Cuadrado / C-Left
  Y: 7,      // Triángulo / C-Down
  L1: 8,     // L / L-Trigger
  R1: 9,     // R / R-Trigger
  START: 10,
  SELECT: 11,
} as const;

export class InputManager {
  private inputView: Int32Array;

  constructor(sharedBuffer: SharedArrayBuffer, offset: number = 0) {
    // Usamos una sección de la memoria compartida para los botones (1 entero de 32 bits es suficiente como bitmask)
    this.inputView = new Int32Array(sharedBuffer, offset, 1);
    this.initKeyboard();
  }

  private setBit(bit: number, pressed: boolean) {
    if (pressed) {
      Atomics.or(this.inputView, 0, 1 << bit);
    } else {
      Atomics.and(this.inputView, 0, ~(1 << bit));
    }
  }

  private initKeyboard() {
    window.addEventListener('keydown', (e) => {
      switch (e.code) {
        case 'ArrowUp':
        case 'KeyW': this.setBit(BUTTONS.UP, true); break;
        case 'ArrowDown':
        case 'KeyS': this.setBit(BUTTONS.DOWN, true); break;
        case 'ArrowLeft':
        case 'KeyA': this.setBit(BUTTONS.LEFT, true); break;
        case 'ArrowRight':
        case 'KeyD': this.setBit(BUTTONS.RIGHT, true); break;
        case 'KeyZ':
        case 'KeyJ': this.setBit(BUTTONS.A, true); break;
        case 'KeyX':
        case 'KeyK': this.setBit(BUTTONS.B, true); break;
        case 'KeyC':
        case 'KeyU': this.setBit(BUTTONS.X, true); break;
        case 'KeyV':
        case 'KeyI': this.setBit(BUTTONS.Y, true); break;
        case 'KeyQ': this.setBit(BUTTONS.L1, true); break;
        case 'KeyE': this.setBit(BUTTONS.R1, true); break;
        case 'Enter': this.setBit(BUTTONS.START, true); break;
        case 'ShiftRight':
        case 'Space': this.setBit(BUTTONS.SELECT, true); break;
      }
    });

    window.addEventListener('keyup', (e) => {
      switch (e.code) {
        case 'ArrowUp':
        case 'KeyW': this.setBit(BUTTONS.UP, false); break;
        case 'ArrowDown':
        case 'KeyS': this.setBit(BUTTONS.DOWN, false); break;
        case 'ArrowLeft':
        case 'KeyA': this.setBit(BUTTONS.LEFT, false); break;
        case 'ArrowRight':
        case 'KeyD': this.setBit(BUTTONS.RIGHT, false); break;
        case 'KeyZ':
        case 'KeyJ': this.setBit(BUTTONS.A, false); break;
        case 'KeyX':
        case 'KeyK': this.setBit(BUTTONS.B, false); break;
        case 'KeyC':
        case 'KeyU': this.setBit(BUTTONS.X, false); break;
        case 'KeyV':
        case 'KeyI': this.setBit(BUTTONS.Y, false); break;
        case 'KeyQ': this.setBit(BUTTONS.L1, false); break;
        case 'KeyE': this.setBit(BUTTONS.R1, false); break;
        case 'Enter': this.setBit(BUTTONS.START, false); break;
        case 'ShiftRight':
        case 'Space': this.setBit(BUTTONS.SELECT, false); break;
      }
    });
  }
}
