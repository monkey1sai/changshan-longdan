import json, re, subprocess
from pathlib import Path
ROOT=Path(r'C:\Repos\changshan-longdan')
def run(*args):
    return subprocess.check_output(['git','-C',str(ROOT),*args])
objects=run('rev-list','--objects','--branches','--not','--remotes=origin').decode('utf-8').splitlines()
checks=[]; findings=[]
patterns=[re.compile(x) for x in [rb'-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----', rb'gh[pousr]_[A-Za-z0-9]{30,}', rb'github_pat_[A-Za-z0-9_]{40,}', rb'AKIA[0-9A-Z]{16}', rb'sk-(?:proj-)?[A-Za-z0-9_-]{40,}']]
for obj in objects:
    oid,_,name=obj.partition(' ')
    kind=run('cat-file','-t',oid).decode().strip()
    if kind!='blob': continue
    raw=run('cat-file','blob',oid)
    reasons=[]
    if len(raw)>=100*1024*1024: reasons.append('GITHUB_FILE_SIZE_LIMIT')
    if re.search(r'(^|/)(\.env(?:\..+)?|id_rsa|id_ed25519|credentials(?:\.json)?)$',name,re.I): reasons.append('CREDENTIAL_FILE_NAME')
    if any(p.search(raw) for p in patterns): reasons.append('POSSIBLE_SECRET_PATTERN')
    if reasons: findings.append(dict(path=name,object=oid,reasons=reasons))
    checks.append(dict(path=name,object=oid,bytes=len(raw)))
result=dict(schemaVersion=1,scope='unpublished branch-reachable blobs only',checks=len(checks),findings=findings,limitations=['pattern scan is not exhaustive secret detection','existing public objects not rescanned','not gameplay acceptance'])
with (ROOT/'release/handoff-20261011/publication-check.json').open('x',encoding='utf-8') as f:json.dump(result,f,ensure_ascii=False,indent=2)
print(json.dumps(result,ensure_ascii=False))
if findings: raise SystemExit(2)
