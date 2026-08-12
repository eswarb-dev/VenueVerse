const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const FIREBASE_SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';

let cachedToken: { accessToken: string; expiresAt: number } | null = null;

export function getFirebaseProjectId() {
  const projectId = Deno.env.get('FIREBASE_PROJECT_ID')?.trim();
  if (!projectId) throw new Error('FIREBASE_PROJECT_ID is not configured.');
  return projectId;
}

export async function getFirebaseAccessToken() {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.expiresAt - 300 > now) {
    return cachedToken.accessToken;
  }

  const clientEmail = Deno.env.get('FIREBASE_CLIENT_EMAIL')?.trim();
  const privateKey = normalizePrivateKey(Deno.env.get('FIREBASE_PRIVATE_KEY'));

  if (!clientEmail || !privateKey) {
    throw new Error('Firebase service account secrets are not configured.');
  }

  const assertion = await createServiceAccountAssertion({
    clientEmail,
    privateKey,
    now
  });

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion
    })
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = typeof result.error === 'string' ? result.error : 'oauth_error';
    throw new Error(`Firebase OAuth failed: ${error}`);
  }

  const accessToken = typeof result.access_token === 'string' ? result.access_token : '';
  const expiresIn = typeof result.expires_in === 'number' ? result.expires_in : 3600;
  if (!accessToken) throw new Error('Firebase OAuth response did not include an access token.');

  cachedToken = {
    accessToken,
    expiresAt: now + expiresIn
  };

  return accessToken;
}

export function clearFirebaseAccessTokenCache() {
  cachedToken = null;
}

async function createServiceAccountAssertion(params: {
  clientEmail: string;
  privateKey: string;
  now: number;
}) {
  const header = {
    alg: 'RS256',
    typ: 'JWT'
  };

  const claimSet = {
    iss: params.clientEmail,
    sub: params.clientEmail,
    aud: GOOGLE_TOKEN_URL,
    scope: FIREBASE_SCOPE,
    iat: params.now,
    exp: params.now + 3600
  };

  const unsignedJwt = `${base64UrlEncodeJson(header)}.${base64UrlEncodeJson(claimSet)}`;
  const key = await importPrivateKey(params.privateKey);
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(unsignedJwt)
  );

  return `${unsignedJwt}.${base64UrlEncodeBytes(new Uint8Array(signature))}`;
}

async function importPrivateKey(privateKeyPem: string) {
  const pemContents = privateKeyPem
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s/g, '');

  if (!pemContents) {
    throw new Error('FIREBASE_PRIVATE_KEY is malformed: PEM body is empty.');
  }

  const binary = Uint8Array.from(atob(pemContents), (char) => char.charCodeAt(0));

  return crypto.subtle.importKey(
    'pkcs8',
    binary,
    {
      name: 'RSASSA-PKCS1-v1_5',
      hash: 'SHA-256'
    },
    false,
    ['sign']
  );
}

function normalizePrivateKey(value: string | undefined) {
  return value?.replace(/\\n/g, '\n').trim() ?? '';
}

function base64UrlEncodeJson(value: unknown) {
  return base64UrlEncodeBytes(new TextEncoder().encode(JSON.stringify(value)));
}

function base64UrlEncodeBytes(bytes: Uint8Array) {
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}
