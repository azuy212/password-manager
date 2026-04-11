/**
 * Cross-platform string ↔ bytes encoding utilities.
 * Works in Hermes (Android/iOS), V8 (Web), and JSC.
 */

/**
 * Encode a string to a UTF-8 byte array
 */
export function stringToBytes(str: string): number[] {
  // Use native TextEncoder on web for performance, manual encoding on native
  if (typeof TextEncoder !== 'undefined') {
    return Array.from(new TextEncoder().encode(str));
  }

  const bytes: number[] = [];
  let i = 0;
  let charCode: number;

  while (i < str.length) {
    charCode = str.charCodeAt(i);
    i++;

    if (charCode <= 0x7f) {
      bytes.push(charCode);
    } else if (charCode <= 0x7ff) {
      bytes.push(0xc0 | (charCode >> 6), 0x80 | (charCode & 0x3f));
    } else if (charCode <= 0xd7ff || charCode >= 0xe000) {
      bytes.push(
        0xe0 | (charCode >> 12),
        0x80 | ((charCode >> 6) & 0x3f),
        0x80 | (charCode & 0x3f)
      );
    } else {
      // Surrogate pair
      i++;
      charCode =
        0x10000 + (((charCode & 0x3ff) << 10) | (str.charCodeAt(i - 1) & 0x3ff));
      bytes.push(
        0xf0 | (charCode >> 18),
        0x80 | ((charCode >> 12) & 0x3f),
        0x80 | ((charCode >> 6) & 0x3f),
        0x80 | (charCode & 0x3f)
      );
    }
  }

  return bytes;
}

/**
 * Decode a UTF-8 byte array to a string
 */
export function bytesToString(bytes: number[]): string {
  // Use native TextDecoder on web for performance
  if (typeof TextDecoder !== 'undefined') {
    return new TextDecoder().decode(new Uint8Array(bytes));
  }

  let result = '';
  let i = 0;

  while (i < bytes.length) {
    const byte1 = bytes[i];
    i++;

    if (byte1 < 0x80) {
      result += String.fromCharCode(byte1);
    } else if (byte1 >= 0xc0 && byte1 < 0xe0) {
      const byte2 = bytes[i];
      i++;
      result += String.fromCharCode(((byte1 & 0x1f) << 6) | (byte2 & 0x3f));
    } else if (byte1 >= 0xe0 && byte1 < 0xf0) {
      const byte2 = bytes[i];
      i++;
      const byte3 = bytes[i];
      i++;
      result += String.fromCharCode(
        ((byte1 & 0x0f) << 12) | ((byte2 & 0x3f) << 6) | (byte3 & 0x3f)
      );
    } else {
      // 4-byte sequence (surrogate pair)
      const byte2 = bytes[i];
      i++;
      const byte3 = bytes[i];
      i++;
      const byte4 = bytes[i];
      i++;
      let codePoint =
        ((byte1 & 0x07) << 18) |
        ((byte2 & 0x3f) << 12) |
        ((byte3 & 0x3f) << 6) |
        (byte4 & 0x3f);
      codePoint -= 0x10000;
      result += String.fromCharCode(
        0xd800 + (codePoint >> 10),
        0xdc00 + (codePoint & 0x3ff)
      );
    }
  }

  return result;
}

/**
 * Hex ↔ bytes conversion
 */
export function bytesToHex(bytes: number[]): string {
  return bytes.map(b => b.toString(16).padStart(2, '0')).join('');
}

export function hexToBytes(hex: string): number[] {
  const bytes: number[] = [];
  for (let i = 0; i < hex.length; i += 2) {
    bytes.push(parseInt(hex.substring(i, i + 2), 16));
  }
  return bytes;
}
