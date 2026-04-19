"""FAISS-based long-term conversation memory.

Stores conversation summaries per user, enabling recall across sessions.
Uses sentence-transformers for local (free) embeddings.
"""

from __future__ import annotations

import json
import logging
import os
import threading
from pathlib import Path
from typing import Any

import faiss
import numpy as np

from .config import chat_config

logger = logging.getLogger(__name__)

# Lazy-loaded embedding model (heavy — load once)
_embedding_model = None
_model_lock = threading.Lock()


def _get_embedding_model():
    global _embedding_model
    if _embedding_model is None:
        with _model_lock:
            if _embedding_model is None:
                from sentence_transformers import SentenceTransformer
                logger.info("Loading embedding model %s …", chat_config.EMBEDDING_MODEL)
                _embedding_model = SentenceTransformer(chat_config.EMBEDDING_MODEL)
                logger.info("Embedding model loaded.")
    return _embedding_model


def _embed(texts: list[str]) -> np.ndarray:
    model = _get_embedding_model()
    return model.encode(texts, normalize_embeddings=True).astype("float32")


class UserMemoryStore:
    """Per-user FAISS index + metadata store."""

    def __init__(self, user_id: str):
        self.user_id = user_id
        self._lock = threading.Lock()

        base = Path(chat_config.FAISS_DATA_DIR) / user_id
        base.mkdir(parents=True, exist_ok=True)
        self._index_path = base / "index.faiss"
        self._meta_path = base / "meta.json"

        self._metadata: list[dict[str, Any]] = []
        self._index: faiss.IndexFlatIP | None = None
        self._load()

    # ---- persistence -------------------------------------------------------

    def _load(self):
        if self._index_path.exists() and self._meta_path.exists():
            try:
                self._index = faiss.read_index(str(self._index_path))
                with open(self._meta_path, "r", encoding="utf-8") as f:
                    self._metadata = json.load(f)
                logger.info("Loaded FAISS index for user %s  (%d vectors)", self.user_id, self._index.ntotal)
            except Exception:
                logger.warning("Corrupted FAISS data for user %s — rebuilding", self.user_id, exc_info=True)
                self._index = None
                self._metadata = []

    def _save(self):
        try:
            if self._index is not None:
                faiss.write_index(self._index, str(self._index_path))
            with open(self._meta_path, "w", encoding="utf-8") as f:
                json.dump(self._metadata, f, ensure_ascii=False)
        except Exception:
            logger.error("Failed to persist FAISS data for user %s", self.user_id, exc_info=True)

    # ---- public API --------------------------------------------------------

    def store(self, text: str, metadata: dict[str, Any] | None = None):
        """Embed *text* and add to the user's FAISS index."""
        vec = _embed([text])
        dim = vec.shape[1]

        with self._lock:
            if self._index is None:
                self._index = faiss.IndexFlatIP(dim)
            self._index.add(vec)
            self._metadata.append({"text": text, **(metadata or {})})
            self._save()

    def search(self, query: str, top_k: int | None = None) -> list[dict[str, Any]]:
        """Return the *top_k* most relevant stored memories for *query*."""
        k = top_k or chat_config.MEMORY_TOP_K
        if self._index is None or self._index.ntotal == 0:
            return []

        vec = _embed([query])
        with self._lock:
            k = min(k, self._index.ntotal)
            scores, indices = self._index.search(vec, k)

        results = []
        for score, idx in zip(scores[0], indices[0]):
            if idx < 0:
                continue
            entry = dict(self._metadata[idx])
            entry["relevance_score"] = float(score)
            results.append(entry)
        return results

    def clear(self):
        """Delete all stored memories for this user."""
        with self._lock:
            self._index = None
            self._metadata = []
            if self._index_path.exists():
                os.remove(self._index_path)
            if self._meta_path.exists():
                os.remove(self._meta_path)


# ---------------------------------------------------------------------------
# Module-level cache of per-user stores
# ---------------------------------------------------------------------------
_stores: dict[str, UserMemoryStore] = {}
_stores_lock = threading.Lock()


def get_user_memory(user_id: str) -> UserMemoryStore:
    if user_id not in _stores:
        with _stores_lock:
            if user_id not in _stores:
                _stores[user_id] = UserMemoryStore(user_id)
    return _stores[user_id]


def clear_user_memory(user_id: str):
    store = get_user_memory(user_id)
    store.clear()
    with _stores_lock:
        _stores.pop(user_id, None)
