from pathlib import Path
root = Path('.')
path = root/'note-cadrage-triomf.html'
fragments = {
    'cadrage': (root/'assets/attachments/dg-merged-cadrage.html').read_text(encoding='utf-8').strip(),
    'ordre': (root/'assets/attachments/dg-merged-ordre.html').read_text(encoding='utf-8').strip(),
    'hots': (root/'assets/attachments/dg-merged-hots.html').read_text(encoding='utf-8').strip(),
    'annexes': (root/'assets/attachments/dg-merged-annexes.html').read_text(encoding='utf-8').strip(),
}

main = f'''
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
                            Tous les documents clés ont été fusionnés dans un seul parcours de lecture. Le contenu est organisé pour permettre une lecture rapide sur mobile, avec un chemin décisionnel clair.
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
                        <div class="bg-brand-base/60 border border-white/10 rounded-3xl p-6 md:p-8 shadow-xl flex flex-col gap-6">
                            <div>
                                <h2 class="text-sm font-bold text-brand-accent uppercase tracking-[0.2em] mb-3">Pack Word / Excel</h2>
                                <p class="text-gray-300 text-sm leading-relaxed">
                                    Pour confidentialité, le pack complet est transmis uniquement sur demande nominative. Merci d’indiquer le destinataire et l’usage prévu.
                                </p>
                            </div>
                            <div class="flex flex-col sm:flex-row gap-4">
                                <a class="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-pill bg-brand-accent text-brand-base font-bold text-xs uppercase tracking-widest hover:bg-white transition-all" href="mailto:info@infradev.africa?subject=Demande%20Pack%20Word%20-%20Dossier%20DG%20TRIOMF">
                                    <span class="material-symbols-outlined text-base">description</span>
                                    Demander Word
                                </a>
                                <a class="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-pill border border-brand-accent/40 text-brand-accent font-bold text-xs uppercase tracking-widest hover:bg-brand-surface transition-all" href="mailto:info@infradev.africa?subject=Demande%20Pack%20Excel%20-%20Dossier%20DG%20TRIOMF">
                                    <span class="material-symbols-outlined text-base">table_chart</span>
                                    Demander Excel
                                </a>
                            </div>
                            <div class="border-t border-white/10 pt-4">
                                <label class="text-[10px] font-bold text-brand-accent uppercase tracking-[0.15em]">Commentaires (DG)</label>
                                <textarea id="dg-comments" class="w-full mt-3 bg-brand-base border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-brand-accent focus:ring-1 focus:ring-brand-accent transition-all text-sm font-light min-h-[120px]" placeholder="Vos remarques, points d’arbitrage ou questions clés..."></textarea>
                                <button id="dg-comment-submit" class="w-full mt-4 bg-brand-accent text-brand-base font-bold text-xs font-display rounded-pill py-3 hover:bg-white transition-all uppercase tracking-widest">Envoyer par email</button>
                                <p class="text-[10px] text-gray-400 mt-2">Le commentaire sera envoyé à info@infradev.africa avec un objet dédié.</p>
                            </div>
                        </div>
                    </div>

                    <div class="space-y-10">
                        <section id="section-i" class="dg-section">
                            <details class="dg-details">
                                <summary class="dg-summary">
                                    <div class="dg-card">
                                        <div class="dg-card-header">
                                            <div class="dg-index">I</div>
                                            <div>
                                                <p class="dg-label">Section I</p>
                                                <h2 class="dg-title">Note de Cadrage Stratégique</h2>
                                                <p class="dg-desc">The “Why” &amp; “What” — justification, positionnement, dispositif de contrôle.</p>
                                            </div>
                                        </div>
                                        <ul class="dg-highlights">
                                            <li>Pourquoi un verrou de contrôle est requis</li>
                                            <li>Positionnement InfraDev comme tiers de confiance du DG</li>
                                            <li>Périmètre, phases et logique d’exécution</li>
                                        </ul>
                                        <div class="dg-summary-footer">
                                            <span class="dg-expand-closed">Voir le contenu</span>
                                            <span class="dg-expand-open">Masquer le contenu</span>
                                            <span class="material-symbols-outlined dg-chevron">expand_more</span>
                                        </div>
                                    </div>
                                </summary>
                                <div class="doc-panel">
                                    <div class="doc-content">{fragments['cadrage']}</div>
                                </div>
                            </details>
                        </section>

                        <section id="section-ii" class="dg-section">
                            <details class="dg-details">
                                <summary class="dg-summary">
                                    <div class="dg-card">
                                        <div class="dg-card-header">
                                            <div class="dg-index">II</div>
                                            <div>
                                                <p class="dg-label">Section II</p>
                                                <h2 class="dg-title">Ordre de Service</h2>
                                                <p class="dg-desc">The “Decision” — validation, mandat et signature.</p>
                                            </div>
                                        </div>
                                        <ul class="dg-highlights">
                                            <li>Parties, références et objet de la mission</li>
                                            <li>Mandat, responsabilités et périmètre de contrôle</li>
                                            <li>Durée, modalités et principes de rémunération</li>
                                        </ul>
                                        <div class="dg-summary-footer">
                                            <span class="dg-expand-closed">Voir le contenu</span>
                                            <span class="dg-expand-open">Masquer le contenu</span>
                                            <span class="material-symbols-outlined dg-chevron">expand_more</span>
                                        </div>
                                    </div>
                                </summary>
                                <div class="doc-panel">
                                    <div class="doc-content">{fragments['ordre']}</div>
                                </div>
                            </details>
                        </section>

                        <section id="section-iii" class="dg-section">
                            <details class="dg-details">
                                <summary class="dg-summary">
                                    <div class="dg-card">
                                        <div class="dg-card-header">
                                            <div class="dg-index">III</div>
                                            <div>
                                                <p class="dg-label">Section III</p>
                                                <h2 class="dg-title">Heads of Terms</h2>
                                                <p class="dg-desc">Commercial Details — conditions clés et structure contractuelle.</p>
                                            </div>
                                        </div>
                                        <ul class="dg-highlights">
                                            <li>Structure contractuelle et gouvernance</li>
                                            <li>Conditions financières et mécanismes de paiement</li>
                                            <li>Obligations, livrables et exclusions</li>
                                        </ul>
                                        <div class="dg-summary-footer">
                                            <span class="dg-expand-closed">Voir le contenu</span>
                                            <span class="dg-expand-open">Masquer le contenu</span>
                                            <span class="material-symbols-outlined dg-chevron">expand_more</span>
                                        </div>
                                    </div>
                                </summary>
                                <div class="doc-panel">
                                    <div class="doc-content">{fragments['hots']}</div>
                                </div>
                            </details>
                        </section>

                        <section id="section-iv" class="dg-section">
                            <details class="dg-details">
                                <summary class="dg-summary">
                                    <div class="dg-card">
                                        <div class="dg-card-header">
                                            <div class="dg-index">IV</div>
                                            <div>
                                                <p class="dg-label">Section IV</p>
                                                <h2 class="dg-title">Annexes / Templates</h2>
                                                <p class="dg-desc">Proof of Method — annexes techniques et modèles opérationnels.</p>
                                            </div>
                                        </div>
                                        <ul class="dg-highlights">
                                            <li>Grilles de contrôle et checklists</li>
                                            <li>Templates de reporting et registres</li>
                                            <li>Outils de suivi et de conformité</li>
                                        </ul>
                                        <div class="dg-summary-footer">
                                            <span class="dg-expand-closed">Voir le contenu</span>
                                            <span class="dg-expand-open">Masquer le contenu</span>
                                            <span class="material-symbols-outlined dg-chevron">expand_more</span>
                                        </div>
                                    </div>
                                </summary>
                                <div class="doc-panel">
                                    <div class="doc-content">{fragments['annexes']}</div>
                                </div>
                            </details>
                        </section>
                    </div>
                </div>
            </div>
        </section>
    </main>
'''

text = path.read_text(encoding='utf-8')
start = text.find('<main')
end = text.find('</main>')
if start == -1 or end == -1:
    raise SystemExit('Main tag not found')
new_text = text[:start] + main + text[end+7:]
path.write_text(new_text, encoding='utf-8')
print('main rebuilt')
