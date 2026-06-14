# Asset Encryption (.artcade)

Shipped `.artcade` archives are encrypted so a casual user cannot unzip a game
and rip its sprites, audio, and Lua. This document describes the scheme, its
threat model, and how to operate it.

## Threat model — read this first

**This is anti-casual-ripping obfuscation, not DRM.** The decryption key is
embedded in the client binary, and in the WebAssembly build it is trivially
inspectable. A determined attacker can extract the key and decrypt any archive.

The goal is narrow and honest: stop drag-and-drop extraction by ordinary users.
It does **not** protect against a motivated reverse engineer. Do not market it
as copy protection.

## Scheme

- **Cipher:** XChaCha20-Poly1305 (AEAD), 256-bit key, 192-bit random nonce.
  Chosen over AES-256-GCM because WebAssembly has no AES-NI, so a software
  XChaCha20 is the portable, fast, identical-on-both-targets choice.
- **Pack side:** [`runtime-cpp/tools/pack-artcade.py`](../runtime-cpp/tools/pack-artcade.py)
  via PyNaCl (libsodium).
- **Unpack side:** [`runtime-cpp/src/modules/asset-system/src/artcade-crypto.cpp`](../runtime-cpp/src/modules/asset-system/src/artcade-crypto.cpp)
  via Monocypher, invoked from `zipExtractAll` before ZIP parsing.
- **Whole-archive wrap:** the plaintext ZIP is encrypted as one blob inside a
  container; the runtime decrypts in memory, then parses the ZIP normally.

### Container format

```
offset  size  field
0       8     magic   "ARTCADE1"
8       1     version (=1)
9       1     flags   (bit0 = encrypted)
10      24    nonce   (XChaCha20)
34      16    mac     (Poly1305 tag)
50      N     ciphertext (= plaintext ZIP length)
```

A plaintext ZIP begins with `PK\x03\x04` and has no container header, so
unencrypted dev archives still load (backward compatible).

PyNaCl emits the 16-byte tag appended to the ciphertext (combined mode);
Monocypher takes it separately, so the packer splits the last 16 bytes into the
`mac` field. The two implementations are wire-compatible (verified by test).

## Key management

The 32-byte key is resolved by
[`runtime-cpp/tools/artcade_keytool.py`](../runtime-cpp/tools/artcade_keytool.py),
shared by the packer and the C++ build, in this order:

1. `ARTCADE_ASSET_KEY` env var — 64 hex chars (production / CI secret).
2. `runtime-cpp/secrets/artcade_key.hex` — 64 hex chars (local secret; gitignored).
3. Built-in **dev key** (bytes `0x00..0x1f`) — INSECURE, emits a warning.

At CMake configure time, `tools/emit-asset-key-header.py` writes the key into a
generated `artcade-asset-key.h` consumed by the C++ decrypt unit, so pack and
unpack always agree.

### Generating a production key

```sh
python runtime-cpp/tools/gen-asset-key.py        # writes secrets/artcade_key.hex
# or, for CI:
export ARTCADE_ASSET_KEY=$(python runtime-cpp/tools/gen-asset-key.py --print)
```

**Back up the key out-of-band.** If you lose it, every game shipped with it
becomes un-loadable. Rotating the key requires re-packing and re-shipping all
games built with the old key (a fresh build picks up the new key automatically).

## Build / toolchain requirements

- **Monocypher** is fetched (pinned by SHA-256) by
  `scripts/bootstrap-runtime-libs.ps1`. Without it the runtime compiles
  `artcade-crypto` as a passthrough and only plaintext archives load.
- **PyNaCl** (`pip install pynacl`) is required to pack encrypted archives.
  Use `pack-artcade.py --no-encrypt` for an unencrypted dev build.

## Tests

- `runtime-cpp/tools/test_pack_artcade.py` — packer round-trip, tamper rejection,
  `--no-encrypt` plaintext mode.
- `runtime-cpp/tests/artcade-crypto-test.cpp` (ctest `artcade_crypto_test`) —
  decrypt round-trip, tampered ciphertext/MAC rejection, plaintext passthrough,
  truncated-container rejection.
