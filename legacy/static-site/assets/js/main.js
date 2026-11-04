// Digital Reservoir — shared site script
(function () {
  // Mobile menu toggle
  var menu = document.querySelector('.menu');
  var links = document.querySelector('.links');
  if (menu && links) {
    menu.setAttribute('aria-label', 'Toggle navigation');
    menu.addEventListener('click', function () { links.classList.toggle('open'); });
  }

  // Cookie banner
  var KEY = 'dr-cookie-consent';
  var banner = document.getElementById('cookie');
  function getConsent() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function setConsent(v) { try { localStorage.setItem(KEY, v); } catch (e) {} }
  if (banner) {
    if (!getConsent()) banner.classList.add('show');
    banner.querySelectorAll('[data-cookie]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        setConsent(btn.getAttribute('data-cookie'));
        banner.classList.remove('show');
      });
    });
  }
})();

// Contact form (demonstration only — no data is sent anywhere)
function demoForm(e) {
  e.preventDefault();
  var form = e.target;
  var status = form.querySelector('.formstatus');
  if (status) status.textContent = 'Thank you. This demonstration form does not transmit data yet — please email info@digitalreservoir.in until a secure form service is configured.';
  form.reset();
}
