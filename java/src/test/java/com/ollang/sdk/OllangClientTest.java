package com.ollang.sdk;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import com.ollang.sdk.resources.Orders;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class OllangClientTest {

  private HttpServer server;
  private Ollang ollang;
  private final List<RecordedRequest> requests = new ArrayList<>();
  private volatile int nextStatus = 200;
  private volatile String nextBody = "{\"ok\":true}";

  static class RecordedRequest {
    String method;
    String path;
    String query;
    String apiKey;
    String contentType;
    String body;
  }

  @BeforeEach
  void setUp() throws IOException {
    server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
    server.createContext(
        "/",
        exchange -> {
          RecordedRequest recorded = new RecordedRequest();
          recorded.method = exchange.getRequestMethod();
          recorded.path = exchange.getRequestURI().getPath();
          recorded.query = exchange.getRequestURI().getRawQuery();
          recorded.apiKey = exchange.getRequestHeaders().getFirst("X-Api-Key");
          recorded.contentType = exchange.getRequestHeaders().getFirst("Content-Type");
          recorded.body = new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
          requests.add(recorded);

          byte[] response = nextBody.getBytes(StandardCharsets.UTF_8);
          exchange.getResponseHeaders().set("Content-Type", "application/json");
          exchange.sendResponseHeaders(nextStatus, response.length);
          try (OutputStream out = exchange.getResponseBody()) {
            out.write(response);
          }
        });
    server.start();

    ollang =
        Ollang.builder()
            .apiKey("test-key")
            .baseUrl("http://127.0.0.1:" + server.getAddress().getPort())
            .build();
  }

  @AfterEach
  void tearDown() {
    server.stop(0);
  }

  @Test
  void requiresApiKey() {
    assertThrows(IllegalArgumentException.class, () -> Ollang.builder().build());
  }

  @Test
  void healthCheckSendsApiKey() {
    JsonObject result = ollang.healthCheck().getAsJsonObject();
    assertTrue(result.get("ok").getAsBoolean());

    RecordedRequest request = requests.get(0);
    assertEquals("GET", request.method);
    assertEquals("/health", request.path);
    assertEquals("test-key", request.apiKey);
  }

  @Test
  void ordersCreatePostsJsonBody() {
    nextBody = "[{\"orderId\":\"o1\"}]";

    JsonObject params = new JsonObject();
    params.addProperty("orderType", "cc");
    params.addProperty("level", 1);
    JsonObject result = ollang.orders().create(params).getAsJsonArray().get(0).getAsJsonObject();
    assertEquals("o1", result.get("orderId").getAsString());

    RecordedRequest request = requests.get(0);
    assertEquals("POST", request.method);
    assertEquals("/integration/orders/create", request.path);
    assertEquals("application/json", request.contentType);
    assertEquals(params, JsonParser.parseString(request.body));
  }

  @Test
  void ordersListEncodesQueryParams() {
    ollang.orders().list(new Orders.ListOptions().page(2).take(10).status("completed"));

    RecordedRequest request = requests.get(0);
    assertEquals("/integration/orders", request.path);
    assertEquals(
        "pageOptions%5Bpage%5D=2&pageOptions%5Btake%5D=10&filter%5Bstatus%5D=completed",
        request.query);
  }

  @Test
  void customInstructionsUpdateUsesPatch() {
    ollang.customInstructions().update("ci1", null, "new value", null);

    RecordedRequest request = requests.get(0);
    assertEquals("PATCH", request.method);
    assertEquals("/integration/custom-instructions/ci1", request.path);
    assertEquals("{\"value\":\"new value\"}", request.body);
  }

  @Test
  void uploadDirectSendsMultipart() {
    ollang
        .uploads()
        .direct("hello".getBytes(StandardCharsets.UTF_8), "clip.mp4", "My Clip", "en", null);

    RecordedRequest request = requests.get(0);
    assertEquals("POST", request.method);
    assertEquals("/integration/upload/direct", request.path);
    assertTrue(request.contentType.startsWith("multipart/form-data; boundary="));

    String boundary = request.contentType.substring("multipart/form-data; boundary=".length());
    assertTrue(request.body.contains("--" + boundary + "\r\n"));
    assertTrue(request.body.contains("name=\"file\"; filename=\"clip.mp4\""));
    assertTrue(request.body.contains("hello"));
    assertTrue(request.body.contains("name=\"name\"\r\n\r\nMy Clip"));
    assertTrue(request.body.contains("name=\"sourceLanguage\"\r\n\r\nen"));
    assertTrue(request.body.endsWith("--" + boundary + "--\r\n"));
  }

  @Test
  void errorResponsesRaiseApiException() {
    nextStatus = 401;
    nextBody = "{\"message\":\"invalid key\"}";

    OllangApiException exception =
        assertThrows(OllangApiException.class, () -> ollang.projects().list());
    assertEquals(401, exception.getStatusCode());
    assertEquals(
        "invalid key",
        exception.getResponseJson().getAsJsonObject().get("message").getAsString());
  }

  @Test
  void revisionsBuildPaths() {
    ollang.revisions().create("o1", "text", "00:01:23", "typo");
    ollang.revisions().list("o1");
    ollang.revisions().delete("o1", "r1");

    assertEquals("/integration/revision/o1", requests.get(0).path);
    assertEquals(
        "{\"type\":\"text\",\"time\":\"00:01:23\",\"description\":\"typo\"}",
        requests.get(0).body);
    assertEquals("GET", requests.get(1).method);
    assertEquals("DELETE", requests.get(2).method);
    assertEquals("/integration/revision/o1/r1", requests.get(2).path);
  }
}
