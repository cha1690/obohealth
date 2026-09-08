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
      return { label: 'कम वज़न', message: 'एक स्वस्थ वज़न सीमा तक पहुंचने के लिए एक प्लान आपकी मदद कर सकता है।', high: false };
    }
    if (bmi < 23) {
      return { label: 'सामान्य वज़न', message: 'आप भारतीय शरीर के हिसाब से सामान्य सीमा में हैं। ऐसे ही बने रहें!', high: false };
    }
    if (bmi < 25) {
      return { label: 'अधिक वज़न', message: 'भारतीय-अनुकूलित (ICMR) मापदंड के अनुसार, यह सीमा पहले से ही अधिक मेटाबॉलिक जोखिम रखती है। एक छोटा, टिकाऊ बदलाव वाकई फर्क ला सकता है।', high: true };
    }
    return { label: 'मोटापा', message: 'किसी डॉक्टर से व्यक्तिगत रूप से मिलकर अपने लिए सही प्लान पर बात करना उचित रहेगा।', high: true };
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
        'Hi OBO Health, मैंने अभी अपना BMI कैलकुलेट किया (' + bmi.toFixed(1) + ', ' + cat.label + ') और किसी से बात करना चाहता/चाहती हूं।'
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
