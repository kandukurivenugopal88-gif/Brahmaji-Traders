import { useEffect, useRef, useState } from "react";
import "./WhatsAppChatbotButton.css";
import productsData from "./Products/productsData.json";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");
const FALLBACK_API_BASE_URL = "http://localhost:5000";
const QUICK_SUGGESTIONS = [
  "Track my order status",
  "How to place order",
  "Payment failed what to do",
  "Forgot password OTP help",
  "Check product availability",
  "Show live price info",
];

function resolveApiUrl(path) {
  if (API_BASE_URL) {
    return `${API_BASE_URL}${path}`;
  }
  return path;
}

async function reportCustomerIssue({ customerEmail, issueText, botReply }) {
  const endpoint = "/api/chat/issues";
  const primaryUrl = resolveApiUrl(endpoint);
  const payload = {
    customerEmail: String(customerEmail || "").trim().toLowerCase(),
    issueText: String(issueText || "").trim(),
    botReply: String(botReply || "").trim(),
  };
  const options = {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  };

  try {
    const response = await fetch(primaryUrl, options);
    if (response.ok || API_BASE_URL) {
      return;
    }
    await fetch(`${FALLBACK_API_BASE_URL}${endpoint}`, options);
  } catch {
    if (!API_BASE_URL) {
      await fetch(`${FALLBACK_API_BASE_URL}${endpoint}`, options);
    }
  }
}

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function includesAny(text, words) {
  return words.some((word) => text.includes(word));
}

function buildProductResponse(queryText) {
  const normalized = normalizeText(queryText);
  const foundProduct = productsData.find((item) => {
    const productName = normalizeText(item?.name);
    return productName && normalized.includes(productName);
  });

  if (!foundProduct) {
    return "";
  }

  const stockHint = includesAny(normalized, ["stock", "available", "out of stock", "availability"])
    ? "Stock is shown in Products page and updates from admin changes quickly."
    : "";
  const priceHint = includesAny(normalized, ["price", "rate", "cost"])
    ? `Current listed rate is around INR ${foundProduct.price} per kg.`
    : "";

  return [
    `${foundProduct.name} is available in Products section under ${foundProduct.category} category.`,
    priceHint,
    stockHint,
    "Open Products page to add it to cart and place order.",
  ]
    .filter(Boolean)
    .join(" ");
}

function getBotReply(query) {
  const text = normalizeText(query);

  const asksPrivateInfo = includesAny(text, [
    "admin mobile",
    "admin number",
    "admin phone",
    "personal number",
    "private number",
    "whatsapp number",
    "contact number",
  ]);

  if (asksPrivateInfo) {
    return "I cannot share private contact details. I can help with product, order tracking, payment, login, delivery, and profile questions.";
  }

  const productSpecificReply = buildProductResponse(text);
  if (productSpecificReply) {
    return productSpecificReply;
  }

  const intents = [
    {
      id: "order_tracking",
      keywords: ["order", "track", "tracking", "status", "my orders", "where is my order"],
      answer:
        "For order tracking: open My Orders page in customer portal. You can see status like new, accepted, packed, shipped, delivered, or rejected. If order is missing, login with the same email used at checkout.",
    },
    {
      id: "place_order",
      keywords: ["how to order", "place order", "buy", "checkout", "cart"],
      answer:
        "To place order: open Products, add items to cart, go to Cart, fill customer name/email/phone/address, then choose COD or online payment and confirm.",
    },
    {
      id: "payment",
      keywords: ["payment", "paid", "cod", "upi", "razorpay", "transaction", "pay"],
      answer:
        "Payment support: both COD and online payment are available. Ensure customer details are valid before payment. If online payment fails, retry once and verify network/bank app.",
    },
    {
      id: "login_reset",
      keywords: ["login", "signin", "sign in", "password", "forgot", "otp", "account"],
      answer:
        "Account help: use Login page with your registered email. For password issue, click Forgot Password, request OTP, and set a new password.",
    },
    {
      id: "delivery",
      keywords: ["delivery", "shipping", "address", "phone", "dispatch"],
      answer:
        "Delivery help: provide correct address and phone during checkout. You can monitor delivery progress in My Orders tracking.",
    },
    {
      id: "price",
      keywords: ["price", "rate", "market", "live price", "cost"],
      answer:
        "Price help: check Live Price page for latest rates, and Products page for per-item listed price.",
    },
    {
      id: "stock",
      keywords: ["stock", "available", "out of stock", "availability"],
      answer:
        "Stock help: Products page shows stock availability. Out-of-stock items are marked and cannot be added to cart.",
    },
    {
      id: "refund_cancel",
      keywords: ["refund", "cancel", "cancellation", "return"],
      answer:
        "Refund/cancel help: share your order details in support request. Admin reviews the request and updates order status in tracking.",
    },
    {
      id: "profile",
      keywords: ["profile", "customer details", "update details", "my account"],
      answer:
        "Profile help: open Profile page to view account information. Keep your email and phone details accurate for order updates.",
    },
  ];

  let bestIntent = null;
  let bestScore = 0;

  intents.forEach((intent) => {
    const score = intent.keywords.reduce((total, keyword) => {
      return total + (text.includes(keyword) ? 1 : 0);
    }, 0);

    if (score > bestScore) {
      bestScore = score;
      bestIntent = intent;
    }
  });

  if (bestIntent && bestScore > 0) {
    return bestIntent.answer;
  }

  return "I can answer website-related questions on Products, Cart, My Orders tracking, Payments, Login/OTP, Delivery, Live Price, and Profile. Please ask your question with one of these topics.";
}

