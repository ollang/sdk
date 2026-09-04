import json
import os
import tempfile
import unittest

from ollang import Ollang, OllangAPIError


class FakeResponse:
    def __init__(self, status_code=200, body=None, raw=None):
        self.status_code = status_code
        self._body = body
        if raw is not None:
            self.content = raw
            self.text = ""
        else:
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
        self.ollang.revisions.create("o1", type="wrongSubtitle", time="00:01:23", description="typo")
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

    def test_upload_direct_names_the_part(self):
        """The platform reads the stored file's extension from this name."""
        # Raw bytes carry no name of their own.
        self.ollang.uploads.direct(b"{}", name="App strings", source_language="en")
        self.assertEqual(self.session.calls[0]["files"]["file"][0], "App strings")

        # ...so an explicit filename is what gives the upload an extension.
        self.ollang.uploads.direct(
            b"{}", name="App strings", source_language="en", filename="en.json"
        )
        self.assertEqual(self.session.calls[1]["files"]["file"][0], "en.json")
        self.assertEqual(self.session.calls[1]["data"]["name"], "App strings")

    def test_upload_direct_uses_the_basename_of_a_path(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = os.path.join(tmp, "en.json")
            with open(path, "wb") as handle:
                handle.write(b"{}")

            self.ollang.uploads.direct(path, name="App strings", source_language="en")
            self.assertEqual(self.session.calls[0]["files"]["file"][0], "en.json")

            # An explicit filename still wins.
            self.ollang.uploads.direct(
                path, name="App strings", source_language="en", filename="strings.json"
            )
            self.assertEqual(self.session.calls[1]["files"]["file"][0], "strings.json")

    def test_upload_vtt_names_the_part(self):
        self.ollang.uploads.vtt(b"WEBVTT", order_id="o1")
        self.assertEqual(self.session.calls[0]["files"]["file"][0], "subtitles.vtt")

        self.ollang.uploads.vtt(b"WEBVTT", order_id="o1", filename="fr.vtt")
        self.assertEqual(self.session.calls[1]["files"]["file"][0], "fr.vtt")

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


class MemoriesTests(unittest.TestCase):
    def setUp(self):
        self.session = FakeSession()
        self.ollang = make_client(self.session)

    def test_crud_paths(self):
        self.ollang.memories.list()
        self.ollang.memories.create("Brand terms")
        self.ollang.memories.get("m1")
        self.ollang.memories.update("m1", "Renamed")
        self.ollang.memories.delete("m1")
        calls = self.session.calls
        self.assertEqual(calls[0]["method"], "GET")
        self.assertTrue(calls[0]["url"].endswith("/integration/memories"))
        self.assertEqual(calls[1]["method"], "POST")
        self.assertEqual(calls[1]["json"], {"title": "Brand terms"})
        self.assertTrue(calls[2]["url"].endswith("/integration/memories/m1"))
        self.assertEqual(calls[3]["method"], "PATCH")
        self.assertEqual(calls[3]["json"], {"title": "Renamed"})
        self.assertEqual(calls[4]["method"], "DELETE")

    def test_import_items_and_job(self):
        items = [
            {
                "sourceLanguage": "en",
                "targetLanguage": "fr",
                "sourceText": "hello",
                "targetText": "bonjour",
            }
        ]
        self.ollang.memories.import_items("m1", items)
        self.ollang.memories.get_import_job("j1")
        calls = self.session.calls
        self.assertTrue(calls[0]["url"].endswith("/integration/memories/m1/items/import"))
        self.assertEqual(calls[0]["json"], {"items": items})
        self.assertTrue(
            calls[1]["url"].endswith("/integration/memories/import-jobs/j1")
        )


class FoldersTests(unittest.TestCase):
    def setUp(self):
        self.session = FakeSession()
        self.ollang = make_client(self.session)

    def test_list_and_language_pairs(self):
        self.ollang.folders.list(page=2, take=5, search="promo")
        self.ollang.folders.order_language_pairs("f1", status="completed")
        calls = self.session.calls
        self.assertEqual(calls[0]["params"], {"page": 2, "take": 5, "search": "promo"})
        self.assertTrue(
            calls[1]["url"].endswith("/integration/folder/f1/order-language-pairs")
        )
        self.assertEqual(calls[1]["params"], {"status": "completed"})

    def test_assign_and_unassign(self):
        self.ollang.folders.assign_translator(
            "f1", translator_id="t1", deadline="2026-01-01", target_language="fr"
        )
        self.ollang.folders.unassign_translator("f1", target_language="fr")
        calls = self.session.calls
        self.assertTrue(
            calls[0]["url"].endswith("/integration/folder/f1/assign-translator-to-orders")
        )
        self.assertEqual(
            calls[0]["json"],
            {"translatorId": "t1", "deadline": "2026-01-01", "targetLanguage": "fr"},
        )
        self.assertTrue(
            calls[1]["url"].endswith(
                "/integration/folder/f1/unassign-translator-from-orders"
            )
        )
        self.assertEqual(calls[1]["json"], {"targetLanguage": "fr"})

    def test_export_xlsx_returns_bytes(self):
        self.session.next_response = FakeResponse(200, raw=b"PK\x03\x04xlsx")
        data = self.ollang.folders.export_xlsx(["f1", "f2"], ["fr", "de"])
        self.assertEqual(data, b"PK\x03\x04xlsx")
        call = self.session.calls[0]
        self.assertEqual(call["method"], "POST")
        self.assertTrue(call["url"].endswith("/integration/folder/export-xlsx"))
        self.assertEqual(
            call["json"], {"folderIds": ["f1", "f2"], "targetLanguages": ["fr", "de"]}
        )

    def test_export_xlsx_to_file(self):
        self.session.next_response = FakeResponse(200, raw=b"PK\x03\x04xlsx")
        with tempfile.TemporaryDirectory() as tmp:
            target = os.path.join(tmp, "nested", "folders.xlsx")
            written = self.ollang.folders.export_xlsx_to_file(["f1"], ["fr"], target)
            self.assertEqual(written, target)
            with open(target, "rb") as handle:
                self.assertEqual(handle.read(), b"PK\x03\x04xlsx")


class OrderExtrasTests(unittest.TestCase):
    def setUp(self):
        self.session = FakeSession()
        self.ollang = make_client(self.session)

    def test_review_and_embedding_paths(self):
        self.ollang.orders.cancel_human_review("o1")
        self.ollang.orders.request_subtitle_embedding("o1")
        self.ollang.orders.review_info("o1")
        calls = self.session.calls
        self.assertTrue(
            calls[0]["url"].endswith("/integration/orders/o1/cancel-human-review")
        )
        self.assertTrue(
            calls[1]["url"].endswith("/integration/orders/o1/subtitle-embedding")
        )
        self.assertEqual(calls[2]["method"], "GET")
        self.assertTrue(calls[2]["url"].endswith("/integration/orders/o1/review/info"))

    def test_export_xlsx_to_file(self):
        self.session.next_response = FakeResponse(200, raw=b"xlsx-bytes")
        with tempfile.TemporaryDirectory() as tmp:
            target = os.path.join(tmp, "order.xlsx")
            self.ollang.orders.export_xlsx_to_file("o1", target)
            call = self.session.calls[0]
            self.assertEqual(call["method"], "GET")
            self.assertTrue(call["url"].endswith("/integration/orders/o1/export-xlsx"))
            with open(target, "rb") as handle:
                self.assertEqual(handle.read(), b"xlsx-bytes")

    def test_create_passes_new_optional_fields(self):
        self.ollang.orders.create(
            order_type="subtitle",
            level=1,
            target_language_configs=[{"language": "fr"}],
            callback_url="https://example.com/hook",
            auto_qc=True,
            selected_memories=["m1"],
        )
        body = self.session.calls[0]["json"]
        self.assertEqual(body["callbackUrl"], "https://example.com/hook")
        self.assertTrue(body["autoQc"])
        self.assertEqual(body["selectedMemories"], ["m1"])


class ContentBillingLocalesFigmaTests(unittest.TestCase):
    def setUp(self):
        self.session = FakeSession()
        self.ollang = make_client(self.session)

    def test_content_import_and_export(self):
        translations = [{"sourceText": "hi", "targetText": "salut"}]
        self.ollang.content.import_("fr", translations)
        self.ollang.content.export(target_languages=["fr", "de"], tags=["ui"])
        calls = self.session.calls
        self.assertTrue(calls[0]["url"].endswith("/integration/content/import"))
        self.assertEqual(
            calls[0]["json"], {"targetLanguage": "fr", "translations": translations}
        )
        self.assertTrue(calls[1]["url"].endswith("/integration/content/export"))
        self.assertEqual(
            calls[1]["params"], {"targetLanguages[]": ["fr", "de"], "tags[]": ["ui"]}
        )

    def test_billing_paths_and_bracket_params(self):
        self.ollang.billing.credits()
        self.ollang.billing.consumption(page=2, from_="2026-01-01", provider="deepl")
        calls = self.session.calls
        self.assertTrue(calls[0]["url"].endswith("/integration/credits"))
        self.assertTrue(calls[1]["url"].endswith("/integration/consumption"))
        self.assertEqual(
            calls[1]["params"],
            {
                "pageOptions[page]": 2,
                "filter[from]": "2026-01-01",
                "filter[provider]": "deepl",
            },
        )

    def test_locales(self):
        self.ollang.locales.languages()
        self.ollang.locales.search("portu")
        self.ollang.locales.validate("pt-PT")
        calls = self.session.calls
        self.assertTrue(calls[0]["url"].endswith("/integration/locales/languages"))
        self.assertEqual(calls[1]["params"], {"q": "portu"})
        self.assertTrue(calls[2]["url"].endswith("/integration/locales/validate/pt-PT"))

    def test_locales_validate_escapes_tag(self):
        self.ollang.locales.validate("pt/PT")
        self.assertTrue(
            self.session.calls[0]["url"].endswith("/integration/locales/validate/pt%2FPT")
        )

    def test_figma(self):
        self.ollang.figma.create_order(
            file_key="abc",
            file_url="https://figma.com/file/abc",
            source_language="en",
            target_languages=["fr"],
            folder_id="f1",
        )
        self.ollang.figma.list_orders("abc")
        self.ollang.figma.order_status("o1")
        calls = self.session.calls
        self.assertTrue(calls[0]["url"].endswith("/integration/orders/figma/create"))
        self.assertEqual(calls[0]["json"]["fileKey"], "abc")
        self.assertEqual(calls[0]["json"]["folderId"], "f1")
        self.assertEqual(calls[1]["params"], {"fileKey": "abc"})
        self.assertTrue(
            calls[2]["url"].endswith("/integration/orders/figma/o1/status")
        )


class UrlBasedCreationTests(unittest.TestCase):
    def setUp(self):
        self.session = FakeSession()
        self.ollang = make_client(self.session)

    def test_project_create_by_url(self):
        self.ollang.projects.create_by_url(
            url="https://example.com/a.mp4",
            name="a.mp4",
            source_language="en",
            notes=[{"details": "intro", "timeStamp": "00:00:01"}],
        )
        call = self.session.calls[0]
        self.assertTrue(call["url"].endswith("/integration/project/create-by-url"))
        self.assertEqual(call["json"]["url"], "https://example.com/a.mp4")
        self.assertEqual(call["json"]["notes"][0]["details"], "intro")

    def test_upload_direct_url(self):
        self.ollang.uploads.direct_url(
            url="https://example.com/a.mp4",
            name="a.mp4",
            size=1234,
            source_language="en",
        )
        call = self.session.calls[0]
        self.assertTrue(call["url"].endswith("/integration/upload/direct-url"))
        self.assertEqual(
            call["json"],
            {
                "url": "https://example.com/a.mp4",
                "originalname": "a.mp4",
                "size": 1234,
                "sourceLanguage": "en",
            },
        )


if __name__ == "__main__":
    unittest.main()
