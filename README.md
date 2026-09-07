# Obo Health

Static website for Obo Health with a built-in BMI calculator (height/weight, metric or imperial). No data is stored — everything runs client-side. If the calculated BMI falls in the overweight/obese range, users are shown a click-to-chat WhatsApp link to contact Obo Health directly.

## Structure

- `index.html` — single-page site (hero, BMI calculator, about, contact)
- `css/style.css` — styles
- `js/bmi.js` — BMI calculation and unit toggle logic

## Local preview

Open `index.html` directly in a browser, or serve the folder:

```bash
python3 -m http.server 8000
```

Then visit `http://localhost:8000`.
