/* ============================================================
   auth.js — Shared Auth0 + Genesys Web Messenger integration
   Loaded by every page on the Horizon Support site
   ============================================================ */

// ── 1. Config ─────────────────────────────────────────────
const AUTH0_DOMAIN    = 'dev-rwcjb1zxrqzhc7ka.au.auth0.com';
const AUTH0_CLIENT_ID = 'wjioQMRSP7BGjqfe22LnaGvSV4woz643';
const HOMEPAGE        = 'https://vdlgithub.github.io/test-site-with-Auth/';

const GC_DEPLOYMENT_ID = '9bb53d7c-5a6a-40b5-bdfd-2ab2fbd7ddcf';
const GC_ENVIRONMENT   = 'prod-apse2';

// ── 2. Inject Genesys bootstrap ───────────────────────────
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

// ── 3. Inject styles ──────────────────────────────────────
document.addEventListener('DOMContentLoaded', function () {
  const style = document.createElement('style');
  style.textContent = `
    #horizon-user-bar {
      display: none;
      align-items: center;
      gap: 0.75rem;
      font-size: 0.875rem;
    }
    #horizon-user-bar span { color: #374151; }
    #horizon-signout-btn {
      background: none;
      border: 1.5px solid #e5e7eb;
      border-radius: 6px;
      padding: 0.3rem 0.75rem;
      font-size: 0.8rem;
      color: #6b7280;
      cursor: pointer;
      font-weight: 500;
    }
    #horizon-signout-btn:hover { background: #f9fafb; color: #111827; }
    #chat-signin-toast {
      display: none;
      position: fixed;
      bottom: 90px;
      right: 24px;
      background: #1e293b;
      color: #fff;
      padding: 0.85rem 1.25rem;
      border-radius: 10px;
      font-size: 0.9rem;
      z-index: 9999;
      box-shadow: 0 8px 24px rgba(0,0,0,0.2);
      align-items: center;
      gap: 0.75rem;
      max-width: 280px;
    }
    #chat-signin-toast button {
      background: #1a56db;
      color: #fff;
      border: none;
      border-radius: 6px;
      padding: 0.35rem 0.85rem;
      font-size: 0.85rem;
      font-weight: 600;
      cursor: pointer;
      white-space: nowrap;
    }
    #chat-signin-toast button:hover { background: #1240a8; }
  `;
  document.head.appendChild(style);

  const toast = document.createElement('div');
  toast.id = 'chat-signin-toast';
  toast.innerHTML = `
    <span>Sign in to start a live chat</span>
    <button onclick="horizonLogin()">Sign in</button>
  `;
  document.body.appendChild(toast);
});

// ── 4. Auth0 logic ────────────────────────────────────────
let auth0Client = null;

async function initAuth0() {
  auth0Client = await auth0.createAuth0Client({
    domain: AUTH0_DOMAIN,
    clientId: AUTH0_CLIENT_ID,
    authorizationParams: {
      redirect_uri: HOMEPAGE
    }
  });

  // Back from Auth0 login
  if (window.location.search.includes('code=') && window.location.search.includes('state=')) {
    await auth0Client.handleRedirectCallback();

    const returnTo = localStorage.getItem('auth0_return_to');
    localStorage.removeItem('auth0_return_to');

    if (returnTo && returnTo !== window.location.href) {
      window.location.replace(returnTo);
      return;
    }

    window.history.replaceState({}, document.title, window.location.pathname);
  }

  const isAuthenticated = await auth0Client.isAuthenticated();

  if (isAuthenticated) {
    // Show user bar immediately — don't wait for Genesys
    const user = await auth0Client.getUser();
    showUserBar(user);

    // Pass token to Genesys once it's ready
    const claims = await auth0Client.getIdTokenClaims();
    const idToken = claims.__raw;
    setGenesysToken(idToken);
  } else {
    showSignInButton();
    // Intercept widget open attempts for unauthenticated users
    Genesys('subscribe', 'Messenger.opened', function () {
      Genesys('command', 'Messenger.close');
      showChatToast();
    });
  }
}

// Wait for Genesys to be ready then set the token
function setGenesysToken(idToken) {
  // Genesys may not be fully initialised yet — subscribe to ready event
  Genesys('subscribe', 'Messenger.ready', function () {
    Genesys('command', 'Auth.setToken', { token: idToken });
  });

  // Also try immediately in case it's already ready
  try {
    Genesys('command', 'Auth.setToken', { token: idToken });
  } catch (e) {
    // Not ready yet — the subscribe above will handle it
  }
}

// ── 5. UI helpers ─────────────────────────────────────────
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
  const nameEl = document.getElementById('horizon-user-name');
  if (nameEl) nameEl.textContent = user.name || user.email;
  bar.style.display = 'flex';
}

function showChatToast() {
  const toast = document.getElementById('chat-signin-toast');
  if (!toast) return;
  toast.style.display = 'flex';
  setTimeout(() => { toast.style.display = 'none'; }, 6000);
}

// ── 6. Public functions ───────────────────────────────────
function horizonLogin() {
  localStorage.setItem('auth0_return_to', window.location.href);
  auth0Client.loginWithRedirect();
}

async function horizonLogout() {
  await auth0Client.logout({
    logoutParams: { returnTo: HOMEPAGE }
  });
}

// ── 7. Kick everything off ────────────────────────────────
window.addEventListener('load', initAuth0);
