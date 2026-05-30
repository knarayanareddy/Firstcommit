import os
import re
import sys

# Requirements
# 1. Keyword coverage per doc (Policy driven)
# 2. File path existence check
# 3. DB object (table/RPC) existence check in migrations
# 4. Edge function directory existence check

DOCS_DIR = "Technical documents"
MIGRATIONS_DIR = "supabase/migrations"
FUNCTIONS_DIR = "supabase/functions"

# Verification Policies: keywords, sections (headings), min_lines
POLICY_MAP = {
    "01_System_Overview.txt": {
        "keywords": ["GROUNDED AI", "Grounding gate", "citations", "Detective loop", "RLS", "Postgres"],
        "min_lines": 150
    },
    "03_Frontend_App.txt": {
        "keywords": ["React Query", "shadcn/ui", "Tailwind", "Vite", "TypeScript", "envelope-builder.ts"],
        "min_lines": 200
    },
    "04_Supabase_DB_Schema_and_RLS.txt": {
        "keywords": ["knowledge_chunks", "rag_metrics", "RLS", "SECURITY DEFINER", "has_pack_access", "hybrid_search_v2"],
        "min_lines": 350
    },
    "05_Edge_Functions_Index.txt": {
        "keywords": ["ai-task-router", "retrieve-spans", "ingest-source", "JWT (user)", "Service Role"],
        "min_lines": 200
    },
    "06_RAG_Retrieval_and_Hybrid_Search.txt": {
        "keywords": ["hybrid search", "vector", "keyword", "match_count", "embeddings", "hybrid_search_v2"],
        "min_lines": 180
    },
    "07_AI_Task_Router_and_Grounding_Pipeline.txt": {
        "keywords": ["evaluateGroundingGate", "grounding_gate_passed", "citations", "citations_found"],
        "min_lines": 200
    },
    "08_Detective_Loop_MultiHop_Retrieval.txt": {
        "keywords": ["Multi-hop retrieval", "definition_search_v1", "detective-retrieval.ts", "symbol-dictionary.ts"],
        "min_lines": 150
    },
    "09_Grounding_Gate_SLO_and_Refusal_Behavior.txt": {
        "keywords": ["min_score", "max_strip_rate", "evaluateGroundingGate", "Insufficient evidence"],
        "min_lines": 180
    },
    "10_Ingestion_Pipeline_and_Connectors.txt": {
        "keywords": ["content_hash", "embedding-reuse", "ast-chunker.ts", "secret-patterns", "NORMALIZATION"],
        "min_lines": 200
    },
    "11_Security_Model_SSRF_Secrets_Credentials_BYOK.txt": {
        "keywords": ["external-url-policy", "Vault", "credential storage", "redaction", "SSRF"],
        "min_lines": 200
    },
    "12_Observability_Telemetry_RAG_Metrics_Rollups.txt": {
        "keywords": ["rag_metrics", "rollups", "telemetry", "pack_quality_daily", "trace_id"],
        "min_lines": 140
    },
    "13_Trust_Quality_Console.txt": {
        "keywords": ["Trust/Quality Console", "RequestDrilldown", "AiAuditLogPanel", "LifecycleHealthPanel"],
        "min_lines": 140
    },
    "14_RAG_Regression_Test_Harness_CI.txt": {
        "keywords": ["rag-eval", "expected_paths", "min_grounding_score"],
        "min_lines": 80
    },
    "15_Roadmaps_Playlists_30_60_90.txt": {
        "keywords": ["roadmap_enabled", "day_1_30", "milestone"],
        "min_lines": 140
    },
    "16_IDE_VSCode_Extension.txt": {
        "keywords": ["packPicker.ts", "SecretStorage", "rocketboard.selectPack"],
        "min_lines": 140
    },
    "17_Lifecycle_Controls_Retention_Purge_Audit.txt": {
        "keywords": ["retention", "purge", "lifecycle_audit_events", "legal_hold"],
        "min_lines": 200
    },
    "18_Operational_Runbooks.txt": {
        "keywords": ["RUNBOOK", "Prerequisites", "Steps", "OPENAI_API_KEY"],
        "min_lines": 180
    },
    "19_Known_Gaps_Tech_Debt_and_Roadmap.txt": {
        "keywords": ["SECURITY GAPS", "DNS Rebinding", "external-url-policy", "Risk", "ROADMAP"],
        "min_lines": 180
    },
    "20_MCP_Server_Technical_Documentation.txt": {
        "keywords": ["mcp-lite", "StreamableHttpTransport", "Tools", "Resources", "Audit"],
        "min_lines": 350
    },
    "21_MCP_Tool_Contracts.txt": {
        "keywords": ["mcp-lite", "search_knowledge_base", "explain_with_evidence"],
        "min_lines": 120
    }
}

