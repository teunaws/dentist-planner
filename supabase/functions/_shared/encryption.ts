
import { encodeBase64, decodeBase64 } from "jsr:@std/encoding/base64";

/**
 * Encrypts cleartext using AES-GCM 256-bit with a random IV.
 * @param text The plain text to encrypt
 * @returns format: "IV_BASE64:CIPHERTEXT_BASE64"
 */
export async function encrypt(text: string): Promise<string> {
    if (!text) return text;

    const keyBase64 = Deno.env.get('ENCRYPTION_KEY');
    if (!keyBase64) throw new Error('Missing ENCRYPTION_KEY');

    // Import key
    const keyBuffer = decodeBase64(keyBase64);
    const cryptoKey = await crypto.subtle.importKey(
        "raw",
        keyBuffer,
        { name: "AES-GCM" },
        false,
        ["encrypt"]
    );

    const encodedText = new TextEncoder().encode(text);

    // Generate random 12-byte IV
    const iv = crypto.getRandomValues(new Uint8Array(12));

    // Encrypt
    const encryptedBuffer = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        cryptoKey,
        encodedText
    );

    return `${encodeBase64(iv)}:${encodeBase64(new Uint8Array(encryptedBuffer))}`;
}

/**
 * Decrypts ciphertext using AES-GCM 256-bit.
 * @param encryptedText format: "IV_BASE64:CIPHERTEXT_BASE64"
 */
export async function decrypt(encryptedText: string): Promise<string> {
    if (!encryptedText || !encryptedText.includes(':')) return encryptedText;

    const keyBase64 = Deno.env.get('ENCRYPTION_KEY');
    if (!keyBase64) throw new Error('Missing ENCRYPTION_KEY');

    // Import key
    const keyBuffer = decodeBase64(keyBase64);
    const cryptoKey = await crypto.subtle.importKey(
        "raw",
        keyBuffer,
        { name: "AES-GCM" },
        false,
        ["decrypt"]
    );

    const [ivBase64, cipherBase64] = encryptedText.split(':');

    const iv = decodeBase64(ivBase64);
    const cipherText = decodeBase64(cipherBase64);

    const decryptedBuffer = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv },
        cryptoKey,
        cipherText
    );

    return new TextDecoder().decode(decryptedBuffer);
}

/**
 * Hashes text for blind indexing using HMAC-SHA256.
 * Input is normalized (lowercased, trimmed) before hashing.
 * @returns Hex string of the hash
 */
export async function hashForSearch(text: string): Promise<string> {
    if (!text) return text;

    const pepperBase64 = Deno.env.get('SEARCH_PEPPER');
    if (!pepperBase64) throw new Error('Missing SEARCH_PEPPER');

    // Normalization
    const normalized = text.toLowerCase().trim();

    // Import Key
    const pepperBuffer = decodeBase64(pepperBase64);
    const cryptoKey = await crypto.subtle.importKey(
        "raw",
        pepperBuffer,
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"]
    );

    const encodedText = new TextEncoder().encode(normalized);
    const signature = await crypto.subtle.sign(
        "HMAC",
        cryptoKey,
        encodedText
    );

    // Convert to Hex
    return Array.from(new Uint8Array(signature))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}
