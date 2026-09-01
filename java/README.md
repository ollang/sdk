# Ollang Java SDK

Official Java SDK for the [Ollang API](https://api-docs.ollang.com) — translation, transcription, dubbing, closed captioning, and i18n management.

Requires Java 11+. Uses the JDK's built-in `java.net.http.HttpClient`; the only runtime dependency is [Gson](https://github.com/google/gson).

## Installation

Maven:

```xml
<dependency>
  <groupId>com.ollang</groupId>
  <artifactId>ollang-sdk</artifactId>
  <version>0.1.0</version>
</dependency>
```

Gradle:

```groovy
implementation 'com.ollang:ollang-sdk:0.1.0'
```

> Not yet published to Maven Central — until then, build from source with `mvn install` in this directory.

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

## Resources

| Resource                       | Description                            |
| ------------------------------ | -------------------------------------- |
| `ollang.projects()`            | Read and list projects                 |
| `ollang.uploads()`             | Upload files (video, audio, documents) |
| `ollang.orders()`              | Create and track translation orders    |
| `ollang.revisions()`           | Request revisions on completed orders  |
| `ollang.customInstructions()`  | Set custom translation instructions    |

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
ollang.revisions().create("ORDER_ID", "text", "00:01:23", "Fix the terminology here");

// Custom instructions
ollang.customInstructions().create("tone", "Formal, brand-safe tone", null);

// Endpoints not wrapped yet? Use the underlying HTTP client:
JsonElement languages = ollang.client().get("/integration/supported-languages");
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
