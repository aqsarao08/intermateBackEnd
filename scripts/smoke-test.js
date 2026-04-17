import "dotenv/config";
import mongoose from "mongoose";

const MONGO_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/intermate";
const TIMEOUT_MS = 5000;

let passed = 0;
let failed = 0;

function ok(label) {
  console.log(`  ✅ ${label}`);
  passed++;
}

function fail(label, err) {
  console.log(`  ❌ ${label}: ${err?.message ?? err}`);
  failed++;
}

async function testConnection() {
  console.log("\n📡 MongoDB Connection");
  console.log(`   URI: ${MONGO_URI}`);
  try {
    await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: TIMEOUT_MS });
    ok("Connected to MongoDB");
  } catch (err) {
    fail("Connection failed", err);
    return false;
  }
  return true;
}

async function testPing() {
  console.log("\n🏓 Ping");
  try {
    const result = await mongoose.connection.db.admin().ping();
    if (result?.ok === 1) ok("Ping responded ok:1");
    else fail("Ping returned unexpected response", result);
  } catch (err) {
    fail("Ping failed", err);
  }
}

async function testReadWrite() {
  console.log("\n📝 Read / Write (temp collection)");
  const col = mongoose.connection.db.collection("_smoke_test");
  try {
    const doc = { _smokeTest: true, ts: new Date() };
    const { insertedId } = await col.insertOne(doc);
    ok(`Inserted document (id: ${insertedId})`);

    const found = await col.findOne({ _id: insertedId });
    if (found) ok("Read back inserted document");
    else fail("Document not found after insert");

    await col.deleteOne({ _id: insertedId });
    ok("Cleaned up temp document");
  } catch (err) {
    fail("Read/write test", err);
  }
}

async function testCollections() {
  console.log("\n📂 Existing Collections");
  try {
    const collections = await mongoose.connection.db.listCollections().toArray();
    if (collections.length === 0) {
      console.log("   ℹ️  No collections yet (fresh database)");
    } else {
      collections.forEach((c) => console.log(`   📁 ${c.name}`));
    }
    ok("Listed collections");
  } catch (err) {
    fail("List collections", err);
  }
}

async function main() {
  console.log("=".repeat(45));
  console.log("       intermateBackEnd — Smoke Test");
  console.log("=".repeat(45));

  const connected = await testConnection();
  if (!connected) {
    console.log("\n⚠️  Cannot run further tests without a connection.");
    console.log("   → Make sure MongoDB is running: net start MongoDB");
    process.exit(1);
  }

  await testPing();
  await testReadWrite();
  await testCollections();

  await mongoose.disconnect();

  console.log("\n" + "=".repeat(45));
  console.log(`  Results: ${passed} passed, ${failed} failed`);
  console.log("=".repeat(45) + "\n");
  process.exit(failed > 0 ? 1 : 0);
}

main();
