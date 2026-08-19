export function isAllowedInstagramMediaUrl(candidate: URL): boolean {
  const hostname = candidate.hostname.toLowerCase();
  return candidate.protocol === "https:"
    && (hostname === "cdninstagram.com"
      || hostname.endsWith(".cdninstagram.com")
      || hostname === "fbcdn.net"
      || hostname.endsWith(".fbcdn.net"));
}

export function buildInstagramMediaProxyPath(mediaUrl: string): string {
  return `/api/instagram/proxy-image?url=${encodeURIComponent(mediaUrl)}`;
}
