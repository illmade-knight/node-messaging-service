# Node Messaging Service

This microservice handles the core messaging and user-to-user communication features of the application. It is responsible for creating and retrieving messages, managing contact lists, and relies on the `node-identity-service` for user authentication and authorization.

---

## Prerequisites

Before you begin, ensure you have the following installed on your system:
* **Node.js**: `v20.x` or later
* **NPM**: `v10.x` or later (comes with Node.js)
* **Google Cloud SDK**: Configured with credentials that have access to the project's Firestore database.

---

## Getting Started

Follow these steps to get the service running on your local machine.

### 1. Clone the Repository

````bash
git clone <your-repository-url>
cd node-messaging-service
````


2. Install Dependencies

Install all the required npm packages.

````
npm install
````


3. Configure Environment Variables

The service requires a .env file in the root of the project to store sensitive configuration and secrets. You can copy the example file to get started.

````
cp .env.example .env
````

Now, open the .env file and fill in the following values:
* GCP_PROJECT_ID: Your Google Cloud Project ID.
* JWT_SECRET: The shared secret used to validate JWTs issued by the identity service.
* INTERNAL_API_KEY: The secret API key used for secure server-to-server communication between microservices.
* IDENTITY_SERVICE_URL: The base URL of the running node-identity-service (e.g., http://localhost:3000).
* PORT: The port on which this messaging service will run (e.g., 3001).

## Running the Application

The application can be run in two modes:

### Development Mode

This command starts the server using nodemon and tsx for fast, automatic restarts whenever you save a file.

````
npm run dev
````

### Production Mode

For a production environment, you should first build the application and then run the compiled JavaScript.

````
# 1. Compile TypeScript to JavaScript in the /dist directory
npm run build

# 2. Run the compiled application
npm run start
````


## Architectural Notes


### Module System (ESM)

This project is built using the modern ES Module (ESM) system ("type": "module" in package.json). This aligns our project with the official future direction of the Node.js and wider JavaScript ecosystem.
By committing to a modern ESM setup, we ensure that we can easily integrate with new, forward-thinking libraries and hold our dependencies to a high standard.

### Developer Quick Note:

When working in an ESM project, all relative imports must include the file extension. TypeScript's nodenext module resolution requires this for correctness.
Example:

Incorrect: import { db } from './firestore'

Correct: import { db } from './firestore.js'
