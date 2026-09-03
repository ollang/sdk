package com.ollang.sdk;

import com.google.gson.Gson;
import com.google.gson.JsonElement;
import com.google.gson.JsonNull;
import com.google.gson.JsonParser;
import com.google.gson.JsonSyntaxException;
import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.StringJoiner;

/**
 * Low-level HTTP client for the Ollang integration API.
 *
 * <p>Handles authentication ({@code X-Api-Key} header), JSON encoding/decoding, and error
 * mapping. Resource classes build on top of this. Also usable directly for endpoints the SDK
 * does not wrap yet.
 */
public class OllangClient {

  public static final String DEFAULT_BASE_URL = "https://api-integration.ollang.com";

  private final String apiKey;
  private final String baseUrl;
  private final Duration timeout;
  private final HttpClient http;
  private final Gson gson = new Gson();

  public OllangClient(String apiKey, String baseUrl, Duration timeout) {
    if (apiKey == null || apiKey.isEmpty()) {
      throw new IllegalArgumentException("apiKey is required");
    }
    this.apiKey = apiKey;
    String url = baseUrl == null || baseUrl.isEmpty() ? DEFAULT_BASE_URL : baseUrl;
    this.baseUrl = url.endsWith("/") ? url.substring(0, url.length() - 1) : url;
    this.timeout = timeout == null ? Duration.ofSeconds(60) : timeout;
    this.http = HttpClient.newBuilder().connectTimeout(this.timeout).build();
  }

  public JsonElement get(String path) {
    return get(path, null);
  }

  public JsonElement get(String path, Map<String, String> queryParams) {
    HttpRequest request = baseRequest(path + queryString(queryParams)).GET().build();
    return send(request);
  }

  /**
   * GETs with repeated query parameters, for filters the API expects more than once (for example
   * {@code targetLanguages[]=fr&targetLanguages[]=de}).
   */
  public JsonElement getMulti(String path, Map<String, List<String>> queryParams) {
    HttpRequest request = baseRequest(path + multiQueryString(queryParams)).GET().build();
    return send(request);
  }

  public JsonElement post(String path, JsonElement body) {
    HttpRequest request =
        baseRequest(path)
            .header("Content-Type", "application/json")
            .POST(jsonPublisher(body))
            .build();
    return send(request);
  }

  public JsonElement patch(String path, JsonElement body) {
    HttpRequest request =
        baseRequest(path)
            .header("Content-Type", "application/json")
            .method("PATCH", jsonPublisher(body))
            .build();
    return send(request);
  }

  public JsonElement delete(String path) {
    return send(baseRequest(path).DELETE().build());
  }

  /** GETs an endpoint that returns a binary body (for example an XLSX export). */
  public byte[] getBytes(String path) {
    return getBytes(path, null);
  }

  /** GETs an endpoint that returns a binary body (for example an XLSX export). */
  public byte[] getBytes(String path, Map<String, String> queryParams) {
    return sendForBytes(baseRequest(path + queryString(queryParams)).GET().build());
  }

  /** POSTs to an endpoint that returns a binary body (for example an XLSX export). */
  public byte[] postBytes(String path, JsonElement body) {
    HttpRequest request =
        baseRequest(path)
            .header("Content-Type", "application/json")
            .POST(jsonPublisher(body))
            .build();
    return sendForBytes(request);
  }

  public JsonElement postMultipart(String path, MultipartBody body) {
    HttpRequest request =
        baseRequest(path)
            .header("Content-Type", body.contentType())
            .POST(body.bodyPublisher())
            .build();
    return send(request);
  }

  private HttpRequest.Builder baseRequest(String pathAndQuery) {
    return HttpRequest.newBuilder()
        .uri(URI.create(baseUrl + pathAndQuery))
        .timeout(timeout)
        .header("X-Api-Key", apiKey)
        .header("Accept", "*/*");
  }

  private HttpRequest.BodyPublisher jsonPublisher(JsonElement body) {
    if (body == null || body.isJsonNull()) {
      return HttpRequest.BodyPublishers.noBody();
    }
    return HttpRequest.BodyPublishers.ofString(gson.toJson(body), StandardCharsets.UTF_8);
  }

  private byte[] sendForBytes(HttpRequest request) {
    HttpResponse<byte[]> response;
    try {
      response = http.send(request, HttpResponse.BodyHandlers.ofByteArray());
    } catch (IOException e) {
      throw new OllangApiException(
          "Ollang API request failed: "
              + request.method()
              + " "
              + request.uri()
              + " ("
              + e.getMessage()
              + ")",
          -1,
          null,
          null);
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      throw new OllangApiException("Ollang API request interrupted", -1, null, null);
    }

    if (response.statusCode() < 200 || response.statusCode() >= 300) {
      String body = new String(response.body(), StandardCharsets.UTF_8);
      throw new OllangApiException(
          "Ollang API request failed: "
              + request.method()
              + " "
              + request.uri()
              + " -> "
              + response.statusCode(),
          response.statusCode(),
          body,
          parseJsonOrNull(body));
    }

    return response.body();
  }

  private JsonElement send(HttpRequest request) {
    HttpResponse<String> response;
    try {
      response = http.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
    } catch (IOException e) {
      throw new OllangApiException(
          "Ollang API request failed: " + request.method() + " " + request.uri() + " (" + e.getMessage() + ")",
          -1,
          null,
          null);
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      throw new OllangApiException("Ollang API request interrupted", -1, null, null);
    }

    String body = response.body();
    JsonElement json = parseJsonOrNull(body);

    if (response.statusCode() < 200 || response.statusCode() >= 300) {
      throw new OllangApiException(
          "Ollang API request failed: "
              + request.method()
              + " "
              + request.uri()
              + " -> "
              + response.statusCode(),
          response.statusCode(),
          body,
          json);
    }

    return json == null ? JsonNull.INSTANCE : json;
  }

  private static JsonElement parseJsonOrNull(String body) {
    if (body == null || body.isEmpty()) {
      return null;
    }
    try {
      return JsonParser.parseString(body);
    } catch (JsonSyntaxException e) {
      return null;
    }
  }

  static String multiQueryString(Map<String, List<String>> queryParams) {
    if (queryParams == null || queryParams.isEmpty()) {
      return "";
    }
    StringJoiner joiner = new StringJoiner("&", "?", "");
    for (Map.Entry<String, List<String>> entry : queryParams.entrySet()) {
      for (String value : entry.getValue()) {
        joiner.add(encode(entry.getKey()) + "=" + encode(value));
      }
    }
    return joiner.toString().equals("?") ? "" : joiner.toString();
  }

  static String queryString(Map<String, String> queryParams) {
    if (queryParams == null || queryParams.isEmpty()) {
      return "";
    }
    StringJoiner joiner = new StringJoiner("&", "?", "");
    for (Map.Entry<String, String> entry : queryParams.entrySet()) {
      joiner.add(encode(entry.getKey()) + "=" + encode(entry.getValue()));
    }
    return joiner.toString();
  }

  private static String encode(String value) {
    return URLEncoder.encode(value, StandardCharsets.UTF_8);
  }
}
