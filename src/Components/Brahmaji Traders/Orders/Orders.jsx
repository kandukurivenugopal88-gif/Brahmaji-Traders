import { useCallback, useEffect, useState } from "react";
import "./Orders.css";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");
const FALLBACK_API_BASE_URL = "http://localhost:5000";
const CANCEL_REASON_OPTIONS = [
  "Ordered by mistake",
  "Found better price",
  "Delivery time too long",
  "Need to change items",
  "Other",
];
const RETURN_REASON_OPTIONS = [
  "Wrong item delivered",
  "Damaged product",
  "Quality issue",
  "Product not as expected",
  "Other",
];
const ADMIN_ORDER_REFRESH_MS = 30000;
const RETURN_WINDOW_DAYS = 7;
const RETURN_WINDOW_MS = RETURN_WINDOW_DAYS * 24 * 60 * 60 * 1000;
const COMPANY_PROFILE = {
  businessName: "Brahmaji Traders",
  location: "Guntur, Andhra Pradesh",
  proprietor: "Kandukuri Gurubrahmachari",
  email: "brahmajitraders9@gmail.com",
  phone: "+91-9866926561",
};

function resolveApiUrl(path) {
  if (API_BASE_URL) {
    return `${API_BASE_URL}${path}`;
  }
  return path;
}

async function fetchOrders(currentUser) {
  const primaryUrl = resolveApiUrl("/api/orders");
  const roleHeader = currentUser?.role || "customer";
  const emailHeader = currentUser?.email || "";
  const requestOptions = {
    headers: {
      "x-user-role": roleHeader,
      "x-user-email": emailHeader,
    },
  };

  try {
    const res = await fetch(primaryUrl, requestOptions);
    const text = await res.text();
    const data = text ? JSON.parse(text) : null;

    if (!res.ok && !API_BASE_URL) {
      const retry = await fetch(`${FALLBACK_API_BASE_URL}/api/orders`, requestOptions);
      const retryText = await retry.text();
      const retryData = retryText ? JSON.parse(retryText) : null;
      return { ok: retry.ok, data: retryData };
    }

    return { ok: res.ok, data };
  } catch {
    if (!API_BASE_URL) {
      const retry = await fetch(`${FALLBACK_API_BASE_URL}/api/orders`, requestOptions);
      const retryText = await retry.text();
      const retryData = retryText ? JSON.parse(retryText) : null;
      return { ok: retry.ok, data: retryData };
    }

    throw new Error("Unable to connect to order API.");
  }
}

async function updateOrderStatus(orderId, status, currentUser) {
  const primaryUrl = resolveApiUrl(`/api/orders/${orderId}/status`);
  const roleHeader = currentUser?.role || "customer";
  const emailHeader = currentUser?.email || "";

  try {
    const res = await fetch(primaryUrl, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "x-user-role": roleHeader,
        "x-user-email": emailHeader,
      },
      body: JSON.stringify({ status }),
    });

    const text = await res.text();
    const data = text ? JSON.parse(text) : null;

    if (!res.ok && !API_BASE_URL) {
      const retry = await fetch(`${FALLBACK_API_BASE_URL}/api/orders/${orderId}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-user-role": roleHeader,
          "x-user-email": emailHeader,
        },
        body: JSON.stringify({ status }),
      });
      const retryText = await retry.text();
      const retryData = retryText ? JSON.parse(retryText) : null;
      return { ok: retry.ok, data: retryData };
    }

    return { ok: res.ok, data };
  } catch {
    if (!API_BASE_URL) {
      const retry = await fetch(`${FALLBACK_API_BASE_URL}/api/orders/${orderId}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-user-role": roleHeader,
          "x-user-email": emailHeader,
        },
        body: JSON.stringify({ status }),
      });
      const retryText = await retry.text();
      const retryData = retryText ? JSON.parse(retryText) : null;
      return { ok: retry.ok, data: retryData };
    }

    throw new Error("Unable to connect to order status API.");
  }
}

