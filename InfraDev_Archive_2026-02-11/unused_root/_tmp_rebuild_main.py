from pathlib import Path
import re

path = Path('note-cadrage-triomf.html')
text = path.read_text(encoding='utf-8')

VERSION_LINE = 'Version: v1.1 | Date: 11 février 2026'
AUTHOR_LINE = 'Auteur: InfraDev.Africa — Key Expert: Ted Kivoto Isengingo'

section_map = {
    'section-i': {
        'num': 'I',
        'title': 'Note de Cadrage Stratégique',
        'desc': 'The “Why” & “What” — justification, positionnement, dispositif de contrôle.',
        'heading': 'SECTION I: NOTE DE CADRAGE STRATÉGIQUE',
        'conf': 'CONFIDENTIEL — NOTE DE PRÉSENTATION',
        'highlights': [
            'Pourquoi un verrou de contrôle est requis',
            'Positionnement InfraDev comme tiers de confiance du DG',
            'Périmètre, phases et logique d’exécution'
        ],
        'remove_titles': [r'NOTE DE CADRAGE STRATÉGIQUE'],
    },
    'section-ii': {
        'num': 'II',
        'title': 'Ordre de Service',
        'desc': 'The “Decision” — validation, mandat et signature.',
        'heading': 'SECTION II: ORDRE DE SERVICE',
        'conf': 'CONFIDENTIEL — PROJET',
        'highlights': [
            'Parties, références et objet de la mission',
            'Mandat, responsabilités et périmètre de contrôle',
            'Durée, modalités et principes de rémunération'
        ],
        'remove_titles': [r'PROJET — ORDRE DE SERVICE', r'LETTRE DE MISSION'],
    },
    'section-iii': {
        'num': 'III',
        'title': 'Heads of Terms',
        'desc': 'Commercial Details — conditions clés et structure contractuelle.',
        'heading': 'SECTION III: HEADS OF TERMS',
        'conf': 'CONFIDENTIEL — DRAFT DE NÉGOCIATION',
        'highlights': [
            'Structure contractuelle et gouvernance',
            'Conditions financières et mécanismes de paiement',
            'Obligations, livrables et exclusions'
        ],
        'remove_titles': [r'HEADS OF TERMS'],
    },
    'section-iv': {
        'num': 'IV',
        'title': 'Annexes / Templates',
        'desc': 'Proof of Method — annexes techniques et modèles opérationnels.',
        'heading': 'SECTION IV: ANNEXES / TEMPLATES',
        'conf': 'CONFIDENTIEL — OUTILS DE CONTRÔLE',
        'highlights': [
            'Grilles de contrôle et checklists',
            'Templates de reporting et registres',
            'Outils de suivi et de conformité'
        ],
        'remove_titles': [r'ANNEXES'],
    },
}


def extract_doc_content(section_html):
    marker = '<div class="doc-content">'
    start = section_html.find(marker)
    if start == -1:
        raise ValueError('doc-content not found')
    i = start + len(marker)
    depth = 1
    pos = i
    while depth > 0:
        next_open = section_html.find('<div', pos)
        next_close = section_html.find('</div>', pos)
        if next_close == -1:
            raise ValueError('unbalanced divs')
        if next_open != -1 and next_open < next_close:
            depth += 1
            pos = next_open + 4
        else:
            depth -= 1
            pos = next_close + 6
    content = section_html[i:pos-6]
    return content


def extract_section_content(section_id):
    pattern = re.compile(rf'<section id="{section_id}"[\s\S]*?</section>')
    match = pattern.search(text)
    if not match:
        raise SystemExit(f'Section {section_id} not found')
    section_html = match.group(0)
    content = extract_doc_content(section_html)

    content = re.sub(r'<div class="dg-section-heading">[\s\S]*?</div>', '', content)
    content = re.sub(r'<table>[\s\S]*?CONFIDENTIEL[\s\S]*?</table>', '', content)
    content = re.sub(r'<p>Version:[\s\S]*?</p>', '', content)
    content = re.sub(r'<p>Auteur:[\s\S]*?</p>', '', content)
    content = re.sub(r'<p>Tags:[\s\S]*?</p>', '', content)

    for title in section_map[section_id]['remove_titles']:
        content = re.sub(rf'<p>[^<]*{title}[^<]*</p>', '', content, count=1)

    content = re.sub(r'\n{2,}', '\n', content).strip()
    return content

sections_rendered = []
for section_id, meta in section_map.items():
    content = extract_section_content(section_id)
    highlights_html = ''.join([f'<li>{item}</li>' for item in meta['highlights']])

    section_html = f'''
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
                <div class="dg-section-heading">{meta['heading']}</div>
                <div class="dg-meta-box">
                    <p class="dg-meta-title">{meta['conf']}</p>
                    <p class="dg-meta-line">{VERSION_LINE}</p>
                    <p class="dg-meta-line">{AUTHOR_LINE}</p>
                </div>
                <div class="doc-content">
                    {content}
                </div>
            </div>
        </details>
    </section>
    '''.strip()
    sections_rendered.append(section_html)

sections_html = '\n\n'.join(sections_rendered)

main_match = re.search(r'<main[\s\S]*?</main>', text)
if not main_match:
    raise SystemExit('Main tag not found')

