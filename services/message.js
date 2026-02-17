/**
 * Copyright 2021-present, Facebook, Inc. All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

"use strict";

module.exports = class Message {
  constructor(rawMessage) {
    this.id = rawMessage.id;

    let type = rawMessage.type;
    if (type === "interactive") {
      this.type = rawMessage.interactive.button_reply.id;
    } else if (rawMessage.text) {
      this.type = "text";
      this.text = rawMessage.text.body || rawMessage.text;
    } else if (rawMessage.message && rawMessage.message.text) {
      // Instagram format
      this.type = "text";
      this.text = rawMessage.message.text;
    } else {
      this.type = "unknown";
    }

    this.senderPhoneNumber =
      rawMessage.from || (rawMessage.sender ? rawMessage.sender.id : undefined);
  }
};
