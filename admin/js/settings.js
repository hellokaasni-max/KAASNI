// admin/js/settings.js
if (requireAdminSession()) {
  loadSettings();
}

const SETTINGS_FIELDS = ['site_name', 'site_tagline', 'footer_about', 'contact_email', 'contact_phone', 'instagram_url', 'facebook_url'];

async function loadSettings() {
  try {
    const { settings } = await adminRequest('/settings');
    SETTINGS_FIELDS.forEach((key) => {
      const el = qs(`#${key}`);
      if (el) el.value = settings[key] || '';
    });
  } catch (e) {
    console.error(e);
  }
}

qs('#settings-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const errorEl = qs('#settings-error');
  const successEl = qs('#settings-success');
  errorEl.style.display = 'none';
  successEl.style.display = 'none';

  const payload = {};
  SETTINGS_FIELDS.forEach((key) => { payload[key] = qs(`#${key}`).value.trim(); });

  try {
    await adminRequest('/settings', { method: 'PUT', body: payload });
    successEl.style.display = 'block';
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.style.display = 'block';
  }
});

qs('#password-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const errorEl = qs('#password-error');
  const successEl = qs('#password-success');
  errorEl.style.display = 'none';
  successEl.style.display = 'none';

  try {
    await adminRequest('/auth/change-password', {
      method: 'POST',
      body: {
        current_password: qs('#current_password').value,
        new_password: qs('#new_password').value,
      },
    });
    successEl.style.display = 'block';
    e.target.reset();
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.style.display = 'block';
  }
});
