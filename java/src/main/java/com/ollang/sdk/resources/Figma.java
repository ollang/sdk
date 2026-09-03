package com.ollang.sdk.resources;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.ollang.sdk.OllangClient;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Imports Figma files and tracks the orders created from them. */
public class Figma {

  private final OllangClient client;

  public Figma(OllangClient client) {
    this.client = client;
  }

  /** Imports a Figma file and creates translation orders in one step. */
  public JsonElement createOrder(
      String fileKey,
      String fileUrl,
      String sourceLanguage,
      List<String> targetLanguages,
      String folderId) {
    JsonObject body = new JsonObject();
    body.addProperty("fileKey", fileKey);
    body.addProperty("fileUrl", fileUrl);
    body.addProperty("sourceLanguage", sourceLanguage);
    JsonArray languages = new JsonArray();
    for (String language : targetLanguages) {
      languages.add(language);
    }
    body.add("targetLanguages", languages);
    if (folderId != null) {
      body.addProperty("folderId", folderId);
    }
    return client.post("/integration/orders/figma/create", body);
  }

  /** Imports a Figma file into the account's default folder. */
  public JsonElement createOrder(
      String fileKey, String fileUrl, String sourceLanguage, List<String> targetLanguages) {
    return createOrder(fileKey, fileUrl, sourceLanguage, targetLanguages, null);
  }

  /** Lists the orders created from a given Figma file. */
  public JsonElement listOrders(String fileKey) {
    Map<String, String> params = new LinkedHashMap<>();
    params.put("fileKey", fileKey);
    return client.get("/integration/orders/figma", params);
  }

  /** Checks the status of a single Figma order. */
  public JsonElement orderStatus(String orderId) {
    return client.get("/integration/orders/figma/" + orderId + "/status");
  }
}
