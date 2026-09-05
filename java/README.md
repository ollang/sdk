# Ollang Java SDK

Official Java SDK for the [Ollang API](https://api-docs.ollang.com) — translation, transcription, dubbing, closed captioning, and i18n management.

Requires Java 11+. Uses the JDK's built-in `java.net.http.HttpClient`; the only runtime dependency is [Gson](https://github.com/google/gson).

## Installation

Maven:

```xml
<dependency>
  <groupId>com.ollang</groupId>
  <artifactId>ollang-sdk</artifactId>
  <version>0.2.1</version>
</dependency>
```

Gradle:

```groovy
implementation 'com.ollang:ollang-sdk:0.2.1'
```

## Quick Start

```java
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import com.ollang.sdk.Ollang;
import java.nio.file.Path;

Ollang ollang = Ollang.builder()
    .apiKey(System.getenv("OLLANG_API_KEY"))
    .build();

// Upload a file (creates a project)
JsonElement upload = ollang.uploads().direct(Path.of("video.mp4"), "My Video", "en");
String projectId = upload.getAsJsonObject().get("projectId").getAsString();

// Create an order
JsonObject params = new JsonObject();
params.addProperty("orderType", "cc");
params.addProperty("level", 1);
params.addProperty("projectId", projectId);
params.add("targetLanguageConfigs", JsonParser.parseString(
    "[{\"language\":\"fr\",\"isRush\":false},{\"language\":\"de\",\"isRush\":false}]"));
JsonElement orders = ollang.orders().create(params);

// Check order status
String orderId = orders.getAsJsonArray().get(0).getAsJsonObject().get("orderId").getAsString();
JsonElement status = ollang.orders().get(orderId);
System.out.println(status);
```

Get your API key from your project settings at [Olabs](https://lab.ollang.com).

### Naming the uploaded file

The platform takes the stored file's extension from the name the file is sent
under, and rejects an upload it cannot get one from. The `Path` overloads use
the file's own name; the in-memory overload takes it as an argument:

```java
ollang.uploads().direct(bytes, "en.json", "App strings", "en", null);
```

The third argument is the display name for the created project; it does not
need an extension of its own.

### Uploading VTT subtitles

The VTT overloads take a source project ID and a display name, replacing the old
order ID argument. Source language comes from the project; the response
contains `projectId`.

```java
ollang.uploads().vtt(Path.of("subtitles.vtt"), projectId, "Subtitles");
ollang.uploads().vtt(bytes, "subtitles.vtt", projectId, "Subtitles");
```

## Resources

| Resource                      | Description                                          |
| ----------------------------- | ---------------------------------------------------- |
| `ollang.projects()`           | Create, read and list projects                       |
| `ollang.uploads()`            | Upload files, or register remote ones by URL         |
| `ollang.orders()`             | Create, track, review and export orders              |
| `ollang.folders()`            | Browse folders and act on all their orders at once   |
| `ollang.revisions()`          | Request revisions on completed orders                |
| `ollang.memories()`           | Translation memories and their items                 |
| `ollang.customInstructions()` | Set custom translation instructions                  |
| `ollang.content()`            | Import and export translation units                  |
| `ollang.billing()`            | Credit wallet and consumption history                |
| `ollang.locales()`            | Resolve and validate language codes                  |
| `ollang.figma()`              | Import Figma files and track their orders            |

All methods return the parsed JSON response as a Gson `JsonElement`. Non-2xx
responses throw `OllangApiException`, which carries the HTTP status code and
the response body (raw and parsed).

## Examples

```java
// List orders with pagination and filters
import com.ollang.sdk.resources.Orders;

JsonElement page = ollang.orders().list(
    new Orders.ListOptions().page(1).take(20).status("completed"));

// Request a revision on an order
ollang.revisions().create("ORDER_ID", "wrongSubtitle", "00:01:23", "Fix the terminology here");

// Custom instructions
ollang.customInstructions().create("tone", "Formal, brand-safe tone", null);

// Resolve a language code before using it
JsonElement languages = ollang.locales().search("portu");
JsonElement check = ollang.locales().validate("pt-PT");

// Translation memories
JsonElement memory = ollang.memories().create("Brand terms");
ollang.memories().importItems(
    memory.getAsJsonObject().get("id").getAsString(),
    List.of(Map.of(
        "sourceLanguage", "en",
        "targetLanguage", "fr",
        "sourceText", "Sign in",
        "targetText", "Se connecter")));

// Assign a translator to every French order in a folder
ollang.folders().assignTranslator("FOLDER_ID", "TRANSLATOR_ID", null, null, "fr");

// Export an order as XLSX, straight to disk
ollang.orders().exportXlsxToFile("ORDER_ID", Path.of("order.xlsx"));

// Credit balance
JsonElement wallet = ollang.billing().credits();

// Endpoints not wrapped yet? Use the underlying HTTP client:
JsonElement raw = ollang.client().get("/integration/orders");
```

### Binary exports

The XLSX endpoints return raw bytes rather than JSON. Each has a
`...ToFile` companion that writes the workbook to a path, creating parent
directories as needed:

```java
byte[] bytes = ollang.orders().exportXlsx("ORDER_ID");
Path saved = ollang.folders().exportXlsxToFile(
    List.of("FOLDER_ID"), List.of("fr", "de"), Path.of("out/folders.xlsx"));
```

## Configuration

```java
Ollang ollang = Ollang.builder()
    .apiKey("your-api-key")
    .baseUrl("https://api-integration.ollang.com") // optional override
    .timeout(java.time.Duration.ofSeconds(60))     // optional
    .build();
```

## Development

```bash
cd java
mvn test
```

## Documentation

Full API documentation: **[https://api-docs.ollang.com](https://api-docs.ollang.com)**

## License

MIT
