Enter your details / credentials in .env

it should look something like

```
PORT=4001

ZOOM_VIDEO_SDK_KEY="xxxxxx"
ZOOM_VIDEO_SDK_SECRET="yyyyyy"

ZOOM_WEBHOOK_SECRET_TOKEN="zzzzzz"

ZOOM_SDK_KEY="xxxxxx"
ZOOM_SDK_SECRET="yyyyyy"

ZOOM_S2S_CLIENT_ID="xxxxxx"
ZOOM_S2S_CLIENT_SECRET="yyyyyy"
ZOOM_S2S_ACCOUNTID="zzzzzz"

ZOOM_OAUTH_USERLEVEL_CLIENT_ID="xxxxxx"
ZOOM_OAUTH_USERLEVEL_CLIENT_SECRET="yyyyyy"
```

If you don't already have node installed
`sudo apt-get install nodejs npm`

Install dependencies
`npm install`

Run the server
`node server.js`
