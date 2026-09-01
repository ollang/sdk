package com.ollang.sdk.resources;

import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.ollang.sdk.OllangClient;

/** Manage custom translation instructions. */
public class CustomInstructions {

  private final OllangClient client;

  public CustomInstructions(OllangClient client) {
    this.client = client;
  }

  public JsonElement list() {
    return client.get("/integration/custom-instructions");
  }

  /** Creates a custom instruction. {@code description} may be {@code null}. */
  public JsonElement create(String key, String value, String description) {
    JsonObject body = new JsonObject();
    body.addProperty("key", key);
    body.addProperty("value", value);
    if (description != null) {
      body.addProperty("description", description);
    }
    return client.post("/integration/custom-instructions", body);
  }

  /** Updates a custom instruction. Any of {@code key}, {@code value}, {@code description} may be {@code null} to leave it unchanged. */
  public JsonElement update(String instructionId, String key, String value, String description) {
    JsonObject body = new JsonObject();
    if (key != null) {
      body.addProperty("key", key);
    }
    if (value != null) {
      body.addProperty("value", value);
    }
    if (description != null) {
      body.addProperty("description", description);
    }
    return client.patch("/integration/custom-instructions/" + instructionId, body);
  }

  public JsonElement delete(String instructionId) {
    return client.delete("/integration/custom-instructions/" + instructionId);
  }

  public JsonElement suggestions() {
    return client.get("/integration/custom-instructions/suggestions");
  }
}
