
# Hosting Guide for Draw and Guess

This guide explains how to deploy the Draw and Guess application on Render.

## Prerequisites

1. A GitHub account
2. A Render account (sign up at https://render.com)

## Deployment Steps

### 1. Push your code to GitHub

If your code is not already on GitHub, create a new repository and push your code there.

### 2. Set up the Render deployment

1. Sign in to your Render account
2. Go to your Dashboard
3. Click on "New" and select "Blueprint"
4. Connect your GitHub repository
5. Render will automatically detect the `render.yaml` file and set up both services

### 3. Environment Variables

The frontend service will automatically get the backend URL from the render.yaml configuration. No manual setup required.

### 4. Database Persistence

Note that this deployment uses file-based storage in the server's data directory. For a production environment, you should consider:

- Using a proper database like PostgreSQL
- Implementing a more robust storage solution

### 5. Accessing Your Application

Once deployed:
- The frontend will be available at: `https://draw-and-guess-frontend-xxxx.onrender.com`
- The backend will be available at: `https://draw-and-guess-backend-xxxx.onrender.com`

## Troubleshooting

1. If connections fail, verify that CORS is properly configured
2. Check the logs in the Render dashboard for both services
3. Make sure the environment variables are correctly set

## Local Development After Deployment

When developing locally after deployment:
1. Set the `VITE_SOCKET_SERVER_URL` environment variable in a `.env` file to point to your local server:
   ```
   VITE_SOCKET_SERVER_URL=http://localhost:3001
   ```
2. Or let it default to localhost if the environment variable is not set
