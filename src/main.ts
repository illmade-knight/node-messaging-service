import express from 'express';
import cors from 'cors';
import { Firestore } from '@google-cloud/firestore';
import axios from 'axios';
import { createRemoteJWKSet } from 'jose';

// Import our centralized configuration and services
import { config } from './config.js';
import { addContactToAddressBook, getUserAddressBook } from './internal/firestore.js';
import { createAuthMiddleware } from './internal/auth/auth.middleware.js';
import type { Contact } from '@illmade-knight/action-intention-protos';

/**
 * The main startup function for the server.
 * It initializes dependencies and configures the Express application.
 */
async function startServer() {
    try {
        console.log('[INFO] Initializing node-messaging-service...');

        if (!config.gcpProjectId || !config.identityServiceUrl) {
            throw new Error("Missing gcpProjectId or identityServiceUrl in configuration.");
        }

        // --- 1. DISCOVER & VALIDATE IDENTITY CONFIGURATION ---
        console.log(`[INFO] Discovering configuration from identity service at ${config.identityServiceUrl}`);
        const metadataUrl = `${config.identityServiceUrl}/.well-known/oauth-authorization-server`;

        console.log("looking up metadata", metadataUrl);
        const response = await axios.get(metadataUrl);
        console.log("got metadata response", response);
        const metadata = response.data;

        // --- 2. PERFORM VALIDATION CHECKS ---
        const supportedAlgs = metadata.id_token_signing_alg_values_supported;
        const requiredAlg = 'RS256'; // This service requires RS256 tokens.

        if (!supportedAlgs || !supportedAlgs.includes(requiredAlg)) {
            throw new Error(`FATAL: Identity service no longer supports the required JWT algorithm '${requiredAlg}'. Supported algorithms: [${supportedAlgs.join(', ')}]`);
        }
        console.log('[SUCCESS] JWT algorithm policies are compatible.');


        // 3. Initialize Firestore connection.
        const db = new Firestore({ projectId: config.gcpProjectId });
        await db.listCollections();
        console.log(`[SUCCESS] Firestore connection verified for project: "${config.gcpProjectId}".`);

        // 4. Create the Remote JWKS client using the discovered URI.
        const jwksUrl = new URL(metadata.jwks_uri); // Use the URI from the metadata
        const jwksClient = createRemoteJWKSet(jwksUrl);
        console.log(`[INFO] JWKS client configured using discovered URL: ${jwksUrl}`);

        // 5. Configure and start the Express application.
        const app = express();

        // --- MIDDLEWARE ---
        app.use(cors());
        app.use(express.json()); // Middleware to parse JSON bodies

        // --- AUTHENTICATED ROUTES ---
        const authMiddleware = createAuthMiddleware(jwksClient);

        app.get('/api/address-book', authMiddleware, async (req, res) => {
            const user = req.user!;
            try {
                const addressBook = await getUserAddressBook(db, user.id);
                res.json(addressBook);
            } catch (error) {
                console.error('Failed to get address book:', error);
                res.status(500).json({ error: 'An internal error occurred.' });
            }
        });

        app.post('/api/address-book/contacts', authMiddleware, async (req, res) => {
            const owner = req.user!;
            const { email } = req.body;

            if (!email) {
                return res.status(400).json({ error: 'Email is required.' });
            }

            try {
                // 1. Call the identity service to get the full user details for the given email.
                const response = await axios.get<Contact>(`${config.identityServiceUrl}/api/users/by-email/${email}`, {
                    headers: {
                        'X-Internal-API-Key': config.internalApiKey,
                    }
                });
                const contactToAdd: Contact = response.data;

                // 2. Add the enriched contact to the owner's address book.
                await addContactToAddressBook(db, owner.id, contactToAdd);
                res.status(201).json(contactToAdd);
            } catch (error: any) {
                if (axios.isAxiosError(error) && error.response?.status === 404) {
                    return res.status(404).json({ error: 'User with that email not found.' });
                }
                console.error('Failed to add contact:', error);
                res.status(500).json({ error: 'An internal error occurred while adding the contact.' });
            }
        });

        // --- SERVER START ---
        app.listen(config.port, () => {
            console.log(`[SUCCESS] node-messaging-service listening on http://localhost:${config.port}`);
        });

    } catch (error: any) {
        console.error("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
        console.error("!!!         FATAL: SERVER FAILED TO START            !!!");
        console.error("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
        console.error("\nERROR:", error.message);
        process.exit(1);
    }
}

// Run the server.
startServer();