import { motion, AnimatePresence, useInView } from 'framer-motion';
import { useRef, useState } from 'react';

const fadeInUp = {
  hidden: { opacity: 0, y: 32 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] },
  },
};

export default function VideoTranscript({ data = {} }) {
  const ref = useRef(null);
  const videoRef = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.15 });

  const title = data.displayTitle || '';
  const body = data.body || '';
  const media = data._media || {};
  const videoSrc = media.mp4 || media.source || media.src || '';
  const posterSrc = media.poster || '';
  const transcript = data.transcript || '';

  const [isPlaying, setIsPlaying] = useState(false);
  const [transcriptOpen, setTranscriptOpen] = useState(false);

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

  return (
    <motion.section
      ref={ref}
      initial="hidden"
      animate={isInView ? 'visible' : 'hidden'}
      variants={fadeInUp}
      className="w-full flex justify-center py-6 sm:py-8"
    >
      <div
        className="w-full rounded-xl border overflow-hidden"
        style={{
          maxWidth: '860px',
          background: 'var(--ui-glass)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderColor: 'var(--ui-glass-border)',
          boxShadow: '0 4px 24px rgba(0, 0, 0, 0.2)',
        }}
      >
        {/* Title */}
        {title && (
          <div className="px-6 sm:px-8 pt-6 sm:pt-8">
            <h2
              className="text-2xl sm:text-3xl font-semibold tracking-tight mb-2"
              style={{ color: 'var(--brand-heading, #ffffff)' }}
            >
              {title}
            </h2>
          </div>
        )}

        {body && (
          <div
            className="px-6 sm:px-8 pt-3 pb-2 text-base leading-relaxed [&>p]:mb-3"
            style={{ color: 'var(--brand-text, rgba(255, 255, 255, 0.8))' }}
            dangerouslySetInnerHTML={{ __html: body }}
          />
        )}

        {/* Video */}
        {videoSrc && (
          <div className="relative group">
            <div
              className="relative mx-4 sm:mx-6 mt-4 rounded-lg overflow-hidden"
              style={{ aspectRatio: '16 / 9', background: '#000' }}
            >
              <video
                ref={videoRef}
                src={videoSrc}
                poster={posterSrc || undefined}
                onEnded={() => setIsPlaying(false)}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                className="absolute inset-0 w-full h-full object-contain"
                playsInline
                preload="metadata"
              />
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
                    className="w-16 h-16 rounded-full flex items-center justify-center"
                    style={{
                      background: 'var(--brand-primary, #8b5cf6)',
                      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.4)',
                    }}
                  >
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="white">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </div>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Transcript toggle */}
        {transcript && (
          <div className="mx-4 sm:mx-6 mb-6 mt-4">
            <button
              onClick={() => setTranscriptOpen(!transcriptOpen)}
              className="w-full flex items-center justify-between px-4 py-3 rounded-lg border cursor-pointer"
              style={{
                background: 'var(--ui-glass)',
                borderColor: 'var(--ui-glass-border)',
                transition: 'border-color 0.2s ease',
              }}
            >
              <span className="flex items-center gap-2">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <rect x="1" y="3" width="14" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
                  <path d="M4 7h3M4 9.5h5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                </svg>
                <span
                  className="text-sm font-medium"
                  style={{ color: 'var(--brand-text, rgba(255, 255, 255, 0.8))' }}
                >
                  Transcript
                </span>
              </span>
              <motion.svg
                animate={{ rotate: transcriptOpen ? 180 : 0 }}
                transition={{ duration: 0.3 }}
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                style={{ color: 'var(--brand-text-muted)' }}
              >
                <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </motion.svg>
            </button>

            <AnimatePresence>
              {transcriptOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                  className="overflow-hidden"
                >
                  <div
                    className="px-4 py-4 mt-2 rounded-lg border text-sm leading-relaxed max-h-80 overflow-y-auto [&>p]:mb-3"
                    style={{
                      background: 'var(--ui-glass)',
                      borderColor: 'var(--ui-glass-border)',
                      color: 'var(--brand-text, rgba(255, 255, 255, 0.8))',
                    }}
                    dangerouslySetInnerHTML={{ __html: transcript }}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Bottom spacing if no transcript */}
        {!transcript && <div className="h-6" />}
      </div>
    </motion.section>
  );
}
