import json,os,re,sys
R='/home/user/tools4'
SKIP={'node_modules','skills','fonts','vendor','out','snapshots','.gm-parts','renders','.git','public','.hyperframes','.remotion'}
EXT=('.html','.css','.js','.mjs','.cjs','.ts','.tsx','.jsx')
def loc(d):
    n=0;files=[]
    for root,dirs,fs in os.walk(d):
        dirs[:]=[x for x in dirs if x not in SKIP]
        for f in fs:
            if f.endswith(EXT) and not f.endswith('.d.ts') and f not in ('eslint.config.mjs',):
                p=os.path.join(root,f); k=sum(1 for l in open(p,errors='ignore') if l.strip())
                n+=k; files.append((os.path.relpath(p,d),k))
    return n,files
out={}
for t in ['givemotion','remotion','hyperframes']:
    H=f'{R}/harness'
    ev=[json.loads(l) for l in open(f'{H}/{t}.jsonl') if l.strip().startswith('{')]
    res=[e for e in ev if e.get('type')=='result'][-1]
    calls=[];imgs=0;cmds=[]
    for e in ev:
        if e.get('type')=='assistant':
            for c in e['message'].get('content',[]):
                if c.get('type')=='tool_use':
                    calls.append(c['name']); i=c['input']
                    if c['name']=='Read' and re.search(r'\.(png|jpe?g|webp|gif)$',i.get('file_path','')): imgs+=1
                    if c['name']=='Bash': cmds.append(i.get('command',''))
    mu=res.get('modelUsage',{})
    tok=dict(input=sum(m['inputTokens'] for m in mu.values()),cache_write=sum(m['cacheCreationInputTokens'] for m in mu.values()),
             cache_read=sum(m['cacheReadInputTokens'] for m in mu.values()),output=sum(m['outputTokens'] for m in mu.values()),
             thinking=sum(m.get('thinkingTokens',0) for m in mu.values()))
    tok['total']=tok['input']+tok['cache_write']+tok['cache_read']+tok['output']
    st=int(open(f'{H}/{t}.start').read()); en=int(open(f'{H}/{t}.end').read())
    n,files=loc(f'{R}/{t}')
    out[t]=dict(tokens=tok,cost_usd=round(sum(m['costUSD'] for m in mu.values()),2),models=list(mu.keys()),
        minutes=round((en-st)/60,1),api_minutes=round(res.get('duration_api_ms',0)/60000,1),turns=res.get('num_turns'),
        tool_calls=len(calls),tool_mix={k:calls.count(k) for k in set(calls)},denied=len(res.get('permission_denials',[])),
        denials=[d.get('tool_input',{}).get('command','')[:160] for d in res.get('permission_denials',[])],
        images_viewed=imgs,loc=n,files=files,result=res.get('subtype'),is_error=res.get('is_error'),
        renders=sum(1 for c in cmds if ' render' in c),report=res.get('result','')[-3000:])
json.dump(out,open(f'{R}/stats.json','w'),indent=1)
for t,v in out.items(): print(t,{k:v[k] for k in ['tokens','cost_usd','minutes','tool_calls','denied','images_viewed','loc','result']})
