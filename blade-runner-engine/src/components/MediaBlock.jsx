import { motion, useInView } from 'framer-motion';
import { useRef, useState } from 'react';

const fadeInUp = {
  hidden: { opacity: 0, y: 32 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] },
  },
};

export default function MediaBlock({ data = {} }) {
  var ref = useRef(null);
  var videoRef = useRef(null);
  var isInView = useInView(ref, { once: true, amount: 0.2 });
  var [isPlaying, setIsPlaying] = useState(false);

  var title = data.displayTitle || '';
  var body = data.body || '';
  var media = data._media || {};
  var videoSrc = media.mp4 || media.source || media.src || '';
  var posterSrc = media.poster || '';
  var completionOn = data._setCompletionOn || 'play';

  function handlePlayPause() {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play();
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  }

  function handleEnded() {
    setIsPlaying(false);
  }

  return (
    <motion.section
      ref={ref}
      initial="hidden"
      animate={isInView ? 'visible' : 'hidden'}
      variants={fadeInUp}
      className="w-full flex justify-center px-4 sm:px-6 py-12 sm:py-20"
    >
      <div
        className="w-full rounded-xl border overflow-hidden"
        style={{
          maxWidth: '860px',
          background: 'rgba(255, 255, 255, 0.03)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderColor: 'rgba(255, 255, 255, 0.06)',
          boxShadow: '0 4px 24px rgba(0, 0, 0, 0.2)',
        }}
      >
        {/* Title */}
        {title && (
          <div className="px-6 sm:px-8 pt-6 sm:pt-8">
            <h2
              className="text-2xl sm:text-3xl font-semibold tracking-tight mb-2 leading-snug"
              style={{ color: 'var(--brand-heading, #ffffff)' }}
            >
              {title}
            </h2>
          </div>
        )}

        {/* Body text above video */}
        {body && (
          <div
            className="px-6 sm:px-8 pt-3 pb-2 text-base leading-relaxed [&>p]:mb-3"
            style={{ color: 'var(--brand-text, rgba(255, 255, 255, 0.8))' }}
            dangerouslySetInnerHTML={{ __html: body }}
          />
        )}

        {/* Video player */}
        {videoSrc && (
          <div className="relative group">
            <div
              className="relative mx-4 sm:mx-6 mb-6 sm:mb-8 mt-4 rounded-lg overflow-hidden"
              style={{
                aspectRatio: '16 / 9',
                background: '#000',
              }}
            >
              <video
                ref={videoRef}
                src={videoSrc}
                poster={posterSrc || undefined}
                onEnded={handleEnded}
                onPlay={function () { setIsPlaying(true); }}
                onPause={function () { setIsPlaying(false); }}
                className="absolute inset-0 w-full h-full object-contain"
                playsInline
                preload="metadata"
              />

              {/* Custom play/pause overlay */}
              <button
                onClick={handlePlayPause}
                className="absolute inset-0 w-full h-full flex items-center justify-center z-10 cursor-pointer"
                style={{
                  background: isPlaying ? 'transparent' : 'rgba(0, 0, 0, 0.3)',
                  transition: 'background 0.3s ease',
                }}
                aria-label={isPlaying ? 'Pause' : 'Play'}
              >
                {!isPlaying && (
                  <div
                    className="w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center"
                    style={{
                      background: 'var(--brand-primary, #8b5cf6)',
                      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.4)',
                    }}
                  >
                    <svg
                      width="28"
                      height="28"
                      viewBox="0 0 24 24"
                      fill="white"
                    >
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </div>
                )}
              </button>

              {/* Controls bar */}
              <div
                className="absolute bottom-0 left-0 right-0 px-4 py-3 flex items-center gap-3 z-20 opacity-0 group-hover:opacity-100"
                style={{
                  background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 100%)',
                  transition: 'opacity 0.3s ease',
                }}
              >
                <button
                  onClick={handlePlayPause}
                  className="text-white hover:text-white/80 flex-shrink-0"
                  aria-label={isPlaying ? 'Pause' : 'Play'}
                >
                  {isPlaying ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M6 4h4v16H6zM14 4h4v16h-4z" />
                    </svg>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  )}
                </button>
                <span
                  className="text-xs uppercase tracking-widest"
                  style={{ color: 'rgba(255, 255, 255, 0.5)' }}
                >
                  {completionOn === 'ended' ? 'Watch to complete' : 'Video'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Poster-only fallback (no video, but has poster) */}
        {!videoSrc && posterSrc && (
          <div className="mx-4 sm:mx-6 mb-6 sm:mb-8 mt-4 rounded-lg overflow-hidden">
            <img
              src={posterSrc}
              alt={title || 'Media'}
              className="w-full h-auto object-cover rounded-lg"
              style={{ aspectRatio: '16 / 9' }}
            />
          </div>
        )}
      </div>
    </motion.section>
  );
}
