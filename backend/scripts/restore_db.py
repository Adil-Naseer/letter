from pathlib import Path
import shutil
import sys

if len(sys.argv) != 2:
    raise SystemExit("Usage: python scripts/restore_db.py storage/backups/app_YYYYMMDD_HHMMSS.db")
src = Path(sys.argv[1])
if not src.exists():
    raise SystemExit("Backup file not found")
dst = Path("storage/app.db")
dst.parent.mkdir(parents=True, exist_ok=True)
shutil.copy2(src, dst)
print("Restored", src)
