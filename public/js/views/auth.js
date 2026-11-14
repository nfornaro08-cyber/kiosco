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

        <div class="auth-demo">
          <p class="auth-demo-title">Cuentas de prueba</p>
          <button type="button" class="demo-chip" data-fill-demo="admin">
            <span>‍</span>
            <span><strong>Administración</strong><small>admin@kiosco.local · Admin1234</small></span>
          </button>
          <button type="button" class="demo-chip" data-fill-demo="student">
            <span></span>
            <span><strong>Alumno demo</strong><small>alumno@kiosco.local · Alumno1234</small></span>
          </button>
        </div>
      </div>

      <div class="auth-panel">
        <div class="auth-card">
          <div class="auth-tabs" role="tablist">
            <button type="button" class="auth-tab is-active" data-mode="login" role="tab">Ingresar</button>
            <button type="button" class="auth-tab" data-mode="register" role="tab">Crear cuenta</button>
          </div>

          <div class="auth-google">
            <a class="btn btn-google btn-block" href="/api/auth/google">
              <span class="btn-google-icon">G</span> Continuar con Google
            </a>
            <p class="auth-google-note">Usá tu cuenta de Google para ingresar o registrarte.</p>
          </div>

          <div class="auth-divider">o</div>

          <form id="auth-form" class="form" novalidate>
            <div class="field" data-field="name" hidden>
              <label for="auth-name">Nombre y apellido</label>
              <input id="auth-name" name="name" autocomplete="name" placeholder="Ana Pérez" maxlength="60" />
              <span class="field-error" data-error="name"></span>
            </div>

            <div class="field">
              <label for="auth-email">Correo electrónico</label>
              <input id="auth-email" name="email" type="email" autocomplete="email" placeholder="vos@escuela.edu.ar" maxlength="160" required />
              <span class="field-error" data-error="email"></span>
            </div>

            <div class="field">
              <label for="auth-password">Contraseña</label>
              <input id="auth-password" name="password" type="password" autocomplete="current-password" placeholder="Mínimo 8 caracteres" maxlength="128" required />
              <span class="field-error" data-error="password"></span>
            </div>

            <p class="form-error" data-form-error hidden></p>

            <button type="submit" class="btn btn-primary btn-block" id="auth-submit">Ingresar</button>
            <p class="auth-note" data-auth-note>¿Primera vez? Creá tu cuenta de alumno en segundos.</p>
          </form>
        </div>

        <p class="auth-foot">Kiosco del Recreo · Etapa 1 · Frontend + API + Backend + Base de datos</p>
      </div>
    </section>
  `;

  const form = container.querySelector('#auth-form');
  const nameField = container.querySelector('[data-field="name"]');
  const nameInput = container.querySelector('#auth-name');
  const emailInput = container.querySelector('#auth-email');
  const passwordInput = container.querySelector('#auth-password');
  const submitButton = container.querySelector('#auth-submit');
  const formError = container.querySelector('[data-form-error]');
  const note = container.querySelector('[data-auth-note]');
  const tabs = [...container.querySelectorAll('.auth-tab')];

  let mode = 'login';

  function setMode(nextMode) {
    mode = nextMode;
    tabs.forEach((tab) => tab.classList.toggle('is-active', tab.dataset.mode === mode));
    nameField.hidden = mode !== 'register';
    nameInput.required = mode === 'register';
    submitButton.textContent = mode === 'register' ? 'Crear cuenta' : 'Ingresar';
    passwordInput.autocomplete = mode === 'register' ? 'new-password' : 'current-password';
    note.textContent =
      mode === 'register'
        ? 'Tu cuenta se crea como alumno. El acceso de administración lo asigna el kiosco.'
        : '¿Primera vez? Creá tu cuenta de alumno en segundos.';
    clearErrors();
  }

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

  tabs.forEach((tab) => tab.addEventListener('click', () => setMode(tab.dataset.mode)));

  container.querySelectorAll('[data-fill-demo]').forEach((button) => {
    button.addEventListener('click', () => {
      const isAdmin = button.dataset.fillDemo === 'admin';
      setMode('login');
      emailInput.value = isAdmin ? 'admin@kiosco.local' : 'alumno@kiosco.local';
      passwordInput.value = isAdmin ? 'Admin1234' : 'Alumno1234';
      emailInput.focus();
    });
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
    if (mode === 'register' && password.length < 8) {
      passwordInput.classList.add('is-invalid');
      container.querySelector('[data-error="password"]').textContent = 'Usá al menos 8 caracteres.';
      passwordInput.focus();
      return;
    }

    setButtonLoading(submitButton, true, mode === 'register' ? 'Creando cuenta...' : 'Ingresando...');
    try {
      const result =
        mode === 'register'
          ? await api.register({ name: nameInput.value.trim(), email, password })
          : await api.login(email, password);
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

  emailInput.focus();
}

export function renderAuthMessage(container) {
  container.innerHTML = `<div class="boot-screen"><p>${escapeHtml('Redirigiendo...')}</p></div>`;
}
