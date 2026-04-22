import mongoose from "mongoose";
import { DB_URI, NODE_ENV } from "../config/env.js";
import Subscription from "../models/subscription.model.js";

const pingDatabase = async () => {
  if (!DB_URI) {
    console.error(
      `DB_URI is not set. Define it inside .env.${NODE_ENV}.local or as an environment variable.`
    );
    process.exit(1);
  }

  try {
    console.log("Connecting to Atlas MongoDB cluster...");
    await mongoose.connect(DB_URI);
    await mongoose.connection.db.admin().ping();
    console.log("Ping successful. Connection is alive.");

    console.log("\nQuerying subscription documents...");
    const subscriptions = await Subscription.find()
      .select("name price currency frequency payment renewalDate user")
      .limit(5)
      .lean();

    if (subscriptions.length === 0) {
      console.log("No subscription documents found in the collection.");
    } else {
      console.log(`Retrieved ${subscriptions.length} subscription(s):`);
      subscriptions.forEach((sub, i) => {
        console.log(`  [${i + 1}] ${sub.name} | ${sub.currency} ${sub.price} / ${sub.frequency} | status: ${sub.payment} | renewal: ${sub.renewalDate?.toISOString().slice(0, 10) ?? "N/A"} | user: ${sub.user}`);
      });
    }

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error("Ping failed:", err.message);
    process.exit(1);
  }
};

pingDatabase();
