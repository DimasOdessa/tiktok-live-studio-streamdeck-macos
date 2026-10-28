"""Package the ready-to-run plugin without requiring external build tools."""
from pathlib import Path
import json
import zipfile

root = Path(__file__).resolve().parent
plugin = root / 'com.tiktok.livestudio.sdPlugin'
manifest = json.loads((plugin / 'manifest.json').read_text())
assert manifest['UUID'] == 'com.tiktok.livestudio'
assert manifest['OS'][0]['Platform'] == 'mac'
target = root / f"TikTok-LIVE-Studio-{manifest['Version']}-macOS.streamDeckPlugin"
with zipfile.ZipFile(target, 'w', zipfile.ZIP_DEFLATED) as archive:
    for file in sorted(plugin.rglob('*')):
        if file.is_file():
            archive.write(file, file.relative_to(root))
print(target)
