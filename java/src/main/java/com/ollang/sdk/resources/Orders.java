package com.ollang.sdk.resources;

import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.ollang.sdk.OllangClient;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.Map;

/** Create and track translation orders. */
public class Orders {

  private final OllangClient client;

  public Orders(OllangClient client) {
    this.client = client;
  }

  /**
   * Creates one or more orders.
   *
   * <p>The body matches the REST API: {@code orderType} (one of {@code cc}, {@code subtitle},
   * {@code document}, {@code aiDubbing}, {@code studioDubbing}, {@code proofreading},
   * {@code other}, {@code revision}), {@code level}, {@code projectId},
   * {@code targetLanguageConfigs} ({@code [{"language": "fr", "isRush": false}]}), and optional
   * fields such as {@code sourceLanguage}, {@code orderSubType} or {@code dubbingStyle}.
   *
   * @return the raw API response: an array of {@code {"orderId": ..., "orderType": ...}} entries
   *     (some order types create more than one order)
   */
  public JsonElement create(JsonObject params) {
    return client.post("/integration/orders/create", params);
  }

  /** Lists orders. */
  public JsonElement list() {
    return list(null);
  }

  /** Lists orders with pagination and filters. */
  public JsonElement list(ListOptions options) {
    return client.get("/integration/orders", options == null ? null : options.toQueryParams());
  }

  public JsonElement get(String orderId) {
    return client.get("/integration/orders/" + orderId);
  }

  public JsonElement cancel(String orderId) {
    return client.post("/integration/orders/cancel/" + orderId, null);
  }

  public JsonElement requestHumanReview(String orderId) {
    return client.post("/integration/orders/" + orderId + "/human-review", null);
  }

  /**
   * Runs a QC evaluation on an order. {@code params} may contain {@code customPrompt},
   * {@code accuracy}, {@code fluency}, {@code tone} and {@code culturalFit}; pass {@code null}
   * for the defaults.
   */
  public JsonElement runQcEvaluation(String orderId, JsonObject params) {
    return client.post("/integration/orders/" + orderId + "/qc", params);
  }

  public JsonElement rerun(String orderId, JsonObject params) {
    return client.post("/integration/orders/" + orderId + "/rerun", params);
  }

  /** Cancels a human review previously requested for an order. */
  public JsonElement cancelHumanReview(String orderId) {
    return client.post("/integration/orders/" + orderId + "/cancel-human-review", null);
  }

  /** Requests a video with the finished subtitles burned in. */
  public JsonElement requestSubtitleEmbedding(String orderId) {
    return client.post("/integration/orders/" + orderId + "/subtitle-embedding", null);
  }

  /**
   * Inspects the review gate an order is paused at, if any.
   *
   * <p>Reports which team tag owns the gate, the review type, when the order entered review, and
   * who can clear it. Useful when an order sits in the {@code review} status.
   */
  public JsonElement reviewInfo(String orderId) {
    return client.get("/integration/orders/" + orderId + "/review/info");
  }

  /**
   * Exports an order's timestamps, transcriptions and translations as XLSX.
   *
   * @return the raw file bytes; use {@link #exportXlsxToFile} to write them straight to disk
   */
  public byte[] exportXlsx(String orderId) {
    return client.getBytes("/integration/orders/" + orderId + "/export-xlsx");
  }

  /** Exports an order as XLSX and saves the workbook to {@code path}. */
  public Path exportXlsxToFile(String orderId, Path path) {
    byte[] data = exportXlsx(orderId);
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

  /** Pagination and filter options for {@link #list(ListOptions)}. */
  public static class ListOptions {
    private final Map<String, String> params = new LinkedHashMap<>();

    public ListOptions page(int page) {
      params.put("pageOptions[page]", String.valueOf(page));
      return this;
    }

    public ListOptions take(int take) {
      params.put("pageOptions[take]", String.valueOf(take));
      return this;
    }

    public ListOptions search(String search) {
      params.put("pageOptions[search]", search);
      return this;
    }

    public ListOptions orderBy(String orderBy) {
      params.put("pageOptions[orderBy]", orderBy);
      return this;
    }

    /** {@code asc} or {@code desc}. */
    public ListOptions orderDirection(String orderDirection) {
      params.put("pageOptions[orderDirection]", orderDirection);
      return this;
    }

    public ListOptions status(String status) {
      params.put("filter[status]", status);
      return this;
    }

    public ListOptions orderType(String orderType) {
      params.put("filter[type]", orderType);
      return this;
    }

    public ListOptions projectId(String projectId) {
      params.put("filter[projectId]", projectId);
      return this;
    }

    public Map<String, String> toQueryParams() {
      return params;
    }
  }
}
