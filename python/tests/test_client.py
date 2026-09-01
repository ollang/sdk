import json
import unittest

from ollang import Ollang, OllangAPIError


class FakeResponse:
    def __init__(self, status_code=200, body=None):
        self.status_code = status_code
        self._body = body
        self.content = b"" if body is None else json.dumps(body).encode()
        self.text = "" if body is None else json.dumps(body)

    @property
    def ok(self):
        return self.status_code < 400

    def json(self):
        if self._body is None:
            raise ValueError("no body")
        return self._body


class FakeSession:
    def __init__(self):
        self.headers = {}
        self.calls = []
        self.next_response = FakeResponse(200, {"ok": True})

    def request(self, method, url, **kwargs):
        self.calls.append({"method": method, "url": url, **kwargs})
        return self.next_response


def make_client(session):
    client = Ollang(api_key="test-key")
    # Swap in the fake transport so no network is used.
    client.client._session = session
    session.headers.update({"X-Api-Key": "test-key"})
    return client


class ClientTests(unittest.TestCase):
    def setUp(self):
        self.session = FakeSession()
        self.ollang = make_client(self.session)

    def test_requires_api_key(self):
        with self.assertRaises(ValueError):
            Ollang(api_key="")

    def test_health_check_url_and_auth(self):
        self.ollang.health_check()
        call = self.session.calls[0]
        self.assertEqual(call["method"], "GET")
        self.assertEqual(call["url"], "https://api-integration.ollang.com/health")
        self.assertEqual(self.session.headers["X-Api-Key"], "test-key")

    def test_custom_base_url_trailing_slash(self):
        client = Ollang(api_key="k", base_url="https://example.com/")
        client.client._session = self.session
        client.health_check()
        self.assertEqual(self.session.calls[0]["url"], "https://example.com/health")

    def test_orders_create_body(self):
        self.session.next_response = FakeResponse(200, [{"orderId": "o1"}])
        result = self.ollang.orders.create(
            order_type="cc",
            level=1,
            project_id="p1",
            target_language_configs=[{"language": "fr", "isRush": False}],
        )
        call = self.session.calls[0]
        self.assertEqual(call["method"], "POST")
        self.assertTrue(call["url"].endswith("/integration/orders/create"))
        self.assertEqual(
            call["json"],
            {
                "orderType": "cc",
                "level": 1,
                "targetLanguageConfigs": [{"language": "fr", "isRush": False}],
                "projectId": "p1",
            },
        )
        self.assertEqual(result, [{"orderId": "o1"}])

    def test_orders_list_params(self):
        self.ollang.orders.list(page=2, take=10, status="completed", project_id="p1")
        call = self.session.calls[0]
        self.assertEqual(
            call["params"],
            {
                "pageOptions[page]": 2,
                "pageOptions[take]": 10,
                "filter[status]": "completed",
                "filter[projectId]": "p1",
            },
        )

    def test_revisions_paths(self):
        self.ollang.revisions.create("o1", type="text", time="00:01:23", description="typo")
        self.ollang.revisions.list("o1")
        self.ollang.revisions.delete("o1", "r1")
        self.assertTrue(self.session.calls[0]["url"].endswith("/integration/revision/o1"))
        self.assertEqual(self.session.calls[1]["method"], "GET")
        self.assertEqual(self.session.calls[2]["method"], "DELETE")
        self.assertTrue(self.session.calls[2]["url"].endswith("/integration/revision/o1/r1"))

    def test_upload_direct_multipart(self):
        self.ollang.uploads.direct(
            b"fake-bytes",
            name="clip.mp4",
            source_language="en",
            notes=[{"details": "intro", "timeStamp": "00:00:01"}],
        )
        call = self.session.calls[0]
        self.assertTrue(call["url"].endswith("/integration/upload/direct"))
        self.assertIn("file", call["files"])
        self.assertEqual(call["data"]["name"], "clip.mp4")
        self.assertEqual(call["data"]["sourceLanguage"], "en")
        self.assertEqual(
            json.loads(call["data"]["notes"]),
            [{"details": "intro", "timeStamp": "00:00:01"}],
        )

    def test_custom_instructions_update(self):
        self.ollang.custom_instructions.update("ci1", value="new value")
        call = self.session.calls[0]
        self.assertEqual(call["method"], "PATCH")
        self.assertTrue(call["url"].endswith("/integration/custom-instructions/ci1"))
        self.assertEqual(call["json"], {"value": "new value"})

    def test_api_error_raised(self):
        self.session.next_response = FakeResponse(401, {"message": "invalid key"})
        with self.assertRaises(OllangAPIError) as ctx:
            self.ollang.projects.list()
        self.assertEqual(ctx.exception.status_code, 401)
        self.assertEqual(ctx.exception.body, {"message": "invalid key"})


if __name__ == "__main__":
    unittest.main()
