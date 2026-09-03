package com.ollang.sdk.resources;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.ollang.sdk.OllangClient;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Create, read and list projects. */
public class Projects {

  private final OllangClient client;

  public Projects(OllangClient client) {
    this.client = client;
  }

  public JsonElement get(String projectId) {
    return client.get("/integration/project/" + projectId);
  }

  public JsonElement list() {
    return list(null);
  }

  public JsonElement list(ListOptions options) {
    return client.get("/integration/project", options == null ? null : options.toQueryParams());
  }

  /**
   * Creates a project from a file the platform fetches itself.
   *
   * <p>The file at {@code url} is downloaded server-side, so its bytes never pass through your
   * process. Prefer this over {@code uploads().direct(...)} for large remote files. Each note is
   * a map such as {@code {"details": "...", "timeStamp": "00:01:23"}}.
   */
  public JsonElement createByUrl(
      String url,
      String name,
      String sourceLanguage,
      String folderId,
      List<Map<String, String>> notes) {
    JsonObject body = new JsonObject();
    body.addProperty("url", url);
    body.addProperty("name", name);
    body.addProperty("sourceLanguage", sourceLanguage);
    if (folderId != null) {
      body.addProperty("folderId", folderId);
    }
    if (notes != null) {
      JsonArray array = new JsonArray();
      for (Map<String, String> note : notes) {
        JsonObject entry = new JsonObject();
        for (Map.Entry<String, String> field : note.entrySet()) {
          entry.addProperty(field.getKey(), field.getValue());
        }
        array.add(entry);
      }
      body.add("notes", array);
    }
    return client.post("/integration/project/create-by-url", body);
  }

  /** Creates a project from a remote file URL. */
  public JsonElement createByUrl(String url, String name, String sourceLanguage) {
    return createByUrl(url, name, sourceLanguage, null, null);
  }

  /** Pagination options for {@link #list(ListOptions)}. */
  public static class ListOptions {
    private final Map<String, String> params = new LinkedHashMap<>();

    public ListOptions page(int page) {
      params.put("page", String.valueOf(page));
      return this;
    }

    public ListOptions take(int take) {
      params.put("take", String.valueOf(take));
      return this;
    }

    public ListOptions search(String search) {
      params.put("search", search);
      return this;
    }

    public ListOptions orderBy(String orderBy) {
      params.put("orderBy", orderBy);
      return this;
    }

    /** {@code asc} or {@code desc}. */
    public ListOptions orderDirection(String orderDirection) {
      params.put("orderDirection", orderDirection);
      return this;
    }

    public Map<String, String> toQueryParams() {
      return params;
    }
  }
}