def get_all_migrations_content():
    content = ""
    if os.path.exists(MIGRATIONS_DIR):
        for f in os.listdir(MIGRATIONS_DIR):
            if f.endswith(".sql"):
                try:
                    with open(os.path.join(MIGRATIONS_DIR, f), "r", encoding="utf-8") as file:
                        content += file.read().lower()
                except Exception:
                    pass
    return content

def verify_docs():
    all_passed = True
    migrations_blob = get_all_migrations_content()
    existing_functions = os.listdir(FUNCTIONS_DIR) if os.path.exists(FUNCTIONS_DIR) else []
    
    docs = sorted([f for f in os.listdir(DOCS_DIR) if f.endswith(".txt")])
    results = []
    
    for doc_name in docs:
        if doc_name.startswith("25_"):
            continue
        passed = True
        doc_path = os.path.join(DOCS_DIR, doc_name)
        with open(doc_path, "r", encoding="utf-8") as f:
            content = f.read()
            lines = content.splitlines()
            
        print(f"--- Verifying {doc_name} ---")
        
        # Stats to collect
        kw_status = "N/A"
        path_count = 0
        path_failed = 0
        db_count = 0
        db_failed = 0
        date_presence = "FAIL"
        
        # 0. Date Presence Check
        if any("Last Updated:" in line for line in lines):
            date_presence = "PASS"
        else:
            print(f"Error: Missing 'Last Updated:' date line")
            passed = False
            
        # 1. Policy Enforcement (Keywords + Min Lines)
        if doc_name in POLICY_MAP:
            policy = POLICY_MAP[doc_name]
            kw_status = "PASS"
            
            # Keywords
            for kw in policy.get("keywords", []):
                if kw not in content:
                    print(f"Error: Missing required keyword '{kw}'")
                    passed = False
                    kw_status = "FAIL"
            
            # Min Lines
            min_lines = policy.get("min_lines", 0)
            if len(lines) < min_lines:
                print(f"Error: File too short ({len(lines)} lines, min {min_lines})")
                passed = False
                kw_status = "FAIL"
        
        # 2. File Path Existence
        paths = re.findall(r'((?:supabase/functions|src|vscode-extension|scripts)/[a-zA-Z0-9_\-\./]+)', content)
        unique_paths = list(set(paths))
        path_count = len(unique_paths)
        for p in unique_paths:
            p_clean = p.rstrip(".,:;)]}")
            p_passed = True
            
            if p_clean.startswith("supabase/functions/") and len(p_clean.split("/")) == 3:
                func_name = p_clean.split("/")[-1]
                if func_name and not func_name.endswith("-") and func_name not in existing_functions and func_name != "_shared":
                    if p_clean != "supabase/functions/":
                        p_passed = False
            elif p_clean and not os.path.exists(p_clean):
                 if not os.path.exists(p_clean + "/"):
                      p_passed = False
            
            if not p_passed:
                print(f"Error: Referenced path '{p_clean}' does not exist")
                passed = False
                path_failed += 1
        
        # 3. DB Object Existence
        identifiers = re.findall(r'\b[a-z_]{5,}\b', content)
        found_db_objs = [ident for ident in set(identifiers) if ident in ["knowledge_chunks", "rag_metrics", "pack_members", "has_pack_access", "hybrid_search_v2", "pack_quality_daily", "find_definitions_v1", "find_references_v1", "symbol_definitions", "symbol_references", "pack_docs", "pack_doc_blocks"]]
        db_count = len(found_db_objs)
        for ident in found_db_objs:
            if ident not in migrations_blob:
                print(f"Warning: DB object '{ident}' not found in migrations")
                # We count it as failed for the report, even if it's just a warning
                db_failed += 1
        
        results.append({
            "file": doc_name,
            "lines": len(lines),
            "kw": kw_status,
            "paths": f"PASS ({path_count})" if path_failed == 0 else f"FAIL ({path_failed}/{path_count} broken)",
            "db": f"PASS ({db_count})" if db_failed == 0 else f"FAIL ({db_failed}/{db_count} missing)",
            "date": date_presence
        })
        
        if not passed:
            all_passed = False
        else:
            print(f"OK: {doc_name}")
            
    # Print Table for Report
    print("\n| Doc | Lines | Keywords | Paths | DB Objects | Last Updated |")
    print("|-----|-------|----------|-------|------------|--------------|")
    for r in results:
        print(f"| {r['file']:<40} | {r['lines']:<5} | {r['kw']:<8} | {r['paths']:<15} | {r['db']:<12} | {r['date']:<12} |")
        
    return all_passed

if __name__ == "__main__":
    if verify_docs():
        print("\nVerification PASSED")
        sys.exit(0)
    else:
        print("\nVerification FAILED")
        sys.exit(1)
