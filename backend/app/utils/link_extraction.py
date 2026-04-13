"""Best-effort text extraction helpers for website and GitHub evidence links."""

from __future__ import annotations

from dataclasses import dataclass
from html import unescape
import asyncio
import ipaddress
import re
import socket
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import HTTPRedirectHandler, Request, build_opener


USER_AGENT = "SkillBridgeEvidenceBot/1.0 (+https://skillbridge.local)"
MAX_REMOTE_FETCH_BYTES = 512 * 1024


class LinkExtractionError(RuntimeError):
    """Raised when a user-supplied evidence link is unsafe or cannot be fetched safely."""


class _DenyRedirectHandler(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise LinkExtractionError(f"Redirects are not allowed for evidence links (HTTP {code})")


@dataclass
class LinkExtractionResult:
    url: str
    source_kind: str
    title: str
    description: str
    text: str


def is_http_url(value: str | None) -> bool:
    parsed = urlparse(str(value or "").strip())
    return parsed.scheme in {"http", "https"} and bool(parsed.netloc)


def is_github_url(value: str | None) -> bool:
    parsed = urlparse(str(value or "").strip())
    host = parsed.netloc.lower()
    if host.startswith("www."):
        host = host[4:]
    return host == "github.com" or host.endswith(".github.com")


def github_evidence_title(url: str | None) -> str:
    parsed = urlparse(str(url or "").strip())
    parts = [part for part in parsed.path.split("/") if part]
    if len(parts) >= 2:
        owner = parts[0].strip()
        repo = parts[1].strip()
        repo = repo[:-4] if repo.endswith(".git") else repo
        if owner and repo:
            return f"{owner}/{repo}"
    if parts:
        return parts[0].strip()
    return "GitHub Evidence"


def _clean_text(value: str | None) -> str:
    return re.sub(r"\s+", " ", unescape(str(value or "").strip())).strip()


def _extract_meta(html: str, *names: str) -> str:
    for name in names:
        pattern = re.compile(
            rf"<meta[^>]+(?:name|property)=['\"]{re.escape(name)}['\"][^>]+content=['\"]([^'\"]+)['\"]",
            re.IGNORECASE,
        )
        match = pattern.search(html)
        if match:
            return _clean_text(match.group(1))
    return ""


def _extract_title_tag(html: str) -> str:
    match = re.search(r"<title[^>]*>(.*?)</title>", html, re.IGNORECASE | re.DOTALL)
    return _clean_text(match.group(1)) if match else ""


def _strip_html(html: str) -> str:
    without_scripts = re.sub(r"<script\b[^>]*>.*?</script>", " ", html, flags=re.IGNORECASE | re.DOTALL)
    without_styles = re.sub(r"<style\b[^>]*>.*?</style>", " ", without_scripts, flags=re.IGNORECASE | re.DOTALL)
    without_tags = re.sub(r"<[^>]+>", " ", without_styles)
    return _clean_text(without_tags)


def _is_safe_remote_host(host: str) -> bool:
    candidate = str(host or "").strip().lower()
    if not candidate:
        return False
    if candidate in {"localhost", "localhost.localdomain"}:
        return False
    if candidate.endswith(".local"):
        return False

    try:
        address = ipaddress.ip_address(candidate)
    except ValueError:
        try:
            infos = socket.getaddrinfo(candidate, None, type=socket.SOCK_STREAM)
        except OSError:
            return False
        if not infos:
            return False
        for family, _socktype, _proto, _canonname, sockaddr in infos:
            if family not in {socket.AF_INET, socket.AF_INET6}:
                continue
            resolved = ipaddress.ip_address(sockaddr[0])
            if resolved.is_private or resolved.is_loopback or resolved.is_link_local or resolved.is_reserved or resolved.is_multicast or resolved.is_unspecified:
                return False
        return True

    return not (
        address.is_private
        or address.is_loopback
        or address.is_link_local
        or address.is_reserved
        or address.is_multicast
        or address.is_unspecified
    )


def _is_safe_remote_url(url: str) -> bool:
    parsed = urlparse(str(url or "").strip())
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        return False
    host = parsed.hostname or ""
    return _is_safe_remote_host(host)


def _fetch_html(url: str, *, timeout: int = 8) -> str:
    opener = build_opener(_DenyRedirectHandler)
    request = Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with opener.open(request, timeout=timeout) as response:
            content_length = response.headers.get("Content-Length")
            if content_length:
                try:
                    if int(content_length) > MAX_REMOTE_FETCH_BYTES:
                        raise LinkExtractionError("Remote content is too large")
                except ValueError:
                    pass
            charset = response.headers.get_content_charset() or "utf-8"
            raw = response.read(MAX_REMOTE_FETCH_BYTES + 1)
            if len(raw) > MAX_REMOTE_FETCH_BYTES:
                raise LinkExtractionError("Remote content is too large")
            return raw.decode(charset, errors="ignore")
    except LinkExtractionError:
        raise
    except HTTPError as exc:
        raise LinkExtractionError(f"Remote fetch failed with HTTP {exc.code}") from exc
    except URLError as exc:
        raise LinkExtractionError("Remote fetch failed") from exc


def _github_fallback(url: str) -> LinkExtractionResult:
    parsed = urlparse(url)
    title = github_evidence_title(url)
    parts = [part for part in parsed.path.split("/") if part]
    path_text = " ".join(part.replace("-", " ").replace("_", " ") for part in parts[2:])
    description = "GitHub repository"
    if path_text:
        description = f"GitHub repository content related to {path_text}"
    text = " ".join(part for part in [title, description, path_text, parsed.netloc] if part).strip()
    return LinkExtractionResult(
        url=url,
        source_kind="github",
        title=title,
        description=description,
        text=text,
    )


def _website_fallback(url: str) -> LinkExtractionResult:
    parsed = urlparse(url)
    host = parsed.netloc or "Website"
    path_text = " ".join(part.replace("-", " ").replace("_", " ") for part in parsed.path.split("/") if part)
    title = host
    description = f"Website link from {host}"
    text = " ".join(part for part in [host, path_text, description] if part).strip()
    return LinkExtractionResult(
        url=url,
        source_kind="website",
        title=title,
        description=description,
        text=text,
    )


def _parse_html(url: str, html: str) -> LinkExtractionResult:
    source_kind = "github" if is_github_url(url) else "website"
    title = _extract_meta(html, "og:title", "twitter:title") or _extract_title_tag(html)
    description = _extract_meta(html, "og:description", "twitter:description", "description")
    text = _strip_html(html)
    if source_kind == "github" and not title:
        title = github_evidence_title(url)
    if not title:
        title = urlparse(url).netloc or "Linked Evidence"
    combined_text = " ".join(part for part in [title, description, text[:4000]] if part).strip()
    return LinkExtractionResult(
        url=url,
        source_kind=source_kind,
        title=title,
        description=description,
        text=combined_text,
    )


def _extract_link_sync(url: str) -> LinkExtractionResult:
    cleaned = str(url or "").strip()
    if not is_http_url(cleaned):
        raise LinkExtractionError("Only public http/https URLs are supported")
    if not _is_safe_remote_url(cleaned):
        raise LinkExtractionError("Private or local URLs are not allowed")
    html = _fetch_html(cleaned)
    if html:
        return _parse_html(cleaned, html)
    if is_github_url(cleaned):
        return _github_fallback(cleaned)
    return _website_fallback(cleaned)


async def extract_link_evidence_content(url: str) -> LinkExtractionResult:
    return await asyncio.to_thread(_extract_link_sync, url)
