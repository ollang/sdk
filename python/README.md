# Ollang Python SDK

Official Python SDK for the [Ollang API](https://api-docs.ollang.com) — translation, transcription, dubbing, closed captioning, and i18n management.

## Installation

```bash
pip install ollang-sdk
```

Requires Python 3.8+.

## Quick Start

```python
from ollang import Ollang

client = Ollang(api_key="your-api-key")

# Upload a file (creates a project)
upload = client.uploads.direct(
    "./video.mp4",
    name="My Video",
    source_language="en",
)

# Create an order
orders = client.orders.create(
    order_type="cc",
    level=1,
    project_id=upload["projectId"],
    target_language_configs=[
        {"language": "fr", "isRush": False},
        {"language": "de", "isRush": False},
    ],
)

# Check order status
status = client.orders.get(orders[0]["orderId"])
print(status)

# Download links, once the order completes
for doc in status.get("orderDocs", []):
    print(doc["type"], doc["name"], doc["url"])
```

Get your API key from your project settings at [Olabs](https://lab.ollang.com).

### Naming the uploaded file

The platform takes the stored file's extension from the name the file is sent
under, and rejects an upload it cannot get one from. A path supplies it; raw
bytes and in-memory streams do not, so pass `filename` alongside them:

```python
client.uploads.direct(
    json.dumps(strings).encode(),
    name="App strings",
    source_language="en",
    filename="en.json",
)
```

`name` is the display name for the created project; it does not need an
extension of its own.

### Uploading VTT subtitles

Pass `project_id` and `name` instead of the old `order_id` argument. The API
attaches subtitles to a project and returns `projectId`; source language
defaults to the project's language.

```python
subtitles = client.uploads.vtt(
    './subtitles.vtt', project_id=upload["projectId"], name="Subtitles"
)
print(subtitles["projectId"])
```

## Resources

| Resource                     | Description                                        |
| ---------------------------- | -------------------------------------------------- |
| `client.projects`            | Create, read and list projects                     |
| `client.uploads`             | Upload files, or register remote ones by URL       |
| `client.orders`              | Create, track, review and export orders            |
| `client.folders`             | Browse folders and act on all their orders at once |
| `client.revisions`           | Request revisions on completed orders              |
| `client.memories`            | Translation memories and their items               |
| `client.custom_instructions` | Set custom translation instructions                |
| `client.content`             | Import and export translation units                |
| `client.billing`             | Credit wallet and consumption history              |
| `client.locales`             | Resolve and validate language codes                |
| `client.figma`               | Import Figma files and track their orders          |

All methods return the parsed JSON response as plain dicts/lists. Non-2xx
responses raise `ollang.OllangAPIError`, which carries `status_code` and the
parsed error `body`.

## Examples

```python
# List orders with pagination and filters
page = client.orders.list(page=1, take=20, status="completed")
for order in page["data"]:
    print(order["id"], order.get("status"))

# Request a revision on an order
client.revisions.create(
    order_id="ORDER_ID",
    type="wrongSubtitle",
    time="00:01:23",
    description="Fix the terminology in this segment",
)

# Custom instructions
client.custom_instructions.create(
    key="tone",
    value="Formal, brand-safe tone for all marketing content",
)

# Resolve a language code before using it
matches = client.locales.search("portu")
check = client.locales.validate("pt-PT")

# Translation memories
memory = client.memories.create("Brand terms")
job = client.memories.import_items(
    memory["id"],
    [
        {
            "sourceLanguage": "en",
            "targetLanguage": "fr",
            "sourceText": "Sign in",
            "targetText": "Se connecter",
        }
    ],
)
print(client.memories.get_import_job(job["jobId"])["status"])

# Assign a translator to every French order in a folder
client.folders.assign_translator("FOLDER_ID", translator_id="TRANSLATOR_ID", target_language="fr")

# Credit balance and recent consumption
wallet = client.billing.credits()
usage = client.billing.consumption(page=1, take=20, from_="2026-01-01")

# Import a large remote file without streaming it through your process
project = client.projects.create_by_url(
    url="https://example.com/video.mp4",
    name="Launch video",
    source_language="en",
)

# Endpoints not wrapped yet? Use the underlying HTTP client:
raw = client.client.get("/integration/orders")
```

### Binary exports

The XLSX endpoints return raw `bytes` rather than JSON. Each has a
`..._to_file` companion that writes the workbook to a path, creating parent
directories as needed:

```python
data = client.orders.export_xlsx("ORDER_ID")

client.orders.export_xlsx_to_file("ORDER_ID", "out/order.xlsx")
client.folders.export_xlsx_to_file(["FOLDER_ID"], ["fr", "de"], "out/folders.xlsx")
```

## Configuration

```python
client = Ollang(
    api_key="your-api-key",
    base_url="https://api-integration.ollang.com",  # optional override
    timeout=60.0,                                    # seconds
)
```

## Development

```bash
cd python
pip install -e . requests
python -m unittest discover tests -v
```

## Documentation

Full API documentation: **[https://api-docs.ollang.com](https://api-docs.ollang.com)**

## License

MIT
