(function () {
  var WHATSAPP_NUMBER = '92220660848';

  var form = document.getElementById('bmi-form');
  if (!form) return;

  var errorEl = document.getElementById('bmi-error');
  var resultEl = document.getElementById('bmi-result');
  var ctaEl = document.getElementById('bmi-cta');
  var ctaLink = document.getElementById('cta-whatsapp-link');
  var bmiValueEl = document.getElementById('bmi-value');
  var bmiCategoryEl = document.getElementById('bmi-category');
  var bmiMessageEl = document.getElementById('bmi-message');

  var heightUnit = 'cm';
  var weightUnit = 'kg';

  document.querySelectorAll('.unit-toggle').forEach(function (toggle) {
    var target = toggle.dataset.target;
    toggle.querySelectorAll('.unit-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        toggle.querySelectorAll('.unit-btn').forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        var unit = btn.dataset.unit;

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
      var cm = parseFloat(document.getElementById('height-cm-input').value);
      return cm > 0 ? cm / 100 : null;
    }
    var ft = parseFloat(document.getElementById('height-ft-input').value) || 0;
    var inch = parseFloat(document.getElementById('height-in-input').value) || 0;
    var totalIn = ft * 12 + inch;
    return totalIn > 0 ? totalIn * 0.0254 : null;
  }

  function getWeightInKg() {
    if (weightUnit === 'kg') {
      var kg = parseFloat(document.getElementById('weight-kg-input').value);
      return kg > 0 ? kg : null;
    }
    var lb = parseFloat(document.getElementById('weight-lb-input').value);
    return lb > 0 ? lb * 0.453592 : null;
  }

  function categorize(bmi) {
    if (bmi < 18.5) {
      return { label: 'कमी वजन', message: 'निरोगी वजन गाठण्यासाठी योग्य प्लॅन उपयुक्त ठरू शकतो.', high: false };
    }
    if (bmi < 23) {
      return { label: 'सामान्य वजन', message: 'तुम्ही भारतीय शरीररचनेनुसार सामान्य श्रेणीत आहात. असेच सुरू ठेवा!', high: false };
    }
    if (bmi < 25) {
      return { label: 'जास्त वजन', message: 'भारतीय-अनुकूलित (ICMR) निकषांनुसार, या श्रेणीत आधीच जास्त मेटाबॉलिक धोका असतो. एक लहान, टिकाऊ बदल खरोखर फरक करू शकतो.', high: true };
    }
    return { label: 'लठ्ठपणा', message: 'डॉक्टरांशी प्रत्यक्ष भेटून तुमच्यासाठी योग्य प्लॅनबद्दल बोलणे योग्य ठरेल.', high: true };
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();

    var heightM = getHeightInMeters();
    var weightKg = getWeightInKg();

    if (!heightM || !weightKg) {
      errorEl.classList.remove('hidden');
      resultEl.classList.add('hidden');
      ctaEl.classList.add('hidden');
      return;
    }
    errorEl.classList.add('hidden');

    var bmi = weightKg / (heightM * heightM);
    var cat = categorize(bmi);

    bmiValueEl.textContent = bmi.toFixed(1);
    bmiCategoryEl.textContent = cat.label;
    bmiMessageEl.textContent = cat.message;
    resultEl.classList.remove('hidden');

    if (cat.high) {
      var text = encodeURIComponent(
        'Hi OBO Health, मी नुकतेच माझे BMI काढले (' + bmi.toFixed(1) + ', ' + cat.label + ') आणि मला कोणाशी तरी बोलायचे आहे.'
      );
      ctaLink.href = 'https://wa.me/' + WHATSAPP_NUMBER + '?text=' + text;
      ctaEl.classList.remove('hidden');
      ctaEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else {
      ctaEl.classList.add('hidden');
      resultEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  });
})();
