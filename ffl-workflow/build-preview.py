"""Build the frozen local preview without Google access or private inputs."""
import argparse
import base64
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DEFAULT_OUTPUT = ROOT.parent / 'draft-workflow-preview.html'

def build():
    fixture = json.loads((ROOT / 'fixtures/demo-post-trade-20261030.json').read_text(encoding='utf-8'))
    # The checked-in fixture is the old public demo, not a verified league snapshot.
    fixture_json = json.dumps(fixture, ensure_ascii=False).replace('<', '\\u003c').replace('>', '\\u003e').replace('&', '\\u0026').replace('\u2028', '\\u2028').replace('\u2029', '\\u2029')
    replacements = {
        '__LOGO__': 'data:image/jpeg;base64,' + base64.b64encode((ROOT / 'assets/ffl-logo.jpg').read_bytes()).decode('ascii'),
        '__ENGINE__': (ROOT / 'draft-engine.js').read_text(encoding='utf-8'),
        '__FIXTURE__': fixture_json,
        '__KATY__': (ROOT / 'katy.js').read_text(encoding='utf-8'),
        '__ADMIN__': (ROOT / 'admin-ui.js').read_text(encoding='utf-8'),
        '__UI__': (ROOT / 'preview-ui.js').read_text(encoding='utf-8'),
    }
    html = (ROOT / 'preview-shell.html').read_text(encoding='utf-8')
    for token, value in replacements.items():
        if html.count(token) != 1:
            raise ValueError(f'Expected one template token: {token}')
        html = html.replace(token, value)
    return html

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true', help='Verify the committed HTML without writing it')
    parser.add_argument('--output', type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()
    generated = build().encode('utf-8')
    if args.check:
        if not args.output.is_file() or args.output.read_bytes() != generated:
            raise SystemExit('Preview is out of date. Run npm run build and commit the generated HTML.')
        print('Generated preview matches committed bytes.')
    else:
        args.output.write_bytes(generated)
        print('Built local preview:', args.output)

if __name__ == '__main__':
    main()
