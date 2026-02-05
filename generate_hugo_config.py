import os
import yaml

def parse_external_sources(root_dir):
    imports = {}

    for root, dirs, files in os.walk(root_dir):
        for file in files:
            path = os.path.join(root, file)
            # Structure is external-sources/<lang>/<org>/<repo>
            parts = os.path.relpath(path, root_dir).split(os.sep)
            if len(parts) < 3:
                continue
            
            lang = parts[0]
            org = parts[1]
            repo_name = parts[2]
            
            repo_url = f"github.com/{org}/{repo_name}"
            
            if repo_url not in imports:
                imports[repo_url] = []

            with open(path, 'r') as f:
                for line in f:
                    line = line.strip()
                    if not line:
                        continue
                    # CSV parsing: "src","dst"
                    # Simple split by comma, stripping quotes
                    # But wait, grep output showed: "src","dst"
                    # Let's handle simple parsing
                    if ',' in line:
                        src, dst = line.split(',', 1)
                        src = src.strip().strip('"')
                        dst = dst.strip().strip('"')
                        
                        # Add language prefix to destination if it's not absolute (it shouldn't be)
                        # The existing script mapped `external-sources/en/...` to `/content/en/...`
                        # So dest should be prefixed with content/<lang>
                        
                        # Note: The existing script logic:
                        # content_path="/content/${lang}"
                        # TARGET="${REPO_ROOT}${content_path}"
                        # rsync ... "${TARGET}${dsts[i]}"
                        
                        full_dst = f"content/{lang}{dst}"
                        imports[repo_url].append({
                            "source": src.lstrip('/'), # mounts source is relative to repo root
                            "target": full_dst
                        })

    module_config = {
        "module": {
            "imports": []
        }
    }

    for repo, mounts in imports.items():
        module_config["module"]["imports"].append({
            "path": repo,
            "mounts": mounts
        })

    print(yaml.dump(module_config, sort_keys=False))

parse_external_sources("external-sources")
