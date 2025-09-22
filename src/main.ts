import express from 'express';
import cors from 'cors';
import { Firestore } from '@google-cloud/firestore';

// Import our centralized configuration and services
import { config } from './config.js';
import {addContactToAddressBook, getUserAddressBook} from './internal/firestore.js';
import { authMiddleware } from './internal/auth/auth.middleware.js';
import type { Contact } from '@illmade-knight/action-intention-protos';
import axios from "axios";

/**
 * The main startup function for the server.
 * It initializes dependencies and configures the Express application.
 */
async function startServer() {
    try {
        console.log('[INFO] Initializing node-messaging-service...');

        if (config.gcpProjectId == undefined) {
            return
        }
        // 1. Initialize Firestore connection, using the validated project ID from our config.
        const db = new Firestore({ projectId: config.gcpProjectId });

        // 2. Force an immediate authentication check to ensure credentials are valid.
        // This prevents silent crashes and provides clear startup errors.
        await db.listCollections();
        console.log(`[SUCCESS] Firestore connection verified for project: "${config.gcpProjectId}".`);

        // 3. Configure and start the Express application.
        const app = express();

        // --- MIDDLEWARE ---
        // Enable Cross-Origin Resource Sharing (CORS) to allow requests from our Angular frontend.
        app.use(cors({
            origin: 'http://localhost:4200',
            credentials: true,
        }));

        // --- API ROUTES ---

        // This is the single endpoint for this service.
        // It is protected by our JWT validation middleware.
        app.get('/api/address-book', authMiddleware, async (req, res) => {
            try {
                // The authMiddleware has already validated the JWT and attached the user
                // payload to the request. We can now trust this user object.
                const user = req.user as Contact;

                // Pass the db instance and the user's ID to the Firestore service.
                const addressBook = await getUserAddressBook(db, user.id);

                res.status(200).json(addressBook);
            } catch (error) {
                console.error('Failed to get address book:', error);
                res.status(500).json({ error: 'An internal error occurred while retrieving the address book.' });
            }
        });


        app.post('/api/address-book', authMiddleware, async (req, res) => {
            try {
                const owner = req.user as Contact; // The person adding the contact
                const { email: contactEmail } = req.body; // The email of the contact to add

                if (!contactEmail) {
                    return res.status(400).json({ error: 'Email is required.' });
                }

                // 1. Make a server-to-server call to the identity service to look up the user.
                // We forward the original Authorization header to authenticate this internal request.
                const lookupUrl = `${config.identityServiceUrl}/api/users/by-email/${contactEmail}`;
                const response = await axios.get<Contact>(lookupUrl, {
                    headers: {
                        'Authorization': req.headers.authorization!,
                    }
                });

                const contactToAdd: Contact = response.data;

                // 2. Add the enriched contact to the owner's address book in Firestore.
                await addContactToAddressBook(db, owner.id, contactToAdd);

                res.status(201).json(contactToAdd); // Return the newly added contact
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
        console.error("\nThis is likely an issue with your Google Cloud credentials or .env file configuration.");
        process.exit(1);
    }
}

// Run the server.
startServer();
