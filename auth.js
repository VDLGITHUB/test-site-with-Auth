/* ============================================================
   auth.js — Shared Auth0 + Genesys Web Messenger integration
   Loaded by every page on the Horizon Support site
   ============================================================ */

// ── 1. Config ─────────────────────────────────────────────
const AUTH0_DOMAIN   = 'dev-rwcjb1zxrqzhc7ka.au.auth0.com';
const AUTH0_CLIENT_ID = 'wjioQMRSP7BGjqfe22LnaGvSV4woz643';
const REDIRECT_URI   = window.location.origin + window.location.pathname;

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
  'https://apps.' + GC_ENVIRONMENT + '.pure.cloud/genesys-bootstrap/genesys.min.js',
  { environment: GC_ENVIRONMENT, deploymentId: GC_DEPLOYMENT_ID }
);

// ── 3. Inject login wall HTML ─────────────────────────────
document.addEventListener('DOMContentLoaded', function () {
  const wall = document.createElement('div');
  wall.id = 'login-wall';
  wall.innerHTML = `
    <div class="login-wall-inner">
      <div class="login-wall-icon">🔒</div>
      <h2>Sign in to get support</h2>
      <p>Please log in to access live chat and support resources.</p>
      <button onclick="horizonLogin()" class="login-wall-btn">Sign in with Auth0</button>
    </div>
  `;
  document.body.appendChild(wall);

  // Inject login wall styles
  const style = document.createElement('style');
  style.textContent = `
    #login-wall {
      display: none;
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.65);
      z-index: 9999;
      align-items: center;
      justify-content: center;
      backdrop-filter: blur(3px);
    }
    .login-wall-inner {
      background: #fff;
      border-radius: 14px;
      padding: 2.5rem 2rem;
      text-align: center;
      max-width: 360px;
      width: 90%;
      box-shadow: 0 20px 60px rgba(0,0,0,0.25);
    }
    .login-wall-icon { font-size: 2.5rem; margin-bottom: 1rem; }
    .login-wall-inner h2 {
      font-size: 1.4rem;
      font-weight: 700;
      margin-bottom: 0.5rem;
      color: #111827;
    }
    .login-wall-inner p {
      color: #6b7280;
      font-size: 0.95rem;
      margin-bottom: 1.5rem;
    }
    .login-wall-btn {
      background: #1a56db;
      color: #fff;
      border: none;
      padding: 0.75rem 2rem;
      border-radius: 8px;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      width: 100%;
      transition: background 0.15s;
    }
    .login-wall-btn:hover { background: #1240a8; }
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
  `;
  document.head.appendChild(style);
});

// ── 4. Auth0 helpers (using Auth0 SPA SDK) ────────────────
let auth0Client = null;

async function initAuth0() {
  auth0Client = await auth0.createAuth0Client({
    domain: AUTH0_DOMAIN,
    clientId: AUTH0_CLIENT_ID,
    authorizationParams: {
      redirect_uri: REDIRECT_URI,
      audience: 'https://' + AUTH0_DOMAIN + '/api/v2/'
    }
  });

  // Handle redirect back from Auth0 after login
  if (window.location.search.includes('code=') && window.location.search.includes('state=')) {
    await auth0Client.handleRedirectCallback();
    // Clean the URL so the code/state params don't persist
    window.history.replaceState({}, document.title, window.location.pathname);
  }

  const isAuthenticated = await auth0Client.isAuthenticated();

  if (isAuthenticated) {
    await onAuthenticated();
  } else {
    showLoginWall();
  }
}

async function onAuthenticated() {
  // Get the ID token to pass to Genesys
  const claims = await auth0Client.getIdTokenClaims();
  const idToken = claims.__raw; // raw JWT string

  // Get user profile for the nav bar
  const user = await auth0Client.getUser();

  // Pass token to Genesys Web Messenger
  Genesys('command', 'Auth.setToken', { token: idToken });

  // Hide login wall, show user in nav
  hideLoginWall();
  showUserBar(user);
}

function showLoginWall() {
  const wall = document.getElementById('login-wall');
  if (wall) wall.style.display = 'flex';
  // Also hide the Genesys widget until authenticated
  Genesys('command', 'Messenger.close');
}

function hideLoginWall() {
  const wall = document.getElementById('login-wall');
  if (wall) wall.style.display = 'none';
}

function showUserBar(user) {
  const bar = document.getElementById('horizon-user-bar');
  if (!bar) return;
  const nameEl = document.getElementById('horizon-user-name');
  if (nameEl) nameEl.textContent = user.name || user.email;
  bar.style.display = 'flex';
}

// ── 5. Public functions (called from buttons) ─────────────
function horizonLogin() {
  auth0Client.loginWithRedirect();
}

async function horizonLogout() {
  await auth0Client.logout({
    logoutParams: { returnTo: REDIRECT_URI }
  });
}

// ── 6. Kick everything off ────────────────────────────────
window.addEventListener('load', initAuth0);
