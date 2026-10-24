"""Optional local prefetch of the embedding model.

Railway does not run this during the image build. The server downloads the
weights once in `load_embedding_model()` when the container starts. Running
this script from the backend directory only fills a local cache for offline
development.
"""

import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

CACHE = os.path.join(ROOT, ".cache")
os.environ.setdefault("FASTEMBED_CACHE_PATH", os.path.join(CACHE, "fastembed"))
os.environ.setdefault("HF_HOME", os.path.join(CACHE, "huggingface"))

from fastembed import TextEmbedding

MODEL = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"


def main() -> None:
    os.makedirs(os.environ["FASTEMBED_CACHE_PATH"], exist_ok=True)
    os.makedirs(os.environ["HF_HOME"], exist_ok=True)
    print(f"[EMBED] prefetch {MODEL} -> {os.environ['FASTEMBED_CACHE_PATH']}", flush=True)
    TextEmbedding(model_name=MODEL, cache_dir=os.environ["FASTEMBED_CACHE_PATH"])
    print("[EMBED] prefetch complete", flush=True)


if __name__ == "__main__":
    main()
