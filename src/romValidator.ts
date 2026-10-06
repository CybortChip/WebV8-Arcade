const ALLOWED_EXTENSIONS = ['.bin', '.iso', '.img', '.pbp', '.chd'];
const MAX_FILE_SIZE_BYTES = 750 * 1024 * 1024; // 750 MB límite seguro para PS1

export interface RomValidationResult {
  valid: boolean;
  error?: string;
  cleanedName?: string;
}

export function validateRomFile(file: File): RomValidationResult {
  if (!file) {
    return { valid: false, error: 'No se seleccionó ningún archivo.' };
  }

  // 1. Validar tamaño máximo
  if (file.size > MAX_FILE_SIZE_BYTES) {
    const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
    return {
      valid: false,
      error: `El archivo excede el límite permitido (${sizeMb} MB). El tamaño máximo para discos de PS1 es 750 MB.`
    };
  }

  // 2. Validar tamaño mínimo (evitar archivos vacíos o .cue sueltos sin datos)
  if (file.size < 1024 * 100) { // menos de 100 KB
    return {
      valid: false,
      error: 'El archivo es demasiado pequeño o está corrupto. Recuerda cargar el archivo de datos (.bin, .iso, .chd).'
    };
  }

  // 3. Validar extensión permitida
  const extensionMatch = file.name.match(/\.[0-9a-z]+$/i);
  const ext = extensionMatch ? extensionMatch[0].toLowerCase() : '';

  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return {
      valid: false,
      error: `Extensión "${ext}" no soportada. Formatos compatibles: ${ALLOWED_EXTENSIONS.join(', ')}.`
    };
  }

  // 4. Sanitizar nombre seguro (solo alfanumérico, guiones y puntos)
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');

  return {
    valid: true,
    cleanedName: safeName
  };
}
