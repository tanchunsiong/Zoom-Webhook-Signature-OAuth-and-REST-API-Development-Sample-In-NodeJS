require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const crypto = require('crypto');
const fs = require('fs');
const axios = require('axios');
const jwt = require('jsonwebtoken');

const app = express();
const port = process.env.PORT || 4001;

app.use(bodyParser.json(), cors());
app.options('*', cors());

// ============================================================================
// Static Pages
// ============================================================================

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

// ============================================================================
// Webhook Handler
// ============================================================================

app.post('/webhook', (req, res) => {
  const secretToken = process.env.ZOOM_WEBHOOK_SECRET_TOKEN;

  if (req.body.event === 'endpoint.url_validation') {
    const hashForValidate = crypto.createHmac('sha256', secretToken)
      .update(req.body.payload.plainToken)
      .digest('hex');

    res.status(200).json({
      plainToken: req.body.payload.plainToken,
      encryptedToken: hashForValidate
    });
  } else {
    // Save webhook data to file
    fs.writeFile(__dirname + '/webhook.txt', JSON.stringify(req.body, null, 2), 'utf8', (err) => {
      if (err) console.log(err);
    });
    res.status(200).send();
  }
});

app.get('/webhook', (req, res) => {
  fs.readFile(__dirname + '/webhook.txt', 'utf8', (err, data) => {
    if (err) {
      return res.status(200).json({ message: 'No webhook data yet' });
    }
    try {
      res.status(200).json(JSON.parse(data));
    } catch (e) {
      res.status(200).send(data);
    }
  });
});

// ============================================================================
// S2S OAuth - Get Access Token
// ============================================================================

app.get('/s2soauth', async (req, res) => {
  try {
    const clientId = process.env.ZOOM_S2S_CLIENT_ID;
    const clientSecret = process.env.ZOOM_S2S_CLIENT_SECRET;
    const accountId = process.env.ZOOM_S2S_ACCOUNTID;

    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const url = `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${accountId}`;

    const response = await axios.post(url, null, {
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    res.status(200).json(response.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// OAuth Redirect URL Handler
// ============================================================================

app.get('/redirecturlforoauth', async (req, res) => {
  const code = req.query.code;
  const clientId = process.env.ZOOM_OAUTH_USERLEVEL_CLIENT_ID;
  const clientSecret = process.env.ZOOM_OAUTH_USERLEVEL_CLIENT_SECRET;

  if (!code) {
    // No code, return saved token data if exists
    fs.readFile(__dirname + '/oauthtoken.txt', 'utf8', (err, data) => {
      if (err) {
        return res.status(200).json({ message: 'No OAuth data. Add ?code=xxx to exchange authorization code.' });
      }
      try {
        res.status(200).json(JSON.parse(data));
      } catch (e) {
        res.status(200).send(data);
      }
    });
    return;
  }

  try {
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const redirectUri = 'https://nodejs.asdc.cc/redirecturlforoauth';

    const response = await axios.post('https://zoom.us/oauth/token',
      new URLSearchParams({
        code: code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri
      }).toString(),
      {
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    // Save token data
    fs.writeFile(__dirname + '/oauthtoken.txt', JSON.stringify(response.data, null, 2), 'utf8', (err) => {
      if (err) console.log(err);
    });

    res.status(200).json(response.data);
  } catch (error) {
    res.status(500).json({ error: error.response?.data || error.message });
  }
});

// ============================================================================
// OAuth Refresh Token
// ============================================================================

app.get('/oauthrefreshtoken', async (req, res) => {
  const refreshToken = req.query.code;
  const clientId = process.env.ZOOM_OAUTH_USERLEVEL_CLIENT_ID;
  const clientSecret = process.env.ZOOM_OAUTH_USERLEVEL_CLIENT_SECRET;

  if (!refreshToken) {
    return res.status(400).json({ error: 'Missing ?code=refresh_token parameter' });
  }

  try {
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    const response = await axios.post('https://zoom.us/oauth/token',
      new URLSearchParams({
        refresh_token: refreshToken,
        grant_type: 'refresh_token'
      }).toString(),
      {
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    res.status(200).json(response.data);
  } catch (error) {
    res.status(500).json({ error: error.response?.data || error.message });
  }
});

// ============================================================================
// Meeting SDK Token
// ============================================================================

app.get('/meetingsdktoken', (req, res) => {
  res.status(200).json({
    message: 'POST to this endpoint with { meetingNumber, role } to get a signature',
    sdkKey: process.env.ZOOM_SDK_KEY
  });
});

app.post('/meetingsdktoken', (req, res) => {
  const sdkKey = process.env.ZOOM_SDK_KEY;
  const sdkSecret = process.env.ZOOM_SDK_SECRET;
  const meetingNumber = req.body.meetingNumber;
  const role = req.body.role || 0;

  const iat = Math.floor(Date.now() / 1000) - 30;
  const exp = iat + 60 * 60 * 2; // 2 hours

  const payload = {
    sdkKey: sdkKey,
    appKey: sdkKey,
    mn: meetingNumber,
    role: role,
    iat: iat,
    exp: exp,
    tokenExp: exp
  };

  const signature = jwt.sign(payload, sdkSecret, { algorithm: 'HS256' });

  res.status(200).json({
    signature: signature,
    sdkKey: sdkKey
  });
});

// ============================================================================
// Call REST API Example
// ============================================================================

app.get('/callapi', async (req, res) => {
  const accessToken = req.query.accesstoken;

  if (!accessToken || accessToken === 'xxxx') {
    return res.status(200).json({
      message: 'Add ?accesstoken=your_token to call the API',
      example: '/callapi?accesstoken=eyJ...'
    });
  }

  try {
    // Example: Get current user info
    const response = await axios.get('https://api.zoom.us/v2/users/me', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    res.status(200).json(response.data);
  } catch (error) {
    res.status(error.response?.status || 500).json({
      error: error.response?.data || error.message
    });
  }
});

// ============================================================================
// Start Server
// ============================================================================

app.listen(port, () => {
  console.log(`Node.js Sample App running on port ${port}`);
});
