export interface ControlMapping {
  id: string;
  label: string;
  bit: number;
  type: 'key' | 'gamepad';
  code: string | number; // e.g. "KeyW" o index de botón del Gamepad (0, 1, 2...)
}

export const DEFAULT_MAPPING: ControlMapping[] = [
  { id: 'up', label: 'Up (Arriba)', bit: 0, type: 'key', code: 'KeyW' },
  { id: 'down', label: 'Down (Abajo)', bit: 1, type: 'key', code: 'KeyS' },
  { id: 'left', label: 'Left (Izquierda)', bit: 2, type: 'key', code: 'KeyA' },
  { id: 'right', label: 'Right (Derecha)', bit: 3, type: 'key', code: 'KeyD' },
  { id: 'cross', label: 'Cross (Cruz)', bit: 4, type: 'key', code: 'KeyJ' },
  { id: 'circle', label: 'Circle (Círculo)', bit: 5, type: 'key', code: 'KeyK' },
  { id: 'square', label: 'Square (Cuadrado)', bit: 6, type: 'key', code: 'KeyU' },
  { id: 'triangle', label: 'Triangle (Triángulo)', bit: 7, type: 'key', code: 'KeyI' },
  { id: 'l1', label: 'L1', bit: 8, type: 'key', code: 'KeyQ' },
  { id: 'r1', label: 'R1', bit: 9, type: 'key', code: 'KeyE' },
  { id: 'l2', label: 'L2', bit: 12, type: 'key', code: 'Digit1' },
  { id: 'r2', label: 'R2', bit: 13, type: 'key', code: 'Digit2' },
  { id: 'start', label: 'Start', bit: 10, type: 'key', code: 'Enter' },
  { id: 'select', label: 'Select', bit: 11, type: 'key', code: 'Space' },
];

export class ArcadeInputSystem {
  private inputView: Int32Array;
  public mappings: ControlMapping[];
  public activeGamepadIndex: number | null = null;
  public deadzone: number = 0.25;
  private listeningActionId: string | null = null;
  private onRemapCallback: (() => void) | null = null;

  constructor(sharedBuffer: SharedArrayBuffer, offset: number) {
    this.inputView = new Int32Array(sharedBuffer, offset, 1);
    const saved = localStorage.getItem('webv8_controls');
    this.mappings = saved ? JSON.parse(saved) : JSON.parse(JSON.stringify(DEFAULT_MAPPING));

    this.initKeyboard();
    this.initGamepadDetection();
    this.pollLoop();
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
      if (this.listeningActionId) {
        e.preventDefault();
        if (e.key === 'Escape') {
          this.cancelAssign();
          return;
        }
        this.applyMapping(this.listeningActionId, 'key', e.code);
        return;
      }

      const match = this.mappings.find((m) => m.type === 'key' && m.code === e.code);
      if (match) {
        e.preventDefault();
        this.setBit(match.bit, true);
      }
    });

    window.addEventListener('keyup', (e) => {
      const match = this.mappings.find((m) => m.type === 'key' && m.code === e.code);
      if (match) {
        e.preventDefault();
        this.setBit(match.bit, false);
      }
    });
  }

  private initGamepadDetection() {
    window.addEventListener('gamepadconnected', (e) => {
      console.log('Mando conectado:', e.gamepad.id);
      if (this.activeGamepadIndex === null) {
        this.activeGamepadIndex = e.gamepad.index;
      }
    });

    window.addEventListener('gamepaddisconnected', (e) => {
      if (this.activeGamepadIndex === e.gamepad.index) {
        this.activeGamepadIndex = null;
      }
    });
  }

  private pollLoop = () => {
    const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
    const gp = this.activeGamepadIndex !== null ? gamepads[this.activeGamepadIndex] : null;

    if (gp) {
      // Captura durante el proceso de asignación
      if (this.listeningActionId) {
        gp.buttons.forEach((btn, idx) => {
          if (btn.pressed) {
            this.applyMapping(this.listeningActionId!, 'gamepad', idx);
          }
        });
      } else {
        // Mapeo activo en juego
        this.mappings.forEach((m) => {
          if (m.type === 'gamepad' && typeof m.code === 'number') {
            const isPressed = gp.buttons[m.code]?.pressed ?? false;
            this.setBit(m.bit, isPressed);
          }
        });

        // Lectura de D-Pad analógico por defecto (eje X e Y)
        const axisX = gp.axes[0] || 0;
        const axisY = gp.axes[1] || 0;
        if (Math.abs(axisX) > this.deadzone) {
          this.setBit(2, axisX < -this.deadzone); // Left
          this.setBit(3, axisX > this.deadzone);  // Right
        }
        if (Math.abs(axisY) > this.deadzone) {
          this.setBit(0, axisY < -this.deadzone); // Up
          this.setBit(1, axisY > this.deadzone);  // Down
        }
      }
    }

    requestAnimationFrame(this.pollLoop);
  };

  public startAssign(actionId: string, cb: () => void) {
    this.listeningActionId = actionId;
    this.onRemapCallback = cb;
  }

  public cancelAssign() {
    this.listeningActionId = null;
    if (this.onRemapCallback) this.onRemapCallback();
  }

  private applyMapping(actionId: string, type: 'key' | 'gamepad', code: string | number) {
    const target = this.mappings.find((m) => m.id === actionId);
    if (target) {
      target.type = type;
      target.code = code;
      this.saveLocal();
    }
    this.cancelAssign();
  }

  public autoConfigureStandard() {
    // Layout estándar XInput / DualShock
    this.mappings = [
      { id: 'up', label: 'Up (Arriba)', bit: 0, type: 'gamepad', code: 12 },
      { id: 'down', label: 'Down (Abajo)', bit: 1, type: 'gamepad', code: 13 },
      { id: 'left', label: 'Left (Izquierda)', bit: 2, type: 'gamepad', code: 14 },
      { id: 'right', label: 'Right (Derecha)', bit: 3, type: 'gamepad', code: 15 },
      { id: 'cross', label: 'Cross (Cruz)', bit: 4, type: 'gamepad', code: 0 },
      { id: 'circle', label: 'Circle (Círculo)', bit: 5, type: 'gamepad', code: 1 },
      { id: 'square', label: 'Square (Cuadrado)', bit: 6, type: 'gamepad', code: 2 },
      { id: 'triangle', label: 'Triangle (Triángulo)', bit: 7, type: 'gamepad', code: 3 },
      { id: 'l1', label: 'L1', bit: 8, type: 'gamepad', code: 4 },
      { id: 'r1', label: 'R1', bit: 9, type: 'gamepad', code: 5 },
      { id: 'l2', label: 'L2', bit: 12, type: 'gamepad', code: 6 },
      { id: 'r2', label: 'R2', bit: 13, type: 'gamepad', code: 7 },
      { id: 'start', label: 'Start', bit: 10, type: 'gamepad', code: 9 },
      { id: 'select', label: 'Select', bit: 11, type: 'gamepad', code: 8 },
    ];
    this.saveLocal();
  }

  public saveLocal() {
    localStorage.setItem('webv8_controls', JSON.stringify(this.mappings));
  }

  public exportToFile() {
    const blob = new Blob([JSON.stringify(this.mappings, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'webv8_controls.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  public importFromFile(file: File, onDone: () => void) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        this.mappings = data;
        this.saveLocal();
        onDone();
      } catch (err) {
        alert('Archivo de configuración no válido');
      }
    };
    reader.readAsText(file);
  }
}
