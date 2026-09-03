package com.ollang.sdk.resources;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.ollang.sdk.OllangClient;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Imports and exports translation units held in your content database. */
public class Content {

  private final OllangClient client;

  public Content(OllangClient client) {
    this.client = client;
  }

  /**
   * Imports translation units.
   *
   * <p>Each entry of {@code translations} needs {@code sourceText} and {@code targetText}, and
   * may carry {@code elementId} and {@code type} (defaults to {@code text}).
   */
  public JsonElement importContent(String targetLanguage, JsonArray translations) {
    JsonObject body = new JsonObject();
    body.addProperty("targetLanguage", targetLanguage);
    body.add("translations", translations);
    return client.post("/integration/content/import", body);
  }

  /** Exports content translations as JSON. */
  public JsonElement export() {
    return export(null);
  }

  /**
   * Exports content translations as JSON, filtered by language, tag or order.
   *
   * <p>List filters are sent as repeated bracket-suffixed query parameters ({@code
   * targetLanguages[]=fr&targetLanguages[]=de}), which is the encoding the API expects.
   */
  public JsonElement export(ExportOptions options) {
    return client.getMulti(
        "/integration/content/export", options == null ? null : options.toQueryParams());
  }

  /** Filters for {@link #export(ExportOptions)}. */
  public static class ExportOptions {

    private final Map<String, List<String>> params = new LinkedHashMap<>();

    public ExportOptions targetLanguage(String targetLanguage) {
      params.put("targetLanguage", Collections.singletonList(targetLanguage));
      return this;
    }

    public ExportOptions targetLanguages(List<String> targetLanguages) {
      params.put("targetLanguages[]", new ArrayList<>(targetLanguages));
      return this;
    }

    public ExportOptions tag(String tag) {
      params.put("tag", Collections.singletonList(tag));
      return this;
    }

    public ExportOptions tags(List<String> tags) {
      params.put("tags[]", new ArrayList<>(tags));
      return this;
    }

    public ExportOptions orderIds(List<String> orderIds) {
      params.put("orderIds[]", new ArrayList<>(orderIds));
      return this;
    }

    public Map<String, List<String>> toQueryParams() {
      return params;
    }
  }
}
