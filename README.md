# Run and deploy your AI Studio app

This contains everything you need to run and deploy your app.

## Run Locally

**Prerequisites:** Node.js

1.  **Install dependencies:**
    ```bash
    npm install
    ```
2.  **Set up environment variables:**
    Create a file named `.env` in the root of the project. This file is for local development and should **not** be committed to Git.
    ```
    API_KEY=YOUR_API_KEY_HERE
    ```
    Replace `YOUR_API_KEY_HERE` with your actual key from Google AI Studio.
3.  **Run the app:**
    ```bash
    npm run dev
    ```
The app will be available at `http://localhost:5173` (or another port if 5173 is in use).

## Deployment (e.g., to GitHub Pages)

When you push your code to GitHub, the `.env` file is not included for security reasons. Therefore, the deployed application won't have access to your API key, and AI features will not work.

To fix this, you must configure your deployment environment (like GitHub Pages) to securely provide the API key during the build process. Here’s the general process using GitHub Actions:

1.  **Add your API key to GitHub Secrets:**
    *   In your GitHub repository, go to `Settings` > `Secrets and variables` > `Actions`.
    *   Click `New repository secret`.
    *   Name the secret `API_KEY`.
    *   Paste your API key into the value field.

2.  **Use the secret in a build workflow:**
    *   Create a GitHub Actions workflow file (e.g., `.github/workflows/deploy.yml`) to build and deploy your app.
    *   In your build step, make the secret available as an environment variable so that Vite can inject it into the code.

    Example snippet for a GitHub Actions workflow file:
    ```yaml
    - name: Build project
      run: npm run build
      env:
        API_KEY: ${{ secrets.API_KEY }}
    ```
This process ensures your API key remains secure while being available to your application when it's built for deployment.

## Troubleshooting

*   **AI features not working on deployed site:** This is almost always because the `API_KEY` was not available during the build process. Follow the steps in the "Deployment" section.
*   **AI features not working locally:**
    *   Ensure you have created a `.env` file in the project root.
    *   Make sure the variable is named exactly `API_KEY`.
    *   Restart the development server (`npm run dev`) after changing the `.env` file.