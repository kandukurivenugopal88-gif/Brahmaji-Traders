import React from "react";
import "./Cart.css";
import PaymentButton from "../PaymentButton.jsx";

function Cart({ cartItems, currentUser, onRemoveFromCart, onPaymentSuccess }) {
  const total = cartItems.reduce((sum, item) => sum + item.price * item.qty, 0);

  return (
    <div className="cart-section">
      <h2>Cart</h2>
      {cartItems.length === 0 ? (
        <p>Your cart is empty.</p>
      ) : (
        <table className="cart-table">
          <thead>
            <tr>
              <th>Item</th>
              <th>Qty</th>
              <th>Price</th>
              <th>Remove</th>
            </tr>
          </thead>
          <tbody>
            {cartItems.map((item) => (
              <tr key={item.id}>
                <td>{item.name}</td>
                <td>{item.qty}</td>
                <td>₹{item.price * item.qty}</td>
                <td>
                  <button onClick={() => onRemoveFromCart(item.id)}>&times;</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="cart-total">Total: ₹{total}</div>
      {cartItems.length > 0 && (
        <div className="cart-checkout-actions">
          <PaymentButton
            amount={total}
            cartItems={cartItems}
            currentUser={currentUser}
            onPaymentSuccess={onPaymentSuccess}
          />
        </div>
      )}
    </div>
  );
}

export default Cart;
