/* Red de seguridad del arranque.
 * Si la app no termina de cargar, reemplaza el spinner por un aviso accionable.
 * Se carga como script clasico para poder ejecutarse aunque falle el modulo principal.
 */
(function () {
  'use strict';

  var BOOT_TIMEOUT_MS = 9000;
  var SERVER_URL = 'http://127.0.0.1:3000';

  window.__kioscoReady = new Promise(function (resolve) {
    if (location.protocol !== 'file:') {
      resolve();
      return;
    }

    var settled = false;
    var controller = new AbortController();
    var timer = setTimeout(function () {
      controller.abort();
    }, 700);

    function finish() {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve();
    }

    fetch(SERVER_URL + '/api/health', {
      mode: 'no-cors',
      cache: 'no-store',
      signal: controller.signal,
    })
      .then(function () {
        location.replace(SERVER_URL + '/' + (location.hash || ''));
        setTimeout(finish, 250);
      })
      .catch(function () {
        finish();
      });
  });

  function showRecovery(title, message) {
    var view = document.getElementById('view');
    if (!view || !document.querySelector('.boot-screen')) return;
    view.innerHTML =
      '<div class="error-block">' +
      '<span class="empty-icon"></span>' +
      '<h3>' +
      title +
      '</h3>' +
      '<p>' +
      message +
      '</p>' +
      '<p id="boot-diagnostic">Revisando la conexión con el servidor...</p>' +
      '<a class="btn btn-primary" href="' +
      SERVER_URL +
      '/">Reintentar</a>' +
      '</div>';
  }

  function hideDiagnostic() {
    var diagnostic = document.getElementById('boot-diagnostic');
    if (diagnostic) diagnostic.hidden = true;
  }

  function checkServer() {
    var diagnostic = document.getElementById('boot-diagnostic');
    var controller = new AbortController();
    var timer = setTimeout(function () {
      controller.abort();
    }, 4000);

    fetch('/api/health', { cache: 'no-store', signal: controller.signal })
      .then(function (response) {
        return response.ok ? response.json() : null;
      })
      .then(function (data) {
        if (!diagnostic) return;
        diagnostic.textContent = data
          ? 'Servidor conectado (' +
            (data.status || 'ok') +
            '), pero el frontend no arrancó. Probá con Ctrl+F5.'
          : 'El servidor respondió con un error. Reiniciá con start.bat.';
      })
      .catch(function () {
        if (diagnostic) {
          diagnostic.textContent =
            'No hay conexión con el servidor. Ejecutá start.bat o abrí de nuevo index.html.';
        }
      })
      .finally(function () {
        clearTimeout(timer);
      });
  }

  setTimeout(function () {
    if (!document.querySelector('.boot-screen')) return;
    if (location.protocol === 'file:') {
      showRecovery(
        'La app está tardando más de lo esperado',
        'Al abrir index.html con doble clic el kiosco corre en el navegador. Recargá la página o ejecutá start.bat para usar el servidor.',
      );
      hideDiagnostic();
      return;
    }
    showRecovery(
      'La app está tardando más de lo esperado',
      'No pudimos terminar de cargar el kiosco. Revisá que la ventana del servidor siga abierta y volvé a intentar.',
    );
    checkServer();
  }, BOOT_TIMEOUT_MS);
})();
