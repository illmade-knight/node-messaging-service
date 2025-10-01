import type {NextFunction, Request, Response} from 'express';
// We no longer need KeyLike, but we can get the type for the jwksClient
// directly from the return type of the factory function for robustness.
import {createRemoteJWKSet, jwtVerify} from 'jose';
import type {Contact} from '@illmade-knight/action-intention-protos';

// Extend the Express Request interface to include our custom user property.
declare global {
    namespace Express {
        interface Request {
            user?: Contact;
        }
    }
}

// Get the precise return type of createRemoteJWKSet to use in our factory.
// This makes the code more robust to future library updates.
type JWKSClient = ReturnType<typeof createRemoteJWKSet>;

/**
 * A factory function that creates the JWT authentication middleware.
 * This pattern allows us to create the JWKS client once on startup and inject
 * it into the middleware.
 *
 * @param jwksClient - The remote JWKS client created by jose.createRemoteJWKSet.
 * @returns An Express middleware function.
 */
export function createAuthMiddleware(jwksClient: JWKSClient) {
    return async function authMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            res.status(401).json({ error: 'Unauthorized: No or invalid token provided.' });
            return;
        }

        const token = authHeader.split(' ')[1];

        if (!token) {
            res.status(401).json({ error: 'Unauthorized: Token is missing.' });
            return;
        }

        try {
            // THE FIX: Pass the jwksClient object directly to jwtVerify.
            // The 'jose' library handles all the complexity of fetching, caching,
            // and selecting the correct public key to verify the token signature.
            const { payload } = await jwtVerify(token, jwksClient);

            if (typeof payload.sub !== 'string' || !payload.email || !payload.alias) {
                throw new Error('Token payload is missing or has an invalid "sub" claim.');
            }

            // Attach the validated user object to the request.
            req.user = {
                id: payload.sub,
                email: payload.email as string,
                alias: payload.alias as string,
            };
            next();
        } catch (error) {
            // This block will catch errors for expired tokens, invalid signatures, etc.
            console.error('[AUTH] JWT validation error:', error);
            res.status(401).json({ error: 'Unauthorized: Invalid or expired token.' });
        }
    };
}

