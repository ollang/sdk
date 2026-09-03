package com.ollang.sdk.resources;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.ollang.sdk.OllangClient;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Browses folders and acts on every order inside them at once. */
public class Folders {

  private final OllangClient client;

  public Folders(OllangClient client) {
    this.client = client;
  }

  /** Lists folders. */
  public JsonElement list() {
    return list(null);
  }

  /** Lists folders with pagination and search. */
  public JsonElement list(ListOptions options) {
    return client.get("/integration/folder", options == null ? null : options.toQueryParams());
  }

  /** Lists the source/target language pairs of a folder's orders. */
  public JsonElement orderLanguagePairs(String folderId) {
    return orderLanguagePairs(folderId, null);
  }

  /** Lists the language pairs of a folder's orders, optionally filtered by order status. */
  public JsonElement orderLanguagePairs(String folderId, String status) {
    Map<String, String> params = new LinkedHashMap<>();
    if (status != null) {
      params.put("status", status);
    }
    return client.get(
        "/integration/folder/" + folderId + "/order-language-pairs",
        params.isEmpty() ? null : params);
  }

  /**
   * Assigns a translator to the folder's orders.
   *
   * <p>Narrow the assignment with {@code sourceLanguage} / {@code targetLanguage}; pass {@code
   * null} for both to cover every order in the folder. {@code deadline} is an ISO 8601 date.
   */
  public JsonElement assignTranslator(
      String folderId,
      String translatorId,
      String deadline,
      String sourceLanguage,
      String targetLanguage) {
    JsonObject body = new JsonObject();
    body.addProperty("translatorId", translatorId);
    if (deadline != null) {
      body.addProperty("deadline", deadline);
    }
    if (sourceLanguage != null) {
      body.addProperty("sourceLanguage", sourceLanguage);
    }
    if (targetLanguage != null) {
      body.addProperty("targetLanguage", targetLanguage);
    }
    return client.post("/integration/folder/" + folderId + "/assign-translator-to-orders", body);
  }

  /** Assigns a translator to every order in the folder. */
  public JsonElement assignTranslator(String folderId, String translatorId) {
    return assignTranslator(folderId, translatorId, null, null, null);
  }

  /** Removes translator assignments from the folder's orders. */
  public JsonElement unassignTranslator(
      String folderId, String sourceLanguage, String targetLanguage) {
    JsonObject body = new JsonObject();
    if (sourceLanguage != null) {
      body.addProperty("sourceLanguage", sourceLanguage);
    }
    if (targetLanguage != null) {
      body.addProperty("targetLanguage", targetLanguage);
    }
    return client.post(
        "/integration/folder/" + folderId + "/unassign-translator-from-orders", body);
  }

  /** Removes translator assignments from every order in the folder. */
  public JsonElement unassignTranslator(String folderId) {
    return unassignTranslator(folderId, null, null);
  }

  /**
   * Exports several folders as one multi-sheet XLSX workbook.
   *
   * @return the raw file bytes; use {@link #exportXlsxToFile} to write them straight to disk
   */
  public byte[] exportXlsx(List<String> folderIds, List<String> targetLanguages) {
    JsonObject body = new JsonObject();
    body.add("folderIds", toArray(folderIds));
    body.add("targetLanguages", toArray(targetLanguages));
    return client.postBytes("/integration/folder/export-xlsx", body);
  }

  /** Exports folders as XLSX and saves the workbook to {@code path}. */
  public Path exportXlsxToFile(List<String> folderIds, List<String> targetLanguages, Path path) {
    byte[] data = exportXlsx(folderIds, targetLanguages);
    try {
      Path parent = path.getParent();
      if (parent != null) {
        Files.createDirectories(parent);
      }
      Files.write(path, data);
    } catch (IOException e) {
      throw new UncheckedIOException("Could not write XLSX export to " + path, e);
    }
    return path;
  }

  private static JsonArray toArray(List<String> values) {
    JsonArray array = new JsonArray();
    if (values != null) {
      for (String value : values) {
        array.add(value);
      }
    }
    return array;
  }

  /** Pagination and search options for {@link #list(ListOptions)}. */
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

    public ListOptions orderBy(String orderBy) {
      params.put("orderBy", orderBy);
      return this;
    }

    public ListOptions orderDirection(String orderDirection) {
      params.put("orderDirection", orderDirection);
      return this;
    }

    public ListOptions search(String search) {
      params.put("search", search);
      return this;
    }

    public Map<String, String> toQueryParams() {
      return params;
    }
  }
}