async function cancelCustomerOrder(orderId, reason, currentUser) {
  const primaryUrl = resolveApiUrl(`/api/orders/${orderId}/cancel`);
  const roleHeader = currentUser?.role || "customer";
  const emailHeader = currentUser?.email || "";

  try {
    const res = await fetch(primaryUrl, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "x-user-role": roleHeader,
        "x-user-email": emailHeader,
      },
      body: JSON.stringify({ reason }),
    });

    const text = await res.text();
    const data = text ? JSON.parse(text) : null;

    if (!res.ok && !API_BASE_URL) {
      const retry = await fetch(`${FALLBACK_API_BASE_URL}/api/orders/${orderId}/cancel`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-user-role": roleHeader,
          "x-user-email": emailHeader,
        },
        body: JSON.stringify({ reason }),
      });
      const retryText = await retry.text();
      const retryData = retryText ? JSON.parse(retryText) : null;
      return { ok: retry.ok, data: retryData };
    }

    return { ok: res.ok, data };
  } catch {
    if (!API_BASE_URL) {
      const retry = await fetch(`${FALLBACK_API_BASE_URL}/api/orders/${orderId}/cancel`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-user-role": roleHeader,
          "x-user-email": emailHeader,
        },
        body: JSON.stringify({ reason }),
      });
      const retryText = await retry.text();
      const retryData = retryText ? JSON.parse(retryText) : null;
      return { ok: retry.ok, data: retryData };
    }

    throw new Error("Unable to connect to cancel order API.");
  }
}

async function requestCustomerReturn(orderId, reason, currentUser) {
  const primaryUrl = resolveApiUrl(`/api/orders/${orderId}/return`);
  const roleHeader = currentUser?.role || "customer";
  const emailHeader = currentUser?.email || "";

  try {
    const res = await fetch(primaryUrl, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "x-user-role": roleHeader,
        "x-user-email": emailHeader,
      },
      body: JSON.stringify({ reason }),
    });

    const text = await res.text();
    const data = text ? JSON.parse(text) : null;

    if (!res.ok && !API_BASE_URL) {
      const retry = await fetch(`${FALLBACK_API_BASE_URL}/api/orders/${orderId}/return`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-user-role": roleHeader,
          "x-user-email": emailHeader,
        },
        body: JSON.stringify({ reason }),
      });
      const retryText = await retry.text();
      const retryData = retryText ? JSON.parse(retryText) : null;
      return { ok: retry.ok, data: retryData };
    }

    return { ok: res.ok, data };
  } catch {
    if (!API_BASE_URL) {
      const retry = await fetch(`${FALLBACK_API_BASE_URL}/api/orders/${orderId}/return`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-user-role": roleHeader,
          "x-user-email": emailHeader,
        },
        body: JSON.stringify({ reason }),
      });
      const retryText = await retry.text();
      const retryData = retryText ? JSON.parse(retryText) : null;
      return { ok: retry.ok, data: retryData };
    }

    throw new Error("Unable to connect to return order API.");
  }
}

