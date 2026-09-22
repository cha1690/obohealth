(function () {
  var form = document.querySelector('[data-book-form]');
  if (!form) return;

  // Same Apps Script Web App as the contact form.
  var ENDPOINT = 'https://script.google.com/macros/s/AKfycbwzt7HNHIlyP-0jrplvNWqvzKi1XDRfKaa-REyYufUMeM9-J51bTfaYDuewc1r7LpFs4g/exec';
  var FORM_SECRET = '-PC8NWZCdBjVhV64VFvaE3TdR1k7-fj7';
  var LANGUAGE_MAP = { en: 'English', hi: 'Hindi', mr: 'Marathi' };
  var LANGUAGE = LANGUAGE_MAP[document.documentElement.lang] || 'English';

  var STRINGS = {
    en: {
      loading: 'Loading available times…',
      noSlots: 'No open slots that day — please try another date.',
      loadError: 'Could not load times. Please call us at +91 92206 60898.',
      booking: 'Booking your slot…',
      submitError: 'Something went wrong. Please call us at +91 92206 60898.'
    },
    hi: {
      loading: 'उपलब्ध समय लोड हो रहे हैं…',
      noSlots: 'उस दिन कोई स्लॉट उपलब्ध नहीं है — कृपया कोई और तारीख चुनें।',
      loadError: 'समय लोड नहीं हो सका। कृपया +91 92206 60898 पर कॉल करें।',
      booking: 'आपका स्लॉट बुक किया जा रहा है…',
      submitError: 'कुछ गड़बड़ हो गई। कृपया +91 92206 60898 पर कॉल करें।'
    },
    mr: {
      loading: 'उपलब्ध वेळा लोड होत आहेत…',
      noSlots: 'त्या दिवशी कोणतेही स्लॉट उपलब्ध नाहीत — कृपया दुसरी तारीख निवडा.',
      loadError: 'वेळा लोड करता आल्या नाहीत. कृपया +91 92206 60898 वर कॉल करा.',
      booking: 'तुमचा स्लॉट बुक होत आहे…',
      submitError: 'काहीतरी चुकले. कृपया +91 92206 60898 वर कॉल करा.'
    }
  };
  var T = STRINGS[document.documentElement.lang] || STRINGS.en;

  var dateInput = form.querySelector('[data-book-date]');
  var slotGrid = form.querySelector('[data-book-slots]');
  var nameInput = form.querySelector('input[name="name"]');
  var phoneInput = form.querySelector('input[name="phone"]');
  var submitBtn = form.querySelector('[data-book-submit]');
  var statusEl = form.querySelector('[data-book-status]');
  var confirmationEl = document.querySelector('[data-book-confirmation]');

  var selectedTime = null;

  function todayISO() {
    var d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 10);
  }

  function setStatus(message, type) {
    statusEl.textContent = message || '';
    statusEl.className = 'book-status' + (type ? ' ' + type : '');
  }

  function updateSubmitState() {
    submitBtn.disabled = !(selectedTime && nameInput.value.trim() && phoneInput.value.trim().replace(/\D/g, '').length >= 10);
  }

  function renderSlots(slots) {
    slotGrid.innerHTML = '';
    selectedTime = null;
    updateSubmitState();

    if (!slots.length) {
      var empty = document.createElement('p');
      empty.className = 'slot-empty';
      empty.textContent = T.noSlots;
      slotGrid.appendChild(empty);
      return;
    }

    slots.forEach(function (time) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'slot-btn';
      btn.textContent = time;
      btn.addEventListener('click', function () {
        slotGrid.querySelectorAll('.slot-btn').forEach(function (b) { b.classList.remove('selected'); });
        btn.classList.add('selected');
        selectedTime = time;
        updateSubmitState();
      });
      slotGrid.appendChild(btn);
    });
  }

  function loadSlots(dateStr) {
    slotGrid.innerHTML = '<p class="slot-loading">' + T.loading + '</p>';
    setStatus('');

    fetch(ENDPOINT + '?action=slots&date=' + encodeURIComponent(dateStr))
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.success) {
          renderSlots(data.slots || []);
        } else {
          showLoadError();
        }
      })
      .catch(function () {
        showLoadError();
      });
  }

  function showLoadError() {
    slotGrid.innerHTML = '<p class="slot-empty">' + T.loadError + '</p>';
  }

  dateInput.min = todayISO();
  dateInput.value = todayISO();
  loadSlots(dateInput.value);

  dateInput.addEventListener('change', function () {
    if (dateInput.value) loadSlots(dateInput.value);
  });
  nameInput.addEventListener('input', updateSubmitState);
  phoneInput.addEventListener('input', updateSubmitState);

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!selectedTime) return;

    submitBtn.disabled = true;
    setStatus(T.booking);

    fetch(ENDPOINT, {
      method: 'POST',
      body: JSON.stringify({
        action: 'book',
        name: nameInput.value.trim(),
        phone: phoneInput.value.trim(),
        date: dateInput.value,
        time: selectedTime,
        language: LANGUAGE,
        secret: FORM_SECRET
      })
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.success) {
          form.hidden = true;
          confirmationEl.hidden = false;
        } else {
          setStatus(data.error || T.submitError, 'error');
          submitBtn.disabled = false;
          if (/taken/i.test(data.error || '')) loadSlots(dateInput.value);
        }
      })
      .catch(function () {
        setStatus(T.submitError, 'error');
        submitBtn.disabled = false;
      });
  });
})();
