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
