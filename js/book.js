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
      submitError: 'Something went wrong. Please call us at +91 92206 60898.',
      messageFailedNote: "We couldn't send the WhatsApp confirmation, but your slot is booked — please call +91 92206 60898 to confirm."
    },
    hi: {
      loading: 'उपलब्ध समय लोड हो रहे हैं…',
      noSlots: 'उस दिन कोई स्लॉट उपलब्ध नहीं है — कृपया कोई और तारीख चुनें।',
      loadError: 'समय लोड नहीं हो सका। कृपया +91 92206 60898 पर कॉल करें।',
      booking: 'आपका स्लॉट बुक किया जा रहा है…',
      submitError: 'कुछ गड़बड़ हो गई। कृपया +91 92206 60898 पर कॉल करें।',
      messageFailedNote: 'हम व्हाट्सएप पुष्टि नहीं भेज सके, लेकिन आपका स्लॉट बुक हो गया है — कृपया पुष्टि के लिए +91 92206 60898 पर कॉल करें।'
    },
    mr: {
      loading: 'उपलब्ध वेळा लोड होत आहेत…',
      noSlots: 'त्या दिवशी कोणतेही स्लॉट उपलब्ध नाहीत — कृपया दुसरी तारीख निवडा.',
      loadError: 'वेळा लोड करता आल्या नाहीत. कृपया +91 92206 60898 वर कॉल करा.',
      booking: 'तुमचा स्लॉट बुक होत आहे…',
      submitError: 'काहीतरी चुकले. कृपया +91 92206 60898 वर कॉल करा.',
      messageFailedNote: 'आम्ही व्हॉट्सअ‍ॅप पुष्टी पाठवू शकलो नाही, पण तुमचा स्लॉट बुक झाला आहे — कृपया पुष्टीसाठी +91 92206 60898 वर कॉल करा.'
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
  var messageWarningEl = document.querySelector('[data-book-message-warning]');

  var selectedTime = null;

  function toISODate(d) {
    var copy = new Date(d.getTime());
    copy.setMinutes(copy.getMinutes() - copy.getTimezoneOffset());
    return copy.toISOString().slice(0, 10);
  }

  function todayISO() {
    return toISODate(new Date());
  }

  // Apps Script's "Anyone" web apps can be slow or briefly flaky right after
  // a deploy. Time out instead of hanging forever, and retry once before
  // giving up, so a single slow response doesn't strand the visitor.
  function fetchJson(url, options, timeoutMs) {
    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, timeoutMs || 20000);
    var fetchOptions = Object.assign({}, options, { signal: controller.signal });

    return fetch(url, fetchOptions)
      .then(function (r) { return r.json(); })
      .finally(function () { clearTimeout(timer); });
  }

  function fetchJsonWithRetry(url, options) {
    return fetchJson(url, options).catch(function () {
      return fetchJson(url, options);
    });
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

    fetchJsonWithRetry(ENDPOINT + '?action=slots&date=' + encodeURIComponent(dateStr))
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

  // On page load, skip straight to the first day that actually has open
  // slots (e.g. today after hours, or a closed day) rather than defaulting
  // to today and making the visitor click through empty days themselves.
  function findFirstAvailableDate(daysAhead) {
    var dateStr = toISODate(new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000));
    dateInput.value = dateStr;

    fetchJsonWithRetry(ENDPOINT + '?action=slots&date=' + encodeURIComponent(dateStr))
      .then(function (data) {
        if (data.success && data.slots && data.slots.length) {
          renderSlots(data.slots);
        } else if (daysAhead < 14) {
          findFirstAvailableDate(daysAhead + 1);
        } else {
          renderSlots([]);
        }
      })
      .catch(function () {
        showLoadError();
      });
  }

  dateInput.min = todayISO();
  slotGrid.innerHTML = '<p class="slot-loading">' + T.loading + '</p>';
  findFirstAvailableDate(0);

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

    fetchJson(ENDPOINT, {
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
    }, 15000)
      .then(function (data) {
        if (data.success) {
          form.hidden = true;
          confirmationEl.hidden = false;
          if (messageWarningEl) {
            messageWarningEl.textContent = data.messageSent ? '' : T.messageFailedNote;
            messageWarningEl.hidden = !!data.messageSent;
          }
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
