# YouTube OAuth Setup Guide

To use the **YouTube Upload Manager**, you must configure a Google Cloud Project with the YouTube Data API v3 enabled and create OAuth 2.0 credentials. This guide walks you through the process.

## Prerequisites
- A Google account.
- The YouTube channel(s) you wish to manage must be linked to this Google account.

## Step 1: Create a Google Cloud Project
1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Click the project dropdown in the top navigation bar and select **New Project**.
3. Name your project (e.g., `yt-upload-manager-dev`) and click **Create**.
4. Once created, ensure your new project is selected in the dropdown.

## Step 2: Enable the YouTube Data API v3
1. In the left sidebar, navigate to **APIs & Services > Library**.
2. Search for **"YouTube Data API v3"**.
3. Click on the result and select **Enable**.

## Step 3: Configure the OAuth Consent Screen
1. Navigate to **APIs & Services > OAuth consent screen**.
2. Select **External** (unless you are a Google Workspace user restricting this to your org) and click **Create**.
3. **App Information**: Fill in the required fields (App name, User support email, Developer contact email). You can name the app "YouTube Upload Manager".
4. **Scopes**: Click **Add or Remove Scopes**. You must add the following scope for the app to function:
   - `https://www.googleapis.com/auth/youtube.upload`
   *(Note: For managing streams, you may also need `https://www.googleapis.com/auth/youtube`)*
5. **Test Users**: Since your app is likely in "Testing" mode, you **MUST** add the email addresses of the YouTube accounts you intend to manage here. If you skip this, the OAuth flow will block you.
6. Click **Save and Continue** until complete.

## Step 4: Create OAuth Credentials
1. Navigate to **APIs & Services > Credentials**.
2. Click **Create Credentials** and select **OAuth client ID**.
3. Select **Application type**: 
   - If running the **Tauri Desktop App**, select **Desktop App** or **iOS/Android** depending on how the OAuth flow is implemented. Usually, **Desktop App** works best for local redirect URIs.
   - If running the **Web Version**, select **Web application** and add your authorized redirect URIs (e.g., `http://localhost:4321/auth/callback`).
4. Click **Create**.
5. A modal will appear with your **Client ID** and **Client Secret**. 
6. **Copy both of these**. You will need to paste them into the "Add Channel" modal in the YouTube Upload Manager UI.

## Step 5: Link in the App
1. Open the YouTube Upload Manager.
2. Navigate to **Channel Management**.
3. Click **Add New Channel**.
4. Paste your **Client ID** and **Client Secret** into the form, along with the channel name and handle.
5. Save and then **Activate** the channel.

## Important Notes on Production Deployment
If you intend to deploy the web version of this application publicly:
- You will need to go through Google's **OAuth Verification Process** to move the consent screen out of "Testing" mode.
- Verification requires explaining why you need the `youtube.upload` scope and providing a video demonstrating the app's usage.
- Until verified, only the specific "Test Users" you added in Step 3 will be able to log in, and they will see a prominent "Google hasn't verified this app" warning.