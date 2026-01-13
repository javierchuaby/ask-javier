# Ask Javier

This is a personal project I built to learn and make something special for my girlfriend. It's an AI chat assistant that uses Google's Gemini AI to provide conversational responses, with chat history stored in MongoDB.

## How to run

### Environment Variables

Create a `.env.local` file in the root directory with the following variables:

```env
GOOGLE_GENAI_API_KEY=your_google_generative_ai_api_key_here
MONGODB_URI=your_mongodb_atlas_connection_string_here
```

- **GOOGLE_GENAI_API_KEY**: Your Google Generative AI API key. Get it from [Google AI Studio](https://makersuite.google.com/app/apikey).
- **MONGODB_URI**: Your MongoDB Atlas connection string. Format: `mongodb+srv://username:password@cluster.mongodb.net/ask-javier?retryWrites=true&w=majority`

### Running the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.
