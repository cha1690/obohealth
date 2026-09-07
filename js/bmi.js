(function () {
  document.getElementById('year').textContent = new Date().getFullYear();

  const WHATSAPP_NUMBER = '92220660848';

  const form = document.getElementById('bmi-form');
  const errorEl = document.getElementById('bmi-error');
  const resultEl = document.getElementById('bmi-result');
  const ctaEl = document.getElementById('bmi-cta');
  const ctaLink = document.getElementById('cta-whatsapp-link');
  const bmiValueEl = document.getElementById('bmi-value');
  const bmiCategoryEl = document.getElementById('bmi-category');
  const bmiMessageEl = document.getElementById('bmi-message');

  let heightUnit = 'cm';
  let weightUnit = 'kg';

  document.querySelectorAll('.unit-toggle').forEach((toggle) => {
    const target = toggle.dataset.target;
    toggle.querySelectorAll('.unit-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        toggle.querySelectorAll('.unit-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        const unit = btn.dataset.unit;

        if (target === 'height') {
          heightUnit = unit;
          document.getElementById('height-cm').classList.toggle('hidden', unit !== 'cm');
          document.getElementById('height-ftin').classList.toggle('hidden', unit !== 'ftin');
        } else {
          weightUnit = unit;
          document.getElementById('weight-kg').classList.toggle('hidden', unit !== 'kg');
          document.getElementById('weight-lb').classList.toggle('hidden', unit !== 'lb');
        }
      });
    });
  });

  function getHeightInMeters() {
    if (heightUnit === 'cm') {
      const cm = parseFloat(document.getElementById('height-cm-input').value);
      return cm > 0 ? cm / 100 : null;
    }
    const ft = parseFloat(document.getElementById('height-ft-input').value) || 0;
    const inch = parseFloat(document.getElementById('height-in-input').value) || 0;
    const totalIn = ft * 12 + inch;
    return totalIn > 0 ? totalIn * 0.0254 : null;
  }

  function getWeightInKg() {
    if (weightUnit === 'kg') {
      const kg = parseFloat(document.getElementById('weight-kg-input').value);
      return kg > 0 ? kg : null;
    }
    const lb = parseFloat(document.getElementById('weight-lb-input').value);
    return lb > 0 ? lb * 0.453592 : null;
  }

  function categorize(bmi) {
    if (bmi < 18.5) {
      return {
        label: 'Underweight',
        message: 'You may benefit from a plan to reach a healthier weight range.',
        high: false,
      };
    }
    if (bmi < 25) {
      return {
        label: 'Normal weight',
        message: "You're within the typical healthy range. Keep it up!",
        high: false,
      };
    }
    if (bmi < 30) {
      return {
        label: 'Overweight',
        message: 'A small, sustainable change could make a real difference.',
        high: true,
      };
    }
    return {
      label: 'Obese',
      message: "It's worth speaking with someone about a plan that works for you.",
      high: true,
    };
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();

    const heightM = getHeightInMeters();
    const weightKg = getWeightInKg();

    if (!heightM || !weightKg) {
      errorEl.classList.remove('hidden');
      resultEl.classList.add('hidden');
      ctaEl.classList.add('hidden');
      return;
    }
    errorEl.classList.add('hidden');

    const bmi = weightKg / (heightM * heightM);
    const { label, message, high } = categorize(bmi);

    bmiValueEl.textContent = bmi.toFixed(1);
    bmiCategoryEl.textContent = label;
    bmiMessageEl.textContent = message;
    resultEl.classList.remove('hidden');

    if (high) {
      const text = encodeURIComponent(
        `Hi Obo Health, I just calculated my BMI (${bmi.toFixed(1)}, ${label}) and I'd like to talk to someone.`
      );
      ctaLink.href = `https://wa.me/${WHATSAPP_NUMBER}?text=${text}`;
      ctaEl.classList.remove('hidden');
      ctaEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else {
      ctaEl.classList.add('hidden');
      resultEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  });
})();
