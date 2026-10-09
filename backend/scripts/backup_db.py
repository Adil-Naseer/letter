from datetime import datetime
from pathlib import Path
import shutil

src = Path("storage/app.db")
if not src.exists():
    raise SystemExit("Database does not exist. Run init first.")
backup_dir = Path("storage/backups")
backup_dir.mkdir(parents=True, exist_ok=True)
name = backup_dir / f"app_{datetime.now().strftime('%Y%m%d_%H%M%S')}.db"
shutil.copy2(src, name)
print(name)
