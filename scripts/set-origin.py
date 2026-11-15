"""Set the public origin for a new self-hosted instance, without touching credentials."""
from pathlib import Path
from urllib.parse import urlparse
import sys
origin = sys.argv[1].rstrip('/') if len(sys.argv) == 2 else ''
parsed = urlparse(origin)
if parsed.scheme not in ('http', 'https') or not parsed.netloc or parsed.path:
    raise SystemExit('Usage: python3 scripts/set-origin.py https://example.org')
p = Path(__file__).resolve().parents[1] / 'public' / 'index.html'
p.write_text(p.read_text().replace('https://octenarius.com', origin))
print('Public canonical and preview URLs updated. Check private/config.php origin separately.')
