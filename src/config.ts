import dotenv from 'dotenv';

// Load environment variables from a .env file into process.env
dotenv.config();

/**
 * A centralized configuration object for the messaging service.
 *
 * This object loads and validates all necessary environment variables at startup.
 * It provides a single, strongly-typed source of truth for configuration. If any
 * required secrets are missing, the application will throw an error and exit
 * immediately, preventing silent failures.
 */
const config = {
    /** The port the Express server will listen on. Defaults to 3001. */
    port: process.env.PORT || 3001,

    /** The Google Cloud Project ID for Firestore. */
    gcpProjectId: process.env.GCP_PROJECT_ID,

    identityServiceUrl: process.env.IDENTITY_SERVICE_URL,

    internalApiKey: process.env.INTERNAL_API_KEY,
};

// --- Runtime Validation ---
// This ensures the server fails fast if critical secrets are not configured.
const requiredSecrets: (keyof typeof config)[] = [
    'gcpProjectId',
    'identityServiceUrl',
    'internalApiKey',
];

for (const secret of requiredSecrets) {
    if (!config[secret]) {
        // This provides a clear, actionable error message.
        throw new Error(`FATAL: Missing required environment variable: ${secret.toUpperCase()}`);
    }
}

// Export the validated, immutable config object for the rest of the application to use.
export { config };
