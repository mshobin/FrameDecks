"""Team Space peer-to-peer test: two PCs on loopback addresses standing in for WireGuard tunnel addresses.

Run on Linux:  KC_TEAMSPACE_ALLOW_ANY_ADDRESS=1 python3 tools/test_teamspace.py
(127.0.0.2 and 127.0.0.3 play the two WireGuard addresses; the WireGuard check is skipped for the test only.)
"""
import http.client
import json
import os
import sys
import tempfile
import time
from pathlib import Path

os.environ.setdefault("KC_TEAMSPACE_ALLOW_ANY_ADDRESS", "1")
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import teamspace  # noqa: E402

teamspace.SYNC_EVERY = 0.5
teamspace.ONLINE_FOR = 2.0
A_IP, B_IP, PORT = "127.0.0.2", "127.0.0.3", 18790
fails = []


def check(cond, what):
    print(("PASS " if cond else "FAIL ") + what)
    if not cond:
        fails.append(what)


def wait(fn, secs=6):
    end = time.time() + secs
    while time.time() < end:
        if fn():
            return True
        time.sleep(0.1)
    return False


key = teamspace.new_key()
scenes_a = [{"id": "s1", "name": "Welcome"}]
scenes_b = [{"id": "b1", "name": "Opening Prayer"}, {"id": "b2", "name": "Closing"}]
A = teamspace.TeamSpace(tempfile.mkdtemp(), lambda: (scenes_a, "s1"), "6.4")
B = teamspace.TeamSpace(tempfile.mkdtemp(), lambda: (scenes_b, "b1"), "6.4")

# refusals before the set-up is complete
ok, msg = A.configure({"enabled": True, "address": A_IP})
check(not ok and "team key" in msg, "enabling without a team key is refused")
ok, msg = A.configure({"enabled": True, "address": A_IP, "key": key, "peers": [{"name": "Me", "address": A_IP}]})
check(not ok, "a peer with this PC's own address is refused")

ok, _ = A.configure({"enabled": True, "name": "Anna", "address": A_IP, "port": PORT, "key": key,
                     "peers": [{"name": "Ben", "address": B_IP}]})
check(ok and A.server is not None, "A listens on its tunnel address")
check(not A.status()["peers"][0]["online"], "B is Offline while B is not running")
check(not A.status()["available"], "Team Space unavailable while no peer is online")
ok, msg = A.ask(B_IP, "b2")
check(not ok and "offline" in msg.lower(), "Ask to Go Live refused while the peer is offline")
A.set_notes("Offline note from Anna")

ok, _ = B.configure({"enabled": True, "name": "Ben", "address": B_IP, "port": PORT, "key": key,
                     "peers": [{"name": "Anna", "address": A_IP}]})
check(ok, "B starts")
check(wait(lambda: A.status()["peers"][0]["online"] and B.status()["peers"][0]["online"]), "both peers show Online")
check(A.status()["available"], "Team Space available while connected")
check(wait(lambda: B.status()["notes"]["text"] == "Offline note from Anna"), "notes sync when the peers connect")
B.action({"op": "add", "text": "Unmute the speaker"})
check(wait(lambda: [a["text"] for a in A.status()["actions"]] == ["Unmute the speaker"]), "action list syncs B -> A")
aid = A.status()["actions"][0]["id"]
A.action({"op": "toggle", "id": aid})
check(wait(lambda: B.status()["actions"] and B.status()["actions"][0]["done"]), "ticking an action syncs A -> B")
check([s["name"] for s in A.status()["peers"][0]["scenes"]] == ["Opening Prayer", "Closing"], "A sees B's scenes")

ok, msg = A.ask(B_IP, "b2")
check(ok, "Ask to Go Live sent while connected")
inc = B.status()["incoming"]
check(len(inc) == 1 and inc[0]["sceneName"] == "Closing" and inc[0]["fromName"] == "Anna", "B receives the request")
ok, msg, req = B.answer(inc[0]["id"], True)
check(ok and req["scene"] == "b2", "B approves")
check(A.status()["outgoing"][-1]["status"] == "approved", "A learns it was approved")


# security: unsigned, wrong key, replay, unknown address
def raw_post(body, sig, src=A_IP):
    c = http.client.HTTPConnection(B_IP, PORT, timeout=3, source_address=(src, 0))
    c.request("POST", teamspace.PATH, body=body, headers={"Content-Type": "application/json", "X-KC-Sig": sig})
    r = c.getresponse()
    r.read()
    c.close()
    return r.status


raw, sig = A._envelope(B_IP, "sync", {})
check(raw_post(raw, "") == 403, "unsigned message refused")
check(raw_post(raw, "0" * 64) == 403, "wrong signature refused")
check(raw_post(raw, sig) == 200, "correctly signed message accepted")
check(raw_post(raw, sig) == 403, "replayed message refused")
raw2, sig2 = A._envelope(B_IP, "sync", {})
check(raw_post(raw2, sig2, src="127.0.0.9") == 403, "message from an address not in the peer list refused")
C = teamspace.TeamSpace(tempfile.mkdtemp(), lambda: ([], ""), "6.4")
C.cfg.update(address=A_IP, key=teamspace.new_key(), port=PORT, name="Mallory")
raw3, sig3 = C._envelope(B_IP, "sync", {})
check(raw_post(raw3, sig3) == 403, "message signed with another team key refused")
check(not hasattr(teamspace, "RELAY") and "relay" not in teamspace.PATH, "no relay endpoint")

# B goes offline: presence drops, Ask refused, nothing queued
B.stop()
check(wait(lambda: not A.status()["peers"][0]["online"]), "B shows Offline after it stops")
ok, msg = A.ask(B_IP, "b1")
check(not ok, "Ask to Go Live refused after the peer disconnects")
check(A.status()["peers"][0]["scenes"] == [], "an offline peer's scenes are not offered")
A.stop()
print()
print("ALL PASS" if not fails else "{} FAILED".format(len(fails)))
sys.exit(1 if fails else 0)
