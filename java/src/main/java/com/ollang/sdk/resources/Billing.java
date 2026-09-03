package com.ollang.sdk.resources;

import com.google.gson.JsonElement;
import com.ollang.sdk.OllangClient;
import java.util.LinkedHashMap;
import java.util.Map;

/** Credit balance and per-order consumption history. */
public class Billing {

  private final OllangClient client;

  public Billing(OllangClient client) {
    this.client = client;
  }

  /** Retrieves the credit wallet: balance and currency. */
  public JsonElement credits() {
    return client.get("/integration/credits");
  }

  /** Lists credit consumption entries. */
  public JsonElement consumption() {
    return consumption(null);
  }

  /** Lists credit consumption entries with pagination and filters. */
  public JsonElement consumption(ConsumptionOptions options) {
    return client.get(
        "/integration/consumption", options == null ? null : options.toQueryParams());
  }

  /**
   * Pagination and filter options for {@link #consumption(ConsumptionOptions)}.
   *
   * <p>Pagination setters map to {@code pageOptions[...]} query parameters and filters to {@code
   * filter[...]}.
   */
  public static class ConsumptionOptions {

    private final Map<String, String> params = new LinkedHashMap<>();

    public ConsumptionOptions page(int page) {
      params.put("pageOptions[page]", String.valueOf(page));
      return this;
    }

    public ConsumptionOptions take(int take) {
      params.put("pageOptions[take]", String.valueOf(take));
      return this;
    }

    public ConsumptionOptions orderBy(String orderBy) {
      params.put("pageOptions[orderBy]", orderBy);
      return this;
    }

    public ConsumptionOptions orderDirection(String orderDirection) {
      params.put("pageOptions[orderDirection]", orderDirection);
      return this;
    }

    public ConsumptionOptions search(String search) {
      params.put("pageOptions[search]", search);
      return this;
    }

    /** Filters to entries created on or after this ISO 8601 date. */
    public ConsumptionOptions from(String from) {
      params.put("filter[from]", from);
      return this;
    }

    /** Filters to entries created on or before this ISO 8601 date. */
    public ConsumptionOptions to(String to) {
      params.put("filter[to]", to);
      return this;
    }

    public ConsumptionOptions provider(String provider) {
      params.put("filter[provider]", provider);
      return this;
    }

    public ConsumptionOptions orderType(String orderType) {
      params.put("filter[orderType]", orderType);
      return this;
    }

    public ConsumptionOptions createdBy(String createdBy) {
      params.put("filter[createdBy]", createdBy);
      return this;
    }

    public ConsumptionOptions orderId(String orderId) {
      params.put("filter[orderId]", orderId);
      return this;
    }

    public ConsumptionOptions tag(String tag) {
      params.put("filter[tag]", tag);
      return this;
    }

    public Map<String, String> toQueryParams() {
      return params;
    }
  }
}
