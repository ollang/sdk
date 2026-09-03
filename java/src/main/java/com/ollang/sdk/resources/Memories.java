package com.ollang.sdk.resources;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.ollang.sdk.OllangClient;
import java.util.List;
import java.util.Map;

/**
 * Translation memories and the items stored in them.
 *
 * <p>A memory is a reusable store of source/target segment pairs that orders can draw on. Pass
 * memory IDs to order creation through the {@code selectedMemories} field.
 */
public class Memories {

  private final OllangClient client;

  public Memories(OllangClient client) {
    this.client = client;
  }

  /** Lists all memories on the account. */
  public JsonElement list() {
    return client.get("/integration/memories");
  }

  /** Creates an empty memory. */
  public JsonElement create(String title) {
    JsonObject body = new JsonObject();
    body.addProperty("title", title);
    return client.post("/integration/memories", body);
  }

  /** Retrieves a single memory by ID. */
  public JsonElement get(String memoryId) {
    return client.get("/integration/memories/" + memoryId);
  }

  /** Renames a memory. */
  public JsonElement update(String memoryId, String title) {
    JsonObject body = new JsonObject();
    body.addProperty("title", title);
    return client.patch("/integration/memories/" + memoryId, body);
  }

  /** Deletes a memory and everything stored in it. */
  public JsonElement delete(String memoryId) {
    return client.delete("/integration/memories/" + memoryId);
  }

  /**
   * Imports segment pairs into a memory.
   *
   * <p>Each item needs {@code sourceLanguage}, {@code targetLanguage}, {@code sourceText} and
   * {@code targetText}. Importing is asynchronous: the response carries a {@code jobId} you can
   * poll with {@link #getImportJob(String)}.
   */
  public JsonElement importItems(String memoryId, JsonArray items) {
    JsonObject body = new JsonObject();
    body.add("items", items);
    return client.post("/integration/memories/" + memoryId + "/items/import", body);
  }

  /**
   * Imports segment pairs into a memory, building the request from maps.
   *
   * @see #importItems(String, JsonArray)
   */
  public JsonElement importItems(String memoryId, List<Map<String, String>> items) {
    JsonArray array = new JsonArray();
    for (Map<String, String> item : items) {
      JsonObject entry = new JsonObject();
      for (Map.Entry<String, String> field : item.entrySet()) {
        entry.addProperty(field.getKey(), field.getValue());
      }
      array.add(entry);
    }
    return importItems(memoryId, array);
  }

  /** Checks the progress of an import started by {@link #importItems(String, JsonArray)}. */
  public JsonElement getImportJob(String jobId) {
    return client.get("/integration/memories/import-jobs/" + jobId);
  }
}
