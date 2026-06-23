//! Decrypt the `.artcade` XChaCha20-Poly1305 container so the editor can reopen
//! packages it produced. Format and key resolution mirror the Python packer
//! (runtime-cpp/tools/artcade_crypto.py + artcade_keytool.py) byte-for-byte so
//! pack and unpack can never disagree:
//!
//!   magic[8] "ARTCADE1" | version u8=1 | flags u8 | nonce[24] | mac[16] | ct[N]
//!
//! libsodium's combined-mode AEAD appends the 16-byte tag to the ciphertext;
//! the packer splits it into the `mac` field, so we recombine `ct || mac` for
//! the RustCrypto AEAD (which also expects the tag last).

use chacha20poly1305::aead::{Aead, KeyInit, Payload};
use chacha20poly1305::{Key, XChaCha20Poly1305, XNonce};

const MAGIC: &[u8; 8] = b"ARTCADE1";
const VERSION: u8 = 1;
const FLAG_ENCRYPTED: u8 = 0x01;
const NONCE_LEN: usize = 24;
const MAC_LEN: usize = 16;
const HEADER_LEN: usize = MAGIC.len() + 1 + 1 + NONCE_LEN + MAC_LEN; // 50
const KEY_BYTES: usize = 32;
const ENV_VAR: &str = "ARTCADE_ASSET_KEY";

/// True when the bytes start with the encryption-container magic.
pub fn is_container(data: &[u8]) -> bool {
    data.len() >= MAGIC.len() && &data[..MAGIC.len()] == MAGIC
}

fn parse_hex_key(text: &str, source: &str) -> Result<[u8; KEY_BYTES], String> {
    let cleaned: String = text
        .trim()
        .to_ascii_lowercase()
        .replace("0x", "")
        .chars()
        .filter(|c| !c.is_whitespace())
        .collect();
    if cleaned.len() != KEY_BYTES * 2 {
        return Err(format!(
            "{source}: key must be {KEY_BYTES} bytes ({} hex chars), got {}",
            KEY_BYTES * 2,
            cleaned.len()
        ));
    }
    let mut out = [0u8; KEY_BYTES];
    for (i, byte) in out.iter_mut().enumerate() {
        let hi = u8::from_str_radix(&cleaned[i * 2..i * 2 + 1], 16)
            .map_err(|_| format!("{source}: not valid hex"))?;
        let lo = u8::from_str_radix(&cleaned[i * 2 + 1..i * 2 + 2], 16)
            .map_err(|_| format!("{source}: not valid hex"))?;
        *byte = (hi << 4) | lo;
    }
    Ok(out)
}

/// Built-in dev key (0x00..0x1F) — INSECURE, dev-only; matches artcade_keytool.
fn dev_key() -> [u8; KEY_BYTES] {
    let mut k = [0u8; KEY_BYTES];
    for (i, b) in k.iter_mut().enumerate() {
        *b = i as u8;
    }
    k
}

/// Resolve the 32-byte key, mirroring artcade_keytool.resolve_key():
///   1. env ARTCADE_ASSET_KEY (hex)
///   2. file <repo>/runtime-cpp/secrets/artcade_key.hex (hex)
///   3. built-in dev key
fn resolve_key() -> Result<[u8; KEY_BYTES], String> {
    if let Ok(env) = std::env::var(ENV_VAR) {
        if !env.trim().is_empty() {
            return parse_hex_key(&env, &format!("${ENV_VAR}"));
        }
    }
    if let Ok(runtime_cpp) = crate::sdk::runtime_cpp_dir() {
        let path = runtime_cpp.join("secrets").join("artcade_key.hex");
        if path.is_file() {
            let text = std::fs::read_to_string(&path)
                .map_err(|e| format!("{}: {e}", path.display()))?;
            return parse_hex_key(&text, &path.display().to_string());
        }
    }
    Ok(dev_key())
}

/// Verify and unwrap a container into its plaintext (the inner ZIP bytes).
pub fn decrypt(container: &[u8]) -> Result<Vec<u8>, String> {
    if !is_container(container) {
        return Err("not an .artcade encryption container".into());
    }
    if container.len() < HEADER_LEN {
        return Err("truncated .artcade container".into());
    }
    let version = container[MAGIC.len()];
    let flags = container[MAGIC.len() + 1];
    if version != VERSION {
        return Err(format!("unsupported container version {version}"));
    }
    if flags & FLAG_ENCRYPTED == 0 {
        return Err("container is not marked encrypted".into());
    }

    let nonce = &container[10..34];
    let mac = &container[34..50];
    let ciphertext = &container[50..];

    // RustCrypto AEAD expects ciphertext || tag (tag last), like libsodium.
    let mut combined = Vec::with_capacity(ciphertext.len() + MAC_LEN);
    combined.extend_from_slice(ciphertext);
    combined.extend_from_slice(mac);

    let key = resolve_key()?;
    let cipher = XChaCha20Poly1305::new(Key::from_slice(&key));
    cipher
        .decrypt(
            XNonce::from_slice(nonce),
            Payload { msg: &combined, aad: b"" },
        )
        .map_err(|_| {
            "failed to decrypt .artcade (wrong key or corrupt package). Set \
             ARTCADE_ASSET_KEY to the key used to pack it."
                .to_string()
        })
}

#[cfg(test)]
mod tests {
    use super::*;
    use chacha20poly1305::aead::OsRng;
    use chacha20poly1305::AeadCore;

    /// Wrap plaintext exactly like artcade_crypto.encrypt (mac split out).
    fn encrypt_with(plaintext: &[u8], key: &[u8; KEY_BYTES]) -> Vec<u8> {
        let cipher = XChaCha20Poly1305::new(Key::from_slice(key));
        let nonce = XChaCha20Poly1305::generate_nonce(&mut OsRng);
        let combined = cipher
            .encrypt(&nonce, Payload { msg: plaintext, aad: b"" })
            .unwrap();
        let (ct, mac) = combined.split_at(combined.len() - MAC_LEN);
        let mut out = Vec::new();
        out.extend_from_slice(MAGIC);
        out.push(VERSION);
        out.push(FLAG_ENCRYPTED);
        out.extend_from_slice(nonce.as_slice());
        out.extend_from_slice(mac);
        out.extend_from_slice(ct);
        out
    }

    #[test]
    fn round_trips_with_dev_key() {
        let plain = b"PK\x03\x04 pretend this is a zip payload";
        let container = encrypt_with(plain, &dev_key());
        assert!(is_container(&container));
        assert_eq!(decrypt(&container).unwrap(), plain);
    }

    #[test]
    fn rejects_non_container() {
        assert!(!is_container(b"PK\x03\x04"));
        assert!(decrypt(b"PK\x03\x04 not a container").is_err());
    }

    #[test]
    fn rejects_wrong_key() {
        let mut other = dev_key();
        other[0] ^= 0xff;
        let container = encrypt_with(b"secret", &other);
        // resolve_key() falls back to the dev key here, which won't match.
        assert!(decrypt(&container).is_err());
    }

    #[test]
    fn parses_hex_key_forms() {
        let hex = "00".repeat(KEY_BYTES);
        assert_eq!(parse_hex_key(&hex, "test").unwrap(), [0u8; KEY_BYTES]);
        assert!(parse_hex_key("abcd", "test").is_err());
    }
}
