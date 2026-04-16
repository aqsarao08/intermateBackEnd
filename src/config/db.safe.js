import mongoose from "mongoose";

export async function connectDB(uri) {
  if (!uri) {
    console.error("Missing MONGODB_URI in the root .env file.");
    console.error(
      "Set MONGODB_URI to a running MongoDB instance, for example mongodb://127.0.0.1:27017/intermate"
    );
    process.exit(1);
  }

  try {
    await mongoose.connect(uri);
    console.log("MongoDB connected");
  } catch (err) {
    console.error("MongoDB connection error:", err.message);

    if (err.message.includes("ECONNREFUSED") && uri.includes("127.0.0.1:27017")) {
      console.error("No MongoDB server is running at 127.0.0.1:27017.");
      console.error("Start MongoDB locally, or update MONGODB_URI in the root .env file.");
      console.error(
        "Example Atlas URI: mongodb+srv://<username>:<password>@<cluster>/<database>?retryWrites=true&w=majority"
      );
    }

    process.exit(1);
  }
}
