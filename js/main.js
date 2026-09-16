(function () {
  var yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  var toggle = document.querySelector('.nav-toggle');
  if (toggle) {
    toggle.addEventListener('click', function () {
      document.body.classList.toggle('nav-open');
      var expanded = document.body.classList.contains('nav-open');
      toggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    });
  }

  document.querySelectorAll('.faq-item').forEach(function (item) {
    var btn = item.querySelector('.faq-question');
    var answer = item.querySelector('.faq-answer');
    if (!btn || !answer) return;
    btn.addEventListener('click', function () {
      var isOpen = item.classList.contains('open');
      document.querySelectorAll('.faq-item.open').forEach(function (other) {
        if (other !== item) {
          other.classList.remove('open');
          other.querySelector('.faq-answer').style.maxHeight = null;
          other.querySelector('.faq-question').setAttribute('aria-expanded', 'false');
        }
      });
      if (isOpen) {
        item.classList.remove('open');
        answer.style.maxHeight = null;
        btn.setAttribute('aria-expanded', 'false');
      } else {
        item.classList.add('open');
        answer.style.maxHeight = answer.scrollHeight + 'px';
        btn.setAttribute('aria-expanded', 'true');
      }
    });
  });

  var stepList = document.querySelector('[data-step-scroll]');
  if (stepList) {
    var stepItems = Array.prototype.slice.call(stepList.querySelectorAll('li'));
    var stepTrack = document.createElement('div');
    stepTrack.className = 'step-track';
    var stepFill = document.createElement('div');
    stepFill.className = 'step-progress-fill';
    stepList.insertBefore(stepFill, stepList.firstChild);
    stepList.insertBefore(stepTrack, stepList.firstChild);

    var stepStart = 0, stepEnd = 0;

    var layoutSteps = function () {
      if (!stepItems.length) return;
      stepStart = stepItems[0].offsetTop + 20;
      stepEnd = stepItems[stepItems.length - 1].offsetTop + 20;
      stepTrack.style.top = stepStart + 'px';
      stepTrack.style.height = Math.max(0, stepEnd - stepStart) + 'px';
      stepFill.style.top = stepStart + 'px';
    };

    var updateSteps = function () {
      var triggerY = window.innerHeight * 0.55;
      var listTop = stepList.getBoundingClientRect().top;
      var totalTrack = stepEnd - stepStart;
      var progress = totalTrack > 0
        ? Math.max(0, Math.min(1, (triggerY - (listTop + stepStart)) / totalTrack))
        : 0;
      stepFill.style.height = (progress * totalTrack) + 'px';

      stepItems.forEach(function (li) {
        var circleY = listTop + li.offsetTop + 20;
        li.classList.toggle('is-active', circleY <= triggerY);
      });
    };

    var stepTicking = false;
    var onStepScroll = function () {
      if (!stepTicking) {
        window.requestAnimationFrame(function () { updateSteps(); stepTicking = false; });
        stepTicking = true;
      }
    };

    layoutSteps();
    updateSteps();
    window.addEventListener('scroll', onStepScroll, { passive: true });
    window.addEventListener('resize', function () { layoutSteps(); updateSteps(); });
  }

  document.querySelectorAll('[data-flip-card]').forEach(function (card) {
    function toggle() {
      var flipped = card.classList.toggle('flipped');
      card.setAttribute('aria-pressed', flipped ? 'true' : 'false');
    }
    card.addEventListener('click', toggle);
    card.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggle();
      }
    });
  });

  document.querySelectorAll('[data-carousel]').forEach(function (carousel) {
    var track = carousel.querySelector('[data-track]');
    var dotsWrap = carousel.querySelector('[data-dots]');
    var prevBtn = carousel.querySelector('.carousel-prev');
    var nextBtn = carousel.querySelector('.carousel-next');
    if (!track) return;
    var slides = Array.prototype.slice.call(track.children);
    if (!slides.length) return;

    var dots = slides.map(function (slide, i) {
      var dot = document.createElement('button');
      dot.type = 'button';
      dot.className = 'carousel-dot';
      dot.setAttribute('aria-label', 'Go to slide ' + (i + 1));
      dot.addEventListener('click', function () {
        slide.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' });
      });
      if (dotsWrap) dotsWrap.appendChild(dot);
      return dot;
    });

    function activeIndex() {
      var pos = track.scrollLeft;
      var closest = 0, closestDist = Infinity;
      slides.forEach(function (slide, i) {
        var dist = Math.abs(slide.offsetLeft - pos);
        if (dist < closestDist) { closestDist = dist; closest = i; }
      });
      return closest;
    }

    function updateDots() {
      var idx = activeIndex();
      dots.forEach(function (dot, i) { dot.classList.toggle('active', i === idx); });
      if (prevBtn) prevBtn.disabled = idx === 0;
      if (nextBtn) nextBtn.disabled = idx === slides.length - 1;
    }

    track.addEventListener('scroll', function () {
      window.requestAnimationFrame(updateDots);
    }, { passive: true });

    if (prevBtn) prevBtn.addEventListener('click', function () {
      var idx = Math.max(0, activeIndex() - 1);
      slides[idx].scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' });
    });
    if (nextBtn) nextBtn.addEventListener('click', function () {
      var idx = Math.min(slides.length - 1, activeIndex() + 1);
      slides[idx].scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' });
    });

    updateDots();
  });

  var WHATSAPP_NUMBER = '919220660898';

  document.querySelectorAll('[data-callback-form]').forEach(function (form) {
    var errorEl = form.querySelector('.callback-form-error');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var nameInput = form.querySelector('input[name="name"]');
      var phoneInput = form.querySelector('input[name="phone"]');
      var name = nameInput.value.trim();
      var phone = phoneInput.value.trim();
      var digits = phone.replace(/\D/g, '');

      if (!name || digits.length < 10) {
        if (errorEl) errorEl.classList.remove('hidden');
        return;
      }
      if (errorEl) errorEl.classList.add('hidden');

      var text = encodeURIComponent(
        'Hi OBO Health, my name is ' + name + ' and my phone number is ' + phone + '. Please call me back to schedule a consultation.'
      );
      window.open('https://wa.me/' + WHATSAPP_NUMBER + '?text=' + text, '_blank', 'noopener');
      form.reset();
    });
  });
})();
