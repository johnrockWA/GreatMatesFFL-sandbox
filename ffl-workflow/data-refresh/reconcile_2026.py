"""Reconcile collected 2026 evidence into a demo fixture, retaining stable IDs/squads.
All input/output paths are explicit. No network, Google writes or competition actions.
"""
import argparse,copy,hashlib,json,re,unicodedata
from pathlib import Path
ASOF='2026-10-30'
ALIASES={'Mitchell Georgiades':'Mitch Georgiades','Cameron Rayner':'Cam Rayner','Jackson Macrae':'Jack Macrae','Oliver Wines':'Ollie Wines','Thomas Lynch':'Tom Lynch','Matthew Rowell':'Matt Rowell','Lachlan Ash':'Lachie Ash','Nicholas Madden':'Nick Madden','Bailey J. Williams':'Bailey Williams'}
CLUBS={'Gold Coast Suns':'Gold Coast','West Coast Eagles':'West Coast','Sydney Swans':'Sydney','Adelaide Crows':'Adelaide','GWS':'GWS Giants','Greater Western Sydney':'GWS Giants'}
def norm(x):return re.sub(r'[^a-z0-9]','',unicodedata.normalize('NFKD',x).encode('ascii','ignore').decode().lower())
def role_scores(g):
 d=g['disposals'];go=g['goals'];return {'forward':6*go+2*g['behinds'],'ruck':g['hitouts']+3*go,'marker':3*g['marks']+g['kicks']+3*go,'midfielder':d+max(0,d-29)+3*go,'tackler':3*g['tackles']+g['handballs']+3*go,'allRounder':d+g['tackles']+g['marks']+3*go}
def summary(games):
 n=len(games);fields=['kicks','handballs','disposals','marks','hitouts','tackles','goals','behinds','freeFor','freeAgainst'];tot={k:sum(g[k] for g in games) for k in fields}
 return {'games':n,'totals':tot,'averages':{k:round(v/n,4) if n else None for k,v in tot.items()},'fflAverages':{k:round(sum(role_scores(g)[k] for g in games)/n,4) if n else None for k in role_scores(dict.fromkeys(fields,0))}}
def apply_evidence(old,evidence,movements):
 out=copy.deepcopy(old);byname={};seen=set();updates=[];unresolved=[];changed=[]
 for r in evidence['players']:byname.setdefault(norm(r['name']),[]).append(r)
 moves={norm(t['name']):t for t in movements['trades']};exits={norm(t['name']):t for t in movements['listChanges'] if t['status'] in ['retired','delisted']}
 # Explicit aliases are recorded above. Duplicate names require a club match; never fuzzy-match.
 def match(p):
  options=byname.get(norm(ALIASES.get(p['name'],p['name'])),[])
  if len(options)>1:options=[r for r in options if CLUBS.get(r['club2026'],r['club2026'])==CLUBS.get(p['club'],p['club'])]
  return options[0] if len(options)==1 else None
 def enrich(p,r):
  p=copy.deepcopy(p);p['club']=CLUBS.get(r['club2026'],r['club2026']);p['careerGames']=r['careerGames'];p['stats2026']={'season':2026,'includingFinals':summary(r['games2026']),'regularSeason':summary([g for g in r['games2026'] if not g['final']]),'finals':summary([g for g in r['games2026'] if g['final']]),'source':r['profileUrl'],'asOf':ASOF};p['statsSource']=r['profileUrl'];p['listStatus']='active-at-trade-cutoff';key=norm(r['name']);move=moves.get(key);exit=exits.get(key)
  if move:p['club']=CLUBS.get(move['club'],move['club']);p['clubSource']=move['source']
  else:p['clubSource']=evidence['seasonSource']
  if exit and not move:p['listStatus']='relist-pending' if exit['rerookieIntent'] else exit['status'];p['listStatusSource']='https://www.afl.com.au/news/features/retirements-and-delistings'
  for team,h in p.get('history',{}).items():
   years=h.get('recordedNormalYears',[]);qualified=[y for y in years if sum(c['games'] for c in r['careerYears'] if c['year']<y)>50]
   h.update(verified=True,retains=len(qualified),qualifyingYears=qualified,evidenceSource=r['profileUrl'])
  p['historyReview']=False
  return p
 original=copy.deepcopy(out['players']);result=[]
 for p in original:
  r=match(p)
  if r:
   seen.add(r['profileUrl']);new=enrich(p,r);result.append(new)
   if new!=p:updates.append({'player':p['id'],'before':{k:p.get(k) for k in new},'after':new});changed.append({'id':p['id'],'name':p['name'],'clubBefore':p['club'],'clubAfter':new['club'],'gamesBefore':p['careerGames'],'gamesAfter':new['careerGames'],'listStatus':new['listStatus']})
  else:result.append(p);unresolved.append({'id':p['id'],'name':p['name'],'reason':'No unambiguous collected profile; retain prior value, not certified refreshed.'})
 for r in evidence['players']:
  if r['profileUrl'] in seen:continue
  result.append(enrich({'id':'aflt-'+hashlib.sha256(r['profileUrl'].encode()).hexdigest()[:12],'name':r['name'],'history':{}},r))
 out['players']=result;out['playerEvidenceUpdates']=updates;out['dataRevision']='post-trade-2026-10-30-v1';out['dataSnapshot']={'asOf':ASOF,'season':2026,'seasonSource':evidence['seasonSource'],'movementSource':movements['source'],'collectedProfiles':len(evidence['players']),'unresolvedPlayers':unresolved,'scope':'All collected 2026 AFL participants plus existing FFL squads. Not all zero-game AFL-listed players or November draftees.','statsBasis':'Show regular season and including-finals separately; career games include all completed senior AFL seasons through 2026.','rosterStatusBasis':'2026 participants, official completed trades, and current official retirements/delistings; no assumption about later re-listing.'}
 return out,{'asOf':ASOF,'players':len(result),'squadPlayers':len(original),'refreshedSquadPlayers':len(original)-len(unresolved),'unresolved':unresolved,'changes':changed,'sourceErrors':evidence['errors']}
def main():
 a=argparse.ArgumentParser();a.add_argument('--fixture',type=Path,required=True);a.add_argument('--evidence',type=Path,required=True);a.add_argument('--movements',type=Path,required=True);a.add_argument('--output',type=Path,required=True);a.add_argument('--report',type=Path,required=True);p=a.parse_args();e=json.loads(p.evidence.read_text());
 if e['processed']!=e['expected']:raise SystemExit('Collection is incomplete; refusing to publish a partial snapshot.')
 out,report=apply_evidence(json.loads(p.fixture.read_text()),e,json.loads(p.movements.read_text()));p.output.write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n');p.report.write_text(json.dumps(report,indent=2)+'\n');print(json.dumps({k:v for k,v in report.items() if k!='changes'}))
if __name__=='__main__':main()
