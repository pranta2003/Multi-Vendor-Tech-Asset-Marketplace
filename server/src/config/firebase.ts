import { initializeApp, getApps, getApp, cert, type App } from 'firebase-admin/app';
import { getAuth, type Auth, type DecodedIdToken } from 'firebase-admin/auth';
import { env } from './env';
import { logger } from '../utils/logger';

let firebaseApp: App | null = null;
let firebaseAuth: Auth | null = null;

export const isFirebaseConfigured = (): boolean => Boolean(env.FIREBASE_PROJECT_ID);

export const getFirebaseAdminAuth = (): Auth | null => {
  if (!isFirebaseConfigured()) {
    return null;
  }

  if (firebaseAuth) {
    return firebaseAuth;
  }

  try {
    if (getApps().length > 0) {
      firebaseApp = getApp();
    } else {
      if (env.FIREBASE_CLIENT_EMAIL && env.FIREBASE_PRIVATE_KEY) {
        firebaseApp = initializeApp({
          credential: cert({
            projectId: env.FIREBASE_PROJECT_ID,
            clientEmail: env.FIREBASE_CLIENT_EMAIL,
            privateKey: env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
          }),
        });
      } else {
        firebaseApp = initializeApp({
          projectId: env.FIREBASE_PROJECT_ID,
        });
      }
    }
    firebaseAuth = getAuth(firebaseApp);
    return firebaseAuth;
  } catch (err) {
    logger.error({ err }, 'Failed to initialize Firebase Admin SDK');
    return null;
  }
};

export const verifyFirebaseToken = async (idToken: string): Promise<DecodedIdToken> => {
  const auth = getFirebaseAdminAuth();
  if (!auth) {
    throw new Error(
      'Google authentication is not configured on the server. Set FIREBASE_PROJECT_ID in environment variables.'
    );
  }

  return auth.verifyIdToken(idToken);
};

