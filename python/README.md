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
```

Get your API key from your project settings at [Olabs](https://lab.ollang.com).

## Resources

| Resource                     | Description                            |
| ---------------------------- | -------------------------------------- |
| `client.projects`            | Read and list projects                 |
| `client.uploads`             | Upload files (video, audio, documents) |
| `client.orders`              | Create and track translation orders    |
| `client.revisions`           | Request revisions on completed orders  |
| `client.custom_instructions` | Set custom translation instructions    |

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
    type="text",
    time="00:01:23",
    description="Fix the terminology in this segment",
)

# Custom instructions
client.custom_instructions.create(
    key="tone",
    value="Formal, brand-safe tone for all marketing content",
)

# Endpoints not wrapped yet? Use the underlying HTTP client:
languages = client.client.get("/integration/supported-languages")
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
