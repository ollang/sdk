package com.ollang.sdk;

import com.google.gson.JsonElement;

/** Thrown when the Ollang API returns a non-2xx response. */
public class OllangApiException extends RuntimeException {

  private final int statusCode;
  private final String responseBody;
  private final JsonElement responseJson;

  public OllangApiException(String message, int statusCode, String responseBody, JsonElement responseJson) {
    super(message);
    this.statusCode = statusCode;
    this.responseBody = responseBody;
    this.responseJson = responseJson;
  }

  /** HTTP status code of the failed response. */
  public int getStatusCode() {
    return statusCode;
  }

  /** Raw response body of the failed response. */
  public String getResponseBody() {
    return responseBody;
  }

  /** Response body parsed as JSON, or {@code null} when the body was not valid JSON. */
  public JsonElement getResponseJson() {
    return responseJson;
  }
}
