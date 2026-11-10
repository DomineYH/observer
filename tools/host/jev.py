#!/usr/bin/env python3
"""Host-side Jev call + decision rules. Usage: jev.py <request.json> <out.json>   Self-test: jev.py --self-test
request.json = templates.request shape (task, context, testing_evidence, trusted_flags, inherited_risk_floor)."""
import json, os, re, sys, urllib.request

from paths import ROUTING


def load():
    return json.load(open(ROUTING / "jev_task_routing.json")), json.load(open(ROUTING / "models.json"))


def questions(pol):
    return {k: {f: v[f] for f in ("type", "instructions", "criteria") if f in v} for k, v in pol["jev"]["questions"].items()}


def call(req, pol, models):
    """One router request; the key is read here only and never printed."""
    router = models["router"]
    state = {"task": req["task"], "context": dict(req["context"], verified_flags=req["trusted_flags"], testing_evidence=req.get("testing_evidence"))}
    body = json.dumps({"model": router["model"], "state": state, "questions": questions(pol)}).encode()
    r = urllib.request.Request(router["base_url"] + router["endpoint"], data=body, method="POST",
        headers={"Authorization": "Bearer " + os.environ[router["api_key_env"]], "Content-Type": "application/json"})
    return json.load(urllib.request.urlopen(r, timeout=180))


def decide(ans, req, pol):
    """Decision rules on the answers. Returns (status, risk, provisional_risk, fired rule ids)."""
    qs = questions(pol)
    th = pol["decision"]["thresholds"]
    fired, status, risk, prov = [], None, None, False

    # CLS-1 validation
    for k, q in qs.items():
        a = ans.get(k)
        if a is None: status = "BLOCKED"; fired.append(f"CLS-1:{k} missing"); continue
        if q["type"] == "noul":
            if not (isinstance(a.get("noul"), (int, float)) and 0 <= a["noul"] <= 1): status = "BLOCKED"; fired.append(f"CLS-1:{k}")
        else:
            p = a.get("probabilities") or {}
            if a.get("choice") not in q["criteria"] or not p or abs(sum(p.values()) - 1) > 0.02 or a["choice"] != max(p, key=p.get):
                status = "BLOCKED"; fired.append(f"CLS-1:{k}")
    n = lambda k: ans[k]["noul"]
    tf = req["trusted_flags"]
    riskq = pol["jev"]["risk_question_ids"] if isinstance(pol["jev"].get("risk_question_ids"), list) else ["security_sensitive", "data_sensitive", "shared_core_change", "production_impact"]
    if status is None:
        mr = max(n(k) for k in riskq)
        if any(tf.get(k) is True for k in riskq) or mr >= th["risk_high_min"]: risk = "high"; fired.append("CLS-2")
        elif mr > th["risk_clear_max"]: risk = "high"; prov = True; fired.append("CLS-2b")
        elif n("minor_eligible") >= th["minor_min_probability"] and tf.get("minor_scope_verified") is True: risk = "minor"; fired.append("CLS-3")
        else: risk = "standard"; fired.append("CLS-3(standard)")
        if risk == "minor" and any(n(k) >= th["include_optional_signal_min"] for k in ("changes_user_flow", "touches_external_api", "needs_design", "needs_special_test")):
            risk = "standard"; fired.append("CLS-3b")
        order = ["minor", "standard", "high"]
        if req.get("inherited_risk_floor") and order.index(req["inherited_risk_floor"]) > order.index(risk): risk = req["inherited_risk_floor"]; fired.append("CLS-2c")
        for k in pol["jev"]["required_choice_ids"]:
            a = ans[k]
            if a["probabilities"][a["choice"]] < th["choice_min_probability"] or a["confidence"] < th["choice_min_confidence"]:
                status = status or "NEEDS_CONTEXT"; fired.append(f"CLS-4:{k}")
        tt, wm, tm = ans["task_type"]["choice"], ans["work_mode"]["choice"], ans["testing_mode"]["choice"]
        if status is None and (tt == "other" or wm == "other"): status = "NOT_APPLICABLE"; fired.append("CLS-5")
        if status is None and wm == "emergency" and tf.get("active_incident_related_to_task") is not True: status = "NEEDS_CONTEXT"; fired.append("CLS-6")
        if status is None and (n("needs_context") > th["context_clear_max"] or tf.get("needs_context") is True): status = "NEEDS_CONTEXT"; fired.append("CLS-7")
        if status is None and tt == "analysis" and wm == "delivery": status = "NEEDS_CONTEXT"; fired.append("CLS-7b")
        if status is None and tt == "mixed": status = "NEEDS_DECOMPOSITION"; fired.append("CLS-8")
        if status is None and tm == "needs_context": status = "NEEDS_CONTEXT"; fired.append("CLS-9")
        if status is None: status = "READY_FOR_PREFLIGHT"; fired.append("CLS-10")
    return status, risk, prov, fired


