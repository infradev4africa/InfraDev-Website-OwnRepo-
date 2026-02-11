import re
from pathlib import Path
path = Path('note-cadrage-triomf.html')
text = path.read_text(encoding='utf-8')
text = re.sub(r'\sstyle="[^"]*"', '', text)
path.write_text(text, encoding='utf-8')
print('inline styles removed')
