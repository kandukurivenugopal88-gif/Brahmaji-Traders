import { useEffect, useRef } from "react";
import "./GoogleAd.css";

const ADSENSE_SCRIPT_ID = "brahmaji-adsense-script";

function GoogleAd({
  slot,
  className = "",
  format = "auto",
  responsive = true,
  style,
}) {
  const adRef = useRef(null);
  const isPushedRef = useRef(false);
  const publisherId = String(import.meta.env.VITE_ADSENSE_CLIENT_ID || "").trim();
  const adSlot = String(slot || "").trim();

  useEffect(() => {
    if (!publisherId || !adSlot || isPushedRef.current) {
      return;
    }

    const tryPushAd = () => {
      if (isPushedRef.current || !adRef.current) {
        return;
      }

      try {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
        isPushedRef.current = true;
      } catch {
        // Ad blockers or script delays should not break page rendering.
      }
    };

    const existingScript = document.getElementById(ADSENSE_SCRIPT_ID);
    if (existingScript) {
      tryPushAd();
      return;
    }

    const script = document.createElement("script");
    script.id = ADSENSE_SCRIPT_ID;
    script.async = true;
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${publisherId}`;
    script.crossOrigin = "anonymous";
    script.onload = tryPushAd;
    document.head.appendChild(script);
  }, [adSlot, publisherId]);

  if (!publisherId || !adSlot) {
    return null;
  }

  return (
    <div className={`google-ad-wrap ${className}`.trim()}>
      <ins
        ref={adRef}
        className="adsbygoogle"
        style={style || { display: "block" }}
        data-ad-client={publisherId}
        data-ad-slot={adSlot}
        data-ad-format={format}
        data-full-width-responsive={responsive ? "true" : "false"}
      />
    </div>
  );
}

export default GoogleAd;
