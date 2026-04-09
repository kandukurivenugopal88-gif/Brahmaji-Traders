import "./App.css";
// import Products from "./Components/Products/Products.jsx";
// import Header from "./Components/Header/Header.jsx";
// import Profile from "./Components/Profile/Profile.jsx";
// import Home from "./Components/Home/Home.jsx";

import Header from "./Components/Brahmaji Traders/Header/Header.jsx";
import Home from "./Components/Brahmaji Traders/Home/Home.jsx";
import Profile from "./Components/Brahmaji Traders/Profile/Profile.jsx";
import Fotter from "./Components/Brahmaji Traders/Fotter/Fotter.jsx";
import Login from "./Components/Brahmaji Traders/Login/Login.jsx";
import Orders from "./Components/Brahmaji Traders/Orders/Orders.jsx";
import Products from "./Components/Brahmaji Traders/Products/Products.jsx";
import Cart from "./Components/Brahmaji Traders/Products/Cart.jsx";
import PaymentButton from "./Components/Brahmaji Traders/PaymentButton.jsx";
import LiveMarketDashboard from "./Components/Brahmaji Traders/Home/LiveMarketDashboard.jsx";
import WhatsAppChatbotButton from "./Components/Brahmaji Traders/WhatsAppChatbotButton.jsx";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";

const LOGIN_STATE_KEY = "brahmaji_traders_logged_in";
const LOGIN_USER_KEY = "brahmaji_traders_user";
function ContactUs() {
  return (
    <div className="page-container contact-page" style={{ textAlign: "center", fontSize: "1.2rem" }}>
      <h2>Contact Us</h2>
      <p>Email: brahmajitraders9@gmail.com</p>
      <p>Phone: +91-9866926561</p>
      <p>Location: Guntur, Andhra Pradesh</p>
    </div>
  );
}

function PricesPage() {
  return (
    <div className="prices-page-wrap">
      <LiveMarketDashboard />
    </div>
  );
}

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    return localStorage.getItem(LOGIN_STATE_KEY) === "true";
  });
  const [cart, setCart] = useState([]);
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const rawUser = localStorage.getItem(LOGIN_USER_KEY);
      return rawUser ? JSON.parse(rawUser) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    localStorage.setItem(LOGIN_STATE_KEY, String(isLoggedIn));
  }, [isLoggedIn]);

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem(LOGIN_USER_KEY, JSON.stringify(currentUser));
    } else {
      localStorage.removeItem(LOGIN_USER_KEY);
    }
  }, [currentUser]);

  const handleLogin = (user) => {
    setIsLoggedIn(true);
    setCurrentUser(user || null);
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setCurrentUser(null);
    setCart([]);
  };

  const handleAddToCart = (item) => {
    setCart((prev) => {
      const found = prev.find((i) => i.id === item.id);
      if (found) {
        return prev.map((i) =>
          i.id === item.id ? { ...i, qty: i.qty + 1 } : i
        );
      } else {
        return [...prev, { ...item, qty: 1 }];
      }
    });
  };

  const handleRemoveFromCart = (id) => {
    setCart((prev) => {
      const found = prev.find((i) => i.id === id);
      if (found && found.qty > 1) {
        return prev.map((i) =>
          i.id === id ? { ...i, qty: i.qty - 1 } : i
        );
      } else {
        return prev.filter((i) => i.id !== id);
      }
    });
  };

  const handleReorderToCart = (orderItems = []) => {
    if (!Array.isArray(orderItems) || orderItems.length === 0) {
      return;
    }

    setCart((prev) => {
      const next = [...prev];

      orderItems.forEach((item, index) => {
        const name = String(item?.name || `Item ${index + 1}`).trim();
        const normalizedId = `reorder_${name.toLowerCase().replace(/\s+/g, "_")}`;
        const qty = Math.max(1, Number(item?.qty || 1));
        const price = Math.max(0, Number(item?.price || 0));
        const foundIndex = next.findIndex((cartItem) => cartItem.id === normalizedId);

        if (foundIndex >= 0) {
          next[foundIndex] = {
            ...next[foundIndex],
            qty: next[foundIndex].qty + qty,
            price: price || next[foundIndex].price,
          };
          return;
        }

        next.push({
          id: normalizedId,
          name,
          qty,
          price,
        });
      });

      return next;
    });
  };

  const handlePaymentSuccess = () => {
    setCart([]);
  };

  const totalAmount = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  const userRole = currentUser?.role || "customer";
  const isCustomerOnly = userRole === "customer";

  if (!isLoggedIn) {
    return (
      <Router>
        <Routes>
          <Route
            path="/admin-login"
            element={<Login onLogin={handleLogin} allowAdmin={true} adminOnly={true} />}
          />
          <Route
            path="*"
            element={<Login onLogin={handleLogin} allowAdmin={false} />}
          />
        </Routes>
      </Router>
    );
  }

  return (
    <Router>
      <div id="app">
        <Header
          onLogout={handleLogout}
          cartCount={cart.reduce((a, b) => a + b.qty, 0)}
          currentUser={currentUser}
        />

        <main className="app-main">
        <Routes>
          {isCustomerOnly ? (
            <>
              <Route path="/" element={<Home />} />
              <Route
                path="/products"
                element={<Products onAddToCart={handleAddToCart} currentUser={currentUser} />}
              />
              <Route
                path="/orders"
                element={<Orders currentUser={currentUser} onReorder={handleReorderToCart} />}
              />
              <Route path="/prices" element={<PricesPage />} />
              <Route path="/profile" element={<Profile currentUser={currentUser} />} />
              <Route
                path="/cart"
                element={
                  <Cart
                    cartItems={cart}
                    currentUser={currentUser}
                    onRemoveFromCart={handleRemoveFromCart}
                    onPaymentSuccess={handlePaymentSuccess}
                  />
                }
              />
              <Route
                path="/payment"
                element={
                  <PaymentButton
                    amount={totalAmount}
                    cartItems={cart}
                    currentUser={currentUser}
                    onPaymentSuccess={handlePaymentSuccess}
                  />
                }
              />
              <Route path="*" element={<Navigate to="/" />} />
            </>
          ) : (
            <>
              <Route path="/" element={<Home />} />
              <Route
                path="/products"
                element={<Products onAddToCart={handleAddToCart} currentUser={currentUser} />}
              />
              <Route path="/prices" element={<PricesPage />} />
              <Route path="/profile" element={<Profile currentUser={currentUser} />} />
              <Route path="/orders" element={<Orders currentUser={currentUser} />} />
              <Route path="/contactus" element={<ContactUs />} />
              <Route
                path="/cart"
                element={
                  <Cart
                    cartItems={cart}
                    currentUser={currentUser}
                    onRemoveFromCart={handleRemoveFromCart}
                    onPaymentSuccess={handlePaymentSuccess}
                  />
                }
              />
              <Route
                path="/payment"
                element={
                  <PaymentButton
                    amount={totalAmount}
                    cartItems={cart}
                    currentUser={currentUser}
                    onPaymentSuccess={handlePaymentSuccess}
                  />
                }
              />
              <Route path="*" element={<Navigate to="/" />} />
            </>
          )}
        </Routes>
        </main>
        {isCustomerOnly && (
          <WhatsAppChatbotButton currentUser={currentUser} />
        )}
        <Fotter />
      </div>
    </Router>
  );
}

export default App;