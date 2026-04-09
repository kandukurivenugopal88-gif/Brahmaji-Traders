import React, { useEffect, useMemo, useState } from "react";
import productsData from "./productsData.json";
import "./Products.css";
import GoogleAd from "../Ads/GoogleAd.jsx";

const PRODUCT_META_KEY = "brahmaji_traders_product_meta";
const PRODUCT_REVIEW_KEY = "brahmaji_traders_product_reviews";
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");
const FALLBACK_API_BASE_URL = "http://localhost:5000";
const STOCK_SYNC_INTERVAL_MS = 30000;

function resolveApiUrl(path) {
  if (API_BASE_URL) {
    return `${API_BASE_URL}${path}`;
  }
  return path;
}

async function fetchStockMetaFromServer() {
  const endpoint = "/api/product/stock-meta";
  const primaryUrl = resolveApiUrl(endpoint);

  const readJson = async (response) => {
    try {
      return await response.json();
    } catch {
      return null;
    }
  };

  try {
    const res = await fetch(primaryUrl);
    const data = await readJson(res);

    if (!res.ok && !API_BASE_URL) {
      const retry = await fetch(`${FALLBACK_API_BASE_URL}${endpoint}`);
      const retryData = await readJson(retry);
      if (!retry.ok || !retryData?.success) {
        throw new Error(retryData?.message || "Unable to load product stock.");
      }
      return retryData?.meta && typeof retryData.meta === "object" ? retryData.meta : {};
    }

    if (!res.ok || !data?.success) {
      throw new Error(data?.message || "Unable to load product stock.");
    }

    return data?.meta && typeof data.meta === "object" ? data.meta : {};
  } catch {
    if (!API_BASE_URL) {
      const retry = await fetch(`${FALLBACK_API_BASE_URL}${endpoint}`);
      const retryData = await readJson(retry);
      if (!retry.ok || !retryData?.success) {
        throw new Error(retryData?.message || "Unable to load product stock.");
      }
      return retryData?.meta && typeof retryData.meta === "object" ? retryData.meta : {};
    }
    throw new Error("Unable to load product stock.");
  }
}

async function saveStockMetaToServer(productId, stockQty, currentUser) {
  const endpoint = `/api/product/stock-meta/${productId}`;
  const primaryUrl = resolveApiUrl(endpoint);
  const options = {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "x-user-role": String(currentUser?.role || "").toLowerCase(),
      "x-user-email": String(currentUser?.email || "").trim().toLowerCase(),
    },
    body: JSON.stringify({ stockQty }),
  };

  const readJson = async (response) => {
    try {
      return await response.json();
    } catch {
      return null;
    }
  };

  try {
    const res = await fetch(primaryUrl, options);
    const data = await readJson(res);

    if (!res.ok && !API_BASE_URL) {
      const retry = await fetch(`${FALLBACK_API_BASE_URL}${endpoint}`, options);
      const retryData = await readJson(retry);
      if (!retry.ok || !retryData?.success) {
        throw new Error(retryData?.message || "Unable to update product stock.");
      }
      return retryData;
    }

    if (!res.ok || !data?.success) {
      throw new Error(data?.message || "Unable to update product stock.");
    }

    return data;
  } catch {
    if (!API_BASE_URL) {
      const retry = await fetch(`${FALLBACK_API_BASE_URL}${endpoint}`, options);
      const retryData = await readJson(retry);
      if (!retry.ok || !retryData?.success) {
        throw new Error(retryData?.message || "Unable to update product stock.");
      }
      return retryData;
    }
    throw new Error("Unable to update product stock.");
  }
}

async function notifyAdminForRating(payload) {
  const endpoint = "/api/product/rating/notify";
  const primaryUrl = resolveApiUrl(endpoint);
  const options = {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  };

  try {
    const res = await fetch(primaryUrl, options);
    if (res.ok || API_BASE_URL) {
      return;
    }
    await fetch(`${FALLBACK_API_BASE_URL}${endpoint}`, options);
  } catch {
    if (!API_BASE_URL) {
      await fetch(`${FALLBACK_API_BASE_URL}${endpoint}`, options);
    }
  }
}

