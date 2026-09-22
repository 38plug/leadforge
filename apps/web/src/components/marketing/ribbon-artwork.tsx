"use client";

/**
 * Abstract 3D flowing ribbon artwork — CSS-only.
 * Metallic chrome/black forms with subtle lime and amber highlights.
 * Each piece floats independently with different speeds.
 */
export function RibbonArtwork() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {/* Chrome ribbon — top right, large, entering viewport */}
      <div
        className="animate-ribbon-drift"
        style={{
          position: "absolute",
          top: "-10%",
          right: "-8%",
          width: "45vw",
          maxWidth: "520px",
          height: "60vh",
          maxHeight: "600px",
          borderRadius: "42% 58% 55% 45% / 48% 42% 58% 52%",
          background: `linear-gradient(
            155deg,
            hsl(0 0% 7%) 0%,
            hsl(0 0% 14%) 15%,
            hsl(0 0% 5%) 30%,
            hsl(0 0% 17%) 45%,
            hsl(0 0% 3%) 60%,
            hsl(0 0% 11%) 75%,
            hsl(0 0% 6%) 90%,
            hsl(0 0% 13%) 100%
          )`,
          transform: "rotate(-18deg)",
          opacity: 0.45,
          WebkitMaskImage: "radial-gradient(ellipse at 35% 30%, black 15%, transparent 65%)",
          maskImage: "radial-gradient(ellipse at 35% 30%, black 15%, transparent 65%)",
        }}
      >
        {/* Specular highlight */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "inherit",
            background: `linear-gradient(
              200deg,
              transparent 25%,
              hsl(0 0% 100% / 0.07) 40%,
              transparent 50%,
              hsl(82 100% 61% / 0.03) 65%,
              transparent 75%
            )`,
          }}
        />
      </div>

      {/* Lime ribbon — bottom left */}
      <div
        className="animate-ribbon-drift-alt"
        style={{
          position: "absolute",
          bottom: "-12%",
          left: "-10%",
          width: "40vw",
          maxWidth: "480px",
          height: "55vh",
          maxHeight: "550px",
          borderRadius: "55% 45% 48% 52% / 42% 58% 42% 58%",
          background: `linear-gradient(
            145deg,
            hsl(0 0% 5%) 0%,
            hsl(82 35% 10%) 20%,
            hsl(0 0% 7%) 40%,
            hsl(82 25% 8%) 60%,
            hsl(0 0% 4%) 80%,
            hsl(82 40% 12%) 100%
          )`,
          transform: "rotate(20deg)",
          opacity: 0.3,
          WebkitMaskImage: "radial-gradient(ellipse at 55% 45%, black 12%, transparent 60%)",
          maskImage: "radial-gradient(ellipse at 55% 45%, black 12%, transparent 60%)",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "inherit",
            background: `linear-gradient(180deg, transparent 15%, hsl(82 100% 61% / 0.05) 35%, transparent 55%)`,
          }}
        />
      </div>

      {/* Amber accent — small, center-left */}
      <div
        className="animate-ribbon-drift-slow"
        style={{
          position: "absolute",
          top: "38%",
          left: "12%",
          width: "18vw",
          maxWidth: "220px",
          height: "30vh",
          maxHeight: "300px",
          borderRadius: "48% 52% 58% 42% / 52% 48% 52% 48%",
          background: `linear-gradient(
            155deg,
            hsl(0 0% 5%) 0%,
            hsl(28 50% 14%) 30%,
            hsl(0 0% 6%) 50%,
            hsl(28 40% 10%) 70%,
            hsl(0 0% 4%) 100%
          )`,
          transform: "rotate(-25deg)",
          opacity: 0.18,
          WebkitMaskImage: "radial-gradient(ellipse at 50% 40%, black 8%, transparent 55%)",
          maskImage: "radial-gradient(ellipse at 50% 40%, black 8%, transparent 55%)",
        }}
      />

      {/* Thin flowing line — horizontal accent */}
      <div
        style={{
          position: "absolute",
          top: "55%",
          right: "15%",
          width: "25vw",
          maxWidth: "300px",
          height: "1px",
          background: "linear-gradient(90deg, transparent, hsl(0 0% 100% / 0.06), hsl(82 100% 61% / 0.08), transparent)",
          borderRadius: "999px",
          transform: "rotate(-6deg)",
          opacity: 0.5,
        }}
      />

      {/* Small floating dot — lime */}
      <div
        className="animate-breathe"
        style={{
          position: "absolute",
          top: "25%",
          right: "35%",
          width: "5px",
          height: "5px",
          borderRadius: "50%",
          background: "hsl(82 100% 61% / 0.35)",
          boxShadow: "0 0 12px hsl(82 100% 61% / 0.25)",
        }}
      />

      {/* Another dot — amber */}
      <div
        className="animate-breathe"
        style={{
          position: "absolute",
          top: "65%",
          left: "30%",
          width: "4px",
          height: "4px",
          borderRadius: "50%",
          background: "hsl(28 85% 55% / 0.3)",
          boxShadow: "0 0 10px hsl(28 85% 55% / 0.2)",
          animationDelay: "-3s",
        }}
      />

      {/* Second chrome piece — bottom right, partially cropped */}
      <div
        className="animate-ribbon-drift"
        style={{
          position: "absolute",
          bottom: "5%",
          right: "-5%",
          width: "30vw",
          maxWidth: "350px",
          height: "35vh",
          maxHeight: "350px",
          borderRadius: "52% 48% 45% 55% / 50% 55% 45% 50%",
          background: `linear-gradient(
            170deg,
            hsl(0 0% 6%) 0%,
            hsl(0 0% 12%) 25%,
            hsl(0 0% 4%) 50%,
            hsl(0 0% 10%) 75%,
            hsl(0 0% 5%) 100%
          )`,
          transform: "rotate(12deg)",
          opacity: 0.3,
          WebkitMaskImage: "radial-gradient(ellipse at 45% 50%, black 10%, transparent 55%)",
          maskImage: "radial-gradient(ellipse at 45% 50%, black 10%, transparent 55%)",
          animationDelay: "-8s",
          animationDuration: "25s",
        }}
      />

      {/* Diagonal line — top left to center */}
      <div
        style={{
          position: "absolute",
          top: "20%",
          left: "8%",
          width: "15vw",
          maxWidth: "180px",
          height: "1px",
          background: "linear-gradient(90deg, transparent, hsl(0 0% 100% / 0.04), transparent)",
          borderRadius: "999px",
          transform: "rotate(35deg)",
          opacity: 0.4,
        }}
      />
    </div>
  );
}
