import React from "react";
import "./Ad.css";

function Ad() {
  return (
    <div className="ad">
      <div className="mainAd">
        <img
          src="https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=1400&q=80"
          alt="Fresh vegetables"
        />
      </div>
      <div className="subAd1">
        <img
          src="https://images.unsplash.com/photo-1518977956812-cd3dbadaaf31?auto=format&fit=crop&w=1000&q=80"
          alt="Market produce"
        />
      </div>
      <div className="subAd2">
        <img
          src="https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=1000&q=80"
          alt="Fruit and vegetable basket"
        />
      </div>
    </div>
  );
}

export default Ad;
