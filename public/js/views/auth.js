import { api } from '../api.js';
import { setButtonLoading, toast } from '../ui.js';
import { escapeHtml } from '../utils.js';

export function renderAuth(app, container) {
  container.innerHTML = `
    <section class="auth">
      <div class="auth-brand">
        <a class="brand brand-light" href="#/">
          <span class="brand-mark"></span>
          <span class="brand-text">
            <strong>Kiosco del Recreo</strong>
            <small>Pedidos, stock y recreos</small>
          </span>
        </a>

        <div class="auth-pitch">
          <h1>Tu merienda,<br />sin hacer fila.</h1>
          <p>Consultá el catálogo, reservá lo que querés y elegí en qué recreo lo retirás.</p>
          <ul class="auth-points">
            <li><span></span> Productos, precios y stock actualizados</li>
            <li><span></span> Pedidos organizados por recreo</li>
            <li><span></span> Seguí el estado de tu pedido</li>
          </ul>
        </div>
      </div>

      <div class="auth-panel">
        <div class="auth-card">
          <p class="eyebrow">Acceso al kiosco</p>
          <h2 class="auth-title">Ingresá con tu cuenta del colegio</h2>

          <div class="auth-google" data-google-block hidden>
            <a class="btn btn-google btn-block" href="/api/auth/google/start">
              <span class="btn-google-icon" aria-hidden="true">G</span>
              Ingresar con Google del colegio
            </a>
            <p class="auth-google-note" data-google-note hidden></p>
          </div>

          <div class="auth-divider" data-google-divider hidden><span>o</span></div>

          <button type="button" class="btn btn-ghost btn-block" data-staff-toggle hidden>
            Soy administración: ingresar con correo
          </button>

          <form id="auth-form" class="form" novalidate data-staff-form hidden>
            <div class="field">
              <label for="auth-email">Correo electrónico</label>
              <input id="auth-email" name="email" type="email" autocomplete="email" placeholder="tucorreo@ejemplo.com" maxlength="160" />
              <span class="field-error" data-error="email"></span>
            </div>

            <div class="field">
              <label for="auth-password">Contraseña</label>
              <input id="auth-password" name="password" type="password" autocomplete="current-password" placeholder="••••••••" maxlength="128" />
              <span class="field-error" data-error="password"></span>
            </div>

            <p class="form-error" data-form-error hidden></p>

            <button type="submit" class="btn btn-primary btn-block" id="auth-submit">Ingresar</button>
            <p class="auth-note">Este acceso es para administración y cuentas creadas por el kiosco. Los alumnos ingresan con Google.</p>
          </form>
        </div>

        <p class="auth-foot">Kiosco del Recreo · Etapa 1 · Frontend + API + Backend + Base de datos</p>
      </div>
    </section>
  `;

  const form = container.querySelector('#auth-form');
  const emailInput = container.querySelector('#auth-email');
  const passwordInput = container.querySelector('#auth-password');
  const submitButton = container.querySelector('#auth-submit');
  const formError = container.querySelector('[data-form-error]');
  const staffForm = container.querySelector('[data-staff-form]');
  const staffToggle = container.querySelector('[data-staff-toggle]');
  const googleBlock = container.querySelector('[data-google-block]');
  const googleDivider = container.querySelector('[data-google-divider]');

  function clearErrors() {
    formError.hidden = true;
    formError.textContent = '';
    container.querySelectorAll('[data-error]').forEach((element) => {
      element.textContent = '';
    });
    container.querySelectorAll('.field input').forEach((input) => input.classList.remove('is-invalid'));
  }

  function showErrors(error) {
    const details = error.details ?? {};
    for (const [field, message] of Object.entries(details)) {
      const target = container.querySelector(`[data-error="${field}"]`);
      if (target) {
        target.textContent = message;
        target.closest('.field')?.querySelector('input')?.classList.add('is-invalid');
      }
    }
    if (Object.keys(details).length === 0) {
      formError.textContent = error.message;
      formError.hidden = false;
    }
  }

  staffToggle.addEventListener('click', () => {
    staffToggle.hidden = true;
    staffForm.hidden = false;
    emailInput.focus();
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearErrors();

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email) {
      emailInput.classList.add('is-invalid');
      container.querySelector('[data-error="email"]').textContent = 'Ingresá tu correo.';
      emailInput.focus();
      return;
    }
    if (!password) {
      passwordInput.classList.add('is-invalid');
      container.querySelector('[data-error="password"]').textContent = 'Ingresá tu contraseña.';
      passwordInput.focus();
      return;
    }

    setButtonLoading(submitButton, true, 'Ingresando...');
    try {
      const result = await api.login(email, password);
      toast(`¡Hola, ${result.user.name.split(' ')[0]}!`, 'success');
      await app.onAuthenticated(result.user);
    } catch (error) {
      showErrors(error);
      if (!error.details || Object.keys(error.details).length === 0) {
        formError.textContent = error.message;
        formError.hidden = false;
      }
      toast(error.message, 'error');
    } finally {
      setButtonLoading(submitButton, false);
    }
  });

  // El ingreso con Google es el camino principal; el formulario de correo
  // queda como acceso de administracion. Si Google no esta configurado
  // (falta el .env del servidor) se muestra directamente el formulario.
  (async () => {
    let googleOk = false;
    try {
      const response = await fetch('/api/auth/google/status', { credentials: 'same-origin' });
      if (response.ok) {
        const status = await response.json();
        if (status?.configured) {
          googleOk = true;
          const noteEl = container.querySelector('[data-google-note]');
          if (status.allowedDomain) {
            noteEl.textContent = `Solo cuentas @${status.allowedDomain}.`;
            noteEl.hidden = false;
          }
        }
      }
    } catch {
      // Si /api/auth/google/status no responde, caemos al formulario de correo.
    }

    if (googleOk) {
      googleBlock.hidden = false;
      googleDivider.hidden = false;
      staffToggle.hidden = false;
    } else {
      staffForm.hidden = false;
      emailInput.focus();
    }
  })();
}
