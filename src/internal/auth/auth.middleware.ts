import type {Request, Response, NextFunction} from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../../config.js';
import type {Contact} from '@illmade-knight/action-intention-protos';

// Extend the Express Request interface to include our custom user property.
declare global {
    namespace Express {
        interface Request {
            user?: Contact;
        }
    }
}

/**
 * An Express middleware that validates the internal JWT from the Authorization header.
 */
export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Unauthorized: No token provided.' });
        return;
    }

    const token = authHeader.split(' ')[1];

    if (token == undefined)
        throw new Error('Token is undefined');
    if (config.jwtSecret == undefined)
        throw new Error('jwtSecret is undefined');

    try {
        const decodedPayload = jwt.verify(token, config.jwtSecret) as jwt.JwtPayload;

        // THE FIX:
        // A standard JWT payload uses 'sub' for the subject/user ID. We must
        // explicitly map this standard claim to the 'id' property of our
        // internal AuthenticatedUser model. This is a robust pattern that
        // decouples our application's models from the JWT specification.
        if (typeof decodedPayload.sub !== 'string') {
            throw new Error('Token payload is missing or has an invalid "sub" claim.');
        }

        const user: Contact = {
            id: decodedPayload.sub,
            email: decodedPayload.email as string,
            alias: decodedPayload.alias as string,
        };

        // Attach the validated and correctly structured user object to the request.
        req.user = user;

        next();
    } catch (error) {
        // This block will catch errors for expired tokens, invalid signatures, or missing claims.
        console.error("JWT validation error:", error);
        res.status(401).json({ error: 'Unauthorized: Invalid or expired token.' });
    }
}

