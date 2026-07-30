/* ============================================================
   auth.js — Shared Auth0 + Genesys Web Messenger integration
   Using AuthProvider with Implicit Flow (id_token in URL hash)
   ============================================================ */

// ── 1. Config ─────────────────────────────────────────────
const AUTH0_DOMAIN    = 'dev-rwcjb1zxrqzhc7ka.au.auth0.com';
const AUTH0_CLIENT_ID = 'wjioQMRSP7BGjqfe22LnaGvSV4woz643';
const HOMEPAGE        = 'https://vdlgithub.github.io/test-site-with-Auth/';

const GC_DEPLOYMENT_ID = '9bb53d7c-5a6a-40b5-bdfd-2ab2fbd7ddcf';
const GC_ENVIRONMENT   = 'prod-apse2';

const AUTH0_AUTHORIZE  = 'https://' + AUTH0_DOMAIN + '/authorize';
const AUTH0_LOGOUT_URL = 'https://' + AUTH0_DOMAIN + '/v2/logout';

// ── 2. Genesys bootstrap ──────────────────────────────────
(function (g, e, n, es, ys) {
  g['_genesysJs'] = e;
  g[e] = g[e] || function () { (g[e].q = g[e].q || []).push(arguments); };
  g[e].t = 1 * new Date();
  g[e].c = es;
  ys = document.createElement('script');
  ys.async = 1;
  ys.src = n;
  ys.charset = 'utf-8';
  document.head.appendChild(ys);
})(window, 'Genesys',
  'https://apps.mypurecloud.com.au/genesys-bootstrap/genesys.min.js',
  { environment: GC_ENVIRONMENT, deploymentId: GC_DEPLOYMENT_ID }
);

// ── 3. AuthProvider plugin (Implicit Flow) ────────────────
// Genesys calls getAuthCode when it needs to authenticate
// We use implicit flow: Auth0 returns id_token in the URL hash
// No server-side code exchange needed
Genesys('registerPlugin', 'AuthProvider', function (AuthProvider) {

  AuthProvider.registerCommand('getAuthCode', function (e) {
    // Check URL hash for id_token (implicit flow response)
    const hash = window.location.hash;
    const hashParams = new URLSearchParams(hash.replace('#', ''));
    const idToken = hashParams.get('id_token');

    // Also check query string for code (in case of code flow fallback)
    const urlParams = new URLSearchParams(window.location.search);
    const authCode  = urlParams.get('code');

    if (idToken) {
      console.log('AuthProvider: providing id_token to Genesys (implicit flow) ✅');
      e.resolve({
        authCode: idToken,
        redirectUri: HOMEPAGE
      });

      // Clean up hash and update UI after token is handed to Genesys
      setTimeout(function () {
        window.history.replaceState({}, document.title, window.location.pathname);
        showUserBar({});
        const returnTo = localStorage.getItem('auth0_return_to');
        localStorage.removeItem('auth0_return_to');
        if (returnTo && returnTo !== HOMEPAGE && !returnTo.includes('#')) {
          window.location.replace(returnTo);
        }
      }, 500);

    } else if (authCode) {
      console.log('AuthProvider: providing auth code to Genesys ✅');
      e.resolve({
        authCode: authCode,
        redirectUri: HOMEPAGE
      });

      setTimeout(function () {
        window.history.replaceState({}, document.title, window.location.pathname);
        showUserBar({});
        const returnTo = localStorage.getItem('auth0_return_to');
        localStorage.removeItem('auth0_return_to');
        if (returnTo && returnTo !== HOMEPAGE && !returnTo.includes('?code=')) {
          window.location.replace(returnTo);
        }
      }, 500);

    } else {
      console.log('AuthProvider: no token or code found, rejecting');
      e.reject('No auth token available — user must sign in first');
    }
  });

  AuthProvider.registerCommand('logout', function (e) {
    window.history.replaceState({}, document.title, window.location.pathname);
    const logoutUrl = AUTH0_LOGOUT_URL
      + '?client_id=' + AUTH0_CLIENT_ID
      + '&returnTo=' + encodeURIComponent(HOMEPAGE);
    window.location.assign(logoutUrl);
    e.resolve();
  });

  AuthProvider.ready();
});

