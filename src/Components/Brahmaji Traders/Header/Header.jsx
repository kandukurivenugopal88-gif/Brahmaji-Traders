import "./Header.css";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");
const FALLBACK_API_BASE_URL = "http://localhost:5000";
const RATING_SEEN_KEY_PREFIX = "bt_rating_seen_at_";
const ORDER_SEEN_KEY_PREFIX = "bt_order_seen_at_";
const RATING_POLL_MS = 60000;
const ORDER_POLL_MS = 45000;

function resolveApiUrl(path) {
  if (API_BASE_URL) {
    return `${API_BASE_URL}${path}`;
  }
  return path;
}

async function fetchRatingNotifications(currentUser) {
  const endpoint = "/api/product/ratings";
  const headers = {
    "x-user-role": String(currentUser?.role || "").toLowerCase(),
  };

  const parseJson = async (response) => {
    try {
      return await response.json();
    } catch {
      return null;
    }
  };

  try {
    const primary = await fetch(resolveApiUrl(endpoint), { headers });
    const data = await parseJson(primary);

    if (!primary.ok && !API_BASE_URL) {
      const retry = await fetch(`${FALLBACK_API_BASE_URL}${endpoint}`, { headers });
      const retryData = await parseJson(retry);

      if (!retry.ok || !retryData?.success) {
        throw new Error(retryData?.message || "Unable to load rating notifications.");
      }

      return Array.isArray(retryData.ratings) ? retryData.ratings : [];
    }

    if (!primary.ok || !data?.success) {
      throw new Error(data?.message || "Unable to load rating notifications.");
    }

    return Array.isArray(data.ratings) ? data.ratings : [];
  } catch {
    if (!API_BASE_URL) {
      const retry = await fetch(`${FALLBACK_API_BASE_URL}${endpoint}`, { headers });
      const retryData = await parseJson(retry);
      if (!retry.ok || !retryData?.success) {
        throw new Error(retryData?.message || "Unable to load rating notifications.");
      }
      return Array.isArray(retryData.ratings) ? retryData.ratings : [];
    }

    throw new Error("Unable to load rating notifications.");
  }
}

async function fetchOrderNotifications(currentUser) {
  const endpoint = "/api/orders";
  const headers = {
    "x-user-role": String(currentUser?.role || "").toLowerCase(),
    "x-user-email": String(currentUser?.email || "").toLowerCase(),
  };

  const parseJson = async (response) => {
    try {
      return await response.json();
    } catch {
      return null;
    }
  };

  try {
    const primary = await fetch(resolveApiUrl(endpoint), { headers });
    const data = await parseJson(primary);

    if (!primary.ok && !API_BASE_URL) {
      const retry = await fetch(`${FALLBACK_API_BASE_URL}${endpoint}`, { headers });
      const retryData = await parseJson(retry);
      if (!retry.ok || !retryData?.success) {
        throw new Error(retryData?.message || "Unable to load order notifications.");
      }

      return Array.isArray(retryData.orders) ? retryData.orders : [];
    }

    if (!primary.ok || !data?.success) {
      throw new Error(data?.message || "Unable to load order notifications.");
    }

    return Array.isArray(data.orders) ? data.orders : [];
  } catch {
    if (!API_BASE_URL) {
      const retry = await fetch(`${FALLBACK_API_BASE_URL}${endpoint}`, { headers });
      const retryData = await parseJson(retry);
      if (!retry.ok || !retryData?.success) {
        throw new Error(retryData?.message || "Unable to load order notifications.");
      }

      return Array.isArray(retryData.orders) ? retryData.orders : [];
    }

    throw new Error("Unable to load order notifications.");
  }
}