function readProductMeta() {
  try {
    const raw = localStorage.getItem(PRODUCT_META_KEY);
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function readProductReviews() {
  try {
    const raw = localStorage.getItem(PRODUCT_REVIEW_KEY);
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function Products({ onAddToCart, currentUser }) {
  const [category, setCategory] = useState("All");
  const [sortBy, setSortBy] = useState("featured");
  const [selectedMaxPrice, setSelectedMaxPrice] = useState(0);
  const [productMeta, setProductMeta] = useState(() => readProductMeta());
  const [productReviews, setProductReviews] = useState(() => readProductReviews());
  const [draftMeta, setDraftMeta] = useState({});
  const [reviewDraft, setReviewDraft] = useState({});
  const [ratingLogs, setRatingLogs] = useState([]);
  const [isRatingLogsLoading, setIsRatingLogsLoading] = useState(false);
  const [ratingLogsError, setRatingLogsError] = useState("");
  const canManageTags = ["admin", "developer"].includes(currentUser?.role);
  const canRateProducts = ["customer", "admin", "developer"].includes(currentUser?.role);

  useEffect(() => {
    if (!canManageTags) {
      return;
    }

    const loadRatingLogs = async () => {
      setIsRatingLogsLoading(true);
      setRatingLogsError("");
      const endpoint = "/api/product/ratings";
      const headers = {
        "x-user-role": String(currentUser?.role || "").toLowerCase(),
        "x-user-email": String(currentUser?.email || "").trim().toLowerCase(),
      };

      try {
        const primary = await fetch(resolveApiUrl(endpoint), { headers });
        let data = null;
        try {
          data = await primary.json();
        } catch {
          data = null;
        }

        if (!primary.ok && !API_BASE_URL) {
          const retry = await fetch(`${FALLBACK_API_BASE_URL}${endpoint}`, { headers });
          let retryData = null;
          try {
            retryData = await retry.json();
          } catch {
            retryData = null;
          }

          if (!retry.ok || !retryData?.success) {
            throw new Error(retryData?.message || "Unable to load customer rating logs.");
          }

          setRatingLogs(Array.isArray(retryData.ratings) ? retryData.ratings : []);
          return;
        }

        if (!primary.ok || !data?.success) {
          throw new Error(data?.message || "Unable to load customer rating logs.");
        }

        setRatingLogs(Array.isArray(data.ratings) ? data.ratings : []);
      } catch (error) {
        setRatingLogsError(error.message || "Unable to load customer rating logs.");
      } finally {
        setIsRatingLogsLoading(false);
      }
    };

    loadRatingLogs();
  }, [canManageTags, currentUser?.email, currentUser?.role]);

  useEffect(() => {
    let isMounted = true;

    const syncStockMeta = async () => {
      try {
        const remoteStockMeta = await fetchStockMetaFromServer();
        if (!isMounted) {
          return;
        }

        setProductMeta((prev) => {
          const next = { ...prev };
          for (const [productId, meta] of Object.entries(remoteStockMeta)) {
            const stockQty = Math.max(0, Number(meta?.stockQty ?? 0));
            next[productId] = {
              ...(next[productId] || {}),
              stockQty,
            };
          }

          if (JSON.stringify(prev) === JSON.stringify(next)) {
            return prev;
          }

          localStorage.setItem(PRODUCT_META_KEY, JSON.stringify(next));
          return next;
        });
      } catch {
        // Keep local state when stock API is temporarily unreachable.
      }
    };

    syncStockMeta();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") {
        syncStockMeta();
      }
    }, STOCK_SYNC_INTERVAL_MS);

    return () => {
      isMounted = false;
      clearInterval(timer);
    };
  }, []);

  const categories = [
    "All",
    ...Array.from(new Set(productsData.map((item) => item.category)))
  ];

  const priceRange = useMemo(() => {
    const prices = productsData.map((item) => Number(item.price || 0)).filter((price) => price > 0);
    if (prices.length === 0) {
      return { min: 0, max: 0 };
    }

    return {
      min: Math.min(...prices),
      max: Math.max(...prices),
    };
  }, []);

  useEffect(() => {
    if (priceRange.max > 0) {
      setSelectedMaxPrice(priceRange.max);
    }
  }, [priceRange.max]);

  const categoryFilteredProducts =
    category === "All"
      ? productsData
      : productsData.filter((item) => item.category === category);

  const priceFilteredProducts = useMemo(() => {
    if (!selectedMaxPrice) {
      return categoryFilteredProducts;
    }

    return categoryFilteredProducts.filter((item) => Number(item.price || 0) <= selectedMaxPrice);
  }, [categoryFilteredProducts, selectedMaxPrice]);

  const filteredProducts = useMemo(() => {
    const list = [...priceFilteredProducts];

    if (sortBy === "price-low") {
      list.sort((a, b) => Number(a.price || 0) - Number(b.price || 0));
    } else if (sortBy === "price-high") {
      list.sort((a, b) => Number(b.price || 0) - Number(a.price || 0));
    } else if (sortBy === "name-asc") {
      list.sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
    }

    return list;
  }, [priceFilteredProducts, sortBy]);

  const productsWithMeta = useMemo(() => {
    return filteredProducts.map((item) => {
      const meta = productMeta[item.id] || {};
      return {
        ...item,
        rating: Number(meta.rating || 0),
        likes: Number(meta.likes || 0),
        stockQty: Math.max(0, Number(meta.stockQty ?? 25)),
        tags: Array.isArray(meta.tags) ? meta.tags : [],
      };
    });
  }, [filteredProducts, productMeta]);

  const outOfStockProducts = useMemo(() => {
    return productsWithMeta.filter((item) => Number(item.stockQty || 0) <= 0);
  }, [productsWithMeta]);

  const getProductReviews = (productId) => {
    const list = productReviews[productId];
    return Array.isArray(list) ? list : [];
  };

  const onDraftMetaChange = (productId, field, value) => {
    setDraftMeta((prev) => ({
      ...prev,
      [productId]: {
        ...(prev[productId] || {}),
        [field]: value,
      },
    }));
  };

  const saveMeta = async (productId) => {
    const existing = productMeta[productId] || {};
    const draft = draftMeta[productId] || {};
    const ratingValue = Number(draft.rating ?? existing.rating ?? 0);
    const likesValue = Number(draft.likes ?? existing.likes ?? 0);
    const stockValue = Number(draft.stockQty ?? existing.stockQty ?? 25);
    const tagsRaw = String(draft.tags ?? (existing.tags || []).join(",")).trim();
    const safeRating = Math.max(0, Math.min(5, Number.isNaN(ratingValue) ? 0 : ratingValue));
    const safeLikes = Math.max(0, Number.isNaN(likesValue) ? 0 : likesValue);
    const safeStock = Math.max(0, Number.isNaN(stockValue) ? 0 : stockValue);
    const parsedTags = tagsRaw
      ? tagsRaw.split(",").map((tag) => tag.trim()).filter(Boolean)
      : [];

    const nextMeta = {
      ...productMeta,
      [productId]: {
        rating: safeRating,
        likes: safeLikes,
        stockQty: safeStock,
        tags: parsedTags,
      },
    };

    setProductMeta(nextMeta);
    localStorage.setItem(PRODUCT_META_KEY, JSON.stringify(nextMeta));

    if (canManageTags) {
      try {
        await saveStockMetaToServer(productId, safeStock, currentUser);
      } catch (error) {
        alert(error.message || "Failed to sync stock to server.");
      }
    }
  };

  const setStarRating = async (product, rating) => {
    const productId = product.id;
    const existing = productMeta[productId] || {};
    const nextMeta = {
      ...productMeta,
      [productId]: {
        rating,
        likes: Number(existing.likes || 0),
        tags: Array.isArray(existing.tags) ? existing.tags : [],
      },
    };

    setProductMeta(nextMeta);
    localStorage.setItem(PRODUCT_META_KEY, JSON.stringify(nextMeta));
    onDraftMetaChange(productId, "rating", rating);

    if (currentUser?.role === "customer") {
      const reviewText = String(reviewDraft[productId]?.text || "").trim();

      try {
        await notifyAdminForRating({
          productId,
          productName: product.name,
          price: product.price,
          rating,
          customerEmail: String(currentUser?.email || "").trim().toLowerCase(),
          message: reviewText || "Keep it",
        });
      } catch {
        // Keep rating locally even if notification fails.
      }
    }
  };

  const onReviewDraftChange = (productId, field, value) => {
    setReviewDraft((prev) => ({
      ...prev,
      [productId]: {
        ...(prev[productId] || {}),
        [field]: value,
      },
    }));
  };

  const onReviewPhotoSelect = (productId, files) => {
    const selected = Array.from(files || []).slice(0, 3);
    Promise.all(
      selected.map(
        (file) =>
          new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result || ""));
            reader.onerror = () => resolve("");
            reader.readAsDataURL(file);
          })
      )
    ).then((images) => {
      onReviewDraftChange(productId, "photos", images.filter(Boolean));
    });
  };

  const submitProductReview = async (product) => {
    const productId = product.id;
    const rating = Number(productMeta[productId]?.rating || 0);
    const text = String(reviewDraft[productId]?.text || "").trim();
    const photos = Array.isArray(reviewDraft[productId]?.photos)
      ? reviewDraft[productId].photos
      : [];

    if (rating < 1) {
      alert("Please select star rating first.");
      return;
    }

    if (!text) {
      alert("Please write a product review.");
      return;
    }

    if (photos.length === 0) {
      alert("Please add at least one review photo.");
      return;
    }

    const reviewEntry = {
      id: `rev_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      customerEmail: String(currentUser?.email || "").trim().toLowerCase(),
      rating,
      text,
      photos,
      createdAt: new Date().toISOString(),
    };

    const nextReviews = {
      ...productReviews,
      [productId]: [reviewEntry, ...getProductReviews(productId)].slice(0, 10),
    };

    setProductReviews(nextReviews);
    localStorage.setItem(PRODUCT_REVIEW_KEY, JSON.stringify(nextReviews));

    try {
      await notifyAdminForRating({
        productId,
        productName: product.name,
        price: product.price,
        rating,
        customerEmail: reviewEntry.customerEmail,
        message: text,
      });
    } catch {
      // Review save should remain even if notification fails.
    }

    setReviewDraft((prev) => ({
      ...prev,
      [productId]: {
        text: "",
        photos: [],
      },
    }));
  };

  return (
    <div className="grid">
      <div className="products-head-row">
        <h2>Products</h2>
        <p>{productsWithMeta.length} items shown</p>
      </div>

      <div className="products-layout">
        <aside className="products-sidebar" aria-label="Product filters">
          <h3>Filters</h3>
          <div className="category-filter">
            {categories.map((cat) => (
              <button
                key={cat}
                className={cat === category ? "active" : ""}
                onClick={() => setCategory(cat)}
              >
                {cat}
              </button>
            ))}
          </div>
          <div className="sidebar-meta">
            <p><strong>Price</strong></p>
            <p>₹{priceRange.min} - ₹{priceRange.max} / kg</p>
            <div className="filter-control-block">
              <label htmlFor="product-price-range">Max Price: ₹{selectedMaxPrice || priceRange.max}</label>
              <input
                id="product-price-range"
                type="range"
                min={priceRange.min}
                max={priceRange.max}
                step="1"
                value={selectedMaxPrice || priceRange.max}
                onChange={(event) => setSelectedMaxPrice(Number(event.target.value || 0))}
              />
            </div>
            <div className="filter-control-block">
              <label htmlFor="product-sort-by">Sort By</label>
              <select
                id="product-sort-by"
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value)}
              >
                <option value="featured">Featured</option>
                <option value="price-low">Price: Low to High</option>
                <option value="price-high">Price: High to Low</option>
                <option value="name-asc">Name: A to Z</option>
              </select>
            </div>
            <p><strong>Total Products:</strong> {productsData.length}</p>
            <p><strong>Filtered:</strong> {filteredProducts.length}</p>
          </div>
          {currentUser?.role === "customer" && (
            <div className="products-sidebar-ad">
              <GoogleAd slot={import.meta.env.VITE_ADSENSE_PRODUCTS_SLOT || ""} />
            </div>
          )}
        </aside>

        <section className="products-content">
          <div className="products-list">
            {productsWithMeta.map((item) => (
              <div className="product-card" key={item.id}>
                <img src={item.image} alt={item.name} />
                <h3>{item.name}</h3>
                <p>₹{item.price} / kg</p>
                <p className={`stock-badge ${item.stockQty <= 0 ? "out" : "in"}`}>
                  {item.stockQty <= 0 ? "Out of Stock" : `Stock: ${item.stockQty}`}
                </p>
                <div className="star-rating" aria-label={`Rating ${item.rating.toFixed(1)} out of 5`}>
                  {[1, 2, 3, 4, 5].map((star) => {
                    const isActive = item.rating >= star;
                    return (
                      <button
                        key={star}
                        type="button"
                        className={`star-btn ${isActive ? "active" : ""} ${canRateProducts ? "editable" : ""}`}
                        onClick={() => canRateProducts && setStarRating(item, star)}
                        disabled={!canRateProducts}
                        aria-label={`Set rating to ${star} stars`}
                        title={canRateProducts ? `Set ${star} star rating` : `${star} stars`}
                      >
                        ★
                      </button>
                    );
                  })}
                </div>

                {canManageTags && (
                  <div className="product-admin-meta">
                    <input
                      type="number"
                      min="0"
                      step="1"
                      placeholder="Stock Qty"
                      value={draftMeta[item.id]?.stockQty ?? item.stockQty}
                      onChange={(event) => onDraftMetaChange(item.id, "stockQty", event.target.value)}
                    />
                    <input
                      type="number"
                      min="0"
                      step="1"
                      placeholder="Likes"
                      value={draftMeta[item.id]?.likes ?? item.likes}
                      onChange={(event) => onDraftMetaChange(item.id, "likes", event.target.value)}
                    />
                    <input
                      type="text"
                      placeholder="Tags (comma separated)"
                      value={draftMeta[item.id]?.tags ?? item.tags.join(",")}
                      onChange={(event) => onDraftMetaChange(item.id, "tags", event.target.value)}
                    />
                    <button type="button" className="save-meta-btn" onClick={() => saveMeta(item.id)}>
                      Save Tags
                    </button>
                  </div>
                )}

                {currentUser?.role === "customer" && (
                  <div className="product-review-form">
                    <textarea
                      rows={3}
                      placeholder="Write your product review"
                      value={reviewDraft[item.id]?.text || ""}
                      onChange={(event) => onReviewDraftChange(item.id, "text", event.target.value)}
                    />
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={(event) => onReviewPhotoSelect(item.id, event.target.files)}
                    />
                    {Array.isArray(reviewDraft[item.id]?.photos) && reviewDraft[item.id].photos.length > 0 && (
                      <div className="review-photo-preview">
                        {reviewDraft[item.id].photos.map((photo, idx) => (
                          <img key={`${item.id}_photo_${idx}`} src={photo} alt="Review upload preview" />
                        ))}
                      </div>
                    )}
                    <button type="button" className="save-review-btn" onClick={() => submitProductReview(item)}>
                      Submit Review
                    </button>
                  </div>
                )}

                {getProductReviews(item.id).length > 0 && (
                  <div className="product-review-list">
                    <p className="review-heading">Customer Reviews</p>
                    {getProductReviews(item.id).map((review) => (
                      <article className="product-review-item" key={review.id}>
                        <p><strong>{review.rating}★</strong> {review.text}</p>
                        <p className="review-meta">{review.customerEmail} - {new Date(review.createdAt).toLocaleString("en-IN")}</p>
                        {Array.isArray(review.photos) && review.photos.length > 0 && (
                          <div className="review-photo-grid">
                            {review.photos.map((photo, idx) => (
                              <img key={`${review.id}_${idx}`} src={photo} alt="Customer review" />
                            ))}
                          </div>
                        )}
                      </article>
                    ))}
                  </div>
                )}
                <button
                  onClick={() => onAddToCart(item)}
                  disabled={item.stockQty <= 0}
                  title={item.stockQty <= 0 ? "Out of stock" : "Add to cart"}
                >
                  {item.stockQty <= 0 ? "Out of Stock" : "Add to Cart"}
                </button>
              </div>
            ))}
          </div>
        </section>
      </div>

      {canManageTags && (
        <section className="rating-log-panel">
          <h3>Out of Stock Products</h3>
          {outOfStockProducts.length === 0 && <p>No products are out of stock.</p>}
          {outOfStockProducts.length > 0 && (
            <div className="rating-log-list">
              {outOfStockProducts.map((item) => (
                <article className="rating-log-item" key={`stock_${item.id}`}>
                  <p><strong>Product:</strong> {item.name}</p>
                  <p><strong>Category:</strong> {item.category}</p>
                  <p><strong>Rate:</strong> INR {item.price}</p>
                  <p><strong>Status:</strong> Out of Stock</p>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {canManageTags && (
        <section className="rating-log-panel">
          <h3>Customer Rating Messages</h3>
          {isRatingLogsLoading && <p>Loading rating messages...</p>}
          {!isRatingLogsLoading && ratingLogsError && <p>{ratingLogsError}</p>}
          {!isRatingLogsLoading && !ratingLogsError && ratingLogs.length === 0 && (
            <p>No customer ratings submitted yet.</p>
          )}
          {!isRatingLogsLoading && !ratingLogsError && ratingLogs.length > 0 && (
            <div className="rating-log-list">
              {ratingLogs.map((log) => (
                <article className="rating-log-item" key={log.id}>
                  <p><strong>Product:</strong> {log.productName}</p>
                  <p><strong>Rate:</strong> INR {log.price}</p>
                  <p><strong>Rating:</strong> {log.rating} / 5</p>
                  <p><strong>Customer:</strong> {log.customerEmail}</p>
                  <p><strong>Message:</strong> {log.message || "(no message)"}</p>
                  <p><strong>Time:</strong> {new Date(log.createdAt).toLocaleString("en-IN")}</p>
                </article>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

export default Products;