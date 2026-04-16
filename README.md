# intermateBackEnd

## Local setup

The Node API reads `MONGODB_URI` from the repo root `.env`.

If you use:

- Local MongoDB: set `MONGODB_URI=mongodb://127.0.0.1:27017/intermate` and make sure the MongoDB server is running on port `27017`.
- MongoDB Atlas: replace `MONGODB_URI` with your `mongodb+srv://...` connection string.

If MongoDB is not running, the API will fail at startup because it connects before starting Express.
