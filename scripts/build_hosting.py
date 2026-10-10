"""Build a standalone hosting upload; never copy real credentials into artifacts."""
from pathlib import Path
import shutil,json
root=Path(__file__).resolve().parents[1]
out=root/'release'/'blutbank'
out.mkdir(parents=True,exist_ok=True)
for name in ('public','private','vendor'):
 if (out/name).exists(): shutil.rmtree(out/name)
shutil.copytree(root/'dist',out/'public')
shutil.copy(root/'server/public/api.php',out/'public/api.php')
shutil.copytree(root/'server/private',out/'private',ignore=shutil.ignore_patterns('config.php'))
if not (root/'server/vendor/autoload.php').exists():raise SystemExit('Run composer install --working-dir=server first')
shutil.copytree(root/'server/vendor',out/'vendor')
shutil.copy(root/'server/schema.sql',out/'schema.sql')
(out/'public/deck-config.json').write_text(json.dumps({'api':'api.php'})+'\n')
(out/'private/.htaccess').write_text('Require all denied\n')
(out/'vendor/.htaccess').write_text('Require all denied\n')
(out/'public/.htaccess').write_text('Options -Indexes\n<IfModule mod_headers.c>\nHeader always set X-Content-Type-Options "nosniff"\nHeader always set Referrer-Policy "no-referrer"\nHeader always set X-Frame-Options "SAMEORIGIN"\n</IfModule>\n')
print(out)
