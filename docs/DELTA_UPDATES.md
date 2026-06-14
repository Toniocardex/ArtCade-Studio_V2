# Delta Updates (.artcade)

Patch a shipped game without re-downloading the whole archive. The client
fetches only the files whose content changed since its installed version.

## Why per-file, not whole-archive binary diff

The shipped `.artcade` is encrypted and DEFLATE-compressed, so a single changed
byte rewrites essentially the entire ciphertext — a binary diff (bsdiff/zstd)
of the archive saves almost nothing. Instead we diff at the **plaintext file**
level using SHA-256 content addressing: identical files share one object across
versions, so only genuinely-changed files transfer.

## Layout (content-addressed store)

```
store/
  channel-<name>.json        { channel, latest, manifest }
  manifests/<version>.json   { version, channel, created, files: { rel: {sha256,size} } }
  objects/<sha256>           XChaCha20-Poly1305 container of the file's bytes
```

- An **object** is addressed by the SHA-256 of its *plaintext*; the stored blob
  is the *encrypted* container (same scheme as [ASSET_ENCRYPTION.md](ASSET_ENCRYPTION.md)).
  Stable identity, never plaintext at rest.
- A **release manifest** lists every file with its hash + size. This is a
  separate artifact from the in-archive `manifest.json`; the shipped archive
  format is unchanged.

## Tools

- **Publish:** [`runtime-cpp/tools/publish-release.py`](../runtime-cpp/tools/publish-release.py)
  ```sh
  python runtime-cpp/tools/publish-release.py <project_dir> <store_dir> --version 2.0.0
  ```
  Writes any new objects (dedup against existing), the version manifest, and
  updates `channel-stable.json`.

- **Update client:** [`runtime-cpp/tools/update-client.py`](../runtime-cpp/tools/update-client.py)
  ```sh
  python runtime-cpp/tools/update-client.py <store_dir> <install_dir>
  ```
  Reads the channel pointer, diffs the new manifest against the locally-recorded
  `.artcade-manifest.json`, downloads only changed objects, decrypts + verifies
  each against its hash, then applies **atomically** — a forged/corrupt object
  aborts before any file is written (no partial apply). Files removed from the
  manifest are deleted; the new manifest is recorded locally.

## Protocol (client)

1. `GET channel-<name>.json` → `latest`, `manifest` path.
2. `GET manifests/<latest>.json`.
3. For each `rel`: skip if local hash matches and the file exists on disk;
   otherwise queue its object.
4. `GET objects/<sha256>` for queued files → decrypt → verify SHA-256.
5. Apply all (atomic), delete dropped files, record the new local manifest.

## Status / remaining integration

`update-client.py` is the **reference implementation** of the client protocol,
operating on local directories — the `store_dir` can be a mounted folder, a
synced directory, or a CDN mirror. The remaining product work is:

- A **hosting target** beyond a local dir (S3/R2/itch). The store layout is
  static-file-friendly; uploading the three directories is sufficient.
- A **native launcher / updater-on-launch** that embeds this protocol so end
  users get updates automatically. ArtCade currently ships a bare
  `game.exe` + `game.artcade` with no launcher; adding one is the natural home
  for this logic.
- Optional: bsdiff/zstd **patches between object versions** for very large
  binary assets, layered on top of per-file dedup (the dominant win is already
  captured by content addressing).

## Tests

`runtime-cpp/tools/test_delta_update.py` — only-changed-objects transfer with
dedup, file removal on update, and tamper-aborts-without-partial-apply.
