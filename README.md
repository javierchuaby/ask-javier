# Ask Javier

This is a personal project I built to learn and make something special for my girlfriend. It's an AI chat assistant that uses Google's Gemini AI to provide conversational responses, with chat history stored in MongoDB. The app is protected with Google OAuth authentication and email whitelisting.

## How to run

### Environment Variables

Create a `.env.local` file in the root directory with the following variables:

| Variable               | Description                                 |
| ---------------------- | ------------------------------------------- |
| `GOOGLE_GENAI_API_KEY` | Google Generative AI API key                |
| `MONGODB_URI`          | MongoDB Atlas connection string             |
| `NEXTAUTH_URL`         | `http://localhost:3000` (or production URL) |
| `NEXTAUTH_SECRET`      | Generate with `openssl rand -base64 32`     |
| `GOOGLE_CLIENT_ID`     | Google OAuth client ID                      |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret                  |
| `ALLOWED_EMAILS`       | Comma-separated whitelisted emails          |

### Running the Development Server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000)
