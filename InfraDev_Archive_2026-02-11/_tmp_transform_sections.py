import re
from pathlib import Path

path = Path('note-cadrage-triomf.html')
text = path.read_text(encoding='utf-8')

sections = {
    'section-i': {
        'num': 'I',
        'title': 'Note de Cadrage Stratégique',
        'desc': 'The “Why” & “What” — justification, positionnement, dispositif de contrôle.',
        'highlights': [
            'Pourquoi un verrou de contrôle est requis',
            'Positionnement InfraDev comme tiers de confiance du DG',
            'Périmètre, phases et logique d’exécution'
        ],
    },
    'section-ii': {
        'num': 'II',
        'title': 'Ordre de Service',
        'desc': 'The “Decision” — validation, mandat et signature.',
        'highlights': [
            'Parties, références et objet de la mission',
            'Mandat, responsabilités et périmètre de contrôle',
            'Durée, modalités et principes de rémunération'
        ],
    },
    'section-iii': {
        'num': 'III',
        'title': 'Heads of Terms',
        'desc': 'Commercial Details — conditions clés et structure contractuelle.',
        'highlights': [
            'Structure contractuelle et gouvernance',
            'Conditions financières et mécanismes de paiement',
            'Obligations, livrables et exclusions'
        ],
    },
    'section-iv': {
        'num': 'IV',
        'title': 'Annexes / Templates',
        'desc': 'Proof of Method — annexes techniques et modèles opérationnels.',
        'highlights': [
            'Grilles de contrôle et checklists',
            'Templates de reporting et registres',
            'Outils de suivi et de conformité'
        ],
    },
}

for section_id, meta in sections.items():
    pattern = re.compile(rf'<section id="{section_id}"[\s\S]*?</section>')
    match = pattern.search(text)
    if not match:
        raise SystemExit(f'Section {section_id} not found')

    section_html = match.group(0)
    content_match = re.search(r'<div class="doc-content[^>]*>([\s\S]*?)</div>', section_html)
    if not content_match:
        raise SystemExit(f'doc-content not found in {section_id}')
    content = content_match.group(1).strip()

    highlights_html = ''.join([f'<li>{item}</li>' for item in meta['highlights']])

    replacement = f'''
<section id="{section_id}" class="dg-section">
    <details class="dg-details">
        <summary class="dg-summary">
            <div class="dg-card">
                <div class="dg-card-header">
                    <div class="dg-index">{meta['num']}</div>
                    <div>
                        <p class="dg-label">Section {meta['num']}</p>
                        <h2 class="dg-title">{meta['title']}</h2>
                        <p class="dg-desc">{meta['desc']}</p>
                    </div>
                </div>
                <ul class="dg-highlights">{highlights_html}</ul>
                <div class="dg-summary-footer">
                    <span class="dg-expand-closed">Voir le contenu</span>
                    <span class="dg-expand-open">Masquer le contenu</span>
                    <span class="material-symbols-outlined dg-chevron">expand_more</span>
                </div>
            </div>
        </summary>
        <div class="doc-panel">
            <div class="doc-content">{content}</div>
        </div>
    </details>
</section>
'''.strip()

    text = text[:match.start()] + replacement + text[match.end():]

# Remove the documents sources block (if present)
text = re.sub(r'<div class="bg-brand-surface/70[\s\S]*?Documents sources[\s\S]*?</div>\s*</div>', '', text, count=1)

path.write_text(text, encoding='utf-8')
print('sections transformed')
