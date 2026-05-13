# Android kiosk shell

This is **not** a second attendance app. It is a tiny full-screen **WebView** that opens your deployed **kiosk-client** URL and passes `nativeDevice` in the query string so the web app stores the tablet hardware id.

## What you change

1. Open `app/src/main/res/values/strings.xml`.
2. Set `kiosk_base_url` to the public `https://` address where you host **kiosk-client** (Railway static site or any host).

## Open in Android Studio

**File → Open…** and select the `kiosk-android` folder. Gradle sync, then Run on a tablet.

`usesCleartextTraffic` is **true** so you can test on `http://` during development. Turn it **off** for production and use HTTPS only.
