from pathlib import Path
import re

files = [Path('index.html'), Path('note-cadrage-triomf.html'), Path('capability-statement.html')]
css_parts = []
for path in files:
    if not path.exists():
        continue
    text = path.read_text(encoding='utf-8')
    for match in re.finditer(r'<style>([\s\S]*?)</style>', text):
        css = match.group(1).strip()
        if css:
            css_parts.append(f"/* SOURCE: {path.name} */\n" + css)

css_out = "\n\n".join(css_parts) + "\n"

styles_dir = Path('assets/styles')
styles_dir.mkdir(parents=True, exist_ok=True)
(Path('assets/styles/site.css')).write_text(css_out, encoding='utf-8')

# remove style blocks and insert link
for path in files:
    if not path.exists():
        continue
    text = path.read_text(encoding='utf-8')
    text = re.sub(r'\s*<style>[\s\S]*?</style>\s*', '\n', text, count=1)
    if 'assets/styles/site.css' not in text:
        # insert link before closing head
        link_tag = '    <link rel="stylesheet" href="assets/styles/site.css"/>\n'
        text = text.replace('</head>', link_tag + '</head>')
    path.write_text(text, encoding='utf-8')

print('site.css written and style blocks removed')
