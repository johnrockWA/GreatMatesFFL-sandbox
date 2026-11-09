"""Build a self-contained shared screen. No credentials or private fixture included."""
import argparse,base64,json
from pathlib import Path
ROOT=Path(__file__).resolve().parent
OUTPUT=ROOT.parent/'shared-draft.html'
def image(path):
    return 'data:image/webp;base64,'+base64.b64encode(path.read_bytes()).decode()
def build():
    values={
      '__LOGO__':'data:image/jpeg;base64,'+base64.b64encode((ROOT/'assets/ffl-logo.jpg').read_bytes()).decode(),
      '__ENGINE__':(ROOT/'draft-engine.js').read_text(),
      '__CLIENT__':(ROOT/'shared-client.js').read_text(),
      '__KATY_AVATAR_LOGIC__':(ROOT/'katy-avatar.js').read_text(),
      '__KATY_AVATARS__':json.dumps({
        'administrator':image(ROOT/'assets/katy/administrator.webp'),
        'deadline':image(ROOT/'assets/katy/deadline.webp'),
        'submitted':image(ROOT/'assets/katy/submitted.webp'),
        'draft-turn':image(ROOT/'assets/katy/draft-turn.webp'),
      }),
      # Exact reviewed deployment and instance are supplied at installation.
      # Empty defaults fail closed; URL query strings cannot redirect credentials.
      '__CONFIG__':json.dumps({'endpoint':'','instanceId':''}),
      '__SHARED_UI__':(ROOT/'shared-ui.js').read_text(),
    }
    html=(ROOT/'shared-shell.html').read_text()
    for token,value in values.items():
        if html.count(token)!=1:raise ValueError(token)
        html=html.replace(token,value)
    return html
if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--check',action='store_true');args=parser.parse_args()
    data=build().encode()
    if args.check:
        if not OUTPUT.is_file() or OUTPUT.read_bytes()!=data:raise SystemExit('Shared screen is out of date. Run npm run build.')
        print('Generated shared screen matches committed bytes.')
    else:OUTPUT.write_bytes(data);print('Built shared screen:',OUTPUT)
