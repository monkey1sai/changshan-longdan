import hashlib, json, os, tarfile
from pathlib import Path, PurePosixPath
ROOT=Path(r'C:\Repos\changshan-longdan').resolve()
OUT=ROOT/'release/handoff-20261011'
inventory=json.loads((OUT/'inventory.json').read_text(encoding='utf-8'))
excluded={os.path.normcase(str(Path(r['path'])/c['relative'])) for r in inventory['repos'] for c in r.get('caches',[]) if Path(r['path']).is_relative_to(ROOT/'.worktrees')}
def digest(stream):
    h=hashlib.sha256()
    while block:=stream.read(1024*1024): h.update(block)
    return h.hexdigest()
expected=set()
for subtree in ['.worktrees','.claude']:
    for base,dirs,files in os.walk(ROOT/subtree,followlinks=False):
        dirs[:]=[d for d in dirs if os.path.normcase(str(Path(base)/d)) not in excluded]
        for name in files: expected.add((Path(base)/name).relative_to(ROOT).as_posix())
verified=[]; links=[]; verified_content={}
with tarfile.open(OUT/'worktrees-with-evidence.tar.gz','r|gz') as archive:
    for item in archive:
        name=item.name.rstrip('/')
        if PurePosixPath(name).is_absolute() or '..' in PurePosixPath(name).parts or not name.startswith(('.worktrees/', '.claude/')) and name not in ('.worktrees','.claude'):
            raise RuntimeError('INVALID_ARCHIVE_MEMBER')
        target=ROOT/name
        if not target.resolve().is_relative_to(ROOT): raise RuntimeError('ARCHIVE_PATH_OUTSIDE_ROOT')
        if item.isfile() or item.islnk():
            if name not in expected: raise RuntimeError('UNEXPECTED_ARCHIVE_FILE: '+name)
            if item.islnk():
                link=PurePosixPath(item.linkname)
                if link.is_absolute() or '..' in link.parts or item.linkname not in verified_content:
                    raise RuntimeError('UNVERIFIED_HARDLINK_TARGET: '+name)
                archived=verified_content[item.linkname]
                links.append(dict(path=name,target=item.linkname,status='MATCH_VERIFIED_EARLIER_CONTENT'))
            else:
                with archive.extractfile(item) as stream: archived=digest(stream)
            with target.open('rb') as stream: original=digest(stream)
            if archived!=original: raise RuntimeError('ARCHIVE_SOURCE_MISMATCH: '+name)
            verified.append(dict(path=name,bytes=target.stat().st_size,sha256=archived)); expected.remove(name)
            verified_content[name]=archived
        elif item.issym():
            raise RuntimeError('SYMLINK_REQUIRES_SEPARATE_RESTORE_REVIEW: '+name)
        elif not item.isdir(): raise RuntimeError('UNSUPPORTED_ARCHIVE_MEMBER: '+name)
if expected: raise RuntimeError('ARCHIVE_FILES_MISSING: '+str(sorted(expected)[:10]))
with (OUT/'archive-manifest.json').open('x',encoding='utf-8') as f:
    json.dump(dict(schemaVersion=1,status='PASS_SOURCE_ARCHIVE_BYTE_MATCH',verifiedFiles=len(verified),bytes=sum(x['bytes'] for x in verified),links=links,excludedCacheDirectories=len(excluded),files=verified),f,ensure_ascii=False,indent=2)
print(json.dumps(dict(status='PASS_SOURCE_ARCHIVE_BYTE_MATCH',files=len(verified),bytes=sum(x['bytes'] for x in verified),links=len(links),excludedCaches=len(excluded))))
