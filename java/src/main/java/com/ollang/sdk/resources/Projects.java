package com.ollang.sdk.resources;

import com.google.gson.JsonElement;
import com.ollang.sdk.OllangClient;
import java.util.LinkedHashMap;
import java.util.Map;

/** Read and list projects. */
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
