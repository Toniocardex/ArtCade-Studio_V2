import hashlib
import importlib.util
import json
import sys
import tempfile
import unittest
import zipfile
from pathlib import Path

sys.dont_write_bytecode = True

SCRIPT_PATH = Path(__file__).with_name("pack-artcade.py")
SPEC = importlib.util.spec_from_file_location("pack_artcade", SCRIPT_PATH)
assert SPEC is not None and SPEC.loader is not None
PACK_ARTCADE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(PACK_ARTCADE)


class PackArtcadeOverrideTest(unittest.TestCase):
    def test_override_replaces_archive_entry_without_changing_source(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            scripts = root / "scripts"
            scripts.mkdir()
            source = "function tick() return 'manual' end"
            combined = "-- combined\nfunction tick() return 'combined' end"
            main_path = scripts / "main.lua"
            main_path.write_bytes(source.encode("utf-8"))
            (root / "project.json").write_text(
                json.dumps({
                    "projectName": "Pack Test",
                    "version": "1.0.0",
                    "mainScriptPath": "scripts/main.lua",
                }),
                encoding="utf-8",
            )
            override = root / "combined.lua"
            override.write_bytes(combined.encode("utf-8"))
            output = root / "game.artcade"

            self.assertTrue(PACK_ARTCADE.pack(str(root), str(output), str(override)))
            self.assertEqual(main_path.read_text(encoding="utf-8"), source)
            with zipfile.ZipFile(output) as archive:
                self.assertEqual(
                    archive.read("scripts/main.lua").decode("utf-8"),
                    combined,
                )
                manifest = json.loads(archive.read("manifest.json"))
            expected = hashlib.sha256(combined.encode("utf-8")).hexdigest()
            self.assertEqual(manifest["files"]["scripts/main.lua"], expected)


if __name__ == "__main__":
    unittest.main()
