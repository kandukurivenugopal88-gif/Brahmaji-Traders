import React, { useCallback, useEffect, useState } from "react";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");
const FALLBACK_API_BASE_URL = "http://localhost:5000";

const apiUrl = (path) => {
  if (API_BASE_URL) {
    return `${API_BASE_URL}${path}`;
  }
  return path;
};

const fallbackApiUrl = (path) => `${FALLBACK_API_BASE_URL}${path}`;
const LOGIN_USER_KEY = "brahmaji_traders_user";
const ADDRESS_BOOK_KEY = "brahmaji_traders_customer_address_book";

function readAddressBook() {
  try {
    const raw = localStorage.getItem(ADDRESS_BOOK_KEY);
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeAddressBook(data) {
  localStorage.setItem(ADDRESS_BOOK_KEY, JSON.stringify(data));
}

async function requestJson(path, options) {
  const primaryUrl = apiUrl(path);

  try {
    const response = await fetch(primaryUrl, options);
    const text = await response.text();
    let data = null;

    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text ? { message: text } : null;
    }

    // If Vite proxy/backend is unavailable, retry direct localhost backend.
    if (!response.ok && !API_BASE_URL) {
      const retry = await fetch(fallbackApiUrl(path), options);
      const retryText = await retry.text();
      let retryData = null;

      try {
        retryData = retryText ? JSON.parse(retryText) : null;
      } catch {
        retryData = retryText ? { message: retryText } : null;
      }

      return { ok: retry.ok, status: retry.status, data: retryData };
    }

    return { ok: response.ok, status: response.status, data };
  } catch {
    if (primaryUrl !== fallbackApiUrl(path)) {
      const retry = await fetch(fallbackApiUrl(path), options);
      const retryText = await retry.text();
      let retryData = null;

      try {
        retryData = retryText ? JSON.parse(retryText) : null;
      } catch {
        retryData = retryText ? { message: retryText } : null;
      }

      return { ok: retry.ok, status: retry.status, data: retryData };
    }
    throw new TypeError("Network request failed");
  }
}

function loadRazorpayScript() {
  return new Promise((resolve) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }

    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

function PaymentButton({ amount = 0, cartItems = [], currentUser = null, onPaymentSuccess }) {
  const [isLoading, setIsLoading] = useState(false);
  const [showMethodPicker, setShowMethodPicker] = useState(false);
  const [customerDetails, setCustomerDetails] = useState({
    name: "",
    phone: "",
    address: "",
  });
  const [savedAddresses, setSavedAddresses] = useState([]);
  const [selectedAddressId, setSelectedAddressId] = useState("");
  const [addressLabel, setAddressLabel] = useState("");
  const hasRequiredCustomerDetails =
    customerDetails.name.trim() &&
    customerDetails.phone.trim() &&
    customerDetails.address.trim();

  const getEffectiveCustomerEmail = useCallback(() => {
    const directEmail = String(currentUser?.email || "").trim().toLowerCase();
    if (directEmail) {
      return directEmail;
    }

    try {
      const rawUser = localStorage.getItem(LOGIN_USER_KEY);
      if (!rawUser) {
        return "";
      }

      const parsedUser = JSON.parse(rawUser);
      return String(parsedUser?.email || "").trim().toLowerCase();
    } catch {
      return "";
    }
  }, [currentUser?.email]);

  const notifyOrder = async ({ method, paymentId = null, orderId = null }) => {
    const customerEmail = getEffectiveCustomerEmail();

    if (!customerEmail) {
      throw new Error("Customer session missing. Please login again and place order.");
    }

    const notifyRes = await requestJson("/api/order/notify", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-user-email": customerEmail,
      },
      body: JSON.stringify({
        method,
        amount,
        currency: "INR",
        items: cartItems,
        paymentId,
        orderId,
        customerName: customerDetails.name.trim(),
        customerEmail,
        customerPhone: customerDetails.phone.trim(),
        customerAddress: customerDetails.address.trim(),
      }),
    });

    if (!notifyRes.ok) {
      throw new Error(notifyRes.data?.message || "Order placed, but notification failed.");
    }

    return notifyRes.data;
  };

  useEffect(() => {
    if (!showMethodPicker) {
      return;
    }

    const customerEmail = getEffectiveCustomerEmail();
    if (!customerEmail) {
      setSavedAddresses([]);
      setSelectedAddressId("");
      return;
    }

    const book = readAddressBook();
    const entries = Array.isArray(book[customerEmail]) ? book[customerEmail] : [];
    setSavedAddresses(entries);

    if (entries.length > 0) {
      const defaultEntry = entries.find((entry) => entry.isDefault) || entries[0];
      setSelectedAddressId(defaultEntry.id);
      setCustomerDetails({
        name: String(defaultEntry.name || ""),
        phone: String(defaultEntry.phone || ""),
        address: String(defaultEntry.address || ""),
      });
    }
  }, [showMethodPicker, getEffectiveCustomerEmail]);

  const applySavedAddress = (addressId) => {
    const selected = savedAddresses.find((entry) => entry.id === addressId);
    if (!selected) {
      return;
    }

    setCustomerDetails({
      name: String(selected.name || ""),
      phone: String(selected.phone || ""),
      address: String(selected.address || ""),
    });
  };

  const saveCurrentAddress = () => {
    if (!hasRequiredCustomerDetails) {
      alert("Please fill name, phone, and address before saving address.");
      return;
    }

    const customerEmail = getEffectiveCustomerEmail();
    if (!customerEmail) {
      alert("Customer session missing. Please login again.");
      return;
    }

    const book = readAddressBook();
    const existing = Array.isArray(book[customerEmail]) ? book[customerEmail] : [];
    const normalizedAddress = customerDetails.address.trim().toLowerCase();
    const normalizedPhone = customerDetails.phone.trim();
    const normalizedName = customerDetails.name.trim().toLowerCase();

    const duplicateIndex = existing.findIndex(
      (entry) =>
        String(entry.address || "").trim().toLowerCase() === normalizedAddress &&
        String(entry.phone || "").trim() === normalizedPhone &&
        String(entry.name || "").trim().toLowerCase() === normalizedName
    );

    let updated = [...existing];
    if (duplicateIndex >= 0) {
      updated[duplicateIndex] = {
        ...updated[duplicateIndex],
        name: customerDetails.name.trim(),
        phone: customerDetails.phone.trim(),
        address: customerDetails.address.trim(),
        label: addressLabel.trim() || updated[duplicateIndex].label || `Address ${duplicateIndex + 1}`,
        isDefault: true,
      };
    } else {
      updated = updated.map((entry) => ({ ...entry, isDefault: false }));
      updated.unshift({
        id: `addr_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        label: addressLabel.trim() || `Address ${existing.length + 1}`,
        name: customerDetails.name.trim(),
        phone: customerDetails.phone.trim(),
        address: customerDetails.address.trim(),
        isDefault: true,
      });
    }

    if (duplicateIndex >= 0) {
      updated = updated.map((entry, idx) => ({
        ...entry,
        isDefault: idx === duplicateIndex,
      }));
    }

    book[customerEmail] = updated.slice(0, 10);
    writeAddressBook(book);
    setSavedAddresses(book[customerEmail]);
    const defaultEntry = book[customerEmail].find((entry) => entry.isDefault) || book[customerEmail][0];
    setSelectedAddressId(defaultEntry?.id || "");
    setAddressLabel("");
    alert("Address saved successfully.");
  };

  const handleOnlinePayment = async () => {
    if (!hasRequiredCustomerDetails) {
      alert("Please fill customer name, phone, and address before paying online.");
      return;
    }

    if (!amount || amount <= 0) {
      alert("Cart total must be greater than zero to proceed.");
      return;
    }

    setIsLoading(true);

    try {
      const sdkLoaded = await loadRazorpayScript();
      if (!sdkLoaded) {
        alert("Unable to load Razorpay SDK. Please check your connection and try again.");
        return;
      }

      const [keyRes, orderRes] = await Promise.all([
        requestJson("/api/payment/key"),
        requestJson("/api/payment/create-order", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amount,
            currency: "INR",
            notes: {
              itemCount: String(cartItems.length),
            },
          }),
        }),
      ]);

      if (!keyRes.ok || !orderRes.ok) {
        const errorMessage =
          keyRes.data?.message ||
          orderRes.data?.message ||
          "Could not initialize payment. Start backend server and verify Razorpay keys.";
        throw new Error(errorMessage);
      }

      const key = keyRes.data?.key;
      const order = orderRes.data;

      if (!key || !order?.id) {
        throw new Error("Payment setup response is incomplete. Verify backend API responses.");
      }

      const options = {
        key,
        amount: order.amount,
        currency: order.currency,
        name: "Brahmaji Traders",
        description: "Order Payment",
        order_id: order.id,
        handler: async (response) => {
          try {
            const verifyRes = await requestJson("/api/payment/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(response),
            });

            const verifyData = verifyRes.data;
            if (!verifyRes.ok || !verifyData?.success) {
              throw new Error(verifyData?.message || "Payment verification failed.");
            }

            const notifyData = await notifyOrder({
              method: "online",
              paymentId: verifyData.paymentId || response.razorpay_payment_id,
              orderId: verifyData.orderId || response.razorpay_order_id,
            });

            if (!notifyData?.notified) {
              alert("Order placed, but email notification is not configured yet.");
            }

            alert("Payment successful! Your order has been confirmed.");
            if (onPaymentSuccess) {
              onPaymentSuccess(verifyData);
            }
          } catch (error) {
            alert(error.message || "Payment completed, but verification failed.");
          }
        },
        prefill: {
          name: customerDetails.name.trim() || "Customer",
          contact: customerDetails.phone.trim() || undefined,
        },
        notes: {
          source: "Brahmaji Traders Cart",
        },
        theme: {
          color: "#1976d2",
        },
      };

      const razorpay = new window.Razorpay(options);
      razorpay.on("payment.failed", (event) => {
        const msg = event?.error?.description || "Payment failed. Please try again.";
        alert(msg);
      });
      razorpay.open();
    } catch (error) {
      if (error?.name === "TypeError") {
        alert("Failed to connect to payment server. Run `npm run server` and try again.");
      } else {
        alert(error.message || "Unable to start payment.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleCashOnDelivery = () => {
    if (!hasRequiredCustomerDetails) {
      alert("Please fill customer name, phone, and address before selecting Cash on Delivery.");
      return;
    }

    const confirmOrder = window.confirm(
      `Place this order with Cash on Delivery for ₹${amount}?`
    );

    if (!confirmOrder) {
      return;
    }

    const placeCodOrder = async () => {
      setIsLoading(true);
      try {
        const notifyData = await notifyOrder({ method: "cod" });

        if (!notifyData?.notified) {
          alert("Order placed, but email notification is not configured yet.");
        }

        alert("Order placed with Cash on Delivery. Please keep cash ready at delivery.");

        if (onPaymentSuccess) {
          onPaymentSuccess({
            success: true,
            method: "cod",
            amount,
            message: "Order placed with Cash on Delivery.",
          });
        }
      } catch (error) {
        alert(error.message || "COD order failed. Please try again.");
      } finally {
        setIsLoading(false);
      }
    };

    placeCodOrder();
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setShowMethodPicker(true)}
        disabled={isLoading || amount <= 0}
        style={{
          marginTop: "14px",
          background: "#1976d2",
          color: "#fff",
          border: "none",
          padding: "10px 16px",
          borderRadius: "6px",
          fontSize: "1rem",
          cursor: isLoading ? "not-allowed" : "pointer",
          opacity: isLoading ? 0.8 : 1,
        }}
      >
        {isLoading ? "Processing..." : `Proceed to Pay ₹${amount}`}
      </button>

      {showMethodPicker && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0, 0, 0, 0.35)",
            display: "grid",
            placeItems: "center",
            zIndex: 1000,
          }}
        >
          <div
            style={{
              width: "min(92vw, 360px)",
              background: "#fff",
              borderRadius: "12px",
              padding: "18px",
              boxShadow: "0 14px 30px rgba(0, 0, 0, 0.2)",
            }}
          >
            <h3 style={{ margin: 0, color: "#1d2a24" }}>Choose payment method</h3>
            <p style={{ margin: "8px 0 14px", color: "#51635b", fontSize: "0.95rem" }}>
              Total amount: ₹{amount}
            </p>
            <div style={{ display: "grid", gap: "8px", marginBottom: "12px" }}>
              {savedAddresses.length > 0 && (
                <>
                  <label style={{ fontSize: "0.83rem", color: "#40607c", fontWeight: 600 }}>
                    Saved Addresses
                  </label>
                  <select
                    value={selectedAddressId}
                    onChange={(event) => {
                      const nextId = event.target.value;
                      setSelectedAddressId(nextId);
                      applySavedAddress(nextId);
                    }}
                    style={{
                      border: "1px solid #d3dce2",
                      borderRadius: "8px",
                      padding: "8px 10px",
                      fontSize: "0.9rem",
                    }}
                  >
                    {savedAddresses.map((entry) => (
                      <option key={entry.id} value={entry.id}>
                        {entry.label || "Address"} - {entry.address}
                      </option>
                    ))}
                  </select>
                </>
              )}
              <input
                type="text"
                placeholder="Customer name"
                value={customerDetails.name}
                onChange={(event) =>
                  setCustomerDetails((prev) => ({ ...prev, name: event.target.value }))
                }
                style={{
                  border: "1px solid #d3dce2",
                  borderRadius: "8px",
                  padding: "8px 10px",
                  fontSize: "0.9rem",
                }}
              />
              <input
                type="text"
                placeholder="Customer phone"
                value={customerDetails.phone}
                onChange={(event) =>
                  setCustomerDetails((prev) => ({ ...prev, phone: event.target.value }))
                }
                style={{
                  border: "1px solid #d3dce2",
                  borderRadius: "8px",
                  padding: "8px 10px",
                  fontSize: "0.9rem",
                }}
              />
              <textarea
                placeholder="Delivery address"
                rows={2}
                value={customerDetails.address}
                onChange={(event) =>
                  setCustomerDetails((prev) => ({ ...prev, address: event.target.value }))
                }
                style={{
                  border: "1px solid #d3dce2",
                  borderRadius: "8px",
                  padding: "8px 10px",
                  fontSize: "0.9rem",
                  resize: "vertical",
                }}
              />
              <input
                type="text"
                placeholder="Address label (optional)"
                value={addressLabel}
                onChange={(event) => setAddressLabel(event.target.value)}
                style={{
                  border: "1px solid #d3dce2",
                  borderRadius: "8px",
                  padding: "8px 10px",
                  fontSize: "0.9rem",
                }}
              />
              <button
                type="button"
                onClick={saveCurrentAddress}
                style={{
                  border: "1px solid #7ea7d3",
                  background: "#eef6ff",
                  color: "#164f82",
                  padding: "8px 10px",
                  borderRadius: "8px",
                  cursor: "pointer",
                  fontSize: "0.88rem",
                  fontWeight: 600,
                }}
              >
                Save This Address
              </button>
            </div>
            <div style={{ display: "grid", gap: "10px" }}>
              <button
                type="button"
                onClick={() => {
                  setShowMethodPicker(false);
                  handleOnlinePayment();
                }}
                disabled={!hasRequiredCustomerDetails}
                style={{
                  border: "none",
                  background: "#1976d2",
                  color: "#fff",
                  padding: "10px 12px",
                  borderRadius: "8px",
                  cursor: hasRequiredCustomerDetails ? "pointer" : "not-allowed",
                  opacity: hasRequiredCustomerDetails ? 1 : 0.6,
                  fontSize: "0.95rem",
                  fontWeight: 600,
                }}
              >
                Pay Online
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowMethodPicker(false);
                  handleCashOnDelivery();
                }}
                disabled={!hasRequiredCustomerDetails}
                style={{
                  border: "none",
                  background: "#2e7d32",
                  color: "#fff",
                  padding: "10px 12px",
                  borderRadius: "8px",
                  cursor: hasRequiredCustomerDetails ? "pointer" : "not-allowed",
                  opacity: hasRequiredCustomerDetails ? 1 : 0.6,
                  fontSize: "0.95rem",
                  fontWeight: 600,
                }}
              >
                Cash on Delivery
              </button>
              <button
                type="button"
                onClick={() => setShowMethodPicker(false)}
                style={{
                  border: "1px solid #cfd8dc",
                  background: "#fff",
                  color: "#33454f",
                  padding: "9px 12px",
                  borderRadius: "8px",
                  cursor: "pointer",
                  fontSize: "0.92rem",
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default PaymentButton;