// server.js
// A complete Node.js application for Auth0 Device Authorization Flow.
// To run:
// 1. Save this file as server.js
// 2. Run 'npm install express express-session axios qrcode' in your terminal
// 3. Run 'node server.js'
// 4. Open your browser and navigate to http://localhost:3000

const express = require('express');
const session = require('express-session');
const axios = require('axios');
const qrcode = require('qrcode');

const app = express();
const port = 3000;

// --- Auth0 Configuration ---
const AUTH0_DOMAIN = 'https://jade-sloth-48725.cic-demo-platform.auth0app.com';
const AUTH0_CLIENT_ID = 'kuG2RkTk27M1YPpvtS3oEM5i8I2Wx7wz';
const AUTH0_DEVICE_CODE_URL = `${AUTH0_DOMAIN}/oauth/device/code`;
const AUTH0_TOKEN_URL = `${AUTH0_DOMAIN}/oauth/token`;
const AUTH0_USER_INFO_URL = `${AUTH0_DOMAIN}/userinfo`;
const AUTH0_SCOPE = 'openid profile email offline_access';

// --- Express App Setup ---
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    secret: 'a-very-secret-key-for-session-signing-change-it',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false },
  })
);

app.use((req, res, next) => {
  res.locals.isAuthenticated = !!req.session.accessToken;
  res.locals.user = req.session.user;
  next();
});

// --- View Templates (New Netflix Theme) ---

const layoutTemplate = (body, options = {}) => {
  const { title = 'Netflix Device Auth Demo', isAuthenticated = false } = options;
  return `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Netflix+Sans:wght@300;400;700;800&display=swap" rel="stylesheet">
    <style>
      body { 
        background-color: #111;
        color: #fff;
        font-family: 'Netflix Sans', sans-serif;
      }
      .brand-logo {
        color: #E50914;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: -1px;
        font-size: 1.75rem;
      }
      .btn-red {
        background-color: #E50914;
        transition: background-color 0.2s ease-in-out;
      }
      .btn-red:hover {
        background-color: #f6121d;
      }
      .btn-secondary {
        background-color: rgba(109, 109, 110, 0.7);
        transition: background-color 0.2s ease-in-out;
      }
      .btn-secondary:hover {
        background-color: rgba(109, 109, 110, 0.4);
      }
      .card {
        background-color: rgba(0,0,0,0.75);
        border-radius: 4px;
      }
    </style>
  </head>
  <body>
    <header class="absolute top-0 left-0 w-full z-10 p-4 md:px-12 md:py-6">
        <div class="flex justify-between items-center">
            <a href="/" class="brand-logo">NETFLIX <span class="text-white font-light text-lg">Device Auth by Varun</span></a>
            <div>
            ${
                isAuthenticated
                ? '<a href="/logout" class="btn-red text-white font-bold py-2 px-4 rounded text-sm md:text-base">Logout</a>'
                : '<a href="/login" class="btn-red text-white font-bold py-2 px-4 rounded text-sm md:text-base">Sign In</a>'
            }
            </div>
        </div>
    </header>
    <main>
      ${body}
    </main>
  </body>
  </html>
`;
};

const indexPageTemplate = `
  <div class="relative h-screen w-full flex items-center justify-center">
    <div class="absolute inset-0 bg-black opacity-50"></div>
    <div style="background-image: url('https://assets.nflxext.com/ffe/siteui/vlv3/d15304bda-9778-43f9-8abd-d745c61d5b35/e999be65-950c-4359-9945-3037341c306d/US-en-20231016-popsignuptwoweeks-perspective_alpha_website_large.jpg'); background-size: cover; background-position: center;" class="absolute inset-0"></div>
    <div class="relative z-10 text-center px-4">
      <h1 class="text-4xl md:text-6xl font-extrabold mb-4">Unlimited movies, TV shows, and more</h1>
      <h2 class="text-xl md:text-2xl font-normal mb-8">Ready to watch? Start the device sign-in process now.</h2>
      <a href="/login" class="btn-red text-white font-bold text-lg md:text-2xl py-3 px-6 rounded-md inline-block">Get Started</a>
    </div>
  </div>
`;

