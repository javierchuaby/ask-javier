# Ask Javier

This is a personal project I built to learn and make something special for my girlfriend. It's an AI chat assistant that uses Google's Gemini AI to provide conversational responses, enriched with **Hybrid RAG (Retrieval-Augmented Generation)** to recall past Telegram conversations. The app is protected with Google OAuth authentication and email whitelisting.

## Setup & Configuration

### Environment Variables

Create a `.env.local` file in the root directory with the following variables:

#### Core Authentication & Database
| Variable               | Description                                 |
| ---------------------- | ------------------------------------------- |
| `GOOGLE_GENAI_API_KEY` | Google Generative AI API key                |
| `MONGODB_URI`          | MongoDB Atlas connection string             |
| `NEXTAUTH_URL`         | `http://localhost:3000` (or production URL) |
| `NEXTAUTH_SECRET`      | Generate with `openssl rand -base64 32`     |
| `GOOGLE_CLIENT_ID`     | Google OAuth client ID                      |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret                  |
| `ALLOWED_EMAILS`       | Comma-separated whitelisted emails          |

#### SoCLaaS RAG (Retrieval-Augmented Generation)
| Variable                  | Default                                 | Description |
| ------------------------- | --------------------------------------- | ----------- |
| `SOCLAAS_BASE_URL`        | `https://soclaas-api.comp.nus.edu.sg/v1`| NUS AI Gateway Endpoint |
| `SOCLAAS_API_KEY`         | (Required for RAG)                      | SoCLaaS API Key |
| `SOCLAAS_MODEL`           | `llama3.1:8b`                           | Model used for conversation chunk summarization |
| `SOCLAAS_EMBEDDING_MODEL` | `bge-m3`                                | Model used for vector embeddings (1024 dimensions) |

#### Personalization & Privacy
| Variable                     | Description |
| ---------------------------- | ----------- |
| `NEXT_PUBLIC_BOT_NAME`       | Name of the assistant (e.g. `BotName`) |
| `NEXT_PUBLIC_USER_NAME`      | First name of the user (e.g. `UserName`) |
| `NEXT_PUBLIC_USER_FULL_NAME` | Full name of the user |
| `BOT_RELATIONSHIP`           | Relationship context (e.g. `girlfriend`) |
| `TELEGRAM_TARGET_CHAT`       | The phone number or chat ID to export history from (e.g. `+1234567890`) |
| `REDACT_NAMES`               | Comma-separated list of names/places to scrub from chat history to protect privacy (e.g. `john,doe,City`) |

## Data Ingestion Pipeline

To populate the assistant's memory with your past Telegram chat history, run the ingestion pipeline. This script will download the history, redact sensitive names, summarize the chunks, generate embeddings, and upload them to MongoDB:

```bash
pnpm ingest
```

### MongoDB Atlas Search Configuration

Because the RAG pipeline uses MongoDB's `$rankFusion` to combine semantic and keyword search, you **must** create two separate indexes in your `chat_history` collection via the MongoDB Atlas UI:

1. **Atlas Search Index (Text Search)**
   - Name: `hybrid_index`
   - JSON Definition:
     ```json
     {
       "mappings": {
         "dynamic": false,
         "fields": {
           "dialogueText": { "analyzer": "lucene.standard", "type": "string" },
           "summary": { "analyzer": "lucene.standard", "type": "string" },
           "text": { "analyzer": "lucene.standard", "type": "string" },
           "userId": { "type": "token" }
         }
       }
     }
     ```

2. **Atlas Vector Search Index (Vector Search)**
   - Name: `vector_index`
   - JSON Definition:
     ```json
     {
       "fields": [
         {
           "numDimensions": 1024,
           "path": "embedding",
           "similarity": "cosine",
           "type": "vector"
         },
         { "path": "userId", "type": "filter" },
         { "path": "chunkId", "type": "filter" },
         { "path": "startDate", "type": "filter" }
       ]
     }
     ```

## Running the App

```bash
pnpm dev
```
Open [http://localhost:3000](http://localhost:3000)
