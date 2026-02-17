/**
 * Copyright 2021-present, Facebook, Inc. All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

"use strict";

const crypto = require("crypto");

const { urlencoded, json } = require("body-parser");
require("dotenv").config();
const express = require("express");

const config = require("./services/config");
const Conversation = require("./services/conversation");
const Message = require("./services/message");
const app = express();

// Parse application/x-www-form-urlencoded
app.use(
  urlencoded({
    extended: true,
  }),
);

// Parse application/json. Verify that callback came from Facebook
app.use(json({ verify: verifyRequestSignature }));

app.get("/health", (req, res) => {
  res.json({
    message: "Server is running",
    status: "ok",
  });
});

// Handle webhook verification handshake
app.get("/webhook", function (req, res) {
  if (
    req.query["hub.mode"] != "subscribe" ||
    req.query["hub.verify_token"] != config.verifyToken
  ) {
    console.log("Invalid verification token");
    res.sendStatus(403);
    return;
  }

  res.send(req.query["hub.challenge"]);
});

// Handle incoming messages
app.post("/webhook", (req, res) => {
  console.log("-----------------------------------------");
  console.log("Incoming Webhook Event at:", new Date().toISOString());
  console.log(JSON.stringify(req.body, null, 2));
  console.log("-----------------------------------------");

  if (req.body.object === "whatsapp_business_account") {
    req.body.entry.forEach((entry) => {
      entry.changes.forEach((change) => {
        const value = change.value;
        if (value) {
          const senderPhoneNumberId = value.metadata.phone_number_id;

          if (value.statuses) {
            value.statuses.forEach((status) => {
              // Handle message status updates
              Conversation.handleStatus(senderPhoneNumberId, status);
            });
          }

          if (value.messages) {
            value.messages.forEach((rawMessage) => {
              // Respond to message
              Conversation.handleMessage(senderPhoneNumberId, rawMessage);
            });
          }
        }
      });
    });
  } else if (req.body.object === "instagram") {
    req.body.entry.forEach((entry) => {
      // Instagram payloads can have 'messaging' or 'changes'
      if (entry.messaging) {
        entry.messaging.forEach((messagingEvent) => {
          console.log("-----------------------------------------");
          console.log(
            "Incoming Instagram Messaging Event at:",
            new Date().toISOString(),
          );
          console.log(JSON.stringify(messagingEvent, null, 2));
          console.log("-----------------------------------------");

          // Determine the correct Page/Business ID
          const businessId =
            entry.id && entry.id !== "0"
              ? entry.id
              : messagingEvent.recipient.id;

          if (messagingEvent.message) {
            Conversation.handleInstagramMessage(businessId, messagingEvent);
          } else if (messagingEvent.delivery || messagingEvent.read) {
            Conversation.handleInstagramStatus(businessId, messagingEvent);
          }
        });
      } else if (entry.changes) {
        entry.changes.forEach((change) => {
          console.log("-----------------------------------------");
          console.log(
            "Incoming Instagram Change Event at:",
            new Date().toISOString(),
          );
          console.log(JSON.stringify(change, null, 2));
          console.log("-----------------------------------------");

          if (change.field === "messages") {
            // Adapt 'changes' format to look like 'messaging' for the handler
            const messagingEvent = {
              sender: change.value.sender,
              recipient: change.value.recipient,
              timestamp: change.value.timestamp,
              message: change.value.message,
            };

            // Determine the correct Page/Business ID
            const businessId =
              entry.id && entry.id !== "0"
                ? entry.id
                : messagingEvent.recipient.id;

            Conversation.handleInstagramMessage(businessId, messagingEvent);
          }
        });
      }
    });
  }

  res.status(200).send("EVENT_RECEIVED");
});

// Default route for health check
app.get("/", (req, res) => {
  res.json({
    message: "Jasper's Market Server is running",
    endpoints: ["POST /webhook - WhatsApp webhook endpoint"],
  });
});

// Check if all environment variables are set
config.checkEnvVariables();

// Verify that the callback came from Facebook.
function verifyRequestSignature(req, res, buf) {
  let signature = req.headers["x-hub-signature-256"];

  if (!signature) {
    console.warn(`Couldn't find "x-hub-signature-256" in headers.`);
  } else {
    let elements = signature.split("=");
    let signatureHash = elements[1];

    // Try verifying with the main App Secret
    let expectedHash = crypto
      .createHmac("sha256", config.appSecret)
      .update(buf)
      .digest("hex");

    if (signatureHash === expectedHash) {
      return;
    }

    // If main secret fails, try with IG App Secret if it's different
    if (config.igAppSecret && config.igAppSecret !== config.appSecret) {
      let expectedHashIG = crypto
        .createHmac("sha256", config.igAppSecret)
        .update(buf)
        .digest("hex");

      if (signatureHash === expectedHashIG) {
        return;
      }
    }

    console.error("Signature mismatch!");
    console.error("Received signature hash:", signatureHash);
    console.error(
      "Main appSecret used for verification:",
      config.appSecret.substring(0, 4) + "...",
    );
    if (config.igAppSecret !== config.appSecret) {
      console.error(
        "IG appSecret used for verification:",
        config.igAppSecret.substring(0, 4) + "...",
      );
    }

    throw new Error("Couldn't validate the request signature.");
  }
}

var listener = app.listen(config.port, () => {
  console.log(`The app is listening on port ${listener.address().port}`);
});
