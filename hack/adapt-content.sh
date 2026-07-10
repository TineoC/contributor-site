#!/usr/bin/env bash
# Copyright 2019 The Kubernetes Authors.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
#
# adapt-content.sh - No longer needed.
#
# External content is now mounted directly via Hugo module mounts
# configured in hugo.yaml module.imports[].mounts. This script is
# kept as a no-op stub for backward compatibility with build scripts.
#
# See hugo.yaml for the mount configuration.

echo "[INFO] adapt-content.sh is no longer needed - Hugo module mounts handle content ingestion."
echo "[INFO] See hugo.yaml module.imports[].mounts for the configuration."
exit 0
