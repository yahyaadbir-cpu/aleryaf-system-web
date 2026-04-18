# Jax Module

Jax is meant to be reusable across ALERYAF products.

## Core idea

Do not think of Jax as a desktop-only assistant.

In each project, Jax should have:

- one chat endpoint
- one project identity/config file
- one project context document
- optional future tools specific to that project

## Files in this project

- `jax.config.json`
  What Jax is called, what project it belongs to, default model, mission, constraints.

- `jax.project.md`
  The live project knowledge block that tells Jax what this product is and how it should behave here.

- `artifacts/api-server/src/lib/jax.ts`
  Reusable server-side Jax logic that loads config/context and talks to Ollama.

- `artifacts/api-server/src/routes/jax.ts`
  HTTP API for project UIs or future mobile/web clients.

## API

- `GET /api/jax/context`
  Returns the loaded Jax project identity and current model.

- `POST /api/jax/chat`
  Body:

  ```json
  {
    "message": "What does this project do?",
    "history": [
      { "role": "user", "content": "Hi" },
      { "role": "assistant", "content": "Hello." }
    ]
  }
  ```

## How to reuse Jax in future projects

1. Copy the Jax server module or move it into a shared package later.
2. Replace `jax.config.json` with the new product identity.
3. Replace `jax.project.md` with the new product docs and mission.
4. Keep the same `/api/jax/chat` contract so any UI can connect.

## Notes

- Default Ollama model is `llama3.2:3b`.
- You can override the runtime with:
  - `OLLAMA_URL`
  - `OLLAMA_MODEL`
