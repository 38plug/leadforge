"use client";

/**
 * Abstract 3D flowing ribbon artwork — CSS-only.
 * Metallic chrome forms with lime and amber highlights.
 * More visible, more colorful, more alive.
 */
export function RibbonArtwork() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {/* Chrome ribbon — top right, large */}
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
            hsl(0 0% 12%) 0%,
            hsl(82 30% 16%) 15%,
            hsl(0 0% 8%) 30%,
            hsl(82 40% 20%) 45%,
            hsl(0 0% 6%) 60%,
            hsl(82 25% 14%) 75%,
            hsl(0 0% 10%) 90%,
            hsl(82 35% 17%) 100%
          )`,
          transform: "rotate(-18deg)",
          opacity: 0.55,
          WebkitMaskImage: "radial-gradient(ellipse at 35% 30%, black 20%, transparent 65%)",
          maskImage: "radial-gradient(ellipse at 35% 30%, black 20%, transparent 65%)",
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
              transparent 20%,
              hsl(0 0% 100% / 0.12) 35%,
              transparent 45%,
              hsl(82 100% 61% / 0.08) 60%,
              transparent 70%
            )`,
          }}
        />
      </div>

      {/* Lime ribbon — bottom left, more prominent */}
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
            hsl(0 0% 7%) 0%,
            hsl(82 50% 18%) 20%,
            hsl(0 0% 9%) 40%,
            hsl(82 40% 15%) 60%,
            hsl(0 0% 6%) 80%,
            hsl(82 55% 20%) 100%
          )`,
          transform: "rotate(20deg)",
          opacity: 0.4,
          WebkitMaskImage: "radial-gradient(ellipse at 55% 45%, black 18%, transparent 60%)",
          maskImage: "radial-gradient(ellipse at 55% 45%, black 18%, transparent 60%)",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "inherit",
            background: `linear-gradient(180deg, transparent 10%, hsl(82 100% 61% / 0.12) 30%, transparent 50%)`,
          }}
        />
      </div>

      {/* Amber accent — center-left, more visible */}
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
            hsl(0 0% 6%) 0%,
            hsl(28 65% 20%) 30%,
            hsl(0 0% 8%) 50%,
            hsl(28 55% 16%) 70%,
            hsl(0 0% 5%) 100%
          )`,
          transform: "rotate(-25deg)",
          opacity: 0.28,
          WebkitMaskImage: "radial-gradient(ellipse at 50% 40%, black 12%, transparent 55%)",
          maskImage: "radial-gradient(ellipse at 50% 40%, black 12%, transparent 55%)",
        }}
      />

      {/* Lime glow orb — center right */}
      <div
        className="animate-breathe"
        style={{
          position: "absolute",
          top: "30%",
          right: "25%",
          width: "180px",
          height: "180px",
          borderRadius: "50%",
          background: "radial-gradient(circle, hsl(82 100% 61% / 0.08), transparent 60%)",
          filter: "blur(30px)",
        }}
      />

      {/* Amber glow orb — bottom center */}
      <div
        className="animate-breathe"
        style={{
          position: "absolute",
          bottom: "20%",
          left: "40%",
          width: "150px",
          height: "150px",
          borderRadius: "50%",
          background: "radial-gradient(circle, hsl(28 85% 55% / 0.06), transparent 60%)",
          filter: "blur(25px)",
          animationDelay: "-3s",
        }}
      />

      {/* Thin flowing line — more visible */}
      <div
        style={{
          position: "absolute",
          top: "55%",
          right: "15%",
          width: "25vw",
          maxWidth: "300px",
          height: "1.5px",
          background: "linear-gradient(90deg, transparent, hsl(0 0% 100% / 0.12), hsl(82 100% 61% / 0.18), transparent)",
          borderRadius: "999px",
          transform: "rotate(-6deg)",
          opacity: 0.7,
        }}
      />

      {/* Small floating dot — lime, brighter */}
      <div
        className="animate-breathe"
        style={{
          position: "absolute",
          top: "25%",
          right: "35%",
          width: "6px",
          height: "6px",
          borderRadius: "50%",
          background: "hsl(82 100% 61% / 0.5)",
          boxShadow: "0 0 16px hsl(82 100% 61% / 0.4), 0 0 30px hsl(82 100% 61% / 0.15)",
        }}
      />

      {/* Another dot — amber */}
      <div
        className="animate-breathe"
        style={{
          position: "absolute",
          top: "65%",
          left: "30%",
          width: "5px",
          height: "5px",
          borderRadius: "50%",
          background: "hsl(28 85% 55% / 0.45)",
          boxShadow: "0 0 14px hsl(28 85% 55% / 0.3), 0 0 25px hsl(28 85% 55% / 0.1)",
          animationDelay: "-3s",
        }}
      />

      {/* Third dot — lime, top left area */}
      <div
        className="animate-breathe"
        style={{
          position: "absolute",
          top: "15%",
          left: "25%",
          width: "4px",
          height: "4px",
          borderRadius: "50%",
          background: "hsl(82 100% 61% / 0.4)",
          boxShadow: "0 0 12px hsl(82 100% 61% / 0.3)",
          animationDelay: "-5s",
        }}
      />

      {/* Second chrome piece — bottom right */}
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
            hsl(0 0% 8%) 0%,
            hsl(82 20% 14%) 25%,
            hsl(0 0% 6%) 50%,
            hsl(82 25% 12%) 75%,
            hsl(0 0% 7%) 100%
          )`,
          transform: "rotate(12deg)",
          opacity: 0.35,
          WebkitMaskImage: "radial-gradient(ellipse at 45% 50%, black 15%, transparent 55%)",
          maskImage: "radial-gradient(ellipse at 45% 50%, black 15%, transparent 55%)",
          animationDelay: "-8s",
          animationDuration: "25s",
        }}
      />

      {/* Diagonal line — top left */}
      <div
        style={{
          position: "absolute",
          top: "20%",
          left: "8%",
          width: "15vw",
          maxWidth: "180px",
          height: "1px",
          background: "linear-gradient(90deg, transparent, hsl(82 100% 61% / 0.08), transparent)",
          borderRadius: "999px",
          transform: "rotate(35deg)",
          opacity: 0.5,
        }}
      />

      {/* Additional ambient lime glow — top area */}
      <div
        style={{
          position: "absolute",
          top: "-5%",
          left: "30%",
          width: "300px",
          height: "300px",
          borderRadius: "50%",
          background: "radial-gradient(circle, hsl(82 100% 61% / 0.04), transparent 55%)",
          filter: "blur(40px)",
          animationDelay: "-6s",
        }}
      />
    </div>
  );
}