intro = f'''
    <main class="pt-32 pb-20">
        <section class="px-4">
            <div class="max-w-site mx-auto">
                <div class="flex flex-col gap-8">
                    <div class="inline-flex items-center gap-3 px-5 py-2 rounded-full bg-brand-surface border border-white/10 shadow-xl backdrop-blur-sm w-fit">
                        <span class="w-2 h-2 rounded-full bg-brand-accent animate-pulse"></span>
                        <span class="text-[11px] font-bold tracking-[0.15em] text-gray-300 uppercase font-display">Dossier DG — TRIOMF (Boma)</span>
                    </div>
                    <div class="inline-flex flex-col gap-1 px-5 py-3 rounded-2xl border border-red-400/40 bg-red-500/10 shadow-xl w-fit">
                        <div class="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-red-200 font-display">
                            <span class="material-symbols-outlined text-xs">lock</span>
                            Confidential proposal • Work in progress
                        </div>
                        <div class="text-[10px] font-semibold uppercase tracking-[0.2em] text-red-100/80 font-display">
                            Proposition confidentielle • Travail en cours
                        </div>
                    </div>

                    <div class="space-y-4">
                        <h1 class="text-4xl md:text-5xl lg:text-6xl font-bold text-white leading-[1.05] font-display">
                            Dossier de décision — TRIOMF RDC
                        </h1>
                        <p class="text-lg md:text-xl text-gray-300 max-w-4xl font-light">
                            Ce dossier rassemble toutes les pièces essentielles pour décision DG et sécurisation des décaissements. Le parcours suit une logique opérationnelle claire : justification, décision, conditions commerciales, puis preuves de méthode.
                        </p>
                        <p class="text-base text-gray-400 max-w-4xl">
                            Vous pouvez demander le pack Word/Excel et soumettre des commentaires via la section « Demandes &amp; commentaires » en bas de page (accès contrôlé pour confidentialité).
                        </p>
                    </div>

                    <div class="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-6">
                        <div class="bg-brand-surface/70 border border-white/10 rounded-3xl p-6 md:p-8 shadow-xl">
                            <h2 class="text-sm font-bold text-brand-accent uppercase tracking-[0.2em] mb-4">Narrative Arc</h2>
                            <ol class="space-y-3 text-sm text-gray-300">
                                <li><a class="hover:text-white transition-colors" href="#section-i"><strong>I.</strong> Note de Cadrage Stratégique — <span class="text-gray-400">The “Why” &amp; “What”</span></a></li>
                                <li><a class="hover:text-white transition-colors" href="#section-ii"><strong>II.</strong> Ordre de Service — <span class="text-gray-400">The “Decision”</span></a></li>
                                <li><a class="hover:text-white transition-colors" href="#section-iii"><strong>III.</strong> Heads of Terms — <span class="text-gray-400">Commercial Details</span></a></li>
                                <li><a class="hover:text-white transition-colors" href="#section-iv"><strong>IV.</strong> Annexes / Templates — <span class="text-gray-400">Proof of Method</span></a></li>
                            </ol>
                        </div>
                        <div class="bg-brand-base/60 border border-white/10 rounded-3xl p-6 md:p-8 shadow-xl">
                            <h2 class="text-sm font-bold text-brand-accent uppercase tracking-[0.2em] mb-4">Guide de lecture</h2>
                            <ul class="list-disc list-inside space-y-2 text-sm text-gray-300">
                                <li>Chaque section est résumée et extensible.</li>
                                <li>Ouvrez uniquement ce qui est nécessaire sur mobile.</li>
                                <li>Les éléments décisionnels clés sont en tête de section.</li>
                            </ul>
                        </div>
                    </div>

                    <div class="space-y-10">
                        {sections_html}
                    </div>

                    <section id="request-pack" class="bg-brand-surface/70 border border-white/10 rounded-[2.5rem] p-8 md:p-10 shadow-2xl">
                        <div class="flex flex-col lg:flex-row lg:items-start gap-8">
                            <div class="lg:w-1/2">
                                <h2 class="text-xl font-bold text-white font-display">Demandes &amp; commentaires</h2>
                                <p class="text-gray-300 text-sm mt-3">
                                    Pour des raisons de confidentialité, les versions Word/Excel sont transmises uniquement sur demande nominative. Merci de préciser le destinataire et l’usage prévu.
                                </p>
                                <div class="flex flex-col sm:flex-row gap-4 mt-6">
                                    <a class="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-pill bg-brand-accent text-brand-base font-bold text-xs uppercase tracking-widest hover:bg-white transition-all" href="mailto:info@infradev.africa?subject=Demande%20Pack%20Word%20-%20Dossier%20DG%20TRIOMF">
                                        <span class="material-symbols-outlined text-base">description</span>
                                        Demander Word
                                    </a>
                                    <a class="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-pill border border-brand-accent/40 text-brand-accent font-bold text-xs uppercase tracking-widest hover:bg-brand-surface transition-all" href="mailto:info@infradev.africa?subject=Demande%20Pack%20Excel%20-%20Dossier%20DG%20TRIOMF">
                                        <span class="material-symbols-outlined text-base">table_chart</span>
                                        Demander Excel
                                    </a>
                                </div>
                            </div>
                            <div class="lg:w-1/2">
                                <label class="text-[10px] font-bold text-brand-accent uppercase tracking-[0.15em]">Commentaires (DG)</label>
                                <textarea id="dg-comments" class="w-full mt-3 bg-brand-base border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-brand-accent focus:ring-1 focus:ring-brand-accent transition-all text-sm font-light min-h-[140px]" placeholder="Vos remarques, points d’arbitrage ou questions clés..."></textarea>
                                <button id="dg-comment-submit" class="w-full mt-4 bg-brand-accent text-brand-base font-bold text-xs font-display rounded-pill py-3 hover:bg-white transition-all uppercase tracking-widest">Envoyer par email</button>
                                <p class="text-[10px] text-gray-400 mt-2">Le commentaire sera envoyé à info@infradev.africa avec un objet dédié.</p>
                            </div>
                        </div>
                    </section>
                </div>
            </div>
        </section>
    </main>
'''

new_text = text.replace(main_match.group(0), intro)
path.write_text(new_text, encoding='utf-8')
print('main rebuilt')
