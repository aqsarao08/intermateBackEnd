# intermateBackEnd

## Local setup

The Node API reads `MONGODB_URI` from the repo root `.env`.
The API CORS allowlist reads `CLIENT_URL` and optionally `CLIENT_URLS` from the same `.env`.

If you use:

- Local MongoDB: set `MONGODB_URI=mongodb://127.0.0.1:27017/intermate` and make sure the MongoDB server is running on port `27017`.
- MongoDB Atlas: replace `MONGODB_URI` with your `mongodb+srv://...` connection string.

If MongoDB is not running, the API will fail at startup because it connects before starting Express.

### Frontend origin setup

If you open the frontend from multiple dev origins, keep `CLIENT_URL` for the primary one and use `CLIENT_URLS` for extra comma-separated origins, for example:

```env
CLIENT_URL=http://localhost:3000
CLIENT_URLS=http://localhost:3000,http://127.0.0.1:3000,http://10.102.140.170:3000
```

### Starting local MongoDB on this machine

This repo includes a dev helper that starts `mongod.exe` against a writable project-local data directory instead of the broken Windows service config:

```powershell
npm run mongo:start
npm run dev
```
