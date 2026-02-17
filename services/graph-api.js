/**
 * Copyright 2021-present, Facebook, Inc. All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

"use strict";

const { FacebookAdsApi } = require("facebook-nodejs-business-sdk");
const config = require("./config");

// Initialize default API to avoid SDK crash reporter issues
FacebookAdsApi.init(config.accessToken);

const whatsappApi = new FacebookAdsApi(config.accessToken);
const instagramApi = new FacebookAdsApi(config.igAccessToken);

module.exports = class GraphApi {
  static async #makeApiCall(
    messageId,
    senderId,
    requestBody,
    platform = "whatsapp",
  ) {
    try {
      const api = platform === "whatsapp" ? whatsappApi : instagramApi;
      if (!api) {
        throw new Error(
          `API instance for platform ${platform} is not initialized. Please check your environment variables.`,
        );
      }

      console.log(
        `[${platform.toUpperCase()}] Making API call to: /${senderId}/messages`,
      );

      // Mark as read
      if (messageId) {
        let typingBody;
        if (platform === "whatsapp") {
          typingBody = {
            messaging_product: "whatsapp",
            status: "read",
            message_id: messageId,
          };
        } else {
          // Instagram mark as read
          typingBody = {
            recipient: { id: senderId },
            sender_action: "mark_read",
          };
        }

        console.log(
          `[${platform.toUpperCase()}] Marking message ${messageId} as read...`,
        );
        await api.call("POST", [`${senderId}`, "messages"], typingBody);
      }

      const response = await api.call(
        "POST",
        [`${senderId}`, "messages"],
        requestBody,
      );
      console.log(`[${platform.toUpperCase()}] API call successful`);
      return response;
    } catch (error) {
      console.error(
        `[${platform.toUpperCase()}] Error making API call to /${senderId}/messages:`,
        error.message,
      );
      if (error.response) {
        console.error(
          `[${platform.toUpperCase()}] Meta Error Response:`,
          JSON.stringify(error.response, null, 2),
        );
      }
      throw error;
    }
  }

  static async messageWithInteractiveReply(
    messageId,
    senderPhoneNumberId,
    recipientPhoneNumber,
    messageText,
    replyCTAs,
  ) {
    const requestBody = {
      messaging_product: "whatsapp",
      to: recipientPhoneNumber,
      type: "interactive",
      interactive: {
        type: "button",
        body: {
          text: messageText,
        },
        action: {
          buttons: replyCTAs.map((cta) => ({
            type: "reply",
            reply: {
              id: cta.id,
              title: cta.title,
            },
          })),
        },
      },
    };

    return this.#makeApiCall(messageId, senderPhoneNumberId, requestBody);
  }

  static async messageWithUtilityTemplate(
    messageId,
    senderPhoneNumberId,
    recipientPhoneNumber,
    options,
  ) {
    const { templateName, locale, imageLink } = options;
    const requestBody = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: recipientPhoneNumber,
      type: "template",
      template: {
        name: templateName,
        language: {
          code: locale,
        },
        components: [
          {
            type: "header",
            parameters: [
              {
                type: "image",
                image: {
                  link: imageLink,
                },
              },
            ],
          },
        ],
      },
    };

    return this.#makeApiCall(messageId, senderPhoneNumberId, requestBody);
  }

  static async messageWithLimitedTimeOfferTemplate(
    messageId,
    senderPhoneNumberId,
    recipientPhoneNumber,
    options,
  ) {
    const { templateName, locale, imageLink, offerCode } = options;

    const currentTime = new Date();
    const futureTime = new Date(currentTime.getTime() + 48 * 60 * 60 * 1000);

    const requestBody = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: recipientPhoneNumber,
      type: "template",
      template: {
        name: templateName,
        language: {
          code: locale,
        },
        components: [
          {
            type: "header",
            parameters: [
              {
                type: "image",
                image: {
                  link: imageLink,
                },
              },
            ],
          },
          {
            type: "limited_time_offer",
            parameters: [
              {
                type: "limited_time_offer",
                limited_time_offer: {
                  expiration_time_ms: futureTime.getTime(),
                },
              },
            ],
          },
          {
            type: "button",
            sub_type: "copy_code",
            index: 0,
            parameters: [
              {
                type: "coupon_code",
                coupon_code: offerCode,
              },
            ],
          },
        ],
      },
    };

    return this.#makeApiCall(messageId, senderPhoneNumberId, requestBody);
  }

  static async messageWithMediaCardCarousel(
    messageId,
    senderPhoneNumberId,
    recipientPhoneNumber,
    options,
  ) {
    const { templateName, locale, imageLinks } = options;
    const requestBody = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: recipientPhoneNumber,
      type: "template",
      template: {
        name: templateName,
        language: {
          code: locale,
        },
        components: [
          {
            type: "carousel",
            cards: imageLinks.map((imageLink, idx) => ({
              card_index: idx,
              components: [
                {
                  type: "header",
                  parameters: [
                    {
                      type: "image",
                      image: {
                        link: imageLink,
                      },
                    },
                  ],
                },
              ],
            })),
          },
        ],
      },
    };

    return this.#makeApiCall(messageId, senderPhoneNumberId, requestBody);
  }

  static async sendInstagramTextMessage(
    senderPageId,
    recipientId,
    text,
    tag = null,
  ) {
    const requestBody = {
      recipient: {
        id: recipientId,
      },
      message: {
        text: text,
      },
    };

    if (tag) {
      requestBody.messaging_type = "MESSAGE_TAG";
      requestBody.tag = tag;
    }

    return this.#makeApiCall(null, senderPageId, requestBody, "instagram");
  }

  static async markInstagramMessageAsRead(senderPageId, recipientId) {
    const requestBody = {
      recipient: { id: recipientId },
      sender_action: "mark_read",
    };

    return this.#makeApiCall(null, senderPageId, requestBody, "instagram");
  }

  // Conversations API
  static async getInstagramConversations(pageId) {
    if (!instagramApi) return null;
    return instagramApi.call("GET", ["me", "conversations"], {
      platform: "instagram",
    });
  }

  static async getInstagramMessages(conversationId) {
    if (!instagramApi) return null;
    return instagramApi.call("GET", [conversationId], {
      fields: "messages",
    });
  }
};