// ── 4. Inject styles ──────────────────────────────────────
document.addEventListener('DOMContentLoaded', function () {
  const style = document.createElement('style');
  style.textContent = `
    #horizon-user-bar { display:none; align-items:center; gap:0.75rem; font-size:0.875rem; }
    #horizon-user-bar span { color:#374151; }
    #horizon-signout-btn { background:none; border:1.5px solid #e5e7eb; border-radius:6px;
      padding:0.3rem 0.75rem; font-size:0.8rem; color:#6b7280; cursor:pointer; font-weight:500; }
    #horizon-signout-btn:hover { background:#f9fafb; color:#111827; }
    #chat-signin-toast { display:none; position:fixed; bottom:90px; right:24px; background:#1e293b;
      color:#fff; padding:0.85rem 1.25rem; border-radius:10px; font-size:0.9rem; z-index:9999;
      box-shadow:0 8px 24px rgba(0,0,0,0.2); align-items:center; gap:0.75rem; max-width:280px; }
    #chat-signin-toast button { background:#1a56db; color:#fff; border:none; border-radius:6px;
      padding:0.35rem 0.85rem; font-size:0.85rem; font-weight:600; cursor:pointer; white-space:nowrap; }
    #chat-signin-toast button:hover { background:#1240a8; }
  `;
  document.head.appendChild(style);

  const toast = document.createElement('div');
  toast.id = 'chat-signin-toast';
  toast.innerHTML = '<span>Sign in to start a live chat</span><button onclick="horizonLogin()">Sign in</button>';
  document.body.appendChild(toast);
});

// ── 5. Page load ──────────────────────────────────────────
window.addEventListener('load', function () {
  const hash = window.location.hash;
  const hashParams = new URLSearchParams(hash.replace('#', ''));
  const idToken = hashParams.get('id_token');
  const urlParams = new URLSearchParams(window.location.search);
  const authCode = urlParams.get('code');

  if (idToken || authCode) {
    // Returned from Auth0 — show user bar
    showUserBar({});
  } else {
    showSignInButton();
    Genesys('subscribe', 'Messenger.opened', function () {
      const h = window.location.hash;
      const p = new URLSearchParams(window.location.search);
      if (!new URLSearchParams(h.replace('#', '')).get('id_token') && !p.get('code')) {
        Genesys('command', 'Messenger.close');
        showChatToast();
      }
    });
  }
});

// ── 6. UI helpers ─────────────────────────────────────────
function showSignInButton() {
  const btn = document.getElementById('horizon-signin-btn');
  if (btn) btn.style.display = 'inline-flex';
  const bar = document.getElementById('horizon-user-bar');
  if (bar) bar.style.display = 'none';
}

function showUserBar(user) {
  const btn = document.getElementById('horizon-signin-btn');
  if (btn) btn.style.display = 'none';
  const bar = document.getElementById('horizon-user-bar');
  if (!bar) return;
  bar.style.display = 'flex';
}

function showChatToast() {
  const toast = document.getElementById('chat-signin-toast');
  if (!toast) return;
  toast.style.display = 'flex';
  setTimeout(function () { toast.style.display = 'none'; }, 6000);
}

// ── 7. Public functions ───────────────────────────────────
function horizonLogin() {
  localStorage.setItem('auth0_return_to', window.location.href);
  // Implicit flow: response_type=id_token returns token directly in URL hash
  // No server-side code exchange — Genesys uses the token directly
  const nonce = Math.random().toString(36).substring(2);
  sessionStorage.setItem('auth0_nonce', nonce);
  const loginUrl = AUTH0_AUTHORIZE
    + '?client_id=' + AUTH0_CLIENT_ID
    + '&response_type=id_token'
    + '&redirect_uri=' + encodeURIComponent(HOMEPAGE)
    + '&scope=' + encodeURIComponent('openid profile email')
    + '&nonce=' + nonce
    + '&response_mode=fragment';
  window.location.assign(loginUrl);
}

function horizonLogout() {
  localStorage.removeItem('auth0_return_to');
  sessionStorage.removeItem('auth0_nonce');
  window.history.replaceState({}, document.title, window.location.pathname);
  const logoutUrl = AUTH0_LOGOUT_URL
    + '?client_id=' + AUTH0_CLIENT_ID
    + '&returnTo=' + encodeURIComponent(HOMEPAGE);
  window.location.assign(logoutUrl);
}
