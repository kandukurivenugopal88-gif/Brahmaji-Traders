import { useEffect, useState } from "react";
import productsData from "../Products/productsData.json";
import "./LiveMarketDashboard.css";

const REFRESH_INTERVAL_MS = 20000;
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");
const FALLBACK_API_BASE_URL = "http://localhost:5000";

function resolveApiUrl(path) {
  if (API_BASE_URL) {
    return `${API_BASE_URL}${path}`;
  }

  return path;
}

const roundToTwo = (value) => Math.round(value * 100) / 100;

function createFallbackMarketItems() {
  return productsData.slice(0, 8).map((item) => {
    const basePrice = Number(item.price || 0);
    const variance = (Math.random() * 6 - 3) / 100;
    const livePrice = roundToTwo(Math.max(1, basePrice * (1 + variance)));
    const delta = roundToTwo(livePrice - basePrice);

    return {
      id: String(item.id),
      symbol: String(item.name || "item").toUpperCase(),
      name: item.name,
      category: item.category,
      unit: "kg",
      basePrice,
      livePrice,
      delta,
      direction: delta > 0.05 ? "up" : delta < -0.05 ? "down" : "flat",
      updatedAt: new Date().toISOString(),
      exchangeName: "Local fallback",
    };
  });
}

async function fetchLiveMarketData() {
  const endpoint = "/api/market/live";
  const primaryUrl = resolveApiUrl(endpoint);
  const fallbackUrl = `${FALLBACK_API_BASE_URL}${endpoint}`;

  const parseResponse = async (res, urlLabel) => {
    const text = await res.text();
    if (!text) {
      return null;
    }

    const contentType = String(res.headers.get("content-type") || "").toLowerCase();
    if (!contentType.includes("application/json")) {
      try {
        return JSON.parse(text);
      } catch {
        throw new Error(`Non-JSON response received from ${urlLabel}.`);
      }
    }

    return JSON.parse(text);
  };

  const requestUrls = Array.from(new Set([primaryUrl, fallbackUrl]));
  let lastError = "";

  for (const requestUrl of requestUrls) {
    try {
      const res = await fetch(requestUrl, {
        headers: {
          Accept: "application/json",
        },
      });

      const data = await parseResponse(res, requestUrl);

      if (res.ok && data?.success) {
        return { ok: true, data };
      }

      const apiMessage = data?.message || `Market API returned ${res.status}.`;
      lastError = apiMessage;
    } catch (error) {
      lastError = error.message || "Unable to load market API response.";
    }
  }

  throw new Error(
    lastError || "Unable to connect to live market API. Please ensure backend is running on http://localhost:5000"
  );
}

function LiveMarketDashboard() {
  const [prices, setPrices] = useState([]);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [sourceLabel, setSourceLabel] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;

    const loadLiveMarket = async () => {
      try {
        setError("");
        const response = await fetchLiveMarketData();
        if (!response.ok || !response.data?.success) {
          throw new Error(response.data?.message || "Unable to load live market prices.");
        }

        if (!isMounted) {
          return;
        }

        const nextItems = Array.isArray(response.data.items) ? response.data.items : [];
        const hasValidQuote = nextItems.some((item) => Number(item?.livePrice || 0) > 0);
        if (nextItems.length === 0 || !hasValidQuote) {
          setPrices(createFallbackMarketItems());
          setSourceLabel("LOCAL FALLBACK");
          setError("Live provider unavailable right now. Showing local market fallback prices.");
          setLastUpdated(new Date());
          return;
        }

        setPrices(nextItems);
        setSourceLabel(String(response.data.source || "live").toUpperCase());
        setLastUpdated(new Date());
      } catch (err) {
        if (isMounted) {
          setPrices(createFallbackMarketItems());
          setSourceLabel("LOCAL FALLBACK");
          setError(err.message || "Unable to load live market prices. Showing local fallback data.");
          setLastUpdated(new Date());
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadLiveMarket();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") {
        loadLiveMarket();
      }
    }, REFRESH_INTERVAL_MS);

    return () => {
      isMounted = false;
      clearInterval(timer);
    };
  }, []);

  return (
    <section className="market-dashboard" aria-label="Live Market Prices">
      <div className="market-header">
        <h2>Live Market Prices</h2>
        <p>Auto refresh every 20 seconds {sourceLabel ? `(${sourceLabel})` : ""}</p>
        <span>
          Updated: {lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
        </span>
      </div>

      {isLoading && <p className="market-status">Loading live market feed...</p>}
      {!isLoading && error && <p className="market-error">{error}</p>}

      <div className="market-grid">
        {prices.map((item) => {
          const absPercent = item.basePrice ? Math.abs((item.delta / item.basePrice) * 100) : 0;
          const trendWidth = Math.min(100, Math.max(8, absPercent * 8));

          return (
            <article key={item.id} className={`market-card ${item.direction}`}>
              <div className="market-title-row">
                <h3>{item.name}</h3>
                <span>{item.category}</span>
              </div>

              <p className="live-price">{item.livePrice} {item.unit ? `/ ${item.unit}` : ""}</p>
              <p className="original-price">Open: {item.basePrice} {item.unit ? `/ ${item.unit}` : ""}</p>

              <p className={`delta ${item.direction}`}>
                {item.delta > 0 ? "+" : ""}
                {roundToTwo(item.delta)} ({absPercent.toFixed(2)}%)
              </p>

              <div className="trend-track" role="img" aria-label={`${item.name} trend`}>
                <div className={`trend-fill ${item.direction}`} style={{ width: `${trendWidth}%` }} />
              </div>
            </article>
          );
        })}
      </div>

      {!isLoading && !error && prices.length === 0 && (
        <p className="market-status">No live market symbols available right now.</p>
      )}
    </section>
  );
}

export default LiveMarketDashboard;