const loginPageTemplate = ({ qrCodeUrl, user_code, verification_uri, expires_in, interval, device_code }) => `
  <div class="min-h-screen flex items-center justify-center bg-[#141414] px-4">
    <div class="card p-8 md:p-12 max-w-4xl w-full text-center">
      <h1 class="text-3xl font-bold mb-4">Sign in from another device</h1>
      <p class="text-gray-400 mb-8">Use your phone or computer to link this device to your Netflix account.</p>
      
      <div class="bg-gray-800 p-8 rounded-lg grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
        <div class="text-center md:text-left">
            <p class="text-gray-300 mb-2">1. Go to this URL on another device:</p>
            <a href="${verification_uri}" target="_blank" class="text-blue-400 font-bold text-xl md:text-2xl break-all hover:underline">${verification_uri}</a>
            
            <p class="text-gray-300 mt-8 mb-2">2. Enter this code:</p>
            <p class="text-4xl md:text-5xl font-mono tracking-widest bg-gray-900 p-4 rounded-lg inline-block text-white shadow-lg">${user_code}</p>
        </div>
        <div class="text-center flex flex-col items-center justify-center">
            <p class="text-gray-300 mb-2">Or scan here:</p>
            <div class="p-2 bg-white rounded-lg inline-block border-4 border-gray-600">
                <img src="${qrCodeUrl}" alt="Device Verification QR Code" class="w-56 h-56">
            </div>
        </div>
      </div>

      <div id="status-container" class="mt-8">
          <p class="text-lg text-gray-400">This code expires in <strong id="countdown" class="text-white font-bold">${expires_in}</strong> seconds.</p>
          <p id="polling-status" class="text-gray-500 italic mt-2">Checking for confirmation...</p>
      </div>

      <div id="error-container" class="hidden mt-6 p-4 bg-red-800/50 text-red-300 border border-red-700 rounded-md"></div>
      <div id="success-container" class="hidden mt-6 p-4 bg-green-800/50 text-green-300 border border-green-700 rounded-md">
          Success! Linking your device...
      </div>
    </div>
  </div>

  <script>
    let timeLeft = ${expires_in};
    const pollingInterval = ${interval} * 1000;
    const deviceCode = "${device_code}";

    const countdownEl = document.getElementById('countdown');
    const statusContainer = document.getElementById('status-container');
    const pollingStatusEl = document.getElementById('polling-status');
    const errorContainer = document.getElementById('error-container');
    const successContainer = document.getElementById('success-container');

    const countdownTimer = setInterval(() => {
      timeLeft--;
      countdownEl.textContent = timeLeft;
      if (timeLeft <= 0) {
        clearInterval(countdownTimer);
        clearInterval(pollingTimer);
        statusContainer.style.display = 'none';
        errorContainer.innerHTML = 'This code has expired. <a href="/login" class="font-bold text-blue-400 hover:underline">Please generate a new one.</a>';
        errorContainer.style.display = 'block';
      }
    }, 1000);

    const pollingTimer = setInterval(async () => {
      try {
        const response = await fetch('/poll-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ device_code: deviceCode })
        });
        
        if (!response.ok) throw new Error('Polling request failed.');

        const data = await response.json();

        if (data.status === 'success') {
          clearInterval(pollingTimer);
          clearInterval(countdownTimer);
          pollingStatusEl.style.display = 'none';
          successContainer.style.display = 'block';
          window.location.href = '/profile';
        } else if (data.status === 'expired' || data.status === 'denied') {
          clearInterval(pollingTimer);
          clearInterval(countdownTimer);
          statusContainer.style.display = 'none';
          errorContainer.innerHTML = 'Authorization ' + data.status + '. <a href="/login" class="font-bold text-blue-400 hover:underline">Please try again.</a>';
          errorContainer.style.display = 'block';
        }
      } catch (error) {
        console.error('Polling error:', error);
        pollingStatusEl.textContent = "Error connecting. Retrying...";
      }
    }, pollingInterval);
  </script>
`;

