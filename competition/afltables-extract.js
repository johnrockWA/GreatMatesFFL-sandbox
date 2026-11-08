/** Development-only public-source round probe. No persistent writes. */
function fflAflTablesExtract_(html) {
  const clean=s=>String(s).replace(/<script\b[\s\S]*?<\/script>/gi,'').replace(/<[^>]*>/g,' ').replace(/&nbsp;|&#160;/gi,' ').replace(/&amp;/gi,'&').replace(/&#(\d+);/g,(_,n)=>String.fromCharCode(Number(n))).replace(/\s+/g,' ').trim();
  const title=clean((/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)||[])[1]||'');
  if(!/^AFL Tables - .+ - Match Stats$/.test(title)) throw Error('AFLTABLES_TITLE');
  const tables=Array.from(html.matchAll(/<table\b[\s\S]*?<\/table>/gi)).map(t=>Array.from(t[0].matchAll(/<tr\b[\s\S]*?<\/tr>/gi)).map(r=>Array.from(r[0].matchAll(/<t[hd]\b[^>]*>([\s\S]*?)<\/t[hd]>/gi)).map(c=>({text:clean(c[1]),links:Array.from(c[1].matchAll(/href\s*=\s*["']([^"']+)["']/gi)).map(a=>a[1])}))).filter(r=>r.length));
  const selected=tables.filter(t=>t[0]&&t[0][0].text.includes(' Match Statistics'));
  if(selected.length!==2)throw Error('AFLTABLES_TEAMS');
  const teams=selected.map(t=>{
    const team=t[0][0].text.split(' Match Statistics')[0],header=t[1].map(c=>c.text);
    const required=['#','Player','KI','HB','DI','MK','HO','TK','FF','FA','GL','BH'];
    if(required.some(h=>header.filter(x=>x===h).length!==1))throw Error('AFLTABLES_HEADERS');
    const players=t.slice(2).filter(r=>/^\d+$/.test(r[0].text)).map(r=>{
      if(r.length!==header.length)throw Error('AFLTABLES_ROW_SHAPE');
      const get=h=>r[header.indexOf(h)],name=get('Player').text;
      const profile=get('Player').links.filter(l=>/players\/[A-Z]\/[A-Za-z0-9_-]+\.html$/.test(l));
      if(profile.length!==1||!name.includes(', '))throw Error('AFLTABLES_PLAYER_ID');
      const stats=required.slice(2).map(h=>{const v=get(h).text;if(v&&!/^\d+$/.test(v))throw Error('AFLTABLES_STAT');return Number(v||0);});
      if(stats[0]+stats[1]!==stats[2])throw Error('AFLTABLES_DISPOSALS');
      return [name,profile[0],Number(get('#').text)].concat(stats);
    });
    if(players.length!==23||new Set(players.map(p=>p[1])).size!==23)throw Error('AFLTABLES_PLAYER_COVERAGE');
    return {team:team,header:required.slice(2),players:players};
  });
  return {title:title,metadata:clean(html.slice(0,html.indexOf('Match Statistics'))).slice(-2300),scoreTables:tables.slice(0,2).map(t=>t.map(r=>r.map(c=>c.text))),teams:teams};
}

if(typeof module!=="undefined")module.exports=fflAflTablesExtract_;
