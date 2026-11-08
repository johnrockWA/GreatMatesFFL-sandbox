"""Collect dated public AFL Tables evidence. Does not edit fixtures or Google data.
Requires lxml for source parsing. Cache HTML outside the public repository.
"""
import argparse, concurrent.futures, datetime, hashlib, json, re, time, unicodedata, urllib.request
from pathlib import Path
from urllib.parse import urljoin
from lxml import html
BASE='https://afltables.com/afl/stats/'
FIELDS={'KI':'kicks','MK':'marks','HB':'handballs','DI':'disposals','GL':'goals','BH':'behinds','HO':'hitouts','TK':'tackles','FF':'freeFor','FA':'freeAgainst'}
def norm(x):return re.sub(r'[^a-z0-9]','',unicodedata.normalize('NFKD',x).encode('ascii','ignore').decode().lower())
def cells(row):return [' '.join(c.text_content().split()) for c in row.xpath('./td|./th')]
def number(x):return int(x) if x else 0

def fetch(url,cache):
 p=cache/(hashlib.sha256(url.encode()).hexdigest()+'.html')
 if p.exists():return p.read_bytes()
 for attempt in range(2):
  try:
   with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'FFL-demo-data-review/1.0'}),timeout=35) as r:b=r.read()
   p.write_bytes(b);return b
  except Exception:
   if attempt:raise
   time.sleep(1)

def roster(raw):
 result=[]
 for table in html.fromstring(raw).xpath('//table')[1:]:
  rows=table.xpath('.//tr');club=table.xpath('.//a[contains(@href,"_idx.html")]')[0].text_content().strip()
  for row in rows:
   links=row.xpath('.//a[contains(@href,"players/")]')
   if not links:continue
   c=cells(row)
   if len(c)<12:continue
   name=links[0].text_content().strip();parts=name.split(', ');display=' '.join(parts[1:]+parts[:1])
   result.append({'name':display,'club2026':club,'profileUrl':urljoin(BASE,links[0].get('href')),'seasonGames':int(c[2])})
 return result

def profile(row,cache):
 doc=html.fromstring(fetch(row['profileUrl'],cache));tables=doc.xpath('//table');yearly=[]
 for tr in tables[0].xpath('.//tr')[1:]:
  c=cells(tr)
  if len(c)>4 and re.fullmatch(r'\d{4}',c[0]) and int(c[0])<=2026:
   yearly.append({'year':int(c[0]),'club':c[1],'games':int(c[3])})
 games=[]
 for t in tables:
  rows=t.xpath('.//tr')
  if not rows or not re.search(r' - 2026\s*$',rows[0].text_content()):continue
  header=cells(rows[1]);idx={k:header.index(k) for k in ['Rd',*FIELDS] if k in header}
  for tr in rows[2:]:
   c=cells(tr)
   if len(c)!=len(header) or not c[0].isdigit():continue
   v={name:number(c[idx[key]]) for key,name in FIELDS.items()};v['round']=c[idx['Rd']];v['final']=not v['round'].isdigit();games.append(v)
 if any(g['disposals']!=g['kicks']+g['handballs'] for g in games):raise ValueError('Disposals do not equal kicks plus handballs')
 season=sum(y['games'] for y in yearly if y['year']==2026)
 if season!=len(games) or season!=row['seasonGames']:raise ValueError(f"Season/log mismatch: summary={season}, logs={len(games)}, roster={row['seasonGames']}")
 return {**row,'careerGames':sum(y['games'] for y in yearly),'careerYears':yearly,'games2026':games,'verification':'parsed-and-cross-checked-season-count'}

def main():
 p=argparse.ArgumentParser();p.add_argument('--cache',type=Path,required=True);p.add_argument('--output',type=Path,required=True);a=p.parse_args();a.cache.mkdir(parents=True,exist_ok=True)
 rows=roster(fetch(BASE+'2026.html',a.cache));byurl={}
 for r in rows:
  if r['profileUrl'] in byurl:
   byurl[r['profileUrl']]['seasonGames']+=r['seasonGames']
  else:byurl[r['profileUrl']]=dict(r)
 rows=list(byurl.values());print(f'2026 source: {len(rows)} distinct players; {len(set(r["club2026"] for r in rows))} clubs',flush=True)
 results=[];errors=[]
 with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
  futures={pool.submit(profile,r,a.cache):r for r in rows}
  for i,f in enumerate(concurrent.futures.as_completed(futures),1):
   r=futures[f]
   try:results.append(f.result())
   except Exception as e:errors.append({'name':r['name'],'url':r['profileUrl'],'error':str(e)})
   if i%25==0 or i==len(rows):
    a.output.write_text(json.dumps({'season':2026,'retrievedOn':datetime.date.today().isoformat(),'seasonSource':BASE+'2026.html','players':sorted(results,key=lambda x:x['name']),'errors':errors,'processed':i,'expected':len(rows)},indent=2));print(f'{i}/{len(rows)} processed; {len(results)} verified; {len(errors)} unresolved',flush=True)
 print('Saved evidence',a.output,flush=True)
if __name__=='__main__':main()
