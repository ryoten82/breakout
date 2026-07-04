"""UE公式MCP (http://127.0.0.1:8000/mcp) への JSON-RPC ヘルパー（curlベース）。
使い方:
  python mcp_call.py call <tool_name> '<json_arguments>'
例:
  python mcp_call.py call list_toolsets '{}'
  python mcp_call.py call describe_toolset '{"toolset_name": "..."}'
  python mcp_call.py call call_tool '{"toolset_name": "...", "tool_name": "...", "arguments": {...}}'
引数JSONが長い場合はファイル渡し: python mcp_call.py call call_tool @args.json
セッションIDは .mcp_session にキャッシュ。失効時は自動再初期化。
"""
import json, sys, os, subprocess

URL = "http://127.0.0.1:8000/mcp"
HERE = os.path.dirname(os.path.abspath(__file__))
SESSION_FILE = os.path.join(HERE, ".mcp_session")

def curl_post(payload, session_id=None, want_headers=False):
    cmd = ["curl", "-s", "-X", "POST", URL,
           "-H", "Content-Type: application/json",
           "-H", "Accept: application/json, text/event-stream"]
    if session_id:
        cmd += ["-H", "Mcp-Session-Id: " + session_id]
    if want_headers:
        cmd += ["-D", "-"]
    cmd += ["--data-binary", "@-"]
    p = subprocess.run(cmd, input=json.dumps(payload).encode(), capture_output=True, timeout=180)
    return p.stdout.decode("utf-8", "replace")

def parse_body(text):
    # ヘッダ付き応答からヘッダとボディを分離せず、data:行 or JSON行を拾う
    datas = [l[5:].strip() for l in text.splitlines() if l.startswith("data:")]
    if datas:
        return json.loads(datas[-1])
    body = text.strip()
    # ヘッダ込みの場合は空行以降
    if body.startswith("HTTP/"):
        parts = body.split("\r\n\r\n", 1)
        body = parts[1].strip() if len(parts) > 1 else ""
        d = [l[5:].strip() for l in body.splitlines() if l.startswith("data:")]
        if d: return json.loads(d[-1])
    return json.loads(body) if body else None

def initialize():
    raw = curl_post({"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {
        "protocolVersion": "2025-03-26", "capabilities": {},
        "clientInfo": {"name": "claude-inspection", "version": "1.0"}}}, want_headers=True)
    sid = None
    for line in raw.splitlines():
        if line.lower().startswith("mcp-session-id:"):
            sid = line.split(":", 1)[1].strip()
    if not sid:
        raise RuntimeError("no session id in:\n" + raw[:500])
    curl_post({"jsonrpc": "2.0", "method": "notifications/initialized"}, sid)
    open(SESSION_FILE, "w").write(sid)
    return sid

def get_session():
    if os.path.exists(SESSION_FILE):
        return open(SESSION_FILE).read().strip()
    return initialize()

def rpc(method, params):
    sid = get_session()
    resp = parse_body(curl_post({"jsonrpc": "2.0", "id": 2, "method": method, "params": params}, sid))
    if resp is None or (isinstance(resp, dict) and resp.get("error")):
        sid = initialize()
        resp = parse_body(curl_post({"jsonrpc": "2.0", "id": 2, "method": method, "params": params}, sid))
    return resp

def main():
    cmd = sys.argv[1]
    if cmd == "tools/list":
        resp = rpc("tools/list", {})
    elif cmd == "call":
        name = sys.argv[2]
        raw = sys.argv[3] if len(sys.argv) > 3 else "{}"
        if raw.startswith("@"):
            raw = open(raw[1:], encoding="utf-8").read()
        resp = rpc("tools/call", {"name": name, "arguments": json.loads(raw)})
    else:
        print(__doc__); return
    try:
        for c in resp["result"]["content"]:
            print(c.get("text", json.dumps(c, ensure_ascii=False)))
    except (KeyError, TypeError):
        print(json.dumps(resp, ensure_ascii=False, indent=1))

if __name__ == "__main__":
    main()