def record_fields(out):
    """The task-record fields this result fills; record.py put --jev merges them."""
    ans = out["answers"]
    pick = lambda k: (ans.get(k) or {}).get("choice")
    wm, tm = pick("work_mode"), pick("testing_mode")
    t = ans.get("testing_mode") or {}
    return {"router_requested_model": out["request_model"], "router_actual_model": out["response_model"],
            "status": out["status"], "risk": out["risk"], "provisional_risk": out["provisional_risk"],
            # "CLS-3(standard)" and "CLS-4:task_type" become their schema rule ids
            "decision_rule_ids": list(dict.fromkeys(re.match(r"[A-Z]+-\d+[a-z]?", r).group() for r in out["decision_rule_ids"])),
            "jev_answers": ans, "task_type": pick("task_type"),
            "mode": wm if wm in ("delivery", "exploration", "emergency") else None,
            "testing_mode": tm if tm != "needs_context" else None,
            "testing_decision": {"source": "jev", "probability": (t.get("probabilities") or {}).get(tm), "confidence": t.get("confidence")}}


def main(req_path, out_path):
    pol, models = load()
    req = json.load(open(req_path))
    resp = call(req, pol, models)
    ans = resp["answers"]
    status, risk, prov, fired = decide(ans, req, pol)
    out = {"request_model": models["router"]["model"], "response_model": resp.get("model"), "usage": resp.get("usage"), "answers": ans,
           "status": status, "risk": risk, "provisional_risk": prov, "decision_rule_ids": fired}
    out["record_fields"] = record_fields(out)
    json.dump(out, open(out_path, "w"), indent=1, ensure_ascii=False)
    print(json.dumps({k: out[k] for k in ("status", "risk", "provisional_risk", "decision_rule_ids", "response_model")}))
    print({k: (v.get("choice"), round(v.get("confidence", 0), 2)) if v["type"] == "choice" else round(v["noul"], 3) for k, v in ans.items()})


def self_test():
    def no_network(*a, **k):
        raise AssertionError("self-test must not reach the router")
    urllib.request.urlopen = no_network
    pol, _ = load()
    qs = questions(pol)
    assert len(qs) == 14

    def answers(**over):
        ans = {}
        for k, q in qs.items():
            if q["type"] == "noul":
                ans[k] = {"type": "noul", "noul": 0.0}
            else:
                pick = {"task_type": "feature", "work_mode": "delivery", "testing_mode": "test_with_change"}[k]
                ans[k] = {"type": "choice", "choice": pick, "probabilities": {pick: 1.0}, "confidence": 0.95}
        for k, v in over.items():
            if v is None:
                del ans[k]
            elif qs[k]["type"] == "noul":
                ans[k]["noul"] = v
            else:
                ans[k] = dict(ans[k], **v)
        return ans

    req = {"trusted_flags": {}}
    assert decide(answers(), req, pol) == ("READY_FOR_PREFLIGHT", "standard", False, ["CLS-3(standard)", "CLS-10"])
    st, risk, prov, fired = decide(answers(security_sensitive=0.16), req, pol)
    assert (st, risk, prov) == ("READY_FOR_PREFLIGHT", "high", True) and "CLS-2b" in fired
    st, risk, prov, fired = decide(answers(), {"trusted_flags": {"security_sensitive": True}}, pol)
    assert (risk, prov) == ("high", False) and "CLS-2" in fired
    st, risk, prov, fired = decide(answers(minor_eligible=None), req, pol)
    assert st == "BLOCKED" and fired == ["CLS-1:minor_eligible missing"]
    mixed = {"choice": "mixed", "probabilities": {"mixed": 1.0}}
    assert decide(answers(task_type=mixed), req, pol)[0] == "NEEDS_DECOMPOSITION"
    unsure = {"choice": "feature", "probabilities": {"feature": 0.7, "bug_fix": 0.3}}
    st, risk, prov, fired = decide(answers(task_type=unsure), req, pol)
    assert st == "NEEDS_CONTEXT" and "CLS-4:task_type" in fired
    out = {"request_model": "jev-x", "response_model": "jev-x", "answers": answers(), "status": "READY_FOR_PREFLIGHT",
           "risk": "standard", "provisional_risk": False, "decision_rule_ids": ["CLS-3(standard)", "CLS-4:task_type", "CLS-10"]}
    rf = record_fields(out)
    assert rf["decision_rule_ids"] == ["CLS-3", "CLS-4", "CLS-10"] and (rf["task_type"], rf["mode"], rf["testing_mode"]) == ("feature", "delivery", "test_with_change")
    assert rf["testing_decision"] == {"source": "jev", "probability": 1.0, "confidence": 0.95}
    print("self-test ok")


if __name__ == "__main__":
    if sys.argv[1:] == ["--self-test"]:
        self_test()
    elif len(sys.argv) == 3:
        main(sys.argv[1], sys.argv[2])
    else:
        sys.exit(__doc__)
