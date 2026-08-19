"use client";

import { Instagram, ExternalLink, Calendar, X, Play, ChevronLeft, ChevronRight, Images } from "lucide-react";
import { useEffect, useState, useCallback } from "react";
import { buildInstagramMediaProxyPath } from "@/lib/instagram-media";

interface InstagramChild {
  id: string;
  media_type: string;
  media_url: string;
  thumbnail_url?: string;
}

interface InstagramPost {
  id: string;
  caption: string;
  media_type: string;
  media_url: string;
  permalink: string;
  thumbnail_url?: string;
  timestamp: string;
  children?: InstagramChild[];
}

const INSTAGRAM_PROFILE_URL = "https://www.instagram.com/h3_studios_sucy/";

function MediaFallback({ permalink }: { permalink: string }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-4 bg-zinc-900 p-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10">
        <Instagram className="h-7 w-7 text-primary" />
      </div>
      <a
        href={permalink}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="inline-flex items-center gap-2 rounded-full border border-primary/40 px-5 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary hover:text-black"
      >
        Voir la publication
        <ExternalLink className="h-4 w-4" />
      </a>
    </div>
  );
}

export function Actualites() {
  const [isVisible, setIsVisible] = useState(false);
  const [posts, setPosts] = useState<InstagramPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [degraded, setDegraded] = useState(false);
  const [failedMedia, setFailedMedia] = useState<Record<string, boolean>>({});
  const [selectedPost, setSelectedPost] = useState<InstagramPost | null>(null);
  const [carouselIndex, setCarouselIndex] = useState<Record<string, number>>({});
  const [playingVideo, setPlayingVideo] = useState<string | null>(null);

  const markFailed = useCallback((key: string) => {
    setFailedMedia((prev) => (prev[key] ? prev : { ...prev, [key]: true }));
  }, []);

  useEffect(() => {
    setIsVisible(true);
    fetch("/api/instagram/feed")
      .then(async (res) => {
        if (!res.ok) {
          setDegraded(true);
          return null;
        }
        return res.json();
      })
      .then((data: any) => {
        if (!data) return;
        if (data.success && Array.isArray(data.data)) {
          setPosts(data.data);
          if (data.stale === true) setDegraded(true);
        } else {
          setDegraded(true);
        }
      })
      .catch(() => setDegraded(true))
      .finally(() => setLoading(false));
  }, []);

  const formatDate = (isoString: string) => {
    return new Date(isoString).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  const openPost = (post: InstagramPost) => {
    setSelectedPost(post);
    setPlayingVideo(null);
    document.body.style.overflow = "hidden";
  };

  const closePost = () => {
    setSelectedPost(null);
    setPlayingVideo(null);
    document.body.style.overflow = "";
  };

  const nextCarouselImage = useCallback((postId: string, total: number) => {
    setCarouselIndex(prev => ({
      ...prev,
      [postId]: ((prev[postId] || 0) + 1) % total
    }));
  }, []);

  const prevCarouselImage = useCallback((postId: string, total: number) => {
    setCarouselIndex(prev => ({
      ...prev,
      [postId]: ((prev[postId] || 0) - 1 + total) % total
    }));
  }, []);

  const getCurrentImage = (post: InstagramPost) => {
    if (post.children && post.children.length > 0) {
      const idx = carouselIndex[post.id] || 0;
      return post.children[idx];
    }
    return { media_url: post.media_url, thumbnail_url: post.thumbnail_url, media_type: post.media_type };
  };

  return (
    <div className="flex min-h-fit grow flex-col items-center pb-16 pt-32">

      <div className="w-full max-w-6xl sm:max-w-[640px] lg:max-w-6xl px-2 lg:px-4">
        <div className={`mb-12 text-center transition-all duration-700 ${isVisible ? "translate-y-0 opacity-100" : "translate-y-10 opacity-0"}`}>
          <h1 className="font-blanka text-4xl lg:text-6xl">ACTUALITES</h1>
          <div className="mx-auto mt-4 h-1 w-24 rounded-full bg-gradient-to-r from-transparent via-primary to-transparent" />
        </div>

        <div className={`transition-all duration-700 ${isVisible ? "translate-y-0 opacity-100" : "translate-y-10 opacity-0"}`} style={{ transitionDelay: "100ms" }}>
          <a
            href="https://www.instagram.com/h3_studios_sucy"
            target="_blank"
            rel="noopener noreferrer"
            className="group mx-auto mb-16 flex max-w-md items-center justify-center gap-4 rounded-2xl border border-primary/30 bg-gradient-to-r from-primary/10 to-transparent p-6 transition-all hover:border-primary hover:bg-primary/20"
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary/20 transition-colors group-hover:bg-primary/30">
              <Instagram className="h-7 w-7 text-primary" />
            </div>
            <div className="text-left">
              <p className="text-lg font-semibold text-primary">@h3_studios_sucy</p>
              <p className="text-sm text-white/60">Suivez-nous sur Instagram</p>
            </div>
            <ExternalLink className="ml-auto h-5 w-5 text-white/40 transition-colors group-hover:text-primary" />
          </a>
        </div>

        {degraded && (
          <div
            className={`mb-10 flex flex-col items-center gap-5 rounded-2xl border border-primary/20 bg-white/5 p-6 text-center transition-all duration-700 sm:flex-row sm:text-left ${
              isVisible ? "translate-y-0 opacity-100" : "translate-y-10 opacity-0"
            }`}
            style={{ transitionDelay: "150ms" }}
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10">
              <Instagram className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-white">Flux Instagram momentanément indisponible</p>
              <p className="mt-1 text-sm text-white/60">
                {posts.length > 0
                  ? "Les publications ci-dessous ne sont plus à jour. Retrouvez toutes nos actualités directement sur notre page Instagram."
                  : "Nous ne parvenons pas à afficher les publications pour le moment. Retrouvez toutes nos actualités directement sur notre page Instagram."}
              </p>
            </div>
            <a
              href={INSTAGRAM_PROFILE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex shrink-0 items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-black transition-all hover:bg-primary/90 hover:shadow-lg hover:shadow-primary/20"
            >
              <Instagram className="h-4 w-4" />
              Voir sur Instagram
            </a>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : posts.length === 0 ? (
          degraded ? null : (
            <div className="flex flex-col items-center gap-4 rounded-2xl border border-white/10 bg-white/5 px-6 py-16 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10">
                <Instagram className="h-7 w-7 text-primary" />
              </div>
              <div>
                <p className="text-lg font-semibold text-white">Aucune publication à afficher</p>
                <p className="mt-1 text-sm text-white/60">
                  Retrouvez toutes nos actualités directement sur notre page Instagram.
                </p>
              </div>
              <a
                href={INSTAGRAM_PROFILE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-2 rounded-full bg-primary px-8 py-3.5 text-sm font-semibold text-black transition-all hover:bg-primary/90 hover:shadow-lg hover:shadow-primary/20"
              >
                <Instagram className="h-5 w-5" />
                Voir sur Instagram
              </a>
            </div>
          )
        ) : (
          <div className="grid gap-6 lg:grid-cols-3">
            {posts.map((post, i) => {
              const currentImage = getCurrentImage(post);
              const hasCarousel = post.children && post.children.length > 1;
              const isVideo = currentImage.media_type === "VIDEO";
              const tileKey = `tile-${post.id}-${carouselIndex[post.id] || 0}`;
              const tileFailed = !!failedMedia[tileKey];

              return (
                <div
                  key={post.id}
                  onClick={() =>
                    tileFailed
                      ? window.open(post.permalink, "_blank", "noopener,noreferrer")
                      : openPost(post)
                  }
                  className={`group cursor-pointer overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-white/10 to-transparent text-left transition-all duration-700 hover:border-primary/50 hover:shadow-[0_0_30px_rgba(249,176,53,0.1)] ${
                    isVisible ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"
                  }`}
                  style={{ transitionDelay: `${300 + i * 100}ms` }}
                >
                  <div className="relative aspect-square overflow-hidden bg-zinc-900">
                    {tileFailed ? (
                      <MediaFallback permalink={post.permalink} />
                    ) : (
                      <>
                    <img
                      src={buildInstagramMediaProxyPath(
                        isVideo
                          ? (currentImage.thumbnail_url || currentImage.media_url)
                          : (currentImage.media_url || currentImage.thumbnail_url || "")
                      )}
                      alt={post.caption}
                      width={640}
                      height={640}
                      decoding="async"
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                      loading="lazy"
                      onError={() => markFailed(tileKey)}
                    />
                    
                    {/* Video overlay with play button */}
                    {isVideo && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/80">
                          <Play className="h-8 w-8 text-black" fill="currentColor" />
                        </div>
                      </div>
                    )}

                    {/* Carousel indicator */}
                    {hasCarousel && (
                      <>
                        <div className="absolute right-3 top-3 flex h-7 items-center gap-1 rounded-full bg-black/60 px-2.5 text-xs text-white">
                          <Images className="h-3.5 w-3.5" />
                          {post.children!.length}
                        </div>
                        {/* Carousel dots */}
                        <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5">
                          {post.children!.map((_, idx) => (
                            <div
                              key={idx}
                              className={`h-1.5 w-1.5 rounded-full transition-all ${
                                idx === (carouselIndex[post.id] || 0)
                                  ? "w-4 bg-white"
                                  : "bg-white/50"
                              }`}
                            />
                          ))}
                        </div>
                        {/* Hover carousel arrows */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            prevCarouselImage(post.id, post.children!.length);
                          }}
                          className="absolute left-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white opacity-0 transition-opacity hover:bg-black/70 group-hover:opacity-100"
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            nextCarouselImage(post.id, post.children!.length);
                          }}
                          className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white opacity-0 transition-opacity hover:bg-black/70 group-hover:opacity-100"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </button>
                      </>
                    )}
                      </>
                    )}
                  </div>
                  <div className="p-4">
                    <p className="mb-2 line-clamp-2 text-sm text-white/70">{post.caption || "Publication Instagram"}</p>
                    <div className="flex items-center gap-2 text-xs text-white/50">
                      <Calendar className="h-3 w-3" />
                      {formatDate(post.timestamp)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-12 text-center">
          <a
            href="https://www.instagram.com/h3_studios_sucy"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full bg-primary px-8 py-3.5 text-sm font-semibold text-black transition-all hover:bg-primary/90 hover:shadow-lg hover:shadow-primary/20"
          >
            <Instagram className="h-5 w-5" />
            Voir toutes les publications
          </a>
        </div>
      </div>

      {selectedPost && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4"
          onClick={closePost}
        >
          <div 
            className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-white/10 bg-black"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={closePost}
              className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white transition-colors hover:bg-black/80"
            >
              <X className="h-6 w-6" />
            </button>
            
            <div className="relative aspect-square bg-zinc-900">
              {selectedPost.media_type === "VIDEO" && !playingVideo ? (
                /* Video preview with play button */
                failedMedia[`modal-thumb-${selectedPost.id}`] ? (
                  <MediaFallback permalink={selectedPost.permalink} />
                ) : (
                <div className="relative h-full w-full">
                  <img
                    src={buildInstagramMediaProxyPath(selectedPost.thumbnail_url || selectedPost.media_url)}
                    alt={selectedPost.caption}
                    className="h-full w-full object-cover"
                    onError={() => markFailed(`modal-thumb-${selectedPost.id}`)}
                  />
                  <div 
                    className="absolute inset-0 flex items-center justify-center bg-black/40 cursor-pointer"
                    onClick={() => setPlayingVideo(selectedPost.id)}
                  >
                    <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/80 transition-transform hover:scale-110">
                      <Play className="h-10 w-10 text-black" fill="currentColor" />
                    </div>
                  </div>
                </div>
                )
              ) : selectedPost.media_type === "VIDEO" && playingVideo === selectedPost.id ? (
                /* Video player */
                failedMedia[`modal-video-${selectedPost.id}`] ? (
                  <MediaFallback permalink={selectedPost.permalink} />
                ) : (
                <video
                  src={buildInstagramMediaProxyPath(selectedPost.media_url)}
                  poster={buildInstagramMediaProxyPath(selectedPost.thumbnail_url || selectedPost.media_url)}
                  controls
                  autoPlay
                  className="h-full w-full object-cover"
                  onError={() => markFailed(`modal-video-${selectedPost.id}`)}
                />
                )
              ) : selectedPost.children && selectedPost.children.length > 1 ? (
                /* Carousel in modal */
                <div className="relative h-full w-full">
                  {failedMedia[`modal-carousel-${selectedPost.id}-${carouselIndex[selectedPost.id] || 0}`] ? (
                    <MediaFallback permalink={selectedPost.permalink} />
                  ) : selectedPost.children[carouselIndex[selectedPost.id] || 0]?.media_type === "VIDEO" ? (
                  <video
                    src={buildInstagramMediaProxyPath(
                      selectedPost.children[carouselIndex[selectedPost.id] || 0]?.media_url || selectedPost.media_url
                    )}
                    poster={buildInstagramMediaProxyPath(
                      selectedPost.children[carouselIndex[selectedPost.id] || 0]?.thumbnail_url
                        || selectedPost.children[carouselIndex[selectedPost.id] || 0]?.media_url
                        || selectedPost.media_url
                    )}
                    controls
                    className="h-full w-full object-cover"
                    onError={() => markFailed(`modal-carousel-${selectedPost.id}-${carouselIndex[selectedPost.id] || 0}`)}
                  />
                  ) : (
                  <img
                    src={buildInstagramMediaProxyPath(
                      selectedPost.children[carouselIndex[selectedPost.id] || 0]?.media_url || selectedPost.media_url
                    )}
                    alt={selectedPost.caption}
                    className="h-full w-full object-cover"
                    onError={() => markFailed(`modal-carousel-${selectedPost.id}-${carouselIndex[selectedPost.id] || 0}`)}
                  />
                  )}
                  {/* Modal carousel controls */}
                  <button
                    onClick={() => prevCarouselImage(selectedPost.id, selectedPost.children!.length)}
                    className="absolute left-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white transition-colors hover:bg-black/70"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => nextCarouselImage(selectedPost.id, selectedPost.children!.length)}
                    className="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white transition-colors hover:bg-black/70"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                  {/* Modal carousel dots */}
                  <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2">
                    {selectedPost.children.map((_, idx) => (
                      <button
                        key={idx}
                        onClick={() => setCarouselIndex(prev => ({ ...prev, [selectedPost.id]: idx }))}
                        className={`h-2 rounded-full transition-all ${
                          idx === (carouselIndex[selectedPost.id] || 0)
                            ? "w-6 bg-white"
                            : "w-2 bg-white/50 hover:bg-white/70"
                        }`}
                      />
                    ))}
                  </div>
                  <div className="absolute right-3 top-3 flex h-7 items-center gap-1 rounded-full bg-black/60 px-2.5 text-xs text-white">
                    <Images className="h-3.5 w-3.5" />
                    {(carouselIndex[selectedPost.id] || 0) + 1} / {selectedPost.children.length}
                  </div>
                </div>
              ) : (
                /* Single image */
                failedMedia[`modal-img-${selectedPost.id}`] ? (
                  <MediaFallback permalink={selectedPost.permalink} />
                ) : (
                <img
                  src={buildInstagramMediaProxyPath(selectedPost.media_url)}
                  alt={selectedPost.caption}
                  className="h-full w-full object-cover"
                  onError={() => markFailed(`modal-img-${selectedPost.id}`)}
                />
                )
              )}
            </div>
            
            <div className="p-6">
              <p className="mb-4 whitespace-pre-wrap text-sm text-white/90">{selectedPost.caption}</p>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-white/50">
                  <Calendar className="h-3 w-3" />
                  {formatDate(selectedPost.timestamp)}
                </div>
                <a
                  href={selectedPost.permalink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-full bg-primary px-8 py-3.5 text-sm font-semibold text-black transition-all hover:bg-primary/90 hover:shadow-lg hover:shadow-primary/20"
                >
                  <Instagram className="h-4 w-4" />
                  Voir sur Instagram
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