function WhatsAppChatbotButton({ currentUser }) {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const messageSeqRef = useRef(1);
  const chatbotContainerRef = useRef(null);
  const [messages, setMessages] = useState([
    {
      id: "welcome",
      role: "bot",
      text: "Hello. I am AI support for customer issues. Ask your product, order, payment, login, or delivery questions here.",
    },
  ]);

  const sendChatMessage = (rawText) => {
    const clean = String(rawText || "").trim();
    if (!clean) {
      return;
    }

    const userMessage = {
      id: `u_${messageSeqRef.current}`,
      role: "user",
      text: clean,
    };
    messageSeqRef.current += 1;
    const botMessage = {
      id: `b_${messageSeqRef.current}`,
      role: "bot",
      text: getBotReply(clean),
    };
    messageSeqRef.current += 1;

    setMessages((prev) => [...prev, userMessage, botMessage]);
    setInput("");

    reportCustomerIssue({
      customerEmail: String(currentUser?.email || "customer@portal").trim().toLowerCase(),
      issueText: clean,
      botReply: botMessage.text,
    }).catch(() => {
      // Chat experience should continue even when issue logging fails.
    });
  };

  const onSend = () => {
    sendChatMessage(input);
  };

  const onSuggestionClick = (suggestion) => {
    sendChatMessage(suggestion);
  };

  useEffect(() => {
    const onDocumentMouseDown = (event) => {
      if (!isOpen) {
        return;
      }

      if (chatbotContainerRef.current && !chatbotContainerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", onDocumentMouseDown);
    return () => {
      document.removeEventListener("mousedown", onDocumentMouseDown);
    };
  }, [isOpen]);

  return (
    <div ref={chatbotContainerRef}>
      <button
        type="button"
        className="whatsapp-chatbot-button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label="Open support chatbot"
        title="Open support chatbot"
      >
        <i className="bi bi-whatsapp" aria-hidden="true" />
        <span>{isOpen ? "Close Chat" : "AI Chat"}</span>
      </button>

      {isOpen && (
        <section className="support-chat-panel" aria-label="Customer AI support chat">
          <div className="support-chat-header">
            <h4>Customer AI Support</h4>
          </div>

          <p className="support-chat-hint">
            Ask about products, order tracking, payment, login OTP, delivery, live price, and profile.
          </p>

          <div className="support-chat-suggestions" aria-label="Quick support topics">
            {QUICK_SUGGESTIONS.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => onSuggestionClick(suggestion)}
              >
                {suggestion}
              </button>
            ))}
          </div>

          <div className="support-chat-messages">
            {messages.map((message) => (
              <p
                key={message.id}
                className={`chat-msg ${message.role === "user" ? "user" : "bot"}`}
              >
                {message.text}
              </p>
            ))}
          </div>

          <div className="support-chat-input">
            <input
              type="text"
              placeholder="Type your issue..."
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  onSend();
                }
              }}
            />
            <button type="button" onClick={onSend}>Send</button>
          </div>
        </section>
      )}
    </div>
  );
}

export default WhatsAppChatbotButton;
