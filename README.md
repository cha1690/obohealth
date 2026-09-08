# OBO Health

Marketing website for OBO Health — Pune's clinic-first weight loss, diabetes and metabolic
care program. Plain static HTML/CSS/JS, no build step, no framework.

## Structure

- `index.html`, `pricing/`, `how-it-works/`, `about/`, `compare/`, `bmi-calculator/`,
  `conditions/` (+ `obesity-weight-loss/`, `type-2-diabetes/`, `pcos-pcod/`), `faq/`, `contact/`
  — English pages, one folder per URL (`/pricing/index.html` etc.)
- `hi/...` and `mr/...` — Hindi and Marathi translations, mirroring the same page structure
  (e.g. `/hi/pricing/`, `/mr/pricing/`), each with its own `<title>`, meta description and
  `hreflang` tags for SEO.
- `css/style.css` — shared design system (colors, type, components) for all pages/languages.
- `js/main.js` — mobile nav toggle + FAQ accordion, shared across all pages.
- `js/bmi.js`, `js/bmi.hi.js`, `js/bmi.mr.js` — BMI calculator logic (Indian/ICMR-adjusted
  cutoffs), one per language so the result text matches the page language.
- `images/favicon.svg` — the three-dot mark recreated as inline SVG from the brand logo.
- `robots.txt`, `sitemap.xml` — basic SEO plumbing.

## What's placeholder content

Search any page for bracketed text like `[Doctor's Full Name]`, `[XXXXXXX]`, or
`[Exact street address — to be confirmed]` — these are the specific items called out as
open/unconfirmed in the website brief (doctor name, degree, registration number, photo,
exact clinic address & hours, real testimonials, cancellation/refund policy). Swap these
for real content before launch. Real, already-confirmed content (WhatsApp/call number,
Deccan Gymkhana locality, pricing tiers, medication brand) is used as-is throughout.

The Hindi and Marathi translations are AI-drafted and should get a human review pass
(especially medical claims and disclaimers) before publishing, per the brief's multilingual
requirement.

## Local preview

```bash
python3 -m http.server 8000
```

Then visit `http://localhost:8000`. Because pages use absolute paths (`/css/style.css`,
`/pricing/`, etc.), they must be served from the site root — opening the HTML files
directly via `file://` will break the links.
