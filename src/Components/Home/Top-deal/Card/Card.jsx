import React from "react";
import "./Card.css";
function Card({ image, title }) {
  return (
    <div className="card">
      <div className="card-image" style={{ backgroundImage: `url(${image})` }}></div>
      <h3>{title}</h3>
    </div>
  );
}

export default Card;