"""In-process publish/subscribe for live updates. One API process: in-memory queues.
For several API workers, replace with Redis pub/sub (same interface)."""
from __future__ import annotations

import asyncio
from collections import defaultdict


class EventBus:
    def __init__(self):
        self._subs: dict[str, set[asyncio.Queue]] = defaultdict(set)
        self._loop: asyncio.AbstractEventLoop | None = None

    def bind_loop(self, loop: asyncio.AbstractEventLoop) -> None:
        self._loop = loop

    def subscribe(self, project_id: str) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue(maxsize=1000)
        self._subs[project_id].add(q)
        return q

    def unsubscribe(self, project_id: str, q: asyncio.Queue) -> None:
        self._subs[project_id].discard(q)

    def publish(self, project_id: str, event: dict) -> None:
        """Thread-safe publish (ingestion endpoints run in a threadpool)."""
        def _put():
            for q in list(self._subs.get(project_id, ())):
                if q.full():
                    try:
                        q.get_nowait()
                    except asyncio.QueueEmpty:
                        pass
                q.put_nowait(event)
        if self._loop and self._loop.is_running():
            try:
                running = asyncio.get_running_loop()
            except RuntimeError:
                running = None
            if running is self._loop:
                _put()
            else:
                self._loop.call_soon_threadsafe(_put)


bus = EventBus()
