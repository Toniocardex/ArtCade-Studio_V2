# Dialog CSV format (ArtCade)

> Authoring channel for writers. Output: `dialogs/{dialogId}.json` (same schema as the Dialog Editor).

## Rules

- UTF-8 encoding, comma-separated, RFC 4180 quoting when text contains commas or newlines.
- One row per logical record; `dialog_id` groups rows into one graph file.
- `id` must be unique within a `dialog_id`.

## Columns

| Column | Required | Description |
|--------|----------|-------------|
| `record_type` | yes | `say`, `choice`, `condition`, `set_var`, `emit`, `end` |
| `id` | yes | Node id |
| `dialog_id` | yes | Output filename stem (`innkeeper` → `dialogs/innkeeper.json`) |
| `character` | say | Speaker label |
| `text` | say | Inline line (use `text_key` instead when localizing) |
| `text_key` | say | i18n key (optional, phase 5) |
| `portrait` | say | Asset path (optional) |
| `next` | most | Next node id |
| `option_index` | choice | 1-based option index (repeat row per option) |
| `option_text` | choice | Choice label |
| `variable` | condition / set_var | `VariableManager` key (flat string) |
| `operator` | condition | `>=`, `<=`, `==`, `!=` |
| `value` | condition / set_var | Numeric compare or assign value |
| `if_true` | condition | Node id when true |
| `if_false` | condition | Node id when false |
| `operation` | set_var | `=`, `+=`, `-=` |
| `event` | emit | Message name for Logic Board `onMessage` |

## Choice rows

Multiple rows share the same `id` and `dialog_id`; each row adds one option:

```csv
choice,n3,innkeeper,,,,,,,1,"A room",n4,,,,,,
choice,n3,innkeeper,,,,,,,2,"No thanks",n5,,,,,,
```

## Import

```powershell
cd editor
node scripts/import-dialog-csv.mjs ..\docs\examples\dialogs\innkeeper.csv --out ..\dialogs
```

See [`DIALOG_SYSTEM.md`](DIALOG_SYSTEM.md) and golden example [`examples/dialogs/innkeeper.csv`](examples/dialogs/innkeeper.csv).
