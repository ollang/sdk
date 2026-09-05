package com.ollang.sdk;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import com.ollang.sdk.resources.Billing;
import com.ollang.sdk.resources.Content;
import com.ollang.sdk.resources.Orders;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.LinkedHashMap;
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
  private volatile byte[] nextRawBody = null;

  static class RecordedRequest {
    String method;
    String path;
    String query;
    String apiKey;
    String contentType;
    String contentLength;
    String body;
    byte[] rawBody;
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
          recorded.contentLength = exchange.getRequestHeaders().getFirst("Content-Length");
          recorded.rawBody = exchange.getRequestBody().readAllBytes();
          recorded.body = new String(recorded.rawBody, StandardCharsets.ISO_8859_1);
          requests.add(recorded);

          byte[] response =
              nextRawBody != null ? nextRawBody : nextBody.getBytes(StandardCharsets.UTF_8);
          exchange
              .getResponseHeaders()
              .set(
                  "Content-Type",
                  nextRawBody != null
                      ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                      : "application/json");
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
    assertEquals(String.valueOf(request.body.getBytes(StandardCharsets.UTF_8).length), request.contentLength);
  }

  @Test
  void uploadDirectFromPathStreamsFile() throws IOException {
    Path file = Files.createTempFile("ollang-test", ".mp4");
    try {
      byte[] content = new byte[300_000];
      for (int i = 0; i < content.length; i++) {
        content[i] = (byte) (i % 251);
      }
      Files.write(file, content);

      ollang.uploads().direct(file, "Big Clip", "en");

      RecordedRequest request = requests.get(0);
      assertEquals("/integration/upload/direct", request.path);
      assertTrue(request.contentType.startsWith("multipart/form-data; boundary="));
      String boundary = request.contentType.substring("multipart/form-data; boundary=".length());
      assertEquals(String.valueOf(request.body.getBytes(StandardCharsets.ISO_8859_1).length), request.contentLength);
      assertTrue(request.body.contains("filename=\"" + file.getFileName() + "\""));
      assertTrue(request.body.contains("name=\"name\"\r\n\r\nBig Clip"));
      assertTrue(request.body.endsWith("--" + boundary + "--\r\n"));

      // The streamed file content must arrive intact, byte for byte.
      byte[] raw = request.rawBody;
      int start = indexOf(raw, "\r\n\r\n".getBytes(StandardCharsets.US_ASCII), 0) + 4;
      byte[] received = java.util.Arrays.copyOfRange(raw, start, start + content.length);
      assertTrue(java.util.Arrays.equals(content, received));
    } finally {
      Files.deleteIfExists(file);
    }
  }

  @Test
  void uploadVttSendsProjectFieldsForBytesAndPaths() throws IOException {
    Path file = Files.createTempFile("ollang-subtitles", ".vtt");
    try {
      Files.write(file, "WEBVTT".getBytes(StandardCharsets.UTF_8));
      ollang.uploads().vtt("WEBVTT".getBytes(StandardCharsets.UTF_8), "subs.vtt", "p1", "Subtitles");
      ollang.uploads().vtt(file, "p1", "Subtitles");
      for (RecordedRequest request : requests) {
        assertEquals("/integration/upload/vtt", request.path);
        assertTrue(request.body.contains("name=\"projectId\"\r\n\r\np1"));
        assertTrue(request.body.contains("name=\"name\"\r\n\r\nSubtitles"));
        assertFalse(request.body.contains("name=\"orderId\""));
        assertTrue(request.body.contains("WEBVTT"));
      }
    } finally {
      Files.deleteIfExists(file);
    }
  }

  @Test
  void multipartContentLengthMatchesEncodedBody() {
    MultipartBody body =
        new MultipartBody()
            .addFile("file", "a.bin", new byte[] {1, 2, 3}, null)
            .addField("name", "n\u00e4me");
    assertEquals(body.toBytes().length, body.contentLength());
  }

  private static int indexOf(byte[] haystack, byte[] needle, int from) {
    outer:
    for (int i = from; i <= haystack.length - needle.length; i++) {
      for (int j = 0; j < needle.length; j++) {
        if (haystack[i + j] != needle[j]) {
          continue outer;
        }
      }
      return i;
    }
    return -1;
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
    ollang.revisions().create("o1", "wrongSubtitle", "00:01:23", "typo");
    ollang.revisions().list("o1");
    ollang.revisions().delete("o1", "r1");

    assertEquals("/integration/revision/o1", requests.get(0).path);
    assertEquals(
        "{\"type\":\"wrongSubtitle\",\"time\":\"00:01:23\",\"description\":\"typo\"}",
        requests.get(0).body);
    assertEquals("GET", requests.get(1).method);
    assertEquals("DELETE", requests.get(2).method);
    assertEquals("/integration/revision/o1/r1", requests.get(2).path);
  }

  @Test
  void memoriesCrudPaths() {
    ollang.memories().list();
    ollang.memories().create("Brand terms");
    ollang.memories().get("m1");
    ollang.memories().update("m1", "Renamed");
    ollang.memories().delete("m1");

    assertEquals("GET", requests.get(0).method);
    assertEquals("/integration/memories", requests.get(0).path);
    assertEquals("POST", requests.get(1).method);
    assertEquals("{\"title\":\"Brand terms\"}", requests.get(1).body);
    assertEquals("/integration/memories/m1", requests.get(2).path);
    assertEquals("PATCH", requests.get(3).method);
    assertEquals("{\"title\":\"Renamed\"}", requests.get(3).body);
    assertEquals("DELETE", requests.get(4).method);
  }

  @Test
  void memoriesImportItemsFromMaps() {
    List<Map<String, String>> items = new ArrayList<>();
    Map<String, String> item = new LinkedHashMap<>();
    item.put("sourceLanguage", "en");
    item.put("targetLanguage", "fr");
    item.put("sourceText", "hello");
    item.put("targetText", "bonjour");
    items.add(item);

    ollang.memories().importItems("m1", items);

    RecordedRequest request = requests.get(0);
    assertEquals("/integration/memories/m1/items/import", request.path);
    JsonObject body = JsonParser.parseString(request.body).getAsJsonObject();
    assertEquals(
        "bonjour",
        body.getAsJsonArray("items").get(0).getAsJsonObject().get("targetText").getAsString());
  }

  @Test
  void foldersAssignAndUnassignTranslator() {
    ollang.folders().assignTranslator("f1", "t1", "2026-01-01", null, "fr");
    ollang.folders().unassignTranslator("f1", null, "fr");

    assertEquals("/integration/folder/f1/assign-translator-to-orders", requests.get(0).path);
    JsonObject assign = JsonParser.parseString(requests.get(0).body).getAsJsonObject();
    assertEquals("t1", assign.get("translatorId").getAsString());
    assertEquals("2026-01-01", assign.get("deadline").getAsString());
    assertEquals("fr", assign.get("targetLanguage").getAsString());

    assertEquals("/integration/folder/f1/unassign-translator-from-orders", requests.get(1).path);
    assertEquals("{\"targetLanguage\":\"fr\"}", requests.get(1).body);
  }

  @Test
  void foldersOrderLanguagePairsFiltersByStatus() {
    ollang.folders().orderLanguagePairs("f1", "completed");

    RecordedRequest request = requests.get(0);
    assertEquals("/integration/folder/f1/order-language-pairs", request.path);
    assertEquals("status=completed", request.query);
  }

  @Test
  void foldersExportXlsxWritesBytesToFile() throws IOException {
    byte[] xlsx = new byte[] {0x50, 0x4B, 0x03, 0x04, 0x01, 0x02};
    nextRawBody = xlsx;

    Path target = Files.createTempDirectory("ollang-test").resolve("nested/folders.xlsx");
    Path written =
        ollang.folders().exportXlsxToFile(List.of("f1", "f2"), List.of("fr", "de"), target);

    assertEquals(target, written);
    assertArrayEquals(xlsx, Files.readAllBytes(target));

    RecordedRequest request = requests.get(0);
    assertEquals("POST", request.method);
    assertEquals("/integration/folder/export-xlsx", request.path);
    JsonObject body = JsonParser.parseString(request.body).getAsJsonObject();
    assertEquals(2, body.getAsJsonArray("folderIds").size());
    assertEquals("de", body.getAsJsonArray("targetLanguages").get(1).getAsString());
  }

  @Test
  void orderExportXlsxReturnsRawBytes() {
    byte[] xlsx = new byte[] {0x50, 0x4B, 0x03, 0x04};
    nextRawBody = xlsx;

    byte[] result = ollang.orders().exportXlsx("o1");

    assertArrayEquals(xlsx, result);
    assertEquals("GET", requests.get(0).method);
    assertEquals("/integration/orders/o1/export-xlsx", requests.get(0).path);
  }

  @Test
  void orderReviewAndEmbeddingPaths() {
    ollang.orders().cancelHumanReview("o1");
    ollang.orders().requestSubtitleEmbedding("o1");
    ollang.orders().reviewInfo("o1");

    assertEquals("/integration/orders/o1/cancel-human-review", requests.get(0).path);
    assertEquals("/integration/orders/o1/subtitle-embedding", requests.get(1).path);
    assertEquals("GET", requests.get(2).method);
    assertEquals("/integration/orders/o1/review/info", requests.get(2).path);
  }

  @Test
  void contentExportRepeatsBracketQueryParams() {
    ollang
        .content()
        .export(new Content.ExportOptions().targetLanguages(List.of("fr", "de")).tag("ui"));

    RecordedRequest request = requests.get(0);
    assertEquals("/integration/content/export", request.path);
    assertEquals("targetLanguages%5B%5D=fr&targetLanguages%5B%5D=de&tag=ui", request.query);
  }

  @Test
  void contentImportPostsTranslations() {
    JsonArray translations = new JsonArray();
    JsonObject unit = new JsonObject();
    unit.addProperty("sourceText", "hi");
    unit.addProperty("targetText", "salut");
    translations.add(unit);

    ollang.content().importContent("fr", translations);

    RecordedRequest request = requests.get(0);
    assertEquals("/integration/content/import", request.path);
    JsonObject body = JsonParser.parseString(request.body).getAsJsonObject();
    assertEquals("fr", body.get("targetLanguage").getAsString());
    assertEquals(1, body.getAsJsonArray("translations").size());
  }

  @Test
  void billingConsumptionUsesBracketParams() {
    ollang
        .billing()
        .consumption(new Billing.ConsumptionOptions().page(2).from("2026-01-01").provider("deepl"));

    RecordedRequest request = requests.get(0);
    assertEquals("/integration/consumption", request.path);
    assertEquals(
        "pageOptions%5Bpage%5D=2&filter%5Bfrom%5D=2026-01-01&filter%5Bprovider%5D=deepl",
        request.query);
  }

  @Test
  void localesValidateEncodesTag() {
    ollang.locales().languages();
    ollang.locales().search("portu");
    ollang.locales().validate("pt-PT");

    assertEquals("/integration/locales/languages", requests.get(0).path);
    assertEquals("q=portu", requests.get(1).query);
    assertEquals("/integration/locales/validate/pt-PT", requests.get(2).path);
  }

  @Test
  void figmaPaths() {
    ollang.figma().createOrder("abc", "https://figma.com/file/abc", "en", List.of("fr"), "f1");
    ollang.figma().listOrders("abc");
    ollang.figma().orderStatus("o1");

    assertEquals("/integration/orders/figma/create", requests.get(0).path);
    JsonObject body = JsonParser.parseString(requests.get(0).body).getAsJsonObject();
    assertEquals("abc", body.get("fileKey").getAsString());
    assertEquals("f1", body.get("folderId").getAsString());
    assertEquals("fileKey=abc", requests.get(1).query);
    assertEquals("/integration/orders/figma/o1/status", requests.get(2).path);
  }

  @Test
  void projectCreateByUrlAndUploadDirectUrl() {
    ollang.projects().createByUrl("https://example.com/a.mp4", "a.mp4", "en");
    ollang.uploads().directUrl("https://example.com/a.mp4", "a.mp4", 1234L, "en");

    assertEquals("/integration/project/create-by-url", requests.get(0).path);
    JsonObject project = JsonParser.parseString(requests.get(0).body).getAsJsonObject();
    assertEquals("a.mp4", project.get("name").getAsString());

    assertEquals("/integration/upload/direct-url", requests.get(1).path);
    JsonObject upload = JsonParser.parseString(requests.get(1).body).getAsJsonObject();
    assertEquals("a.mp4", upload.get("originalname").getAsString());
    assertEquals(1234L, upload.get("size").getAsLong());
  }
}
