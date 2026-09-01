package com.ollang.sdk.resources;

import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.ollang.sdk.OllangClient;

/** Request revisions on completed orders. */
public class Revisions {

  private final OllangClient client;

  public Revisions(OllangClient client) {
    this.client = client;
  }

  /**
   * Creates a revision request for an order.
   *
   * @param type revision type: one of {@code missingSubtitle}, {@code wrongSubtitle},
   *     {@code syncError}, {@code formatError} or {@code other}
   * @param time timestamp the revision refers to, e.g. {@code "00:01:23"}
   * @param description optional details for the reviewer; may be {@code null}
   */
  public JsonElement create(String orderId, String type, String time, String description) {
    JsonObject body = new JsonObject();
    body.addProperty("type", type);
    body.addProperty("time", time);
    if (description != null) {
      body.addProperty("description", description);
    }
    return client.post("/integration/revision/" + orderId, body);
  }

  public JsonElement list(String orderId) {
    return client.get("/integration/revision/" + orderId);
  }

  public JsonElement delete(String orderId, String revisionId) {
    return client.delete("/integration/revision/" + orderId + "/" + revisionId);
  }
}
