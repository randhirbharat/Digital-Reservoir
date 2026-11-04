import json
import sys
from pathlib import Path

import httpx

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from mqtt_bridge import Forwarder  # noqa: E402


def make(handler, tmp_path):
    return Forwarder("http://api", "k", tmp_path / "spool", batch_size=1000, client=httpx.Client(transport=httpx.MockTransport(handler)))


def test_validates_and_forwards(tmp_path):
    seen = []
    def ok(req):
        body = json.loads(req.content); seen.extend(body["observations"])
        assert req.headers["X-DR-Gateway-Key"] == "k"
        return httpx.Response(202, json={"accepted": len(body["observations"]), "rejected": []})
    fw = make(ok, tmp_path)
    assert fw.handle("dr/PRJ-A/PZ-03", b'{"ts":"2026-11-04T10:00:00Z","value":41.2,"quality":"good"}')
    assert not fw.handle("dr/PRJ-A/PZ-03", b'{"ts":"2026-11-04T10:00:00","value":1}')  # no time zone
    assert not fw.handle("other/topic", b"{}")
    assert not fw.handle("dr/PRJ-A/PZ-03", b"not json")
    fw.flush()
    assert fw.stats == {"received": 1, "sent": 1, "rejected": 0, "spooled": 0, "invalid": 3}
    assert seen[0]["sensor_code"] == "PZ-03" and seen[0]["value"] == 41.2


def test_store_and_forward_when_api_down(tmp_path):
    state = {"up": False}
    def flaky(req):
        if not state["up"]:
            raise httpx.ConnectError("down")
        n = len(json.loads(req.content)["observations"])
        return httpx.Response(202, json={"accepted": n, "rejected": []})
    fw = make(flaky, tmp_path)
    fw.handle("dr/P/S1", b'{"ts":"2026-11-04T10:00:00Z","value":1}')
    fw.flush()
    assert fw.stats["spooled"] == 1 and len(list((tmp_path / "spool").glob("*.json"))) == 1
    state["up"] = True
    fw.handle("dr/P/S1", b'{"ts":"2026-11-04T10:01:00Z","value":2}')
    fw.flush()
    assert fw.stats["sent"] == 2 and not list((tmp_path / "spool").glob("*.json"))
