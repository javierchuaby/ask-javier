import { MongoClient, Db } from 'mongodb';

// #region agent log
if (typeof fetch !== 'undefined') {
  const originalUri = process.env.MONGODB_URI || '';
  const hasSpecialChars = /[!@#$%^&*()+=\[\]{};':"\\|,.<>\/?]/.test(originalUri);
  const passwordMatch = originalUri.match(/:\/([^@]+)@/);
  const passwordLength = passwordMatch ? passwordMatch[1].length : 0;
  const isUrlEncoded = originalUri.includes('%');
  fetch('http://127.0.0.1:7243/ingest/31fd7dde-0c45-4b36-b17b-4dbe8e4310c4',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/mongodb.ts:3',message:'Checking MONGODB_URI env var',data:{hasUri:!!process.env.MONGODB_URI,uriLength:process.env.MONGODB_URI?.length||0,uriPrefix:process.env.MONGODB_URI?.substring(0,20)||'undefined',hasSpecialChars,passwordLength,isUrlEncoded},timestamp:Date.now(),sessionId:'debug-session',runId:'run3',hypothesisId:'F'})}).catch(()=>{});
}
// #endregion

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
        // #region agent log
        if (typeof fetch !== 'undefined') fetch('http://127.0.0.1:7243/ingest/31fd7dde-0c45-4b36-b17b-4dbe8e4310c4',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/mongodb.ts:20',message:'URL encoded password',data:{username,passwordLength:password.length,encodedLength:encodedPassword.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run5',hypothesisId:'F'})}).catch(()=>{});
        // #endregion
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
  // #region agent log
  if (typeof fetch !== 'undefined') fetch('http://127.0.0.1:7243/ingest/31fd7dde-0c45-4b36-b17b-4dbe8e4310c4',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/mongodb.ts:28',message:'Added authSource=admin to URI',data:{hasQuery,separator},timestamp:Date.now(),sessionId:'debug-session',runId:'run4',hypothesisId:'E'})}).catch(()=>{});
  // #endregion
}

// #region agent log
if (typeof fetch !== 'undefined') {
  const uriMasked = uri.replace(/\/\/([^:]+):([^@]+)@/, '//$1:***@');
  const uriParts = uri.split('?');
  const baseUri = uriParts[0];
  const queryString = uriParts[1] || '';
  const dbName = baseUri.split('/').pop() || '';
  fetch('http://127.0.0.1:7243/ingest/31fd7dde-0c45-4b36-b17b-4dbe8e4310c4',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/mongodb.ts:22',message:'URI format check',data:{uriMasked,hasMongodb:uri.includes('mongodb'),hasSrv:uri.includes('mongodb+srv'),hasAtlas:uri.includes('mongodb.net'),hasAuthSource:uri.includes('authSource'),hasDbName:dbName.length>0&&!dbName.includes('?'),dbName,queryString,uriEndsWithSlash:uri.endsWith('/')},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'B'})}).catch(()=>{});
}
// #endregion

const options = {};

let client: MongoClient;
let clientPromise: Promise<MongoClient>;

if (process.env.NODE_ENV === 'development') {
  // In development mode, use a global variable so that the value
  // is preserved across module reloads caused by HMR (Hot Module Replacement).
  let globalWithMongo = global as typeof globalThis & {
    _mongoClientPromise?: Promise<MongoClient>;
  };

  if (!globalWithMongo._mongoClientPromise) {
    // #region agent log
    const finalUriMasked = uri.replace(/:\/\/([^:]+):([^@]+)@/, '//$1:***@');
    if (typeof fetch !== 'undefined') fetch('http://127.0.0.1:7243/ingest/31fd7dde-0c45-4b36-b17b-4dbe8e4310c4',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/mongodb.ts:52',message:'Final URI before connection',data:{finalUriMasked,uriLength:uri.length,hasAuthSource:uri.includes('authSource'),hasEncodedPassword:uri.includes('%')},timestamp:Date.now(),sessionId:'debug-session',runId:'run6',hypothesisId:'G'})}).catch(()=>{});
    // #endregion
    client = new MongoClient(uri, options);
    // #region agent log
    if (typeof fetch !== 'undefined') fetch('http://127.0.0.1:7243/ingest/31fd7dde-0c45-4b36-b17b-4dbe8e4310c4',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/mongodb.ts:56',message:'Creating MongoClient',data:{nodeEnv:process.env.NODE_ENV},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    globalWithMongo._mongoClientPromise = client.connect().catch((err) => {
      // #region agent log
      if (typeof fetch !== 'undefined') {
        const errorDetails: any = {
          errorName: err?.name,
          errorMessage: err?.message,
          errorCode: err?.code,
          errorCodeName: err?.codeName,
        };
        // Check if it's a credentials issue
        if (err?.message?.includes('authentication failed')) {
          errorDetails.suggestions = [
            'Check username and password in connection string',
            'Verify user exists in MongoDB Atlas',
            'Check if password has special characters (needs URL encoding)',
            'Verify user has proper database permissions',
            'Check if user authentication database is correct (should be admin for database users)'
          ];
        }
        fetch('http://127.0.0.1:7243/ingest/31fd7dde-0c45-4b36-b17b-4dbe8e4310c4',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/mongodb.ts:41',message:'MongoClient connection error',data:errorDetails,timestamp:Date.now(),sessionId:'debug-session',runId:'run3',hypothesisId:'C'})}).catch(()=>{});
      }
      // #endregion
      throw err;
    });
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
  // #region agent log
  if (typeof fetch !== 'undefined') fetch('http://127.0.0.1:7243/ingest/31fd7dde-0c45-4b36-b17b-4dbe8e4310c4',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/mongodb.ts:35',message:'getDb called',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
  // #endregion
  try {
    const client = await clientPromise;
    // #region agent log
    if (typeof fetch !== 'undefined') fetch('http://127.0.0.1:7243/ingest/31fd7dde-0c45-4b36-b17b-4dbe8e4310c4',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/mongodb.ts:38',message:'Client connected, getting db',data:{dbName:'ask-javier'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    return client.db('ask-javier-db');
  } catch (error: any) {
    // #region agent log
    if (typeof fetch !== 'undefined') fetch('http://127.0.0.1:7243/ingest/31fd7dde-0c45-4b36-b17b-4dbe8e4310c4',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/mongodb.ts:42',message:'getDb error',data:{errorName:error?.name,errorMessage:error?.message,errorCode:error?.code,errorCodeName:error?.codeName},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    throw error;
  }
}
