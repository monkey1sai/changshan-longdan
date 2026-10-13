import json, os, subprocess
from pathlib import Path

ROOT = Path(r'C:\Repos\changshan-longdan').resolve()
OUT = ROOT / 'release/handoff-20261011'
def git(repo, *args):
    p = subprocess.run(['git', '-C', str(repo), *args], capture_output=True, text=True, encoding='utf-8')
    if p.returncode: raise RuntimeError(f'git {args[0]} failed at {repo}: {p.stderr[:200]}')
    return p.stdout.strip()
def size(directory):
    count = total = links = 0
    stack = [directory]
    while stack:
        current = stack.pop()
        for item in os.scandir(current):
            stat = item.stat(follow_symlinks=False)
            if getattr(stat, 'st_file_attributes', 0) & 1024:
                links += 1
            elif item.is_dir(follow_symlinks=False): stack.append(Path(item.path))
            elif item.is_file(follow_symlinks=False):
                count += 1
                total += stat.st_size
    return dict(files=count, bytes=total, reparsePoints=links)

registered = [Path(line[9:]).resolve() for line in git(ROOT, 'worktree', 'list', '--porcelain').splitlines() if line.startswith('worktree ')]
repos = set(registered)
for item in (ROOT / '.worktrees').iterdir():
    if item.is_dir() and (item / '.git').exists(): repos.add(item.resolve())
for item in (ROOT / '.worktrees/_clones').iterdir():
    if item.is_dir() and (item / '.git').exists(): repos.add(item.resolve())
result = []
for repo in sorted(repos, key=str):
    if not repo.is_relative_to(ROOT):
        result.append(dict(path=str(repo), disposition='OUTSIDE_WORKSPACE_PRESERVE'))
        continue
    entry = dict(path=str(repo), registered=repo in registered,
                 head=git(repo, 'rev-parse', 'HEAD'), branch=git(repo, 'branch', '--show-current'),
                 status=git(repo, 'status', '--porcelain=v1'), caches=[], retained=[])
    for relative in ['node_modules', 'dist', 'coverage', 'unity/ChangshanLongdan/Library', 'unity/ChangshanLongdan/Temp', 'unity/ChangshanLongdan/Obj']:
        directory = repo / relative
        if directory.is_dir(): entry['caches'].append(dict(relative=relative, **size(directory)))
    for relative in ['release', 'logs', 'unity/ChangshanLongdan/Logs', 'unity/ChangshanLongdan/UserSettings']:
        directory = repo / relative
        if directory.is_dir(): entry['retained'].append(dict(relative=relative, **size(directory)))
    entry['lockFiles'] = [str(p.relative_to(repo)) for p in [repo/'unity/ChangshanLongdan/Temp/UnityLockfile', repo/'unity/ChangshanLongdan/.e02-runner.lock'] if p.exists()]
    result.append(entry)
data = dict(schemaVersion=1, root=str(ROOT), repos=result, policy='preserve Git history, release evidence and uncommitted files; no deletes')
with (OUT/'inventory.json').open('x', encoding='utf-8') as stream: json.dump(data, stream, ensure_ascii=False, indent=2)
print(json.dumps(dict(repos=len(result), caches=sum(len(x.get('caches', [])) for x in result), cacheBytes=sum(c['bytes'] for x in result for c in x.get('caches', [])), dirty=[dict(path=x['path'], status=x['status']) for x in result if x.get('status')], locked=[x['path'] for x in result if x.get('lockFiles')]), ensure_ascii=False))
