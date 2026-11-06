import json,re
import sys
J='/home/user/tools5/judging/'+sys.argv[1]
key={}
for l in open(f'{J}/key.txt'):
    j,L,t=l.split(); key[(j,L)]=t
E=['givemotion','remotion','hyperframes']; D=['brief','spec','motion','craft','errors','overall']
per={e:{d:[] for d in D} for e in E}; ranks={e:[] for e in E}; firsts={e:0 for e in E}; notes={e:[] for e in E}; rows=[]
for j in range(1,7):
    jj=f'judge-{j}'
    ev=[json.loads(l) for l in open(f'{J}/{jj}.jsonl') if l.startswith('{')]
    res=[e for e in ev if e.get('type')=='result'][-1]
    txt=res['result']; i=txt.find('{"scores"')
    data=json.JSONDecoder().raw_decode(txt[i:])[0]
    imgs=sum(1 for e in ev if e.get('type')=='assistant' for c in e['message'].get('content',[]) if c.get('type')=='tool_use' and c['name']=='Read')
    order=[key[(jj,L)] for L in data['ranking']]
    for i,t in enumerate(order): ranks[t].append(i+1)
    firsts[order[0]]+=1
    for L in 'ABC':
        t=key[(jj,L)]
        for d in D: per[t][d].append(data['scores'][L][d])
        notes[t].append(f"{jj} (as {L}): {data['notes'][L]}")
    rows.append(dict(judge=jj,order=order,images=imgs,cost=res.get('total_cost_usd'),overall={key[(jj,L)]:data['scores'][L]['overall'] for L in 'ABC'}))
mean={e:{d:round(sum(v)/len(v),2) for d,v in per[e].items()} for e in E}
out=dict(judges=6,mean=mean,per=per,avg_rank={e:round(sum(r)/len(r),2) for e,r in ranks.items()},firsts=firsts,rows=rows,notes=notes)
json.dump(out,open(f'{J}/scores.json','w'),indent=1)
for e in E: print(e,mean[e],'rank',out['avg_rank'][e],'firsts',firsts[e])
for r in rows: print(r)
