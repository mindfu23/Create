/**
 * Encryption utilities using Web Crypto API
 * Uses AES-GCM for symmetric encryption with user-provided key
 * The key is NEVER stored - user must provide it each session
 */

// Convert string to ArrayBuffer
function stringToBuffer(str: string): ArrayBuffer {
  return new TextEncoder().encode(str);
}

// Convert ArrayBuffer to string
function bufferToString(buffer: ArrayBuffer): string {
  return new TextDecoder().decode(buffer);
}

// Convert ArrayBuffer to base64
function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Convert base64 to ArrayBuffer
function base64ToBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Derive a cryptographic key from user password using PBKDF2
 * This creates a strong key from any user-provided string
 */
export async function deriveKey(password: string, salt?: Uint8Array): Promise<{ key: CryptoKey; salt: Uint8Array }> {
  // Generate or use provided salt
  const usedSalt = salt || crypto.getRandomValues(new Uint8Array(16));
  
  // Import password as key material
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    stringToBuffer(password),
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  );
  
  // Derive AES-GCM key
  const key = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: usedSalt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
  
  return { key, salt: usedSalt };
}

/**
 * Encrypt data with AES-GCM
 * Returns base64 encoded string containing: salt + iv + ciphertext
 */
export async function encrypt(data: string, password: string): Promise<string> {
  const { key, salt } = await deriveKey(password);
  
  // Generate random IV
  const iv = crypto.getRandomValues(new Uint8Array(12));
  
  // Encrypt
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    stringToBuffer(data)
  );
  
  // Combine salt + iv + ciphertext
  const combined = new Uint8Array(salt.length + iv.length + ciphertext.byteLength);
  combined.set(salt, 0);
  combined.set(iv, salt.length);
  combined.set(new Uint8Array(ciphertext), salt.length + iv.length);
  
  return bufferToBase64(combined.buffer);
}

/**
 * Decrypt data with AES-GCM
 * Expects base64 string containing: salt + iv + ciphertext
 */
export async function decrypt(encryptedData: string, password: string): Promise<string> {
  const combined = new Uint8Array(base64ToBuffer(encryptedData));
  
  // Extract salt, iv, and ciphertext
  const salt = combined.slice(0, 16);
  const iv = combined.slice(16, 28);
  const ciphertext = combined.slice(28);
  
  // Derive key with same salt
  const { key } = await deriveKey(password, salt);
  
  // Decrypt
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext
  );
  
  return bufferToString(plaintext);
}

/**
 * Hash a string (for checksums, not passwords)
 */
export async function hash(data: string): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', stringToBuffer(data));
  return bufferToBase64(hashBuffer);
}

/**
 * Verify if password can decrypt data
 */
export async function verifyPassword(encryptedData: string, password: string): Promise<boolean> {
  try {
    await decrypt(encryptedData, password);
    return true;
  } catch {
    return false;
  }
}
