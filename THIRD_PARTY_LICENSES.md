# Third-Party Licenses

VitCam is licensed under the **GNU Affero General Public License v3.0 (AGPL-3.0-or-later)** — see `LICENSE.md` in the repository root.

VitCam also incorporates the following third-party open-source components, each of which remains under its own original license. These component licenses apply to the respective code/model and do not change the overall AGPL-3.0-or-later license of VitCam.

---

## BSD-Licensed Components

### aiortc
- **License:** BSD 3-Clause
- **Author:** Jeremy Lainé
- **Source:** https://github.com/aiortc/aiortc
- Used for WebRTC/ORTC signaling and media streaming in the Python Camera Server.

```
Copyright (c) 2012 Jeremy Lainé.
All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions
are met:

1. Redistributions of source code must retain the above copyright
   notice, this list of conditions and the following disclaimer.
2. Redistributions in binary form must reproduce the above copyright
   notice, this list of conditions and the following disclaimer in
   the documentation and/or other materials provided with the
   distribution.
3. Neither the name of aiortc nor the names of its contributors may
   be used to endorse or promote products derived from this software
   without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
"AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
```

### PyTorch
- **License:** BSD-style (modified BSD, 3-Clause)
- **Copyright:** Copyright (c) Meta Platforms, Inc. and affiliates; and PyTorch Contributors
- **Source:** https://github.com/pytorch/pytorch
- Used as the ML inference backend (torch detection backend in `factory.py`).

---

## MIT-Licensed Components

| Component | Copyright | Source |
|---|---|---|
| FastAPI | Copyright (c) Sebastián Ramírez | https://github.com/tiangolo/fastapi |
| Next.js | Copyright (c) Vercel, Inc. | https://github.com/vercel/next.js |
| React | Copyright (c) Meta Platforms, Inc. and affiliates | https://github.com/facebook/react |
| Tailwind CSS | Copyright (c) Tailwind Labs, Inc. | https://github.com/tailwindlabs/tailwindcss |
| Supabase client libraries (supabase-py / supabase-js) | Copyright (c) Supabase, Inc. | https://github.com/supabase |
| deep-sort-realtime | Copyright (c) Evan (levan92) | https://github.com/levan92/deep_sort_realtime |

Full MIT license text (applies to each of the above unless noted otherwise):

```
MIT License

Copyright (c) <year> <copyright holder>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

## Apache License 2.0 Components

| Component | Copyright | Source |
|---|---|---|
| RF-DETR | Copyright (c) Roboflow, Inc. | https://github.com/roboflow/rf-detr |

Full text: https://www.apache.org/licenses/LICENSE-2.0

---

## Dataset / Model Attributions

### Microsoft COCO (Common Objects in Context)
- **License:** CC BY 4.0
- **Source:** https://cocodataset.org/
- COCO class definitions and pretrained baselines used in object detection.

---

## PostgreSQL License

### PostgreSQL
- **License:** PostgreSQL License (permissive, similar to MIT/BSD)
- **Copyright:** Copyright (c) 1996–2026, PostgreSQL Global Development Group; Portions Copyright (c) 1994, The Regents of the University of California
- **Source:** https://www.postgresql.org/

---

## Notes

- This file lists direct, notable third-party components. Transitive dependencies (e.g., packages pulled in by pip/npm) may carry their own license obligations — run a license audit tool (e.g., `pip-licenses`, `license-checker`) periodically to catch anything not listed here.
- If you vendor (copy source directly into the repo) any of the above rather than installing as a package dependency, keep that component's original license header intact in the vendored files.
- Component list current as of July 2026. Update this file whenever a new dependency with its own license is added.
