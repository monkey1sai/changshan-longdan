import io, json, tarfile, tempfile
from pathlib import Path
OUT=Path(r'C:\Repos\changshan-longdan\release\handoff-20261011')
source=(OUT/'verify-archive.py').read_text(encoding='utf-8')
results=[]
for case in ['hardlink-match','hardlink-escape','content-mismatch','symlink-rejected']:
    root=Path(tempfile.mkdtemp(prefix='verifier-fixture-',dir=OUT))
    work=root/'.worktrees'; work.mkdir(); (root/'.claude').mkdir()
    (work/'a').write_bytes(b'fixture-data'); (work/'b').write_bytes(b'fixture-data')
    evidence=root/'release/handoff-20261011'; evidence.mkdir(parents=True)
    (evidence/'inventory.json').write_text('{"repos":[]}',encoding='utf-8')
    with tarfile.open(evidence/'worktrees-with-evidence.tar.gz','w:gz') as archive:
        a=tarfile.TarInfo('.worktrees/a'); payload=b'wrong' if case=='content-mismatch' else b'fixture-data'
        a.size=len(payload); archive.addfile(a,io.BytesIO(payload))
        b=tarfile.TarInfo('.worktrees/b'); b.type=tarfile.SYMTYPE if case=='symlink-rejected' else tarfile.LNKTYPE
        b.linkname='../outside' if case=='hardlink-escape' else '.worktrees/a'; archive.addfile(b)
    program=source.replace("ROOT=Path(r'C:\\Repos\\changshan-longdan').resolve()",f'ROOT=Path({str(root)!r}).resolve()')
    if program==source: raise RuntimeError('FIXTURE_ROOT_NOT_REPLACED')
    failure=None
    try: exec(compile(program,'verify-archive-fixture','exec'),{'__name__':'__main__'})
    except RuntimeError as error: failure=str(error)
    expected={'hardlink-match':None,'hardlink-escape':'UNVERIFIED_HARDLINK_TARGET','content-mismatch':'ARCHIVE_SOURCE_MISMATCH','symlink-rejected':'SYMLINK_REQUIRES_SEPARATE_RESTORE_REVIEW'}[case]
    if (expected is None and failure is not None) or (expected is not None and (failure is None or not failure.startswith(expected))):
        raise RuntimeError(f'FIXTURE_FAILED: {case}: {failure}')
    results.append(dict(case=case,status='PASS',reason=failure))
with (OUT/'verifier-tests.json').open('x',encoding='utf-8') as stream: json.dump(results,stream,indent=2)
print('ARCHIVE_VERIFIER_FIXTURES_PASS_4_OF_4')
