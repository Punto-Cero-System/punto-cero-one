"""YouTube Data API v3 — latest uploads for a channel or playlist.

Requires YOUTUBE_API_KEY. Missing → CONFIG_PENDING + mock.

Uses the low-quota approach: channels.list to resolve uploads playlist, then
playlistItems.list to pull the latest N videos.
"""
from __future__ import annotations

from typing import Optional

from .base import WidgetResponse, WidgetStatus, http, env_key, get_cache, set_cache, _now_iso

TTL = 900  # 15 min


_MOCK = {
    "items": [
        {"videoId": "dQw4w9WgXcQ", "title": "Video de muestra 1", "publishedAt": "2026-01-01T00:00:00Z",
         "thumbnail": "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg", "channelTitle": "Punto Cero"},
        {"videoId": "M7lc1UVf-VE", "title": "Video de muestra 2", "publishedAt": "2026-01-02T00:00:00Z",
         "thumbnail": "https://i.ytimg.com/vi/M7lc1UVf-VE/hqdefault.jpg", "channelTitle": "Punto Cero"},
    ],
}


def _map_playlist_items(raw: dict) -> dict:
    out = []
    for it in raw.get("items", []):
        sn = it.get("snippet") or {}
        cd = it.get("contentDetails") or {}
        thumbs = (sn.get("thumbnails") or {})
        thumb = ((thumbs.get("high") or thumbs.get("medium") or thumbs.get("default")) or {}).get("url", "")
        out.append({
            "videoId": cd.get("videoId") or sn.get("resourceId", {}).get("videoId"),
            "title": sn.get("title") or "",
            "publishedAt": sn.get("publishedAt") or "",
            "thumbnail": thumb,
            "channelTitle": sn.get("channelTitle") or "",
        })
    return {"items": out}


async def fetch_youtube(db=None, channel_id: Optional[str] = None,
                        playlist_id: Optional[str] = None, max_results: int = 5) -> WidgetResponse:
    api_key = env_key("YOUTUBE_API_KEY")
    if not api_key:
        return WidgetResponse(status=WidgetStatus.CONFIG_PENDING, source="youtube",
                              data=_MOCK, updated_at=_now_iso())
    if not channel_id and not playlist_id:
        # Optional default channel via env
        channel_id = env_key("YOUTUBE_DEFAULT_CHANNEL_ID")
    cache_key = f"{channel_id or ''}:{playlist_id or ''}:{max_results}"
    try:
        # Resolve uploads playlist if only a channel was given.
        if channel_id and not playlist_id:
            r = await http().get(
                "https://www.googleapis.com/youtube/v3/channels",
                params={"part": "contentDetails", "id": channel_id, "key": api_key},
            )
            r.raise_for_status()
            items = r.json().get("items", [])
            if not items:
                raise ValueError("channel not found")
            playlist_id = items[0]["contentDetails"]["relatedPlaylists"]["uploads"]
        if not playlist_id:
            raise ValueError("missing channel_id or playlist_id")

        r = await http().get(
            "https://www.googleapis.com/youtube/v3/playlistItems",
            params={"part": "snippet,contentDetails", "playlistId": playlist_id,
                    "maxResults": max_results, "key": api_key},
        )
        r.raise_for_status()
        payload = _map_playlist_items(r.json())
        await set_cache(db, "youtube", cache_key, payload, TTL)
        return WidgetResponse(status=WidgetStatus.ACTIVE, source="youtube",
                              data=payload, updated_at=_now_iso())
    except Exception as e:
        cached = await get_cache(db, "youtube", cache_key)
        if cached and cached.get("payload"):
            return WidgetResponse(status=WidgetStatus.ERROR, source="youtube",
                                  data=cached["payload"],
                                  updated_at=(cached.get("created_at") or _now_iso()).__str__(),
                                  error=str(e))
        return WidgetResponse(status=WidgetStatus.MOCK, source="youtube",
                              data=_MOCK, updated_at=_now_iso(), error=str(e))
