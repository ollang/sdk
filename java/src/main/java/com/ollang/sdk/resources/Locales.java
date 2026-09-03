package com.ollang.sdk.resources;

import com.google.gson.JsonElement;
import com.ollang.sdk.OllangClient;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * The platform language catalogue.
 *
 * <p>Order and project creation match language codes exactly and reject anything not in the
 * catalogue, so resolve uncertain codes here rather than guessing. Codes are mostly ISO 639-1
 * with regional and platform-specific variants ({@code pt} is Portuguese (Brazil), {@code pt-PT}
 * is Portugal).
 */
public class Locales {

  private final OllangClient client;

  public Locales(OllangClient client) {
    this.client = client;
  }

  /** Lists supported languages with their regional variants. */
  public JsonElement languages() {
    return client.get("/integration/locales/languages");
  }

  /** Searches languages by name, native name or code. */
  public JsonElement search(String query) {
    Map<String, String> params = new LinkedHashMap<>();
    params.put("q", query);
    return client.get("/integration/locales/search", params);
  }

  /**
   * Checks a language code against the catalogue.
   *
   * @return whether the code is accepted, its parsed language and region, and why it failed if it
   *     did
   */
  public JsonElement validate(String tag) {
    return client.get(
        "/integration/locales/validate/" + URLEncoder.encode(tag, StandardCharsets.UTF_8));
  }
}
