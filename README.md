# Ask Javier

This is a personal project I built to learn and make something special for my girlfriend. It's an AI chat assistant that uses Google's Gemini AI to provide conversational responses, with chat history stored in MongoDB. The app is protected with Google OAuth authentication and email whitelisting.

## How to run

### Environment Variables

Create a `.env.local` file in the root directory with the following variables:

```env
# Google Generative AI
GOOGLE_GENAI_API_KEY=your_google_generative_ai_api_key_here

# MongoDB
MONGODB_URI=your_mongodb_atlas_connection_string_here

# NextAuth Authentication
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-key-here-generate-with-openssl-rand-base64-32

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Allowed emails (comma-separated, no spaces)
ALLOWED_EMAILS=email1@gmail.com,email2@gmail.com
```

#### Environment Variable Details

- **GOOGLE_GENAI_API_KEY**: Your Google Generative AI API key. Get it from [Google AI Studio](https://makersuite.google.com/app/apikey).
- **MONGODB_URI**: Your MongoDB Atlas connection string. Format: `mongodb+srv://username:password@cluster.mongodb.net/ask-javier?retryWrites=true&w=majority`
- **NEXTAUTH_URL**: The base URL of your application. Use `http://localhost:3000` for development, or your production URL (e.g., `https://your-app.vercel.app`) for production.
- **NEXTAUTH_SECRET**: A random secret key for encrypting session tokens. Generate one using: `openssl rand -base64 32`
- **GOOGLE_CLIENT_ID** and **GOOGLE_CLIENT_SECRET**: OAuth credentials from Google Cloud Console (see setup instructions below).
- **ALLOWED_EMAILS**: Comma-separated list of email addresses that are allowed to access the app. Only these emails will be able to sign in.

### Setting Up Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the **Google+ API** (or **Google Identity Services API**)
4. Go to **Credentials** → **Create Credentials** → **OAuth client ID**
5. Choose **Web application** as the application type
6. Add authorized redirect URIs:
   - For development: `http://localhost:3000/api/auth/callback/google`
   - For production: `https://your-domain.vercel.app/api/auth/callback/google`
7. Copy the **Client ID** and **Client Secret** to your `.env.local` file

### Running the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

### Deployment on Vercel

When deploying to Vercel:

1. Add all environment variables in the Vercel dashboard (Settings → Environment Variables)
2. Make sure `NEXTAUTH_URL` is set to your production URL (e.g., `https://your-app.vercel.app`)
3. Update the Google OAuth redirect URI in Google Cloud Console to include your production URL
4. The app will automatically deploy and be accessible 24/7 without needing to run it locally
