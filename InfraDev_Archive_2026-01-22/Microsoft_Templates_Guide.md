# Microsoft Templates Guide (Word / PowerPoint / Outlook)

## Can HTML be used to design Word templates?
Word is not a web browser; modern CSS won’t render reliably. Use the HTML as a **design spec**, then implement via Office **Themes + Styles**.

HTML helps you keep:
- tokens (colors, fonts, radii)
- component patterns (cards, headers, pills)
- spacing rhythm

You rebuild those as:
- Word styles (Heading 1/2/3, Body, Bullets, Tables)
- PowerPoint masters + layouts
- Outlook signatures (HTML-native)

---

## One-time setup (do this first)

### 1) Install fonts
Inter, Montserrat, Poppins.

### 2) Create a PowerPoint Theme (.thmx)
Theme Colors:
- Accent 1 = `#F9C70C` (Gold)
- Dark 1 = `#0A1F44` (Navy)
- Dark 2 = `#1A2538` (Navy Light)
- Light 1 = `#FFFFFF`
- Light 2 = `#E5E7EB`
- Accent 2 = `#9CA3AF`

Theme Fonts:
- Headings = Montserrat (or Poppins)
- Body = Inter

Save as `.thmx` and reuse.

---

## PowerPoint template (recommended to build first)
Minimum layouts:
1. Cover (hero glow + logo)
2. Section divider
3. Title + content
4. 2-column
5. Card grid (3-up)
6. Process timeline (Diagnose → Deliver)
7. Case study sheet
8. Table/financial snapshot
9. Closing slide

InfraDev rules:
- dark navy base, thin borders
- gold = highlight, not wallpaper
- big radii cards, uppercase micro-labels

---

## Word template (reports/proposals)
Pages:
- cover, exec summary, section header, body page with callouts, tables, figures, footer

Bullet alignment fix:
Define the Bullet style with fixed indents (example):
- Left indent: 0.63 cm
- Hanging indent: 0.33 cm
- Space after: 6 pt
Lock it in the style.

---

## Outlook templates
- Use HTML signatures (keep CSS simple).
- Prefer SVG/PNG logo lockup.
- Avoid external fonts and complex layouts (Outlook is fragile).

---