function Orders({ currentUser, onReorder }) {
  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatingOrderId, setUpdatingOrderId] = useState("");
  const [cancelModal, setCancelModal] = useState({
    isOpen: false,
    orderId: "",
    status: "",
    reason: "",
    selectedPreset: "",
  });
  const [returnModal, setReturnModal] = useState({
    isOpen: false,
    orderId: "",
    reason: "",
    selectedPreset: "",
  });
  const canManageOrders = ["admin", "developer"].includes(currentUser?.role);
  const canCustomerCancel = currentUser?.role === "customer";
  const headingText = canManageOrders ? "Recent Orders" : "My Orders & Tracking";
  const timelineStatuses = ["new", "accepted", "packed", "shipped", "delivered"];

  const escapeHtml = (value) =>
    String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

  const formatAmount = (value, currency = "INR") => {
    const amount = Number(value || 0);
    return `${currency} ${Number.isFinite(amount) ? amount.toFixed(2) : "0.00"}`;
  };

  const buildMapSearchUrl = (address) => {
    const clean = String(address || "").trim();
    if (!clean) {
      return "";
    }

    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(clean)}`;
  };

  const loadOrders = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const response = await fetchOrders(currentUser);
      if (!response.ok || !response.data?.success) {
        throw new Error(response.data?.message || "Failed to fetch orders.");
      }

      setOrders(Array.isArray(response.data.orders) ? response.data.orders : []);
    } catch (err) {
      setError(err.message || "Unable to load orders.");
    } finally {
      setIsLoading(false);
    }
  }, [currentUser]);

  const handleStatusUpdate = async (orderId, status) => {
    if (!canManageOrders) {
      alert("Only admin/developer can update order status.");
      return;
    }

    try {
      setUpdatingOrderId(orderId);
      const response = await updateOrderStatus(orderId, status, currentUser);
      if (!response.ok || !response.data?.success) {
        throw new Error(response.data?.message || "Failed to update order status.");
      }

      const finalStatus = response.data?.status || status;
      const updatedOrder = response.data?.order || {};
      setOrders((prev) =>
        prev.map((order) =>
          order.id === orderId
            ? {
                ...order,
                status: finalStatus,
                deliveredAt: updatedOrder.deliveredAt || order.deliveredAt || null,
                returnRequested: Boolean(updatedOrder.returnRequested ?? order.returnRequested),
                returnReason: updatedOrder.returnReason ?? order.returnReason,
                returnRequestedAt: updatedOrder.returnRequestedAt ?? order.returnRequestedAt,
                returnWindowEndsAt: updatedOrder.returnWindowEndsAt ?? order.returnWindowEndsAt,
                returnStatus: updatedOrder.returnStatus ?? order.returnStatus,
                returnedAt: updatedOrder.returnedAt ?? order.returnedAt,
              }
            : order
        )
      );

      const emailMessage = response.data?.notifications?.emailMessage;
      const smsMessage = response.data?.notifications?.smsMessage;
      const emailSent = Boolean(response.data?.notifications?.emailSent);
      const smsSent = Boolean(response.data?.notifications?.smsSent);
      const smsMode = String(response.data?.notifications?.smsMode || "").toLowerCase();

      let smsUiMessage = smsMessage || "";
      if (smsSent && smsMode === "simulated") {
        smsUiMessage = "Customer SMS simulated in demo mode. Add SMS provider key for real mobile SMS.";
      } else if (!smsSent) {
        smsUiMessage = smsMessage || "Customer SMS not sent. Configure SMS provider credentials in backend env.";
      }

      const statusSummary = `Order status updated to ${finalStatus}.`;
      const emailSummary = emailSent
        ? emailMessage || "Customer email sent."
        : emailMessage || "Customer email not sent.";
      const smsSummary = smsUiMessage || (smsSent ? "Customer SMS sent." : "Customer SMS not sent.");

      alert([statusSummary, emailSummary, smsSummary].filter(Boolean).join("\n"));
    } catch (err) {
      alert(err.message || "Unable to update status.");
    } finally {
      setUpdatingOrderId("");
    }
  };

  const isCancellableStatus = (status) => {
    const value = String(status || "").toLowerCase();
    return !["delivered", "rejected", "cancelled"].includes(value);
  };

  const getReturnWindowInfo = (order) => {
    const status = String(order?.status || "").toLowerCase();
    const returnStatus = String(order?.returnStatus || "none").toLowerCase();
    const activeRequest = ["requested", "approved", "completed"].includes(returnStatus);

    if (status !== "delivered") {
      return {
        isDelivered: false,
        canRequest: false,
        activeRequest,
        withinWindow: false,
        daysLeft: 0,
      };
    }

    const deliveredAtRaw = order?.deliveredAt || order?.updatedAt || order?.createdAt;
    const deliveredAtMs = new Date(deliveredAtRaw).getTime();
    const fallbackWindowEndMs = Number.isFinite(deliveredAtMs)
      ? deliveredAtMs + RETURN_WINDOW_MS
      : Date.now() - 1;
    const windowEndMs = order?.returnWindowEndsAt
      ? new Date(order.returnWindowEndsAt).getTime()
      : fallbackWindowEndMs;
    const safeWindowEndMs = Number.isFinite(windowEndMs) ? windowEndMs : Date.now() - 1;
    const remainingMs = safeWindowEndMs - Date.now();
    const withinWindow = remainingMs >= 0;
    const daysLeft = withinWindow ? Math.max(1, Math.ceil(remainingMs / (24 * 60 * 60 * 1000))) : 0;

    return {
      isDelivered: true,
      canRequest: withinWindow && !activeRequest,
      activeRequest,
      withinWindow,
      daysLeft,
      returnStatus,
    };
  };

  const getTimelineIndex = (status) => {
    const clean = String(status || "").toLowerCase();
    const idx = timelineStatuses.indexOf(clean);
    return idx < 0 ? 0 : idx;
  };

  const handleReorderClick = (order) => {
    if (!onReorder || !Array.isArray(order?.items) || order.items.length === 0) {
      return;
    }

    onReorder(order.items);
    alert("Items added to cart from this order.");
  };

  const handleInvoiceDownload = (order) => {
    const popup = window.open("", "_blank", "width=920,height=720");

    if (!popup) {
      alert("Please allow popups to view and print invoice.");
      return;
    }

    const items = Array.isArray(order?.items) ? order.items : [];
    const itemsHtml =
      items.length > 0
        ? items
            .map((item, index) => {
              const name = escapeHtml(item?.name || "Item");
              const qty = Number(item?.qty || 0);
              const price = Number(item?.price || 0);
              const lineTotal = qty * price;

              return `
                <tr>
                  <td>${index + 1}</td>
                  <td>${name}</td>
                  <td>${qty}</td>
                  <td>${formatAmount(price, order?.currency || "INR")}</td>
                  <td>${formatAmount(lineTotal, order?.currency || "INR")}</td>
                </tr>
              `;
            })
            .join("")
        : '<tr><td colspan="5">No items</td></tr>';

    const invoiceNumber = escapeHtml(order?.orderId || order?.id || "N/A");
    const invoiceDate = escapeHtml(new Date(order?.createdAt || Date.now()).toLocaleString("en-IN"));
    const paymentMethod = escapeHtml(order?.method === "cod" ? "Cash on Delivery" : "Online Payment");
    const customerName = escapeHtml(order?.customerName || "-");
    const customerEmail = escapeHtml(order?.customerEmail || "-");
    const customerPhone = escapeHtml(order?.customerPhone || "-");
    const customerAddress = escapeHtml(order?.customerAddress || "-");
    const totalAmount = formatAmount(order?.amount, order?.currency || "INR");
    const companyName = escapeHtml(COMPANY_PROFILE.businessName);
    const companyLocation = escapeHtml(COMPANY_PROFILE.location);
    const companyProprietor = escapeHtml(COMPANY_PROFILE.proprietor);
    const companyEmail = escapeHtml(COMPANY_PROFILE.email);
    const companyPhone = escapeHtml(COMPANY_PROFILE.phone);

    const invoiceHtml = `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Invoice ${invoiceNumber}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 24px; color: #1d2a39; }
            .top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 18px; }
            .brand h1 { margin: 0; font-size: 26px; color: #0f4a86; }
            .brand p { margin: 4px 0 0; color: #546372; }
            .meta { text-align: right; font-size: 14px; }
            .card { border: 1px solid #dbe4ef; border-radius: 10px; padding: 12px; margin-bottom: 14px; }
            h3 { margin: 0 0 8px; font-size: 16px; color: #183c66; }
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid #dbe4ef; padding: 8px; font-size: 14px; text-align: left; }
            th { background: #f4f8fd; color: #28507a; }
            .total { margin-top: 10px; text-align: right; font-weight: 700; font-size: 16px; }
            .footer { margin-top: 18px; color: #556473; font-size: 13px; }
            .actions { margin-top: 18px; display: flex; justify-content: flex-end; gap: 8px; }
            button { border: none; background: #0f62b0; color: white; padding: 8px 12px; border-radius: 8px; cursor: pointer; }
            button.secondary { background: #697b8f; }
            @media print { .actions { display: none; } body { margin: 10mm; } }
          </style>
        </head>
        <body>
          <div class="top">
            <div class="brand">
              <h1>${companyName}</h1>
              <p>Customer Invoice</p>
            </div>
            <div class="meta">
              <div><strong>Invoice No:</strong> ${invoiceNumber}</div>
              <div><strong>Date:</strong> ${invoiceDate}</div>
              <div><strong>Status:</strong> ${escapeHtml(order?.status || "new")}</div>
            </div>
          </div>

          <div class="card">
            <h3>Company Details</h3>
            <div><strong>Business Name:</strong> ${companyName}</div>
            <div><strong>Location:</strong> ${companyLocation}</div>
            <div><strong>Proprietor:</strong> ${companyProprietor}</div>
            <div><strong>Email:</strong> ${companyEmail}</div>
            <div><strong>Phone:</strong> ${companyPhone}</div>
          </div>

          <div class="card">
            <h3>Bill To</h3>
            <div><strong>Name:</strong> ${customerName}</div>
            <div><strong>Email:</strong> ${customerEmail}</div>
            <div><strong>Phone:</strong> ${customerPhone}</div>
            <div><strong>Address:</strong> ${customerAddress}</div>
            <div><strong>Payment Method:</strong> ${paymentMethod}</div>
          </div>

          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Item</th>
                <th>Qty</th>
                <th>Price</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>

          <div class="total">Grand Total: ${totalAmount}</div>

          <div class="footer">
            This is a system-generated invoice for your order tracking and billing reference.
          </div>

          <div class="actions">
            <button class="secondary" onclick="window.close()">Close</button>
            <button onclick="window.print()">Print / Save PDF</button>
          </div>
        </body>
      </html>
    `;

    popup.document.open();
    popup.document.write(invoiceHtml);
    popup.document.close();
    popup.focus();
  };

  const openCancelModal = (orderId, status) => {
    if (!canCustomerCancel) {
      return;
    }

    if (!isCancellableStatus(status)) {
      alert("This order can no longer be cancelled.");
      return;
    }

    setCancelModal({
      isOpen: true,
      orderId,
      status,
      reason: "",
      selectedPreset: "",
    });
  };

  const closeCancelModal = () => {
    setCancelModal({
      isOpen: false,
      orderId: "",
      status: "",
      reason: "",
      selectedPreset: "",
    });
  };

  const applyCancelReasonPreset = (preset) => {
    setCancelModal((prev) => ({
      ...prev,
      selectedPreset: preset,
      reason: preset === "Other" ? prev.reason : preset,
    }));
  };

  const openReturnModal = (order) => {
    if (!canCustomerCancel) {
      return;
    }

    const info = getReturnWindowInfo(order);
    if (!info.canRequest) {
      if (info.activeRequest) {
        alert("Return already requested for this order.");
      } else {
        alert("Return can be requested only within 7 days after delivery.");
      }
      return;
    }

    setReturnModal({
      isOpen: true,
      orderId: order.id,
      reason: "",
      selectedPreset: "",
    });
  };

  const closeReturnModal = () => {
    setReturnModal({
      isOpen: false,
      orderId: "",
      reason: "",
      selectedPreset: "",
    });
  };

  const applyReturnReasonPreset = (preset) => {
    setReturnModal((prev) => ({
      ...prev,
      selectedPreset: preset,
      reason: preset === "Other" ? prev.reason : preset,
    }));
  };

  const handleCancelOrder = async () => {
    const { orderId, status, reason } = cancelModal;
    const cleanReason = String(reason || "").trim();

    if (!orderId) {
      return;
    }

    if (!isCancellableStatus(status)) {
      alert("This order can no longer be cancelled.");
      closeCancelModal();
      return;
    }

    if (cleanReason.length < 3) {
      alert("Please enter a valid cancel reason.");
      return;
    }

    try {
      setUpdatingOrderId(orderId);
      const response = await cancelCustomerOrder(orderId, cleanReason, currentUser);
      if (!response.ok || !response.data?.success) {
        throw new Error(response.data?.message || "Failed to cancel order.");
      }

      const updatedOrder = response.data?.order || {};
      setOrders((prev) =>
        prev.map((order) =>
          order.id === orderId
            ? {
                ...order,
                status: updatedOrder.status || "cancelled",
                cancelReason: updatedOrder.cancelReason || cleanReason,
                cancelledAt: updatedOrder.cancelledAt || new Date().toISOString(),
                cancelledBy: updatedOrder.cancelledBy || currentUser?.email || "",
              }
            : order
        )
      );

      alert(response.data?.message || "Order cancelled successfully.");
      closeCancelModal();
    } catch (err) {
      alert(err.message || "Unable to cancel order.");
    } finally {
      setUpdatingOrderId("");
    }
  };

  const handleReturnOrder = async () => {
    const { orderId, reason } = returnModal;
    const cleanReason = String(reason || "").trim();

    if (!orderId) {
      return;
    }

    if (cleanReason.length < 3) {
      alert("Please enter a valid return reason.");
      return;
    }

    const order = orders.find((item) => item.id === orderId);
    if (!order) {
      alert("Order not found.");
      closeReturnModal();
      return;
    }

    const info = getReturnWindowInfo(order);
    if (!info.canRequest) {
      alert("Return can be requested only within 7 days after delivery.");
      closeReturnModal();
      return;
    }

    try {
      setUpdatingOrderId(orderId);
      const response = await requestCustomerReturn(orderId, cleanReason, currentUser);
      if (!response.ok || !response.data?.success) {
        throw new Error(response.data?.message || "Failed to request return.");
      }

      const updatedOrder = response.data?.order || {};
      setOrders((prev) =>
        prev.map((item) =>
          item.id === orderId
            ? {
                ...item,
                returnRequested: Boolean(updatedOrder.returnRequested),
                returnReason: updatedOrder.returnReason || cleanReason,
                returnRequestedAt: updatedOrder.returnRequestedAt || new Date().toISOString(),
                returnWindowEndsAt: updatedOrder.returnWindowEndsAt || item.returnWindowEndsAt || null,
                returnStatus: updatedOrder.returnStatus || "requested",
                deliveredAt: updatedOrder.deliveredAt || item.deliveredAt || null,
              }
            : item
        )
      );

      alert(response.data?.message || "Return request submitted successfully.");
      closeReturnModal();
    } catch (err) {
      alert(err.message || "Unable to request return.");
    } finally {
      setUpdatingOrderId("");
    }
  };

  useEffect(() => {
    loadOrders();
    // Keep admin view updated periodically; customer view uses manual refresh to avoid UI flicker.
    if (!canManageOrders) {
      return undefined;
    }

    const refreshTimer = setInterval(() => {
      if (document.visibilityState === "visible") {
        loadOrders();
      }
    }, ADMIN_ORDER_REFRESH_MS);

    return () => clearInterval(refreshTimer);
  }, [loadOrders, canManageOrders]);

  return (
    <section className="orders-page">
      <div className="orders-header-row">
        <h2>{headingText}</h2>
        <button type="button" onClick={loadOrders}>Refresh</button>
      </div>

      {isLoading && <p className="orders-status">Loading orders...</p>}
      {!isLoading && error && <p className="orders-error">{error}</p>}
      {!isLoading && !error && orders.length === 0 && (
        <p className="orders-status">No orders placed yet.</p>
      )}

      {!isLoading && !error && orders.length > 0 && (
        <div className="orders-table-wrap">
          <table className="orders-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Method</th>
                <th>Amount</th>
                <th>Customer</th>
                <th>Items</th>
                <th>Status</th>
                <th>Notify</th>
                {(canManageOrders || canCustomerCancel) && <th>Action</th>}
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id}>
                  <td>{new Date(order.createdAt).toLocaleString("en-IN")}</td>
                  <td>{order.method === "cod" ? "Cash on Delivery" : "Online"}</td>
                  <td>
                    {order.currency || "INR"} {order.amount}
                  </td>
                  <td>
                    <div>{order.customerName || "-"}</div>
                    <div className="order-subline">{order.customerPhone || "-"}</div>
                    {order.customerAddress && (
                      <div className="order-address-wrap">
                        <div className="order-subline">{order.customerAddress}</div>
                        <a
                          href={buildMapSearchUrl(order.customerAddress)}
                          target="_blank"
                          rel="noreferrer"
                          className="order-map-link"
                          title="Open delivery address on map"
                        >
                          Open Map <i className="bi bi-arrow-up-right" aria-hidden="true" />
                        </a>
                      </div>
                    )}
                  </td>
                  <td>
                    {Array.isArray(order.items)
                      ? order.items.map((item) => `${item.name} x${item.qty}`).join(", ")
                      : "-"}
                  </td>
                  <td>
                    <span className={`order-status status-${order.status || "new"}`}>
                      {order.status || "new"}
                    </span>
                    {!["cancelled", "rejected"].includes(String(order.status || "").toLowerCase()) && (
                      <div className="order-timeline" aria-label="Order timeline">
                        {timelineStatuses.map((step, index) => {
                          const active = index <= getTimelineIndex(order.status);
                          return (
                            <span key={`${order.id}_${step}`} className={`timeline-step ${active ? "active" : ""}`}>
                              {step}
                            </span>
                          );
                        })}
                      </div>
                    )}
                    {String(order.status || "").toLowerCase() === "cancelled" && order.cancelReason && (
                      <div className="order-cancel-reason">Reason: {order.cancelReason}</div>
                    )}
                    {String(order.status || "").toLowerCase() === "delivered" && (() => {
                      const returnInfo = getReturnWindowInfo(order);
                      if (returnInfo.activeRequest) {
                        return (
                          <div className="order-return-info">
                            Return {returnInfo.returnStatus}: {order.returnReason || "Requested"}
                          </div>
                        );
                      }

                      if (returnInfo.withinWindow) {
                        return (
                          <div className="order-return-info">
                            Return window: {returnInfo.daysLeft} day(s) left
                          </div>
                        );
                      }

                      return <div className="order-return-info closed">Return window closed</div>;
                    })()}
                  </td>
                  <td>
                    <span className={order.notified ? "notify-ok" : "notify-pending"}>
                      {order.notified ? "Sent" : "Not Configured"}
                    </span>
                  </td>
                  {canManageOrders && (
                    <td>
                      <select
                        className="status-select"
                        value={order.status || "new"}
                        disabled={updatingOrderId === order.id}
                        onChange={(event) => handleStatusUpdate(order.id, event.target.value)}
                      >
                        <option value="new">new</option>
                        <option value="accepted">accepted</option>
                        <option value="packed">packed</option>
                        <option value="shipped">shipped</option>
                        <option value="delivered">delivered</option>
                        <option value="rejected">rejected</option>
                      </select>
                    </td>
                  )}
                  {canCustomerCancel && !canManageOrders && (
                    <td>
                      <div className="order-action-stack">
                        {String(order.status || "").toLowerCase() !== "rejected" && (
                          <button
                            type="button"
                            className="invoice-order-btn"
                            onClick={() => handleInvoiceDownload(order)}
                          >
                            Invoice
                          </button>
                        )}
                        <button
                          type="button"
                          className="reorder-order-btn"
                          onClick={() => handleReorderClick(order)}
                          disabled={!Array.isArray(order.items) || order.items.length === 0}
                        >
                          Reorder
                        </button>
                        <button
                          type="button"
                          className="cancel-order-btn"
                          disabled={updatingOrderId === order.id || !isCancellableStatus(order.status)}
                          onClick={() => openCancelModal(order.id, order.status)}
                        >
                          Cancel Order
                        </button>
                        {(() => {
                          const returnInfo = getReturnWindowInfo(order);
                          if (!returnInfo.isDelivered) {
                            return null;
                          }

                          return (
                            <button
                              type="button"
                              className="return-order-btn"
                              disabled={updatingOrderId === order.id || !returnInfo.canRequest}
                              onClick={() => openReturnModal(order)}
                              title={
                                returnInfo.activeRequest
                                  ? "Return already requested"
                                  : returnInfo.withinWindow
                                    ? `Request return (${returnInfo.daysLeft} day(s) left)`
                                    : "Return window closed"
                              }
                            >
                              {returnInfo.activeRequest ? "Return Requested" : "Request Return"}
                            </button>
                          );
                        })()}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {cancelModal.isOpen && (
        <div className="cancel-modal-overlay" role="presentation" onClick={closeCancelModal}>
          <div
            className="cancel-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Cancel order with reason"
            onClick={(event) => event.stopPropagation()}
          >
            <h3>Cancel Order</h3>
            <p>Please tell us why you want to cancel this order.</p>
            <div className="cancel-reason-options">
              {CANCEL_REASON_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  className={`cancel-reason-chip ${cancelModal.selectedPreset === option ? "active" : ""}`}
                  onClick={() => applyCancelReasonPreset(option)}
                >
                  {option}
                </button>
              ))}
            </div>
            <textarea
              value={cancelModal.reason}
              onChange={(event) =>
                setCancelModal((prev) => ({
                  ...prev,
                  reason: event.target.value,
                  selectedPreset: prev.selectedPreset === "Other" ? "Other" : prev.selectedPreset,
                }))
              }
              placeholder="Enter cancel reason"
              rows={4}
            />
            <div className="cancel-modal-actions">
              <button
                type="button"
                className="cancel-modal-secondary"
                onClick={closeCancelModal}
              >
                Close
              </button>
              <button
                type="button"
                className="cancel-modal-primary"
                onClick={handleCancelOrder}
                disabled={updatingOrderId === cancelModal.orderId}
              >
                Confirm Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {returnModal.isOpen && (
        <div className="cancel-modal-overlay" role="presentation" onClick={closeReturnModal}>
          <div
            className="cancel-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Request return with reason"
            onClick={(event) => event.stopPropagation()}
          >
            <h3>Request Return</h3>
            <p>Return is allowed within 7 days after delivery. Please share reason.</p>
            <div className="cancel-reason-options">
              {RETURN_REASON_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  className={`cancel-reason-chip ${returnModal.selectedPreset === option ? "active" : ""}`}
                  onClick={() => applyReturnReasonPreset(option)}
                >
                  {option}
                </button>
              ))}
            </div>
            <textarea
              value={returnModal.reason}
              onChange={(event) =>
                setReturnModal((prev) => ({
                  ...prev,
                  reason: event.target.value,
                  selectedPreset: prev.selectedPreset === "Other" ? "Other" : prev.selectedPreset,
                }))
              }
              placeholder="Enter return reason"
              rows={4}
            />
            <div className="cancel-modal-actions">
              <button
                type="button"
                className="cancel-modal-secondary"
                onClick={closeReturnModal}
              >
                Close
              </button>
              <button
                type="button"
                className="return-modal-primary"
                onClick={handleReturnOrder}
                disabled={updatingOrderId === returnModal.orderId}
              >
                Submit Return
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export default Orders;
