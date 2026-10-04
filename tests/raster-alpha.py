"""Content regression for the real raster-to-SVG worker in the converter image.

Mount backend/engine.mjs at /engine.mjs, backend/output-validation.py at
/output-validation.py and site/src/convert.js at /client-convert.js;
run this script inside an isolated networkless container
with writable /job and /tmp. The test-only /tmp mount must permit execution for
the VTracer failure-injection shim; production tmpfs settings are unchanged.
Requires existing image tools PIL, VTracer and resvg.
No downloads, external files or live API requests are used.
"""
import hashlib
import json
import os
from pathlib import Path
import shutil
import signal
import subprocess
import time
import re
import xml.etree.ElementTree as ET

from PIL import Image

ROOT = Path('/job')
ARTIFACTS = Path(os.environ.get('ALPHA_TEST_REPORT_DIR', '/tmp/alpha-regression'))
ARTIFACTS.mkdir(parents=True, exist_ok=True)
real_tracer = shutil.which('vtracer')
assert real_tracer, 'VTracer must be installed in the converter image'
wrappers = Path('/tmp/alpha-test-bin')
wrappers.mkdir(exist_ok=True)
wrapper = wrappers / 'vtracer'
wrapper.write_text('#!/bin/sh\n'
    'case "$*" in *wase-alpha.png*)\n'
    ' printf "alpha\\n" >> /tmp/alpha-test-calls\n'
    ' if [ "$ALPHA_TEST_FAIL_MASK" = 1 ]; then exit 79; fi;;\n'
    ' *) printf "colour\\n" >> /tmp/alpha-test-calls;; esac\n'
    f'exec "{real_tracer}" "$@"\n')
wrapper.chmod(0o755)


def run(args, env=None, timeout=130):
    process = subprocess.Popen(args, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                               start_new_session=True, env=env)
    try:
        out, err = process.communicate(timeout=timeout)
        return process.returncode, (out + err).decode('utf8', 'replace')
    finally:
        try:
            os.killpg(process.pid, signal.SIGKILL)
        except ProcessLookupError:
            pass


results = []
for name, mode, fail_mask in [
    ('alpha-128', 'RGBA', False), ('alpha-64', 'RGBA', False),
    ('alpha-margin', 'RGBA', False),
    ('gradient', 'RGBA', False), ('opaque-rgb', 'RGB', False),
    ('opaque-rgba', 'RGBA', False), ('transparent', 'RGBA', False),
    ('failed-mask', 'RGBA', True),
]:
    for path in ROOT.iterdir():
        shutil.rmtree(path) if path.is_dir() else path.unlink()
    Path('/tmp/alpha-test-calls').unlink(missing_ok=True)
    image = Image.new(mode, (128, 96), (120, 80, 220) if mode == 'RGB' else (120, 80, 220, 255))
    if mode == 'RGBA':
        for y in range(96):
            for x in range(128):
                alpha = (128 if name in ('alpha-128', 'failed-mask') else
                         64 if name == 'alpha-64' else
                         (128 if 16 <= x < 112 and 16 <= y < 80 else 0) if name == 'alpha-margin' else
                         round(x * 255 / 127) if name == 'gradient' else
                         0 if name == 'transparent' else 255)
                image.putpixel((x, y), (120, 80, 220, alpha))
    source = ROOT / 'input.png'
    image.save(source)
    environment = {**os.environ, 'PATH': f'{wrappers}:{os.environ["PATH"]}',
                   'ALPHA_TEST_FAIL_MASK': '1' if fail_mask else '0'}
    started = time.monotonic()
    code, error = run(['bun', '/engine.mjs', 'png', 'svg', 'vtracer'], environment)
    row = {'case': name, 'exit': code, 'seconds': round(time.monotonic() - started, 3),
           'sourceSHA256': hashlib.sha256(source.read_bytes()).hexdigest()}
    calls_path = Path('/tmp/alpha-test-calls')
    calls = calls_path.read_text().splitlines() if calls_path.exists() else []
    row['tracerCalls'] = calls
    if fail_mask:
        assert code != 0, 'A failed alpha trace must not become opaque successful output'
        assert 'colour' not in calls, 'Do not publish colour trace after alpha failure'
        row['passed'] = True
    else:
        assert code == 0, f'{name}: {error[-1200:]}'
        svg = ROOT / 'output.svg'
        text = svg.read_text()
        assert '<image' not in text.lower() and 'data:image' not in text.lower(), 'SVG must contain vectors, not a bitmap'
        # Verify markup against the actual client sanitizer's allowlists.
        # Benign metadata such as SVG version may be stripped; opacity must
        # survive that stripping, not depend on rejected style attributes.
        client = Path('/client-convert.js').read_text()
        allowed_tags = set(re.findall(r"'([^']+)'", re.search(r'const tags=new Set\(\[(.*?)\]\)', client).group(1)))
        allowed_attrs = set(re.findall(r"'([^']+)'", re.search(r'const attrs=new Set\(\[(.*?)\]\)', client).group(1)))
        cleaned = ET.fromstring(text)
        for element in cleaned.iter():
            assert element.tag.split('}')[-1] in allowed_tags
            for attr in list(element.attrib):
                if attr not in allowed_attrs:
                    assert not re.search(r'^on|href|^style$', attr, re.I), attr
                    del element.attrib[attr]
            for value in element.attrib.values():
                assert 'url' not in value.lower() or re.fullmatch(r'url\(#[\w-]+\)', value)
        sanitized_svg = ROOT / 'sanitized.svg'
        sanitized_svg.write_text(ET.tostring(cleaned, encoding='unicode'))
        row['clientAllowlistCompatible'] = True
        if name.startswith('opaque') or name == 'transparent':
            assert 'alpha' not in calls and '<mask' not in text, 'Opaque/transparent fast path should not trace an alpha mask'
        else:
            assert calls.count('alpha') == 1 and '<mask' in text
        render = ROOT / 'render.png'
        rc, render_error = run(['resvg', str(svg), str(render)], timeout=20)
        assert rc == 0, render_error[-1200:]
        rendered = Image.open(render).convert('RGBA')
        rc, render_error = run(['resvg', str(sanitized_svg), str(ROOT / 'sanitized.png')], timeout=20)
        assert rc == 0, render_error[-1200:]
        sanitized_image = Image.open(ROOT / 'sanitized.png').convert('RGBA')
        assert rendered.tobytes() == sanitized_image.tobytes(), 'Client allowlist stripping changed output pixels'
        assert rendered.size == image.size
        points = [(x, 48) for x in [8, 24, 48, 64, 96, 120]]
        actual = [rendered.getpixel(point)[3] for point in points]
        expected = [image.convert('RGBA').getpixel(point)[3] for point in points]
        row.update(expectedAlpha=expected, actualAlpha=actual,
                   maximumSampleError=max(abs(a-b) for a, b in zip(actual, expected)))
        assert row['maximumSampleError'] <= 3, row
        if name != 'transparent':
            assert max(abs(rendered.getpixel((64, 48))[i] - image.getpixel((64, 48))[i]) for i in range(3)) <= 3
        shutil.copyfile(svg, ARTIFACTS / (name + '.svg'))
        shutil.copyfile(render, ARTIFACTS / (name + '.png'))
        row['passed'] = True
    results.append(row)
    (ARTIFACTS / 'results.json').write_text(json.dumps(results, indent=2) + '\n')
    print(json.dumps(row), flush=True)
print(f'{len(results)} raster alpha regression cases passed', flush=True)