const profilePageTemplate = ({ user }) => `
  <div class="h-screen w-full flex items-center justify-center text-center px-4">
    <div>
      <img src="${user.picture || 'https://assets.nflxext.com/ffe/siteui/vlv3/d15304bda-9778-43f9-8abd-d745c61d5b35/e999be65-950c-4359-9945-3037341c306d/US-en-20231016-popsignuptwoweeks-perspective_alpha_website_large.jpg'}" alt="Profile Picture" class="w-32 h-32 md:w-40 md:h-40 rounded-md mx-auto mb-6 border-4 border-gray-700 shadow-lg">
      <h1 class="text-3xl md:text-5xl font-bold text-white">Welcome, ${user.given_name || user.name || 'User'}!</h1>
      <p class="text-lg text-gray-400 mt-2">${user.email || 'No email provided'}</p>
      <p class="text-green-400 mt-4 text-xl font-semibold">Your device is now linked.</p>
      
      <div class="mt-8">
        <a href="/" class="btn-red text-white font-bold py-3 px-8 rounded-md">Start Watching</a>
      </div>
    </div>
    
    <!-- Autoplaying the authentic Netflix Tudum sound on login -->
    <audio autoplay>
        <source src="https://www.myinstants.com/media/sounds/netflix-tudum-sfx-n-c.mp3" type="audio/mpeg">
        Your browser does not support the audio element.
    </audio>
  </div>
`;


// --- Routes ---

app.get('/', (req, res) => {
  if (req.session.accessToken && req.session.user) {
    const profilePage = profilePageTemplate({ user: req.session.user });
    return res.send(layoutTemplate(profilePage, { title: 'Welcome to Netflix', isAuthenticated: res.locals.isAuthenticated }));
  }
  const body = layoutTemplate(indexPageTemplate, { title: 'Netflix Device Auth Demo by Varun' });
  res.send(body);
});

app.get('/login', (req, res) => {
  if (req.session.accessToken) {
    return res.redirect('/');
  }
  axios.post(AUTH0_DEVICE_CODE_URL, {
    client_id: AUTH0_CLIENT_ID,
    scope: AUTH0_SCOPE,
    audience: AUTH0_USER_INFO_URL
  }, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
  }).then(async response => {
    const { device_code, user_code, verification_uri_complete, verification_uri, expires_in, interval } = response.data;
    const qrCodeUrl = await qrcode.toDataURL(verification_uri_complete, { errorCorrectionLevel: 'H', color: { dark: '#000000FF', light: '#FFFFFFFF' } });
    
    const loginPage = loginPageTemplate({ qrCodeUrl, user_code, verification_uri, expires_in, interval, device_code });
    res.send(layoutTemplate(loginPage, { title: 'Authorize Device' }));
  }).catch(error => {
    console.error("Error getting device code:", error.response ? error.response.data : error.message);
    res.status(500).send("Error starting authorization. Please try again later.");
  });
});

app.post('/poll-token', async (req, res) => {
    const { device_code } = req.body;
    if (!device_code) return res.status(400).json({ error: 'Device code is required.' });

    try {
        const tokenResponse = await axios.post(AUTH0_TOKEN_URL, {
            grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
            device_code,
            client_id: AUTH0_CLIENT_ID,
        }, {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            validateStatus: status => status >= 200 && status < 500 
        });

        const data = tokenResponse.data;

        if (data.error) {
            switch (data.error) {
                case 'authorization_pending': return res.json({ status: 'pending' });
                case 'expired_token': return res.json({ status: 'expired' });
                case 'access_denied': return res.json({ status: 'denied' });
                default: return res.status(500).json({ status: 'error', message: data.error_description });
            }
        }

        if (tokenResponse.status === 200 && data.access_token) {
            req.session.accessToken = data.access_token;
            const userInfoResponse = await axios.get(AUTH0_USER_INFO_URL, {
                headers: { 'Authorization': `Bearer ${req.session.accessToken}` }
            });
            req.session.user = userInfoResponse.data;
            return res.json({ status: 'success' });
        }
        res.status(500).json({ status: 'error', message: 'Unexpected response from Auth0.' });
    } catch (error) {
        console.error("Error polling for token:", error.message);
        res.status(500).json({ status: 'error', message: 'Internal server error.' });
    }
});

app.get('/profile', (req, res) => {
  if (!req.session.accessToken || !req.session.user) {
    return res.redirect('/login');
  }
  const profilePage = profilePageTemplate({ user: req.session.user });
  res.send(layoutTemplate(profilePage, { title: `Welcome, ${req.session.user.given_name || 'User'}`, isAuthenticated: true }));
});

app.get('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            console.error("Session destruction error:", err);
            return res.status(500).send("Could not log you out.");
        }
        const returnTo = encodeURIComponent(`https://netflix-auth-demo-varun.onrender.com/`);
        res.redirect(`${AUTH0_DOMAIN}/v2/logout?client_id=${AUTH0_CLIENT_ID}&returnTo=${returnTo}`);
    });
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
