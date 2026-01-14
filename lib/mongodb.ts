import { MongoClient, Db } from 'mongodb';

if (!process.env.MONGODB_URI) {
  throw new Error('Please add your Mongo URI to .env.local');
}

let uri = process.env.MONGODB_URI;

// Fix: URL encode password if it contains special characters
if (uri) {
  // Extract username and password from connection string (format: mongodb+srv://username:password@host)
  // Pattern matches: username:password@host
  const credentialsMatch = uri.match(/:\/\/([^@]+)@/);
  if (credentialsMatch) {
    const credentials = credentialsMatch[1];
    const colonIndex = credentials.indexOf(':');
    if (colonIndex > 0) {
      const username = credentials.substring(0, colonIndex);
      const password = credentials.substring(colonIndex + 1);
      // Check if password needs encoding (contains characters that aren't already encoded)
      const needsEncoding = /[^a-zA-Z0-9._~-]/.test(password) && !password.includes('%');
      if (needsEncoding) {
        const encodedPassword = encodeURIComponent(password);
        uri = uri.replace(/:\/\/([^@]+)@/, `://${username}:${encodedPassword}@`);
      }
    }
  }
}

// Fix: Add authSource=admin if missing (required for MongoDB Atlas database users)
if (uri && !uri.includes('authSource=')) {
  // Check if URI already has query parameters
  const hasQuery = uri.includes('?');
  // Check if URI ends with / or has query params after /
  const endsWithSlash = uri.match(/\/[^?]*$/)?.[0] === uri.split('?')[0].split('@')[1]?.split('/').pop() + '/';
  const separator = hasQuery ? '&' : (endsWithSlash ? '' : '/?');
  uri = `${uri}${separator}authSource=admin`;
}

const options: {
  tls?: boolean;
  tlsAllowInvalidCertificates?: boolean;
  serverSelectionTimeoutMS?: number;
} = {
  tls: true,
  serverSelectionTimeoutMS: 10000, // 10 seconds timeout
};

let client: MongoClient;
let clientPromise: Promise<MongoClient>;

if (process.env.NODE_ENV === 'development') {
  // In development mode, use a global variable so that the value
  // is preserved across module reloads caused by HMR (Hot Module Replacement).
  const globalWithMongo = global as typeof globalThis & {
    _mongoClientPromise?: Promise<MongoClient>;
  };

  if (!globalWithMongo._mongoClientPromise) {
    client = new MongoClient(uri, options);
    globalWithMongo._mongoClientPromise = client.connect();
  }
  clientPromise = globalWithMongo._mongoClientPromise;
} else {
  // In production mode, it's best to not use a global variable.
  client = new MongoClient(uri, options);
  clientPromise = client.connect();
}

// Export a module-scoped MongoClient promise. By doing this in a
// separate module, the client can be shared across functions.
export default clientPromise;

export async function getDb(): Promise<Db> {
  const client = await clientPromise;
  return client.db('ask-javier-db');
}
