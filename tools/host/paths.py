"""The only place host-tool paths are derived. OBSERVER_ROOT and OBSERVER_WT override the defaults."""
import os
from pathlib import Path

ROOT = Path(os.environ.get('OBSERVER_ROOT') or Path(__file__).resolve().parents[2])
ROUTING = ROOT / '.routing'
WT = Path(os.environ.get('OBSERVER_WT', '~/wt/observer')).expanduser()
NOTES = WT / '_notes'
HOST = 'observer-host'
