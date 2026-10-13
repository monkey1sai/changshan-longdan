"""Restore the approved non-cache file snapshot into a NEW empty directory.

Does not restore Git metadata, apply patches, or execute archived programs.
Run: python restore-files.py ABSOLUTE_NEW_DESTINATION
"""
import hashlib,json,os,re,shutil,sys,zipfile
from pathlib import Path,PurePosixPath

BASE=Path(__file__).resolve().parent
manifest=json.loads((BASE/'manifest.json').read_text(encoding='utf-8'))
if len(sys.argv)!=2 or not Path(sys.argv[1]).is_absolute():raise SystemExit('Supply one absolute NEW destination')
target=Path(sys.argv[1])
if target.exists():raise SystemExit('Destination already exists; refusing overwrite')
parent=target.parent.resolve(strict=True)
if any(getattr(p.stat(follow_symlinks=False),'st_file_attributes',0)&1024 for p in [target.parent,*target.parent.parents]):raise SystemExit('Reparse parent refused')
target=parent/target.name

def safe(name):
    p=PurePosixPath(name)
    if not p.parts or p.is_absolute():return False
    for part in p.parts:
        x=part.casefold()
        if x in {'.','..','.git','.codex','.claude','.agents','.aws','.ssh','.wrangler','secrets','.secrets','credentials','private'} or x=='.env' or x.startswith('.env.'):return False
        if '\\' in part or ':' in part or '\0' in part or part.endswith(('.', ' ')):return False
        if re.fullmatch(r'(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?',x):return False
    return True

seen=set()
for row in manifest['files']:
    name=row['path']
    if not safe(name) or name.casefold() in seen or not re.fullmatch('[0-9a-f]{64}',row['sha256']):raise SystemExit('Unsafe/duplicate manifest path')
    seen.add(name.casefold())
archives=[]; objects={}
target.mkdir()
staging=target/'_delivery_restore_objects'
staging.mkdir()
try:
    for number,definition in enumerate([manifest['archive'],manifest['gameArchive']]):
        archive_path=staging/f'objects-{number}.zip'
        with archive_path.open('xb') as output:
            for chunk in definition['chunks']:
                if not re.fullmatch(r'(?:text|game)-objects\.zip\.part[0-9]{3}',chunk['path']):raise RuntimeError('Unsafe chunk path')
                raw=(BASE/chunk['path']).read_bytes()
                if len(raw)!=chunk['bytes'] or hashlib.sha256(raw).hexdigest()!=chunk['sha256']:raise RuntimeError('Chunk hash mismatch')
                output.write(raw)
        if archive_path.stat().st_size!=definition['bytes']:raise RuntimeError('Archive size mismatch')
        archive=zipfile.ZipFile(archive_path);archives.append(archive)
        for name in archive.namelist():
            if not re.fullmatch('[0-9a-f]{64}',name) or name in objects:raise RuntimeError('Invalid/duplicate archive object')
            objects[name]=archive
    for index,row in enumerate(manifest['files']):
        path=target/row['path']; path.parent.mkdir(parents=True,exist_ok=True)
        if not path.resolve().is_relative_to(target):raise RuntimeError('Outside destination')
        h=hashlib.sha256();size=0
        with objects[row['sha256']].open(row['sha256']) as source,path.open('xb') as output:
            while block:=source.read(1024*1024):h.update(block);size+=len(block);output.write(block)
        if size!=row['bytes'] or h.hexdigest()!=row['sha256']:raise RuntimeError('Restored file hash mismatch')
        if index%5000==0:print(json.dumps(dict(restored=index,total=len(manifest['files']))),flush=True)
    print(json.dumps(dict(status='PASS_FILE_RESTORE_SHA256',files=len(manifest['files']),destination=str(target))),flush=True)
finally:
    for archive in archives:archive.close()
    # Only task-created staging files, each a fixed name within verified target.
    for path in staging.iterdir():
        if path.parent!=staging or not re.fullmatch(r'objects-[01]\.zip',path.name):raise RuntimeError('Unexpected staging entry')
        path.unlink()
    staging.rmdir()
