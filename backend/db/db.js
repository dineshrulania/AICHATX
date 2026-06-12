import mongoose from "mongoose";

import dns from "dns";

dns.setDefaultResultOrder("ipv4first");
// console.log("MONGODB_URI:", process.env.MONGODB_URI);
// console.log("All ENV Keys:", Object.keys(process.env).filter(k => k.includes("MONGO")));
function connect() {
    mongoose.connect(process.env.MONGODB_URI)
        .then(() => {
            console.log("Connected to MongoDB");
        })
        .catch(err => {
            console.log(err);
        })
}

export default connect;