function Header({ onLogout, cartCount, currentUser }) {
  const location = useLocation();
  const [isProductsMenuOpen, setIsProductsMenuOpen] = useState(false);
  const [isOrdersOpen, setIsOrdersOpen] = useState(false);
  const [isRatingsOpen, setIsRatingsOpen] = useState(false);
  const [ratingLogs, setRatingLogs] = useState([]);
  const [orderLogs, setOrderLogs] = useState([]);
  const [isRatingsLoading, setIsRatingsLoading] = useState(false);
  const [ratingsError, setRatingsError] = useState("");
  const [seenAt, setSeenAt] = useState(0);
  const [ordersSeenAt, setOrdersSeenAt] = useState(0);
  const orderNotificationRef = useRef(null);
  const ratingNotificationRef = useRef(null);
  const isCustomerOnly = currentUser?.role === "customer";
  const canViewRatingNotifications = ["admin", "developer"].includes(currentUser?.role);
  const canViewOrderNotifications = ["admin", "developer"].includes(currentUser?.role);

  const seenStorageKey = useMemo(() => {
    const identity = String(currentUser?.email || currentUser?.role || "admin")
      .trim()
      .toLowerCase();
    return `${RATING_SEEN_KEY_PREFIX}${identity}`;
  }, [currentUser?.email, currentUser?.role]);

  const orderSeenStorageKey = useMemo(() => {
    const identity = String(currentUser?.email || currentUser?.role || "admin")
      .trim()
      .toLowerCase();
    return `${ORDER_SEEN_KEY_PREFIX}${identity}`;
  }, [currentUser?.email, currentUser?.role]);

  useEffect(() => {
    const stored = Number(localStorage.getItem(seenStorageKey) || 0);
    setSeenAt(Number.isFinite(stored) ? stored : 0);
  }, [seenStorageKey]);

  useEffect(() => {
    const stored = Number(localStorage.getItem(orderSeenStorageKey) || 0);
    setOrdersSeenAt(Number.isFinite(stored) ? stored : 0);
  }, [orderSeenStorageKey]);

  useEffect(() => {
    if (!canViewRatingNotifications) {
      setRatingLogs([]);
      setRatingsError("");
      return;
    }

    let isMounted = true;

    const loadRatings = async () => {
      setIsRatingsLoading(true);
      setRatingsError("");

      try {
        const ratings = await fetchRatingNotifications(currentUser);
        if (!isMounted) {
          return;
        }
        setRatingLogs(ratings);
      } catch (error) {
        if (!isMounted) {
          return;
        }
        setRatingsError(error.message || "Unable to load rating notifications.");
      } finally {
        if (isMounted) {
          setIsRatingsLoading(false);
        }
      }
    };

    loadRatings();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") {
        loadRatings();
      }
    }, RATING_POLL_MS);

    return () => {
      isMounted = false;
      clearInterval(timer);
    };
  }, [canViewRatingNotifications, currentUser]);

  useEffect(() => {
    if (!canViewOrderNotifications) {
      setOrderLogs([]);
      return;
    }

    let isMounted = true;

    const loadOrders = async () => {
      try {
        const orders = await fetchOrderNotifications(currentUser);
        if (!isMounted) {
          return;
        }

        setOrderLogs(orders);
      } catch {
        if (!isMounted) {
          return;
        }
        setOrderLogs([]);
      }
    };

    loadOrders();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") {
        loadOrders();
      }
    }, ORDER_POLL_MS);

    return () => {
      isMounted = false;
      clearInterval(timer);
    };
  }, [canViewOrderNotifications, currentUser]);

  const unreadCount = useMemo(() => {
    if (!Array.isArray(ratingLogs) || ratingLogs.length === 0) {
      return 0;
    }

    return ratingLogs.filter((item) => {
      const createdMs = new Date(item?.createdAt || 0).getTime();
      return Number.isFinite(createdMs) && createdMs > seenAt;
    }).length;
  }, [ratingLogs, seenAt]);

  const markRatingsAsSeen = () => {
    const now = Date.now();
    setSeenAt(now);
    localStorage.setItem(seenStorageKey, String(now));
  };

  const toggleRatingPanel = () => {
    setIsRatingsOpen((prev) => {
      const next = !prev;
      if (next) {
        markRatingsAsSeen();
      }
      return next;
    });
  };

  const pendingOrderLogs = useMemo(() => {
    return Array.isArray(orderLogs)
      ? orderLogs.filter((order) => {
          const createdMs = new Date(order?.createdAt || 0).getTime();
          return (
            String(order?.status || "").toLowerCase() === "new" &&
            Number.isFinite(createdMs) &&
            createdMs > ordersSeenAt
          );
        })
      : [];
  }, [orderLogs, ordersSeenAt]);

  const markOrdersAsSeen = useCallback(() => {
    const now = Date.now();
    setOrdersSeenAt(now);
    localStorage.setItem(orderSeenStorageKey, String(now));
  }, [orderSeenStorageKey]);

  useEffect(() => {
    if (canViewOrderNotifications && location.pathname === "/orders") {
      markOrdersAsSeen();
      setIsOrdersOpen(false);
    }
  }, [canViewOrderNotifications, location.pathname, markOrdersAsSeen]);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (
        isOrdersOpen &&
        orderNotificationRef.current &&
        !orderNotificationRef.current.contains(event.target)
      ) {
        setIsOrdersOpen(false);
      }

      if (
        isRatingsOpen &&
        ratingNotificationRef.current &&
        !ratingNotificationRef.current.contains(event.target)
      ) {
        setIsRatingsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [isOrdersOpen, isRatingsOpen]);

  const toggleOrderPanel = () => {
    setIsOrdersOpen((prev) => {
      const next = !prev;
      if (next) {
        markOrdersAsSeen();
      }
      return next;
    });
  };

  return (
    <div className="header">
        <div className="flexContainer">
            <h1>Brahmaji Traders</h1>
        </div>

        <div className="flexContainer">
            {isCustomerOnly ? (
              <>
                <Link to="/" onClick={() => setIsProductsMenuOpen(false)}>Home</Link>
                <div
                  className={`nav-dropdown ${isProductsMenuOpen ? "open" : ""}`}
                  onMouseEnter={() => setIsProductsMenuOpen(true)}
                  onMouseLeave={() => setIsProductsMenuOpen(false)}
                >
                  <Link to="/products" className="nav-dropdown-trigger">
                    Products <span className="nav-arrow">&#9662;</span>
                  </Link>
                  <div className="nav-dropdown-menu">
                    <Link to="/products" onClick={() => setIsProductsMenuOpen(false)}>All Products</Link>
                    <Link to="/orders" onClick={() => setIsProductsMenuOpen(false)}>My Orders</Link>
                    <Link to="/cart" onClick={() => setIsProductsMenuOpen(false)}>Cart</Link>
                  </div>
                </div>
                <Link to="/orders" onClick={() => setIsProductsMenuOpen(false)}>My Orders</Link>
                <Link to="/prices" onClick={() => setIsProductsMenuOpen(false)}>Live Price</Link>
                <Link to="/profile" onClick={() => setIsProductsMenuOpen(false)}>Profile</Link>
              </>
            ) : (
              <>
                <Link to="/" onClick={() => setIsProductsMenuOpen(false)}>Home</Link>
                <div
                  className={`nav-dropdown ${isProductsMenuOpen ? "open" : ""}`}
                  onMouseEnter={() => setIsProductsMenuOpen(true)}
                  onMouseLeave={() => setIsProductsMenuOpen(false)}
                >
                  <Link to="/products" className="nav-dropdown-trigger">
                    Products <span className="nav-arrow">&#9662;</span>
                  </Link>
                  <div className="nav-dropdown-menu">
                    <Link to="/products" onClick={() => setIsProductsMenuOpen(false)}>All Products</Link>
                    <Link to="/orders" onClick={() => setIsProductsMenuOpen(false)}>My Orders</Link>
                  </div>
                </div>
                <Link to="/profile" onClick={() => setIsProductsMenuOpen(false)}>Profile</Link>
                <Link to="/contactus" onClick={() => setIsProductsMenuOpen(false)}>Contactus</Link>
                <Link to="/prices" onClick={() => setIsProductsMenuOpen(false)}>Live Price</Link>
              </>
            )}
        </div>

         <div className="flexContainer">
        {canViewOrderNotifications && (
          <div ref={orderNotificationRef} className={`nav-rating ${isOrdersOpen ? "open" : ""}`}>
            <button
              type="button"
              className="rating-bell-btn"
              aria-label="Order notifications"
              title="Order notifications"
              onClick={toggleOrderPanel}
            >
              <i className="bi bi-bell-fill"></i>
              {pendingOrderLogs.length > 0 && (
                <span className="rating-badge">{pendingOrderLogs.length > 99 ? "99+" : pendingOrderLogs.length}</span>
              )}
            </button>

            {isOrdersOpen && (
              <div className="rating-dropdown">
                <div className="rating-dropdown-head">
                  <strong>Order Notifications</strong>
                </div>
                <div className="order-popup-body">
                  <p className="rating-dropdown-status">
                    {pendingOrderLogs.length > 0
                      ? `${pendingOrderLogs.length} new order notification${pendingOrderLogs.length > 1 ? "s" : ""}.`
                      : "No new order notifications."}
                  </p>
                  {pendingOrderLogs.length > 0 && (
                    <ul className="rating-dropdown-list">
                      {pendingOrderLogs.slice(0, 6).map((order) => (
                        <li key={order.id} className="unread">
                          <div className="rating-title-row">
                            <span className="rating-product">{order.customerName || "Customer"}</span>
                            <span className="rating-score">{order.amount || 0}</span>
                          </div>
                          <p>{order.customerPhone || "No phone"}</p>
                          <small>
                            {order.createdAt ? new Date(order.createdAt).toLocaleString("en-IN") : "-"}
                          </small>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
        {canViewRatingNotifications && (
          <div ref={ratingNotificationRef} className={`nav-rating ${isRatingsOpen ? "open" : ""}`}>
            <button
              type="button"
              className="rating-bell-btn"
              onClick={toggleRatingPanel}
              aria-label="Product rating notifications"
            >
              <i className="bi bi-heart-fill"></i>
              {unreadCount > 0 && <span className="rating-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>}
            </button>

            {isRatingsOpen && (
              <div className="rating-dropdown">
                <div className="rating-dropdown-head">
                  <strong>Customer Ratings</strong>
                </div>
                {isRatingsLoading && <p className="rating-dropdown-status">Loading...</p>}
                {!isRatingsLoading && ratingsError && <p className="rating-dropdown-error">{ratingsError}</p>}
                {!isRatingsLoading && !ratingsError && ratingLogs.length === 0 && (
                  <p className="rating-dropdown-status">No ratings yet.</p>
                )}
                {!isRatingsLoading && !ratingsError && ratingLogs.length > 0 && (
                  <ul className="rating-dropdown-list">
                    {ratingLogs.slice(0, 6).map((rating) => {
                      const createdMs = new Date(rating?.createdAt || 0).getTime();
                      const isUnread = Number.isFinite(createdMs) && createdMs > seenAt;

                      return (
                        <li key={rating.id} className={isUnread ? "unread" : ""}>
                          <div className="rating-title-row">
                            <span className="rating-product">{rating.productName || "Product"}</span>
                            <span className="rating-score">{rating.rating || 0}/5</span>
                          </div>
                          <p>{rating.customerEmail || "Unknown customer"}</p>
                          <small>
                            {rating.createdAt ? new Date(rating.createdAt).toLocaleString("en-IN") : "-"}
                          </small>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}
        <Link to="/cart" style={{ position: "relative" }}>
          <i className="bi bi-cart-check-fill"></i>
          {cartCount > 0 && (
            <span style={{
              position: "absolute",
              top: -8,
              right: -10,
              background: "#d32f2f",
              color: "#fff",
              borderRadius: "50%",
              fontSize: "0.8rem",
              padding: "2px 7px",
              fontWeight: 600
            }}>{cartCount}</span>
          )}
        </Link>
        <button className="logout-btn" onClick={onLogout}>Logout</button>
        </div>
    </div>
  );
}

export default Header;